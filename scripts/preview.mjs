// Serves the static export in out/ exactly the way Netlify will, so you
// can check a production build locally before pushing. Dependency-free on
// purpose: nothing extra to install, and it works offline.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.argv[2] ?? process.env.PORT ?? 3101);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

if (!existsSync(root)) {
  console.error('No out/ directory. Run "npm run build" first.');
  process.exit(1);
}

const send = (res, file, status) => {
  res.writeHead(status, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
};

createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  // normalize collapses ../ before it can escape the out/ directory
  const target = join(root, normalize(decodeURIComponent(pathname)));

  if (!target.startsWith(root)) {
    return send(res, join(root, "404.html"), 403);
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    const index = join(target, "index.html");
    return existsSync(index)
      ? send(res, index, 200)
      : send(res, join(root, "404.html"), 404);
  }
  if (existsSync(target)) {
    return send(res, target, 200);
  }
  send(res, join(root, "404.html"), 404);
}).listen(port, () => {
  console.log(`Livanta static preview: http://localhost:${port}`);
});