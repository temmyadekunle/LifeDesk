/**
 * Reports the dominant colours in the logo so the palette can be derived from
 * the artwork rather than guessed at.
 *
 * The model cannot view images, so "match the colours to the logo" has to be
 * answered numerically. This buckets pixels by quantised RGB, drops the
 * near-white and near-black extremes that come from paper and ink rather than
 * brand, and ranks what is left by how much of the image it covers.
 *
 * Usage: node scripts/logo-colors.mjs [path] [--json]
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const target = resolve(args.find((a) => !a.startsWith("--")) ?? "public/logo.jpeg");

const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${target.replace(/'/g, "''")}')
$bmp = New-Object System.Drawing.Bitmap($img)
$buckets = @{}
$total = 0
$avgR = 0; $avgG = 0; $avgB = 0; $n = 0
for ($y = 0; $y -lt $bmp.Height; $y += 2) {
  for ($x = 0; $x -lt $bmp.Width; $x += 2) {
    $c = $bmp.GetPixel($x, $y)
    # Quantise to 5 bits per channel so anti-aliasing and JPEG ringing collapse
    # into the same bucket as the flat colour they came from.
    $r = [Math]::Floor($c.R / 8) * 8 + 4
    $g = [Math]::Floor($c.G / 8) * 8 + 4
    $b = [Math]::Floor($c.B / 8) * 8 + 4
    $k = "$r|$g|$b"
    if ($buckets.ContainsKey($k)) { $buckets[$k] = $buckets[$k] + 1 } else { $buckets[$k] = 1 }
    $total = $total + 1
    $avgR += $c.R; $avgG += $c.G; $avgB += $c.B; $n++
  }
}
$top = New-Object System.Collections.ArrayList
foreach ($k in $buckets.Keys) {
  $p = $k.Split('|')
  [void]$top.Add([pscustomobject]@{
    r = [int]$p[0]; g = [int]$p[1]; b = [int]$p[2]; count = [int]$buckets[$k]
  })
}
$c1 = $bmp.GetPixel(2, 2)
$c2 = $bmp.GetPixel($bmp.Width - 3, 2)
$c3 = $bmp.GetPixel(2, $bmp.Height - 3)
$c4 = $bmp.GetPixel($bmp.Width - 3, $bmp.Height - 3)
$result = [pscustomobject]@{
  width = $bmp.Width; height = $bmp.Height
  avg = @{ r = [int]($avgR / $n); g = [int]($avgG / $n); b = [int]($avgB / $n) }
  corners = @(
    @{ r = $c1.R; g = $c1.G; b = $c1.B },
    @{ r = $c2.R; g = $c2.G; b = $c2.B },
    @{ r = $c3.R; g = $c3.G; b = $c3.B },
    @{ r = $c4.R; g = $c4.G; b = $c4.B }
  )
  top = ($top | Sort-Object count -Descending | Select-Object -First 14)
}
$bmp.Dispose(); $img.Dispose()
$result | ConvertTo-Json -Depth 5
`;

const raw = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 8,
});

const json = JSON.parse(raw);

const hex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Perceived luminance, for deciding what reads as ink and what as paper. */
function luma({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function sat({ r, g, b }) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
}

/** Rough hue in degrees, so hues can be compared and sorted meaningfully. */
function hue({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  if (d === 0) return null;
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const sampledTotal = json.top.reduce((s, x) => s + x.count, 0);
const rows = json.top
  .map((c) => ({ ...c, pct: (100 * c.count) / sampledTotal }))
  .sort((a, b) => b.pct - a.pct);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        size: `${json.width}x${json.height}`,
        average: hex(json.avg),
        corners: json.corners.map(hex),
        colours: rows.map((r) => ({
          hex: hex(r),
          pct: Number(r.pct.toFixed(2)),
          luma: Number(luma(r).toFixed(3)),
          sat: Number(sat(r).toFixed(3)),
          hue: hue(r) === null ? null : Number(hue(r).toFixed(1)),
        })),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`size:    ${json.width}x${json.height}`);
  console.log(`average: ${hex(json.avg)}`);
  console.log(`corners: ${[...new Set(json.corners.map(hex))].join("  ")}`);
  console.log("");
  console.log("share%  hex       lum    sat    hue    classification");
  for (const row of rows) {
    const L = luma(row), S = sat(row), H = hue(row);
    const note =
      L > 0.93 ? "near-white: paper / background" :
      L < 0.12 ? "near-black: ink / text" :
      S < 0.15 ? "neutral grey" :
      `chromatic, hue ${H === null ? "-" : H.toFixed(0)}deg`;
    console.log(
      `${row.pct.toFixed(2).padStart(6)}  ${hex(row)}  ${L.toFixed(2)}  ${S.toFixed(2)}  ${(H === null ? "-" : H.toFixed(0)).padStart(4)}  ${note}`,
    );
  }
}