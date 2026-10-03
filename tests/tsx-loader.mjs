// Lets the Node test runner import React components directly.
//
// Node strips TypeScript types natively but does not compile JSX, and it
// cannot resolve the "@/" path alias. This loader handles both, using the
// TypeScript compiler that is already a dev dependency, so component tests
// need no new packages and no bundler.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);

const resolveFile = (relPath) => {
  const base = new URL(relPath, root);
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = new URL(base.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return null;
};

export async function resolve(specifier, context, next) {
  if (specifier === "next/image") {
    const stub = resolveFile("tests/stubs/next-image");
    if (!stub) throw new Error("Missing tests/stubs/next-image.tsx");
    return next(stub, context);
  }
  if (specifier.startsWith("@/")) {
    const found = resolveFile(specifier.slice(2));
    if (!found) {
      throw new Error(`Cannot resolve "${specifier}" from ${context.parentURL}`);
    }
    return next(found, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!url.endsWith(".tsx")) return next(url, context);

  const filename = fileURLToPath(url);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  return { format: "module", source: outputText, shortCircuit: true };
}