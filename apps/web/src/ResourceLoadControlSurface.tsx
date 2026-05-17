import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  resourceResolutionActionLabel,
  resourceSeverityLabel,
  type ResourceActionExecutionDto,
  type ResourceLoadBucketDto,
  type ResourceLoadProjectionDto,
  type ResourceOverloadDetailDto,
  type ResourceOverloadDto,
  type ResourcePlanningApiClient,
  type ResourcePlanningAuditDto,
  type ResourceProfileDto,
  type ResourceResolutionCommandDto,
  type ResourceResolutionPreviewDto,
  type ResourceResolutionResultDto
} from "./resourcePlanningApiClient";

type LoadState = "idle" | "loading" | "ready" | "empty" | "denied" | "error";
type PendingAction = "preview" | "apply" | "reserve" | "refresh" | null;
type RefreshReadback = {
  projection: ResourceLoadProjectionDto;
  audit: ResourcePlanningAuditDto;
};
type CapacityMatrixCell = {
  resourceProfileId: string;
  date: string;
};

type ResourceLoadControlSurfaceProps = {
  apiClient: ResourcePlanningApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
  refreshKey?: number;
  availableGanttProjectIds?: string[];
  onOpenGanttProject?: (projectId: string) => void;
};

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function compactHours(value: number): string {
  return `${value} ч`;
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const final = new Date(`${end}T00:00:00.000Z`);

  while (cursor <= final) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function resourceLabel(resourceProfiles: ResourceProfileDto[], resourceProfileId: string): string {
  return resourceProfiles.find((profile) => profile.id === resourceProfileId)?.label ?? resourceProfileId;
}

function projectionDates(projection: ResourceLoadProjectionDto): string[] {
  const starts = projection.loadBuckets.map((bucket) => bucket.periodStart);
  const ends = projection.loadBuckets.map((bucket) => bucket.periodEnd);
  const start = starts.sort()[0];
  const end = ends.sort().at(-1);

  if (start === undefined || end === undefined) {
    return [];
  }

  return dateRange(start, end);
}

function bucketForResourceDate(
  projection: ResourceLoadProjectionDto,
  resourceProfileId: string,
  date: string
): ResourceLoadBucketDto | undefined {
  return projection.loadBuckets.find(
    (bucket) => bucket.resourceProfileId === resourceProfileId && isDateInRange(date, bucket.periodStart, bucket.periodEnd)
  );
}

function overloadForResourceDate(
  projection: ResourceLoadProjectionDto,
  resourceProfileId: string,
  date: string
): ResourceOverloadDto | undefined {
  return projection.overloads.find(
    (overload) =>
      overload.resourceProfileId === resourceProfileId && isDateInRange(date, overload.periodStart, overload.periodEnd)
  );
}

function exceptionForResourceDate(
  projection: ResourceLoadProjectionDto,
  resourceProfileId: string,
  date: string
) {
  return projection.availabilityExceptions.find(
    (exception) =>
      exception.resourceProfileId === resourceProfileId &&
      isDateInRange(date, exception.periodStart, exception.periodEnd)
  );
}

function isWorkingDate(projection: ResourceLoadProjectionDto, resourceProfileId: string, date: string): boolean {
  const calendar = projection.capacityCalendars.find((candidate) => candidate.resourceProfileId === resourceProfileId);
  if (calendar === undefined) {
    return true;
  }

  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return calendar.workingDays.includes(weekday);
}

function freeCapacityHours(bucket: ResourceLoadBucketDto | undefined): number {
  return bucket === undefined ? 0 : Math.max(0, bucket.capacityHours - bucket.totalLoadHours);
}

function overloadHours(bucket: ResourceLoadBucketDto | undefined): number {
  return bucket === undefined ? 0 : Math.max(0, bucket.totalLoadHours - bucket.capacityHours);
}

function firstOverload(projection: ResourceLoadProjectionDto | null): ResourceOverloadDto | null {
  return projection?.overloads[0] ?? null;
}

function firstBucket(buckets: ResourceLoadBucketDto[]): ResourceLoadBucketDto | null {
  return buckets[0] ?? null;
}

function defaultShiftCommand(detail: ResourceOverloadDetailDto): ResourceResolutionCommandDto | null {
  const assignment = detail.affectedAssignments[0];
  if (assignment === undefined) {
    return null;
  }

  return {
    actionKey: "shift_work",
    assignmentId: assignment.id,
    shiftDays: 7,
    reason: "Освободить перегруженную неделю"
  };
}

function actionExecutionLine(actionExecution: ResourceActionExecutionDto): string {
  const target = actionExecution.target ?? actionExecution.source;

  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function BucketCard({ bucket, resourceProfiles }: { bucket: ResourceLoadBucketDto; resourceProfiles: ResourceProfileDto[] }) {
  return (
    <article
      className={`resource-bucket-card severity-${bucket.severity}`}
      data-testid={`resource-load-bucket-${bucket.id}`}
    >
      <div>
        <strong>{resourceLabel(resourceProfiles, bucket.resourceProfileId)}</strong>
        <span>{bucket.periodStart}..{bucket.periodEnd}</span>
      </div>
      <dl className="compact-facts">
        <div>
          <dt>Емкость</dt>
          <dd>{compactHours(bucket.capacityHours)}</dd>
        </div>
        <div>
          <dt>Назначено</dt>
          <dd>{compactHours(bucket.assignedHours)}</dd>
        </div>
        <div>
          <dt>Резерв</dt>
          <dd>{compactHours(bucket.reservedHours)}</dd>
        </div>
        <div>
          <dt>Итого</dt>
          <dd>{compactHours(bucket.totalLoadHours)}</dd>
        </div>
      </dl>
      <p className="resource-severity-row">
        <span className={`signal-severity-badge severity-${bucket.severity}`}>{resourceSeverityLabel(bucket.severity)}</span>
        <span>{bucket.loadPercent}%</span>
      </p>
    </article>
  );
}

function PreviewPanel({ preview }: { preview: ResourceResolutionPreviewDto }) {
  const beforeBucket = firstBucket(preview.beforeLoadBuckets);
  const afterBucket = firstBucket(preview.afterLoadBuckets);
  const reduction =
    beforeBucket !== null && afterBucket !== null ? beforeBucket.totalLoadHours - afterBucket.totalLoadHours : 0;
  const remainingOverload =
    afterBucket !== null ? Math.max(0, afterBucket.totalLoadHours - afterBucket.capacityHours) : 0;

  return (
    <section className="phase2-panel preview-panel" data-testid="resource-resolution-preview">
      <h3>Preview до применения</h3>
      <p>Состояние еще не изменено. Команда пройдет через backend guard и аудит только после подтверждения.</p>
      <div className="preview-facts">
        <span>До: {beforeBucket ? compactHours(beforeBucket.totalLoadHours) : "нет данных"}</span>
        <span>После: {afterBucket ? compactHours(afterBucket.totalLoadHours) : "нет данных"}</span>
        <span>Снижение: {compactHours(Math.max(0, reduction))}</span>
        <span>Остаточная перегрузка: {compactHours(remainingOverload)}</span>
      </div>
      <p>
        {resourceResolutionActionLabel(preview.actionKey)}: {preview.auditSummary.reason}
      </p>
      <div className="compact-list" data-testid="resource-preview-permission-trace">
        <span>Права: {preview.requiredPermissions.join(", ") || "не требуются"}</span>
        <span>{preview.canConfirm ? "Можно подтверждать" : "Есть блокеры"}</span>
        {preview.warnings.length > 0 ? <span>Предупреждения: {preview.warnings.join("; ")}</span> : null}
        {preview.blockers.length > 0 ? <span>Блокеры: {preview.blockers.join("; ")}</span> : null}
      </div>
    </section>
  );
}

function CapacityMatrix({
  activeCell,
  canWriteResources,
  onCellActivate,
  onCellFocus,
  onPreview,
  onReserve,
  projection,
  selectedCell,
  selectedCellActionState
}: {
  activeCell: CapacityMatrixCell | null;
  canWriteResources: boolean;
  onCellActivate: (cell: CapacityMatrixCell) => void;
  onCellFocus: (cell: CapacityMatrixCell) => void;
  onPreview: () => void;
  onReserve: () => void;
  projection: ResourceLoadProjectionDto;
  selectedCell: CapacityMatrixCell | null;
  selectedCellActionState: "ready" | "loading" | "no-overload";
}) {
  const dates = projectionDates(projection);
  const selectedBucket =
    selectedCell === null ? undefined : bucketForResourceDate(projection, selectedCell.resourceProfileId, selectedCell.date);
  const selectedOverload =
    selectedCell === null ? undefined : overloadForResourceDate(projection, selectedCell.resourceProfileId, selectedCell.date);
  const selectedAssignments =
    selectedCell === null
      ? []
      : projection.assignments.filter(
          (assignment) =>
            assignment.resourceProfileId === selectedCell.resourceProfileId &&
            isDateInRange(selectedCell.date, assignment.plannedStartDate, assignment.plannedFinishDate)
        );
  const selectedReservations =
    selectedCell === null
      ? []
      : projection.reservations.filter(
          (reservation) =>
            reservation.resourceProfileId === selectedCell.resourceProfileId &&
            isDateInRange(selectedCell.date, reservation.periodStart, reservation.periodEnd)
        );
  const activeResource =
    activeCell === null ? "" : resourceLabel(projection.resourceProfiles, activeCell.resourceProfileId);
  const totalFree = projection.loadBuckets.reduce((sum, bucket) => sum + freeCapacityHours(bucket), 0);
  const totalOverload = projection.loadBuckets.reduce((sum, bucket) => sum + overloadHours(bucket), 0);

  return (
    <section className="phase2-panel capacity-matrix-panel">
      <div className="capacity-summary-strip" data-testid="capacity-summary-strip">
        <span>Емкость: {compactHours(projection.loadBuckets.reduce((sum, bucket) => sum + bucket.capacityHours, 0))}</span>
        <span>Нагрузка: {compactHours(projection.loadBuckets.reduce((sum, bucket) => sum + bucket.totalLoadHours, 0))}</span>
        <span>Перегрузка: {compactHours(totalOverload)}</span>
        <span>Свободно: {compactHours(totalFree)}</span>
        <span>Открытые перегрузки: {projection.overloads.length}</span>
      </div>
      <div aria-label="Матрица емкости" className="capacity-matrix" data-testid="capacity-matrix" role="grid">
        <div
          className="capacity-matrix-row capacity-matrix-header"
          role="row"
          style={{ gridTemplateColumns: `210px repeat(${dates.length}, minmax(132px, 1fr))` }}
        >
          <div className="capacity-resource-cell sticky-cell" role="columnheader">Ресурс</div>
          {dates.map((date) => (
            <div className="capacity-day-header" data-testid={`capacity-day-header-${date}`} key={date} role="columnheader">
              {date}
            </div>
          ))}
        </div>
        {projection.resourceProfiles.map((profile) => {
          const rowOverload = projection.overloads.find((overload) => overload.resourceProfileId === profile.id);

          return (
            <div
              className="capacity-matrix-row"
              data-testid={`capacity-row-${profile.id}`}
              key={profile.id}
              role="row"
              style={{ gridTemplateColumns: `210px repeat(${dates.length}, minmax(132px, 1fr))` }}
            >
              <div className="capacity-resource-cell sticky-cell" role="rowheader">
                <strong>{profile.label}</strong>
                <span>{rowOverload ? `Перегрузка ${compactHours(rowOverload.overloadHours)}` : "Без перегрузки"}</span>
              </div>
              {dates.map((date) => {
                const bucket = bucketForResourceDate(projection, profile.id, date);
                const exception = exceptionForResourceDate(projection, profile.id, date);
                const workingDate = isWorkingDate(projection, profile.id, date);
                const overload = overloadHours(bucket);
                const free = freeCapacityHours(bucket);
                const state = !workingDate ? "non-working" : overload > 0 ? "overload" : free > 0 ? "free" : "neutral";
                const isActive = activeCell?.resourceProfileId === profile.id && activeCell.date === date;
                const cell: CapacityMatrixCell = { resourceProfileId: profile.id, date };

                return (
                  <button
                    className={`capacity-matrix-cell severity-${bucket?.severity ?? "none"} state-${state} ${exception ? "has-exception" : ""} ${isActive ? "is-active" : ""}`}
                    data-testid={`capacity-cell-${profile.id}-${date}`}
                    key={`${profile.id}-${date}`}
                    role="gridcell"
                    type="button"
                    onClick={() => onCellActivate(cell)}
                    onFocus={() => onCellFocus(cell)}
                    onMouseEnter={() => onCellFocus(cell)}
                  >
                    <span>
                      {bucket
                        ? `Итого за период ${bucket.periodStart}..${bucket.periodEnd}: ${compactHours(bucket.totalLoadHours)}`
                        : "Нет нагрузки"}
                    </span>
                    {overload > 0 ? <strong>Перегрузка {compactHours(overload)}</strong> : null}
                    {free > 0 ? <strong>Свободно {compactHours(free)}</strong> : null}
                    {!workingDate ? <span>Нерабочий день</span> : null}
                    {exception ? (
                      <span>
                        {exception.type === "reduced_capacity" ? "Сниженная емкость" : exception.type}: {exception.sourceLabel}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="capacity-crosshair" data-testid="capacity-crosshair">
        {activeCell === null ? "Выберите ячейку" : `${activeResource} / ${activeCell.date}`}
      </p>
      {selectedCell !== null ? (
        <section className="capacity-cell-drilldown" data-testid="capacity-cell-drilldown">
          <h3>{resourceLabel(projection.resourceProfiles, selectedCell.resourceProfileId)} / {selectedCell.date}</h3>
          <dl className="compact-facts">
            <div>
              <dt>Емкость</dt>
              <dd>{selectedBucket ? compactHours(selectedBucket.capacityHours) : "нет данных"}</dd>
            </div>
            <div>
              <dt>Нагрузка</dt>
              <dd>{selectedBucket ? compactHours(selectedBucket.totalLoadHours) : "нет данных"}</dd>
            </div>
            <div>
              <dt>Перегрузка</dt>
              <dd>{compactHours(selectedOverload?.overloadHours ?? overloadHours(selectedBucket))}</dd>
            </div>
          </dl>
          <div className="compact-list">
            <span>Source refs: {selectedBucket?.sourceRefs.join(", ") || "нет"}</span>
            <span>Назначения: {selectedAssignments.map((assignment) => assignment.id).join(", ") || "нет"}</span>
            <span>Резервы: {selectedReservations.map((reservation) => reservation.id).join(", ") || "нет"}</span>
            <span>Задачи: {selectedOverload?.affectedTaskIds.join(", ") || selectedAssignments.map((assignment) => assignment.taskId).join(", ") || "нет"}</span>
            <span>Проекты: {selectedOverload?.affectedProjectIds.join(", ") || selectedAssignments.map((assignment) => assignment.projectId).join(", ") || "нет"}</span>
          </div>
          {canWriteResources && selectedOverload !== undefined && selectedCellActionState === "ready" ? (
            <div className="button-row">
              <button type="button" onClick={onPreview}>Предпросмотреть перенос</button>
              <button className="secondary-button" type="button" onClick={onReserve}>Создать резерв</button>
            </div>
          ) : selectedOverload === undefined ? (
            <p className="readonly-notice">В выбранной ячейке нет перегрузки; перенос и резерв недоступны из этого контекста.</p>
          ) : selectedCellActionState === "loading" ? (
            <p className="readonly-notice">Детализация перегрузки загружается; действия временно недоступны.</p>
          ) : (
            <p className="readonly-notice">Действия выключены: нет `resource.write`.</p>
          )}
        </section>
      ) : null}
    </section>
  );
}

export function ResourceLoadControlSurface({
  apiClient,
  currentTenant,
  testUser,
  refreshKey = 0,
  availableGanttProjectIds = [],
  onOpenGanttProject
}: ResourceLoadControlSurfaceProps) {
  const canReadResources = hasPermission(currentTenant, "resource.read");
  const canWriteResources = hasPermission(currentTenant, "resource.write");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [projection, setProjection] = useState<ResourceLoadProjectionDto | null>(null);
  const [selectedOverloadId, setSelectedOverloadId] = useState<string | null>(null);
  const [overloadDetail, setOverloadDetail] = useState<ResourceOverloadDetailDto | null>(null);
  const [audit, setAudit] = useState<ResourcePlanningAuditDto>({ events: [], actionExecutions: [] });
  const [preview, setPreview] = useState<ResourceResolutionPreviewDto | null>(null);
  const [applyResult, setApplyResult] = useState<ResourceResolutionResultDto | null>(null);
  const [status, setStatus] = useState("Ожидание загрузки");
  const [commandError, setCommandError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [activeMatrixCell, setActiveMatrixCell] = useState<CapacityMatrixCell | null>(null);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<CapacityMatrixCell | null>(null);
  const requestSequence = useRef(0);
  const reservationSequence = useRef(1);

  const selectedOverload = useMemo(() => {
    if (projection === null) return null;
    if (selectedOverloadId === null) return firstOverload(projection);

    return projection.overloads.find((overload) => overload.id === selectedOverloadId) ?? null;
  }, [projection, selectedOverloadId]);
  const openableGanttProjectId = useMemo(() => {
    if (selectedOverload === null || onOpenGanttProject === undefined || availableGanttProjectIds.length === 0) {
      return undefined;
    }

    const availableIds = new Set(availableGanttProjectIds);
    return selectedOverload.affectedProjectIds.find((projectId) => availableIds.has(projectId));
  }, [availableGanttProjectIds, onOpenGanttProject, selectedOverload]);
  const selectedCellOverload = useMemo(() => {
    if (projection === null || selectedMatrixCell === null) return undefined;

    return overloadForResourceDate(projection, selectedMatrixCell.resourceProfileId, selectedMatrixCell.date);
  }, [projection, selectedMatrixCell]);
  const selectedCellActionState =
    selectedMatrixCell === null
      ? "loading"
      : selectedCellOverload === undefined
        ? "no-overload"
        : overloadDetail?.overload.id === selectedCellOverload.id
          ? "ready"
          : "loading";

  const refreshSurface = useCallback(
    async (nextStatus = "Нагрузка загружена"): Promise<RefreshReadback | null> => {
      if (!canReadResources) {
        setLoadState("denied");
        setStatus("Нет доступа к ресурсной нагрузке");
        return null;
      }

      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setLoadState("loading");
      setStatus("Получаем ресурсную нагрузку");
      setCommandError("");

      try {
        const [nextProjection, nextAudit] = await Promise.all([
          apiClient.getResourceLoad(testUser),
          canReadAudit ? apiClient.getResourceAudit(testUser).catch(() => ({ events: [], actionExecutions: [] })) : Promise.resolve({ events: [], actionExecutions: [] })
        ]);
        if (requestSequence.current !== sequence) {
          return null;
        }

        setProjection(nextProjection);
        setAudit(nextAudit);
        const nextOverload = nextProjection.overloads[0] ?? null;
        setSelectedOverloadId(nextOverload?.id ?? null);
        setActiveMatrixCell(null);
        setSelectedMatrixCell(null);
        setPreview(null);
        setLoadState(nextProjection.loadBuckets.length > 0 ? "ready" : "empty");
        setStatus(nextProjection.loadBuckets.length > 0 ? nextStatus : "Нет ресурсных бакетов");
        return { projection: nextProjection, audit: nextAudit };
      } catch (error) {
        if (requestSequence.current !== sequence) {
          return null;
        }
        setProjection(null);
        setLoadState("error");
        setStatus(getErrorMessage(error));
        return null;
      }
    },
    [apiClient, canReadAudit, canReadResources, testUser]
  );

  useEffect(() => {
    void refreshSurface();
  }, [refreshKey, refreshSurface]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverloadDetail() {
      if (!canReadResources || selectedOverload === null) {
        setOverloadDetail(null);
        return;
      }

      try {
        const detail = await apiClient.getOverloadDetail(testUser, selectedOverload.id);
        if (!cancelled) {
          setOverloadDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setOverloadDetail(null);
          if (getErrorCode(error) !== "not_found") {
            setCommandError(getErrorMessage(error));
          }
        }
      }
    }

    void loadOverloadDetail();

    return () => {
      cancelled = true;
    };
  }, [apiClient, canReadResources, selectedOverload, testUser]);

  async function previewRecommendedResolution() {
    if (pendingAction !== null || !canWriteResources || overloadDetail === null) {
      return;
    }
    const command = defaultShiftCommand(overloadDetail);
    if (command === null) {
      setCommandError("Нет назначений для безопасного переноса");
      return;
    }

    setPendingAction("preview");
    setStatus("Готовим dry-run preview");
    setCommandError("");
    setApplyResult(null);
    try {
      const nextPreview = await apiClient.previewGovernedResolution(testUser, overloadDetail.overload, command);
      setPreview(nextPreview);
      setStatus("Preview готов: мутации еще нет");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Preview недоступен");
    } finally {
      setPendingAction(null);
    }
  }

  async function applyPreview() {
    if (pendingAction !== null || !canWriteResources || preview === null || !preview.canConfirm) {
      return;
    }

    setPendingAction("apply");
    setStatus("Применяем preview через команду");
    setCommandError("");
    try {
      const result = await apiClient.applyGovernedResolution(testUser, preview.actionKey, { previewId: preview.id });
      setPreview(null);
      setStatus("Команда применена, обновляем readback");
      const readback = await refreshSurface("Команда применена через API");
      if (readback === null) {
        throw new Error("Команда выполнена, но readback не подтвердил состояние");
      }
      if (
        canReadAudit &&
        !readback.audit.actionExecutions.some((actionExecution) => actionExecution.correlationId === result.result.correlationId)
      ) {
        throw new Error("Команда выполнена, но audit/readback не подтвердил action evidence");
      }
      const overloadStatus = readback.projection.overloads.some((overload) => overload.id === preview.overloadId)
        ? "open"
        : "resolved";
      setApplyResult({
        result: {
          status: "succeeded",
          actionExecution: result.result,
          changedAssignmentIds: preview.affectedAssignments.map((assignment) => assignment.id),
          changedReservationIds: preview.affectedReservations.map((reservation) => reservation.id),
          overloadStatus,
          beforeLoadBuckets: preview.beforeLoadBuckets,
          afterLoadBuckets: readback.projection.loadBuckets
        },
        readback: readback.projection
      });
    } catch (error) {
      const nextCommandError = getErrorMessage(error);
      const nextStatus = getErrorCode(error) === "stale_preview" ? "Preview устарел" : "Команда отклонена";
      setPreview(null);
      await refreshSurface("Команда отклонена, readback обновлен");
      setCommandError(nextCommandError);
      setStatus(nextStatus);
    } finally {
      setPendingAction(null);
    }
  }

  async function createReservation() {
    if (pendingAction !== null || !canWriteResources || selectedOverload === null) {
      return;
    }

    const nextReservationId = `reservation-ui-${reservationSequence.current}`;
    reservationSequence.current += 1;
    setPendingAction("reserve");
    setStatus("Создаем резерв через API");
    setCommandError("");
    try {
      await apiClient.createReservation(testUser, {
        id: nextReservationId,
        sourceType: "project",
        sourceId: selectedOverload.affectedProjectIds[0] ?? "resource-load-control",
        resourceProfileId: selectedOverload.resourceProfileId,
        roleKey: selectedOverload.roleKeys[0] ?? "resource",
        roleLabel: selectedOverload.roleKeys[0] ?? "Ресурс",
        periodStart: selectedOverload.periodStart,
        periodEnd: selectedOverload.periodEnd,
        reservedHours: 1,
        sourceLabel: "Резерв из поверхности ресурсной нагрузки"
      });
      await refreshSurface("Резерв создан через API");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setStatus("Резерв не создан");
    } finally {
      setPendingAction(null);
    }
  }

  if (loadState === "denied") {
    return (
      <section className="resource-load-surface" data-testid="resource-load-denied" id="resource-load-control">
        <div className="surface-heading">
          <div>
            <h2>Ресурсная нагрузка</h2>
            <p>Нет доступа к ресурсной нагрузке.</p>
          </div>
          <p className="status-pill">Нет доступа</p>
        </div>
      </section>
    );
  }

  return (
    <section className="resource-load-surface" data-testid="resource-load-surface" id="resource-load-control">
      <div className="surface-heading">
        <div>
          <h2>Ресурсная нагрузка</h2>
          <p>Емкость, назначения, резервы и перегрузки в одном управляемом контуре.</p>
        </div>
        <p className="status-pill" data-testid="resource-load-status">
          {status}
        </p>
      </div>

      {loadState === "loading" ? (
        <p className="phase2-panel" data-testid="resource-load-loading-state">
          Получаем ресурсную нагрузку
        </p>
      ) : null}

      {loadState === "error" ? (
        <section className="phase2-panel" data-testid="resource-load-error-state">
          <h3>Ресурсная нагрузка недоступна</h3>
          <p>{status}</p>
          <button disabled={pendingAction !== null} type="button" onClick={() => void refreshSurface()}>
            Повторить загрузку
          </button>
        </section>
      ) : null}

      {loadState === "empty" ? (
        <section className="phase2-panel" data-testid="resource-load-empty-state">
          <h3>Нет ресурсных бакетов</h3>
          <p>Для выбранного периода нет емкости, назначений или резервов.</p>
        </section>
      ) : null}

      {projection !== null && loadState === "ready" ? (
        <>
          <div className="resource-load-layout">
            <section className="phase2-panel resource-overview-panel">
              <h3>Обзор нагрузки</h3>
              <div className="resource-heatmap" data-testid="resource-load-heatmap">
                {projection.loadBuckets.map((bucket) => (
                  <BucketCard bucket={bucket} key={bucket.id} resourceProfiles={projection.resourceProfiles} />
                ))}
              </div>
            </section>

            <section className="phase2-panel" data-testid="resource-overload-signal">
              <h3>Сигнал перегрузки</h3>
              {selectedOverload === null ? (
                <p>Открытых перегрузок нет</p>
              ) : (
                <>
                  <p>
                    <strong>{selectedOverload.id}</strong>
                  </p>
                  <dl className="compact-facts">
                    <div>
                      <dt>Ресурс</dt>
                      <dd>{resourceLabel(projection.resourceProfiles, selectedOverload.resourceProfileId)}</dd>
                    </div>
                    <div>
                      <dt>Период</dt>
                      <dd>{selectedOverload.periodStart}..{selectedOverload.periodEnd}</dd>
                    </div>
                    <div>
                      <dt>Severity</dt>
                      <dd>{resourceSeverityLabel(selectedOverload.severity)}</dd>
                    </div>
                    <div>
                      <dt>Перегрузка</dt>
                      <dd>{compactHours(selectedOverload.overloadHours)}</dd>
                    </div>
                  </dl>
                  <p>{overloadDetail?.overload.explanation ?? "Детализация сигнала загружается"}</p>
                  <div className="compact-list">
                    <span>Назначения: {overloadDetail?.affectedAssignments.map((assignment) => assignment.id).join(", ") ?? "—"}</span>
                    <span>Резервы: {overloadDetail?.affectedReservations.map((reservation) => reservation.id).join(", ") ?? "—"}</span>
                    <span>Проекты: {selectedOverload.affectedProjectIds.join(", ")}</span>
                    <span>
                      Рекомендации: {selectedOverload.recommendedActionKeys.map(resourceResolutionActionLabel).join(", ")}
                    </span>
                  </div>
                </>
              )}
            </section>
          </div>

          <CapacityMatrix
            activeCell={activeMatrixCell}
            canWriteResources={canWriteResources}
            projection={projection}
            selectedCell={selectedMatrixCell}
            selectedCellActionState={selectedCellActionState}
            onCellActivate={(cell) => {
              setActiveMatrixCell(cell);
              setSelectedMatrixCell(cell);
              const cellOverload = overloadForResourceDate(projection, cell.resourceProfileId, cell.date);
              setSelectedOverloadId(cellOverload?.id ?? "");
            }}
            onCellFocus={setActiveMatrixCell}
            onPreview={() => void previewRecommendedResolution()}
            onReserve={() => void createReservation()}
          />

          <section className="phase2-panel resource-command-panel">
            <h3>Следующее действие</h3>
            {!canWriteResources ? (
              <p className="readonly-notice" data-testid="resource-command-denied">
                Изменение нагрузки недоступно по правам. Данные доступны только для чтения; backend также отклоняет preview/apply.
              </p>
            ) : (
              <div className="button-row">
                <button
                  disabled={pendingAction !== null || selectedOverload === null || overloadDetail === null}
                  type="button"
                  onClick={() => void previewRecommendedResolution()}
                >
                  Предпросмотреть перенос
                </button>
                <button
                  className="secondary-button"
                  disabled={pendingAction !== null || selectedOverload === null}
                  type="button"
                  onClick={() => void createReservation()}
                >
                  Создать резерв
                </button>
                {openableGanttProjectId !== undefined && onOpenGanttProject !== undefined ? (
                  <button
                    className="secondary-button"
                    disabled={pendingAction !== null}
                    type="button"
                    onClick={() => onOpenGanttProject(openableGanttProjectId)}
                  >
                    Открыть Гантт проекта
                  </button>
                ) : null}
              </div>
            )}
            {commandError ? (
              <div className="warning-list" data-testid="resource-command-error">
                <p>{commandError}</p>
                <button className="secondary-button" type="button" onClick={() => void refreshSurface()}>
                  Обновить данные
                </button>
              </div>
            ) : null}
          </section>

          {preview !== null ? (
            <>
              <PreviewPanel preview={preview} />
              {canWriteResources ? (
                <button disabled={pendingAction !== null || !preview.canConfirm} type="button" onClick={() => void applyPreview()}>
                  Применить preview
                </button>
              ) : null}
            </>
          ) : null}

          {applyResult !== null ? (
            <section className="phase2-panel" data-testid="resource-apply-result">
              <h3>Результат команды</h3>
              <p>{actionExecutionLine(applyResult.result.actionExecution)}</p>
              <p>Статус перегрузки: {applyResult.result.overloadStatus}</p>
              <p>Назначения: {applyResult.result.changedAssignmentIds.join(", ") || "нет"}</p>
              <p>Резервы: {applyResult.result.changedReservationIds.join(", ") || "нет"}</p>
              <p>Readback: {applyResult.readback.loadBuckets.length} бакета</p>
            </section>
          ) : null}

          <section className="phase2-panel" data-testid="resource-audit-evidence">
            <h3>Аудит и action evidence</h3>
            <div className="compact-list">
              {audit.actionExecutions.length > 0
                ? audit.actionExecutions.map((actionExecution) => (
                    <span key={actionExecution.id}>{actionExecutionLine(actionExecution)}</span>
                  ))
                : "Действий пока нет"}
              {audit.events.map((event) => (
                <span key={event.id}>{event.actionKey}: {event.target.entityId}</span>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
