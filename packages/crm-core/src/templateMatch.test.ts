import { createProjectProcessTemplateDraft } from "@kiss-pm/project-core";
import { describe, expect, it } from "vitest";

import {
  createOpportunity,
  createOpportunityStage,
  CrmCoreModelError,
  matchOpportunityToProcessTemplate
} from "./index";

function createReadyOpportunity() {
  const stage = createOpportunityStage({
    id: "stage-analysis",
    tenantId: "tenant-a",
    systemKey: "analysis",
    label: "Анализ",
    sortOrder: 20,
    active: true
  });

  return createOpportunity({
    id: "opportunity-acme-portal",
    tenantId: "tenant-a",
    title: "Портал управления проектами",
    stage,
    contacts: [],
    plannedStartDate: "2026-07-01",
    desiredFinishDate: "2026-12-15",
    expectedValue: {
      amount: 12_500_000,
      currency: "RUB"
    },
    probability: 0.65,
    categoryKey: "implementation",
    typologyKey: "fixed_scope",
    scopeHints: [
      { key: "integrations_count", label: "Количество интеграций", value: 3 },
      { key: "modules_count", label: "Количество модулей", value: 5 }
    ],
    createdAt: "2026-05-14T00:00:00.000Z"
  });
}

describe("opportunity process template matching", () => {
  it("matches a qualified opportunity to the best deterministic process template draft", () => {
    const genericTemplate = createProjectProcessTemplateDraft({
      id: "process-template-generic-implementation",
      tenantId: "tenant-a",
      key: "implementation.generic",
      label: "Типовое внедрение",
      categoryKeys: ["implementation"],
      typologyKeys: ["fixed_scope"],
      requiredScopeHintKeys: [],
      optionalScopeHintKeys: ["modules_count"],
      baseConfidence: 0.55,
      priority: 20,
      active: true,
      version: 1,
      assumptions: [{ code: "generic_delivery", message: "Используется типовой шаблон внедрения." }],
      updatedAt: "2026-05-14T19:20:00+07:00"
    });
    const scopedTemplate = createProjectProcessTemplateDraft({
      id: "process-template-integrations",
      tenantId: "tenant-a",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      categoryKeys: ["implementation"],
      typologyKeys: ["fixed_scope"],
      requiredScopeHintKeys: ["integrations_count"],
      optionalScopeHintKeys: ["modules_count"],
      baseConfidence: 0.6,
      priority: 10,
      active: true,
      version: 2,
      assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }],
      updatedAt: "2026-05-14T19:21:00+07:00"
    });

    const result = matchOpportunityToProcessTemplate({
      opportunity: createReadyOpportunity(),
      templates: [genericTemplate, scopedTemplate]
    });

    expect(result).toEqual({
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
      assumptions: [
        {
          code: "integration_delivery",
          message: "Учтены интеграционные работы."
        },
        {
          code: "required_scope_hints_matched",
          message: "Обязательные признаки объема работ совпали: integrations_count."
        },
        {
          code: "optional_scope_hints_matched",
          message: "Дополнительные признаки объема работ совпали: modules_count."
        }
      ],
      blockers: [],
      trace: [
        "process_template_match:candidates:2",
        "process_template_match:selected:implementation.integration_heavy",
        "process_template_match:confidence:0.9"
      ]
    });
  });

  it("returns a safe missing-template blocker when no active template matches", () => {
    const result = matchOpportunityToProcessTemplate({
      opportunity: createReadyOpportunity(),
      templates: [
        createProjectProcessTemplateDraft({
          id: "process-template-consulting",
          tenantId: "tenant-a",
          key: "consulting.discovery",
          label: "Предпроектное обследование",
          categoryKeys: ["consulting"],
          typologyKeys: ["discovery"],
          requiredScopeHintKeys: [],
          optionalScopeHintKeys: [],
          baseConfidence: 0.5,
          priority: 1,
          active: true,
          version: 1,
          assumptions: [],
          updatedAt: "2026-05-14T19:22:00+07:00"
        })
      ]
    });

    expect(result.matched).toBe(false);
    expect(result.template).toBeUndefined();
    expect(result.confidence).toBe(0);
    expect(result.assumptions).toEqual([]);
    expect(result.blockers).toEqual([
      {
        code: "process_template_missing",
        severity: "blocking",
        message: "Подберите процессный шаблон для категории и типологии возможности.",
        fieldRefs: ["categoryKey", "typologyKey", "scopeHints"]
      }
    ]);
    expect(result.trace).toEqual(["process_template_match:candidates:0", "process_template_match:missing"]);
  });

  it("rejects cross-tenant template pools without leaking foreign template details", () => {
    expect(() =>
      matchOpportunityToProcessTemplate({
        opportunity: createReadyOpportunity(),
        templates: [
          createProjectProcessTemplateDraft({
            id: "process-template-tenant-b-private",
            tenantId: "tenant-b",
            key: "implementation.fixed_scope",
            label: "Private Tenant B template",
            categoryKeys: ["implementation"],
            typologyKeys: ["fixed_scope"],
            requiredScopeHintKeys: [],
            optionalScopeHintKeys: [],
            baseConfidence: 0.5,
            priority: 1,
            active: true,
            version: 1,
            assumptions: [],
            updatedAt: "2026-05-14T19:23:00+07:00"
          })
        ]
      })
    ).toThrow(CrmCoreModelError);

    try {
      matchOpportunityToProcessTemplate({
        opportunity: createReadyOpportunity(),
        templates: [
          createProjectProcessTemplateDraft({
            id: "process-template-tenant-b-private",
            tenantId: "tenant-b",
            key: "implementation.fixed_scope",
            label: "Private Tenant B template",
            categoryKeys: ["implementation"],
            typologyKeys: ["fixed_scope"],
            requiredScopeHintKeys: [],
            optionalScopeHintKeys: [],
            baseConfidence: 0.5,
            priority: 1,
            active: true,
            version: 1,
            assumptions: [],
            updatedAt: "2026-05-14T19:23:00+07:00"
          })
        ]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CrmCoreModelError);
      expect((error as CrmCoreModelError).code).toBe("tenant_mismatch");
      expect((error as CrmCoreModelError).message).not.toContain("Private Tenant B template");
    }
  });

  it("rejects malformed template refs without TypeError crashes", () => {
    expect(() =>
      matchOpportunityToProcessTemplate({
        opportunity: createReadyOpportunity(),
        templates: [
          {
            id: "process-template-malformed",
            tenantId: "tenant-a",
            key: "implementation.fixed_scope",
            label: "Malformed",
            categoryKeys: undefined,
            typologyKeys: ["fixed_scope"],
            requiredScopeHintKeys: [],
            optionalScopeHintKeys: [],
            baseConfidence: 0.5,
            priority: 1,
            active: true,
            version: 1,
            assumptions: [],
            updatedAt: "2026-05-14T19:24:00+07:00"
          } as never
        ]
      })
    ).toThrow("templateMatch.template.categoryKeys must be an array");

    expect(() =>
      matchOpportunityToProcessTemplate({
        opportunity: {
          ...createReadyOpportunity(),
          scopeHints: undefined
        } as never,
        templates: []
      })
    ).toThrow("templateMatch.opportunity.scopeHints must be an array");
  });

  it("rejects malformed template key sets that would make confidence ambiguous", () => {
    expect(() =>
      matchOpportunityToProcessTemplate({
        opportunity: createReadyOpportunity(),
        templates: [
          {
            id: "process-template-duplicate-scope",
            tenantId: "tenant-a",
            key: "implementation.duplicate_scope",
            label: "Duplicate scope",
            categoryKeys: ["implementation"],
            typologyKeys: ["fixed_scope"],
            requiredScopeHintKeys: ["integrations_count"],
            optionalScopeHintKeys: ["integrations_count"],
            baseConfidence: 0.5,
            priority: 1,
            active: true,
            version: 1,
            assumptions: [],
            updatedAt: "2026-05-14T19:25:00+07:00"
          }
        ]
      })
    ).toThrow("templateMatch.template scope hint keys must be unique");

    expect(() =>
      matchOpportunityToProcessTemplate({
        opportunity: createReadyOpportunity(),
        templates: [
          {
            id: "process-template-duplicate-category",
            tenantId: "tenant-a",
            key: "implementation.duplicate_category",
            label: "Duplicate category",
            categoryKeys: ["implementation", "implementation"],
            typologyKeys: ["fixed_scope"],
            requiredScopeHintKeys: [],
            optionalScopeHintKeys: [],
            baseConfidence: 0.5,
            priority: 1,
            active: true,
            version: 1,
            assumptions: [],
            updatedAt: "2026-05-14T19:25:00+07:00"
          }
        ]
      })
    ).toThrow("templateMatch.template category keys must be unique");
  });
});
