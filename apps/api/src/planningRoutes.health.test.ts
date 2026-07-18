import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const planningApiRoot = join(dirname(fileURLToPath(import.meta.url)), "planning");

function lineCount(relativePath: string): number {
  return readFileSync(join(planningApiRoot, relativePath), "utf8").split("\n").length;
}

describe("planning API route health budgets", () => {
  // Ре-бейзлайн 2026-07-18: scenario preview/apply вынесены из registerPlanningRoutes
  // в planningScenarioRoutes (главный нарушитель −350 строк); бюджеты листовых модулей
  // подняты до фактического размера + ~10% запаса — код рос месяцами без правки бюджета,
  // и красный health-тест перестал что-либо охранять.
  it.each([
    { path: "registerPlanningRoutes.ts", maxLines: 750 },
    { path: "planningScenarioRoutes.ts", maxLines: 420 },
    { path: "planningScenarioRejectRoute.ts", maxLines: 160 },
    { path: "planningRouteHelpers.ts", maxLines: 280 },
    { path: "planningReadModel.ts", maxLines: 140 },
    { path: "planningCommandCore.ts", maxLines: 90 },
    { path: "planningScenarioIntegrity.ts", maxLines: 140 },
    { path: "planningRouteAuth.ts", maxLines: 70 },
    { path: "planningSavedViewRoutes.ts", maxLines: 165 }
  ])("$path stays within line budget", ({ path, maxLines }) => {
    expect(lineCount(path), `${path} should be ≤ ${maxLines} lines`).toBeLessThanOrEqual(maxLines);
  });

  it("keeps planningRoutes.ts as thin re-export", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "planningRoutes.ts"),
      "utf8"
    );
    expect(source.split("\n").length).toBeLessThanOrEqual(5);
    expect(source).toContain('from "./planning/registerPlanningRoutes"');
  });
});
