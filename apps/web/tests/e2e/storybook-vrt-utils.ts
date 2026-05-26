import { expect, type FrameLocator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Storybook index `title` is the section root only; filter by stable story `id` prefixes. */
export const VRT_STORY_ID_PREFIXES = ["widgets-", "screens-", "flows-", "patterns-"] as const;

export type VrtStoryEntry = {
  id: string;
  title: string;
  section: string;
};

const ERROR_MARKERS = [
  "Something went wrong",
  "Couldn't render story",
  "No Preview",
  "Storybook Error",
  "Importing a module script failed",
  "Found multiple elements",
  "TestingLibraryElementError",
  "Unable to find an element",
  "The story failed to render"
] as const;

export function loadVrtStories(webRoot = process.cwd()): VrtStoryEntry[] {
  const indexPath = join(webRoot, "storybook-static/index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
    entries: Record<string, { id: string; title?: string; name?: string; type?: string }>;
  };

  return Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .filter((entry) => VRT_STORY_ID_PREFIXES.some((prefix) => entry.id.startsWith(prefix)))
    .map((entry) => ({
      id: entry.id,
      title: entry.name ? `${entry.title ?? ""}/${entry.name}`.replace(/^\//, "") : entry.id,
      section: VRT_STORY_ID_PREFIXES.find((prefix) => entry.id.startsWith(prefix))?.replace(/-$/, "") ?? "unknown"
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function storyUrl(storyId: string, baseURL = "http://127.0.0.1:6006"): string {
  return `${baseURL}/?path=/story/${storyId}&viewMode=story`;
}

export async function gotoStory(page: Page, storyId: string, baseURL?: string): Promise<FrameLocator> {
  const url = storyUrl(storyId, baseURL);
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.locator("#storybook-preview-iframe").waitFor({ state: "attached", timeout: 120_000 });
  const frame = page.frameLocator("#storybook-preview-iframe");
  await frame.locator("body").waitFor({ state: "attached", timeout: 120_000 });
  await frame.locator(".sb-preparing-story").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => undefined);

  for (let i = 0; i < 80; i += 1) {
    const text = await frame.locator("body").innerText().catch(() => "");
    if (text.length > 5 && !text.includes("No Preview")) break;
    await page.waitForTimeout(500);
  }

  return frame;
}

export async function assertStoryRendered(_page: Page, frame: FrameLocator): Promise<void> {
  const bodyText = await frame.locator("body").innerText();
  expect(bodyText.length).toBeGreaterThan(8);
  for (const marker of ERROR_MARKERS) {
    expect(bodyText).not.toContain(marker);
  }

  const hasStoryRoot =
    (await frame
      .locator(
        "#storybook-root, [data-testid], .app-shell, .app-canvas, .flow-story, .pattern-story, .kanban, .gantt2, .rmatrix, .illu-state, .empty-state, .error-state, .forbidden-state, .loading-state, .workspace-chrome"
      )
      .count()) > 0;
  expect(hasStoryRoot).toBe(true);
}

export function storyBody(frame: FrameLocator) {
  return frame.locator("body");
}
