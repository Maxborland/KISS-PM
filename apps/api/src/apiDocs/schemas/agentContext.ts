import {
  dateTimeSchema,
  nullableStringSchema,
  planDateOrNullSchema,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const agentContextSchemas = {
  ProjectAgentContextResponse: {
    type: "object",
    required: ["snapshot"],
    properties: {
      snapshot: schemaRef("ProjectAgentContextSnapshot")
    },
    additionalProperties: false
  },
  ProjectAgentContextSnapshot: {
    type: "object",
    required: [
      "schemaVersion",
      "kind",
      "deterministic",
      "route",
      "actor",
      "safety",
      "project",
      "tasks",
      "planning",
      "control"
    ],
    properties: {
      schemaVersion: { type: "integer", const: 1 },
      kind: { type: "string", const: "project_agent_context_snapshot" },
      deterministic: { type: "boolean", const: true },
      route: schemaRef("ProjectAgentContextRouteIdentity"),
      actor: schemaRef("ProjectAgentContextActorSummary"),
      safety: schemaRef("ProjectAgentContextSafety"),
      project: schemaRef("ProjectAgentContextProjectSummary"),
      tasks: schemaRef("ProjectAgentContextTaskFacts"),
      planning: schemaRef("ProjectAgentContextPlanningFacts"),
      control: schemaRef("ProjectAgentContextControlFacts")
    },
    additionalProperties: false
  },
  ProjectAgentContextRouteIdentity: {
    type: "object",
    required: ["path", "method", "entityType", "entityId", "tenantId"],
    properties: {
      path: { type: "string", const: "/api/workspace/projects/:projectId/agent-context" },
      method: { type: "string", const: "GET" },
      entityType: { type: "string", const: "Project" },
      entityId: stringIdSchema,
      tenantId: stringIdSchema
    },
    additionalProperties: false
  },
  ProjectAgentContextActorSummary: {
    type: "object",
    required: ["id", "tenantId", "name", "accessProfileId", "accessProfile"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string" },
      accessProfileId: stringIdSchema,
      accessProfile: {
        type: "object",
        required: ["id", "grantedPermissions"],
        properties: {
          id: stringIdSchema,
          grantedPermissions: { type: "array", items: { type: "string" } }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  ProjectAgentContextSafety: {
    type: "object",
    required: ["readOnly", "noDirectMutation", "directMutationAllowed"],
    properties: {
      readOnly: { type: "boolean", const: true },
      noDirectMutation: { type: "boolean", const: true },
      directMutationAllowed: { type: "boolean", const: false }
    },
    additionalProperties: false
  },
  ProjectAgentContextProjectSummary: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "title",
      "clientName",
      "status",
      "sourceType",
      "sourceOpportunityId",
      "plannedStart",
      "plannedFinish",
      "contractValue",
      "plannedHours",
      "activatedAt",
      "closedAt"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      title: { type: "string" },
      clientName: { type: "string" },
      status: { $ref: "#/components/schemas/ProjectStatus" },
      sourceType: { type: "string" },
      sourceOpportunityId: nullableStringSchema,
      plannedStart: { type: "string", format: "date" },
      plannedFinish: { type: "string", format: "date" },
      contractValue: { type: "number" },
      plannedHours: { type: "number" },
      activatedAt: { type: ["string", "null"], format: "date-time" },
      closedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  ProjectAgentContextTaskFacts: {
    type: "object",
    required: ["total", "items"],
    properties: {
      total: { type: "integer", minimum: 0 },
      items: { type: "array", items: schemaRef("ProjectAgentContextTaskSummary") }
    },
    additionalProperties: false
  },
  ProjectAgentContextTaskSummary: {
    type: "object",
    required: [
      "id",
      "title",
      "status",
      "statusId",
      "statusName",
      "statusCategory",
      "priority",
      "plannedStart",
      "plannedFinish",
      "plannedWork",
      "actualWork",
      "progress",
      "ownerUserId"
    ],
    properties: {
      id: stringIdSchema,
      title: { type: "string" },
      status: { type: "string" },
      statusId: stringIdSchema,
      statusName: { type: "string" },
      statusCategory: { type: "string" },
      priority: { type: "string" },
      plannedStart: { type: "string", format: "date" },
      plannedFinish: { type: "string", format: "date" },
      plannedWork: { type: "number" },
      actualWork: { type: "number" },
      progress: { type: "number" },
      ownerUserId: stringIdSchema
    },
    additionalProperties: false
  },
  ProjectAgentContextPlanningFacts: {
    type: "object",
    required: [
      "available",
      "planVersion",
      "capturedAt",
      "taskCount",
      "assignmentCount",
      "dependencyCount",
      "resourceCount",
      "baselineCount",
      "validationIssueCount"
    ],
    properties: {
      available: { type: "boolean" },
      planVersion: { type: ["integer", "null"], minimum: 1 },
      capturedAt: { oneOf: [dateTimeSchema, { type: "null" }] },
      taskCount: { type: "integer", minimum: 0 },
      assignmentCount: { type: "integer", minimum: 0 },
      dependencyCount: { type: "integer", minimum: 0 },
      resourceCount: { type: "integer", minimum: 0 },
      baselineCount: { type: "integer", minimum: 0 },
      validationIssueCount: { type: "integer", minimum: 0 }
    },
    additionalProperties: false
  },
  ProjectAgentContextControlFacts: {
    type: "object",
    required: ["attentionItems", "allowedActionIdentifiers"],
    properties: {
      attentionItems: { type: "array", items: schemaRef("ProjectAgentContextAttentionItem") },
      allowedActionIdentifiers: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
  },
  ProjectAgentContextAttentionItem: {
    type: "object",
    required: [
      "id",
      "severity",
      "status",
      "sourceEntity",
      "sourceMetric",
      "explanation",
      "ownerUserId",
      "updatedAt",
      "allowedActions"
    ],
    properties: {
      id: stringIdSchema,
      severity: { type: "string", enum: ["warning", "critical"] },
      status: { type: "string", enum: ["open", "acknowledged"] },
      sourceEntity: schemaRef("AnyJsonObject"),
      sourceMetric: { type: "string" },
      explanation: { type: "string" },
      ownerUserId: nullableStringSchema,
      updatedAt: dateTimeSchema,
      dueDate: planDateOrNullSchema,
      allowedActions: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
  }
};
