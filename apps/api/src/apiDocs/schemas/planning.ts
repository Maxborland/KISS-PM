import {
  dateSchema,
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  planDateOrNullSchema,
  planningAssignmentRoleSchema,
  planningCommandTypeSchema,
  planningConstraintTypeSchema,
  planningDependencyTypeSchema,
  planningGranularitySchema,
  planningScenarioProfileSchema,
  planningSchedulingModeSchema,
  planningTaskTypeSchema,
  planningValidationSeveritySchema,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

const planningResourceLoadBucketRequired = [
  "resourceId",
  "positionId",
  "teamId",
  "projectId",
  "date",
  "granularity",
  "assignedMinutes",
  "reservedMinutes",
  "occupiedMinutes",
  "capacityMinutes",
  "freeMinutes",
  "taskIds",
  "assignmentIds",
  "assignmentContributions",
  "reservationContributions",
  "occupancyContributions",
  "reservationIds",
  "occupancyIds",
  "calendarExceptionIds"
];

const planningResourceLoadBucketProperties = {
  resourceId: stringIdSchema,
  positionId: nullableStringSchema,
  teamId: nullableStringSchema,
  projectId: stringIdSchema,
  date: dateSchema,
  granularity: planningGranularitySchema,
  assignedMinutes: { type: "integer", minimum: 0 },
  reservedMinutes: { type: "integer", minimum: 0 },
  occupiedMinutes: { type: "integer", minimum: 0 },
  capacityMinutes: { type: "integer", minimum: 0 },
  freeMinutes: { type: "integer" },
  taskIds: { type: "array", items: stringIdSchema },
  assignmentIds: { type: "array", items: stringIdSchema },
  assignmentContributions: { type: "array", items: schemaRef("AnyJsonObject") },
  reservationContributions: { type: "array", items: schemaRef("AnyJsonObject") },
  occupancyContributions: { type: "array", items: schemaRef("AnyJsonObject") },
  reservationIds: { type: "array", items: stringIdSchema },
  occupancyIds: { type: "array", items: stringIdSchema },
  calendarExceptionIds: { type: "array", items: stringIdSchema }
};

const planningPersistedIdPattern = "^[A-Za-z0-9._:-]+(?![\\s\\S])";

const planningPersistedIdSchema = {
  type: "string",
  minLength: 1,
  maxLength: 500,
  pattern: planningPersistedIdPattern
};

const planningNullablePersistedIdSchema = {
  type: ["string", "null"],
  minLength: 1,
  maxLength: 500,
  pattern: planningPersistedIdPattern
};

const gregorianPlanDatePattern =
  "(?:" +
  "\\d{4}-(?:" +
  "(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|" +
  "(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|" +
  "02-(?:0[1-9]|1\\d|2[0-8])" +
  ")|" +
  "(?:\\d{2}(?:0[48]|[2468][048]|[13579][26])|" +
  "(?:00|0[48]|[2468][048]|[13579][26])00)-02-29" +
  ")";

const acceptedOverloadIdSchema = {
  ...planningPersistedIdSchema,
  maxLength: 511,
  pattern: `^[A-Za-z0-9._:-]+:${gregorianPlanDatePattern}(?![\\s\\S])`
};

export const planningSchemas = openApiSchemaFragment({
  PlanningWorkingInstant: {
    type: "object",
    required: ["date", "minuteOfDay"],
    properties: {
      date: dateSchema,
      minuteOfDay: { type: "integer", minimum: 0, maximum: 1439 }
    },
    additionalProperties: false
  },
  PlanningProject: {
    type: "object",
    required: [
      "id",
      "sourceType",
      "sourceOpportunityId",
      "plannedStart",
      "plannedFinish",
      "deadline",
      "calendarId"
    ],
    properties: {
      id: stringIdSchema,
      sourceType: { type: "string", enum: ["opportunity", "workspace_inbox", "manual"] },
      sourceOpportunityId: nullableStringSchema,
      plannedStart: dateSchema,
      plannedFinish: dateSchema,
      deadline: planDateOrNullSchema,
      calendarId: nullableStringSchema
    },
    additionalProperties: false
  },
  PlanningConstraint: {
    type: "object",
    required: ["id", "taskId", "type", "date"],
    properties: {
      id: stringIdSchema,
      taskId: stringIdSchema,
      type: planningConstraintTypeSchema,
      date: planDateOrNullSchema
    },
    additionalProperties: false
  },
  PlanningTask: {
    type: "object",
    required: [
      "id",
      "parentTaskId",
      "wbsCode",
      "title",
      "statusId",
      "schedulingMode",
      "taskType",
      "effortDriven",
      "plannedStart",
      "plannedFinish",
      "durationMinutes",
      "workMinutes",
      "percentComplete",
      "calendarId",
      "constraint"
    ],
    properties: {
      id: stringIdSchema,
      parentTaskId: nullableStringSchema,
      wbsCode: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1, maxLength: 500 },
      statusId: stringIdSchema,
      schedulingMode: planningSchedulingModeSchema,
      taskType: planningTaskTypeSchema,
      effortDriven: { type: "boolean" },
      plannedStart: planDateOrNullSchema,
      plannedFinish: planDateOrNullSchema,
      plannedStartInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      plannedFinishInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      durationMinutes: { type: ["integer", "null"], minimum: 1 },
      workMinutes: { type: "integer", minimum: 0 },
      percentComplete: { type: "integer", minimum: 0, maximum: 100 },
      calendarId: nullableStringSchema,
      customFields: schemaRef("AnyJsonObject"),
      constraint: { oneOf: [schemaRef("PlanningConstraint"), { type: "null" }] }
    },
    additionalProperties: false
  },
  PlanningCalculatedTask: {
    type: "object",
    allOf: [schemaRef("PlanningTask")],
    properties: {
      calculatedStart: planDateOrNullSchema,
      calculatedFinish: planDateOrNullSchema,
      calculatedStartInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      calculatedFinishInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      earliestStart: planDateOrNullSchema,
      earliestFinish: planDateOrNullSchema,
      earliestStartInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      earliestFinishInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      latestStart: planDateOrNullSchema,
      latestFinish: planDateOrNullSchema,
      latestStartInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      latestFinishInstant: { oneOf: [schemaRef("PlanningWorkingInstant"), { type: "null" }] },
      totalSlackMinutes: { type: ["integer", "null"] },
      isCritical: { type: "boolean" }
    }
  },
  PlanningAssignment: {
    type: "object",
    required: ["id", "taskId", "resourceId", "role", "unitsPermille", "workMinutes", "calendarId"],
    properties: {
      id: stringIdSchema,
      taskId: stringIdSchema,
      resourceId: stringIdSchema,
      role: planningAssignmentRoleSchema,
      unitsPermille: { type: "integer", minimum: 1 },
      workMinutes: { type: ["integer", "null"], minimum: 0 },
      calendarId: nullableStringSchema
    },
    additionalProperties: false
  },
  PlanningAssignmentAllocation: {
    type: "object",
    required: ["assignmentId", "taskId", "resourceId", "date", "workMinutes"],
    properties: {
      assignmentId: stringIdSchema,
      taskId: stringIdSchema,
      resourceId: stringIdSchema,
      date: dateSchema,
      workMinutes: { type: "integer", minimum: 1 }
    },
    additionalProperties: false
  },
  PlanningDependency: {
    type: "object",
    required: ["id", "predecessorTaskId", "successorTaskId", "type", "lagMinutes"],
    properties: {
      id: stringIdSchema,
      predecessorTaskId: stringIdSchema,
      successorTaskId: stringIdSchema,
      type: planningDependencyTypeSchema,
      lagMinutes: { type: "integer" }
    },
    additionalProperties: false
  },
  PlanningCalculatedDependency: {
    type: "object",
    allOf: [schemaRef("PlanningDependency")],
    properties: {
      valid: { type: "boolean" },
      issueCodes: { type: "array", items: { type: "string" } }
    }
  },
  PlanningBaseline: {
    type: "object",
    required: ["id", "label", "capturedAt", "tasks"],
    properties: {
      id: stringIdSchema,
      label: { type: "string", minLength: 1 },
      capturedAt: dateTimeSchema,
      tasks: {
        type: "array",
        items: {
          type: "object",
          required: ["taskId", "plannedStart", "plannedFinish", "workMinutes"],
          properties: {
            taskId: stringIdSchema,
            plannedStart: planDateOrNullSchema,
            plannedFinish: planDateOrNullSchema,
            workMinutes: { type: "integer", minimum: 0 }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  PlanningValidationIssue: {
    type: "object",
    required: ["code", "severity", "message", "entity"],
    properties: {
      code: { type: "string", minLength: 1 },
      severity: planningValidationSeveritySchema,
      message: { type: "string", minLength: 1 },
      entity: {
        oneOf: [
          {
            type: "object",
            required: ["type", "id"],
            properties: {
              type: { type: "string", minLength: 1 },
              id: stringIdSchema
            },
            additionalProperties: false
          },
          { type: "null" }
        ]
      }
    },
    additionalProperties: false
  },
  PlanningPlanDelta: {
    type: "object",
    required: [
      "commands",
      "changedTaskIds",
      "changedAssignmentIds",
      "changedDependencyIds",
      "acceptedRiskIds"
    ],
    properties: {
      commands: { type: "array", items: schemaRef("PlanningCommand") },
      changedTaskIds: { type: "array", items: stringIdSchema },
      changedAssignmentIds: { type: "array", items: stringIdSchema },
      changedDependencyIds: { type: "array", items: stringIdSchema },
      acceptedRiskIds: { type: "array", items: stringIdSchema }
    },
    additionalProperties: false
  },
  PlanningCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: planningCommandTypeSchema,
      payload: {
        type: "object",
        additionalProperties: true,
        description:
          "Payload shape is selected by `type`; see PlanningCommand* schemas for canonical payloads."
      }
    },
    discriminator: { propertyName: "type" },
    oneOf: [
      schemaRef("PlanningTaskCreateCommand"),
      schemaRef("PlanningTaskUpdateIdentityCommand"),
      schemaRef("PlanningTaskUpdateScheduleCommand"),
      schemaRef("PlanningTaskUpdateWorkModelCommand"),
      schemaRef("PlanningTaskUpdateStatusCommand"),
      schemaRef("PlanningTaskUpdateProgressCommand"),
      schemaRef("PlanningTaskMoveWbsCommand"),
      schemaRef("PlanningTaskDeleteOrArchiveCommand"),
      schemaRef("PlanningDependencyUpsertCommand"),
      schemaRef("PlanningDependencyDeleteCommand"),
      schemaRef("PlanningAssignmentUpsertCommand"),
      schemaRef("PlanningAssignmentAllocationsReplaceCommand"),
      schemaRef("PlanningAssignmentDeleteCommand"),
      schemaRef("PlanningBaselineCaptureCommand"),
      schemaRef("PlanningCalendarExceptionUpsertCommand"),
      schemaRef("PlanningConstraintUpdateCommand"),
      schemaRef("PlanningResourceReserveCommand"),
      schemaRef("PlanningRiskAcceptOverloadCommand"),
      schemaRef("PlanningProjectDeadlineMoveCommand"),
      schemaRef("PlanningProjectSettingsUpdateCommand"),
      schemaRef("PlanningTaskUpdateCustomFieldCommand")
    ]
  },
  PlanningTaskCreateCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.create" },
      payload: {
        type: "object",
        required: ["id", "projectId", "title", "statusId", "plannedStart", "plannedFinish", "workMinutes", "assignments"],
        properties: {
          id: planningPersistedIdSchema,
          projectId: planningPersistedIdSchema,
          parentTaskId: planningNullablePersistedIdSchema,
          title: { type: "string", minLength: 1, maxLength: 500 },
          statusId: planningPersistedIdSchema,
          plannedStart: planDateOrNullSchema,
          plannedFinish: planDateOrNullSchema,
          durationMinutes: { type: ["integer", "null"], minimum: 1 },
          workMinutes: { type: "integer", minimum: 0 },
          assignments: { type: "array", items: schemaRef("PlanningCreateTaskAssignment"), minItems: 1 }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningCreateTaskAssignment: {
    type: "object",
    required: ["resourceId", "role", "unitsPermille", "workMinutes"],
    properties: {
      id: planningPersistedIdSchema,
      resourceId: planningPersistedIdSchema,
      role: planningAssignmentRoleSchema,
      unitsPermille: { type: "integer", minimum: 1 },
      workMinutes: { type: ["integer", "null"], minimum: 0 }
    },
    additionalProperties: false
  },
  PlanningTaskUpdateIdentityCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.update_identity" },
      payload: {
        type: "object",
        required: ["taskId", "title"],
        properties: { taskId: planningPersistedIdSchema, title: { type: "string", minLength: 1, maxLength: 500 } },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskUpdateScheduleCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.update_schedule" },
      payload: {
        type: "object",
        required: ["taskId", "plannedStart", "plannedFinish"],
        properties: { taskId: planningPersistedIdSchema, plannedStart: planDateOrNullSchema, plannedFinish: planDateOrNullSchema },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskUpdateWorkModelCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.update_work_model" },
      payload: {
        type: "object",
        required: ["taskId", "taskType", "effortDriven", "durationMinutes", "workMinutes"],
        properties: {
          taskId: planningPersistedIdSchema,
          taskType: planningTaskTypeSchema,
          effortDriven: { type: "boolean" },
          durationMinutes: { type: ["integer", "null"], minimum: 1 },
          workMinutes: { type: "integer", minimum: 0 }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskUpdateStatusCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.update_status" },
      payload: {
        type: "object",
        required: ["taskId", "statusId"],
        properties: { taskId: planningPersistedIdSchema, statusId: planningPersistedIdSchema },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskUpdateProgressCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.update_progress" },
      payload: {
        type: "object",
        required: ["taskId", "percentComplete"],
        properties: { taskId: planningPersistedIdSchema, percentComplete: { type: "integer", minimum: 0, maximum: 100 } },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskMoveWbsCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.move_wbs" },
      payload: {
        type: "object",
        required: ["taskId", "parentTaskId", "sortOrder"],
        properties: { taskId: planningPersistedIdSchema, parentTaskId: planningNullablePersistedIdSchema, sortOrder: { type: "integer", minimum: 0 } },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskDeleteOrArchiveCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.delete_or_archive" },
      payload: {
        type: "object",
        required: ["taskId", "mode"],
        properties: { taskId: planningPersistedIdSchema, mode: { type: "string", enum: ["archive", "delete"] } },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningDependencyUpsertCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "dependency.upsert" },
      payload: {
        type: "object",
        required: ["id", "predecessorTaskId", "successorTaskId", "dependencyType", "lagMinutes"],
        properties: {
          id: planningPersistedIdSchema,
          predecessorTaskId: planningPersistedIdSchema,
          successorTaskId: planningPersistedIdSchema,
          dependencyType: planningDependencyTypeSchema,
          lagMinutes: { type: "integer" }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningDependencyDeleteCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "dependency.delete" },
      payload: {
        type: "object",
        required: ["dependencyId"],
        properties: { dependencyId: planningPersistedIdSchema },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningAssignmentUpsertCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "assignment.upsert" },
      payload: {
        type: "object",
        required: ["id", "taskId", "resourceId", "role", "unitsPermille", "workMinutes"],
        properties: {
          id: planningPersistedIdSchema,
          taskId: planningPersistedIdSchema,
          resourceId: planningPersistedIdSchema,
          role: planningAssignmentRoleSchema,
          unitsPermille: { type: "integer", minimum: 1 },
          workMinutes: { type: ["integer", "null"], minimum: 0 }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningAssignmentAllocationsReplaceCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "assignment.allocations.replace" },
      payload: {
        type: "object",
        required: ["assignmentId", "allocations"],
        properties: {
          assignmentId: planningPersistedIdSchema,
          allocations: {
            type: "array",
            items: {
              type: "object",
              required: ["date", "workMinutes"],
              properties: {
                date: dateSchema,
                workMinutes: { type: "integer", minimum: 1 }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningAssignmentDeleteCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "assignment.delete" },
      payload: {
        type: "object",
        required: ["assignmentId"],
        properties: { assignmentId: planningPersistedIdSchema },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningBaselineCaptureCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "baseline.capture" },
      payload: {
        type: "object",
        required: ["baselineId", "label"],
        properties: { baselineId: planningPersistedIdSchema, label: { type: "string", minLength: 1, maxLength: 500 } },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningCalendarExceptionUpsertCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "calendar.exception.upsert" },
      payload: {
        type: "object",
        required: ["id", "calendarId", "resourceId", "date", "workingMinutes", "reason"],
        properties: {
          id: planningPersistedIdSchema,
          calendarId: planningPersistedIdSchema,
          resourceId: planningNullablePersistedIdSchema,
          date: dateSchema,
          workingMinutes: { type: "integer", minimum: 0 },
          reason: nullableStringSchema
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningConstraintUpdateCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "constraint.update" },
      payload: {
        type: "object",
        required: ["taskId", "constraintId", "type", "date"],
        properties: {
          taskId: planningPersistedIdSchema,
          constraintId: planningPersistedIdSchema,
          type: planningConstraintTypeSchema,
          date: planDateOrNullSchema
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningResourceReserveCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "resource.reserve" },
      payload: {
        type: "object",
        required: ["id", "resourceId", "start", "finish", "workMinutes", "reason"],
        properties: {
          id: planningPersistedIdSchema,
          resourceId: planningPersistedIdSchema,
          start: dateSchema,
          finish: dateSchema,
          workMinutes: { type: "integer", minimum: 0 },
          reason: nullableStringSchema
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningRiskAcceptOverloadCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "risk.accept_overload" },
      payload: {
        type: "object",
        required: ["overloadId", "acceptedRiskReason"],
        properties: {
          overloadId: acceptedOverloadIdSchema,
          acceptedRiskReason: { type: "string", minLength: 1, maxLength: 500 }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningProjectDeadlineMoveCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "project.deadline.move" },
      payload: {
        type: "object",
        required: ["deadline", "reason"],
        properties: { deadline: dateSchema, reason: { type: "string", minLength: 1, maxLength: 500 } },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningProjectSettingsUpdateCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "project.settings.update" },
      payload: {
        type: "object",
        required: ["calendarId"],
        properties: { calendarId: planningNullablePersistedIdSchema },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningTaskUpdateCustomFieldCommand: {
    type: "object",
    required: ["type", "payload"],
    properties: {
      type: { type: "string", const: "task.update_custom_field" },
      payload: {
        type: "object",
        required: ["taskId", "fieldKey", "value"],
        properties: {
          taskId: planningPersistedIdSchema,
          fieldKey: { type: "string", pattern: "^[A-Za-z0-9_-]+$", maxLength: 120 },
          value: { type: ["string", "number", "boolean", "null"] }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  PlanningCommandEnvelope: {
    type: "object",
    required: ["command", "clientPlanVersion"],
    properties: {
      command: schemaRef("PlanningCommand"),
      clientPlanVersion: { type: "integer", minimum: 1 },
      idempotencyKey: { type: "string", minLength: 1, maxLength: 120, pattern: planningPersistedIdPattern }
    },
    additionalProperties: false
  },
  PlanningCommandBatchEnvelope: {
    type: "object",
    required: ["commands", "clientPlanVersion"],
    properties: {
      commands: { type: "array", items: schemaRef("PlanningCommand"), minItems: 1 },
      clientPlanVersion: { type: "integer", minimum: 1 },
      idempotencyKey: { type: "string", minLength: 1, maxLength: 120, pattern: planningPersistedIdPattern }
    },
    additionalProperties: false
  },
  PlanningCalculatedPlan: {
    type: "object",
    required: [
      "tenantId",
      "projectId",
      "planVersion",
      "engineVersion",
      "calculatedAt",
      "tasks",
      "dependencies",
      "projectFinish",
      "criticalPathTaskIds",
      "criticalPath",
      "scheduleTrace",
      "validationIssues"
    ],
    properties: {
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      planVersion: { type: "integer", minimum: 1 },
      engineVersion: { type: "string", minLength: 1 },
      calculatedAt: dateTimeSchema,
      tasks: { type: "array", items: schemaRef("PlanningCalculatedTask") },
      dependencies: { type: "array", items: schemaRef("PlanningCalculatedDependency") },
      projectFinish: planDateOrNullSchema,
      criticalPathTaskIds: { type: "array", items: stringIdSchema },
      criticalPath: {
        type: "object",
        required: ["taskIds"],
        properties: { taskIds: { type: "array", items: stringIdSchema } },
        additionalProperties: false
      },
      scheduleTrace: { type: "array", items: schemaRef("AnyJsonObject") },
      validationIssues: { type: "array", items: schemaRef("PlanningValidationIssue") }
    },
    additionalProperties: false
  },
  PlanningResourceLoadBucket: {
    type: "object",
    required: planningResourceLoadBucketRequired,
    properties: planningResourceLoadBucketProperties,
    additionalProperties: false
  },
  PlanningResourceOverload: {
    type: "object",
    required: [
      ...planningResourceLoadBucketRequired,
      "overloadMinutes",
      "accepted",
      "reasons"
    ],
    properties: {
      ...planningResourceLoadBucketProperties,
      overloadMinutes: { type: "integer", minimum: 1 },
      accepted: { type: "boolean" },
      reasons: { type: "array", items: schemaRef("AnyJsonObject") }
    },
    additionalProperties: false
  },
  PlanningResourceLoadMatrix: {
    type: "object",
    required: ["buckets", "overloads", "freeCapacityBuckets", "acceptedOverloads"],
    properties: {
      buckets: { type: "array", items: schemaRef("PlanningResourceLoadBucket") },
      overloads: { type: "array", items: schemaRef("PlanningResourceOverload") },
      freeCapacityBuckets: { type: "array", items: schemaRef("PlanningResourceLoadBucket") },
      acceptedOverloads: { type: "array", items: acceptedOverloadIdSchema }
    },
    additionalProperties: false
  },
  PlanningBaselineComparison: {
    type: "object",
    required: ["baselineId", "label", "capturedAt", "tasks"],
    properties: {
      baselineId: nullableStringSchema,
      label: nullableStringSchema,
      capturedAt: { type: ["string", "null"], format: "date-time" },
      tasks: { type: "array", items: schemaRef("AnyJsonObject") }
    },
    additionalProperties: false
  },
  PlanningCalendar: {
    type: "object",
    required: ["id", "workingWeekdays", "workingMinutesPerDay"],
    properties: {
      id: { type: "string", minLength: 1 },
      workingWeekdays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
      workingMinutesPerDay: { type: "integer", minimum: 0 }
    },
    additionalProperties: false
  },
  PlanningCalendarException: {
    type: "object",
    required: ["id", "calendarId", "resourceId", "date", "workingMinutes", "reason"],
    properties: {
      id: { type: "string", minLength: 1 },
      calendarId: { type: "string", minLength: 1 },
      resourceId: nullableStringSchema,
      date: { type: "string", format: "date" },
      workingMinutes: { type: "integer", minimum: 0 },
      reason: nullableStringSchema
    },
    additionalProperties: false
  },
  PlanningReadModelResponse: {
    type: "object",
    required: [
      "project",
      "authored",
      "calculatedPlan",
      "baselineComparison",
      "resourceLoad",
      "calendars",
      "calendarExceptions",
      "validationIssues",
      "planVersion",
      "engineVersion"
    ],
    properties: {
      project: schemaRef("PlanningProject"),
      authored: {
        type: "object",
        required: ["tasks", "dependencies", "assignments", "assignmentAllocations", "baselines"],
        properties: {
          tasks: { type: "array", items: schemaRef("PlanningTask") },
          dependencies: { type: "array", items: schemaRef("PlanningDependency") },
          assignments: { type: "array", items: schemaRef("PlanningAssignment") },
          assignmentAllocations: { type: "array", items: schemaRef("PlanningAssignmentAllocation") },
          baselines: { type: "array", items: schemaRef("PlanningBaseline") }
        },
        additionalProperties: false
      },
      calculatedPlan: schemaRef("PlanningCalculatedPlan"),
      baselineComparison: schemaRef("PlanningBaselineComparison"),
      resourceLoad: schemaRef("PlanningResourceLoadMatrix"),
      calendars: { type: "array", items: schemaRef("PlanningCalendar") },
      calendarExceptions: { type: "array", items: schemaRef("PlanningCalendarException") },
      validationIssues: { type: "array", items: schemaRef("PlanningValidationIssue") },
      planVersion: { type: "integer", minimum: 1 },
      engineVersion: { type: "string", minLength: 1 }
    },
    additionalProperties: false
  },
  PlanningCommandPreviewResponse: {
    type: "object",
    required: ["before", "after", "planDelta", "validationIssues", "permissionPreview", "auditPreview"],
    properties: {
      before: schemaRef("PlanningReadModelResponse"),
      after: schemaRef("PlanningReadModelResponse"),
      planDelta: schemaRef("PlanningPlanDelta"),
      validationIssues: { type: "array", items: schemaRef("PlanningValidationIssue") },
      permissionPreview: schemaRef("AnyJsonObject"),
      auditPreview: schemaRef("AnyJsonObject")
    },
    additionalProperties: false
  },
  PlanningApplyResponse: {
    type: "object",
    required: ["applied", "newPlanVersion", "auditEventId", "readModel"],
    properties: {
      applied: schemaRef("PlanningPlanDelta"),
      newPlanVersion: { type: "integer", minimum: 1 },
      auditEventId: nullableStringSchema,
      readModel: schemaRef("PlanningReadModelResponse")
    },
    additionalProperties: false
  },
  PlanningRevertRequest: {
    type: "object",
    required: ["targetCommitId", "clientPlanVersion", "idempotencyKey"],
    properties: {
      targetCommitId: planningPersistedIdSchema,
      clientPlanVersion: { type: "integer", minimum: 1 },
      idempotencyKey: {
        type: "string",
        minLength: 1,
        maxLength: 120,
        pattern: planningPersistedIdPattern
      }
    },
    additionalProperties: false
  },
  PlanningRevertResponse: {
    type: "object",
    required: ["reverted", "applied", "newPlanVersion", "auditEventId", "readModel"],
    properties: {
      reverted: stringIdSchema,
      applied: schemaRef("PlanningPlanDelta"),
      newPlanVersion: { type: "integer", minimum: 1 },
      auditEventId: stringIdSchema,
      readModel: schemaRef("PlanningReadModelResponse")
    },
    additionalProperties: false
  },
  PlanningRevertErrorResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "string",
        enum: [
          "invalid_project_id",
          "session_required",
          "same_origin_action_required",
          "persistence_not_configured",
          "cross_tenant_denied",
          "permission_missing",
          "invalid_json",
          "invalid_content_length",
          "payload_too_large",
          "unsupported_media_type",
          "planning_revert_invalid",
          "idempotency_key_conflict",
          "project_not_found",
          "planning_commit_not_found",
          "planning_commit_already_reverted",
          "planning_commit_not_revertible",
          "planning_commit_not_current",
          "planning_precondition_failed",
          "plan_version_conflict"
        ]
      },
      currentPlanVersion: { type: "integer", minimum: 1 },
      validationIssues: { type: "array", items: schemaRef("PlanningValidationIssue") }
    },
    additionalProperties: false
  },
  PlanningPlanVersionBumpResponse: {
    type: "object",
    required: ["newPlanVersion"],
    properties: {
      newPlanVersion: { type: "integer", minimum: 1 }
    },
    additionalProperties: false
  },
  PlanningBaselineSummary: {
    type: "object",
    required: ["id", "capturedAt", "taskCount"],
    properties: {
      id: stringIdSchema,
      capturedAt: dateTimeSchema,
      taskCount: { type: "integer", minimum: 0 }
    },
    additionalProperties: false
  },
  PlanningBaselinesResponse: {
    type: "object",
    required: ["baselines"],
    properties: {
      baselines: { type: "array", items: schemaRef("PlanningBaselineSummary") }
    },
    additionalProperties: false
  },
  PlanningScenarioTarget: {
    type: "object",
    required: ["type", "resourceId", "date", "overloadMinutes", "taskIds"],
    properties: {
      type: { type: "string", const: "resource_overload" },
      resourceId: planningPersistedIdSchema,
      date: dateSchema,
      overloadMinutes: { type: "integer", minimum: 1 },
      taskIds: { type: "array", items: planningPersistedIdSchema }
    },
    additionalProperties: false
  },
  PlanningScenarioPreviewRequest: {
    type: "object",
    required: ["target", "clientPlanVersion"],
    properties: {
      target: schemaRef("PlanningScenarioTarget"),
      clientPlanVersion: { type: "integer", minimum: 1 }
    },
    additionalProperties: false
  },
  PlanningScenarioProposal: {
    type: "object",
    required: ["id", "profile", "conflictEffect", "availability", "unavailableReason", "planDelta", "explainability"],
    properties: {
      id: stringIdSchema,
      profile: planningScenarioProfileSchema,
      conflictEffect: { type: "string", enum: ["accepted", "reduced", "removed"] },
      availability: { type: "string", enum: ["available", "unavailable"] },
      unavailableReason: {
        type: ["string", "null"],
        enum: [
          "target_bucket_not_found",
          "target_assignment_not_found",
          "no_eligible_alternate_resource",
          "alternate_resource_has_insufficient_capacity",
          null
        ]
      },
      planDelta: schemaRef("PlanningPlanDelta"),
      explainability: schemaRef("PlanningProposalExplainability")
    },
    additionalProperties: true
  },
  PlanningProposalExplainability: {
    type: "object",
    required: [
      "finishDate",
      "deadlineDeltaDays",
      "overloadMinutes",
      "overloadedResourceIds",
      "changedTaskIds",
      "changedAssignmentIds",
      "requiredApprovals",
      "riskScore"
    ],
    properties: {
      finishDate: planDateOrNullSchema,
      deadlineDeltaDays: { type: "integer" },
      overloadMinutes: { type: "integer", minimum: 0 },
      overloadedResourceIds: { type: "array", items: stringIdSchema },
      changedTaskIds: { type: "array", items: stringIdSchema },
      changedAssignmentIds: { type: "array", items: stringIdSchema },
      dependencyWarnings: { type: "array", items: { type: "string" } },
      requiredApprovals: { type: "array", items: { type: "string" } },
      riskScore: { type: "integer", minimum: 0 },
      cost: schemaRef("AnyJsonObject")
    },
    additionalProperties: false
  },
  PlanningScenarioPreviewResponse: {
    type: "object",
    required: ["proposals", "planVersion", "engineVersion", "expiresAt"],
    properties: {
      proposals: { type: "array", items: schemaRef("PlanningScenarioProposal") },
      planVersion: { type: "integer", minimum: 1 },
      engineVersion: { type: "string", minLength: 1 },
      expiresAt: dateTimeSchema
    },
    additionalProperties: false
  },
  PlanningScenarioApplyRequest: {
    type: "object",
    required: ["clientPlanVersion"],
    properties: {
      clientPlanVersion: { type: "integer", minimum: 1 },
      acceptedRiskReason: { type: ["string", "null"], maxLength: 500 }
    },
    additionalProperties: false
  },
  PlanningScenarioApplyResponse: {
    type: "object",
    required: ["scenarioRunId", "newPlanVersion", "auditEventId", "readModel"],
    properties: {
      scenarioRunId: stringIdSchema,
      newPlanVersion: { type: "integer", minimum: 1 },
      auditEventId: nullableStringSchema,
      readModel: schemaRef("PlanningReadModelResponse")
    },
    additionalProperties: false
  },
  PlanningSavedView: {
    type: "object",
    required: ["id", "tenantId", "projectId", "ownerUserId", "scope", "name", "payload", "createdAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      projectId: stringIdSchema,
      ownerUserId: stringIdSchema,
      scope: { type: "string", enum: ["user", "project"] },
      name: { type: "string", minLength: 1, maxLength: 80 },
      payload: schemaRef("AnyJsonObject"),
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  PlanningSavedViewCreateRequest: {
    type: "object",
    required: ["name", "payload", "clientRequestId"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      scope: { type: "string", enum: ["user", "project"], default: "user" },
      payload: schemaRef("AnyJsonObject"),
      clientRequestId: { type: "string", minLength: 8, maxLength: 128 }
    },
    additionalProperties: false
  },
  PlanningSavedViewRenameRequest: {
    type: "object",
    required: ["name", "clientRequestId"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      clientRequestId: {
        type: "string",
        minLength: 8,
        maxLength: 128,
        pattern: "^[A-Za-z0-9._:-]+$"
      }
    },
    additionalProperties: false
  },
  PlanningSavedViewDeleteRequest: {
    type: "object",
    required: ["clientRequestId"],
    properties: {
      clientRequestId: {
        type: "string",
        minLength: 8,
        maxLength: 128,
        pattern: "^[A-Za-z0-9._:-]+$"
      }
    },
    additionalProperties: false
  },
  PlanningSavedViewsResponse: {
    type: "object",
    required: ["savedViews"],
    properties: {
      savedViews: { type: "array", items: schemaRef("PlanningSavedView") }
    },
    additionalProperties: false
  },
  PlanningSavedViewResponse: {
    type: "object",
    required: ["savedView"],
    properties: {
      savedView: schemaRef("PlanningSavedView")
    },
    additionalProperties: false
  },
  PlanningAutoSolverRunCreateRequest: {
    type: "object",
    required: ["mode", "clientPlanVersion"],
    properties: {
      mode: { type: "string", enum: ["schedule", "repair"] },
      clientPlanVersion: { type: "integer", minimum: 1 },
      targetDeadline: planDateOrNullSchema
    },
    additionalProperties: false
  },
  PlanningAutoSolverProposal: {
    type: "object",
    required: ["id", "mode", "kind", "planDelta", "explainability"],
    properties: {
      id: stringIdSchema,
      mode: { type: "string", enum: ["schedule", "repair"] },
      kind: { type: "string", enum: ["no_overlap", "accepted_overload"] },
      conflictEffect: { type: "string", enum: ["removed", "accepted_overload"] },
      label: { type: "string" },
      planDelta: schemaRef("PlanningPlanDelta"),
      explainability: schemaRef("PlanningProposalExplainability")
    },
    additionalProperties: true
  },
  PlanningAutoSolverRunResponse: {
    type: "object",
    required: [
      "runId",
      "mode",
      "clientPlanVersion",
      "engineVersion",
      "targetDeadline",
      "proposalPayloadHash",
      "expiresAt",
      "appliedProposalId",
      "proposals"
    ],
    properties: {
      runId: stringIdSchema,
      mode: { type: "string", enum: ["schedule", "repair"] },
      clientPlanVersion: { type: "integer", minimum: 1 },
      engineVersion: { type: "string", minLength: 1 },
      targetDeadline: planDateOrNullSchema,
      proposalPayloadHash: { type: "string", minLength: 1 },
      expiresAt: dateTimeSchema,
      appliedProposalId: nullableStringSchema,
      proposals: { type: "array", items: schemaRef("PlanningAutoSolverProposal") }
    },
    additionalProperties: false
  },
  PlanningCommitEvent: {
    type: "object",
    required: [
      "id",
      "actionType",
      "sourceWorkflow",
      "commandType",
      "afterState",
      "executionStatus",
      "createdAt"
    ],
    properties: {
      id: stringIdSchema,
      actionType: { type: "string", minLength: 1 },
      sourceWorkflow: { type: ["string", "null"] },
      commandType: nullableStringSchema,
      afterState: {
        type: "object",
        required: ["planVersion", "changedTaskIds", "hasCompensatingCommands", "compensatingCommands"],
        properties: {
          planVersion: { type: ["integer", "null"], minimum: 0 },
          changedTaskIds: { type: "array", items: stringIdSchema },
          hasCompensatingCommands: { type: "boolean" },
          // компенсирующие команды коммита — вход клиентского превью-гейта отката.
          // Полный список отдаётся ТОЛЬКО последнему succeeded planning-событию
          // (единственному обратимому через revert-last); у остальных — пустой массив,
          // обратимость в прошлом видна по hasCompensatingCommands.
          compensatingCommands: {
            type: "array",
            items: schemaRef("PlanningCommand"),
            description:
              "Компенсирующие команды отката. Непустой только у последнего succeeded planning-события (единственного обратимого через revert-last); у остальных событий пустой, а прежняя обратимость видна по hasCompensatingCommands."
          }
        },
        additionalProperties: false
      },
      executionStatus: nullableStringSchema,
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  PlanningCommitsResponse: {
    type: "object",
    required: ["auditEvents"],
    properties: {
      auditEvents: { type: "array", items: schemaRef("PlanningCommitEvent") }
    },
    additionalProperties: false
  },
  PlanningAutoSolverRunDetailResponse: {
    type: "object",
    required: [
      "runId",
      "mode",
      "clientPlanVersion",
      "engineVersion",
      "inputSnapshotMetadata",
      "targetDeadline",
      "proposalPayloadHash",
      "expiresAt",
      "appliedProposalId",
      "appliedAt",
      "proposals"
    ],
    properties: {
      runId: stringIdSchema,
      mode: { type: "string", enum: ["schedule", "repair"] },
      clientPlanVersion: { type: "integer", minimum: 1 },
      engineVersion: { type: "string", minLength: 1 },
      inputSnapshotMetadata: schemaRef("AnyJsonObject"),
      targetDeadline: planDateOrNullSchema,
      proposalPayloadHash: { type: "string", minLength: 1 },
      expiresAt: dateTimeSchema,
      appliedProposalId: nullableStringSchema,
      appliedAt: { type: ["string", "null"], format: "date-time" },
      proposals: { type: "array", items: schemaRef("PlanningAutoSolverProposal") }
    },
    additionalProperties: false
  }
});
