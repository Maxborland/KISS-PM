import { describe, expect, it } from "vitest";

import {
  ResourcePlanningModelError,
  createDemandTemplateProfile,
  estimateDemandFromTemplateMatch
} from "./index";

const updatedAt = "2026-05-14T19:40:00+07:00";
const tenantId = "tenant-a";
const opportunityId = "opportunity-acme-portal";

function createBaselineProfile() {
  return createDemandTemplateProfile({
    id: "demand-profile-implementation-integrations",
    tenantId,
    templateKey: "implementation.integration_heavy",
    templateVersion: 2,
    scenarioKey: "baseline",
    scenarioLabel: "Базовый сценарий",
    formula: {
      key: "phase3.template_scope_linear",
      version: 1,
      label: "Базовая оценка по шаблону и признакам объема"
    },
    roleRules: [
      {
        stageKey: "delivery",
        stageLabel: "Поставка",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        baseWorkHours: 80,
        scopeHintDrivers: [{ scopeHintKey: "modules_count", hoursPerUnit: 12 }],
        confidence: 0.82,
        sortOrder: 20,
        assumptions: [{ code: "architecture_review", message: "Архитектор проверяет модульную декомпозицию." }]
      },
      {
        stageKey: "initiation",
        stageLabel: "Инициация",
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        baseWorkHours: 40,
        scopeHintDrivers: [{ scopeHintKey: "integrations_count", hoursPerUnit: 8 }],
        confidence: 0.86,
        sortOrder: 10,
        assumptions: [{ code: "coordination_load", message: "РП ведет координацию интеграций." }]
      }
    ],
    updatedAt
  });
}

function createScopeHints(
  overrides: {
    tenantId?: string;
    opportunityId?: string;
    integrationsValue?: string | number;
    modulesValue?: string | number;
  } = {}
) {
  return [
    {
      tenantId: overrides.tenantId ?? tenantId,
      opportunityId: overrides.opportunityId ?? opportunityId,
      key: "integrations_count",
      label: "Количество интеграций",
      value: overrides.integrationsValue ?? 3
    },
    {
      tenantId: overrides.tenantId ?? tenantId,
      opportunityId: overrides.opportunityId ?? opportunityId,
      key: "modules_count",
      label: "Количество модулей",
      value: overrides.modulesValue ?? 5
    }
  ];
}

