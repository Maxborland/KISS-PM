import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = process.cwd();
const repoRoot = join(webRoot, "../..");
const outDir = join(webRoot, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const startedAt = new Date().toISOString();
const result = spawnSync("pnpm", ["--filter", "@kiss-pm/web", "build"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: true,
  stdio: ["ignore", "pipe", "pipe"]
});

const audit = {
  batch: "15",
  date: "2026-05-24",
  command: "pnpm --filter @kiss-pm/web build",
  startedAt,
  finishedAt: new Date().toISOString(),
  exitCode: result.status ?? 1,
  pass: result.status === 0,
  stdoutTail: (result.stdout || "").slice(-4000),
  stderrTail: (result.stderr || "").slice(-4000)
};

writeFileSync(join(outDir, "batch15-build-evidence.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ pass: audit.pass, exitCode: audit.exitCode }, null, 2));
process.exit(audit.pass ? 0 : 1);
