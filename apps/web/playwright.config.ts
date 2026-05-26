import { defineConfig, devices } from "@playwright/test";

const port = process.env.STORYBOOK_CONTRACT_PORT ?? "6006";
const baseURL = `http://127.0.0.1:${port}`;
const useStaticStorybook = process.env.STORYBOOK_STATIC === "1";
const skipWebServer = process.env.STORYBOOK_CONTRACT_SKIP_SERVE === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/storybook-vrt-baselines/{arg}{ext}",
  use: {
    baseURL,
    trace: "on-first-retry",
    viewport: { width: 1440, height: 900 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow"
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02
    }
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : useStaticStorybook
      ? {
          command: `pnpm exec serve storybook-static -s -l ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000
        }
      : {
          command: "pnpm storybook -- --ci --quiet",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000
        }
});
