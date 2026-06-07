import {
  crmStatusSchema,
  dateSchema,
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  schemaRef,
  stringIdSchema,
  taskParticipantRoleSchema,
  taskPrioritySchema,
  taskStatusCategorySchema
} from "./schemaPrimitives";

export const crmProjectSchemas = openApiSchemaFragment({
  Client: {
    type: "object",
    required: ["id", "tenantId", "name", "description", "status", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      description: nullableStringSchema,
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  ClientWriteRequest: {
    type: "object",
    required: ["name"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      description: nullableStringSchema,
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  ClientsResponse: {
    type: "object",
    required: ["clients"],
    properties: {
      clients: { type: "array", items: schemaRef("Client") }
    },
    additionalProperties: false
  },
  ClientResponse: {
    type: "object",
    required: ["client"],
    properties: {
      client: schemaRef("Client")
    },
    additionalProperties: false
  },
  Contact: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "clientId",
      "name",
      "email",
      "phone",
      "telegram",
      "role",
      "status",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      clientId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      email: { type: ["string", "null"], format: "email", maxLength: 254 },
      phone: nullableStringSchema,
      telegram: nullableStringSchema,
      role: nullableStringSchema,
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  ContactWriteRequest: {
    type: "object",
    required: ["clientId", "name"],
    properties: {
      id: stringIdSchema,
      clientId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      email: { type: ["string", "null"], format: "email", maxLength: 254 },
      phone: nullableStringSchema,
      telegram: nullableStringSchema,
      role: nullableStringSchema,
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  ContactsResponse: {
    type: "object",
    required: ["contacts"],
    properties: {
      contacts: { type: "array", items: schemaRef("Contact") }
    },
    additionalProperties: false
  },
  ContactResponse: {
    type: "object",
    required: ["contact"],
    properties: {
      contact: schemaRef("Contact")
    },
    additionalProperties: false
  },
  Product: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "name",
      "sku",
      "type",
      "unit",
      "price",
      "description",
      "status",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      sku: nullableStringSchema,
      type: { type: "string", enum: ["service", "goods"] },
      unit: { type: "string", minLength: 1, maxLength: 40 },
      price: { type: "integer", minimum: 1, maximum: 2147483647 },
      description: nullableStringSchema,
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  ProductWriteRequest: {
    type: "object",
    required: ["name", "unit", "price"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      sku: nullableStringSchema,
      type: { type: "string", enum: ["service", "goods"], default: "service" },
      unit: { type: "string", minLength: 1, maxLength: 40 },
      price: { type: "integer", minimum: 1, maximum: 2147483647 },
      description: nullableStringSchema,
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  ProductsResponse: {
    type: "object",
    required: ["products"],
    properties: {
      products: { type: "array", items: schemaRef("Product") }
    },
    additionalProperties: false
  },
  ProductResponse: {
    type: "object",
    required: ["product"],
    properties: {
      product: schemaRef("Product")
    },
    additionalProperties: false
  },
  ProjectType: {
    type: "object",
    required: ["id", "tenantId", "name", "description", "status", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      description: nullableStringSchema,
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  ProjectTypeWriteRequest: {
    type: "object",
    required: ["name"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      description: nullableStringSchema,
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  ProjectTypesResponse: {
    type: "object",
    required: ["projectTypes"],
    properties: {
      projectTypes: { type: "array", items: schemaRef("ProjectType") }
    },
    additionalProperties: false
  },
  ProjectTypeResponse: {
    type: "object",
    required: ["projectType"],
    properties: {
      projectType: schemaRef("ProjectType")
    },
    additionalProperties: false
  },
  DealStage: {
    type: "object",
    required: ["id", "tenantId", "name", "sortOrder", "status", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      sortOrder: { type: "integer", minimum: 1, maximum: 2147483647 },
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  DealStageWriteRequest: {
    type: "object",
    required: ["name", "sortOrder"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      sortOrder: { type: "integer", minimum: 1, maximum: 2147483647 },
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  DealStagesResponse: {
    type: "object",
    required: ["dealStages"],
    properties: {
      dealStages: { type: "array", items: schemaRef("DealStage") }
    },
    additionalProperties: false
  },
  DealStageResponse: {
    type: "object",
    required: ["dealStage"],
    properties: {
      dealStage: schemaRef("DealStage")
    },
    additionalProperties: false
  },
  CrmPipelineLifecycleGraphStage: {
    type: "object",
    required: ["stageId", "sortOrder", "lifecycleState", "isFinal"],
    properties: {
      stageId: stringIdSchema,
      sortOrder: { type: "integer", minimum: 1, maximum: 2147483647 },
      lifecycleState: { type: "string", enum: ["open", "won_closed", "lost_rejected"] },
      isFinal: { type: "boolean" }
    },
    additionalProperties: false
  },
  CrmPipelineLifecycleGraphTransition: {
    type: "object",
    required: ["ruleId", "fromStageId", "toStageId"],
    properties: {
      ruleId: stringIdSchema,
      fromStageId: stringIdSchema,
      toStageId: stringIdSchema
    },
    additionalProperties: false
  },
  CrmPipelineLifecycleGraph: {
    type: "object",
    required: ["pipelineId", "initialStageId", "finalStageIds", "stages", "transitions"],
    properties: {
      pipelineId: stringIdSchema,
      initialStageId: nullableStringSchema,
      finalStageIds: { type: "array", items: stringIdSchema },
      stages: { type: "array", items: schemaRef("CrmPipelineLifecycleGraphStage") },
      transitions: { type: "array", items: schemaRef("CrmPipelineLifecycleGraphTransition") }
    },
    additionalProperties: false
  },
  CrmPipeline: {
    type: "object",
    required: ["id", "tenantId", "name", "status", "lifecycleGraphMetadata", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      status: crmStatusSchema,
      lifecycleGraphMetadata: schemaRef("CrmPipelineLifecycleGraph"),
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CrmPipelineWriteRequest: {
    type: "object",
    required: ["name"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  CrmPipelinePatchRequest: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 160 },
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  CrmPipelinesResponse: {
    type: "object",
    required: ["pipelines"],
    properties: {
      pipelines: { type: "array", items: schemaRef("CrmPipeline") }
    },
    additionalProperties: false
  },
  CrmPipelineResponse: {
    type: "object",
    required: ["pipeline"],
    properties: {
      pipeline: schemaRef("CrmPipeline")
    },
    additionalProperties: false
  },
  CrmPipelineStage: {
    type: "object",
    required: ["id", "tenantId", "pipelineId", "name", "sortOrder", "status", "lifecycleState", "isFinal", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      pipelineId: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      sortOrder: { type: "integer", minimum: 1, maximum: 2147483647 },
      status: crmStatusSchema,
      lifecycleState: { type: "string", enum: ["open", "won_closed", "lost_rejected"] },
      isFinal: { type: "boolean" },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CrmPipelineStageWriteRequest: {
    type: "object",
    required: ["name", "sortOrder"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 1, maxLength: 160 },
      sortOrder: { type: "integer", minimum: 1, maximum: 2147483647 },
      status: crmStatusSchema,
      lifecycleState: { type: "string", enum: ["open", "won_closed", "lost_rejected"], default: "open" },
      isFinal: { type: "boolean", default: false }
    },
    additionalProperties: false
  },
  CrmPipelineStagePatchRequest: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 160 },
      sortOrder: { type: "integer", minimum: 1, maximum: 2147483647 },
      status: crmStatusSchema,
      lifecycleState: { type: "string", enum: ["open", "won_closed", "lost_rejected"] },
      isFinal: { type: "boolean" }
    },
    additionalProperties: false
  },
  CrmPipelineStagesResponse: {
    type: "object",
    required: ["stages"],
    properties: {
      stages: { type: "array", items: schemaRef("CrmPipelineStage") }
    },
    additionalProperties: false
  },
  CrmPipelineStageResponse: {
    type: "object",
    required: ["stage"],
    properties: {
      stage: schemaRef("CrmPipelineStage")
    },
    additionalProperties: false
  },
  CrmPipelineTransitionRule: {
    type: "object",
    required: ["id", "tenantId", "pipelineId", "fromStageId", "toStageId", "requiredPermission", "requiredFields", "requireReason", "status", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      pipelineId: stringIdSchema,
      fromStageId: stringIdSchema,
      toStageId: stringIdSchema,
      requiredPermission: nullableStringSchema,
      requiredFields: { type: "array", items: { type: "string" } },
      requireReason: { type: "boolean" },
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CrmPipelineTransitionRuleWriteRequest: {
    type: "object",
    required: ["fromStageId", "toStageId"],
    properties: {
      id: stringIdSchema,
      fromStageId: stringIdSchema,
      toStageId: stringIdSchema,
      requiredPermission: nullableStringSchema,
      requiredFields: { type: "array", items: { type: "string" }, default: [] },
      requireReason: { type: "boolean", default: false },
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  CrmPipelineTransitionRulePatchRequest: {
    type: "object",
    properties: {
      fromStageId: stringIdSchema,
      toStageId: stringIdSchema,
      requiredPermission: nullableStringSchema,
      requiredFields: { type: "array", items: { type: "string" } },
      requireReason: { type: "boolean" },
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  CrmPipelineTransitionRulesResponse: {
    type: "object",
    required: ["transitionRules"],
    properties: {
      transitionRules: { type: "array", items: schemaRef("CrmPipelineTransitionRule") }
    },
    additionalProperties: false
  },
  CrmPipelineTransitionRuleResponse: {
    type: "object",
    required: ["transitionRule"],
    properties: {
      transitionRule: schemaRef("CrmPipelineTransitionRule")
    },
    additionalProperties: false
  },
  CrmPipelineStageAutomationDefinition: {
    type: "object",
    required: ["id", "tenantId", "pipelineId", "stageId", "trigger", "actionType", "actionConfig", "status", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      pipelineId: stringIdSchema,
      stageId: stringIdSchema,
      trigger: { type: "string", enum: ["stage_entered", "stage_left"] },
      actionType: { type: "string", minLength: 1 },
      actionConfig: schemaRef("AnyJsonObject"),
      status: crmStatusSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CrmPipelineStageAutomationWriteRequest: {
    type: "object",
    required: ["stageId", "trigger", "actionType", "actionConfig"],
    properties: {
      id: stringIdSchema,
      stageId: stringIdSchema,
      trigger: { type: "string", enum: ["stage_entered", "stage_left"] },
      actionType: { type: "string", minLength: 1, maxLength: 120 },
      actionConfig: schemaRef("AnyJsonObject"),
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  CrmPipelineStageAutomationPatchRequest: {
    type: "object",
    properties: {
      stageId: stringIdSchema,
      trigger: { type: "string", enum: ["stage_entered", "stage_left"] },
      actionType: { type: "string", minLength: 1, maxLength: 120 },
      actionConfig: schemaRef("AnyJsonObject"),
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  CrmPipelineStageAutomationsResponse: {
    type: "object",
    required: ["automations"],
    properties: {
      automations: { type: "array", items: schemaRef("CrmPipelineStageAutomationDefinition") }
    },
    additionalProperties: false
  },
  CrmPipelineStageAutomationResponse: {
    type: "object",
    required: ["automation"],
    properties: {
      automation: schemaRef("CrmPipelineStageAutomationDefinition")
    },
    additionalProperties: false
  },
  PositionDemand: {
    type: "object",
    required: ["positionId", "requiredHours"],
    properties: {
      positionId: stringIdSchema,
      requiredHours: { type: "number", minimum: 0 }
    },
    additionalProperties: false
  },
  Opportunity: {
    type: "object",
    required: ["id", "tenantId", "title", "stageId", "status", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      clientId: nullableStringSchema,
      contactId: nullableStringSchema,
      productId: nullableStringSchema,
      projectTypeId: nullableStringSchema,
      stageId: stringIdSchema,
      crmPipelineId: { type: ["string", "null"], minLength: 1 },
      crmPipelineStageId: { type: ["string", "null"], minLength: 1 },
      crmPipelineStateUpdatedAt: { type: ["string", "null"], format: "date-time" },
      status: { type: "string", enum: ["open", "won", "lost", "cancelled"] },
      expectedStart: { type: ["string", "null"], format: "date-time" },
      expectedFinish: { type: ["string", "null"], format: "date-time" },
      budget: { type: ["number", "null"], minimum: 0 },
      plannedHours: { type: ["number", "null"], minimum: 0 },
      demand: { type: "array", items: schemaRef("PositionDemand") },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: true
  },
  OpportunityWriteRequest: {
    type: "object",
    required: ["title", "stageId"],
    properties: {
      id: stringIdSchema,
      title: { type: "string", minLength: 1 },
      description: nullableStringSchema,
      clientId: nullableStringSchema,
      contactId: nullableStringSchema,
      productId: nullableStringSchema,
      projectTypeId: nullableStringSchema,
      stageId: stringIdSchema,
      crmPipelineId: { type: ["string", "null"], minLength: 1 },
      crmPipelineStageId: { type: ["string", "null"], minLength: 1 },
      expectedStart: { type: ["string", "null"], format: "date-time" },
      expectedFinish: { type: ["string", "null"], format: "date-time" },
      budget: { type: ["number", "null"], minimum: 0 },
      plannedHours: { type: ["number", "null"], minimum: 0 },
      demand: { type: "array", items: schemaRef("PositionDemand") }
    },
    additionalProperties: false
  },
  OpportunitiesResponse: {
    type: "object",
    required: ["opportunities"],
    properties: { opportunities: { type: "array", items: schemaRef("Opportunity") } },
    additionalProperties: false
  },
  OpportunityResponse: {
    type: "object",
    required: ["opportunity"],
    properties: { opportunity: schemaRef("Opportunity") },
    additionalProperties: false
  },
  OpportunityPipelineTransitionRequest: {
    type: "object",
    required: ["targetStageId"],
    properties: {
      targetStageId: stringIdSchema,
      reason: nullableStringSchema
    },
    additionalProperties: false
  },
  CrmPipelineTransitionDecision: {
    type: "object",
    required: ["ok", "ruleId", "fromStageId", "toStageId"],
    properties: {
      ok: { type: "boolean", const: true },
      ruleId: stringIdSchema,
      fromStageId: stringIdSchema,
      toStageId: stringIdSchema
    },
    additionalProperties: false
  },
  OpportunityPipelineTransitionResponse: {
    type: "object",
    required: ["opportunity", "transition"],
    properties: {
      opportunity: schemaRef("Opportunity"),
      transition: schemaRef("CrmPipelineTransitionDecision")
    },
    additionalProperties: false
  },
  OpportunityStagePatchRequest: {
    type: "object",
    required: ["stageId"],
    properties: { stageId: stringIdSchema },
    additionalProperties: false
  },
  OpportunityFinalizeRequest: {
    type: "object",
    required: ["finalAction"],
    properties: {
      finalAction: { type: "string", enum: ["won", "lost", "cancelled"] },
      reason: nullableStringSchema
    },
    additionalProperties: false
  },
  OpportunityFeasibilityResponse: {
    type: "object",
    required: ["opportunity", "assessment"],
    properties: {
      opportunity: schemaRef("Opportunity"),
      assessment: schemaRef("AnyJsonObject")
    },
    additionalProperties: false
  },
  ProjectActivationRequest: {
    type: "object",
    properties: {
      id: stringIdSchema,
      acceptedRiskReason: { type: ["string", "null"], maxLength: 500 }
    },
    additionalProperties: false
  },
  ProjectActivationResponse: {
    type: "object",
    required: ["project"],
    properties: { project: schemaRef("Project") },
    additionalProperties: false
  },
  ProjectStatus: {
    type: "string",
    enum: ["draft", "active", "paused", "closed", "cancelled"]
  },
  ProjectStatusUpdateRequest: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["active", "paused", "closed", "cancelled"] }
    },
    additionalProperties: false
  },
  Project: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "sourceType",
      "sourceOpportunityId",
      "clientId",
      "projectTypeId",
      "title",
      "clientName",
      "status",
      "plannedStart",
      "plannedFinish",
      "contractValue",
      "plannedHours",
      "templateId",
      "createdAt",
      "activatedAt",
      "closedAt",
      "demand"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      sourceType: { type: "string", enum: ["opportunity", "workspace_inbox", "manual"] },
      sourceOpportunityId: nullableStringSchema,
      clientId: nullableStringSchema,
      projectTypeId: nullableStringSchema,
      title: { type: "string", minLength: 1 },
      clientName: { type: "string" },
      status: schemaRef("ProjectStatus"),
      plannedStart: dateTimeSchema,
      plannedFinish: dateTimeSchema,
      contractValue: { type: "number", minimum: 0 },
      plannedHours: { type: "number", minimum: 0 },
      templateId: nullableStringSchema,
      createdAt: dateTimeSchema,
      activatedAt: { type: ["string", "null"], format: "date-time" },
      closedAt: { type: ["string", "null"], format: "date-time" },
      demand: { type: "array", items: schemaRef("PositionDemand") }
    },
    additionalProperties: false
  },
  ProjectsResponse: {
    type: "object",
    required: ["projects"],
    properties: {
      projects: { type: "array", items: schemaRef("Project") }
    },
    additionalProperties: false
  },
  ProjectResponse: {
    type: "object",
    required: ["project"],
    properties: {
      project: schemaRef("Project")
    },
    additionalProperties: false
  },
  TaskParticipant: {
    type: "object",
    required: ["userId", "role"],
    properties: {
      userId: stringIdSchema,
      role: taskParticipantRoleSchema
    },
    additionalProperties: false
  },
  Task: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "projectId",
      "stageId",
      "title",
      "description",
      "status",
      "statusId",
      "statusName",
      "statusCategory",
      "priority",
      "requesterUserId",
      "ownerUserId",
      "plannedStart",
      "plannedFinish",
      "durationWorkingDays",
      "plannedWork",
      "actualWork",
      "progress",
      "requiresAcceptance",
      "source",
      "createdAt",
      "updatedAt",
      "archivedAt",
      "participants"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      stageId: nullableStringSchema,
      title: { type: "string", minLength: 3, maxLength: 160 },
      description: { type: ["string", "null"], maxLength: 4000 },
      status: taskStatusCategorySchema,
      statusId: stringIdSchema,
      statusName: { type: "string", minLength: 1 },
      statusCategory: taskStatusCategorySchema,
      priority: taskPrioritySchema,
      requesterUserId: stringIdSchema,
      ownerUserId: stringIdSchema,
      plannedStart: dateTimeSchema,
      plannedFinish: dateTimeSchema,
      durationWorkingDays: { type: "integer", minimum: 1, maximum: 1000 },
      plannedWork: { type: "integer", minimum: 1, maximum: 10000 },
      actualWork: { type: "integer", minimum: 0 },
      progress: { type: "integer", minimum: 0, maximum: 100 },
      requiresAcceptance: { type: "boolean" },
      source: { type: "string", enum: ["manual"] },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" },
      participants: { type: "array", items: schemaRef("TaskParticipant") }
    },
    additionalProperties: false
  },
  TaskCreateRequest: {
    type: "object",
    required: ["title", "plannedStart", "plannedFinish", "plannedWork", "participants"],
    properties: {
      id: stringIdSchema,
      title: { type: "string", minLength: 3, maxLength: 160 },
      description: { type: ["string", "null"], maxLength: 4000 },
      priority: taskPrioritySchema,
      statusId: stringIdSchema,
      plannedStart: dateSchema,
      plannedFinish: dateSchema,
      durationWorkingDays: { type: "integer", minimum: 1, maximum: 1000, default: 1 },
      plannedWork: { type: "integer", minimum: 1, maximum: 10000 },
      requiresAcceptance: { type: "boolean", default: false },
      participants: { type: "array", items: schemaRef("TaskParticipant"), minItems: 1 }
    },
    additionalProperties: false
  },
  TaskUpdateRequest: {
    type: "object",
    required: [
      "title",
      "plannedStart",
      "plannedFinish",
      "plannedWork",
      "participants",
      "statusId",
      "clientUpdatedAt"
    ],
    properties: {
      title: { type: "string", minLength: 3, maxLength: 160 },
      description: { type: ["string", "null"], maxLength: 4000 },
      priority: taskPrioritySchema,
      statusId: stringIdSchema,
      plannedStart: dateSchema,
      plannedFinish: dateSchema,
      durationWorkingDays: { type: "integer", minimum: 1, maximum: 1000, default: 1 },
      plannedWork: { type: "integer", minimum: 1, maximum: 10000 },
      requiresAcceptance: { type: "boolean", default: false },
      participants: { type: "array", items: schemaRef("TaskParticipant"), minItems: 1 },
      clientUpdatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  TaskStatusTransitionRequest: {
    type: "object",
    properties: {
      status: stringIdSchema,
      statusId: stringIdSchema
    },
    additionalProperties: false
  },
  TasksResponse: {
    type: "object",
    required: ["tasks"],
    properties: {
      tasks: { type: "array", items: schemaRef("Task") }
    },
    additionalProperties: false
  },
  TaskResponse: {
    type: "object",
    required: ["task"],
    properties: {
      task: schemaRef("Task")
    },
    additionalProperties: false
  },
  ProjectDetailResponse: {
    type: "object",
    required: ["project", "tasks"],
    properties: {
      project: schemaRef("Project"),
      tasks: { type: "array", items: schemaRef("Task") }
    },
    additionalProperties: false
  },
  TaskDetailResponse: {
    type: "object",
    required: ["task", "activities", "attachmentItems"],
    properties: {
      task: schemaRef("Task"),
      activities: { type: "array", items: schemaRef("TaskActivityItem") },
      attachmentItems: { type: "array", items: schemaRef("EntityAttachment") }
    },
    additionalProperties: false
  },
  TaskActivityItem: {
    type: "object",
    required: ["id", "tenantId", "taskId", "type", "body", "title", "fileUrl", "fileSizeBytes", "mimeType", "authorUserId", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      taskId: stringIdSchema,
      type: { type: "string", enum: ["comment", "file", "system"] },
      body: nullableStringSchema,
      title: nullableStringSchema,
      fileUrl: nullableStringSchema,
      fileSizeBytes: { type: ["integer", "null"], minimum: 0 },
      mimeType: nullableStringSchema,
      authorUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  TaskCommentCreateRequest: {
    type: "object",
    required: ["body"],
    properties: { body: { type: "string", minLength: 1 } },
    additionalProperties: false
  },
  TaskActivityResponse: {
    type: "object",
    required: ["activities", "attachmentItems"],
    properties: {
      activities: { type: "array", items: schemaRef("TaskActivityItem") },
      attachmentItems: { type: "array", items: schemaRef("EntityAttachment") }
    },
    additionalProperties: false
  },
  TaskActivityItemResponse: {
    type: "object",
    required: ["activity"],
    properties: { activity: schemaRef("TaskActivityItem") },
    additionalProperties: false
  },
  CrmActivityEntityType: {
    type: "string",
    enum: ["opportunity", "client", "contact", "product"]
  },
  CrmActivityItem: {
    type: "object",
    required: ["id", "tenantId", "entityType", "entityId", "type", "title", "body", "status", "dueDate", "assigneeUserId", "authorUserId", "fileUrl", "fileSizeBytes", "mimeType", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      entityType: schemaRef("CrmActivityEntityType"),
      entityId: stringIdSchema,
      type: { type: "string", enum: ["comment", "task", "file"] },
      title: nullableStringSchema,
      body: nullableStringSchema,
      status: { type: ["string", "null"], enum: ["todo", "done", null] },
      dueDate: { type: ["string", "null"], format: "date-time" },
      assigneeUserId: nullableStringSchema,
      authorUserId: stringIdSchema,
      fileUrl: nullableStringSchema,
      fileSizeBytes: { type: ["integer", "null"], minimum: 0 },
      mimeType: nullableStringSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  CrmCommentCreateRequest: {
    type: "object",
    required: ["body"],
    properties: { body: { type: "string", minLength: 1 } },
    additionalProperties: false
  },
  CrmTaskCreateRequest: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1 },
      body: nullableStringSchema,
      dueDate: { type: ["string", "null"], format: "date-time" },
      assigneeUserId: nullableStringSchema
    },
    additionalProperties: false
  },
  CrmFileActivityCreateRequest: {
    type: "object",
    required: ["title", "fileUrl"],
    properties: {
      title: { type: "string", minLength: 1 },
      body: nullableStringSchema,
      fileUrl: { type: "string", format: "uri" },
      fileSizeBytes: { type: ["integer", "null"], minimum: 0 },
      mimeType: nullableStringSchema
    },
    additionalProperties: false
  },
  CrmTaskStatusPatchRequest: {
    type: "object",
    required: ["status"],
    properties: { status: { type: "string", enum: ["todo", "done"] } },
    additionalProperties: false
  },
  CrmActivityFeedResponse: {
    type: "object",
    required: ["activities", "attachmentItems", "systemEvents", "canReadRawAudit", "auditEvents"],
    properties: {
      activities: { type: "array", items: schemaRef("CrmActivityItem") },
      attachmentItems: { type: "array", items: schemaRef("EntityAttachment") },
      systemEvents: { type: "array", items: schemaRef("AnyJsonObject") },
      canReadRawAudit: { type: "boolean" },
      auditEvents: { oneOf: [{ type: "array", items: schemaRef("AuditEvent") }, { type: "null" }] }
    },
    additionalProperties: false
  },
  CrmActivityItemResponse: {
    type: "object",
    required: ["activity"],
    properties: { activity: schemaRef("CrmActivityItem") },
    additionalProperties: false
  },
  TaskStatus: {
    type: "object",
    required: [
      "id",
      "tenantId",
      "name",
      "category",
      "sortOrder",
      "status",
      "isSystem",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      name: { type: "string", minLength: 2, maxLength: 80 },
      category: taskStatusCategorySchema,
      sortOrder: { type: "integer", minimum: 1, maximum: 10000 },
      status: crmStatusSchema,
      isSystem: { type: "boolean" },
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  TaskStatusWriteRequest: {
    type: "object",
    required: ["id", "name", "category", "sortOrder"],
    properties: {
      id: stringIdSchema,
      name: { type: "string", minLength: 2, maxLength: 80 },
      category: taskStatusCategorySchema,
      sortOrder: { type: "integer", minimum: 1, maximum: 10000 },
      status: crmStatusSchema
    },
    additionalProperties: false
  },
  TaskStatusesResponse: {
    type: "object",
    required: ["taskStatuses"],
    properties: {
      taskStatuses: { type: "array", items: schemaRef("TaskStatus") }
    },
    additionalProperties: false
  },
  TaskStatusResponse: {
    type: "object",
    required: ["taskStatus"],
    properties: {
      taskStatus: schemaRef("TaskStatus")
    },
    additionalProperties: false
  }
});
