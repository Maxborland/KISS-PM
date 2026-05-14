import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const profiles = {
  smoke: { apiPort: "4183", webPort: "5183", args: ["e2e/tests/phase1"] },
  critical: { apiPort: "4184", webPort: "5184", args: ["e2e/tests/phase1"] },
  permissions: { apiPort: "4185", webPort: "5185", args: ["e2e/tests/phase1/auth-guard.spec.ts"] },
  phase: { apiPort: "4187", webPort: "5187", args: [] },
  all: { apiPort: "4186", webPort: "5186", args: [] }
};

const profileName = process.argv[2] ?? "all";
const profile = profiles[profileName];
let extraArgs = process.argv.slice(3);

if (!profile) {
  console.error(`Unknown E2E profile: ${profileName}`);
  console.error(`Known profiles: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
}

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
}

const result = spawnSync(
  process.execPath,
  [resolve(rootDir, "node_modules/@playwright/test/cli.js"), "test", ...profile.args, ...extraArgs],
  {
    env: {
      ...process.env,
      PW_API_PORT: profile.apiPort,
      PW_WEB_PORT: profile.webPort
    },
    stdio: "inherit",
    cwd: rootDir
  }
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
