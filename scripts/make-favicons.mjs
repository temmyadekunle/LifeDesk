/**
 * Generates the favicon set from the source artwork in public/.
 *
 * Browsers ask for square icons. The source has been a 3:2 landscape photo, so
 * a plain centre-crop to a square would throw away most of the mark and leave
 * an unreadable smudge in the tab. This pads to a square on the app background
 * colour instead, which keeps the whole logo visible at 16px and still looks
 * deliberate at 180px.
 *
 * Run after replacing public/logo.jpeg:  node scripts/make-favicons.mjs
 *
 * Uses ImageMagick when it is on PATH, and otherwise falls back to System.Drawing
 * through PowerShell, which is always present on Windows. If neither is
 * available the script exits non-zero rather than leaving broken icon links in
 * the document head.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const source = resolve(publicDir, "logo.jpeg");

if (!existsSync(source)) {
  console.error(`No ${source}. Nothing to do.`);
  process.exit(1);
}

/** Intrinsic size, read from the JPEG SOF marker so it stays correct if the
 *  artwork is replaced with one of a different size. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("Could not read JPEG dimensions.");
}

const { width, height } = jpegSize(readFileSync(source));
console.log(`source: ${width}x${height}`);

const BG = "#f4f6fa";
const targets = [
  { name: "icon-32.png", size: 32 },
  { name: "icon-192.png", size: 192 },
  { name: "apple-touch-icon.png", size: 180 },
];

function hasMagick() {
  try {
    execFileSync("magick", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runMagick() {
  const square = width === height;
  for (const { name, size } of targets) {
    const args = square
      ? [source, "-resize", `${size}x${size}`, "-strip", resolve(publicDir, name)]
      : [
          source,
          "-background", BG,
          "-gravity", "center",
          "-extent", `${size}x${size}`,
          "-resize", `${size}x${size}`,
          "-strip",
          resolve(publicDir, name),
        ];
    execFileSync("magick", args);
    console.log(`wrote public/${name}`);
  }
}

/**
 * System.Drawing resamples in one step. A square source fills the canvas
 * edge to edge, because any inset would just make the mark smaller than it
 * needs to be at 32px. A non-square source is fitted inside a small margin,
 * since a wide wordmark stretched to a square would distort.
 */
function runSystemDrawing() {
  const square = width === height;
  const escaped = (p) => p.replace(/'/g, "''");
  const jobs = targets
    .map(({ name, size }) => {
      const out = resolve(publicDir, name);
      const pad = square ? 0 : Math.round(size * 0.06);
      const inner = size - 2 * pad;
      return `
        $bmp = New-Object System.Drawing.Bitmap(${size}, ${size})
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.Clear([System.Drawing.ColorTranslator]::FromHtml('${BG}'))
        $scale = [Math]::Min(${inner} / $img.Width, ${inner} / $img.Height)
        $w = [int]($img.Width * $scale)
        $h = [int]($img.Height * $scale)
        $x = [int]((${size} - $w) / 2)
        $y = [int]((${size} - $h) / 2)
        $g.DrawImage($img, $x, $y, $w, $h)
        $bmp.Save('${escaped(out)}', [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $bmp.Dispose()
        Write-Output 'wrote ${name}'`;
    })
    .join("\n");

  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${escaped(source)}')
${jobs}
$img.Dispose()
`;
  const out = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { encoding: "utf8" },
  );
  process.stdout.write(out);
}

let ok = false;
if (hasMagick()) {
  console.log("using ImageMagick");
  runMagick();
  ok = true;
} else if (process.platform === "win32") {
  console.log("ImageMagick not on PATH, using System.Drawing");
  runSystemDrawing();
  ok = true;
}

if (!ok) {
  console.error(
    "No image backend available. Install ImageMagick (winget install " +
      "ImageMagick.ImageMagick) and re-run.",
  );
  process.exit(1);
}

// Next.js emits a link for every declared icon, so a stale file from an earlier
// run would otherwise be served instead of the regenerated one.
for (const { name } of targets) {
  const p = resolve(publicDir, name);
  if (!existsSync(p)) {
    console.error(`Expected public/${name} to exist but it does not.`);
    process.exit(1);
  }
}

console.log("done");