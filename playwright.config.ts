import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5183",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "npm run dev:api -- --host 127.0.0.1 --port 4183",
      url: "http://127.0.0.1:4183/health",
      reuseExistingServer: false,
      timeout: 120000
    },
    {
      command: "npm run dev:web -- --host 127.0.0.1 --port 5183",
      url: "http://127.0.0.1:5183",
      reuseExistingServer: false,
      env: {
        VITE_KISS_PM_ALLOW_FIXTURE_AUTH: "true"
      },
      timeout: 120000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
