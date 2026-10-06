/**
 * Responsive layout audit against the real production build in out/.
 *
 * This exists because the layout was never verified by looking at it. Colour was
 * checked numerically by scripts/check-contrast.mjs and the tests cover logic,
 * but nothing asserted the things that actually break a phone: a screen wider
 * than the viewport, a 28px tap target, a label cut off by its own container, an
 * icon button with no accessible name.
 *
 * Every check runs in the page against real layout, in the browser, so it sees
 * what a user sees rather than what the stylesheet intended.
 *
 *   node scripts/responsive-qa.mjs            # audit, non-zero exit on failure
 *   node scripts/responsive-qa.mjs --shots    # also write PNGs to qa-shots/
 *   node scripts/responsive-qa.mjs /landing/  # audit a route other than the app
 *
 * Uses the Chrome already installed on the machine rather than a Playwright
 * browser download, so it runs without a ~150MB fetch.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve("out");
const SHOTS = resolve("qa-shots");
const wantShots = process.argv.includes("--shots");

/** Which route to audit. Defaults to the app at /; pass e.g. /landing/. */
const ROUTE = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "/";
/** Slug for screenshot filenames, so two routes do not overwrite each other. */
const SLUG = ROUTE.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";

/** The widths that decide whether this app works. 360 is the narrowest phone
 *  still sold in volume; 390 and 412 are the common Android and Pro Max sizes. */
const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x800", width: 1280, height: 800 },
];

/** Minimum touch target, per the project's own --tap token. */
const MIN_TAP = 44;

