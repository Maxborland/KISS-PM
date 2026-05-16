import { describe, expect, it } from "vitest";

import { getPhase7FixtureSeed, PHASE7_FIXTURE_TIMESTAMP } from "./phase7Fixtures";

describe("Phase 7 deterministic KPI fixture seed", () => {
  it("provides stable tenant, definition, evaluation, signal, and E2E identifiers", () => {
    const seed = getPhase7FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE7_FIXTURE_TIMESTAMP);
    expect(seed.e2eIds).toEqual(["E2E-060", "E2E-061", "E2E-062", "E2E-063", "E2E-064"]);
    expect(seed.tenantA.adminUserId).toBe("tenant-admin-a");
    expect(seed.tenantA.projectManagerUserId).toBe("project-manager-a");
    expect(seed.tenantA.definition).toEqual({
      id: "kpi-schedule-variance-a",
      formulaId: "formula-schedule-variance-a-v1",
      thresholdRuleSetId: "threshold-schedule-variance-a-v1",
      criticalRuleId: "schedule-variance-critical",
      projectId: "project-alpha-a",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-07",
      plannedWorkHours: 80,
      actualWorkHours: 100,
      expectedValue: -25,
      expectedSeverity: "critical"
    });
    expect(seed.tenantA.signal.id).toBe("signal-kpi-schedule-variance-a");
    expect(seed.tenantA.warningSignal).toMatchObject({
      id: "signal-kpi-schedule-variance-a-warning",
      evaluationId: "eval-kpi-schedule-variance-a-warning-1",
      sourceEntityId: "project-warning-a",
      expectedSeverity: "warning"
    });
    expect(seed.tenantB.definition.id).toBe("kpi-schedule-variance-private-b");
    expect(seed.tenantB.readOnlyUserId).toBe("user-b");
    expect(seed.tenantB.signal.sourceEntityId).toBe("project-private-b");
  });

  it("returns defensive copies so E2E setup cannot contaminate later resets", () => {
    const seed = getPhase7FixtureSeed();

    seed.tenantA.signal.recommendedActionKeys.push("mutated_action");
    seed.tenantA.warningSignal.recommendedActionKeys.push("mutated_action");
    seed.tenantA.definition.plannedWorkHours = 1;

    const nextSeed = getPhase7FixtureSeed();

    expect(nextSeed.tenantA.signal.recommendedActionKeys).not.toContain("mutated_action");
    expect(nextSeed.tenantA.warningSignal.recommendedActionKeys).not.toContain("mutated_action");
    expect(nextSeed.tenantA.definition.plannedWorkHours).toBe(80);
  });
});
