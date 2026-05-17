import { describe, expect, it } from "vitest";

import { getPhase11FixtureSeed, PHASE11_FIXTURE_TIMESTAMP } from "./phase11Fixtures";

describe("Phase 11 deterministic integrations fixture seed", () => {
  it("provides stable tenant, adapter, import, canonical, and E2E identifiers", () => {
    const seed = getPhase11FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE11_FIXTURE_TIMESTAMP);
    expect(seed.e2eIds).toEqual(["E2E-100", "E2E-101", "E2E-102", "E2E-103", "E2E-104"]);
    expect(seed.e2ePaths).toEqual([
      "e2e/tests/phase11/adapter-import.spec.ts",
      "e2e/tests/phase11/adapter-idempotency.spec.ts",
      "e2e/tests/phase11/adapter-failure.spec.ts",
      "e2e/tests/phase11/imported-project-canonical.spec.ts",
      "e2e/tests/phase11/external-mapping-diagnostics.spec.ts"
    ]);
    expect(seed.tenantA.adminUserId).toBe("tenant-admin-a");
    expect(seed.tenantA.readOnlyUserId).toBe("readonly-observer-a");
    expect(seed.tenantA.projectManagerUserId).toBe("project-manager-a");
    expect(seed.tenantB.adminUserId).toBe("tenant-admin-b");
    expect(seed.tenantA.adapterId).toBe("adapter-mock-crm");
    expect(seed.tenantA.connectionId).toBe("conn-mock-crm-a");
    expect(seed.tenantA.validPayloadFixtureKey).toBe("mock-crm-valid");
    expect(seed.tenantA.invalidPayloadFixtureKey).toBe("mock-crm-invalid");
    expect(seed.tenantA.idempotencyKey).toBe("idem-e2e-101-p11");
    expect(seed.tenantA.importedProjectTitle).toBe("Импорт: API проект");
    expect(seed.tenantA.importedTaskTitle).toBe("API imported task");
  });

  it("returns defensive copies so E2E setup cannot contaminate reset state", () => {
    const seed = getPhase11FixtureSeed();

    seed.e2eIds.push("mutated");
    seed.tenantA.expectedMappingEntityTypes.push("mutated");
    seed.tenantA.auditCommands.push("mutated");

    const nextSeed = getPhase11FixtureSeed();

    expect(nextSeed.e2eIds).not.toContain("mutated");
    expect(nextSeed.tenantA.expectedMappingEntityTypes).not.toContain("mutated");
    expect(nextSeed.tenantA.auditCommands).toEqual(["import_apply", "integration.import.materialize_project"]);
  });
});
