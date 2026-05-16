import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const profiles = {
  smoke: { apiPort: "4183", webPort: "5183", args: ["e2e/tests/phase1"] },
  critical: { apiPort: "4184", webPort: "5184", args: ["e2e/tests/phase1"] },
  permissions: { apiPort: "4185", webPort: "5185", args: ["e2e/tests/phase1/auth-guard.spec.ts"] },
  phase: { apiPort: "4287", webPort: "5287", args: [], workers: "1" },
  all: { apiPort: "4186", webPort: "5186", args: [], workers: "1" }
};

const profileName = process.argv[2] ?? "all";
const profile = profiles[profileName];
let extraArgs = process.argv.slice(3);
let selectedPhaseNumber = null;
const localNoProxy = "127.0.0.1,localhost";

if (!profile) {
  console.error(`Unknown E2E profile: ${profileName}`);
  console.error(`Known profiles: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
}

profile.apiPort = process.env.PW_API_PORT ?? profile.apiPort;
profile.webPort = process.env.PW_WEB_PORT ?? profile.webPort;

if (profileName === "phase") {
  const explicitPhaseArgIndex = extraArgs.findIndex((arg) => arg === "--phase");
  const explicitPhaseEqualsArg = extraArgs.find((arg) => arg.startsWith("--phase="));
  let phaseNumber = "1";

  if (explicitPhaseEqualsArg) {
    phaseNumber = explicitPhaseEqualsArg.slice("--phase=".length);
  } else if (explicitPhaseArgIndex >= 0) {
    phaseNumber = extraArgs[explicitPhaseArgIndex + 1];
    if (!phaseNumber) {
      console.error("Missing value for --phase");
      process.exit(2);
    }
  }

  if (!/^\d+$/.test(phaseNumber)) {
    console.error(`Invalid --phase value: ${phaseNumber}`);
    process.exit(2);
  }

  extraArgs = extraArgs.filter((arg, index) => {
    if (arg.startsWith("--phase=")) return false;
    if (index === explicitPhaseArgIndex) return false;
    if (explicitPhaseArgIndex >= 0 && index === explicitPhaseArgIndex + 1) return false;
    return true;
  });

  profile.args = [`e2e/tests/phase${phaseNumber}`];
  selectedPhaseNumber = phaseNumber;
}

const startedAt = new Date();
const playwrightArgs = [
  resolve(rootDir, "node_modules/@playwright/test/cli.js"),
  "test",
  ...(profile.workers ? [`--workers=${profile.workers}`] : []),
  ...profile.args,
  ...extraArgs
];
const result = spawnSync(
  process.execPath,
  playwrightArgs,
  {
    env: {
      ...process.env,
      NO_PROXY: localNoProxy,
      no_proxy: localNoProxy,
      PW_API_PORT: profile.apiPort,
      PW_WEB_PORT: profile.webPort
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    cwd: rootDir
  }
);

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

if (result.error) {
  console.error(result.error);
}

function extractPassedTests(output) {
  const passed = [];
  for (const line of stripVTControlCharacters(output).split(/\r?\n/)) {
    const match = line.match(/(?:\bok|✓)\s+\d+\s+.*?›\s+(e2e[\\/].+?\.spec\.ts):\d+:\d+\s+›\s+(E2E-\d+)/);
    if (!match) continue;

    passed.push({
      testPath: match[1].replaceAll("\\", "/"),
      e2eId: match[2]
    });
  }
  return passed;
}

const passedTests = extractPassedTests(stdout);
const metadataPath = resolve(rootDir, process.env.KISS_PM_E2E_RUN_METADATA_PATH ?? "test-results/kiss-pm-e2e-last-run.json");
mkdirSync(dirname(metadataPath), { recursive: true });
writeFileSync(
  metadataPath,
  JSON.stringify(
    {
      profile: profileName,
      phase: selectedPhaseNumber,
      status: result.status === 0 ? "passed" : "failed",
      exitCode: result.status ?? 1,
      command: [process.execPath, ...playwrightArgs],
      args: playwrightArgs.slice(1),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      testPaths: [...new Set(passedTests.map((test) => test.testPath))],
      e2eIds: [...new Set(passedTests.map((test) => test.e2eId))]
    },
    null,
    2
  )
);

process.exit(result.status ?? 1);
