import type { AuditEventDto } from "./phase2ApiClient";

export type ResourceSeverityDto = "none" | "watch" | "warning" | "critical";

export type ResourceResolutionActionKeyDto =
  | "shift_work"
  | "split_work"
  | "reassign_resource"
  | "reserve_capacity"
  | "accept_risk"
  | "escalate";

export type ResourceProfileDto = {
  id: string;
  tenantId: string;
  type: "person" | "team" | "vendor_pool";
  label: string;
  userId?: string;
  roleKeys: string[];
  skillTags: string[];
  calendarId: string;
  active: boolean;
};

export type ResourceCapacityCalendarDto = {
  id: string;
  tenantId: string;
  resourceProfileId: string;
  timezone: string;
  workingDays: number[];
  defaultDailyCapacityHours: number;
  effectiveFrom: string;
  effectiveTo?: string;
};

export type AvailabilityExceptionDto = {
  id: string;
  tenantId: string;
  resourceProfileId: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  capacityHoursPerDay?: number;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
};

export type ResourceAssignmentDto = {
  id: string;
  tenantId: string;
  projectId: string;
  taskId: string;
  sourceParticipantId: string;
  resourceProfileId: string;
  roleKey: string;
  roleLabel: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  plannedWorkHours: number;
  sourceLabel: string;
};

export type ResourceReservationDto = {
  id: string;
  tenantId: string;
  sourceType: "opportunity" | "project" | "stage";
  sourceId: string;
  resourceProfileId: string;
  roleKey: string;
  roleLabel: string;
  periodStart: string;
  periodEnd: string;
  reservedHours: number;
  status: "active" | "released";
  sourceLabel: string;
};

export type CapacityPeriodBucketDto = {
  id: string;
  tenantId: string;
  resourceProfileId: string;
  periodStart: string;
  periodEnd: string;
  granularity: "day" | "week" | "month";
  capacityHours: number;
};

export type ResourceLoadBucketDto = CapacityPeriodBucketDto & {
  assignedHours: number;
  reservedHours: number;
  totalLoadHours: number;
  loadPercent: number;
  severity: ResourceSeverityDto;
  sourceRefs: string[];
};

export type ResourceOverloadStatusDto = "open" | "resolved" | "accepted" | "escalated";

export type ResourceOverloadDto = {
  id: string;
  tenantId: string;
  resourceProfileId: string;
  periodStart: string;
  periodEnd: string;
  capacityHours: number;
  totalLoadHours: number;
  overloadHours: number;
  severity: ResourceSeverityDto;
  status: ResourceOverloadStatusDto;
  sourceRefs: string[];
  affectedTaskIds: string[];
  affectedProjectIds: string[];
  recommendedActionKeys: ResourceResolutionActionKeyDto[];
  roleKeys: string[];
};

export type ResourceOverloadDetailDto = {
  overload: ResourceOverloadDto & { explanation: string };
  loadBuckets: ResourceLoadBucketDto[];
  affectedAssignments: ResourceAssignmentDto[];
  affectedReservations: ResourceReservationDto[];
};

export type ResourceLoadProjectionDto = {
  resourceProfiles: ResourceProfileDto[];
  capacityCalendars: ResourceCapacityCalendarDto[];
  availabilityExceptions: AvailabilityExceptionDto[];
  assignments: ResourceAssignmentDto[];
  reservations: ResourceReservationDto[];
  capacityBuckets: CapacityPeriodBucketDto[];
  loadBuckets: ResourceLoadBucketDto[];
  overloads: ResourceOverloadDto[];
};

export type ResourceResolutionCommandDto = {
  actionKey: ResourceResolutionActionKeyDto;
  assignmentId?: string;
  reservationId?: string;
  targetResourceProfileId?: string;
  shiftDays?: number;
  splitHours?: number;
  reservedHours?: number;
  reason: string;
};

export type ResourceResolutionPreviewDto = {
  id: string;
  tenantId: string;
  actorId: string;
  overloadId: string;
  actionKey: ResourceResolutionActionKeyDto;
  command: ResourceResolutionCommandDto;
  commandFingerprint: string;
  stateVersion: number;
  beforeLoadBuckets: ResourceLoadBucketDto[];
  afterLoadBuckets: ResourceLoadBucketDto[];
  affectedAssignments: ResourceAssignmentDto[];
  affectedReservations: ResourceReservationDto[];
  blockers: string[];
  warnings: string[];
  requiredPermissions: string[];
  auditSummary: {
    source: { entityType: string; entityId: string };
    target: { entityType: string; entityId: string };
    reason: string;
  };
  canConfirm: boolean;
};

