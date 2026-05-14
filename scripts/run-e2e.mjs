import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const profiles = {
  smoke: { apiPort: "4183", webPort: "5183", args: ["e2e/tests/phase1"] },
  critical: { apiPort: "4184", webPort: "5184", args: ["e2e/tests/phase1"] },
  permissions: { apiPort: "4185", webPort: "5185", args: ["e2e/tests/phase1/auth-guard.spec.ts"] },
  all: { apiPort: "4186", webPort: "5186", args: [] }
};

const profileName = process.argv[2] ?? "all";
const extraArgs = process.argv.slice(3);
const profile = profiles[profileName];

if (!profile) {
  console.error(`Unknown E2E profile: ${profileName}`);
  console.error(`Known profiles: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
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
