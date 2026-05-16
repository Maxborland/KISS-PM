import { createServer } from "node:http";
import { Readable } from "node:stream";

import { createApiApp } from "./app";

function readArg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const hostname = readArg("--host", "127.0.0.1");
const port = Number(readArg("--port", process.env.PORT ?? "4173"));
const app = createApiApp({
  allowTestFixtureReset: process.env.KISS_PM_ALLOW_TEST_FIXTURE_RESET === "true"
});

const bunRuntime = (globalThis as typeof globalThis & {
  Bun?: {
    serve(input: { fetch: typeof app.fetch; hostname: string; port: number }): unknown;
  };
}).Bun;

if (bunRuntime !== undefined) {
  bunRuntime.serve({
    fetch: app.fetch,
    hostname,
    port
  });
} else {
  createServer((nodeRequest, nodeResponse) => {
    const requestUrl = `http://${nodeRequest.headers.host ?? `${hostname}:${port}`}${nodeRequest.url ?? "/"}`;
    const requestInit: RequestInit & { duplex?: "half" } = {
      method: nodeRequest.method,
      headers: nodeRequest.headers as HeadersInit,
      ...(nodeRequest.method !== "GET" && nodeRequest.method !== "HEAD"
        ? {
            body: Readable.toWeb(nodeRequest) as unknown as ReadableStream<Uint8Array>,
            duplex: "half"
          }
        : {})
    };

    void Promise.resolve(app.fetch(new Request(requestUrl, requestInit))).then(
      async (response: Response) => {
        nodeResponse.statusCode = response.status;
        response.headers.forEach((value: string, key: string) => nodeResponse.setHeader(key, value));
        if (response.body === null) {
          nodeResponse.end();
          return;
        }
        nodeResponse.end(Buffer.from(await response.arrayBuffer()));
      },
      () => {
        nodeResponse.statusCode = 500;
        nodeResponse.end("Internal Server Error");
      }
    );
  }).listen(port, hostname);
}

console.log(`KISS PM API listening on http://${hostname}:${port}`);
