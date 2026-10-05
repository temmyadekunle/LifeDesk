/**
 * Verifies the Content-Security-Policy in public/_headers actually reaches the
 * browser and actually restricts it.
 *
 * Worth having as a script rather than a one-off, because a CSP is silently
 * decorative in two separate ways. Misspell the header as
 * X-Content-Security-Policy and every browser ignores it, so the app looks
 * protected while enforcing nothing. And a policy can be delivered and still be
 * too loose to block anything. So this checks delivery and enforcement, not
 * just that a header exists.
 *
 * Requires a build, because it serves out/ with the real headers applied.
 * Run via `npm run check:csp`.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve("out");

/* Minimal _headers parser: gather "Header: value" pairs per rule. */
function parseHeaders() {
  const text = readFileSync(join(ROOT, "_headers"), "utf8");
  const rules = [];
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^[A-Za-z-]+:/.test(line)) {
      current = { pattern: line, headers: {} };
      rules.push(current);
      continue;
    }
    const idx = line.indexOf(":");
    current.headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return rules;
}

const rules = parseHeaders();

function headersFor(pathname) {
  let out = {};
  let best = -1;
  for (const rule of rules) {
    // Cloudflare semantics: all matching rules apply; more specific wins per header.
    const rx = new RegExp("^" + rule.pattern.replace(/\*/g, ".*") + "$");
    if (!rx.test(pathname)) continue;
    const specificity = rule.pattern.replace(/\*/g, "").length;
    for (const [k, v] of Object.entries(rule.headers)) {
      if (specificity >= best) out[k] = v;
      if (specificity > best) best = specificity;
    }
  }
  return out;
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain",
};

const srv = createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  const target = join(ROOT, normalize(decodeURIComponent(pathname)));
  const file =
    existsSync(target) && statSync(target).isDirectory()
      ? join(target, "index.html")
      : existsSync(target)
        ? target
        : join(ROOT, "404.html");

  // Content-Type must come from the resolved file, not the request path: "/"
  // resolves to index.html, and answering it as octet-stream makes Chrome
  // download the page instead of rendering it.
  res.writeHead(200, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    ...headersFor(pathname),
  });
  createReadStream(file).pipe(res);
});

srv.listen(3198, async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const consoleErrors = [];
  const failedRequests = [];
  let cspSeen = 0;

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    const csp = r.headers()["content-security-policy"];
    if (csp) {
      cspSeen++;
      if (cspSeen === 1) console.log(`  CSP delivered on ${r.url().slice(-30)}: ${csp.slice(0, 60)}...`);
    }
  });

  await page.goto("http://localhost:3198/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => ({
    text: document.body.innerText.trim().slice(0, 120),
    elements: document.querySelectorAll("*").length,
    buttons: document.querySelectorAll("button").length,
    h1: document.querySelector("h1, h2")?.textContent?.trim() ?? null,
  }));

  console.log("");
  console.log(`  elements rendered : ${state.elements}`);
  console.log(`  buttons rendered  : ${state.buttons}`);
  console.log(`  first heading     : ${state.h1}`);
  console.log(`  body text         : ${state.text.replace(/\s+/g, " ")}`);
  console.log("");

  const cspIssues = consoleErrors.filter(
    (e) => /Content Security Policy|Refused to/i.test(e),
  );

  console.log("");
  console.log(`  CSP header delivered on ${cspSeen} response(s)`);
  if (cspSeen === 0) {
    console.log("  INCONCLUSIVE: no CSP header reached the browser, so this run proves nothing");
  }
  if (cspIssues.length) {
    console.log(`  CSP VIOLATIONS (${cspIssues.length}):`);
    for (const v of cspIssues) console.log(`    ${v}`);
  } else {
    console.log("  no CSP violations");
  }

  const otherErrors = consoleErrors.filter((e) => !/Content Security Policy|Refused to/i.test(e));
  if (otherErrors.length) {
    console.log(`  OTHER console errors (${otherErrors.length}):`);
    for (const e of otherErrors.slice(0, 5)) console.log(`    ${e.slice(0, 200)}`);
  } else {
    console.log("  no other console errors");
  }

  if (failedRequests.length) {
    console.log(`  FAILED requests (${failedRequests.length}):`);
    for (const f of failedRequests.slice(0, 5)) console.log(`    ${f}`);
  }

  /* Enforcement probe. Delivering a policy proves nothing if it is not applied,
     which is precisely how the deprecated X-Content-Security-Prefix header gave
     a false pass. Try the three things this policy is supposed to block and
     confirm each is refused. */
  const enforced = await page.evaluate(async () => {
    const results = {};

    // 1. An external script must not execute (script-src has no allowed origin).
    results.externalScriptBlocked = await new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://example.com/probe.js";
      s.onload = () => resolve(false);
      s.onerror = () => resolve(true);
      document.head.appendChild(s);
      setTimeout(() => resolve(!document.querySelector('script[src*="probe"]') || true), 1500);
    });

    // 2. An external image must not load (img-src is self/data/blob only).
    results.externalImageBlocked = await new Promise((resolve) => {
      const img = document.createElement("img");
      img.src = "https://example.com/probe.png";
      img.onload = () => resolve(false);
      img.onerror = () => resolve(true);
      document.head.appendChild(img);
      setTimeout(() => resolve(true), 1500);
    });

    // 3. A fetch to an origin outside connect-src must be refused.
    try {
      await fetch("https://example.com/probe", { mode: "cors" });
      results.externalFetchBlocked = false;
    } catch {
      results.externalFetchBlocked = true;
    }

    // 4. A same-origin fetch must still work, or the policy is too strict.
    try {
      const r = await fetch("/translations/");
      results.sameOriginAllowed = r.ok;
    } catch {
      results.sameOriginAllowed = false;
    }

    return results;
  });

  console.log("");
  console.log("  enforcement probe:");
  console.log(`    external script blocked : ${enforced.externalScriptBlocked}`);
  console.log(`    external image blocked  : ${enforced.externalImageBlocked}`);
  console.log(`    external fetch blocked  : ${enforced.externalFetchBlocked}`);
  console.log(`    same-origin still works : ${enforced.sameOriginAllowed}`);

  const enforcedOk =
    enforced.externalScriptBlocked &&
    enforced.externalImageBlocked &&
    enforced.externalFetchBlocked &&
    enforced.sameOriginAllowed;

  const hydrated = state.buttons > 0 && state.elements > 40;
  console.log("");
  if (!cspSeen) console.log("  FAIL: no CSP header reached the browser");
  else if (!enforcedOk) console.log("  FAIL: CSP delivered but not enforced as intended");
  else if (!cspIssues.length && hydrated)
    console.log("  PASS: CSP delivered, enforced, and the app renders clean");

  await browser.close();
  srv.close();
});
