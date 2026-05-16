import { describe, expect, it } from "vitest";

import {
  listProjectCustomFieldValues,
  setProjectCustomFieldValue
} from "./index";
import type { CustomFieldDefinitionSnapshot, ManagedProject } from "./index";

function project(): ManagedProject {
  return {
    id: "project-alpha",
    tenantId: "tenant-a",
    title: "ERP внедрение",
    lifecycleStatus: "active",
    currentStageId: null,
    sourceDraftId: "draft-alpha",
    sourceOpportunity: {
      type: "crm_opportunity",
      opportunityId: "opportunity-alpha",
      tenantId: "tenant-a",
      title: "ERP внедрение",
      accountId: "account-a",
      contactIds: ["contact-a"],
      plannedStartDate: "2026-08-01",
      desiredFinishDate: "2026-09-01"
    },
    processTemplateSnapshot: {
      templateId: "template-a",
      tenantId: "tenant-a",
      key: "implementation",
      label: "Внедрение",
      active: true,
      version: 1,
      updatedAt: "2026-08-01T00:00:00.000Z",
      stageTemplates: []
    },
    stages: [],
    stageHistory: [],
    tasks: [],
    taskParticipants: [],
    taskComments: [],
    taskStatusHistory: [],
    artifacts: [],
    approvalRequests: [],
    customFieldValues: [],
    createdBy: "tenant-admin-a",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    correlationId: "corr-project-alpha"
  };
}

function definition(overrides: Partial<CustomFieldDefinitionSnapshot> = {}): CustomFieldDefinitionSnapshot {
  return {
    id: "cf-project-risk-level",
    tenantId: "tenant-a",
    targetEntityType: "project",
    key: "risk_level",
    label: "Уровень риска",
    valueType: "single_select",
    required: false,
    active: true,
    version: 1,
    validationRules: { options: ["low", "medium", "high"] },
    permissionRules: { readPermissionKey: "project.read", writePermissionKey: "custom_field.write" },
    bindingFlags: {
      usableInFilters: true,
      usableInControlSurfaces: true,
      usableInKpiSourceBindings: false
    },
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

describe("project custom field values", () => {
  it("sets a typed project custom field value with definition version trace and no source mutation", () => {
    const source = project();

    const result = setProjectCustomFieldValue(source, {
      definition: definition(),
      value: "high",
      actorId: "project-manager-a",
      occurredAt: "2026-08-01T00:05:00.000Z",
      correlationId: "corr-custom-field",
      auditEventId: "audit-custom-field-value"
    });

    expect(result.valueRecord).toMatchObject({
      projectId: "project-alpha",
      definitionId: "cf-project-risk-level",
      fieldKey: "risk_level",
      definitionVersion: 1,
      value: "high",
      updatedBy: "project-manager-a",
      auditEventId: "audit-custom-field-value"
    });
    expect(listProjectCustomFieldValues(result.project)).toEqual([result.valueRecord]);
    expect(source.customFieldValues).toEqual([]);
  });

  it("updates an existing value without duplicating the field key", () => {
    const first = setProjectCustomFieldValue(project(), {
      definition: definition(),
      value: "medium",
      actorId: "project-manager-a",
      occurredAt: "2026-08-01T00:05:00.000Z",
      correlationId: "corr-custom-field-1"
    });
    const second = setProjectCustomFieldValue(first.project, {
      definition: definition({ version: 2 }),
      value: "low",
      actorId: "project-manager-a",
      occurredAt: "2026-08-01T00:06:00.000Z",
      correlationId: "corr-custom-field-2"
    });

    expect(listProjectCustomFieldValues(second.project)).toHaveLength(1);
    expect(second.valueRecord).toMatchObject({ value: "low", definitionVersion: 2 });
  });

  it("rejects cross-tenant, inactive, non-project, and invalid option values", () => {
    expect(() =>
      setProjectCustomFieldValue(project(), {
        definition: definition({ tenantId: "tenant-b" }),
        value: "high",
        actorId: "project-manager-a",
        occurredAt: "2026-08-01T00:05:00.000Z",
        correlationId: "corr-custom-field"
      })
    ).toThrow("project custom field tenant mismatch");

    expect(() =>
      setProjectCustomFieldValue(project(), {
        definition: definition({ active: false }),
        value: "high",
        actorId: "project-manager-a",
        occurredAt: "2026-08-01T00:05:00.000Z",
        correlationId: "corr-custom-field"
      })
    ).toThrow("project custom field definition must be active");

    expect(() =>
      setProjectCustomFieldValue(project(), {
        definition: definition({ targetEntityType: "task" }),
        value: "high",
        actorId: "project-manager-a",
        occurredAt: "2026-08-01T00:05:00.000Z",
        correlationId: "corr-custom-field"
      })
    ).toThrow("project custom field definition must target project");

    expect(() =>
      setProjectCustomFieldValue(project(), {
        definition: definition(),
        value: "urgent",
        actorId: "project-manager-a",
        occurredAt: "2026-08-01T00:05:00.000Z",
        correlationId: "corr-custom-field"
      })
    ).toThrow("project custom field value is not an allowed option: urgent");
  });

  it("rejects malformed custom field snapshots before value validation", () => {
    expect(() =>
      setProjectCustomFieldValue(project(), {
        definition: { ...definition(), valueType: "score" as CustomFieldDefinitionSnapshot["valueType"] },
        value: "high",
        actorId: "project-manager-a",
        occurredAt: "2026-08-01T00:05:00.000Z",
        correlationId: "corr-invalid-value-type"
      })
    ).toThrow("customFieldDefinition.valueType is invalid");
  });
});
