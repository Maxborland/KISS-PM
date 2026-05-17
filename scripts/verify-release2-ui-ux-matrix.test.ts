import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/verify-release2-ui-ux-matrix.mjs");
const fixtureDir = resolve("test-results/verify-release2-ui-ux-matrix");
const currentMatrix = JSON.parse(readFileSync("docs/status/release2-ui-ux-screen-matrix.json", "utf8"));

function writeFixture(name: string, matrix: unknown) {
  mkdirSync(fixtureDir, { recursive: true });
  const path = resolve(fixtureDir, name);
  writeFileSync(path, JSON.stringify(matrix, null, 2));
  return path;
}

function runVerifier(path: string) {
  return spawnSync(process.execPath, [scriptPath, path], { encoding: "utf8" });
}

describe("verify-release2-ui-ux-matrix", () => {
  it("accepts the committed Release 2 UI/UX matrix", () => {
    const result = runVerifier("docs/status/release2-ui-ux-screen-matrix.json");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release 2 UI/UX matrix verified");
  });

  it("rejects a missing BP stage", () => {
    const matrix = structuredClone(currentMatrix);
    matrix.screens = matrix.screens.filter((screen: { bp_stage: string }) => screen.bp_stage !== "S7");
    const path = writeFixture("missing-stage.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("S7: no Release 2 screen covers this BP stage");
  });

  it("rejects report-like screens without the full management loop", () => {
    const matrix = structuredClone(currentMatrix);
    delete matrix.screens[0].management_loop.preview;
    const path = writeFixture("missing-preview.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("management_loop.preview");
  });

  it("rejects screens without audit/readback/reload/cleanup evidence requirements", () => {
    const matrix = structuredClone(currentMatrix);
    matrix.screens[0].audit_required = false;
    matrix.screens[0].readback_required = false;
    matrix.screens[0].reload_required = false;
    matrix.screens[0].cleanup_required = false;
    const path = writeFixture("missing-evidence-rules.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("audit_required must be true");
    expect(result.stderr).toContain("readback_required must be true");
    expect(result.stderr).toContain("reload_required must be true");
    expect(result.stderr).toContain("cleanup_required must be true");
  });

  it("rejects a Gantt planner that drops MS Project-like ergonomics", () => {
    const matrix = structuredClone(currentMatrix);
    const gantt = matrix.screens.find((screen: { id: string }) => screen.id === "R2-S2-PROJECT-GANTT-PLANNER");
    gantt.primary_goal = "Plan project work.";
    const path = writeFixture("weak-gantt.json", matrix);

    const result = runVerifier(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MS Project-like planner ergonomics");
  });
});
