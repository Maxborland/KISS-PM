import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionEntityRef, ActionExecutionLog } from "@kiss-pm/action-engine";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  calculateResourceLoadBuckets,
  createAvailabilityException,
  createResourceAssignment,
  createResourceCapacityCalendar,
  createResourceProfile,
  createResourceReservation,
  deriveCapacityPeriodBuckets,
  detectResourceOverloads
} from "@kiss-pm/resource-planning";
import type {
  AvailabilityException,
  CapacityGranularity,
  CapacityPeriodBucket,
  ResourceAssignment,
  ResourceCapacityCalendar,
  ResourceLoadBucket,
  ResourceOverload,
  ResourceOverloadStatus,
  ResourceProfile,
  ResourceReservation
} from "@kiss-pm/resource-planning";

const PHASE6_TIMESTAMP_START = Date.parse("2026-05-16T09:00:00+07:00");
const DEFAULT_PERIOD_START = "2026-06-01";
const DEFAULT_PERIOD_END = "2026-06-05";
const DEFAULT_GRANULARITY: CapacityGranularity = "week";

export type Phase6RuntimeState = ReturnType<typeof createPhase6RuntimeState>;

export type ResourceResolutionActionKey =
  | "shift_work"
  | "split_work"
  | "reassign_resource"
  | "reserve_capacity"
  | "accept_risk"
  | "escalate";

export type ResourceResolutionCommand = {
  actionKey: ResourceResolutionActionKey;
  assignmentId?: string;
  reservationId?: string;
  targetResourceProfileId?: string;
  shiftDays?: number;
  splitHours?: number;
  reservedHours?: number;
  reason: string;
};

export type ResourceResolutionPreview = {
  id: string;
  tenantId: TenantId;
  actorId: TenantUserId;
  overloadId: string;
  actionKey: ResourceResolutionActionKey;
  command: ResourceResolutionCommand;
  commandFingerprint: string;
  stateVersion: number;
  beforeLoadBuckets: ResourceLoadBucket[];
  afterLoadBuckets: ResourceLoadBucket[];
  affectedAssignments: ResourceAssignment[];
  affectedReservations: ResourceReservation[];
  blockers: string[];
  warnings: string[];
  requiredPermissions: string[];
  auditSummary: {
    source: ActionEntityRef;
    target: ActionEntityRef;
    reason: string;
  };
  canConfirm: boolean;
};

export type ResourceResolutionResult = {
  status: "succeeded";
  actionExecution: ActionExecutionLog;
  changedAssignmentIds: string[];
  changedReservationIds: string[];
  overloadStatus: ResourceOverloadStatus;
  beforeLoadBuckets: ResourceLoadBucket[];
  afterLoadBuckets: ResourceLoadBucket[];
};

export type ResourceLoadProjection = {
  resourceProfiles: ResourceProfile[];
  capacityCalendars: ResourceCapacityCalendar[];
  availabilityExceptions: AvailabilityException[];
  assignments: ResourceAssignment[];
  reservations: ResourceReservation[];
  capacityBuckets: CapacityPeriodBucket[];
  loadBuckets: ResourceLoadBucket[];
  overloads: ResourceOverload[];
};

type Phase6TenantState = {
  resourceProfiles: ResourceProfile[];
  capacityCalendars: ResourceCapacityCalendar[];
  availabilityExceptions: AvailabilityException[];
  assignments: ResourceAssignment[];
  reservations: ResourceReservation[];
  overloadStatuses: Map<string, ResourceOverloadStatus>;
  previews: Map<string, ResourceResolutionPreview>;
  actionExecutions: ActionExecutionLog[];
  version: number;
};

function tenantStateKey(tenantId: TenantId): string {
  return tenantId;
}

function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw Object.assign(new Error(`${fieldName} is required`), { code: "validation_error" });
  }

  return value;
}

