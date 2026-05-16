import { describe, expect, it } from "vitest";

import { getPhase8FixtureSeed } from "./phase8Fixtures";

describe("Phase 8 fixtures", () => {
  it("exposes deterministic Portfolio Control, action, permission, and reset ids for E2E-070..075", () => {
    const seed = getPhase8FixtureSeed();

    expect(seed.e2eIds).toEqual(["E2E-070", "E2E-071", "E2E-072", "E2E-073", "E2E-074", "E2E-075"]);
    expect(seed.tenantA).toMatchObject({
      surfaceId: "portfolio-control",
      projectManagerUserId: "project-manager-a",
      resourceManagerUserId: "resource-manager-a",
      adminUserId: "tenant-admin-a",
      readOnlyUserId: "readonly-observer-a",
      projectId: "project-alpha-a",
      criticalSignalRowId: "row-kpi-signal-kpi-schedule-variance-a",
      warningSignalRowId: "row-kpi-signal-kpi-schedule-variance-a-warning",
      resourceOverloadRowId: "row-resource-overload-resource-architect-a"
    });
    expect(seed.tenantA.actions).toMatchObject({
      corrective: "action-create-corrective-task",
      acceptRisk: "action-accept-risk",
      escalate: "action-escalate-signal",
      requestExplanation: "action-request-explanation",
      shiftResourceWork: "action-shift-resource-work"
    });
    expect(seed.tenantB.privateProjectId).toBe("project-private-b");
  });
});
