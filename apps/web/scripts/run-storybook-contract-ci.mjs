/**
 * Phase 9 — CI gate: vitest, Storybook build, Next build, copy scan, VRT, axe.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = process.cwd();
const repoRoot = join(webRoot, "../..");
const staticRoot = join(webRoot, "storybook-static");
const outDir = join(webRoot, ".storybook-verify-tmp");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const addr = probe.address();
      const free = typeof addr === "object" && addr ? addr.port : 0;
      probe.close((err) => (err ? reject(err) : resolve(free)));
    });
    probe.on("error", reject);
  });
}

const port = process.env.STORYBOOK_CONTRACT_PORT
  ? Number(process.env.STORYBOOK_CONTRACT_PORT)
  : await getFreePort();

function runStep(name, command, args, cwd = webRoot, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...extraEnv }
  });
  const exitCode = result.status ?? 1;
  return {
    name,
    command: [command, ...args].join(" "),
    exitCode,
    pass: exitCode === 0,
    stderrTail: (result.stderr || "").slice(-2000),
    stdoutTail: (result.stdout || "").slice(-2000)
  };
}

async function waitForHttpRoot(listenPort) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${listenPort}/`);
      if (res.ok) return true;
    } catch {
      /* serve ещё не слушает */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function startStaticServe(listenPort) {
  return spawn("pnpm", ["exec", "serve", staticRoot, "-s", "-l", String(listenPort)], {
    cwd: webRoot,
    shell: true,
    stdio: "ignore"
  });
}

mkdirSync(outDir, { recursive: true });
const phase9EvidencePath = join(outDir, "phase9-ci-evidence.json");
if (existsSync(phase9EvidencePath)) {
  unlinkSync(phase9EvidencePath);
}
const startedAt = new Date().toISOString();
const steps = [];

steps.push(runStep("web-typecheck", "pnpm", ["typecheck"], webRoot));
if (!steps.at(-1).pass) {
  writeEvidence({ startedAt, steps, pass: false, port });
  process.exit(1);
}

steps.push(runStep("web-test", "pnpm", ["test"], webRoot));
if (!steps.at(-1).pass) {
  writeEvidence({ startedAt, steps, pass: false, port });
  process.exit(1);
}

steps.push(runStep("build-storybook", "pnpm", ["build-storybook"], webRoot));
if (!steps.at(-1).pass) {
  writeEvidence({ startedAt, steps, pass: false, port });
  process.exit(1);
}

steps.push(runStep("web-build", "pnpm", ["--filter", "@kiss-pm/web", "build"], repoRoot));
if (!steps.at(-1).pass) {
  writeEvidence({ startedAt, steps, pass: false, port });
  process.exit(1);
}

const server = startStaticServe(port);
const httpReady = await waitForHttpRoot(port);
if (!httpReady) {
  server.kill("SIGTERM");
  steps.push({
    name: "static-serve-ready",
    command: `serve storybook-static -s -l ${port}`,
    exitCode: 1,
    pass: false
  });
  writeEvidence({ startedAt, steps, pass: false, port });
  process.exit(1);
}

function storybookContractEnv(extra = {}) {
  const env = {
    ...process.env,
    STORYBOOK_STATIC: "1",
    STORYBOOK_CONTRACT_SKIP_SERVE: "1",
    STORYBOOK_CONTRACT_PORT: String(port),
    CI: process.env.CI ?? "1",
    ...extra
  };
  delete env.STORYBOOK_VRT_ONLY;
  return env;
}

const playwrightEnv = storybookContractEnv();

const copyResult = spawnSync("node", ["scripts/run-copy-scan-all-stories.mjs"], {
  cwd: webRoot,
  encoding: "utf8",
  shell: true,
  env: storybookContractEnv(),
  stdio: ["ignore", "pipe", "pipe"]
});
steps.push({
  name: "copy-scan-all-stories",
  command: "node scripts/run-copy-scan-all-stories.mjs",
  exitCode: copyResult.status ?? 1,
  pass: copyResult.status === 0,
  stderrTail: (copyResult.stderr || "").slice(-2000),
  stdoutTail: (copyResult.stdout || "").slice(-2000)
});

steps.push(
  runStep(
    "storybook-vrt",
    "pnpm",
    ["exec", "playwright", "test", "--grep", "@vrt"],
    webRoot,
    playwrightEnv
  )
);

steps.push(
  runStep(
    "storybook-a11y",
    "pnpm",
    ["exec", "playwright", "test", "--grep", "@a11y"],
    webRoot,
    playwrightEnv
  )
);

server.kill("SIGTERM");

const webBuild = steps.find((s) => s.name === "web-build");
if (webBuild?.pass) {
  writeFileSync(
    join(outDir, "batch15-build-evidence.json"),
    `${JSON.stringify(
      {
        batch: "15",
        date: "2026-05-26",
        command: "pnpm --filter @kiss-pm/web build",
        pass: true,
        exitCode: 0,
        via: "phase9-ci"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

const pass = steps.every((s) => s.pass);
writeEvidence({ startedAt, steps, pass, port });
console.log(
  JSON.stringify(
    { phase: 9, pass, steps: steps.map((s) => ({ name: s.name, pass: s.pass })) },
    null,
    2
  )
);
process.exit(pass ? 0 : 1);

function writeEvidence(audit) {
  audit.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, "phase9-ci-evidence.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
}
