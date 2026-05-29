import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const storybookGateArgv = process.argv.some(
  (arg) => arg.includes("@vrt") || arg.includes("@a11y") || arg.includes("@harness")
);
const staticStorybookExists = existsSync(join(process.cwd(), "storybook-static/index.json"));
if (
  storybookGateArgv &&
  process.env.STORYBOOK_STATIC !== "0" &&
  (process.env.STORYBOOK_STATIC === "1" || staticStorybookExists)
) {
  process.env.STORYBOOK_STATIC = "1";
}

const port = process.env.STORYBOOK_CONTRACT_PORT ?? "6006";
const baseURL = `http://127.0.0.1:${port}`;
const useStaticStorybook = process.env.STORYBOOK_STATIC === "1";
const skipWebServer = process.env.STORYBOOK_CONTRACT_SKIP_SERVE === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries:
    process.env.STORYBOOK_CONTRACT_SKIP_SERVE === "1" ? 0 : process.env.CI ? 1 : 0,
  workers: 1,
  reporter:
    process.env.STORYBOOK_CONTRACT_SKIP_SERVE === "1"
      ? [["list"]]
      : [["list"], ["html", { open: "never" }]],
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
          command: `node scripts/storybook-static-serve.mjs ${port}`,
          url: baseURL,
          reuseExistingServer: useStaticStorybook ? false : !process.env.CI,
          timeout: 120_000
        }
      : {
          command: "pnpm storybook -- --ci --quiet",
          url: baseURL,
          reuseExistingServer: useStaticStorybook ? false : !process.env.CI,
          timeout: 180_000
        }
});
