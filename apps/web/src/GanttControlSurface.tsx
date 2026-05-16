import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CurrentTenantDto } from "./phase2ApiClient";
import { buildProjectScheduleGanttView } from "./phase5ScheduleApiClient";
import type {
  Phase5ScheduleApiClient,
  ProjectScheduleAuditDto,
  ProjectScheduleDto
} from "./phase5ScheduleApiClient";

type GanttControlSurfaceProps = {
  apiClient: Phase5ScheduleApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
  projectId?: string;
};

const defaultProjectId = "project-phase4-main";
type GanttLoadState = "idle" | "loading" | "ready" | "empty" | "denied" | "error";

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось загрузить Гантт";
}

function actionLabel(commandType: string): string {
  const labels: Record<string, string> = {
    "schedule.task.create": "Задача создана",
    "schedule.task.update": "Расписание обновлено",
    "schedule.dependency.create": "Связь создана",
    "schedule.baseline.capture": "Базовый план зафиксирован"
  };

  return labels[commandType] ?? commandType;
}

function actionStatusLabel(status: string): string {
  return status === "succeeded" ? "успешно" : status;
}

export function GanttControlSurface({
  apiClient,
  currentTenant,
  testUser,
  projectId = defaultProjectId
}: GanttControlSurfaceProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [schedule, setSchedule] = useState<ProjectScheduleDto | null>(null);
  const [audit, setAudit] = useState<ProjectScheduleAuditDto | null>(null);
  const [status, setStatus] = useState("Готово к загрузке Гантта");
  const [loadState, setLoadState] = useState<GanttLoadState>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const requestSequence = useRef(0);
  const canReadSchedule = hasPermission(currentTenant, "project.read");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const ganttView = useMemo(() => (schedule ? buildProjectScheduleGanttView(schedule) : null), [schedule]);
  const rows = ganttView?.rows ?? [];

  const loadSchedule = useCallback(
    async (nextProjectId: string) => {
      if (!canReadSchedule) {
        setSchedule(null);
        setAudit(null);
        setStatus("Нет доступа к Гантту");
        setLoadState("denied");
        return;
      }

      const requestId = requestSequence.current + 1;
      requestSequence.current = requestId;
      setIsLoading(true);
      setStatus("Загрузка Гантта");
      setLoadState("loading");
      try {
        const [nextSchedule, nextAudit] = await Promise.all([
          apiClient.getProjectSchedule(testUser, nextProjectId),
          canReadAudit ? apiClient.getProjectScheduleAudit(testUser, nextProjectId) : Promise.resolve(null)
        ]);
        if (requestId !== requestSequence.current) return;
        setSchedule(nextSchedule);
        setAudit(nextAudit);
        setStatus("Гантт загружен");
        setLoadState(nextSchedule.schedulePlan.wbsNodes.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (requestId !== requestSequence.current) return;
        setSchedule(null);
        setAudit(null);
        setStatus(getErrorMessage(error));
        setLoadState("error");
      } finally {
        if (requestId === requestSequence.current) {
          setIsLoading(false);
        }
      }
    },
    [apiClient, canReadAudit, canReadSchedule, testUser]
  );

  useEffect(() => {
    setSelectedProjectId(projectId);
    void loadSchedule(projectId);
  }, [loadSchedule, projectId]);

  function openSelectedProject() {
    void loadSchedule(selectedProjectId);
  }

  return (
    <section className="gantt-surface" data-testid="gantt-surface" id="gantt-workspace">
      <div className="surface-heading">
        <div>
          <h2>Гантт проекта</h2>
        </div>
        <p className="status-pill" data-testid="gantt-status">
          {status}
        </p>
      </div>

      <section className="phase2-panel gantt-entry-panel">
        <h3>Портфель</h3>
        <label className="field-stack">
          <span>ID проекта</span>
          <input
            aria-label="ID проекта для Гантта"
            onChange={(event) => setSelectedProjectId(event.target.value)}
            value={selectedProjectId}
          />
        </label>
        <button disabled={isLoading} type="button" onClick={openSelectedProject}>
          Открыть Гантт
        </button>
      </section>

      {loadState === "denied" ? (
        <p className="readonly-notice" data-testid="gantt-denied">
          Нет доступа к Гантту
        </p>
      ) : null}

      {loadState === "loading" ? (
        <section className="phase2-panel" data-testid="gantt-loading-state">
          <h3>Загрузка</h3>
          <p>Получаем WBS, базовый план и предупреждения расписания</p>
        </section>
      ) : null}

      {loadState === "error" ? (
        <section className="phase2-panel" data-testid="gantt-error-state">
          <h3>Ошибка загрузки</h3>
          <p>{status}</p>
        </section>
      ) : null}

      {loadState === "empty" ? (
        <section className="phase2-panel" data-testid="gantt-empty-state">
          <h3>WBS</h3>
          <p>В расписании пока нет задач</p>
        </section>
      ) : null}

      {loadState === "ready" && rows.length > 0 ? (
        <div className="gantt-layout">
          <section className="phase2-panel gantt-table-panel">
            <h3>WBS</h3>
            <div className="gantt-table" data-testid="gantt-wbs-table">
              <div className="gantt-header" aria-hidden="true">
                <span>WBS</span>
                <span>Старт</span>
                <span>Финиш</span>
                <span>Длит.</span>
                <span>Работа</span>
                <span>%</span>
                <span>Базовый план</span>
                <span>Валидация</span>
              </div>
              {rows.map((row) => {
                return (
                  <div className="gantt-row" data-testid={`gantt-row-${row.taskId ?? row.id}`} key={row.id}>
                    <span style={{ paddingLeft: `${row.level * 16}px` }}>{row.label}</span>
                    <span>{row.plannedStartDate ?? "—"}</span>
                    <span>{row.plannedFinishDate ?? "—"}</span>
                    <span>{row.durationDays ?? "—"}</span>
                    <span>{row.plannedWorkHours ?? "—"}</span>
                    <span>{row.progressPercent ?? "—"}</span>
                    <span>{row.baselineLabel}</span>
                    <span>{row.validationLabel}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="phase2-panel gantt-timeline-panel">
            <h3>Шкала</h3>
            <div className="timeline-scale">
              <span>{ganttView?.timelineStartDate ?? "—"}</span>
              <span>{ganttView?.timelineFinishDate ?? "—"}</span>
            </div>
            <div className="gantt-bars" data-testid="gantt-bars">
              {rows.map((row) => {
                return (
                  <div className="gantt-bar-track" key={row.id}>
                    {row.bar ? (
                      <div className="gantt-bar" style={{ marginLeft: `${row.bar.offsetPercent}%`, width: `${row.bar.widthPercent}%` }}>
                        <span>{row.label}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <section className="phase2-panel gantt-audit-panel">
        <h3>Действия</h3>
        <div className="compact-list" data-testid="gantt-action-evidence">
          {audit && audit.actionExecutions.length > 0
            ? audit.actionExecutions.map((actionExecution) => (
                <span key={actionExecution.id}>
                  {actionLabel(actionExecution.commandType)}: {actionStatusLabel(actionExecution.status)}
                </span>
              ))
            : "Действий пока нет"}
        </div>
      </section>
    </section>
  );
}
