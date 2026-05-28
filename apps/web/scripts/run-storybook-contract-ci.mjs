/**
 * Phase 9 — CI gate: vitest, Storybook build, Next build, copy scan, VRT, axe.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = process.cwd();
const repoRoot = join(webRoot, "../..");
const playwrightCli = join(webRoot, "node_modules/@playwright/test/cli.js");

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

function killProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already exited */
    }
  }
}

function stopChildProcess(child) {
  return new Promise((resolve) => {
    if (!child?.pid) {
      resolve();
      return;
    }
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 4000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    killProcessTree(child);
  });
}

function mergeEnv(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.STORYBOOK_VRT_ONLY;
  return env;
}

function runStep(name, command, args, cwd = webRoot, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: mergeEnv(extraEnv)
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

function runPnpmStep(name, pnpmArgs, cwd = webRoot, extraEnv = {}) {
  const pnpmJs = process.env.npm_execpath;
  if (pnpmJs) {
    return runStep(name, process.execPath, [pnpmJs, ...pnpmArgs], cwd, extraEnv);
  }
  const result = spawnSync("pnpm", pnpmArgs, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: mergeEnv(extraEnv)
  });
  const exitCode = result.status ?? 1;
  return {
    name,
    command: ["pnpm", ...pnpmArgs].join(" "),
    exitCode,
    pass: exitCode === 0,
    stderrTail: (result.stderr || "").slice(-2000),
    stdoutTail: (result.stdout || "").slice(-2000)
  };
}

function runPlaywrightStep(name, playwrightArgs, extraEnv = {}) {
  return runStep(
    name,
    process.execPath,
    [playwrightCli, ...playwrightArgs],
    webRoot,
    {
      ...extraEnv,
      PLAYWRIGHT_HTML_OPEN: "never"
    }
  );
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
  return spawn(
    process.execPath,
    [join(webRoot, "scripts/storybook-static-serve.mjs"), String(listenPort)],
    {
      cwd: webRoot,
      shell: false,
      stdio: "ignore",
      windowsHide: true
    }
  );
}

function writeEvidence(audit) {
  audit.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, "phase9-ci-evidence.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
}

function writeBuildEvidence() {
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

const port = process.env.STORYBOOK_CONTRACT_PORT
  ? Number(process.env.STORYBOOK_CONTRACT_PORT)
  : await getFreePort();

const outDir = join(webRoot, ".storybook-verify-tmp");
const phase9EvidencePath = join(outDir, "phase9-ci-evidence.json");
const harnessTargetsPath = join(outDir, "storybook-vrt-targets.json");

mkdirSync(outDir, { recursive: true });
if (existsSync(phase9EvidencePath)) unlinkSync(phase9EvidencePath);
if (existsSync(harnessTargetsPath)) unlinkSync(harnessTargetsPath);

const startedAt = new Date().toISOString();
const steps = [];
/** @type {import("node:child_process").ChildProcess | null} */
let staticServer = null;
let exitCode = 1;

class ContractGateStop extends Error {}

function failAndStop() {
  writeEvidence({ startedAt, steps, pass: false, port });
  throw new ContractGateStop();
}

try {
  steps.push(runPnpmStep("web-typecheck", ["typecheck"], webRoot));
  if (!steps.at(-1).pass) {
    failAndStop();
  }

  steps.push(runPnpmStep("build-storybook", ["build-storybook"], webRoot));
  if (!steps.at(-1).pass) {
    failAndStop();
  }

  steps.push(runPnpmStep("web-build", ["--filter", "@kiss-pm/web", "build"], repoRoot));
  if (!steps.at(-1).pass) {
    failAndStop();
  }
  writeBuildEvidence();

  steps.push(runPnpmStep("web-test", ["test"], webRoot));
  if (!steps.at(-1).pass) {
    failAndStop();
  }

  staticServer = startStaticServe(port);
  const httpReady = await waitForHttpRoot(port);
  if (!httpReady) {
    steps.push({
      name: "static-serve-ready",
      command: `node scripts/storybook-static-serve.mjs ${port}`,
      exitCode: 1,
      pass: false
    });
    failAndStop();
  }

  function storybookContractEnv(extra = {}) {
    return {
      STORYBOOK_STATIC: "1",
      STORYBOOK_CONTRACT_SKIP_SERVE: "1",
      STORYBOOK_CONTRACT_PORT: String(port),
      STORYBOOK_VRT_TARGETS_PATH: harnessTargetsPath,
      CI: process.env.CI ?? "1",
      ...extra
    };
  }

  const playwrightEnv = storybookContractEnv();

  const copyResult = spawnSync(
    process.execPath,
    [join(webRoot, "scripts/run-copy-scan-all-stories.mjs")],
    {
      cwd: webRoot,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      env: mergeEnv(storybookContractEnv()),
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  steps.push({
    name: "copy-scan-all-stories",
    command: "node scripts/run-copy-scan-all-stories.mjs",
    exitCode: copyResult.status ?? 1,
    pass: copyResult.status === 0,
    stderrTail: (copyResult.stderr || "").slice(-2000),
    stdoutTail: (copyResult.stdout || "").slice(-2000)
  });

  steps.push(
    runPlaywrightStep(
      "storybook-vrt-harness",
      ["test", "tests/e2e/storybook-vrt-harness.spec.ts", "--reporter=list"],
      playwrightEnv
    )
  );

  steps.push(
    runPlaywrightStep(
      "storybook-vrt",
      ["test", "--grep", "@vrt", "--reporter=list"],
      playwrightEnv
    )
  );

  steps.push(
    runPlaywrightStep(
      "storybook-a11y",
      ["test", "--grep", "@a11y", "--reporter=list"],
      playwrightEnv
    )
  );

  const harnessStep = steps.find((s) => s.name === "storybook-vrt-harness");
  const harnessTargetsOk =
    harnessStep?.pass === true &&
    existsSync(harnessTargetsPath) &&
    JSON.parse(readFileSync(harnessTargetsPath, "utf8")).pass === true;
  steps.push({
    name: "storybook-vrt-targets-artifact",
    command: `read ${harnessTargetsPath}`,
    exitCode: harnessTargetsOk ? 0 : 1,
    pass: harnessTargetsOk
  });

  const pass = steps.every((s) => s.pass);
  writeEvidence({ startedAt, steps, pass, port });
  console.log(
    JSON.stringify(
      { phase: 9, pass, steps: steps.map((s) => ({ name: s.name, pass: s.pass })) },
      null,
      2
    )
  );
  exitCode = pass ? 0 : 1;
} catch (err) {
  if (!(err instanceof ContractGateStop)) {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    steps.push({
      name: "storybook-contract-runner",
      command: "node scripts/run-storybook-contract-ci.mjs",
      exitCode: 1,
      pass: false,
      stderrTail: message.slice(-2000)
    });
    writeEvidence({ startedAt, steps, pass: false, port });
    console.error(message);
  }
} finally {
  if (staticServer) {
    await stopChildProcess(staticServer);
  }
}

process.exitCode = exitCode;
