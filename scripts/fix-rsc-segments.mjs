import { existsSync, readdirSync, renameSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const root = join(process.cwd(), "out");

if (!existsSync(root)) {
  console.error("fix-rsc-segments: out/ not found, run next build first.");
  process.exit(1);
}

let fixed = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith("__next.")) {
      flattenSegmentDir(full, entry.name);
    } else {
      walk(full);
    }
  }
}

function flattenSegmentDir(segmentDir, segmentName) {
  const files = [];
  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else files.push(full);
    }
  };
  collect(segmentDir);

  const parent = dirname(segmentDir);
  for (const file of files) {
    const rel = relative(segmentDir, file).split(sep).join(".");
    const dest = join(parent, `${segmentName}.${rel}`);
    if (existsSync(dest)) unlinkSync(dest);
    renameSync(file, dest);
    fixed += 1;
  }

  const removeEmpty = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) removeEmpty(join(dir, entry.name));
    }
    if (readdirSync(dir).length === 0) rmdirSync(dir);
  };
  removeEmpty(segmentDir);
}

walk(root);

console.log(
  fixed > 0
    ? `fix-rsc-segments: flattened ${fixed} segment file(s).`
    : "fix-rsc-segments: nothing to fix.",
);