export type ResourceActionExecutionDto = {
  id: string;
  tenantId: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: string;
  source: { entityType: string; entityId: string };
  target?: { entityType: string; entityId: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  trace: string[];
};

export type ResourceResolutionResultDto = {
  result: {
    status: "succeeded";
    actionExecution: ResourceActionExecutionDto;
    changedAssignmentIds: string[];
    changedReservationIds: string[];
    overloadStatus: ResourceOverloadStatusDto;
    beforeLoadBuckets: ResourceLoadBucketDto[];
    afterLoadBuckets: ResourceLoadBucketDto[];
  };
  readback: ResourceLoadProjectionDto;
};

export type CreateResourceReservationRequestDto = Omit<ResourceReservationDto, "tenantId" | "status"> & {
  status?: ResourceReservationDto["status"];
};

export type ResourcePlanningAuditDto = {
  events: AuditEventDto[];
  actionExecutions: ResourceActionExecutionDto[];
};

export type ResourcePlanningApiClient = {
  getResourceLoad(testUser: string): Promise<ResourceLoadProjectionDto>;
  getResourceLoadBucket(testUser: string, bucketId: string): Promise<ResourceLoadBucketDto>;
  getOverloadDetail(testUser: string, overloadId: string): Promise<ResourceOverloadDetailDto>;
  previewResolution(
    testUser: string,
    overloadId: string,
    command: ResourceResolutionCommandDto
  ): Promise<ResourceResolutionPreviewDto>;
  applyResolution(
    testUser: string,
    overloadId: string,
    request: { previewId: string }
  ): Promise<ResourceResolutionResultDto>;
  createReservation(
    testUser: string,
    request: CreateResourceReservationRequestDto
  ): Promise<{ reservation: ResourceReservationDto; readback: ResourceLoadProjectionDto }>;
  getResourceAudit(testUser: string): Promise<ResourcePlanningAuditDto>;
};

type ApiErrorDto = {
  code: string;
  message: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return body as T;
}

function jsonBody(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

export function resourceSeverityLabel(severity: ResourceSeverityDto): string {
  const labels: Record<ResourceSeverityDto, string> = {
    none: "Норма",
    watch: "Наблюдение",
    warning: "Риск",
    critical: "Критическая"
  };

  return labels[severity];
}

export function resourceResolutionActionLabel(actionKey: ResourceResolutionActionKeyDto): string {
  const labels: Record<ResourceResolutionActionKeyDto, string> = {
    shift_work: "Перенести работу",
    split_work: "Разделить работу",
    reassign_resource: "Переназначить ресурс",
    reserve_capacity: "Зарезервировать емкость",
    accept_risk: "Принять риск",
    escalate: "Эскалировать"
  };

  return labels[actionKey];
}

export function createResourcePlanningApiClient(basePath = "/api/api"): ResourcePlanningApiClient {
  return {
    getResourceLoad(testUser) {
      return requestJson<ResourceLoadProjectionDto>(withUser(`${basePath}/resources/load`, testUser));
    },
    async getResourceLoadBucket(testUser, bucketId) {
      const body = await requestJson<{ bucket: ResourceLoadBucketDto }>(
        withUser(`${basePath}/resources/load/${encodeURIComponent(bucketId)}`, testUser)
      );
      return body.bucket;
    },
    getOverloadDetail(testUser, overloadId) {
      return requestJson<ResourceOverloadDetailDto>(
        withUser(`${basePath}/resources/overloads/${encodeURIComponent(overloadId)}`, testUser)
      );
    },
    async previewResolution(testUser, overloadId, command) {
      const body = await requestJson<{ preview: ResourceResolutionPreviewDto }>(
        withUser(`${basePath}/resources/overloads/${encodeURIComponent(overloadId)}/preview`, testUser),
        jsonBody(command)
      );
      return body.preview;
    },
    applyResolution(testUser, overloadId, request) {
      return requestJson<ResourceResolutionResultDto>(
        withUser(`${basePath}/resources/overloads/${encodeURIComponent(overloadId)}/apply`, testUser),
        jsonBody(request)
      );
    },
    createReservation(testUser, request) {
      return requestJson<{ reservation: ResourceReservationDto; readback: ResourceLoadProjectionDto }>(
        withUser(`${basePath}/resources/reservations`, testUser),
        jsonBody(request)
      );
    },
    getResourceAudit(testUser) {
      return requestJson<ResourcePlanningAuditDto>(withUser(`${basePath}/resources/audit`, testUser));
    }
  };
}
