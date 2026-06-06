import { defineConfig, devices } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";
const apiPort = process.env.E2E_API_PORT ?? "4100";
const webPort = process.env.E2E_WEB_PORT ?? "3100";
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: `powershell -NoProfile -Command "$env:DATABASE_URL='${databaseUrl}'; $env:PORT='${apiPort}'; $env:KISS_PM_E2E_TEST_HOOKS='1'; pnpm --dir '${configDir}' --filter @kiss-pm/api dev"`,
      cwd: configDir,
      url: `${apiOrigin}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: `powershell -NoProfile -Command "$env:KISS_PM_API_ORIGIN='${apiOrigin}'; pnpm --dir '${configDir}' --filter @kiss-pm/web exec next dev -H 127.0.0.1 -p ${webPort}"`,
      cwd: configDir,
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
