/**
 * End-to-end smoke test for the code-split screens.
 *
 * The bottom-nav screens (Things, Calendar, Services, Profile) and the module
 * screen are loaded on demand via next/dynamic rather than being part of the
 * first paint. That trades a static guarantee for a runtime one: the split can
 * regress silently — a wrong export name, a chunk that 404s, a component that
 * throws on first mount — without any type or unit test noticing, because those
 * tests never boot the browser.
 *
 * So this script serves the real static export (out/) over HTTP, walks through
 * onboarding the way a first-time user would, then opens every screen and
 * asserts its distinctive marker lands in the DOM. It also collects page
 * errors, console errors and failed requests, so a lazy chunk that loads but
 * crashes still fails the run. The report line listing JS fetched after boot
 * doubles as proof the chunks really are deferred: none of them appear until
 * their screen is opened.
 *
 * Requires a build, because it serves out/ — same contract as check-csp.mjs.
 * Run via `npm run smoke`.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = join(process.cwd(), "out");
const PORT = 3199;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

if (!existsSync(join(ROOT, "index.html"))) {
  console.error("out/index.html not found — run `npm run build` first.");
  process.exit(1);
}

const srv = createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  const target = join(ROOT, normalize(decodeURIComponent(pathname)));
  const file =
    existsSync(target) && statSync(target).isDirectory()
      ? join(target, "index.html")
      : existsSync(target)
        ? target
        : join(ROOT, "404.html");
  res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => srv.listen(PORT, r));

const consoleErrors = [];
const pageErrors = [];
const failed = [];
const badResponses = [];
const jsAfterBoot = [];
let booted = false;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("requestfailed", (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
// A 404 is a completed request, so requestfailed never sees it. The logo
// shipped broken for exactly this reason — track bad statuses explicitly.
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
});
page.on("response", (r) => {
  if (booted && r.url().endsWith(".js")) jsAfterBoot.push(r.url().split("/").pop());
});

let failures = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}: ${String(e.message).split("\n")[0]}`);
  }
};

/** Waits for the Suspense skeleton to leave, if it appeared at all. */
const settle = async () => {
  await page
    .waitForSelector(".screen-skel", { state: "detached", timeout: 8000 })
    .catch(() => {});
};

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

// --- onboarding -------------------------------------------------------------
await step("onboarding completes", async () => {
  // Screen 1: welcome. Get Started and the sign-in link are both visible.
  await page.waitForSelector('button:has-text("Get Started")', { timeout: 10000 });
  await page.locator('button:has-text("I already have an account")').waitFor({
    state: "visible",
    timeout: 5000,
  });
  await page.locator('button:has-text("Get Started")').click();
  await page.waitForTimeout(200);

  // Screen 2: what Livanta does.
  await page.locator('button:has-text("Continue")').click({ timeout: 5000 });
  await page.waitForTimeout(200);

  // Screen 3: pick one area so Continue enables.
  const cont = page.locator('button:has-text("Continue")').first();
  await page.locator("button.tile").first().click();
  await cont.click({ timeout: 5000 });
  await page.waitForTimeout(200);

  // Screen 4: give the first example a date so Continue enables.
  await page.locator('.ob-ex input[type="date"]').first().fill("2027-06-30");
  await cont.click({ timeout: 5000 });
  await page.waitForTimeout(200);

  // Screen 5: decline the permission prompt and land on the dashboard.
  await page.locator('button:has-text("Not Now")').click({ timeout: 5000 });
  await page.waitForSelector(".bottomnav", { timeout: 10000 });
  booted = true;
});

// --- tabs -------------------------------------------------------------------
const screens = [
  ["Things", ".searchbar"],
  ["Calendar", ".month__grid"],
  ["Services", "text=Service providers"],
  ["Profile", ".profile-id"],
  ["Home", ".hero"],
];
for (const [name, marker] of screens) {
  await step(`${name} tab renders`, async () => {
    await page.click(`.bottomnav button:has-text("${name}")`);
    await settle();
    await page.waitForSelector(marker, { timeout: 8000 });
  });
}

// --- module screen (pushed from Home) ---------------------------------------
await step("Module screen renders", async () => {
  await page.click('.module-grid button:has-text("Bills")');
  await settle();
  await page.waitForSelector('.appbar__title:has-text("Bills")', { timeout: 8000 });
});

// --- report -----------------------------------------------------------------
console.log("");
console.log(
  `  lazy JS chunks fetched after boot: ${jsAfterBoot.length ? jsAfterBoot.join(", ") : "(none)"}`,
);
console.log(`  page errors     : ${pageErrors.length}`);
for (const e of pageErrors) console.log(`    ${e}`);
console.log(`  console errors  : ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 5)) console.log(`    ${e.slice(0, 160)}`);
console.log(`  failed requests : ${failed.length}`);
for (const f of failed.slice(0, 5)) console.log(`    ${f}`);
console.log(`  4xx/5xx answers: ${badResponses.length}`);
for (const f of badResponses.slice(0, 5)) console.log(`    ${f}`);

await browser.close();
srv.close();

if (failures || pageErrors.length || consoleErrors.length || failed.length || badResponses.length) {
  console.log("  RESULT: FAIL");
  process.exit(1);
}
console.log("  RESULT: PASS");
