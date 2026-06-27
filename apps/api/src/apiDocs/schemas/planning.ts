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
  PlanningBaselineTaskSnapshot: {
    type: "object",
    required: ["taskId", "plannedStart", "plannedFinish", "workMinutes"],
    properties: {
      taskId: stringIdSchema,
      plannedStart: planDateOrNullSchema,
      plannedFinish: planDateOrNullSchema,
      workMinutes: { type: "integer", minimum: 0 }
    },
    additionalProperties: false
  },
  PlanningBaselineAssignmentSnapshot: {
    type: "object",
    required: ["assignmentId", "taskId", "resourceId", "role", "unitsPermille", "workMinutes"],
    properties: {
      assignmentId: stringIdSchema,
      taskId: stringIdSchema,
      resourceId: stringIdSchema,
      role: planningAssignmentRoleSchema,
      unitsPermille: { type: "integer", minimum: 1 },
      workMinutes: { type: ["integer", "null"], minimum: 0 }
    },
    additionalProperties: false
  },
  PlanningBaseline: {
    type: "object",
    required: ["id", "capturedAt", "tasks", "assignments"],
    properties: {
      id: stringIdSchema,
      capturedAt: dateTimeSchema,
      tasks: { type: "array", items: schemaRef("PlanningBaselineTaskSnapshot") },
      assignments: { type: "array", items: schemaRef("PlanningBaselineAssignmentSnapshot") }
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
          id: stringIdSchema,
          projectId: stringIdSchema,
          parentTaskId: nullableStringSchema,
          title: { type: "string", minLength: 1, maxLength: 500 },
          statusId: stringIdSchema,
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
      id: stringIdSchema,
      resourceId: stringIdSchema,
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
        properties: { taskId: stringIdSchema, title: { type: "string", minLength: 1, maxLength: 500 } },
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
        properties: { taskId: stringIdSchema, plannedStart: planDateOrNullSchema, plannedFinish: planDateOrNullSchema },
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
          taskId: stringIdSchema,
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
        properties: { taskId: stringIdSchema, statusId: stringIdSchema },
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
        properties: { taskId: stringIdSchema, percentComplete: { type: "integer", minimum: 0, maximum: 100 } },
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
        properties: { taskId: stringIdSchema, parentTaskId: nullableStringSchema, sortOrder: { type: "integer", minimum: 0 } },
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
        properties: { taskId: stringIdSchema, mode: { type: "string", enum: ["archive", "delete"] } },
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
          id: stringIdSchema,
          predecessorTaskId: stringIdSchema,
          successorTaskId: stringIdSchema,
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
        properties: { dependencyId: stringIdSchema },
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
          id: stringIdSchema,
          taskId: stringIdSchema,
          resourceId: stringIdSchema,
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
          assignmentId: stringIdSchema,
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
        properties: { assignmentId: stringIdSchema },
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
        properties: { baselineId: stringIdSchema, label: { type: "string", minLength: 1, maxLength: 500 } },
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
          id: stringIdSchema,
          calendarId: stringIdSchema,
          resourceId: nullableStringSchema,
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
          taskId: stringIdSchema,
          constraintId: stringIdSchema,
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
          id: stringIdSchema,
          resourceId: stringIdSchema,
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
          overloadId: stringIdSchema,
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
        properties: { calendarId: nullableStringSchema },
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
          taskId: stringIdSchema,
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
      idempotencyKey: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._:-]+$" }
    },
    additionalProperties: false
  },
  PlanningCommandBatchEnvelope: {
    type: "object",
    required: ["commands", "clientPlanVersion"],
    properties: {
      commands: { type: "array", items: schemaRef("PlanningCommand"), minItems: 1 },
      clientPlanVersion: { type: "integer", minimum: 1 },
      idempotencyKey: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._:-]+$" }
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
    required: [
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
    ],
    properties: {
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
    },
    additionalProperties: false
  },
  PlanningResourceOverload: {
    type: "object",
    allOf: [schemaRef("PlanningResourceLoadBucket")],
    properties: {
      overloadMinutes: { type: "integer", minimum: 1 },
      reasons: { type: "array", items: schemaRef("AnyJsonObject") }
    }
  },
  PlanningResourceLoadMatrix: {
    type: "object",
    required: ["buckets", "overloads", "freeCapacityBuckets"],
    properties: {
      buckets: { type: "array", items: schemaRef("PlanningResourceLoadBucket") },
      overloads: { type: "array", items: schemaRef("PlanningResourceOverload") },
      freeCapacityBuckets: { type: "array", items: schemaRef("PlanningResourceLoadBucket") }
    },
    additionalProperties: false
  },
  PlanningBaselineTaskComparison: {
    type: "object",
    required: [
      "taskId",
      "baselineStart",
      "baselineFinish",
      "baselineWorkMinutes",
      "currentStart",
      "currentFinish",
      "currentWorkMinutes",
      "startDeltaDays",
      "finishDeltaDays",
      "workDeltaMinutes"
    ],
    properties: {
      taskId: stringIdSchema,
      baselineStart: planDateOrNullSchema,
      baselineFinish: planDateOrNullSchema,
      baselineWorkMinutes: { type: "integer", minimum: 0 },
      currentStart: planDateOrNullSchema,
      currentFinish: planDateOrNullSchema,
      currentWorkMinutes: { type: ["integer", "null"], minimum: 0 },
      startDeltaDays: { type: ["integer", "null"] },
      finishDeltaDays: { type: ["integer", "null"] },
      workDeltaMinutes: { type: ["integer", "null"] }
    },
    additionalProperties: false
  },
  PlanningBaselineComparisonStatus: {
    type: "string",
    enum: ["added", "removed", "changed", "unchanged"]
  },
  PlanningBaselineAssignmentComparison: {
    type: "object",
    required: [
      "assignmentId",
      "status",
      "baselineTaskId",
      "currentTaskId",
      "baselineResourceId",
      "currentResourceId",
      "baselineWorkMinutes",
      "currentWorkMinutes",
      "workDeltaMinutes"
    ],
    properties: {
      assignmentId: stringIdSchema,
      status: schemaRef("PlanningBaselineComparisonStatus"),
      baselineTaskId: nullableStringSchema,
      currentTaskId: nullableStringSchema,
      baselineResourceId: nullableStringSchema,
      currentResourceId: nullableStringSchema,
      baselineWorkMinutes: { type: ["integer", "null"], minimum: 0 },
      currentWorkMinutes: { type: ["integer", "null"], minimum: 0 },
      workDeltaMinutes: { type: ["integer", "null"] }
    },
    additionalProperties: false
  },
  PlanningBaselineResourceComparison: {
    type: "object",
    required: ["resourceId", "status", "baselineWorkMinutes", "currentWorkMinutes", "workDeltaMinutes"],
    properties: {
      resourceId: stringIdSchema,
      status: schemaRef("PlanningBaselineComparisonStatus"),
      baselineWorkMinutes: { type: ["integer", "null"], minimum: 0 },
      currentWorkMinutes: { type: ["integer", "null"], minimum: 0 },
      workDeltaMinutes: { type: ["integer", "null"] }
    },
    additionalProperties: false
  },
  PlanningBaselineComparison: {
    type: "object",
    required: ["baselineId", "capturedAt", "tasks", "assignments", "resources"],
    properties: {
      baselineId: nullableStringSchema,
      capturedAt: { type: ["string", "null"], format: "date-time" },
      tasks: { type: "array", items: schemaRef("PlanningBaselineTaskComparison") },
      assignments: { type: "array", items: schemaRef("PlanningBaselineAssignmentComparison") },
      resources: { type: "array", items: schemaRef("PlanningBaselineResourceComparison") }
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
      resourceId: stringIdSchema,
      date: dateSchema,
      overloadMinutes: { type: "integer", minimum: 1 },
      taskIds: { type: "array", items: stringIdSchema }
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
    required: ["id", "profile", "conflictEffect", "planDelta", "explainability"],
    properties: {
      id: stringIdSchema,
      profile: planningScenarioProfileSchema,
      conflictEffect: { type: "string", enum: ["accepted", "reduced", "removed"] },
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
  PlanningSavedViewPayload: {
    oneOf: [schemaRef("GanttSavedViewPayload")]
  },
  GanttSavedViewScrollPosition: {
    type: "object",
    required: ["rowIndex", "timelineOffset"],
    properties: {
      rowIndex: { type: "integer", minimum: 0 },
      timelineOffset: { type: "integer", minimum: 0 }
    },
    additionalProperties: false
  },
  GanttSavedViewFilters: {
    type: "object",
    properties: {
      resourceIds: { type: "array", items: stringIdSchema },
      criticalOnly: { type: "boolean" },
      milestonesOnly: { type: "boolean" },
      hasValidationIssues: { type: "boolean" }
    },
    additionalProperties: false
  },
  GanttSavedViewPayload: {
    type: "object",
    required: [
      "viewKind",
      "zoom",
      "visibleColumns",
      "columnWidths",
      "collapsedTaskIds",
      "selectedTaskIds",
      "scrollPosition",
      "filters",
      "baselineOverlayEnabled"
    ],
    properties: {
      viewKind: { type: "string", const: "gantt" },
      zoom: { type: "string", enum: ["hour", "day", "week", "month"] },
      visibleColumns: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
      columnWidths: {
        type: "object",
        minProperties: 1,
        additionalProperties: { type: "integer", minimum: 0 }
      },
      collapsedTaskIds: { type: "array", items: stringIdSchema },
      selectedTaskIds: { type: "array", items: stringIdSchema },
      scrollPosition: schemaRef("GanttSavedViewScrollPosition"),
      filters: schemaRef("GanttSavedViewFilters"),
      baselineOverlayEnabled: { type: "boolean" },
      baselineId: stringIdSchema,
      scenarioRunId: stringIdSchema
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
      name: { type: "string", minLength: 1 },
      payload: schemaRef("PlanningSavedViewPayload"),
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  },
  PlanningSavedViewCreateRequest: {
    type: "object",
    required: ["name", "payload"],
    properties: {
      name: { type: "string", minLength: 1 },
      scope: { type: "string", enum: ["user", "project"], default: "user" },
      payload: schemaRef("PlanningSavedViewPayload")
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
  },

  PlanningForecastRunCreateRequest: {
    type: "object",
    required: ["clientPlanVersion"],
    properties: {
      clientPlanVersion: { type: "integer", minimum: 1 }
    },
    additionalProperties: false
  },

  PlanningForecastHealth: {
    type: "string",
    enum: ["stable", "watch", "needs_decision", "unstable", "blocked"]
  },

  PlanningForecastRiskDriver: {
    type: "object",
    required: ["code", "severity", "message", "taskIds", "resourceIds"],
    properties: {
      code: {
        type: "string",
        enum: [
          "deadline_too_tight",
          "dependency_chain_fragile",
          "resource_overloaded",
          "review_bottleneck",
          "blocked_task",
          "historical_delay_pattern",
          "solver_has_no_safe_proposal"
        ]
      },
      severity: { type: "string", enum: ["info", "warning", "critical"] },
      message: { type: "string", minLength: 1 },
      taskIds: { type: "array", items: stringIdSchema },
      resourceIds: { type: "array", items: stringIdSchema },
      dependencyIds: { type: "array", items: stringIdSchema },
      date: planDateOrNullSchema,
      overloadMinutes: { type: ["integer", "null"], minimum: 0 },
      deadlineDeltaDays: { type: ["integer", "null"] },
      validationIssueCodes: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
  },

  PlanningForecastRecommendation: {
    type: "object",
    required: ["code", "message", "actionRequired", "taskIds", "resourceIds"],
    properties: {
      code: {
        type: "string",
        enum: ["keep_plan", "add_buffer", "move_task", "add_resource", "reduce_scope", "resolve_blocker", "use_auto_solver"]
      },
      message: { type: "string", minLength: 1 },
      actionRequired: { type: "boolean" },
      taskIds: { type: "array", items: stringIdSchema },
      resourceIds: { type: "array", items: stringIdSchema }
    },
    additionalProperties: false
  },

  PlanningForecastRunResponse: {
    type: "object",
    required: [
      "runId",
      "projectId",
      "clientPlanVersion",
      "engineVersion",
      "health",
      "managerSummary",
      "riskDrivers",
      "recommendations",
      "expiresAt",
      "createdAt"
    ],
    properties: {
      runId: stringIdSchema,
      projectId: stringIdSchema,
      clientPlanVersion: { type: "integer", minimum: 1 },
      engineVersion: { type: "string", minLength: 1 },
      health: schemaRef("PlanningForecastHealth"),
      managerSummary: { type: "string", minLength: 1 },
      riskDrivers: { type: "array", items: schemaRef("PlanningForecastRiskDriver") },
      recommendations: { type: "array", items: schemaRef("PlanningForecastRecommendation") },
      expiresAt: dateTimeSchema,
      createdAt: dateTimeSchema
    },
    additionalProperties: false
  }
});
