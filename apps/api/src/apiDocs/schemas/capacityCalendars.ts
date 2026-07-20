import {
  dateSchema,
  dateTimeSchema,
  nullableStringSchema,
  openApiSchemaFragment,
  schemaRef,
  stringIdSchema
} from "./schemaPrimitives";

export const capacityCalendarSchemas = openApiSchemaFragment({
  CapacityDayCell: {
    type: "object",
    required: ["date", "workMinutes", "capacityMinutes", "freeMinutes", "overloadMinutes", "heat"],
    properties: {
      date: dateSchema,
      workMinutes: { type: "integer", minimum: 0 },
      capacityMinutes: { type: "integer", minimum: 0 },
      freeMinutes: { type: "integer" },
      overloadMinutes: { type: "integer", minimum: 0 },
      heat: { type: "string", enum: ["free", "normal", "busy", "overloaded"] },
      isAbsence: { type: "boolean" },
      isFreeDay: { type: "boolean" },
      hasException: { type: "boolean" },
      projectsMixByDate: { type: "array", items: schemaRef("AnyJsonObject") }
    },
    additionalProperties: true
  },
  CapacityTreeNode: {
    type: "object",
    required: ["id", "type", "name", "days"],
    properties: {
      id: stringIdSchema,
      type: { type: "string", enum: ["direction", "unit", "team", "position", "employee"] },
      name: { type: "string", minLength: 1 },
      days: { type: "array", items: schemaRef("CapacityDayCell") },
      children: { type: "array", items: schemaRef("CapacityTreeNode") }
    },
    additionalProperties: true
  },
  CapacityTreeResponse: {
    oneOf: [schemaRef("CapacityTreeNode"), { type: "array", items: schemaRef("CapacityTreeNode") }]
  },
  CapacitySummaryResponse: {
    type: "object",
    required: ["monthIso"],
    properties: {
      monthIso: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
      totalWorkMinutes: { type: "integer", minimum: 0 },
      totalCapacityMinutes: { type: "integer", minimum: 0 },
      totalFreeMinutes: { type: "integer" },
      totalOverloadMinutes: { type: "integer", minimum: 0 },
      overloadedEmployeeCount: { type: "integer", minimum: 0 },
      overloadProjectIds: { type: "array", items: stringIdSchema }
    },
    additionalProperties: true
  },
  CapacityDrilldownContribution: {
    type: "object",
    required: ["projectId", "taskId", "assignmentId", "workMinutes", "title"],
    properties: {
      projectId: { type: "string", minLength: 1 },
      taskId: nullableStringSchema,
      assignmentId: nullableStringSchema,
      workMinutes: { type: "integer", minimum: 0 },
      title: { type: "string" }
    },
    additionalProperties: true
  },
  CapacityDrilldownResponse: {
    type: "object",
    required: ["resourceId", "date", "workMinutes", "capacityMinutes", "freeMinutes", "overloadMinutes", "contributions"],
    properties: {
      resourceId: stringIdSchema,
      date: dateSchema,
      workMinutes: { type: "integer", minimum: 0 },
      capacityMinutes: { type: "integer", minimum: 0 },
      freeMinutes: { type: "integer" },
      overloadMinutes: { type: "integer", minimum: 0 },
      contributions: { type: "array", items: schemaRef("CapacityDrilldownContribution") }
    },
    additionalProperties: true
  },
  ProductionCalendarException: {
    type: "object",
    required: ["id", "date", "workingMinutes", "reason", "resourceId"],
    properties: {
      id: stringIdSchema,
      date: dateSchema,
      workingMinutes: { type: "integer", minimum: 0, maximum: 1440 },
      reason: { type: ["string", "null"], maxLength: 240 },
      resourceId: nullableStringSchema
    },
    additionalProperties: false
  },
  ProductionCalendarResponse: {
    type: "object",
    required: ["calendarId", "year", "workingWeekdays", "workingMinutesPerDay", "exceptions"],
    properties: {
      calendarId: stringIdSchema,
      year: { type: "integer", minimum: 2000, maximum: 2100 },
      workingWeekdays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
      workingMinutesPerDay: { type: "integer", minimum: 0, maximum: 1440 },
      exceptions: { type: "array", items: schemaRef("ProductionCalendarException") }
    },
    additionalProperties: false
  },
  ProductionCalendarBulkRequest: {
    type: "object",
    required: ["exceptions"],
    properties: {
      exceptions: { type: "array", items: schemaRef("ProductionCalendarException"), maxItems: 500 }
    },
    additionalProperties: false
  },
  ProductionCalendarBaseModeRequest: {
    type: "object",
    required: ["workingWeekdays", "workingMinutesPerDay"],
    properties: {
      // ISO рабочие дни недели (1=Пн..7=Вс), 1..7 уникальных значений.
      workingWeekdays: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 }, minItems: 1, maxItems: 7 },
      workingMinutesPerDay: { type: "integer", minimum: 1, maximum: 1440 }
    },
    additionalProperties: false
  },
  ResourceAbsence: {
    type: "object",
    required: ["id", "tenantId", "userId", "type", "dateFrom", "dateTo", "status", "reason", "createdBy", "approvedBy", "createdAt", "updatedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      userId: stringIdSchema,
      type: { type: "string", enum: ["vacation", "admin_leave", "sick_leave", "maternity_leave", "truancy"] },
      dateFrom: dateSchema,
      dateTo: dateSchema,
      status: { type: "string", minLength: 1 },
      reason: { type: ["string", "null"], maxLength: 500 },
      createdBy: nullableStringSchema,
      approvedBy: nullableStringSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema
    },
    additionalProperties: false
  },
  ResourceAbsenceCreateRequest: {
    type: "object",
    required: ["userId", "type", "dateFrom", "dateTo"],
    properties: {
      userId: stringIdSchema,
      type: { type: "string", enum: ["vacation", "admin_leave", "sick_leave", "maternity_leave", "truancy"] },
      dateFrom: dateSchema,
      dateTo: dateSchema,
      reason: { type: ["string", "null"], maxLength: 500 }
    },
    additionalProperties: false
  },
  ResourceAbsencesResponse: {
    type: "object",
    required: ["absences"],
    properties: { absences: { type: "array", items: schemaRef("ResourceAbsence") } },
    additionalProperties: false
  },
  ResourceAbsenceResponse: {
    type: "object",
    required: ["absence"],
    properties: { absence: schemaRef("ResourceAbsence") },
    additionalProperties: false
  },
  PersonalCalendar: {
    type: "object",
    required: ["id", "tenantId", "userId", "name", "timezone", "sourceProvider", "syncStatus", "createdByUserId", "createdAt", "updatedAt", "archivedAt"],
    properties: {
      id: stringIdSchema,
      tenantId: stringIdSchema,
      userId: stringIdSchema,
      name: { type: "string" },
      timezone: { type: "string" },
      sourceProvider: { type: "string", enum: ["manual", "google", "microsoft", "caldav"] },
      syncStatus: { type: "string", enum: ["manual", "connected", "sync_failed", "disabled"] },
      createdByUserId: stringIdSchema,
      createdAt: dateTimeSchema,
      updatedAt: dateTimeSchema,
      archivedAt: { type: ["string", "null"], format: "date-time" }
    },
    additionalProperties: false
  },
  PersonalCalendarEvent: {
    type: "object",
    required: ["id", "calendarId", "userId", "title", "startsAt", "finishesAt", "workMinutes", "capacityImpact", "visibility", "sourceProvider"],
    properties: {
      id: stringIdSchema,
      calendarId: stringIdSchema,
      userId: stringIdSchema,
      title: nullableStringSchema,
      startsAt: dateTimeSchema,
      finishesAt: dateTimeSchema,
      workMinutes: { type: ["integer", "null"], minimum: 0 },
      capacityImpact: { type: "string", enum: ["busy", "unavailable", "tentative"] },
      visibility: { type: "string", enum: ["public", "busy_only", "private"] },
      sourceProvider: { type: "string", enum: ["manual", "google", "microsoft", "caldav"] }
    },
    additionalProperties: false
  },
  PersonalCalendarEventWriteRequest: {
    type: "object",
    required: ["startsAt", "finishesAt"],
    properties: {
      title: { type: ["string", "null"], maxLength: 200 },
      startsAt: dateTimeSchema,
      finishesAt: dateTimeSchema,
      workMinutes: { type: ["integer", "null"], minimum: 0 },
      capacityImpact: { type: "string", enum: ["busy", "unavailable", "tentative"], default: "busy" },
      visibility: { type: "string", enum: ["public", "busy_only", "private"], default: "busy_only" }
    },
    additionalProperties: false
  },
  PersonalCalendarResponse: {
    type: "object",
    required: ["calendar", "events"],
    properties: {
      calendar: { oneOf: [schemaRef("PersonalCalendar"), { type: "null" }] },
      events: { type: "array", items: schemaRef("PersonalCalendarEvent") }
    },
    additionalProperties: false
  },
  PersonalCalendarEventResponse: {
    type: "object",
    required: ["event"],
    properties: { event: schemaRef("PersonalCalendarEvent") },
    additionalProperties: false
  },
  OccupancyWindow: {
    type: "object",
    required: ["id", "resourceId", "sourceType", "sourceId", "startsAt", "finishesAt", "workMinutes", "capacityImpact", "visibility", "title", "entityType", "entityId"],
    properties: {
      id: stringIdSchema,
      resourceId: stringIdSchema,
      sourceType: { type: "string", enum: ["planning_assignment", "reservation", "absence", "personal_calendar_event", "meeting", "call_session"] },
      sourceId: nullableStringSchema,
      startsAt: dateTimeSchema,
      finishesAt: dateTimeSchema,
      workMinutes: { type: ["integer", "null"], minimum: 0 },
      capacityImpact: { type: "string", enum: ["busy", "unavailable", "tentative"] },
      visibility: { type: "string", enum: ["public", "busy_only", "private"] },
      title: nullableStringSchema,
      entityType: nullableStringSchema,
      entityId: nullableStringSchema
    },
    additionalProperties: false
  },
  OccupancyWindowsResponse: {
    type: "object",
    required: ["occupancy"],
    properties: { occupancy: { type: "array", items: schemaRef("OccupancyWindow") } },
    additionalProperties: false
  }
});
