import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import {
  assertStoryRendered,
  gotoStory,
  productRootAxeInclude,
  resolveProductRoot,
  STORYBOOK_ROOT_ID
} from "./storybook-vrt-utils";

/** Representative product surfaces — axe gate (0 critical / serious). */
const AXE_STORY_IDS = [
  "screens-дашборд--dashboard",
  "screens-моя-работа--my-work",
  "screens-сделки--deals",
  "screens-проекты--projects-list",
  "screens-справочники--entities-clients",
  "screens-проекты--project-audit",
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
      const preview = await gotoStory(page, storyId);
      await assertStoryRendered(preview);

      const productRoot = await resolveProductRoot(preview);
      await expect(productRoot).toBeVisible();
      const insideRoot = await productRoot.evaluate(
        (el, rootId) => !!el.closest(rootId),
        STORYBOOK_ROOT_ID
      );
      expect(insideRoot).toBe(true);
      expect((await productRoot.innerText()).trim().length).toBeGreaterThan(8);

      const include = await productRootAxeInclude(preview);
      const results = await new AxeBuilder({ page }).include(include).analyze();

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