if (!existsSync(ROOT)) {
  console.error('No out/ directory. Run "npm run build" first.');
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function serve(port) {
  const send = (res, file) => {
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  };
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const target = join(ROOT, normalize(decodeURIComponent(pathname)));
    if (!target.startsWith(ROOT)) return send(res, join(ROOT, "404.html"));
    if (existsSync(target) && statSync(target).isDirectory()) {
      const index = join(target, "index.html");
      return existsSync(index) ? send(res, index) : send(res, join(ROOT, "404.html"));
    }
    return send(res, existsSync(target) ? target : join(ROOT, "404.html"));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

/* ------------------------------------------------------------------ *
 * In-page audit. Runs once per viewport and returns structured findings
 * rather than asserting, so a failure reports what and where.
 *
 * Serialised into the page by Playwright, so it cannot close over anything
 * from this module: minTap arrives as an argument.
 * ------------------------------------------------------------------ */
function audit(minTap) {
  const findings = [];
  const seen = new Set();
  const push = (kind, detail, where, severity = "fail") => {
    const key = `${kind}|${where}|${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, detail, where, severity });
  };

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const text = (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /* Inside a role="img" the content is a picture, not interface.
     The landing page's phone mockups are marked up that way on purpose: they
     render the real app screens but their controls are inert, so a 42px-wide
     filter chip in a 300px-wide illustration is a scale artefact of the
     picture rather than a tap target a thumb will ever miss. Judging them
     reports a defect that does not exist in the product. */
  const inPicture = (el) => el.closest('[role="img"]') !== null;

  /* 1. Nothing may be wider than the viewport. The classic mobile bug is a
        fixed-width sheet or a long unbroken token pushing the whole document. */
  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth + 1) {
    // Name the widest offender so the report is actionable.
    let worst = null;
    let worstRight = 0;
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > worstRight) {
        worstRight = r.right;
        worst = el;
      }
    }
    push(
      "horizontal-overflow",
      `document scrollWidth ${doc.scrollWidth} > viewport ${window.innerWidth}` +
        (worst ? `, widest element ${describe(worst)} ends at ${Math.round(worstRight)}px` : ""),
      "document",
    );
  }

  /* 2. Tap targets. Only real controls: a link inside a sentence is text, not a
        button, and demanding 44px of it would be wrong. */
  const controls = document.querySelectorAll(
    "button, [role='button'], input:not([type='hidden']), select, textarea, a[href]",
  );
  for (const el of controls) {
    if (!visible(el)) continue;
    if (inPicture(el)) continue;
    const inlineInProse = el.tagName === "A" && el.closest("p, li.tip, .card-meta, .hint");
    if (inlineInProse) continue;
    const r = el.getBoundingClientRect();
    const small = Math.min(r.width, r.height);
    if (small < minTap - 0.5) {
      push(
        "tap-target",
        `${describe(el)} is ${Math.round(r.width)}x${Math.round(r.height)}, under ${minTap}px` +
          (text(el) ? ` "${text(el).slice(0, 40)}"` : ""),
        describe(el),
      );
    }
  }

  /* 3. Text clipped by its own box. An ellipsis is a deliberate truncation and
        is fine; a hard cut with no ellipsis is a bug. */
  for (const el of document.querySelectorAll("p, h1, h2, h3, span, div, label, li, button, a")) {
    if (!visible(el)) continue;
    if (!text(el)) continue;
    if (inPicture(el)) continue;
    /* .sr-only is *meant* to be clipped to 1px: it is readable by a screen
       reader and invisible on screen. Flagging it would report the utility
       working correctly as if it were a truncation bug. */
    if (el.closest(".sr-only")) continue;
    const s = getComputedStyle(el);
    if (s.overflow === "visible" || s.overflowX === "visible") continue;
    if (s.textOverflow === "ellipsis") continue;
    // Only leaf-ish elements: a parent clipping is usually overflow:hidden for
    // rounded corners or a scroll container, not lost text.
    if (el.children.length > 0 && !["P", "H1", "H2", "H3", "LABEL", "LI"].includes(el.tagName)) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      push("clipped-text", `${describe(el)} clips "${text(el).slice(0, 40)}"`, describe(el));
    }
  }

  /* 4. Icon-only controls need an accessible name, or a screen reader announces
        an unlabelled button. */
  for (const el of document.querySelectorAll("button, [role='button'], a[href]")) {
    if (!visible(el)) continue;
    const name = (el.getAttribute("aria-label") ?? el.getAttribute("title") ?? text(el)).trim();
    if (!name) {
      push("missing-accessible-name", `${describe(el)} has no aria-label or text`, describe(el));
    }
  }

  /* 5. Contrast on the rendered DOM, not just the token table. Walks up for the
        first opaque background, which is what the eye actually sees. */
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(",").map((v) => parseFloat(v));
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  /* Every rgb() colour stop in a background-image, so a gradient can be judged
     on its worst end rather than skipped or, worse, mistaken for the page
     background. Fully transparent stops are dropped: `transparent` computes to
     rgba(0,0,0,0), which is not a colour anyone can read, and treating it as
     black made a soft brand-coloured wash score as unreadable black. */
  const stopsOf = (bgImage) => {
    if (!bgImage || bgImage === "none") return [];
    const out = [];
    for (const m of bgImage.matchAll(/rgba?\([^)]+\)/g)) {
      const c = parse(m[0]);
      if (c && c.a > 0) out.push(c);
    }
    return out;
  };

  /* Collects every background behind this element: solid fills, and the colour
     stops of any gradient found on the way up. Returns null-ish when a gradient
     is involved, because there is no single correct answer and the honest thing
     is to report the worst case.

     The walk stops at the first opaque fill. Anything painted above an opaque
     background is invisible, so folding its gradient in produced confident wrong
     readings: text inside a phone mockup was judged against the dark bezel
     gradient that surrounds it, even though the mockup's own white screen sits
     between the two and hides the bezel completely. */
  const backdrop = (el) => {
    let solid = null;
    const gradients = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      const stops = stopsOf(s.backgroundImage);
      if (stops.length) gradients.push(...stops);
      const c = parse(s.backgroundColor);
      if (!solid && c && c.a > 0.5) {
        solid = c;
        // Opaque here: the backdrop is settled, so stop before a parent's
        // gradient can be mistaken for something the reader can see.
        break;
      }
    }
    return { solid: solid ?? { r: 255, g: 255, b: 255 }, gradients };
  };

  for (const el of document.querySelectorAll("p, h1, h2, h3, span, label, button, a, li, div")) {
    if (!visible(el)) continue;
    if (inPicture(el)) continue;
    // A container's own text is its descendants' text; only judge direct text.
    const direct = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!direct) continue;
    const s = getComputedStyle(el);

    /* Text painted by clipping its own background (the gradient heading on the
       landing page) has no real foreground colour to measure: the gradient is
       the glyph fill, and the computed `color` is a transparent placeholder.
       Judging that placeholder against a gradient stop reports a number that
       looks like a failure and is not one. */
    const bgClip = s.webkitBackgroundClip || s.backgroundClip;
    if (bgClip === "text") continue;

    const fg = parse(s.color);
    if (!fg || fg.a < 0.5) continue;
    const { solid, gradients } = backdrop(el);

    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const min = large ? 3 : 4.5;

    /* Behind a gradient the nearest solid fill is not what the eye reads, so
       judging against it produces a confident wrong answer: white on a navy
       gradient scored 1.06:1 against the page's near-white. Use the worst
       gradient stop instead. */
    if (gradients.length) {
      const worst = gradients
        .map((g) => ({ g, r: ratio(fg, g) }))
        .sort((a, b) => a.r - b.r)[0];
      if (worst.r < min) {
        const hex = `#${[worst.g.r, worst.g.g, worst.g.b]
          .map((v) => Math.round(v).toString(16).padStart(2, "0"))
          .join("")}`;
        push(
          "contrast-on-gradient",
          `worst stop ${hex} gives ${worst.r.toFixed(2)}:1, under ${min}, ` +
            `at ${px}px "${direct.slice(0, 32)}"`,
          describe(el),
          // Informational: the text may sit over the dark end of the ramp
          // rather than the worst one, and that cannot be told from the DOM.
          "warn",
        );
      }
      continue;
    }

    const r = ratio(fg, solid);
    if (r < min) {
      push(
        "contrast",
        `${r.toFixed(2)}:1 under ${min} at ${px}px "${direct.slice(0, 32)}"`,
        describe(el),
      );
    }
  }

  /* 6. The onboarding call to action has to be reachable without scrolling. The
        logo was resized to protect exactly this, so it should be asserted. */
  const cta = document.querySelector(".btn--primary, .btn--lg");
  if (cta && visible(cta)) {
    const r = cta.getBoundingClientRect();
    if (r.bottom > window.innerHeight + 1) {
      push(
        "below-fold-cta",
        `primary action ends at ${Math.round(r.bottom)}px, viewport is ${window.innerHeight}px`,
        describe(cta),
      );
    }
  }

  return {
    findings,
    metrics: {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      elements: document.querySelectorAll("*").length,
    },
  };
}

/* ------------------------------------------------------------------ */

const port = 3199;
const server = await serve(port);
const base = `http://localhost:${port}/`;

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  console.error(
    "Could not launch a browser. Install Chrome, or run:\n  npx playwright install chromium",
  );
  server.close();
  process.exit(1);
}

if (wantShots) mkdirSync(SHOTS, { recursive: true });

let total = 0;
let warnTotal = 0;
let failed = 0;
let warned = 0;

console.log(`Auditing ${ROOT}`);
console.log(`Route ${ROUTE}`);
console.log(`Serving ${base}\n`);

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    // A stable locale so date formatting cannot vary between runs.
    locale: "en-GB",
    timezoneId: "Africa/Lagos",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(base + ROUTE.replace(/^\//, ""), { waitUntil: "networkidle" });
  // Onboarding renders after IndexedDB opens and the desk hydrates.
  await page.waitForTimeout(700);

  const { findings, metrics } = await page.evaluate(audit, MIN_TAP);

  if (wantShots) {
    await page.screenshot({
      path: join(SHOTS, `${SLUG}-${vp.name}.png`),
      fullPage: true,
    });
  }

  const errors = findings.filter((f) => f.severity !== "warn");
  const warnings = findings.filter((f) => f.severity === "warn");
  const overflow = metrics.scrollWidth > metrics.innerWidth;
  const clean = errors.length === 0 && consoleErrors.length === 0;
  if (!clean) failed++;
  if (warnings.length) warned++;

  const tag = clean ? (warnings.length ? "warn" : "pass") : "FAIL";
  console.log(
    `${tag.padEnd(4)} ${vp.name.padEnd(10)} ${String(metrics.elements).padStart(4)} elements` +
      (overflow ? `  scrollWidth ${metrics.scrollWidth}` : "") +
      (warnings.length ? `  ${warnings.length} warning(s)` : ""),
  );

  for (const f of errors) {
    console.log(`       [${f.kind}] ${f.detail}`);
  }
  for (const w of warnings) {
    console.log(`    ~  [${w.kind}] ${w.detail}`);
  }
  for (const e of consoleErrors.slice(0, 3)) {
    console.log(`       [console-error] ${e.slice(0, 160)}`);
  }
  total += errors.length + consoleErrors.length;
  warnTotal += warnings.length;

  await context.close();
}

await browser.close();
server.close();

console.log("");
if (wantShots) console.log(`screenshots: ${SHOTS}`);
console.log(
  `${VIEWPORTS.length} viewports: ${VIEWPORTS.length - failed} clean, ${failed} with failures ` +
    `(${total} finding(s) total), ${warned} with warnings.`,
);
if (warnTotal) console.log(`${warnTotal} warning(s) need a human eye; they are not counted as failures.`);

if (failed > 0) process.exitCode = 1;