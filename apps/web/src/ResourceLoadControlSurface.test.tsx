import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResourceLoadControlSurface } from "./ResourceLoadControlSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  ResourceActionExecutionDto,
  ResourceLoadProjectionDto,
  ResourceOverloadDetailDto,
  ResourcePlanningApiClient,
  ResourcePlanningAuditDto,
  ResourceResolutionPreviewDto,
  ResourceResolutionResultDto
} from "./resourcePlanningApiClient";

const overloadId = "overload:resource-architect-a:2026-06-01:2026-06-05";
const loadBucketId = "load:resource-architect-a:2026-06-01:2026-06-05";

function createCurrentTenant(
  permissions = ["tenant.read", "resource.read", "resource.write", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: {
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    },
    actor: {
      id: "resource-manager-a",
      displayName: "Ресурсный менеджер",
      accessProfileId: "profile-resource-manager-a"
    },
    labels: {},
    permissions
  };
}

function createProjection(overloaded = true): ResourceLoadProjectionDto {
  return {
    resourceProfiles: [
      {
        id: "resource-architect-a",
        tenantId: "tenant-a",
        type: "person",
        label: "Анна Архитектор",
        userId: "executor-a",
        roleKeys: ["solution_architect"],
        skillTags: ["architecture"],
        calendarId: "calendar-architect-a",
        active: true
      },
      {
        id: "resource-engineer-a",
        tenantId: "tenant-a",
        type: "person",
        label: "Егор Инженер",
        userId: "project-manager-a",
        roleKeys: ["delivery_engineer"],
        skillTags: ["delivery"],
        calendarId: "calendar-engineer-a",
        active: true
      }
    ],
    capacityCalendars: [
      {
        id: "calendar-architect-a",
        tenantId: "tenant-a",
        resourceProfileId: "resource-architect-a",
        timezone: "UTC",
        workingDays: [1, 2, 3, 4, 5],
        defaultDailyCapacityHours: 8,
        effectiveFrom: "2026-06-01",
        effectiveTo: "2026-06-30"
      }
    ],
    availabilityExceptions: [
      {
        id: "reduced-architect-a-2026-06-03",
        tenantId: "tenant-a",
        resourceProfileId: "resource-architect-a",
        type: "reduced_capacity",
        periodStart: "2026-06-03",
        periodEnd: "2026-06-03",
        capacityHoursPerDay: 4,
        sourceType: "manual",
        sourceId: "capacity-note-architect-a",
        sourceLabel: "Обучение архитектора"
      }
    ],
    assignments: [
      {
        id: "assignment-design-architect-a",
        tenantId: "tenant-a",
        projectId: "project-alpha-a",
        taskId: "task-design-a",
        sourceParticipantId: "participant-design-architect-a",
        resourceProfileId: "resource-architect-a",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        plannedStartDate: "2026-06-01",
        plannedFinishDate: "2026-06-05",
        plannedWorkHours: overloaded ? 42 : 0,
        sourceLabel: "Проект Альфа / Проектирование решения"
      }
    ],
    reservations: [
      {
        id: "reservation-draft-architect-a",
        tenantId: "tenant-a",
        sourceType: "project",
        sourceId: "project-draft-alpha-a",
        resourceProfileId: "resource-architect-a",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        reservedHours: 8,
        status: "active",
        sourceLabel: "Черновик проекта Альфа"
      }
    ],
    capacityBuckets: [
      {
        id: "capacity:resource-architect-a:2026-06-01:2026-06-05",
        tenantId: "tenant-a",
        resourceProfileId: "resource-architect-a",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        granularity: "week",
        capacityHours: 36
      }
    ],
    loadBuckets: [
      {
        id: loadBucketId,
        tenantId: "tenant-a",
        resourceProfileId: "resource-architect-a",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        granularity: "week",
        capacityHours: 36,
        assignedHours: overloaded ? 42 : 0,
        reservedHours: 8,
        totalLoadHours: overloaded ? 50 : 8,
        loadPercent: overloaded ? 139 : 22,
        severity: overloaded ? "critical" : "none",
        sourceRefs: ["assignment:assignment-design-architect-a", "reservation:reservation-draft-architect-a"]
      }
    ],
    overloads: overloaded
      ? [
          {
            id: overloadId,
            tenantId: "tenant-a",
            resourceProfileId: "resource-architect-a",
            periodStart: "2026-06-01",
            periodEnd: "2026-06-05",
            capacityHours: 36,
            totalLoadHours: 50,
            overloadHours: 14,
            severity: "critical",
            status: "open",
            sourceRefs: ["assignment:assignment-design-architect-a", "reservation:reservation-draft-architect-a"],
            affectedTaskIds: ["task-design-a"],
            affectedProjectIds: ["project-alpha-a", "project-draft-alpha-a"],
            recommendedActionKeys: ["shift_work", "split_work", "reassign_resource", "accept_risk"],
            roleKeys: ["solution_architect"]
          }
        ]
      : []
  };
}

