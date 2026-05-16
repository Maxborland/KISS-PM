import { describe, expect, it } from "vitest";

import { getPhase6FixtureSeed, PHASE6_FIXTURE_TIMESTAMP } from "./phase6Fixtures";

describe("Phase 6 deterministic resource fixture seed", () => {
  it("provides stable tenant, resource, load, overload, and E2E identifiers", () => {
    const seed = getPhase6FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE6_FIXTURE_TIMESTAMP);
    expect(seed.e2eIds).toEqual(["E2E-050", "E2E-051", "E2E-052", "E2E-053", "E2E-054", "E2E-055"]);
    expect(seed.tenantA.managerUserId).toBe("resource-manager-a");
    expect(seed.tenantA.loadBucket).toEqual({
      id: "load:resource-architect-a:2026-06-01:2026-06-05",
      resourceProfileId: "resource-architect-a",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-05",
      capacityHours: 36,
      assignedHours: 42,
      reservedHours: 8,
      totalLoadHours: 50,
      loadPercent: 138.89,
      severity: "critical"
    });
    expect(seed.tenantA.overload?.id).toBe("overload:resource-architect-a:2026-06-01:2026-06-05");
    expect(seed.tenantA.overload?.assignmentId).toBe("assignment-design-architect-a");
    expect(seed.tenantA.overload?.reservationId).toBe("reservation-draft-architect-a");
    expect(seed.tenantB.loadBucket.id).toBe("load:resource-private-b:2026-06-01:2026-06-05");
  });

  it("returns defensive copies so tests cannot contaminate later resets", () => {
    const seed = getPhase6FixtureSeed();

    seed.tenantA.resources[0]!.label = "mutated";
    seed.tenantA.overload?.affectedProjectIds.push("mutated-project");

    const nextSeed = getPhase6FixtureSeed();

    expect(nextSeed.tenantA.resources[0]?.label).toBe("Анна Архитектор");
    expect(nextSeed.tenantA.overload?.affectedProjectIds).not.toContain("mutated-project");
  });
});
