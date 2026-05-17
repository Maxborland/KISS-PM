import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.PW_API_PORT ?? "4183";
const webPort = process.env.PW_WEB_PORT ?? "5183";
const localNoProxy = "127.0.0.1,localhost";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: `npm run dev:api -- --host 127.0.0.1 --port ${apiPort}`,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      env: {
        KISS_PM_ALLOW_TEST_FIXTURE_RESET: "true",
        KISS_PM_EXTERNAL_SERVICES_MODE: "mocked",
        NO_PROXY: localNoProxy,
        no_proxy: localNoProxy
      },
      timeout: 120000
    },
    {
      command: `npm run dev:web -- --host 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      env: {
        PW_API_PORT: apiPort,
        VITE_KISS_PM_ALLOW_FIXTURE_AUTH: "true",
        NO_PROXY: localNoProxy,
        no_proxy: localNoProxy
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