function createOverloadDetail(): ResourceOverloadDetailDto {
  const projection = createProjection();
  const overload = projection.overloads[0];
  const bucket = projection.loadBuckets[0];
  const assignment = projection.assignments[0];
  const reservation = projection.reservations[0];

  if (!overload || !bucket || !assignment || !reservation) {
    throw new Error("Test fixture is incomplete");
  }

  return {
    overload: {
      ...overload,
      explanation: "Перегрузка 14 ч. на 2026-06-01..2026-06-05"
    },
    loadBuckets: [bucket],
    affectedAssignments: [assignment],
    affectedReservations: [reservation]
  };
}

function createPreview(): ResourceResolutionPreviewDto {
  const beforeProjection = createProjection(true);
  const afterProjection = createProjection(false);
  const beforeBucket = beforeProjection.loadBuckets[0];
  const afterBucket = afterProjection.loadBuckets[0];
  const assignment = beforeProjection.assignments[0];
  const reservation = beforeProjection.reservations[0];

  if (!beforeBucket || !afterBucket || !assignment || !reservation) {
    throw new Error("Test fixture is incomplete");
  }

  return {
    id: "preview-resource-1-1",
    tenantId: "tenant-a",
    actorId: "resource-manager-a",
    overloadId,
    actionKey: "shift_work",
    command: {
      actionKey: "shift_work",
      assignmentId: "assignment-design-architect-a",
      shiftDays: 7,
      reason: "Освободить перегруженную неделю"
    },
    commandFingerprint: "fingerprint",
    stateVersion: 1,
    beforeLoadBuckets: [beforeBucket],
    afterLoadBuckets: [afterBucket],
    affectedAssignments: [assignment],
    affectedReservations: [reservation],
    blockers: [],
    warnings: [],
    requiredPermissions: ["resource.write"],
    auditSummary: {
      source: { entityType: "resourceOverload", entityId: overloadId },
      target: { entityType: "resourceAssignment", entityId: "assignment-design-architect-a" },
      reason: "Освободить перегруженную неделю"
    },
    canConfirm: true
  };
}

function createActionExecution(): ResourceActionExecutionDto {
  return {
    id: "resource-action-1",
    tenantId: "tenant-a",
    actorId: "resource-manager-a",
    commandType: "resource_resolution.shift_work",
    requiredPermission: "resource.write",
    status: "succeeded",
    source: { entityType: "resourceOverload", entityId: overloadId },
    target: { entityType: "resourceAssignment", entityId: "assignment-design-architect-a" },
    before: null,
    after: null,
    timestamp: "2026-05-16T02:01:00.000Z",
    correlationId: "resource-overload-1",
    trace: ["resource_resolution:preview confirmed"]
  };
}

function createAudit(actionExecutions: ResourceActionExecutionDto[] = []): ResourcePlanningAuditDto {
  return {
    events: actionExecutions.map((execution) => ({
      id: `audit-${execution.id}`,
      tenantId: "tenant-a",
      actorId: "resource-manager-a",
      actionKey: execution.commandType,
      target: execution.target ?? execution.source,
      result: "success",
      timestamp: execution.timestamp,
      correlationId: execution.correlationId
    })),
    actionExecutions
  };
}

function cloneProjection(projection: ResourceLoadProjectionDto): ResourceLoadProjectionDto {
  return structuredClone(projection) as ResourceLoadProjectionDto;
}

