/* Temporary end-to-end check of the two things just changed.
   The responsive audit never gets past the welcome screen, so the profile screen
   and its photo picker have no automated coverage at all. This drives the real
   UI: walks onboarding, picks a real image through the real file input, and
   checks the picture is reduced, stored, survives a reload, and can be removed.

   Delete when done. */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { chromium } from "playwright";

const ROOT = resolve("out");
const PORT = 3212;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(ROOT, normalize(p).replace(/^([/\\])+/, ""));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
  createReadStream(f).pipe(res);
});
await new Promise((ok) => server.listen(PORT, ok));

/* A real 512x512 RGB PNG, built here rather than pasted in as base64 so the
   bytes are certainly a valid image and the decoder has to do actual work. */
function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y += 1) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const px = row + 1 + x * 3;
      raw[px] = (x * 255) / size;
      raw[px + 1] = (y * 255) / size;
      raw[px + 2] = 160;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG = makePng(512);

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 140)}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 140)}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });

/* The app boots from IndexedDB before onboarding mounts, so wait for the field
   rather than assuming the document being ready means the app is. */
await page.waitForSelector("input[placeholder]", { timeout: 20_000 });
await page.fill("input[placeholder]", "Ada");

// step 0 name -> step 1 categories -> step 2 first thing -> finish
await page.locator("button.btn--primary").last().click({ force: true });
await page.waitForSelector("button.tile", { timeout: 10_000 });

// Continue stays disabled until a category is picked, so choose some first.
await page.locator("button.tile").first().click({ force: true });
await page.locator("button.tile").nth(1).click({ force: true });
await page.locator("button.btn--primary").last().click({ force: true });

// The last step's button reads "Finish" and stays disabled until the first item
// has a name, so fill it in before clicking.
await page.waitForSelector('button:has-text("Finish")', { timeout: 10_000 });
await page.locator('input[placeholder="e.g. Rent"]').fill("Rent");
await page.locator('button:has-text("Finish")').click({ force: true });
await page.waitForTimeout(2500);
console.log("after Finish, body: " + (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160));
await page.waitForSelector(".hero__greet", { timeout: 20_000 });

const greeted = await page.locator(".hero__greet").first().textContent();
console.log(`greeting: ${JSON.stringify(greeted)}`);
if (!/Ada/.test(greeted ?? "")) problems.push(`greeting lost the name: ${greeted}`);
if (!/Good (morning|afternoon|evening)/.test(greeted ?? "")) {
  problems.push(`greeting is not a time-of-day greeting: ${greeted}`);
}

const openProfile = async () => {
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("button"));
    tabs.find((b) => /profile/i.test(b.getAttribute("aria-label") ?? ""))?.click();
  });
  await page.waitForSelector(".avatar-edit", { timeout: 10_000 });
};

await openProfile();
console.log(`avatar before: ${JSON.stringify(await page.locator(".avatar-edit .avatar--lg").first().textContent())}`);

const input = page.locator('.avatar-edit input[type="file"]');
if ((await input.count()) !== 1) problems.push(`expected one photo input, found ${await input.count()}`);
await input.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
await page.waitForSelector(".avatar-edit .avatar--lg img", { timeout: 15_000 });

const src = (await page.locator(".avatar-edit .avatar--lg img").first().getAttribute("src")) ?? "";
console.log(`stored: ${src.slice(0, 32)}... (${src.length} chars, source png ${PNG.length} bytes)`);
if (!src.startsWith("data:image/")) problems.push(`not an image data URL: ${src.slice(0, 32)}`);
if (src.length > 400_000) problems.push(`stored value ${src.length} chars, over the cap`);
if (src.length > PNG.length) problems.push("stored value is larger than the original file");

const natural = await page.evaluate(() => {
  const el = document.querySelector(".avatar-edit .avatar--lg img");
  return el ? { w: el.naturalWidth, h: el.naturalHeight } : null;
});
console.log(`decoded: ${JSON.stringify(natural)} (source was 512x512)`);
if (!natural || natural.w !== 256 || natural.h !== 256) {
  problems.push(`not reduced to a 256px square: ${JSON.stringify(natural)}`);
}

// setSettings runs before the IDB write finishes, so give the write a chance to
// land before reloading, then confirm it is really on disk rather than React state.
await page.waitForTimeout(1500);
const storedOnDisk = await page.evaluate(async () => {
  const db = await new Promise((ok, no) => {
    const req = indexedDB.open("lifedesk");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error);
  });
  const row = await new Promise((ok) => {
    const req = db.transaction("settings", "readonly").objectStore("settings").get("settings");
    req.onsuccess = () => ok(req.result);
  });
  return row?.value?.avatar?.length ?? 0;
});
console.log(`avatar chars on disk: ${storedOnDisk}`);
if (storedOnDisk < 1000) problems.push(`avatar was not written to IndexedDB (${storedOnDisk} chars)`);

// survives a reload, i.e. it reached IndexedDB and not just React state
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".hero__greet", { timeout: 20_000 });

// debug: what does the profile screen actually see for avatar?
const avatarOnReload = await page.evaluate(async () => {
  const el = document.querySelector(".avatar-edit .avatar--lg");
  return el?.textContent ?? "no avatar element";
});
console.log(`avatar text after reload: ${JSON.stringify(avatarOnReload)}`);

await openProfile();
const imgCount = await page.locator(".avatar-edit .avatar--lg img").count();
console.log(`img count after reload: ${imgCount}`);
if (imgCount !== 1) {
  problems.push("photo did not survive a reload");
} else {
  console.log("survived reload: yes");
}

const remove = page.locator("button", { hasText: /remove photo/i });
if ((await remove.count()) !== 1) {
  problems.push(`no remove control (${await remove.count()})`);
} else {
  await remove.click({ force: true });
  await page.waitForTimeout(800);
  if ((await page.locator(".avatar-edit .avatar--lg img").count()) !== 0) {
    problems.push("remove left the picture in place");
  } else {
    const back = await page.locator(".avatar-edit .avatar--lg").first().textContent();
    console.log(`after remove: ${JSON.stringify(back)}`);
    // initials("Ada") -> "A" (single word => first letter)
    if (!/A/.test(back ?? "")) problems.push(`initials did not come back: ${back}`);
  }
}

console.log(problems.length ? `\nFAIL (${problems.length})` : "\nPASS");
for (const p of problems) console.log(`  - ${p}`);

await browser.close();
server.close();
process.exit(problems.length ? 1 : 0);
