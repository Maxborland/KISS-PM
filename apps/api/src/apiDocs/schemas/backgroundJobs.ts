import {
  backgroundJobEventTypeSchema,
  backgroundJobKindSchema,
  backgroundJobStatusSchema,
  dateSchema,
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const backgroundJobSchemas = openApiSchemaFragment({
  ScheduledTask: {
    type: "object",
    required: ["id", "title", "projectId", "projectTitle", "plannedStart", "plannedFinish", "workMinutes", "createdAt", "statusId"],
    properties: {
      id: stringIdSchema,
      title: { type: "string", minLength: 1 },
      projectId: stringIdSchema,
      projectTitle: { type: "string", minLength: 1 },
      plannedStart: dateSchema,
      plannedFinish: dateSchema,
      workMinutes: { type: "integer", minimum: 0 },
      createdAt: dateTimeSchema,
      statusId: stringIdSchema
    },
    additionalProperties: false
  },
  ScheduledTasksResponse: {
    type: "object",
    required: ["tasks"],
    properties: { tasks: { type: "array", items: schemaRef("ScheduledTask") } },
    additionalProperties: false
  },
  BackgroundJobKind: backgroundJobKindSchema,
  BackgroundJobStatus: backgroundJobStatusSchema,
  BackgroundJobRun: {
    type: "object",
    required: ["id", "tenantId", "kind", "status", "payload", "idempotencyKey", "priority", "attempt", "maxAttempts", "runAfter", "lockedAt", "startedAt", "finishedAt", "lastError", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      kind: schemaRef("BackgroundJobKind"),
      status: schemaRef("BackgroundJobStatus"),
      payload: schemaRef("AnyJsonObject"),
      idempotencyKey: nullableStringSchema,
      priority: { type: "integer", minimum: 0, maximum: 100 },
      attempt: { type: "integer", minimum: 0 },
      maxAttempts: { type: "integer", minimum: 1, maximum: 20 },
      runAfter: dateTimeSchema,
      lockedAt: { type: ["string", "null"], format: "date-time" },
      startedAt: { type: ["string", "null"], format: "date-time" },
      finishedAt: { type: ["string", "null"], format: "date-time" },
      lastError: nullableStringSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  BackgroundJobEvent: {
    type: "object",
    required: ["id", "tenantId", "jobId", "eventType", "message", "metadata", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      jobId: stringIdSchema,
      eventType: backgroundJobEventTypeSchema,
      message: { type: "string" },
      metadata: schemaRef("AnyJsonObject"),
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  BackgroundJobEnqueueRequest: {
    type: "object",
    required: ["kind"],
    properties: {
      kind: schemaRef("BackgroundJobKind"),
      payload: schemaRef("AnyJsonObject"),
      idempotencyKey: nullableStringSchema,
      priority: { type: "integer", minimum: 0, maximum: 100 },
      maxAttempts: { type: "integer", minimum: 1, maximum: 20 }
    },
    additionalProperties: false
  },
  BackgroundJobRunsResponse: {
    type: "object",
    required: ["runs"],
    properties: { runs: { type: "array", items: schemaRef("BackgroundJobRun") } },
    additionalProperties: false
  },
  BackgroundJobRunResponse: {
    type: "object",
    required: ["run"],
    properties: { run: schemaRef("BackgroundJobRun") },
    additionalProperties: false
  },
  BackgroundJobEventsResponse: {
    type: "object",
    required: ["events"],
    properties: { events: { type: "array", items: schemaRef("BackgroundJobEvent") } },
    additionalProperties: false
  }
});
