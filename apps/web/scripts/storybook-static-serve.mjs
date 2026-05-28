/**
 * Minimal static host for storybook-static — no clean-url redirects (unlike `serve -s`).
 * Required so `/iframe.html?id=…` keeps query params and `/index.json` resolves at root.
 */
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const staticRoot = join(webRoot, "storybook-static");
const port = Number(process.argv[2] ?? process.env.STORYBOOK_CONTRACT_PORT ?? 6006);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0] ?? "/");
  const relative = decoded === "/" ? "/index.html" : decoded;
  const normalized = normalize(relative).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(staticRoot, normalized);
  if (!filePath.startsWith(staticRoot)) return null;
  return filePath;
}

/** @type {import("node:net").Socket[]} */
const openSockets = [];

const server = createServer(async (req, res) => {
  const filePath = resolveFile(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

server.on("connection", (socket) => {
  openSockets.push(socket);
  socket.on("close", () => {
    const idx = openSockets.indexOf(socket);
    if (idx >= 0) openSockets.splice(idx, 1);
  });
});

function shutdown() {
  for (const socket of openSockets) {
    socket.destroy();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`storybook-static listening on http://127.0.0.1:${port}\n`);
});
