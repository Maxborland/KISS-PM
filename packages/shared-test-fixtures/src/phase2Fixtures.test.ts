import { describe, expect, it } from "vitest";

import { getPhase2FixtureSeed, getPhase2ProbePairForTenant } from "./phase2Fixtures";

describe("Phase 2 deterministic fixture seed", () => {
  it("provides tenant-owned users, probes, labels, profiles, and an empty audit baseline", () => {
    const seed = getPhase2FixtureSeed();

    expect(seed.generatedAt).toBe("2026-05-14T00:00:00.000Z");
    expect(seed.tenants.map((tenant) => tenant.id)).toEqual(["tenant-a", "tenant-b"]);
    expect(seed.tenants[0]?.users.map((user) => user.id)).toEqual([
      "tenant-admin-a",
      "project-manager-a",
      "resource-manager-a",
      "executor-a",
      "readonly-observer-a"
    ]);
    expect(seed.tenants[1]?.users.map((user) => user.id)).toEqual(["tenant-admin-b", "user-b"]);
    expect(seed.tenants.map((tenant) => tenant.isolationProbe.id)).toEqual(["probe-a-private", "probe-b-private"]);
    expect(seed.labelSets.map((labelSet) => labelSet.tenantId)).toEqual(["tenant-a", "tenant-b"]);
    expect(seed.labelSets.find((labelSet) => labelSet.tenantId === "tenant-a")?.labels["navigation.admin"]).toBe(
      "Администрирование"
    );
    expect(seed.accessProfiles.map((profile) => profile.id)).toEqual([
      "profile-tenant-admin-a",
      "profile-project-manager-a",
      "profile-resource-manager-a",
      "profile-executor-a",
      "profile-readonly-observer-a",
      "profile-tenant-admin-b",
      "profile-tenant-user-b"
    ]);
    expect(seed.accessProfiles.every((profile) => profile.permissions.includes("tenant.read"))).toBe(true);
    expect(seed.auditEvents).toEqual([]);
    expect(JSON.stringify(seed)).not.toMatch(/bitrix|customer|production|secret/i);
  });

  it("returns deep clones so a scenario cannot contaminate the next reset", () => {
    const seed = getPhase2FixtureSeed();

    seed.tenants[0]?.users.push({
      id: "mutated-user",
      tenantId: "tenant-a",
      displayName: "Mutated",
      roleKey: "tenant_admin",
      accessProfileId: "profile-tenant-admin-a"
    });
    seed.accessProfiles[1]?.permissions.push("audit.read");
    if (seed.labelSets[0]) {
      seed.labelSets[0].labels["navigation.admin"] = "Mutated";
    }

    const nextSeed = getPhase2FixtureSeed();

    expect(nextSeed.tenants[0]?.users.map((user) => user.id)).not.toContain("mutated-user");
    expect(nextSeed.accessProfiles[1]?.permissions).not.toContain("audit.read");
    expect(nextSeed.labelSets[0]?.labels["navigation.admin"]).toBe("Администрирование");
  });

  it("derives own and foreign probe ids for each seeded tenant without tenant-specific UI logic", () => {
    expect(getPhase2ProbePairForTenant("tenant-a")).toEqual({
      ownProbeId: "probe-a-private",
      foreignProbeId: "probe-b-private"
    });
    expect(getPhase2ProbePairForTenant("tenant-b")).toEqual({
      ownProbeId: "probe-b-private",
      foreignProbeId: "probe-a-private"
    });
  });
});