function createMutableApiClient(options: { failApplyOnce?: boolean; failLoad?: boolean } = {}) {
  let projection = cloneProjection(createProjection(true));
  let audit = createAudit();
  let failNextApply = options.failApplyOnce ?? false;

  const apiClient: ResourcePlanningApiClient = {
    getResourceLoad: vi.fn(async () => {
      if (options.failLoad) {
        throw new Error("API ресурсов недоступен");
      }
      return cloneProjection(projection);
    }),
    getResourceLoadBucket: vi.fn(async () => {
      const bucket = projection.loadBuckets.find((candidate) => candidate.id === loadBucketId);
      if (!bucket) throw Object.assign(new Error("Объект не найден"), { code: "not_found" });
      return bucket;
    }),
    getOverloadDetail: vi.fn(async () => createOverloadDetail()),
    previewResolution: vi.fn(async () => createPreview()),
    applyResolution: vi.fn(async (_testUser, _nextOverloadId, request) => {
      if (failNextApply) {
        failNextApply = false;
        throw Object.assign(new Error("Предпросмотр устарел"), { code: "stale_preview" });
      }
      expect(request).toEqual({ previewId: "preview-resource-1-1" });
      projection = cloneProjection(createProjection(false));
      const actionExecution = createActionExecution();
      audit = createAudit([actionExecution]);
      return {
        result: {
          status: "succeeded",
          actionExecution,
          changedAssignmentIds: ["assignment-design-architect-a"],
          changedReservationIds: ["reservation-draft-architect-a"],
          overloadStatus: "resolved",
          beforeLoadBuckets: createProjection(true).loadBuckets,
          afterLoadBuckets: projection.loadBuckets
        },
        readback: cloneProjection(projection)
      } satisfies ResourceResolutionResultDto;
    }),
    createReservation: vi.fn(),
    getResourceAudit: vi.fn(async () => audit)
  };

  return apiClient;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("Resource load control surface", () => {
  it("loads resource buckets, overload signal, affected entities, and audit evidence", async () => {
    render(
      <ResourceLoadControlSurface
        apiClient={createMutableApiClient()}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId("resource-load-surface")).toBeInTheDocument();
    expect(screen.getByTestId("resource-load-status")).toHaveTextContent("Нагрузка загружена");
    expect(screen.getByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("Анна Архитектор");
    expect(screen.getByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("50 ч");
    expect(screen.getByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("Критическая");
    expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent(overloadId);
    await waitFor(() => {
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("assignment-design-architect-a");
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("reservation-draft-architect-a");
    });
    expect(screen.getByTestId("resource-audit-evidence")).toHaveTextContent("Действий пока нет");
    expect(screen.queryByRole("button", { name: "Открыть Гантт проекта" })).not.toBeInTheDocument();
  });

  it("opens related Gantt only when the affected project is available in the schedule surface", async () => {
    const onOpenGanttProject = vi.fn();

    const { rerender } = render(
      <ResourceLoadControlSurface
        apiClient={createMutableApiClient()}
        currentTenant={createCurrentTenant()}
        onOpenGanttProject={onOpenGanttProject}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId("resource-overload-signal")).toHaveTextContent("project-alpha-a");
    expect(screen.queryByRole("button", { name: "Открыть Гантт проекта" })).not.toBeInTheDocument();

    rerender(
      <ResourceLoadControlSurface
        apiClient={createMutableApiClient()}
        availableGanttProjectIds={["project-alpha-a"]}
        currentTenant={createCurrentTenant()}
        onOpenGanttProject={onOpenGanttProject}
        testUser="resource-manager-a"
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Открыть Гантт проекта" }));
    expect(onOpenGanttProject).toHaveBeenCalledWith("project-alpha-a");
  });

  it("renders loading, empty, denied, and error states", async () => {
    const deferred = createDeferred<ResourceLoadProjectionDto>();
    const loadingClient = createMutableApiClient();
    vi.mocked(loadingClient.getResourceLoad).mockReturnValueOnce(deferred.promise);

    const { unmount } = render(
      <ResourceLoadControlSurface
        apiClient={loadingClient}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId("resource-load-loading-state")).toHaveTextContent("Получаем ресурсную нагрузку");
    deferred.resolve(createProjection(true));
    await screen.findByTestId("resource-load-surface");
    unmount();

    const emptyClient = createMutableApiClient();
    vi.mocked(emptyClient.getResourceLoad).mockResolvedValueOnce({
      ...createProjection(false),
      loadBuckets: [],
      overloads: []
    });
    render(
      <ResourceLoadControlSurface
        apiClient={emptyClient}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );
    expect(await screen.findByTestId("resource-load-empty-state")).toHaveTextContent("Нет ресурсных бакетов");
    unmount();

    const deniedClient = createMutableApiClient();
    render(
      <ResourceLoadControlSurface
        apiClient={deniedClient}
        currentTenant={createCurrentTenant(["tenant.read"])}
        testUser="readonly-observer-a"
      />
    );
    expect(await screen.findByTestId("resource-load-denied")).toHaveTextContent("Нет доступа к ресурсной нагрузке");
    expect(deniedClient.getResourceLoad).not.toHaveBeenCalled();
    unmount();

    render(
      <ResourceLoadControlSurface
        apiClient={createMutableApiClient({ failLoad: true })}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );
    expect(await screen.findByTestId("resource-load-error-state")).toHaveTextContent("API ресурсов недоступен");
  });

  it("previews the recommended resolution without marking the overload as applied", async () => {
    const apiClient = createMutableApiClient();

    render(
      <ResourceLoadControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("50 ч");
    await waitFor(() => {
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("assignment-design-architect-a");
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть перенос" }));

    const previewPanel = await screen.findByTestId("resource-resolution-preview");
    expect(previewPanel).toHaveTextContent("До: 50 ч");
    expect(previewPanel).toHaveTextContent("После: 8 ч");
    expect(previewPanel).toHaveTextContent("Состояние еще не изменено");
    expect(screen.getByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("50 ч");
    expect(screen.queryByTestId("resource-apply-result")).not.toBeInTheDocument();
    expect(apiClient.applyResolution).not.toHaveBeenCalled();
  });

  it("applies a previewed resolution, refreshes from API readback, and shows audit/action evidence", async () => {
    const apiClient = createMutableApiClient();

    render(
      <ResourceLoadControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("50 ч");
    await waitFor(() => {
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("assignment-design-architect-a");
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть перенос" }));
    expect(await screen.findByTestId("resource-resolution-preview")).toHaveTextContent("После: 8 ч");
    fireEvent.click(screen.getByRole("button", { name: "Применить preview" }));

    expect(await screen.findByTestId("resource-apply-result")).toHaveTextContent("resource_resolution.shift_work");
    expect(screen.getByTestId("resource-apply-result")).toHaveTextContent("resource.write");
    expect(screen.getByTestId("resource-audit-evidence")).toHaveTextContent("resource_resolution.shift_work");
    await waitFor(() => {
      expect(apiClient.getResourceLoad).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("8 ч");
    expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("Открытых перегрузок нет");
  });

  it("shows read-only command denial without calling preview or apply APIs", async () => {
    const apiClient = createMutableApiClient();

    render(
      <ResourceLoadControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(["tenant.read", "resource.read", "audit.read"])}
        testUser="readonly-observer-a"
      />
    );

    expect(await screen.findByTestId("resource-command-denied")).toHaveTextContent("Изменение нагрузки недоступно по правам");
    expect(screen.queryByRole("button", { name: "Предпросмотреть перенос" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Применить preview" })).not.toBeInTheDocument();
    expect(apiClient.previewResolution).not.toHaveBeenCalled();
    expect(apiClient.applyResolution).not.toHaveBeenCalled();
  });

  it("recovers from a stale preview by refetching the API read model before retry", async () => {
    const apiClient = createMutableApiClient({ failApplyOnce: true });

    render(
      <ResourceLoadControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("50 ч");
    await waitFor(() => {
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("assignment-design-architect-a");
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть перенос" }));
    expect(await screen.findByTestId("resource-resolution-preview")).toHaveTextContent("После: 8 ч");
    fireEvent.click(screen.getByRole("button", { name: "Применить preview" }));

    expect(await screen.findByTestId("resource-command-error")).toHaveTextContent("Предпросмотр устарел");
    fireEvent.click(screen.getByRole("button", { name: "Обновить данные" }));
    await waitFor(() => {
      expect(apiClient.getResourceLoad).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("assignment-design-architect-a");
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть перенос" }));
    expect(await screen.findByTestId("resource-resolution-preview")).toHaveTextContent("Состояние еще не изменено");
  });

  it("uses API readback when reloaded instead of preserving local preview state", async () => {
    const apiClient = createMutableApiClient();
    const { rerender } = render(
      <ResourceLoadControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        refreshKey={0}
        testUser="resource-manager-a"
      />
    );

    expect(await screen.findByTestId(`resource-load-bucket-${loadBucketId}`)).toHaveTextContent("50 ч");
    await waitFor(() => {
      expect(screen.getByTestId("resource-overload-signal")).toHaveTextContent("assignment-design-architect-a");
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотреть перенос" }));
    expect(await screen.findByTestId("resource-resolution-preview")).toHaveTextContent("После: 8 ч");

    rerender(
      <ResourceLoadControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        refreshKey={1}
        testUser="resource-manager-a"
      />
    );

    await waitFor(() => {
      expect(apiClient.getResourceLoad).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByTestId("resource-resolution-preview")).not.toBeInTheDocument();
    expect(within(screen.getByTestId(`resource-load-bucket-${loadBucketId}`)).getByText("50 ч")).toBeInTheDocument();
  });
});
