import { describe, expect, it } from "vitest";

import {
  createCustomFieldDefinition,
  createOpportunityCategoryDefinition,
  createOpportunityIntakeMetadataRegistry,
  createOpportunityIntakeTemplate,
  createOpportunityTypologyDefinition,
  resolveOpportunityIntakeRequirements
} from "./index";

const updatedAt = "2026-05-14T19:10:00+07:00";

function createOpportunityPriorityField() {
  return createCustomFieldDefinition({
    id: "cf-opportunity-priority",
    tenantId: "tenant-a",
    targetEntityType: "opportunity",
    key: "priority_level",
    label: "Приоритет возможности",
    valueType: "single_select",
    required: true,
    active: true,
    version: 1,
    validationRules: {
      options: ["low", "medium", "high"]
    },
    bindingFlags: {
      usableInFilters: true,
      usableInControlSurfaces: true,
      usableInKpiSourceBindings: false
    },
    updatedAt
  });
}

describe("opportunity intake metadata configuration", () => {
  it("resolves category, typology, and required intake fields from tenant configuration", () => {
    const category = createOpportunityCategoryDefinition({
      id: "category-implementation",
      tenantId: "tenant-a",
      key: "implementation",
      label: "Внедрение",
      active: true,
      sortOrder: 1
    });
    const typology = createOpportunityTypologyDefinition({
      id: "typology-fixed-scope",
      tenantId: "tenant-a",
      key: "fixed_scope",
      label: "Фиксированный объем",
      active: true,
      sortOrder: 1
    });
    const priorityField = createOpportunityPriorityField();
    const template = createOpportunityIntakeTemplate({
      id: "intake-implementation-fixed-scope",
      tenantId: "tenant-a",
      key: "implementation.fixed_scope",
      label: "Внедрение с фиксированным объемом",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      requiredStandardFieldKeys: ["account_contact_intent", "planned_dates", "scope_hints"],
      requiredCustomFieldKeys: ["priority_level"],
      active: true,
      version: 1,
      updatedAt
    });

    const registry = createOpportunityIntakeMetadataRegistry({
      tenantId: "tenant-a",
      version: 1,
      categories: [category],
      typologies: [typology],
      customFields: [priorityField],
      templates: [template],
      updatedAt
    });
    const requirements = resolveOpportunityIntakeRequirements(registry, {
      categoryKey: "implementation",
      typologyKey: "fixed_scope"
    });

    expect(requirements).toEqual({
      tenantId: "tenant-a",
      registryVersion: 1,
      templateKey: "implementation.fixed_scope",
      templateLabel: "Внедрение с фиксированным объемом",
      category: {
        key: "implementation",
        label: "Внедрение"
      },
      typology: {
        key: "fixed_scope",
        label: "Фиксированный объем"
      },
      requiredStandardFieldKeys: ["account_contact_intent", "planned_dates", "scope_hints"],
      requiredCustomFields: [
        {
          definitionId: "cf-opportunity-priority",
          key: "priority_level",
          label: "Приоритет возможности",
          valueType: "single_select"
        }
      ],
      trace: [
        "opportunity_intake_metadata:registry:1",
        "opportunity_intake_metadata:template:implementation.fixed_scope"
      ]
    });
  });

  it("rejects tenant labels as category and typology keys", () => {
    expect(() =>
      createOpportunityCategoryDefinition({
        id: "category-label-key",
        tenantId: "tenant-a",
        key: "Внедрение",
        label: "Внедрение",
        active: true,
        sortOrder: 1
      })
    ).toThrow("opportunityCategory.key must be a stable system key");

    expect(() =>
      createOpportunityTypologyDefinition({
        id: "typology-label-key",
        tenantId: "tenant-a",
        key: "Фиксированный объем",
        label: "Фиксированный объем",
        active: true,
        sortOrder: 1
      })
    ).toThrow("opportunityTypology.key must be a stable system key");
  });

  it("rejects duplicate metadata keys, cross-tenant entries, and non-opportunity custom fields", () => {
    const category = createOpportunityCategoryDefinition({
      id: "category-implementation",
      tenantId: "tenant-a",
      key: "implementation",
      label: "Внедрение",
      active: true,
      sortOrder: 1
    });
    const typology = createOpportunityTypologyDefinition({
      id: "typology-fixed-scope",
      tenantId: "tenant-a",
      key: "fixed_scope",
      label: "Фиксированный объем",
      active: true,
      sortOrder: 1
    });
    const priorityField = createOpportunityPriorityField();
    const template = createOpportunityIntakeTemplate({
      id: "intake-implementation-fixed-scope",
      tenantId: "tenant-a",
      key: "implementation.fixed_scope",
      label: "Внедрение с фиксированным объемом",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      requiredStandardFieldKeys: ["planned_dates"],
      requiredCustomFieldKeys: ["priority_level"],
      active: true,
      version: 1,
      updatedAt
    });

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [category, { ...category, id: "category-implementation-copy", label: "Дубль" }],
        typologies: [typology],
        customFields: [priorityField],
        templates: [template],
        updatedAt
      })
    ).toThrow("Duplicate opportunity category key: implementation");

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [{ ...category, tenantId: "tenant-b" }],
        typologies: [typology],
        customFields: [priorityField],
        templates: [template],
        updatedAt
      })
    ).toThrow("Opportunity category tenant mismatch: category-implementation");

    const projectField = createCustomFieldDefinition({
      ...priorityField,
      id: "cf-project-priority",
      targetEntityType: "project"
    });
    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [category],
        typologies: [typology],
        customFields: [projectField],
        templates: [template],
        updatedAt
      })
    ).toThrow("Opportunity intake custom field must target opportunity: cf-project-priority");
  });

  it("rejects templates that reference unknown metadata or inactive custom fields", () => {
    const category = createOpportunityCategoryDefinition({
      id: "category-implementation",
      tenantId: "tenant-a",
      key: "implementation",
      label: "Внедрение",
      active: true,
      sortOrder: 1
    });
    const typology = createOpportunityTypologyDefinition({
      id: "typology-fixed-scope",
      tenantId: "tenant-a",
      key: "fixed_scope",
      label: "Фиксированный объем",
      active: true,
      sortOrder: 1
    });
    const inactivePriorityField = createCustomFieldDefinition({
      ...createOpportunityPriorityField(),
      active: false
    });

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [category],
        typologies: [typology],
        customFields: [inactivePriorityField],
        templates: [
          createOpportunityIntakeTemplate({
            id: "intake-implementation-fixed-scope",
            tenantId: "tenant-a",
            key: "implementation.fixed_scope",
            label: "Внедрение с фиксированным объемом",
            categoryKey: "implementation",
            typologyKey: "fixed_scope",
            requiredStandardFieldKeys: ["planned_dates"],
            requiredCustomFieldKeys: ["priority_level"],
            active: true,
            version: 1,
            updatedAt
          })
        ],
        updatedAt
      })
    ).toThrow("Opportunity intake template requires inactive custom field: priority_level");

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [category],
        typologies: [typology],
        customFields: [createOpportunityPriorityField()],
        templates: [
          createOpportunityIntakeTemplate({
            id: "intake-unknown-category",
            tenantId: "tenant-a",
            key: "unknown.fixed_scope",
            label: "Неизвестная категория",
            categoryKey: "unknown",
            typologyKey: "fixed_scope",
            requiredStandardFieldKeys: ["planned_dates"],
            requiredCustomFieldKeys: [],
            active: true,
            version: 1,
            updatedAt
          })
        ],
        updatedAt
      })
    ).toThrow("Opportunity intake template references unknown category: unknown");
  });

  it("rejects ambiguous active templates and active templates for inactive category or typology", () => {
    const activeCategory = createOpportunityCategoryDefinition({
      id: "category-implementation",
      tenantId: "tenant-a",
      key: "implementation",
      label: "Внедрение",
      active: true,
      sortOrder: 1
    });
    const inactiveCategory = createOpportunityCategoryDefinition({
      ...activeCategory,
      id: "category-support",
      key: "support",
      label: "Поддержка",
      active: false,
      sortOrder: 2
    });
    const activeTypology = createOpportunityTypologyDefinition({
      id: "typology-fixed-scope",
      tenantId: "tenant-a",
      key: "fixed_scope",
      label: "Фиксированный объем",
      active: true,
      sortOrder: 1
    });
    const inactiveTypology = createOpportunityTypologyDefinition({
      ...activeTypology,
      id: "typology-research",
      key: "research",
      label: "Исследование",
      active: false,
      sortOrder: 2
    });
    const template = createOpportunityIntakeTemplate({
      id: "intake-implementation-fixed-scope",
      tenantId: "tenant-a",
      key: "implementation.fixed_scope",
      label: "Внедрение с фиксированным объемом",
      categoryKey: "implementation",
      typologyKey: "fixed_scope",
      requiredStandardFieldKeys: ["planned_dates"],
      requiredCustomFieldKeys: [],
      active: true,
      version: 1,
      updatedAt
    });

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [activeCategory],
        typologies: [activeTypology],
        customFields: [],
        templates: [
          template,
          {
            ...template,
            id: "intake-implementation-fixed-scope-copy",
            key: "implementation.fixed_scope.copy",
            label: "Дублирующий шаблон"
          }
        ],
        updatedAt
      })
    ).toThrow("Duplicate active opportunity intake template for implementation/fixed_scope");

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [activeCategory, inactiveCategory],
        typologies: [activeTypology],
        customFields: [],
        templates: [
          {
            ...template,
            id: "intake-support-fixed-scope",
            key: "support.fixed_scope",
            categoryKey: "support"
          }
        ],
        updatedAt
      })
    ).toThrow("Opportunity intake template references inactive category: support");

    expect(() =>
      createOpportunityIntakeMetadataRegistry({
        tenantId: "tenant-a",
        version: 1,
        categories: [activeCategory],
        typologies: [activeTypology, inactiveTypology],
        customFields: [],
        templates: [
          {
            ...template,
            id: "intake-implementation-research",
            key: "implementation.research",
            typologyKey: "research"
          }
        ],
        updatedAt
      })
    ).toThrow("Opportunity intake template references inactive typology: research");
  });
});
