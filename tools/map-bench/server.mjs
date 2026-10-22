// Dev tool: static server for the 3D map benchmark (see README.md in this folder).
// Serves the bench page, the project's node_modules (MapLibre) under /nm and public/data under /data.
// Listens on all interfaces so a phone on the same Wi-Fi can open it.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "../..");
const roots = [
  ["/nm/", path.join(project, "node_modules")],
  ["/data/", path.join(project, "public/data")],
  ["/", here],
];
const types = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};
const port = Number(process.env.PORT ?? 4020);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file = null;
  for (const [prefix, dir] of roots) {
    if (!url.pathname.startsWith(prefix)) continue;
    const rel =
      url.pathname === "/"
        ? "index.html"
        : decodeURIComponent(url.pathname.slice(prefix.length));
    const candidate = path.resolve(dir, rel);
    // Never serve anything outside the allowed folders.
    if (
      candidate.startsWith(path.resolve(dir) + path.sep) ||
      candidate === path.resolve(dir, "index.html")
    ) {
      try {
        if (statSync(candidate).isFile()) file = candidate;
      } catch {
        // not found
      }
    }
    break;
  }
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "content-type": types[path.extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () =>
  console.log(
    `map bench on http://localhost:${port}/ (add ?overlay=1 to run it by hand)`,
  ),
);
