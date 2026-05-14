import { createApiApp } from "./app";

function readArg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const hostname = readArg("--host", "127.0.0.1");
const port = Number(readArg("--port", process.env.PORT ?? "4173"));
const app = createApiApp();

Bun.serve({
  fetch: app.fetch,
  hostname,
  port
});

console.log(`KISS PM API listening on http://${hostname}:${port}`);

