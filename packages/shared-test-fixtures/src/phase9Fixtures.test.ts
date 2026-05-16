import { describe, expect, it } from "vitest";

import { getPhase9FixtureSeed, PHASE9_FIXTURE_TIMESTAMP } from "./phase9Fixtures";

describe("Phase 9 deterministic retrospective fixture seed", () => {
  it("provides stable closure, snapshot, trend, and template-improvement identifiers", () => {
    const seed = getPhase9FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE9_FIXTURE_TIMESTAMP);
    expect(seed.e2eIds).toEqual(["E2E-080", "E2E-081", "E2E-082", "E2E-083"]);
    expect(seed.tenantA.projectManagerUserId).toBe("project-manager-a");
    expect(seed.tenantA.adminUserId).toBe("tenant-admin-a");
    expect(seed.tenantA.readOnlyUserId).toBe("readonly-observer-a");
    expect(seed.tenantA.closureProjectId).toBe("project-phase9-e2e-close-a");
    expect(seed.tenantA.snapshotProjectIds).toEqual([
      "project-phase9-e2e-snapshot-a",
      "project-phase9-e2e-snapshot-b"
    ]);
    expect(seed.tenantA.templateImprovementKey).toBe("add_acceptance_checkpoint");
    expect(seed.tenantB.privateProjectId).toBe("project-phase9-private-b");
  });

  it("returns defensive copies so E2E setup cannot contaminate reset state", () => {
    const seed = getPhase9FixtureSeed();

    seed.tenantA.snapshotProjectIds.push("mutated-project");
    seed.tenantA.closureData.lessonsLearned.push({
      id: "mutated-lesson",
      categoryKey: "process",
      summary: "Mutated",
      severity: "attention"
    });

    const nextSeed = getPhase9FixtureSeed();

    expect(nextSeed.tenantA.snapshotProjectIds).not.toContain("mutated-project");
    expect(nextSeed.tenantA.closureData.lessonsLearned).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "mutated-lesson" })])
    );
  });
});
