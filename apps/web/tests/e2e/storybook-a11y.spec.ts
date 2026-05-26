import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { assertStoryRendered, gotoStory } from "./storybook-vrt-utils";

/** Representative product surfaces — axe gate (0 critical / serious). */
const AXE_STORY_IDS = [
  "screens--dashboard",
  "screens--my-work",
  "screens--deals",
  "screens--projects-list",
  "screens--entities-clients",
  "screens--audit",
  "patterns-панель-фильтров--toolbar",
  "widgets-funnel--default",
  "flows-crm-→-проект--default",
  "patterns-состояния-загрузки--empty",
  "patterns-формы--single"
] as const;

test.describe("@a11y Storybook accessibility", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  for (const storyId of AXE_STORY_IDS) {
    test(storyId, async ({ page }) => {
      const frame = await gotoStory(page, storyId);
      await assertStoryRendered(page, frame);

      const results = await new AxeBuilder({ page }).include("#storybook-preview-iframe").analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (blocking.length > 0) {
        const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("\n");
        expect.soft(blocking, summary).toEqual([]);
      }
      expect(blocking).toEqual([]);
    });
  }
});
