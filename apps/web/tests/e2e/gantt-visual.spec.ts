import { test, expect } from "@playwright/test";

const STORY = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

const ZOOM_STORIES = [
  ["widgets-gantt--baseline-and-critical-path", "day"],
  ["widgets-gantt--dependency-selected", "day"],
  ["widgets-gantt--dependency-create", "day"]
] as const;

test.describe("Gantt production-grade visual contract", () => {
  for (const [id] of ZOOM_STORIES) {
    test(`stable screenshot: ${id}`, async ({ page }) => {
      await page.goto(STORY(id));
      await page.waitForSelector(".gantt2");
      await page.waitForTimeout(150);
      await expect(page).toHaveScreenshot(`${id}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled"
      });
    });
  }

  test("deps render under bars, selected dep above (DOM order check)", async ({ page }) => {
    await page.goto(STORY("widgets-gantt--dependency-selected"));
    await page.waitForSelector(".gantt2__deps");
    const order = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(".gantt2__deps .gdep__path"));
      return groups.map((g) => g.classList.contains("gdep__path--selected"));
    });
    expect(order.length).toBeGreaterThan(0);
    expect(order.at(-1)).toBe(true);
  });

  test("ArrowHead direction follows entryDir (FF entry from right)", async ({ page }) => {
    await page.goto(STORY("widgets-gantt--dependency-types-and-lag"));
    await page.waitForSelector(".gdep__arrow");
    const hasLeftArrow = await page.evaluate(() => {
      const arrows = Array.from(document.querySelectorAll(".gdep__arrow")) as SVGPolygonElement[];
      return arrows.some((a) => {
        const pts = a.getAttribute("points")?.split(" ").map((p) => p.split(",").map(Number)) ?? [];
        if (pts.length < 3) return false;
        const tip = pts[0]!;
        const tail = pts[1]!;
        return tail[0]! > tip[0]!;
      });
    });
    expect(hasLeftArrow).toBe(true);
  });
});
