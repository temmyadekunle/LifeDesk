/**
 * Captures the screen images used by the product presentation
 * (docs/prototype.md and the /prototype page).
 *
 * Screenshots are taken from the real static export at phone size with the
 * demo dataset loaded, so what the presentation shows is what the shipped app
 * renders — the same guarantee the landing page phone mockups rely on.
 *
 * Requires a build (`npm run build`) because it serves out/. Output goes to
 * public/prototype/*.png, which the /prototype page references directly.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = join(process.cwd(), "out");
const OUT = join(process.cwd(), "public", "prototype");
const PORT = 3211;

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
mkdirSync(OUT, { recursive: true });

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

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

const settle = async () => {
  await page
    .waitForSelector(".screen-skel", { state: "detached", timeout: 8000 })
    .catch(() => {});
};

const shot = async (name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  captured ${name}.png`);
};

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

// 1. onboarding welcome (before the demo seeds anything)
await page.waitForSelector('button:has-text("Get Started")', { timeout: 10000 });
await shot("welcome");

// 2. value-prop step
await page.locator('button:has-text("Get Started")').click();
await page.locator('text=Know what needs your attention').waitFor({ state: "visible", timeout: 5000 });
await shot("value-prop");
await page.locator('button:has-text("Back")').first().click();
await page.waitForTimeout(200);

// 3. demo boot → home
await page.locator('button:has-text("Open with demo data")').click();
await page.waitForSelector(".hero", { timeout: 15000 });
await page.waitForSelector(".attention-lead", { timeout: 10000 });
await page.waitForTimeout(300);
await shot("home");

// 4. quick-add chooser (from the FAB)
await page.locator(".fab").click();
await page.locator('text=What do you need to add?').waitFor({ state: "visible", timeout: 5000 });
await shot("quick-add");
await page.locator('[aria-label="Close"], .sheet__close').first().click().catch(() => {});
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(300);

// 5. life tab
await page.click('.bottomnav button:has-text("Life")');
await settle();
await page.waitForSelector(".searchbar", { timeout: 8000 });
await page.waitForTimeout(300);
await shot("life");

// 6. item detail (open the first row of the life list)
await page.locator("main .listrow").first().click();
await page.waitForSelector(".sheet, [role=dialog]", { timeout: 5000 });
await page.waitForTimeout(300);
await shot("detail");
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(300);

// 7. documents module (pushed from the Life areas list)
const openSheets = await page.locator(".sheet__backdrop").count();
if (openSheets) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
await page.click('.bottomnav button:has-text("Life")');
await settle();
const areasCard = page
  .locator('button.card:has(.module-label:text-is("Documents"))')
  .first();
await areasCard.click();
await settle();
console.log(
  `  after areas click: title="${await page.locator(".appbar__title").textContent()}" sheets=${await page.locator(".sheet__backdrop").count()}`,
);
await page.waitForSelector('.appbar__title:has-text("Documents")', { timeout: 8000 });
await page.waitForTimeout(300);
await shot("module-documents");
await page.locator(".appbar .iconbtn").first().click();
await settle();
await page.waitForTimeout(300);

// 8. alerts tab (the three brief sections)
await page.click('.bottomnav button:has-text("Alerts")');
await settle();
await page.waitForSelector("h2:has-text('Needs attention')", { timeout: 8000 });
await page.waitForTimeout(300);
await shot("alerts");

// 9. calendar tab
await page.click('.bottomnav button:has-text("Calendar")');
await settle();
await page.waitForSelector(".month__grid", { timeout: 8000 });
await page.waitForTimeout(300);
await shot("calendar");

// 10. profile tab, scrolled to Help & support / About
await page.click('.bottomnav button:has-text("Profile")');
await settle();
await page.locator("text=Help & support").scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(400);
await shot("profile");

if (errors.length) {
  console.error("  page errors:");
  for (const e of errors) console.error(`    ${e}`);
}

await browser.close();
srv.close();

if (errors.length) process.exit(1);
console.log("  done.");