function requirePositiveNumber(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive number`), { code: "validation_error" });
  }

  return value;
}

function requirePositiveInteger(value: number | undefined, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code: "validation_error" });
  }

  return value;
}

function preconditionFailed(message: string): Error & { code: "precondition_failed" } {
  return Object.assign(new Error(message), { code: "precondition_failed" as const });
}

function notFound(message: string): Error & { code: "not_found" } {
  return Object.assign(new Error(message), { code: "not_found" as const });
}

function stalePreview(message: string): Error & { code: "stale_preview" } {
  return Object.assign(new Error(message), { code: "stale_preview" as const });
}

function commandFingerprint(overloadId: string, command: ResourceResolutionCommand): string {
  return JSON.stringify({ overloadId, command: Object.fromEntries(Object.entries(command).sort()) });
}

function createSeedState(tenantId: TenantId): Phase6TenantState {
  if (tenantId === "tenant-b") {
    const profile = createResourceProfile({
      id: "resource-private-b",
      tenantId,
      type: "person",
      label: "Tenant B private resource",
      userId: "user-b",
      roleKeys: ["delivery_engineer"],
      skillTags: ["private"],
      calendarId: "calendar-private-b",
      active: true
    });

    return {
      resourceProfiles: [profile],
      capacityCalendars: [
        createResourceCapacityCalendar({
          id: "calendar-private-b",
          tenantId,
          resourceProfileId: profile.id,
          timezone: "UTC",
          workingDays: [1, 2, 3, 4, 5],
          defaultDailyCapacityHours: 8,
          effectiveFrom: "2026-06-01",
          effectiveTo: "2026-06-30"
        })
      ],
      availabilityExceptions: [],
      assignments: [
        createResourceAssignment({
          id: "assignment-private-b",
          tenantId,
          projectId: "project-private-b",
          taskId: "task-private-b",
          sourceParticipantId: "participant-private-b",
          resourceProfileId: profile.id,
          roleKey: "delivery_engineer",
          roleLabel: "Инженер поставки",
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-05",
          plannedWorkHours: 8,
          sourceLabel: "Tenant B private task"
        })
      ],
      reservations: [],
      overloadStatuses: new Map(),
      previews: new Map(),
      actionExecutions: [],
      version: 1
    };
  }

  const architect = createResourceProfile({
    id: "resource-architect-a",
    tenantId,
    type: "person",
    label: "Анна Архитектор",
    userId: "executor-a",
    roleKeys: ["solution_architect"],
    skillTags: ["architecture"],
    calendarId: "calendar-architect-a",
    active: true
  });
  const engineer = createResourceProfile({
    id: "resource-engineer-a",
    tenantId,
    type: "person",
    label: "Егор Инженер",
    userId: "project-manager-a",
    roleKeys: ["delivery_engineer"],
    skillTags: ["delivery"],
    calendarId: "calendar-engineer-a",
    active: true
  });

  return {
    resourceProfiles: [architect, engineer],
    capacityCalendars: [
      createResourceCapacityCalendar({
        id: "calendar-architect-a",
        tenantId,
        resourceProfileId: architect.id,
        timezone: "UTC",
        workingDays: [1, 2, 3, 4, 5],
        defaultDailyCapacityHours: 8,
        effectiveFrom: "2026-06-01",
        effectiveTo: "2026-06-30"
      }),
      createResourceCapacityCalendar({
        id: "calendar-engineer-a",
        tenantId,
        resourceProfileId: engineer.id,
        timezone: "UTC",
        workingDays: [1, 2, 3, 4, 5],
        defaultDailyCapacityHours: 8,
        effectiveFrom: "2026-06-01",
        effectiveTo: "2026-06-30"
      })
    ],
    availabilityExceptions: [
      createAvailabilityException({
        id: "reduced-architect-a-2026-06-03",
        tenantId,
        resourceProfileId: architect.id,
        type: "reduced_capacity",
        periodStart: "2026-06-03",
        periodEnd: "2026-06-03",
        capacityHoursPerDay: 4,
        sourceType: "manual",
        sourceId: "capacity-note-architect-a",
        sourceLabel: "Обучение архитектора"
      })
    ],
    assignments: [
      createResourceAssignment({
        id: "assignment-design-architect-a",
        tenantId,
        projectId: "project-alpha-a",
        taskId: "task-design-a",
        sourceParticipantId: "participant-design-architect-a",
        resourceProfileId: architect.id,
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-05",
        plannedWorkHours: 42,
        sourceLabel: "Проект Альфа / Проектирование решения"
      }),
      createResourceAssignment({
        id: "assignment-delivery-engineer-a",
        tenantId,
        projectId: "project-alpha-a",
        taskId: "task-delivery-a",
        sourceParticipantId: "participant-delivery-engineer-a",
        resourceProfileId: engineer.id,
        roleKey: "delivery_engineer",
        roleLabel: "Инженер поставки",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-05",
        plannedWorkHours: 16,
        sourceLabel: "Проект Альфа / Поставка"
      })
    ],
    reservations: [
      createResourceReservation({
        id: "reservation-draft-architect-a",
        tenantId,
        sourceType: "project",
        sourceId: "project-draft-alpha-a",
        resourceProfileId: architect.id,
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        reservedHours: 8,
        status: "active",
        sourceLabel: "Черновик проекта Альфа"
      })
    ],
    overloadStatuses: new Map(),
    previews: new Map(),
    actionExecutions: [],
    version: 1
  };
}

function buildProjection(state: Phase6TenantState, tenantId: TenantId): ResourceLoadProjection {
  const capacityBuckets = deriveCapacityPeriodBuckets({
    tenantId,
    resourceProfiles: state.resourceProfiles,
    calendars: state.capacityCalendars,
    availabilityExceptions: state.availabilityExceptions,
    periodStart: DEFAULT_PERIOD_START,
    periodEnd: DEFAULT_PERIOD_END,
    granularity: DEFAULT_GRANULARITY
  });
  const loadBuckets = calculateResourceLoadBuckets({
    tenantId,
    resourceProfiles: state.resourceProfiles,
    capacityBuckets,
    assignments: state.assignments,
    reservations: state.reservations
  });
  const overloads = detectResourceOverloads({ tenantId, loadBuckets })
    .map((overload) => ({ ...overload, status: state.overloadStatuses.get(overload.id) ?? overload.status }))
    .filter((overload) => overload.status === "open");

  return {
    resourceProfiles: clone(state.resourceProfiles),
    capacityCalendars: clone(state.capacityCalendars),
    availabilityExceptions: clone(state.availabilityExceptions),
    assignments: clone(state.assignments),
    reservations: clone(state.reservations),
    capacityBuckets,
    loadBuckets,
    overloads
  };
}

function affectedAssignments(projection: ResourceLoadProjection, overload: ResourceOverload): ResourceAssignment[] {
  const assignmentIds = new Set(
    overload.sourceRefs
      .filter((sourceRef) => sourceRef.startsWith("assignment:"))
      .map((sourceRef) => sourceRef.slice("assignment:".length))
  );

  return projection.assignments.filter((assignment) => assignmentIds.has(assignment.id));
}

function affectedReservations(projection: ResourceLoadProjection, overload: ResourceOverload): ResourceReservation[] {
  const reservationIds = new Set(
    overload.sourceRefs
      .filter((sourceRef) => sourceRef.startsWith("reservation:"))
      .map((sourceRef) => sourceRef.slice("reservation:".length))
  );

  return projection.reservations.filter((reservation) => reservationIds.has(reservation.id));
}

function loadBucketsForOverload(projection: ResourceLoadProjection, overload: ResourceOverload): ResourceLoadBucket[] {
  return projection.loadBuckets.filter(
    (bucket) =>
      bucket.resourceProfileId === overload.resourceProfileId &&
      bucket.periodStart === overload.periodStart &&
      bucket.periodEnd === overload.periodEnd
  );
}

function targetForCommand(command: ResourceResolutionCommand): ActionEntityRef {
  if (command.assignmentId !== undefined) {
    return { entityType: "resourceAssignment", entityId: command.assignmentId };
  }
  if (command.reservationId !== undefined) {
    return { entityType: "resourceReservation", entityId: command.reservationId };
  }

  return { entityType: "resourceOverload", entityId: command.actionKey };
}

function assertPreviewableCommand(state: Phase6TenantState, overload: ResourceOverload, command: ResourceResolutionCommand): void {
  requireNonEmptyString(command.reason, "resourceResolution.reason");
  if (!overload.recommendedActionKeys.includes(command.actionKey)) {
    throw preconditionFailed("resolution action is not recommended for this overload");
  }

  if (command.actionKey === "shift_work") {
    const assignment = state.assignments.find((candidate) => candidate.id === command.assignmentId);
    if (assignment === undefined || assignment.resourceProfileId !== overload.resourceProfileId) {
      throw preconditionFailed("shift_work requires an affected assignment");
    }
    requirePositiveInteger(command.shiftDays, "resourceResolution.shiftDays");
  }

  if (command.actionKey === "split_work") {
    const assignment = state.assignments.find((candidate) => candidate.id === command.assignmentId);
    if (assignment === undefined || assignment.resourceProfileId !== overload.resourceProfileId) {
      throw preconditionFailed("split_work requires an affected assignment");
    }
    const splitHours = requirePositiveNumber(command.splitHours, "resourceResolution.splitHours");
    if (splitHours >= assignment.plannedWorkHours) {
      throw preconditionFailed("split_work must leave work on the source assignment");
    }
  }

  if (command.actionKey === "reassign_resource") {
    const assignment = state.assignments.find((candidate) => candidate.id === command.assignmentId);
    const target = state.resourceProfiles.find((profile) => profile.id === command.targetResourceProfileId);
    if (assignment === undefined || assignment.resourceProfileId !== overload.resourceProfileId) {
      throw preconditionFailed("reassign_resource requires an affected assignment");
    }
    if (target === undefined) {
      throw preconditionFailed("reassign_resource target resource not found");
    }
    if (target.id === assignment.resourceProfileId) {
      throw preconditionFailed("reassign_resource target must differ from source resource");
    }
  }

  if (command.actionKey === "reserve_capacity") {
    requirePositiveNumber(command.reservedHours, "resourceResolution.reservedHours");
    throw preconditionFailed("reserve_capacity creates additional demand; use the reservation command outside overload resolution");
  }
}

function simulateCommand(
  state: Phase6TenantState,
  tenantId: TenantId,
  overload: ResourceOverload,
  command: ResourceResolutionCommand
): ResourceLoadProjection {
  const simulatedState: Phase6TenantState = {
    ...state,
    resourceProfiles: clone(state.resourceProfiles),
    capacityCalendars: clone(state.capacityCalendars),
    availabilityExceptions: clone(state.availabilityExceptions),
    assignments: clone(state.assignments),
    reservations: clone(state.reservations),
    overloadStatuses: new Map(state.overloadStatuses),
    previews: new Map(),
    actionExecutions: []
  };
  applyCommandToState(simulatedState, overload, command);

  return buildProjection(simulatedState, tenantId);
}

function applyCommandToState(
  state: Phase6TenantState,
  overload: ResourceOverload,
  command: ResourceResolutionCommand
): ResourceOverloadStatus {
  if (command.actionKey === "shift_work") {
    const shiftDays = requirePositiveInteger(command.shiftDays, "resourceResolution.shiftDays");
    state.assignments = state.assignments.map((assignment) =>
      assignment.id === command.assignmentId
        ? createResourceAssignment({
            ...assignment,
            plannedStartDate: addDays(assignment.plannedStartDate, shiftDays),
            plannedFinishDate: addDays(assignment.plannedFinishDate, shiftDays),
            sourceLabel: `${assignment.sourceLabel} / shifted`
          })
        : assignment
    );
    return "resolved";
  }

  if (command.actionKey === "split_work") {
    const splitHours = requirePositiveNumber(command.splitHours, "resourceResolution.splitHours");
    const sourceAssignment = state.assignments.find((assignment) => assignment.id === command.assignmentId);
    if (sourceAssignment === undefined) {
      throw preconditionFailed("split_work assignment not found");
    }
    const splitAssignment = createResourceAssignment({
      ...sourceAssignment,
      id: `${sourceAssignment.id}:split:${state.version + 1}`,
      plannedStartDate: addDays(sourceAssignment.plannedStartDate, 7),
      plannedFinishDate: addDays(sourceAssignment.plannedFinishDate, 7),
      plannedWorkHours: splitHours,
      sourceLabel: `${sourceAssignment.sourceLabel} / split`
    });
    state.assignments = state.assignments.map((assignment) =>
      assignment.id === sourceAssignment.id
        ? createResourceAssignment({ ...assignment, plannedWorkHours: assignment.plannedWorkHours - splitHours })
        : assignment
    );
    state.assignments = [...state.assignments, splitAssignment];
    return "resolved";
  }

  if (command.actionKey === "reassign_resource") {
    const targetResourceProfileId = requireNonEmptyString(
      command.targetResourceProfileId,
      "resourceResolution.targetResourceProfileId"
    );
    state.assignments = state.assignments.map((assignment) =>
      assignment.id === command.assignmentId
        ? createResourceAssignment({
            ...assignment,
            resourceProfileId: targetResourceProfileId,
            sourceLabel: `${assignment.sourceLabel} / reassigned`
          })
        : assignment
    );
    return "resolved";
  }

  if (command.actionKey === "reserve_capacity") {
    requirePositiveNumber(command.reservedHours, "resourceResolution.reservedHours");
    throw preconditionFailed("reserve_capacity is not an overload resolution command");
  }

  if (command.actionKey === "accept_risk") {
    state.overloadStatuses.set(overload.id, "accepted");
    return "accepted";
  }

  state.overloadStatuses.set(overload.id, "escalated");
  return "escalated";
}

export function createPhase6RuntimeState() {
  const states = new Map<string, Phase6TenantState>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE6_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getState(tenantId: TenantId): Phase6TenantState {
    const key = tenantStateKey(tenantId);
    const existing = states.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const state = createSeedState(tenantId);
    states.set(key, state);

    return state;
  }

  function getProjection(tenantId: TenantId): ResourceLoadProjection {
    return buildProjection(getState(tenantId), tenantId);
  }

  function getLoadBucket(tenantId: TenantId, bucketId: string): ResourceLoadBucket | undefined {
    return getProjection(tenantId).loadBuckets.find((bucket) => bucket.id === bucketId);
  }

  function getOverloadDetail(tenantId: TenantId, overloadId: string) {
    const projection = getProjection(tenantId);
    const overload = projection.overloads.find((candidate) => candidate.id === overloadId);
    if (overload === undefined) {
      return undefined;
    }

    return {
      overload: {
        ...overload,
        explanation: `Перегрузка ${overload.overloadHours} ч. на ${overload.periodStart}..${overload.periodEnd}`
      },
      loadBuckets: loadBucketsForOverload(projection, overload),
      affectedAssignments: affectedAssignments(projection, overload),
      affectedReservations: affectedReservations(projection, overload)
    };
  }

  function createReservation(
    tenantId: TenantId,
    input: Omit<ResourceReservation, "tenantId" | "status"> & { status?: ResourceReservation["status"] }
  ): ResourceReservation {
    const state = getState(tenantId);
    if (state.reservations.some((reservation) => reservation.id === input.id)) {
      throw Object.assign(new Error("reservation id already exists"), { code: "conflict" });
    }
    if (input.resourceProfileId !== undefined && !state.resourceProfiles.some((profile) => profile.id === input.resourceProfileId)) {
      throw preconditionFailed("reservation target resource not found");
    }
    const reservation = createResourceReservation({
      ...input,
      tenantId,
      status: input.status ?? "active"
    });
    state.reservations = [...state.reservations, reservation];
    state.version += 1;
    state.previews.clear();

    return clone(reservation);
  }

  function previewResolution(
    tenantId: TenantId,
    actorId: TenantUserId,
    overloadId: string,
    command: ResourceResolutionCommand
  ): ResourceResolutionPreview {
    const state = getState(tenantId);
    const beforeProjection = buildProjection(state, tenantId);
    const overload = beforeProjection.overloads.find((candidate) => candidate.id === overloadId);
    if (overload === undefined) {
      throw notFound("resource overload not found");
    }
    assertPreviewableCommand(state, overload, command);
    const afterProjection = simulateCommand(state, tenantId, overload, command);
    const beforeLoadBuckets = loadBucketsForOverload(beforeProjection, overload);
    const afterLoadBuckets = beforeLoadBuckets.map(
      (beforeBucket) => afterProjection.loadBuckets.find((bucket) => bucket.id === beforeBucket.id) ?? beforeBucket
    );
    const previewId = `preview-resource-${state.version}-${state.previews.size + 1}`;
    const preview: ResourceResolutionPreview = {
      id: previewId,
      tenantId,
      actorId,
      overloadId,
      actionKey: command.actionKey,
      command: clone(command),
      commandFingerprint: commandFingerprint(overloadId, command),
      stateVersion: state.version,
      beforeLoadBuckets,
      afterLoadBuckets,
      affectedAssignments: affectedAssignments(beforeProjection, overload),
      affectedReservations: affectedReservations(beforeProjection, overload),
      blockers: [],
      warnings: [],
      requiredPermissions: ["resource.write"],
      auditSummary: {
        source: { entityType: "resourceOverload", entityId: overloadId },
        target: targetForCommand(command),
        reason: command.reason
      },
      canConfirm: true
    };
    state.previews.set(preview.id, clone(preview));

    return clone(preview);
  }

  function applyResolution(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    overloadId: string;
    previewId: string;
  }): ResourceResolutionResult {
    const state = getState(input.tenantId);
    const preview = state.previews.get(input.previewId);
    if (preview === undefined || preview.overloadId !== input.overloadId) {
      throw stalePreview("resolution preview is missing or stale");
    }
    if (preview.actorId !== input.actorId) {
      throw stalePreview("resolution preview belongs to another actor");
    }
    if (preview.stateVersion !== state.version) {
      throw stalePreview("resource state changed after preview");
    }
    if (preview.commandFingerprint !== commandFingerprint(input.overloadId, preview.command)) {
      throw stalePreview("resolution command fingerprint changed");
    }
    const beforeProjection = buildProjection(state, input.tenantId);
    const overload = beforeProjection.overloads.find((candidate) => candidate.id === input.overloadId);
    if (overload === undefined) {
      throw notFound("resource overload not found");
    }
    assertPreviewableCommand(state, overload, preview.command);

    const overloadStatus = applyCommandToState(state, overload, preview.command);
    state.version += 1;
    state.previews.clear();
    const afterProjection = buildProjection(state, input.tenantId);
    const timestamp = now();
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `resource-${input.overloadId}-${state.version}`
      },
      commandType: `resource_resolution.${preview.command.actionKey}`,
      requiredPermission: "resource.write",
      status: "succeeded",
      source: { entityType: "resourceOverload", entityId: input.overloadId },
      target: targetForCommand(preview.command),
      before: { loadBuckets: preview.beforeLoadBuckets, command: preview.command },
      after: {
        loadBuckets: preview.afterLoadBuckets,
        overloadStatus,
        command: preview.command
      },
      timestamp,
      trace: [
        "resource_resolution:permission resource.write allowed",
        "resource_resolution:preview confirmed",
        `resource_resolution:action ${preview.command.actionKey} applied`
      ]
    });
    state.actionExecutions = [...state.actionExecutions, actionExecution];

    return {
      status: "succeeded",
      actionExecution: clone(actionExecution),
      changedAssignmentIds: preview.affectedAssignments.map((assignment) => assignment.id),
      changedReservationIds: preview.affectedReservations.map((reservation) => reservation.id),
      overloadStatus,
      beforeLoadBuckets: loadBucketsForOverload(beforeProjection, overload),
      afterLoadBuckets: loadBucketsForOverload(afterProjection, overload)
    };
  }

  function listActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).actionExecutions.map((entry) => clone(entry));
  }

  return {
    now,
    getProjection,
    getLoadBucket,
    getOverloadDetail,
    createReservation,
    previewResolution,
    applyResolution,
    listActionExecutions
  };
}
