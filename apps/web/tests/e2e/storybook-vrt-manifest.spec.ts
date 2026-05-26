import { test, expect } from "@playwright/test";

import { loadVrtStories } from "./storybook-vrt-utils";

test("storybook VRT manifest covers Widgets, Screens, Flows, Patterns", () => {
  const stories = loadVrtStories();
  expect(stories.length).toBeGreaterThanOrEqual(100);
  const sections = new Set(stories.map((s) => s.section));
  expect(sections.has("widgets")).toBe(true);
  expect(sections.has("screens")).toBe(true);
  expect(sections.has("flows")).toBe(true);
  expect(sections.has("patterns")).toBe(true);
});
