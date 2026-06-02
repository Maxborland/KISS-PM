import { Socket } from "node:net";

const defaultDatabaseUrl = "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;
const timeoutMs = Number.parseInt(process.env.KISS_PM_RUNTIME_QA_DB_TIMEOUT_MS ?? "2500", 10);

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.error(
    `[runtime-qa] DATABASE_URL is not a valid URL. Received: ${JSON.stringify(databaseUrl)}`
  );
  process.exit(1);
}

const host = parsed.hostname;
const port = Number.parseInt(parsed.port || "5432", 10);

if (!host || Number.isNaN(port)) {
  console.error(`[runtime-qa] DATABASE_URL must include a host and valid port: ${databaseUrl}`);
  process.exit(1);
}

const socket = new Socket();

const fail = (message) => {
  socket.destroy();
  console.error(`[runtime-qa] Postgres is not reachable at ${host}:${port}.`);
  console.error(`[runtime-qa] ${message}`);
  console.error("[runtime-qa] Start the database first, for example: pnpm db:up");
  console.error("[runtime-qa] Then rerun: pnpm qa:runtime");
  process.exit(1);
};

socket.setTimeout(timeoutMs);
socket.once("connect", () => {
  socket.end();
});
socket.once("close", (hadError) => {
  if (!hadError) process.exit(0);
});
socket.once("timeout", () => {
  fail(`Connection timed out after ${timeoutMs}ms.`);
});
socket.once("error", (error) => {
  fail(error.message);
});

socket.connect(port, host);
