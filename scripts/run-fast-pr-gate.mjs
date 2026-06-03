import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const routes =
  readOption("routes") ??
  "/dashboard,/my-work,/agent,/projects,/projects/project-beta-school-renovation,/deals";
const skipDb = args.includes("--skip-db");
const skipUnit = args.includes("--skip-unit");
const skipRouteSmoke = args.includes("--skip-route-smoke");

const steps = [
  ...(!skipDb
    ? [
        ["Check local Postgres", "node", ["scripts/check-runtime-qa-db.mjs"]],
        ["Apply migrations", "pnpm", ["db:migrate"]],
        ["Seed beta dataset", "pnpm", ["db:seed:dev"]],
        ["Verify beta seed", "pnpm", ["db:seed:check"]]
      ]
    : []),
  ["Typecheck", "pnpm", ["typecheck"]],
  ...(!skipUnit
    ? [
        ["API unit tests", "pnpm", ["--filter", "@kiss-pm/api", "test"]],
        ["Web unit tests", "pnpm", ["--filter", "@kiss-pm/web", "test"]]
      ]
    : []),
  ...(!skipRouteSmoke
    ? [
        [
          "Runtime route smoke",
          "pnpm",
          [
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.config.ts",
            "e2e/runtime/runtime-foundation.spec.ts",
            "--grep",
            "@fast-pr-gate"
          ],
          { KISS_PM_FAST_ROUTES: routes }
        ]
      ]
    : [])
];

for (const [label, command, commandArgs, extraEnv] of steps) {
  console.log(`[qa:fast] ${label}`);
  const result = run(command, commandArgs, extraEnv);
  if (result.status !== 0) {
    console.error(`[qa:fast] Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`[qa:fast] OK routes=${routes}`);

function readOption(name) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (inline) return inline;

  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function run(command, commandArgs, extraEnv = {}) {
  if (process.platform !== "win32") {
    return spawnSync(command, commandArgs, {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit"
    });
  }

  const result = spawnSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command, ...commandArgs],
    {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit"
    }
  );

  if (result.error) console.error(result.error);
  return result;
}
