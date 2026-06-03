import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultFastPrGateRoutes } from "./beta-runtime-routes.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const routes = normalizeRoutes(readOption("routes") ?? defaultFastPrGateRoutes);

console.log(`[qa:screenshots] Capturing runtime screenshots for routes=${routes}`);

const result = run("pnpm", [
  "exec",
  "playwright",
  "test",
  "--config",
  "playwright.config.ts",
  "e2e/runtime/runtime-foundation.spec.ts",
  "--grep",
  "authenticated beta runtime routes open"
]);

if (result.status === 0) {
  console.log("[qa:screenshots] OK. Screenshots are in Playwright test-results.");
} else {
  console.error("[qa:screenshots] Failed.");
}

process.exit(result.status ?? 1);

function readOption(name) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (inline) return inline;

  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function normalizeRoutes(value) {
  return value
    .split(/[\s,]+/)
    .map((route) => route.trim())
    .filter(Boolean)
    .join(",");
}

function run(command, commandArgs) {
  const env = { ...process.env, KISS_PM_FAST_ROUTES: routes };

  if (process.platform !== "win32") {
    return spawnSync(command, commandArgs, {
      cwd: repoRoot,
      env,
      stdio: "inherit"
    });
  }

  const result = spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...commandArgs], {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });

  if (result.error) console.error(result.error);
  return result;
}
