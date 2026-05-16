import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CurrentTenantDto } from "./phase2ApiClient";
import { buildProjectScheduleGanttView, scheduleValidationIssueLabel } from "./phase5ScheduleApiClient";
import type {
  CreateScheduleTaskRequestDto,
  Phase5ScheduleApiClient,
  ProjectScheduleAuditDto,
  ProjectScheduleDto,
  ScheduleValidationIssueDto,
  UpdateScheduleTaskRequestDto
} from "./phase5ScheduleApiClient";

type GanttControlSurfaceProps = {
  apiClient: Phase5ScheduleApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
  projectId?: string;
  refreshKey?: number;
};

const defaultProjectId = "project-phase4-main";
type GanttLoadState = "idle" | "loading" | "ready" | "empty" | "denied" | "error";
type GanttCommandName = "create-task" | "update-task" | "dependency" | "baseline";
type ScheduleEditDraft = UpdateScheduleTaskRequestDto;

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось загрузить Гантт";
}

function getValidationIssues(error: unknown): ScheduleValidationIssueDto[] {
  if (
    typeof error === "object" &&
    error !== null &&
    "validationIssues" in error &&
    Array.isArray(error.validationIssues)
  ) {
    return error.validationIssues as ScheduleValidationIssueDto[];
  }

  return [];
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
  projectId = defaultProjectId,
  refreshKey = 0
}: GanttControlSurfaceProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [schedule, setSchedule] = useState<ProjectScheduleDto | null>(null);
  const [audit, setAudit] = useState<ProjectScheduleAuditDto | null>(null);
  const [status, setStatus] = useState("Готово к загрузке Гантта");
  const [loadState, setLoadState] = useState<GanttLoadState>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<GanttCommandName | null>(null);
  const [commandIssues, setCommandIssues] = useState<ScheduleValidationIssueDto[]>([]);
  const [createTaskDraft, setCreateTaskDraft] = useState<CreateScheduleTaskRequestDto>({
    id: "task-phase5-created",
    stageId: `${defaultProjectId}:stage-initiation`,
    taskTemplateId: "task-template-kickoff",
    taskTemplateKey: "kickoff",
    plannedStartDate: "2026-06-04",
    plannedFinishDate: "2026-06-05",
    plannedWorkHours: 8,
    progressPercent: 0
  });
  const [scheduleEditDrafts, setScheduleEditDrafts] = useState<Record<string, ScheduleEditDraft>>({});
  const [dependencyDraft, setDependencyDraft] = useState({
    predecessorTaskId: "",
    successorTaskId: ""
  });
  const requestSequence = useRef(0);
  const canReadSchedule = hasPermission(currentTenant, "project.read");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canWriteSchedule = hasPermission(currentTenant, "task.write");
  const ganttView = useMemo(() => (schedule ? buildProjectScheduleGanttView(schedule) : null), [schedule]);
  const rows = ganttView?.rows ?? [];
  const taskRows = rows.filter((row) => row.taskId !== undefined);
  const activeProjectId = schedule?.schedulePlan.projectId ?? selectedProjectId;
  const firstStageId =
    schedule?.schedulePlan.wbsNodes.find((node) => node.stageId !== undefined)?.stageId ?? `${activeProjectId}:stage-initiation`;
  const commandInFlight = pendingCommand !== null;

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
        setCommandIssues([]);
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
  }, [loadSchedule, projectId, refreshKey]);

  useEffect(() => {
    if (schedule === null) return;

    setCreateTaskDraft((draft) => ({
      ...draft,
      stageId: firstStageId,
      id: draft.id?.trim() ? draft.id : "task-phase5-created"
    }));
    setScheduleEditDrafts(
      Object.fromEntries(
        schedule.schedulePlan.wbsNodes
          .filter((node) => node.taskId !== undefined)
          .map((node) => [
            node.taskId as string,
            {
              plannedStartDate: node.schedule?.plannedStartDate ?? "",
              plannedFinishDate: node.schedule?.plannedFinishDate ?? "",
              plannedWorkHours: node.plannedWorkHours ?? 0,
              progressPercent: node.progressPercent ?? 0
            }
          ])
      )
    );
    const taskIds = schedule.schedulePlan.wbsNodes
      .map((node) => node.taskId)
      .filter((taskId): taskId is string => taskId !== undefined);
    setDependencyDraft((draft) => ({
      predecessorTaskId: draft.predecessorTaskId || taskIds[0] || "",
      successorTaskId: draft.successorTaskId || taskIds[1] || taskIds[0] || ""
    }));
  }, [firstStageId, schedule]);

  function openSelectedProject() {
    void loadSchedule(selectedProjectId);
  }

  async function runScheduleCommand(commandName: GanttCommandName, command: () => Promise<unknown>, successLabel: string) {
    if (commandInFlight) return;
    setPendingCommand(commandName);
    setCommandIssues([]);
    setStatus(successLabel);
    try {
      await command();
      await loadSchedule(activeProjectId);
      setStatus(successLabel);
    } catch (error) {
      setCommandIssues(getValidationIssues(error));
      setStatus(getErrorMessage(error));
    } finally {
      setPendingCommand(null);
    }
  }

  function updateCreateTaskDraft<Field extends keyof CreateScheduleTaskRequestDto>(
    field: Field,
    value: CreateScheduleTaskRequestDto[Field]
  ) {
    setCreateTaskDraft((draft) => ({
      ...draft,
      [field]: value
    }));
  }

  function updateScheduleDraft(taskId: string, field: keyof ScheduleEditDraft, value: string | number) {
    setScheduleEditDrafts((drafts) => ({
      ...drafts,
      [taskId]: {
        ...drafts[taskId],
        [field]: value
      }
    }));
  }

  function createScheduleTask() {
    const request: CreateScheduleTaskRequestDto = {
      ...createTaskDraft,
      stageId: createTaskDraft.stageId || firstStageId,
      id: createTaskDraft.id?.trim() || undefined,
      plannedWorkHours: Number(createTaskDraft.plannedWorkHours),
      progressPercent: Number(createTaskDraft.progressPercent)
    };
    void runScheduleCommand(
      "create-task",
      () => apiClient.createScheduleTask(testUser, activeProjectId, request),
      "Задача создана через API"
    );
  }

  function saveScheduleTask(taskId: string) {
    const draft = scheduleEditDrafts[taskId];
    if (draft === undefined) return;

    void runScheduleCommand(
      "update-task",
      () =>
        apiClient.updateScheduleTask(testUser, activeProjectId, taskId, {
          plannedStartDate: draft.plannedStartDate,
          plannedFinishDate: draft.plannedFinishDate,
          plannedWorkHours: Number(draft.plannedWorkHours),
          progressPercent: Number(draft.progressPercent)
        }),
      "Расписание задачи сохранено через API"
    );
  }

  function createDependency() {
    void runScheduleCommand(
      "dependency",
      () =>
        apiClient.createFinishToStartDependency(testUser, activeProjectId, {
          id: `dependency-${dependencyDraft.predecessorTaskId}-${dependencyDraft.successorTaskId}`,
          predecessorTaskId: dependencyDraft.predecessorTaskId,
          successorTaskId: dependencyDraft.successorTaskId,
          type: "finish_to_start"
        }),
      "FS-связь создана через API"
    );
  }

  function captureBaseline() {
    void runScheduleCommand(
      "baseline",
      () =>
        apiClient.captureBaseline(testUser, activeProjectId, {
          id: `baseline-${activeProjectId}-draft`
        }),
      "Базовый план зафиксирован через API"
    );
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
        <>
        <section className="phase2-panel gantt-command-panel">
          <h3>Команды расписания</h3>
          {canWriteSchedule ? (
            <>
              <div className="gantt-command-grid">
                <label className="field-stack">
                  <span>ID новой задачи</span>
                  <input
                    aria-label="ID новой задачи"
                    onChange={(event) => updateCreateTaskDraft("id", event.target.value)}
                    value={createTaskDraft.id ?? ""}
                  />
                </label>
                <label className="field-stack">
                  <span>Шаблон задачи</span>
                  <input
                    aria-label="Шаблон новой задачи"
                    onChange={(event) => updateCreateTaskDraft("taskTemplateId", event.target.value)}
                    value={createTaskDraft.taskTemplateId}
                  />
                </label>
                <label className="field-stack">
                  <span>Ключ шаблона</span>
                  <input
                    aria-label="Ключ шаблона новой задачи"
                    onChange={(event) => updateCreateTaskDraft("taskTemplateKey", event.target.value)}
                    value={createTaskDraft.taskTemplateKey}
                  />
                </label>
                <label className="field-stack">
                  <span>Старт новой задачи</span>
                  <input
                    aria-label="Старт новой задачи"
                    onChange={(event) => updateCreateTaskDraft("plannedStartDate", event.target.value)}
                    type="date"
                    value={createTaskDraft.plannedStartDate}
                  />
                </label>
                <label className="field-stack">
                  <span>Финиш новой задачи</span>
                  <input
                    aria-label="Финиш новой задачи"
                    onChange={(event) => updateCreateTaskDraft("plannedFinishDate", event.target.value)}
                    type="date"
                    value={createTaskDraft.plannedFinishDate}
                  />
                </label>
                <label className="field-stack">
                  <span>Плановая работа новой задачи</span>
                  <input
                    aria-label="Плановая работа новой задачи"
                    min="0"
                    onChange={(event) => updateCreateTaskDraft("plannedWorkHours", Number(event.target.value))}
                    type="number"
                    value={createTaskDraft.plannedWorkHours}
                  />
                </label>
                <label className="field-stack">
                  <span>Прогресс новой задачи</span>
                  <input
                    aria-label="Прогресс новой задачи"
                    max="100"
                    min="0"
                    onChange={(event) => updateCreateTaskDraft("progressPercent", Number(event.target.value))}
                    type="number"
                    value={createTaskDraft.progressPercent}
                  />
                </label>
              </div>
              <div className="button-row">
                <button disabled={commandInFlight} type="button" onClick={createScheduleTask}>
                  Создать задачу в Гантте
                </button>
                <button disabled={commandInFlight || taskRows.length === 0} type="button" onClick={captureBaseline}>
                  Зафиксировать базовый план
                </button>
              </div>
              <div className="gantt-command-grid">
                <label className="field-stack">
                  <span>Предшественник FS</span>
                  <select
                    aria-label="Предшественник FS"
                    onChange={(event) =>
                      setDependencyDraft((draft) => ({ ...draft, predecessorTaskId: event.target.value }))
                    }
                    value={dependencyDraft.predecessorTaskId}
                  >
                    {taskRows.map((row) => (
                      <option key={`predecessor-${row.taskId}`} value={row.taskId}>
                        {row.taskId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-stack">
                  <span>Последователь FS</span>
                  <select
                    aria-label="Последователь FS"
                    onChange={(event) => setDependencyDraft((draft) => ({ ...draft, successorTaskId: event.target.value }))}
                    value={dependencyDraft.successorTaskId}
                  >
                    {taskRows.map((row) => (
                      <option key={`successor-${row.taskId}`} value={row.taskId}>
                        {row.taskId}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button disabled={commandInFlight || taskRows.length === 0} type="button" onClick={createDependency}>
                Создать FS-связь
              </button>
              {commandIssues.length > 0 ? (
                <div className="compact-list warning-list" data-testid="gantt-command-issues">
                  <span>{status}</span>
                  {commandIssues.map((issue) => (
                    <span key={`${issue.code}-${issue.dependencyId ?? issue.nodeId ?? issue.fieldRefs.join("-")}`}>
                      {scheduleValidationIssueLabel(issue)}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="readonly-notice" data-testid="gantt-command-denied">
              Изменение расписания недоступно по правам
            </p>
          )}
        </section>

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
                    <span>
                      {canWriteSchedule && row.taskId && scheduleEditDrafts[row.taskId] ? (
                        <input
                          aria-label={`Старт ${row.taskId}`}
                          onChange={(event) => updateScheduleDraft(row.taskId as string, "plannedStartDate", event.target.value)}
                          type="date"
                          value={scheduleEditDrafts[row.taskId].plannedStartDate}
                        />
                      ) : (
                        row.plannedStartDate ?? "—"
                      )}
                    </span>
                    <span>
                      {canWriteSchedule && row.taskId && scheduleEditDrafts[row.taskId] ? (
                        <input
                          aria-label={`Финиш ${row.taskId}`}
                          onChange={(event) =>
                            updateScheduleDraft(row.taskId as string, "plannedFinishDate", event.target.value)
                          }
                          type="date"
                          value={scheduleEditDrafts[row.taskId].plannedFinishDate}
                        />
                      ) : (
                        row.plannedFinishDate ?? "—"
                      )}
                    </span>
                    <span>{row.durationDays ?? "—"}</span>
                    <span>
                      {canWriteSchedule && row.taskId && scheduleEditDrafts[row.taskId] ? (
                        <input
                          aria-label={`Работа ${row.taskId}`}
                          min="0"
                          onChange={(event) => updateScheduleDraft(row.taskId as string, "plannedWorkHours", Number(event.target.value))}
                          type="number"
                          value={scheduleEditDrafts[row.taskId].plannedWorkHours}
                        />
                      ) : (
                        row.plannedWorkHours ?? "—"
                      )}
                    </span>
                    <span>
                      {canWriteSchedule && row.taskId && scheduleEditDrafts[row.taskId] ? (
                        <input
                          aria-label={`Прогресс ${row.taskId}`}
                          max="100"
                          min="0"
                          onChange={(event) => updateScheduleDraft(row.taskId as string, "progressPercent", Number(event.target.value))}
                          type="number"
                          value={scheduleEditDrafts[row.taskId].progressPercent}
                        />
                      ) : (
                        row.progressPercent ?? "—"
                      )}
                    </span>
                    <span>{row.baselineLabel}</span>
                    <span>
                      {row.validationLabel}
                      {row.taskId && canWriteSchedule ? (
                        <button
                          className="secondary-button inline-save-button"
                          disabled={commandInFlight}
                          type="button"
                          onClick={() => saveScheduleTask(row.taskId as string)}
                        >
                          Сохранить {row.taskId}
                        </button>
                      ) : null}
                    </span>
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
        </>
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
