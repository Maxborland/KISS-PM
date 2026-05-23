import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const planningRoot = join(fileURLToPath(new URL(".", import.meta.url)));

function listTsxFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    if (entry.isFile() && entry.name.endsWith(".tsx")) return [path];
    return [];
  });
}

describe("planning health budgets", () => {
  it("bans bare select elements in planning feature", () => {
    const files = listTsxFiles(planningRoot);
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /<select\b/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("keeps WbsGrid within line budget", () => {
    const wbsGrid = join(planningRoot, "grid/WbsGrid.tsx");
    const lines = readFileSync(wbsGrid, "utf8").split("\n").length;
    expect(lines).toBeLessThanOrEqual(380);
  });

  it.each([
    { path: "resources/useMonthlyResourceMatrix.ts", maxLines: 380 },
    { path: "resources/useCrossProjectTasks.ts", maxLines: 120 },
    { path: "resources/MonthlyResourceMatrix.tsx", maxLines: 220 },
    { path: "resources/MonthNavigation.tsx", maxLines: 100 },
    { path: "resources/ResourceMatrixCell.tsx", maxLines: 100 },
    { path: "resources/ResourceMatrixRowGroup.tsx", maxLines: 120 },
    { path: "resources/CrossProjectTaskTooltip.tsx", maxLines: 80 },
    { path: "resources/ResourceDayDrawer.tsx", maxLines: 90 },
    { path: "resources/ResourcesPane.tsx", maxLines: 160 },
    { path: "settings/ProjectSettingsPane.tsx", maxLines: 140 },
    { path: "settings/CalendarPreviewSummary.tsx", maxLines: 100 },
    { path: "savedViews/useSavedViews.ts", maxLines: 140 },
    { path: "savedViews/SavedViewsDropdown.tsx", maxLines: 80 },
    { path: "customFields/CustomFieldDefinitionsPane.tsx", maxLines: 180 },
    { path: "grid/wbsColumns.tsx", maxLines: 120 }
  ])("$path stays within line budget", (file) => {
    const fullPath = join(planningRoot, file.path);
    const lines = readFileSync(fullPath, "utf8").split("\n").length;
    expect(lines, `${file.path} should be ≤ ${file.maxLines} lines`).toBeLessThanOrEqual(
      file.maxLines
    );
  });
});
