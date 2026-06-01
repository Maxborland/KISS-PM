import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const playwrightArgs = [
  "exec",
  "playwright",
  "test",
  "--config",
  "playwright.config.ts",
  "e2e/runtime"
];
const pnpmCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const pnpmArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", "pnpm", ...playwrightArgs]
  : playwrightArgs;

const result = spawnSync(
  pnpmCommand,
  pnpmArgs,
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      KISS_PM_STORYBOOK_QA: "1",
      STORYBOOK_PORT: process.env.STORYBOOK_PORT ?? "6006"
    },
    stdio: "inherit"
  }
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
