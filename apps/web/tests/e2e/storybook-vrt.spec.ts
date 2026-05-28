import { test, expect } from "@playwright/test";

import {
  assertStoryRendered,
  gotoStory,
  loadVrtStories,
  resolveProductRoot
} from "./storybook-vrt-utils";

const only = process.env.STORYBOOK_VRT_ONLY;
const stories = loadVrtStories().filter((story) => !only || story.id === only);
// Linux CI rasterizes the Windows-authored Storybook baselines with different system fonts.
const maxDiffPixelRatio = process.env.CI && process.platform === "linux" ? 0.08 : 0.02;
const stableMinHeights: Record<string, number> = {
  "flows-онбординг-рабочей-области--default": 2512,
  "screens-администрирование--admin": 1426
};

test.describe("Storybook visual regression", () => {
  test.describe.configure({ mode: "parallel", timeout: 90_000 });

  for (const story of stories) {
    test(`@vrt ${story.section} · ${story.title}`, async ({ page }) => {
      const preview = await gotoStory(page, story.id);
      await assertStoryRendered(preview);

      const productRoot = await resolveProductRoot(preview);
      const stableMinHeight = stableMinHeights[story.id];
      if (stableMinHeight) {
        await productRoot.evaluate(
          (element, minHeight) => {
            (element as HTMLElement).style.minHeight = `${minHeight}px`;
          },
          stableMinHeight
        );
      }

      await expect(productRoot).toHaveScreenshot(`${story.id}.png`, {
        animations: "disabled",
        maxDiffPixelRatio,
        threshold: process.env.CI && process.platform === "linux" ? 0.35 : 0.2,
        timeout: 30_000
      });
    });
  }
});
