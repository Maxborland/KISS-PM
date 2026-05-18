import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
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
      command: `powershell -NoProfile -Command "$env:DATABASE_URL='${databaseUrl}'; $env:PORT='4173'; pnpm --filter @kiss-pm/api dev"`,
      url: "http://127.0.0.1:4173/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: "pnpm --filter @kiss-pm/web dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
