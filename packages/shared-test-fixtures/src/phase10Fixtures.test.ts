import { describe, expect, it } from "vitest";

import { getPhase10FixtureSeed, PHASE10_FIXTURE_TIMESTAMP } from "./phase10Fixtures";

describe("Phase 10 deterministic no-code customization fixture seed", () => {
  it("provides stable tenant, runtime, configuration, and E2E identifiers", () => {
    const seed = getPhase10FixtureSeed();

    expect(seed.generatedAt).toBe(PHASE10_FIXTURE_TIMESTAMP);
    expect(seed.e2eIds).toEqual(["E2E-090", "E2E-091", "E2E-092", "E2E-093", "E2E-094", "E2E-095"]);
    expect(seed.tenantA.adminUserId).toBe("tenant-admin-a");
    expect(seed.tenantA.readOnlyUserId).toBe("readonly-observer-a");
    expect(seed.tenantA.runtimeUserId).toBe("project-manager-a");
    expect(seed.tenantB.adminUserId).toBe("tenant-admin-b");
    expect(seed.tenantA.labelChanges.roleProjectManager).toBe("РП P10");
    expect(seed.tenantA.labelChanges.stageInitiation).toBe("Старт P10");
    expect(seed.tenantA.customField.projectId).toBe("project-p10-custom-field");
    expect(seed.tenantA.customField.key).toBe("risk_level");
    expect(seed.tenantA.kpiThreshold.definitionId).toBe("kpi-schedule-variance-a");
    expect(seed.tenantA.savedView.savedViewKey).toBe("critical_portfolio");
    expect(seed.tenantA.actionConfig.disabledActionKey).toBe("accept_risk");
    expect(seed.tenantA.importedRoleLabel).toBe("РП импорт E2E");
  });

  it("returns defensive copies so E2E setup cannot contaminate reset state", () => {
    const seed = getPhase10FixtureSeed();

    seed.tenantA.customField.options.push("mutated");
    seed.tenantA.savedView.visibleFieldKeys.push("mutated_field");
    seed.tenantA.kpiThreshold.rules[0]!.explanation = "Mutated";

    const nextSeed = getPhase10FixtureSeed();

    expect(nextSeed.tenantA.customField.options).not.toContain("mutated");
    expect(nextSeed.tenantA.savedView.visibleFieldKeys).not.toContain("mutated_field");
    expect(nextSeed.tenantA.kpiThreshold.rules[0]!.explanation).toBe("Критическое отклонение после настройки P10");
  });
});