describe("demand estimation draft", () => {
  it("produces deterministic stage and role demand from a matched template and opportunity scope hints", () => {
    const estimate = estimateDemandFromTemplateMatch({
      tenantId,
      opportunityId,
      templateMatch: {
        tenantId,
        opportunityId,
        matched: true,
        template: {
          id: "process-template-integrations",
          key: "implementation.integration_heavy",
          label: "Внедрение с интеграциями",
          version: 2
        },
        confidence: 0.9,
        assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }]
      },
      scopeHints: createScopeHints(),
      demandProfile: createBaselineProfile()
    });

    expect(estimate).toEqual({
      tenantId,
      opportunityId,
      template: {
        key: "implementation.integration_heavy",
        label: "Внедрение с интеграциями",
        version: 2
      },
      scenario: {
        key: "baseline",
        label: "Базовый сценарий"
      },
      formula: {
        key: "phase3.template_scope_linear",
        version: 1,
        label: "Базовая оценка по шаблону и признакам объема"
      },
      stageRoleDemands: [
        {
          stageKey: "initiation",
          stageLabel: "Инициация",
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          plannedWorkHours: 64,
          confidence: 0.86,
          formulaRef: "phase3.template_scope_linear@1",
          sourceAssumptions: [
            { code: "coordination_load", message: "РП ведет координацию интеграций." },
            {
              code: "scope_hint_driver",
              message: "integrations_count x 8 ч = 24 ч."
            }
          ]
        },
        {
          stageKey: "delivery",
          stageLabel: "Поставка",
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          plannedWorkHours: 140,
          confidence: 0.82,
          formulaRef: "phase3.template_scope_linear@1",
          sourceAssumptions: [
            { code: "architecture_review", message: "Архитектор проверяет модульную декомпозицию." },
            {
              code: "scope_hint_driver",
              message: "modules_count x 12 ч = 60 ч."
            }
          ]
        }
      ],
      totalPlannedWorkHours: 204,
      confidence: 0.82,
      assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }],
      trace: [
        "demand_estimate:template:implementation.integration_heavy@2",
        "demand_estimate:scenario:baseline",
        "demand_estimate:formula:phase3.template_scope_linear@1",
        "demand_estimate:stage_role_demands:2"
      ]
    });
  });

  it("rejects unmatched templates, tenant mismatches, and template/profile version drift", () => {
    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId,
        opportunityId,
        templateMatch: {
          tenantId,
          opportunityId,
          matched: false,
          confidence: 0,
          assumptions: []
        },
        scopeHints: [],
        demandProfile: createBaselineProfile()
      })
    ).toThrow("demandEstimate.templateMatch must be matched");

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId,
        opportunityId,
        templateMatch: {
          tenantId,
          opportunityId,
          matched: true,
          template: {
            id: "process-template-integrations",
            key: "implementation.integration_heavy",
            label: "Внедрение с интеграциями",
            version: 2
          },
          confidence: 0.9,
          assumptions: []
        },
        scopeHints: [],
        demandProfile: { ...createBaselineProfile(), tenantId: "tenant-b" }
      })
    ).toThrow("Demand profile tenant mismatch");

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId: "tenant-a",
        opportunityId,
        templateMatch: {
          tenantId,
          opportunityId,
          matched: true,
          template: {
            id: "process-template-integrations",
            key: "implementation.integration_heavy",
            label: "Внедрение с интеграциями",
            version: 3
          },
          confidence: 0.9,
          assumptions: []
        },
        scopeHints: [],
        demandProfile: createBaselineProfile()
      })
    ).toThrow("Demand profile template version mismatch: expected 3, profile 2");
  });

  it("rejects nonnumeric scope hints used by demand formulas without producing NaN", () => {
    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId: "tenant-a",
        opportunityId,
        templateMatch: {
          tenantId,
          opportunityId,
          matched: true,
          template: {
            id: "process-template-integrations",
            key: "implementation.integration_heavy",
            label: "Внедрение с интеграциями",
            version: 2
          },
          confidence: 0.9,
          assumptions: []
        },
        scopeHints: createScopeHints({ integrationsValue: "три" }),
        demandProfile: createBaselineProfile()
      })
    ).toThrow("demandEstimate.scopeHint.integrations_count must be numeric");

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId: "tenant-a",
        opportunityId,
        templateMatch: {
          tenantId,
          opportunityId,
          matched: true,
          template: {
            id: "process-template-integrations",
            key: "implementation.integration_heavy",
            label: "Внедрение с интеграциями",
            version: 2
          },
          confidence: 0.9,
          assumptions: []
        },
        scopeHints: createScopeHints({ integrationsValue: -1 }),
        demandProfile: createBaselineProfile()
      })
    ).toThrow("demandEstimate.scopeHint.integrations_count must be a non-negative number");

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId: "tenant-a",
        opportunityId: "opportunity-acme-portal",
        templateMatch: {
          tenantId: "tenant-a",
          opportunityId: "opportunity-acme-portal",
          matched: true,
          template: {
            id: "process-template-integrations",
            key: "implementation.integration_heavy",
            label: "Внедрение с интеграциями",
            version: 2
          },
          confidence: 0.9,
          assumptions: []
        },
        scopeHints: [],
        demandProfile: createBaselineProfile()
      })
    ).toThrow("demandEstimate.scopeHint.integrations_count is required for demand driver");
  });

  it("rejects formula overflow instead of returning infinite planned work", () => {
    const overflowingProfile = createDemandTemplateProfile({
      ...createBaselineProfile(),
      roleRules: [
        {
          stageKey: "delivery",
          stageLabel: "Поставка",
          roleKey: "solution_architect",
          roleLabel: "Архитектор решения",
          baseWorkHours: Number.MAX_VALUE,
          scopeHintDrivers: [{ scopeHintKey: "modules_count", hoursPerUnit: Number.MAX_VALUE }],
          confidence: 0.82,
          sortOrder: 10,
          assumptions: []
        }
      ]
    });

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId,
        opportunityId,
        templateMatch: {
          tenantId,
          opportunityId,
          matched: true,
          template: {
            id: "process-template-integrations",
            key: "implementation.integration_heavy",
            label: "Внедрение с интеграциями",
            version: 2
          },
          confidence: 0.9,
          assumptions: []
        },
        scopeHints: createScopeHints(),
        demandProfile: overflowingProfile
      })
    ).toThrow("demandEstimate.formulaResult must be finite");
  });

  it("rejects template-match provenance from another tenant or opportunity", () => {
    const baseMatch = {
      matched: true,
      template: {
        id: "process-template-integrations",
        key: "implementation.integration_heavy",
        label: "Внедрение с интеграциями",
        version: 2
      },
      confidence: 0.9,
      assumptions: []
    };

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId: "tenant-a",
        opportunityId: "opportunity-acme-portal",
        templateMatch: {
          ...baseMatch,
          tenantId: "tenant-b",
          opportunityId: "opportunity-acme-portal"
        },
        scopeHints: createScopeHints(),
        demandProfile: createBaselineProfile()
      })
    ).toThrow("Template match tenant mismatch");

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId: "tenant-a",
        opportunityId: "opportunity-acme-portal",
        templateMatch: {
          ...baseMatch,
          tenantId: "tenant-a",
          opportunityId: "opportunity-other"
        },
        scopeHints: createScopeHints(),
        demandProfile: createBaselineProfile()
      })
    ).toThrow("Template match opportunity mismatch");
  });

  it("rejects scope hints from another tenant or opportunity", () => {
    const templateMatch = {
      tenantId,
      opportunityId,
      matched: true,
      template: {
        id: "process-template-integrations",
        key: "implementation.integration_heavy",
        label: "Внедрение с интеграциями",
        version: 2
      },
      confidence: 0.9,
      assumptions: []
    };

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId,
        opportunityId,
        templateMatch,
        scopeHints: createScopeHints({ tenantId: "tenant-b" }),
        demandProfile: createBaselineProfile()
      })
    ).toThrow("Scope hint tenant mismatch");

    expect(() =>
      estimateDemandFromTemplateMatch({
        tenantId,
        opportunityId,
        templateMatch,
        scopeHints: createScopeHints({ opportunityId: "opportunity-other" }),
        demandProfile: createBaselineProfile()
      })
    ).toThrow("Scope hint opportunity mismatch");
  });

  it("throws typed resource-planning errors for malformed demand profiles", () => {
    expect(() => estimateDemandFromTemplateMatch(null as never)).toThrow("demandEstimate must be an object");

    try {
      createDemandTemplateProfile({
        id: "",
        tenantId: "tenant-a",
        templateKey: "implementation.integration_heavy",
        templateVersion: 2,
        scenarioKey: "baseline",
        scenarioLabel: "Базовый сценарий",
        formula: {
          key: "phase3.template_scope_linear",
          version: 1,
          label: "Базовая оценка"
        },
        roleRules: [],
        updatedAt
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ResourcePlanningModelError);
      expect((error as ResourcePlanningModelError).code).toBe("validation_error");
    }

    expect(() => createDemandTemplateProfile(null as never)).toThrow("demandTemplateProfile must be an object");
  });
});
