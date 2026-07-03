import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const planningApiRoot = join(dirname(fileURLToPath(import.meta.url)), "planning");

function lineCount(relativePath: string): number {
  return readFileSync(join(planningApiRoot, relativePath), "utf8").split("\n").length;
}

describe("planning API route health budgets", () => {
  it.each([
    { path: "registerPlanningRoutes.ts", maxLines: 930 },
    { path: "planningRouteHelpers.ts", maxLines: 220 },
    { path: "planningReadModel.ts", maxLines: 140 },
    { path: "planningCommandCore.ts", maxLines: 90 },
    { path: "planningScenarioIntegrity.ts", maxLines: 120 },
    { path: "planningRouteAuth.ts", maxLines: 70 },
    { path: "planningSavedViewRoutes.ts", maxLines: 120 }
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
