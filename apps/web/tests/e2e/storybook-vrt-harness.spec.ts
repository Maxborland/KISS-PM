import { test, expect } from "@playwright/test";

import {
  assertNoStorybookChrome,
  auditHarnessProductTarget,
  gotoStory,
  HARNESS_REPRESENTATIVE_STORY_IDS,
  loadVrtStories,
  type HarnessTargetRecord,
  VRT_STORY_ID_PREFIXES,
  writeHarnessTargetsArtifact
} from "./storybook-vrt-utils";

test("storybook VRT manifest covers Widgets, Screens, Flows, Patterns", () => {
  const stories = loadVrtStories();
  expect(stories.length).toBeGreaterThanOrEqual(100);
  const sections = new Set(stories.map((s) => s.section));
  expect(sections.has("widgets")).toBe(true);
  expect(sections.has("screens")).toBe(true);
  expect(sections.has("flows")).toBe(true);
  expect(sections.has("patterns")).toBe(true);
});

const harnessTargets: HarnessTargetRecord[] = [];

test.describe("@harness Storybook product-root targeting", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.afterAll(() => {
    writeHarnessTargetsArtifact(harnessTargets);
  });

  for (const prefix of VRT_STORY_ID_PREFIXES) {
    const storyId = HARNESS_REPRESENTATIVE_STORY_IDS[prefix];

    test(`resolves product root for ${prefix} (${storyId})`, async ({ page }) => {
      const preview = await gotoStory(page, storyId);
      harnessTargets.push(await auditHarnessProductTarget(preview, storyId));
    });
  }

  test("fails anti-chrome gate when target is document body outside product root", async ({ page }) => {
    const preview = await gotoStory(page, HARNESS_REPRESENTATIVE_STORY_IDS["screens-"]);
    const body = page.locator("body");
    let failed = false;
    try {
      await assertNoStorybookChrome(preview, body);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
