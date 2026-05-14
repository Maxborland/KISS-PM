import { describe, expect, it } from "vitest";

import {
  TenantConfigModelError,
  createCustomFieldDefinition,
  createCustomFieldRegistry,
  updateCustomFieldDefinitionMetadata
} from "./index";

describe("custom field registry", () => {
  it("creates a tenant-owned versioned custom field definition with metadata-only rules and binding flags", () => {
    const definition = createCustomFieldDefinition({
      id: "cf-project-risk-level",
      tenantId: "tenant-a",
      targetEntityType: "project",
      key: "risk_level",
      label: "Уровень риска",
      valueType: "single_select",
      required: true,
      active: true,
      version: 2,
      validationRules: {
        options: ["low", "medium", "high"]
      },
      visibilityRules: [{ surfaceKey: "project_control", visible: true }],
      permissionRules: {
        readPermissionKey: "project.read",
        writePermissionKey: "project.write"
      },
      bindingFlags: {
        usableInFilters: true,
        usableInControlSurfaces: true,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:50:00+07:00"
    });

    expect(definition).toEqual({
      id: "cf-project-risk-level",
      tenantId: "tenant-a",
      targetEntityType: "project",
      key: "risk_level",
      label: "Уровень риска",
      valueType: "single_select",
      required: true,
      active: true,
      version: 2,
      validationRules: {
        options: ["low", "medium", "high"]
      },
      visibilityRules: [{ surfaceKey: "project_control", visible: true }],
      permissionRules: {
        readPermissionKey: "project.read",
        writePermissionKey: "project.write"
      },
      bindingFlags: {
        usableInFilters: true,
        usableInControlSurfaces: true,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:50:00+07:00"
    });
  });

  it("creates a registry and rejects duplicate keys for the same tenant target entity type", () => {
    const projectRisk = createCustomFieldDefinition({
      id: "cf-project-risk-level",
      tenantId: "tenant-a",
      targetEntityType: "project",
      key: "risk_level",
      label: "Уровень риска",
      valueType: "single_select",
      required: false,
      active: true,
      version: 1,
      bindingFlags: {
        usableInFilters: true,
        usableInControlSurfaces: true,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:51:00+07:00"
    });
    const taskRisk = createCustomFieldDefinition({
      ...projectRisk,
      id: "cf-task-risk-level",
      targetEntityType: "task"
    });

    expect(
      createCustomFieldRegistry({
        tenantId: "tenant-a",
        version: 1,
        definitions: [projectRisk, taskRisk],
        updatedAt: "2026-05-14T13:51:00+07:00"
      }).definitions.map((definition) => `${definition.targetEntityType}:${definition.key}`)
    ).toEqual(["project:risk_level", "task:risk_level"]);

    expect(() =>
      createCustomFieldRegistry({
        tenantId: "tenant-a",
        version: 1,
        definitions: [
          projectRisk,
          {
            ...projectRisk,
            id: "cf-project-risk-level-copy",
            label: "Дублирующий риск"
          }
        ],
        updatedAt: "2026-05-14T13:51:00+07:00"
      })
    ).toThrow("Duplicate custom field key for project: risk_level");
  });

  it("rejects invalid target entity types, value types, versions, and cross-tenant definitions", () => {
    expect(() =>
      createCustomFieldDefinition({
        id: "cf-invalid-target",
        tenantId: "tenant-a",
        targetEntityType: "deal" as never,
        key: "risk_level",
        label: "Уровень риска",
        valueType: "text",
        required: false,
        active: true,
        version: 1,
        bindingFlags: {
          usableInFilters: false,
          usableInControlSurfaces: false,
          usableInKpiSourceBindings: false
        },
        updatedAt: "2026-05-14T13:52:00+07:00"
      })
    ).toThrow("Unsupported custom field target entity type: deal");

    expect(() =>
      createCustomFieldDefinition({
        id: "cf-invalid-value",
        tenantId: "tenant-a",
        targetEntityType: "project",
        key: "risk_level",
        label: "Уровень риска",
        valueType: "json" as never,
        required: false,
        active: true,
        version: 1,
        bindingFlags: {
          usableInFilters: false,
          usableInControlSurfaces: false,
          usableInKpiSourceBindings: false
        },
        updatedAt: "2026-05-14T13:52:00+07:00"
      })
    ).toThrow("Unsupported custom field value type: json");

    const definition = createCustomFieldDefinition({
      id: "cf-project-risk-level",
      tenantId: "tenant-a",
      targetEntityType: "project",
      key: "risk_level",
      label: "Уровень риска",
      valueType: "text",
      required: false,
      active: true,
      version: 1,
      bindingFlags: {
        usableInFilters: false,
        usableInControlSurfaces: false,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:52:00+07:00"
    });

    expect(() =>
      createCustomFieldRegistry({
        tenantId: "tenant-a",
        version: 1,
        definitions: [{ ...definition, tenantId: "tenant-b" }],
        updatedAt: "2026-05-14T13:52:00+07:00"
      })
    ).toThrow("Custom field definition tenant mismatch: cf-project-risk-level");

    expect(() =>
      createCustomFieldRegistry({
        tenantId: "tenant-a",
        version: 0,
        definitions: [definition],
        updatedAt: "2026-05-14T13:52:00+07:00"
      })
    ).toThrow("customFieldRegistry.version must be a positive integer");

    expect(() =>
      createCustomFieldDefinition({
        id: "cf-mixed-options",
        tenantId: "tenant-a",
        targetEntityType: "project",
        key: "mixed_options",
        label: "Смешанные опции",
        valueType: "single_select",
        required: false,
        active: true,
        version: 1,
        validationRules: { options: ["low", 2] as never },
        bindingFlags: {
          usableInFilters: false,
          usableInControlSurfaces: false,
          usableInKpiSourceBindings: false
        },
        updatedAt: "2026-05-14T13:52:00+07:00"
      })
    ).toThrow("customField.validationRuleValue array must not mix value types");

    expect(() =>
      createCustomFieldRegistry({
        tenantId: "tenant-a",
        version: 1,
        definitions: [
          {
            ...definition,
            id: "cf-raw-object-metadata",
            key: "raw_object_metadata",
            validationRules: { options: { source: "runtime" } as never }
          }
        ],
        updatedAt: "2026-05-14T13:52:00+07:00"
      })
    ).toThrow("customField.validationRuleValue must be a scalar or homogeneous array");
  });

  it("updates metadata with optimistic version handling without changing storage semantics", () => {
    const definition = createCustomFieldDefinition({
      id: "cf-project-budget-code",
      tenantId: "tenant-a",
      targetEntityType: "project",
      key: "budget_code",
      label: "Код бюджета",
      valueType: "text",
      required: false,
      active: true,
      version: 3,
      validationRules: { maxLength: 24 },
      bindingFlags: {
        usableInFilters: true,
        usableInControlSurfaces: false,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:53:00+07:00"
    });

    const result = updateCustomFieldDefinitionMetadata(definition, {
      expectedVersion: 3,
      label: "Бюджетный код",
      required: true,
      active: false,
      validationRules: { maxLength: 32 },
      visibilityRules: [{ surfaceKey: "portfolio_control", visible: true }],
      permissionRules: { readPermissionKey: "project.read" },
      bindingFlags: {
        usableInFilters: true,
        usableInControlSurfaces: true,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:54:00+07:00"
    });

    expect(result.previousVersion).toBe(3);
    expect(result.definition).toMatchObject({
      id: "cf-project-budget-code",
      targetEntityType: "project",
      key: "budget_code",
      label: "Бюджетный код",
      valueType: "text",
      required: true,
      active: false,
      version: 4,
      validationRules: { maxLength: 32 },
      visibilityRules: [{ surfaceKey: "portfolio_control", visible: true }],
      permissionRules: { readPermissionKey: "project.read" },
      bindingFlags: {
        usableInFilters: true,
        usableInControlSurfaces: true,
        usableInKpiSourceBindings: false
      },
      updatedAt: "2026-05-14T13:54:00+07:00"
    });
    expect(definition.version).toBe(3);
    expect(definition.label).toBe("Код бюджета");
    expect(() =>
      updateCustomFieldDefinitionMetadata(definition, {
        expectedVersion: 2,
        label: "Старый код",
        updatedAt: "2026-05-14T13:54:00+07:00"
      })
    ).toThrow("Custom field definition version conflict: expected 2, current 3");
  });

  it("throws typed tenant-config errors for custom field failures", () => {
    try {
      createCustomFieldDefinition({
        id: "",
        tenantId: "tenant-a",
        targetEntityType: "project",
        key: "risk_level",
        label: "Уровень риска",
        valueType: "text",
        required: false,
        active: true,
        version: 1,
        bindingFlags: {
          usableInFilters: false,
          usableInControlSurfaces: false,
          usableInKpiSourceBindings: false
        },
        updatedAt: "2026-05-14T13:55:00+07:00"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TenantConfigModelError);
      expect((error as TenantConfigModelError).code).toBe("validation_error");
    }
  });
});
