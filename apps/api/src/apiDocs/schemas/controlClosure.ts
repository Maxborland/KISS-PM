import {
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  planDateOrNullSchema,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const controlClosureSchemas = openApiSchemaFragment({
  KpiDefinition: {
    type: "object",
    required: ["id", "tenantId", "entityType", "code", "label", "formula", "unit", "period", "thresholdRules", "ownerRole", "allowedActions", "version", "status"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      entityType: { type: "string", const: "project" },
      code: { type: "string", minLength: 1 },
      label: { type: "string", minLength: 1 },
      formula: schemaRef("AnyJsonObject"),
      unit: { type: "string", enum: ["days", "minutes", "percent", "count"] },
      period: { type: "string", enum: ["snapshot", "day", "week", "month"] },
      thresholdRules: { type: "array", items: schemaRef("AnyJsonObject") },
      ownerRole: nullableStringSchema,
      allowedActions: { type: "array", items: { type: "string" } },
      version: { type: "integer", minimum: 1 },
      status: { type: "string", enum: ["active", "archived"] }
    },
    additionalProperties: false
  },
  KpiDefinitionWriteRequest: {
    type: "object",
    required: ["code", "label", "formula", "thresholdRules"],
    properties: {
      id: stringIdSchema,
      code: { type: "string", minLength: 1 },
      label: { type: "string", minLength: 1 },
      formula: schemaRef("AnyJsonObject"),
      unit: { type: "string", enum: ["days", "minutes", "percent", "count"], default: "count" },
      period: { type: "string", enum: ["snapshot", "day", "week", "month"], default: "snapshot" },
      thresholdRules: { type: "array", items: schemaRef("AnyJsonObject") },
      ownerRole: nullableStringSchema,
      allowedActions: { type: "array", items: { type: "string" }, default: ["create_corrective_action"] },
      version: { type: "integer", minimum: 1, default: 1 },
      status: { type: "string", enum: ["active", "archived"], default: "active" }
    },
    additionalProperties: false
  },
  KpiDefinitionsResponse: {
    type: "object",
    required: ["definitions"],
    properties: { definitions: { type: "array", items: schemaRef("KpiDefinition") } },
    additionalProperties: false
  },
  KpiDefinitionResponse: {
    type: "object",
    required: ["definition", "auditEventId"],
    properties: {
      definition: schemaRef("KpiDefinition"),
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  KpiEvaluation: {
    type: "object",
    additionalProperties: true,
    description: "Persisted KPI evaluation DTO from the control engine."
  },
  ControlSignal: {
    type: "object",
    required: ["id", "tenantId", "projectId", "status"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      status: { type: "string", enum: ["open", "acknowledged", "resolved", "accepted_risk"] }
    },
    additionalProperties: true
  },
  CorrectiveAction: {
    type: "object",
    required: ["id", "tenantId", "projectId", "controlSignalId", "title", "description", "responsibleUserId", "dueDate", "status", "result"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      controlSignalId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      responsibleUserId: nullableStringSchema,
      dueDate: planDateOrNullSchema,
      status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
      result: nullableStringSchema
    },
    additionalProperties: false
  },
  ManagementActionCandidate: {
    type: "object",
    required: ["id", "type", "targetEntity", "input", "requiredPermissions"],
    properties: {
      id: stringIdSchema,
      type: { type: "string" },
      targetEntity: schemaRef("AnyJsonObject"),
      input: schemaRef("AnyJsonObject"),
      requiredPermissions: { type: "array", items: { type: "string" } },
      planDelta: schemaRef("PlanningPlanDelta")
    },
    additionalProperties: true
  },
  ActionExecution: {
    type: "object",
    additionalProperties: true,
    description: "Persisted management action execution record."
  },
  ControlReadModelResponse: {
    type: "object",
    required: ["definitions", "evaluations", "signals", "correctiveActions", "actionExecutions", "auditEvents"],
    properties: {
      definitions: { type: "array", items: schemaRef("KpiDefinition") },
      evaluations: { type: "array", items: schemaRef("KpiEvaluation") },
      signals: { type: "array", items: schemaRef("ControlSignal") },
      correctiveActions: { type: "array", items: schemaRef("CorrectiveAction") },
      actionExecutions: { type: "array", items: schemaRef("ActionExecution") },
      auditEvents: { type: "array", items: schemaRef("AnyJsonObject") }
    },
    additionalProperties: false
  },
  ControlEvaluateResponse: {
    type: "object",
    required: ["evaluations", "signals", "actionCandidates", "auditEventId"],
    properties: {
      evaluations: { type: "array", items: schemaRef("KpiEvaluation") },
      signals: { type: "array", items: schemaRef("ControlSignal") },
      actionCandidates: { type: "array", items: schemaRef("ManagementActionCandidate") },
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  ManagementActionPreviewResponse: {
    type: "object",
    required: ["action", "execution", "auditEventId"],
    properties: {
      action: schemaRef("ManagementActionCandidate"),
      execution: schemaRef("ActionExecution"),
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  ManagementActionApplyRequest: {
    type: "object",
    required: ["clientPlanVersion"],
    properties: {
      clientPlanVersion: { type: "integer", minimum: 1 }
    },
    additionalProperties: false
  },
  ManagementActionApplyResponse: {
    type: "object",
    required: ["action", "execution", "auditEventId"],
    properties: {
      action: schemaRef("ManagementActionCandidate"),
      execution: schemaRef("ActionExecution"),
      auditEventId: nullableStringSchema,
      readModel: schemaRef("PlanningReadModelResponse"),
      newPlanVersion: { type: "integer", minimum: 1 }
    },
    additionalProperties: true
  },
  ControlSignalStatusRequest: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["open", "acknowledged", "resolved", "accepted_risk"] },
      acceptedRiskReason: { type: "string", minLength: 1 }
    },
    additionalProperties: false
  },
  ControlSignalResponse: {
    type: "object",
    required: ["signal", "auditEventId"],
    properties: {
      signal: schemaRef("ControlSignal"),
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  CorrectiveActionCreateRequest: {
    type: "object",
    required: ["title"],
    properties: {
      id: stringIdSchema,
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      responsibleUserId: nullableStringSchema,
      dueDate: planDateOrNullSchema
    },
    additionalProperties: false
  },
  CorrectiveActionPatchRequest: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      responsibleUserId: nullableStringSchema,
      dueDate: planDateOrNullSchema,
      status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
      result: nullableStringSchema
    },
    additionalProperties: false
  },
  CorrectiveActionResponse: {
    type: "object",
    required: ["correctiveAction", "auditEventId"],
    properties: {
      correctiveAction: schemaRef("CorrectiveAction"),
      actionExecution: { oneOf: [schemaRef("ActionExecution"), { type: "null" }] },
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  ControlSurfaceDefinition: {
    type: "object",
    required: ["id", "tenantId", "code", "name", "dataSource", "entityType", "viewType", "fields", "filters", "groupings", "widgets", "severityRules", "drilldowns", "actions", "requiredPermissions", "savedViewPolicy", "auditPolicy"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      code: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      dataSource: { type: "string", minLength: 1 },
      entityType: { type: "string", minLength: 1 },
      viewType: { type: "string", minLength: 1 },
      fields: { type: "array", items: schemaRef("AnyJsonObject") },
      filters: { type: "array", items: schemaRef("AnyJsonObject") },
      groupings: { type: "array", items: schemaRef("AnyJsonObject") },
      widgets: { type: "array", items: schemaRef("AnyJsonObject") },
      severityRules: { type: "array", items: schemaRef("AnyJsonObject") },
      drilldowns: { type: "array", items: schemaRef("AnyJsonObject") },
      actions: { type: "array", items: schemaRef("AnyJsonObject") },
      requiredPermissions: { type: "array", items: { type: "string" } },
      savedViewPolicy: { type: "string", enum: ["none", "user", "tenant"] },
      auditPolicy: { type: "string", enum: ["publish_only", "all_mutations"] }
    },
    additionalProperties: true
  },
  ControlSurface: {
    type: "object",
    required: ["id", "tenantId", "code", "name", "description", "ownerUserId", "status", "currentVersion", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      code: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      ownerUserId: nullableStringSchema,
      status: { type: "string", enum: ["draft", "published", "archived"] },
      currentVersion: { type: "integer", minimum: 0 },
      draftVersion: { type: "integer", minimum: 0 },
      draftDefinition: schemaRef("ControlSurfaceDefinition"),
      publishedDefinition: { oneOf: [schemaRef("ControlSurfaceDefinition"), { type: "null" }] },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      publishedAt: { type: ["string", "null"], format: "date-time" },
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: true
  },
  ControlSurfaceValidation: {
    type: "object",
    required: ["canPublish", "issues"],
    properties: {
      canPublish: { type: "boolean" },
      issues: { type: "array", items: schemaRef("AnyJsonObject") }
    },
    additionalProperties: true
  },
  ControlSurfaceDraftSaveRequest: {
    type: "object",
    properties: {
      definition: schemaRef("ControlSurfaceDefinition"),
      ownerUserId: nullableStringSchema
    },
    additionalProperties: true
  },
  ControlSurfacePreviewRequest: {
    type: "object",
    properties: { definition: schemaRef("ControlSurfaceDefinition") },
    additionalProperties: true
  },
  ControlSurfaceRollbackRequest: {
    type: "object",
    required: ["version"],
    properties: { version: { type: "integer", minimum: 1 } },
    additionalProperties: false
  },
  ControlSurfacesResponse: {
    type: "object",
    required: ["surfaces"],
    properties: { surfaces: { type: "array", items: schemaRef("ControlSurface") } },
    additionalProperties: false
  },
  ControlSurfacePresetsResponse: {
    type: "object",
    required: ["presets"],
    properties: {
      presets: {
        type: "array",
        items: {
          type: "object",
          required: ["definition", "validation"],
          properties: {
            definition: schemaRef("ControlSurfaceDefinition"),
            validation: schemaRef("ControlSurfaceValidation")
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  ControlSurfaceDetailResponse: {
    type: "object",
    required: ["surface"],
    properties: {
      surface: schemaRef("ControlSurface"),
      versions: { type: "array", items: schemaRef("AnyJsonObject") }
    },
    additionalProperties: false
  },
  ControlSurfaceDraftSaveResponse: {
    type: "object",
    required: ["surface", "validation", "auditEventId"],
    properties: {
      surface: schemaRef("ControlSurface"),
      validation: schemaRef("ControlSurfaceValidation"),
      auditEventId: stringIdSchema
    },
    additionalProperties: false
  },
  ControlSurfacePreviewResponse: {
    type: "object",
    required: ["validation", "preview"],
    properties: {
      validation: schemaRef("ControlSurfaceValidation"),
      preview: schemaRef("AnyJsonObject")
    },
    additionalProperties: false
  },
  ControlSurfacePublishResponse: {
    type: "object",
    required: ["surface", "version", "auditEventId"],
    properties: {
      surface: schemaRef("ControlSurface"),
      version: schemaRef("AnyJsonObject"),
      validation: schemaRef("ControlSurfaceValidation"),
      auditEventId: stringIdSchema
    },
    additionalProperties: false
  },
  ControlSurfaceArchiveResponse: {
    type: "object",
    required: ["surface", "auditEventId"],
    properties: {
      surface: schemaRef("ControlSurface"),
      auditEventId: stringIdSchema
    },
    additionalProperties: false
  },
  ClosurePlanFactSummary: {
    type: "object",
    additionalProperties: true,
    description: "Plan/fact schedule, work and variance summary captured at project closure."
  },
  RetrospectiveLesson: {
    type: "object",
    required: ["id", "tenantId", "projectId", "snapshotId", "category", "title", "body", "impact", "createdByUserId", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      snapshotId: stringIdSchema,
      category: { type: "string", enum: ["schedule", "scope", "resource", "quality", "communication", "commercial", "process"] },
      title: { type: "string", minLength: 1 },
      body: { type: "string", minLength: 1 },
      impact: { type: "string", enum: ["positive", "negative", "neutral"] },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  RetrospectiveLessonCreateRequest: {
    type: "object",
    required: ["category", "title", "body"],
    properties: {
      category: { type: "string", enum: ["schedule", "scope", "resource", "quality", "communication", "commercial", "process"] },
      title: { type: "string", minLength: 1 },
      body: { type: "string", minLength: 1 },
      impact: { type: "string", enum: ["positive", "negative", "neutral"], default: "neutral" }
    },
    additionalProperties: false
  },
  TemplateImprovementAction: {
    type: "object",
    required: ["id", "tenantId", "projectId", "snapshotId", "templateId", "status", "title", "description", "impact", "createdByUserId", "appliedByUserId", "createdAt", "appliedAt", "auditEventId"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      snapshotId: stringIdSchema,
      templateId: stringIdSchema,
      status: { type: "string", enum: ["proposed", "applied", "rejected"] },
      title: { type: "string" },
      description: { type: "string" },
      impact: schemaRef("AnyJsonObject"),
      createdByUserId: stringIdSchema,
      appliedByUserId: nullableStringSchema,
      createdAt: dateTimeSchema,
      appliedAt: { type: ["string", "null"], format: "date-time" },
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  ClosureReadModelResponse: {
    type: "object",
    required: ["project", "snapshot", "lessons", "templateImprovementActions"],
    properties: {
      project: schemaRef("Project"),
      snapshot: { oneOf: [schemaRef("AnyJsonObject"), { type: "null" }] },
      lessons: { type: "array", items: schemaRef("RetrospectiveLesson") },
      templateImprovementActions: { type: "array", items: schemaRef("TemplateImprovementAction") }
    },
    additionalProperties: true
  },
  ClosurePreviewResponse: {
    type: "object",
    required: ["canClose", "projectStatus", "planFactSummary", "proposedTemplateImprovement"],
    properties: {
      canClose: { type: "boolean" },
      projectStatus: { type: "string" },
      planFactSummary: schemaRef("ClosurePlanFactSummary"),
      proposedTemplateImprovement: { oneOf: [schemaRef("TemplateImprovementAction"), { type: "null" }] }
    },
    additionalProperties: false
  },
  ClosureCloseRequest: {
    type: "object",
    required: ["closeReason"],
    properties: {
      closeReason: { type: "string", minLength: 1 },
      lessons: { type: "array", items: schemaRef("RetrospectiveLessonCreateRequest"), default: [] }
    },
    additionalProperties: false
  },
  ClosureCancelRequest: {
    type: "object",
    required: ["cancelReason"],
    properties: {
      cancelReason: { type: "string", minLength: 1 },
      lessons: { type: "array", items: schemaRef("RetrospectiveLessonCreateRequest"), default: [] }
    },
    additionalProperties: false
  },
  ClosureCloseResponse: {
    type: "object",
    required: ["projectId", "snapshot", "lessons", "templateImprovementActions", "auditEventId"],
    properties: {
      projectId: stringIdSchema,
      snapshot: schemaRef("AnyJsonObject"),
      lessons: { type: "array", items: schemaRef("RetrospectiveLesson") },
      templateImprovementActions: { type: "array", items: schemaRef("TemplateImprovementAction") },
      auditEventId: nullableStringSchema
    },
    additionalProperties: true
  },
  ClosureCancelResponse: {
    type: "object",
    required: ["projectId", "snapshot", "lessons", "templateImprovementActions", "auditEventId"],
    properties: {
      projectId: stringIdSchema,
      snapshot: schemaRef("AnyJsonObject"),
      lessons: { type: "array", items: schemaRef("RetrospectiveLesson") },
      templateImprovementActions: { type: "array", items: schemaRef("TemplateImprovementAction") },
      auditEventId: nullableStringSchema
    },
    additionalProperties: true
  },
  RetrospectiveLessonResponse: {
    type: "object",
    required: ["lesson", "auditEventId"],
    properties: {
      lesson: schemaRef("RetrospectiveLesson"),
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  TemplateImprovementActionResponse: {
    type: "object",
    required: ["action", "auditEventId"],
    properties: {
      action: schemaRef("TemplateImprovementAction"),
      auditEventId: nullableStringSchema
    },
    additionalProperties: false
  },
  RetrospectiveInsightsResponse: {
    type: "object",
    required: ["templateId", "appliedImprovements", "estimationLearning"],
    properties: {
      templateId: stringIdSchema,
      appliedImprovements: { type: "array", items: schemaRef("TemplateImprovementAction") },
      estimationLearning: schemaRef("AnyJsonObject")
    },
    additionalProperties: false
  }
});
