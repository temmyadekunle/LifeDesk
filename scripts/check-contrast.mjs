/**
 * Checks the brand palette against WCAG 2.1 contrast minimums.
 *
 * A retheme is where contrast quietly regresses: a mid-tone that looked fine as
 * a large graphic becomes unreadable the moment it is used for 13px text. Every
 * pair that ships in globals.css is asserted here so that failure is a test
 * failure rather than something found on a phone in sunlight.
 *
 *   node scripts/check-contrast.mjs
 *
 * Minimums: 4.5:1 body text, 3:1 large text (>=24px, or >=18.66px bold) and
 * non-text UI such as icon strokes, focus rings and control borders.
 */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

const palette = {
  "brand-900": "#042454",
  "brand-800": "#082b56",
  "brand-700": "#0c2c54",
  "brand-600": "#143464",
  "brand-500": "#2b5488",
  "brand-100": "#dbe4f1",
  "brand-50": "#eef2f9",
  "accent-700": "#0a736c",
  "accent-600": "#0c948c",
  "accent-500": "#14a494",
  "accent-400": "#1cac9c",
  "accent-100": "#d3efec",
  "accent-50": "#e9f7f5",
  "ink-900": "#06182f",
  "ink-800": "#102544",
  "ink-700": "#24385c",
  "ink-500": "#4a5b7a",
  "ink-400": "#64748b",
  bg: "#f7f8fb",
  surface: "#ffffff",
  "surface-2": "#fafbfd",
  line: "#e4e9f2",
  "line-strong": "#d2dbeb",
  danger: "#cf3f3f",
  warn: "#8a5e08",
  ok: "#0a736c",
  info: "#143464",
};

/** [foreground, background, minimum, what it is used for] */
const pairs = [
  ["ink-900", "surface", AA_TEXT, "primary body text"],
  ["ink-800", "surface", AA_TEXT, "headings"],
  ["ink-700", "surface", AA_TEXT, "secondary text"],
  ["ink-500", "surface", AA_TEXT, "muted text"],
  ["ink-400", "surface", AA_LARGE, "decorative / placeholder only"],
  ["ink-900", "bg", AA_TEXT, "body text on page background"],
  ["ink-700", "surface-2", AA_TEXT, "secondary text on raised surface"],
  ["brand-700", "surface", AA_TEXT, "links, active nav, soft buttons"],
  ["brand-700", "brand-50", AA_TEXT, "text on brand tint"],
  ["brand-700", "brand-100", AA_TEXT, "text on stronger brand tint"],
  ["brand-600", "brand-50", AA_TEXT, "primary button label on tint"],
  ["surface", "brand-600", AA_TEXT, "primary button label on navy fill"],
  ["surface", "brand-700", AA_TEXT, "label on deepest navy fill"],
  ["surface", "accent-700", AA_TEXT, "white text on accessible teal fill"],
  ["accent-700", "surface", AA_TEXT, "teal text on white"],
  ["accent-700", "accent-50", AA_TEXT, "teal text on teal tint"],
  ["danger", "surface", AA_TEXT, "danger text"],
  ["warn", "surface", AA_TEXT, "warning text"],
  ["ok", "surface", AA_TEXT, "success text"],
  ["info", "surface", AA_TEXT, "info text"],
  ["line-strong", "surface", 1.35, "control border vs surface"],
  ["brand-600", "surface", AA_LARGE, "focus ring"],
  ["accent-600", "surface", AA_LARGE, "teal icon or meter fill"],
];

function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(a, b) {
  const la = luminance(rgb(a));
  const lb = luminance(rgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

let failed = 0;
const lines = [];

for (const [fgName, bgName, min, use] of pairs) {
  const fg = palette[fgName];
  const bg = palette[bgName];
  if (!fg || !bg) {
    lines.push(`  MISSING TOKEN  ${fgName} / ${bgName} (${use})`);
    failed++;
    continue;
  }
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed++;
  lines.push(
    `  ${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1  (min ${min})  ` +
      `${fgName} on ${bgName} - ${use}`,
  );
}

console.log(lines.join("\n"));
console.log("");
console.log(`${pairs.length - failed}/${pairs.length} contrast pairs pass`);

if (failed > 0) {
  console.error(`\n${failed} pair(s) below the WCAG minimum.`);
  process.exitCode = 1;
}