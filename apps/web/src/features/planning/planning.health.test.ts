import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("planning repository health", () => {
  it("keeps App.tsx within line budget", () => {
    const lines = readFileSync(join(webSrc, "App.tsx"), "utf8").split("\n").length;
    expect(lines).toBeLessThanOrEqual(200);
  });

  it("keeps WbsGrid.tsx within line budget", () => {
    const lines = readFileSync(
      join(webSrc, "features/planning/grid/WbsGrid.tsx"),
      "utf8"
    ).split("\n").length;
    expect(lines).toBeLessThanOrEqual(400);
  });

  it("does not ship visible primary buttons without handlers in planning shell", () => {
    const source = readFileSync(
      join(webSrc, "features/planning/shell/PreviewApplyBar.tsx"),
      "utf8"
    );
    expect(source).toMatch(/onClick={props\.onApply}/);
    expect(source).toMatch(/disabled={!props\.permissions\.canManageProjectPlan/);
  });
});
