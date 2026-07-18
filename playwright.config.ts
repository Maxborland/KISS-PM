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
  // Карантин: спеки, нацеленные на удалённый UI (см. e2e/quarantine/README.md).
  // Выходят из карантина только переписанными на живые якоря.
  testIgnore: "**/quarantine/**",
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
  // Кросс-платформенный webServer: env-переменные задаются нативной опцией `env`
  // (прежняя powershell-обёртка привязывала запуск e2e к Windows).
  webServer: [
    {
      command: `pnpm --dir "${configDir}" --filter @kiss-pm/api dev`,
      cwd: configDir,
      env: {
        DATABASE_URL: databaseUrl,
        PORT: apiPort,
        KISS_PM_E2E_TEST_HOOKS: "1",
        // Детерминированный LLM-провайдер для живого SSE-пути (двойной гейт с test-hooks);
        // спеки, мокающие /propose/stream на границе HTTP, от него не зависят.
        KISS_PM_AGENT_SCRIPTED: "1",
        KISS_PM_TRUSTED_MUTATION_ORIGINS: webOrigin
      },
      url: `${apiOrigin}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: `pnpm --dir "${configDir}" --filter @kiss-pm/web exec next dev -H 127.0.0.1 -p ${webPort}`,
      cwd: configDir,
      env: { KISS_PM_API_ORIGIN: apiOrigin },
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
