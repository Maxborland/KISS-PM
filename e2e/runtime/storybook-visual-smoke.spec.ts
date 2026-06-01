import { statSync } from "node:fs";

import { expect, test } from "./runtimeQaFixtures";

const storybookOrigin = `http://127.0.0.1:${process.env.STORYBOOK_PORT ?? "6006"}`;

const stableStories = [
  { id: "foundations-colors--palette", name: "tokens" },
  { id: "screens-дашборд--dashboard", name: "dashboard" },
  { id: "screens-сделки--deals", name: "deals" },
  { id: "screens-администрирование--settings", name: "settings" }
] as const;

test.skip(process.env.KISS_PM_STORYBOOK_QA !== "1", "Storybook visual QA runs only in qa:runtime.");

test("stable design-v3 Storybook stories render and produce visual QA artifacts", async ({
  page
}, testInfo) => {
  for (const story of stableStories) {
    for (const viewport of [
      { height: 900, name: "desktop", minBytes: 10_000, width: 1440 },
      { height: 844, name: "narrow", minBytes: 5_000, width: 390 }
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${storybookOrigin}/iframe.html?id=${story.id}&viewMode=story`, {
        waitUntil: "domcontentloaded"
      });

      const storyRoot = page.locator("#storybook-root");
      await storyRoot.waitFor();
      await expect(storyRoot).not.toContainText("No Preview");
      await expect(storyRoot).toContainText(/[А-Яа-яЁё]/);

      const screenshotPath = testInfo.outputPath(`${story.name}-${viewport.name}.png`);
      await storyRoot.screenshot({ path: screenshotPath });
      expect(statSync(screenshotPath).size, `${story.id} ${viewport.name} screenshot`).toBeGreaterThan(
        viewport.minBytes
      );
    }
  }
});
