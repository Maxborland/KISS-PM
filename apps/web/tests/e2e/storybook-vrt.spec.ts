import { test, expect } from "@playwright/test";

import {
  assertStoryRendered,
  gotoStory,
  loadVrtStories,
  resolveProductRoot
} from "./storybook-vrt-utils";

const only = process.env.STORYBOOK_VRT_ONLY;
const stories = loadVrtStories().filter((story) => !only || story.id === only);

test.describe("Storybook visual regression", () => {
  test.describe.configure({ mode: "parallel", timeout: 90_000 });

  for (const story of stories) {
    test(`@vrt ${story.section} · ${story.title}`, async ({ page }) => {
      const preview = await gotoStory(page, story.id);
      await assertStoryRendered(preview);

      const productRoot = await resolveProductRoot(preview);
      await expect(productRoot).toHaveScreenshot(`${story.id}.png`, {
        animations: "disabled",
        maxDiffPixelRatio: 0.02,
        timeout: 30_000
      });
    });
  }
});
