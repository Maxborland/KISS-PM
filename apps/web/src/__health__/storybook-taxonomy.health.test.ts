import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { STORYBOOK_APPROVED_ROOTS } from "./storybook-approved-roots";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const LEGACY_ENGLISH_STORY_NAMES = [
  "Dashboard Empty State",
  "Admin Loading",
  "Admin Error",
  "Admin Forbidden",
  "Deals Loading",
  "Deals Error",
  "Deals Forbidden",
  "Projects List Loading",
  "Projects List Error",
  "Project Kpi Loading",
  "Project Resources Loading",
  "Entities Clients Loading",
  "ReadOnly",
  "CellEditing",
  "ValidationError",
  "DragMoveTask",
  "ResizeDuration",
  "DependencyCreate",
  "DependencySelected",
  "InspectorOpen",
  "ContextMenuActions",
  "CellRangeSelection",
  "CopyPasteCells",
  "RowDragAndDrop",
  "DatePickerEditing",
  "ResourcePicker",
  "DependencyTypesAndLag",
  "DependencyGeometrySelected",
  "DrawerOverlayNoReflow",
  "EffortDurationLinkedFields",
  "PlanningIssuesAndOverloads",
  "ColumnResizeAndReorder",
  "OpenTaskCardAction",
  "BarClickDoesNotOpenDrawer",
  "BarMoveResizeProgress",
  "DependencyEndpointHandles",
  "DependencyCreationValidation",
  "PlanningIssueStyling",
  "Default",
  "EmptyStage",
  "Filtered",
  "DnD targets",
  "Витрина",
  "Варианты"
] as const;

type IndexEntry = {
  id: string;
  type?: string;
  title?: string;
  name?: string;
};

function loadStorybookIndex() {
  const path = join(webRoot, "storybook-static/index.json");
  if (!existsSync(path)) return null;
  const index = JSON.parse(readFileSync(path, "utf8")) as {
    entries: Record<string, IndexEntry>;
  };
  return index;
}

function storyEntries(index: NonNullable<ReturnType<typeof loadStorybookIndex>>) {
  return Object.values(index.entries).filter((e) => e.type === "story");
}

describe("Storybook taxonomy (Phase 9 curation)", () => {
  it("index has exactly eight approved roots when storybook-static is built", () => {
    const index = loadStorybookIndex();
    if (!index) {
      expect(existsSync(join(webRoot, "storybook-static/index.json"))).toBe(false);
      return;
    }

    const roots = new Set<string>();
    for (const entry of Object.values(index.entries)) {
      const root = entry.title?.split("/")[0];
      if (root) roots.add(root);
    }
    expect([...roots].sort()).toEqual([...STORYBOOK_APPROVED_ROOTS].sort());
  });

  it("has no exact duplicate title+name among stories", () => {
    const index = loadStorybookIndex();
    if (!index) return;

    const keys = new Map<string, string>();
    const dupes: string[] = [];
    for (const story of storyEntries(index)) {
      const key = `${story.title ?? ""}::${story.name ?? ""}`;
      const prev = keys.get(key);
      if (prev) dupes.push(`${key} (${prev}, ${story.id})`);
      else keys.set(key, story.id);
    }
    expect(dupes, dupes.join("\n")).toEqual([]);
  });

  it("does not keep a flat Screens root with 50+ sibling stories", () => {
    const index = loadStorybookIndex();
    if (!index) return;

    const flatScreens = storyEntries(index).filter((s) => s.title === "Screens");
    expect(flatScreens.length).toBeLessThan(50);
  });

  it("does not expose legacy English visible story names", () => {
    const index = loadStorybookIndex();
    if (!index) return;

    const hits: string[] = [];
    for (const story of storyEntries(index)) {
      if (story.name && LEGACY_ENGLISH_STORY_NAMES.includes(story.name as (typeof LEGACY_ENGLISH_STORY_NAMES)[number])) {
        hits.push(`${story.id}: ${story.name}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
