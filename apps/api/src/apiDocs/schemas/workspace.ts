import {
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const workspaceSchemas = openApiSchemaFragment({
  AuditEvent: {
    type: "object",
    required: ["id", "tenantId", "actorUserId", "actionType", "sourceEntity", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      actorUserId: nullableStringSchema,
      actionType: { type: "string", minLength: 1 },
      sourceWorkflow: nullableStringSchema,
      sourceEntity: schemaRef("AnyJsonObject"),
      commandInput: schemaRef("AnyJsonObject"),
      beforeState: { oneOf: [schemaRef("AnyJsonObject"), { type: "null" }] },
      afterState: { oneOf: [schemaRef("AnyJsonObject"), { type: "null" }] },
      permissionResult: schemaRef("AnyJsonObject"),
      executionResult: schemaRef("AnyJsonObject"),
      createdAt: dateTimeSchema
    },
    additionalProperties: true
  },
  AuditEventsResponse: {
    type: "object",
    required: ["events"],
    properties: { events: { type: "array", items: schemaRef("AuditEvent") } },
    additionalProperties: false
  },
  AuditLearningInput: {
    type: "object",
    required: ["id", "tenantId", "inputKind", "sourceWorkflow", "sourceEntity", "projectId", "severity", "status", "occurredAt", "deterministicReason", "evidence", "eligibleRuleFamilies"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      inputKind: { type: "string", enum: ["audit_attention", "operational_queue_item", "control_signal_outcome"] },
      sourceWorkflow: { type: "string", minLength: 1 },
      sourceEntity: schemaRef("AnyJsonObject"),
      projectId: { oneOf: [stringIdSchema, { type: "null" }] },
      severity: { type: "string", enum: ["critical", "warning", "info"] },
      status: { type: "string", minLength: 1 },
      occurredAt: dateTimeSchema,
      deterministicReason: { type: "string", minLength: 1 },
      evidence: schemaRef("AnyJsonObject"),
      eligibleRuleFamilies: {
        type: "array",
        items: { type: "string", enum: ["permission_policy", "planning_control", "resource_planning", "template_improvement", "project_lifecycle"] }
      }
    },
    additionalProperties: false
  },
  AuditLearningInputsResponse: {
    type: "object",
    required: ["items"],
    properties: { items: { type: "array", items: schemaRef("AuditLearningInput") } },
    additionalProperties: false
  },
  TenantOrgNode: {
    type: "object",
    required: ["id", "parentId", "track", "kind", "name", "order"],
    properties: {
      id: stringIdSchema,
      parentId: nullableStringSchema,
      track: { type: "string", enum: ["functional", "project"] },
      kind: { type: "string", enum: ["direction", "unit", "team", "position", "employee"] },
      name: { type: "string", minLength: 1 },
      order: { type: "integer", minimum: 0 },
      positionId: nullableStringSchema,
      userId: nullableStringSchema
    },
    additionalProperties: true
  },
  TenantOrgTrack: {
    type: "object",
    required: ["nodes"],
    properties: { nodes: { type: "array", items: schemaRef("TenantOrgNode") } },
    additionalProperties: true
  },
  TenantOrgStructure: {
    type: "object",
    required: ["functional", "project"],
    properties: {
      functional: schemaRef("TenantOrgTrack"),
      project: schemaRef("TenantOrgTrack")
    },
    additionalProperties: false
  },
  TenantOrgStructureResponse: {
    type: "object",
    required: ["orgStructure"],
    properties: { orgStructure: schemaRef("TenantOrgStructure") },
    additionalProperties: false
  },
  TenantOrgStructureReplaceRequest: {
    type: "object",
    required: ["functional", "project"],
    properties: {
      functional: schemaRef("TenantOrgTrack"),
      project: schemaRef("TenantOrgTrack")
    },
    additionalProperties: false
  },
  CustomField: {
    type: "object",
    required: ["id", "tenantId", "systemKey", "tenantLabel", "targetEntity", "fieldType", "required", "status"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      systemKey: { type: "string", minLength: 1 },
      tenantLabel: { type: "string", minLength: 1 },
      targetEntity: { type: "string", enum: ["project", "opportunity"] },
      fieldType: { type: "string", enum: ["text", "number", "date", "select", "multi_select", "boolean"] },
      required: { type: "boolean" },
      status: { type: "string", enum: ["draft", "active", "archived"] }
    },
    additionalProperties: false
  },
  CustomFieldWriteRequest: {
    type: "object",
    required: ["systemKey", "tenantLabel", "fieldType"],
    properties: {
      id: stringIdSchema,
      systemKey: { type: "string", minLength: 1 },
      tenantLabel: { type: "string", minLength: 1 },
      targetEntity: { type: "string", enum: ["project", "opportunity"], default: "project" },
      fieldType: { type: "string", enum: ["text", "number", "date", "select", "multi_select", "boolean"] },
      required: { type: "boolean", default: false },
      status: { type: "string", enum: ["draft", "active", "archived"], default: "draft" }
    },
    additionalProperties: false
  },
  CustomFieldsResponse: {
    type: "object",
    required: ["customFields"],
    properties: { customFields: { type: "array", items: schemaRef("CustomField") } },
    additionalProperties: false
  },
  CustomFieldResponse: {
    type: "object",
    required: ["customField"],
    properties: { customField: schemaRef("CustomField") },
    additionalProperties: false
  },
  ProjectTemplateConfig: {
    type: "object",
    required: ["id", "tenantId", "systemKey", "tenantLabel", "description", "status"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      systemKey: { type: "string", minLength: 1 },
      tenantLabel: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      status: { type: "string", enum: ["draft", "active", "archived"] }
    },
    additionalProperties: false
  },
  ProjectTemplateWriteRequest: {
    type: "object",
    required: ["systemKey", "tenantLabel"],
    properties: {
      id: stringIdSchema,
      systemKey: { type: "string", minLength: 1 },
      tenantLabel: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      status: { type: "string", enum: ["draft", "active", "archived"], default: "draft" }
    },
    additionalProperties: false
  },
  ProjectTemplatesResponse: {
    type: "object",
    required: ["projectTemplates"],
    properties: { projectTemplates: { type: "array", items: schemaRef("ProjectTemplateConfig") } },
    additionalProperties: false
  },
  ProjectTemplateResponse: {
    type: "object",
    required: ["projectTemplate"],
    properties: { projectTemplate: schemaRef("ProjectTemplateConfig") },
    additionalProperties: false
  }
});
