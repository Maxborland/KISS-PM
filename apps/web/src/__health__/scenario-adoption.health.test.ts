import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getFixtureBundle } from "@/lib/mock-data/fixture-bundle";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const blocksDir = join(webRoot, "src/views/blocks");

const BANNED_MOCK_IMPORT =
  /import\s*\{[^}]*\bMOCK_(?!TENANT_ID)[A-Z0-9_]+[^}]*\}\s*from\s*["']@\/lib\/mock-data\//;

function listBlockFiles(): string[] {
  return readdirSync(blocksDir)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join(blocksDir, name));
}

/** Blocks с entity mock-data обязаны читать fixtures из scenario context. */
const SCENARIO_DATA_BLOCKS = new Set([
  "admin-block.tsx",
  "avatar-menu-block.tsx",
  "deals-block.tsx",
  "entities-block.tsx",
  "my-work-block.tsx",
  "project-audit-block.tsx",
  "project-baseline-block.tsx",
  "project-calendars-block.tsx",
  "project-kpi-block.tsx",
  "project-resources-block.tsx",
  "project-scenarios-block.tsx",
  "projects-list-block.tsx",
  "settings-block.tsx",
  "state-screen-block.tsx"
]);

describe("storybook scenario adoption", () => {
  it("requires views/blocks to consume scenario context instead of entity mocks", () => {
    const violations: string[] = [];

    for (const filePath of listBlockFiles()) {
      const base = filePath.split(/[/\\]/).pop() ?? "";
      if (!SCENARIO_DATA_BLOCKS.has(base)) continue;

      const source = readFileSync(filePath, "utf8");
      if (!source.includes("useScenarioFixtures")) {
        violations.push(`${filePath}: missing useScenarioFixtures()`);
      }
      if (BANNED_MOCK_IMPORT.test(source)) {
        violations.push(`${filePath}: banned direct MOCK_* import from mock-data`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("derives empty and overload scenarios from fixture bundle", () => {
    expect(getFixtureBundle("empty").opportunities).toHaveLength(0);
    expect(getFixtureBundle("overload").kpiEvaluations.some((item) => item.severity === "critical")).toBe(
      true
    );
  });
});
