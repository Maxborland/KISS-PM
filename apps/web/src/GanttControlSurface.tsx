import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

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

type ScheduleSnapshot = {
  schedule: ProjectScheduleDto;
  audit: ProjectScheduleAuditDto | null;
};

const ganttQueryKeys = {
  schedule: (testUser: string, projectId: string, refreshKey: number, manualRefreshNonce: number, canReadAudit: boolean) =>
    ["gantt", testUser, "project-schedule", projectId, refreshKey, manualRefreshNonce, { canReadAudit }] as const
};

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
  const [openedProjectId, setOpenedProjectId] = useState(projectId);
  const [manualRefreshNonce, setManualRefreshNonce] = useState(0);
  const [status, setStatus] = useState("Готово к загрузке Гантта");
  const [pendingCommand, setPendingCommand] = useState<GanttCommandName | null>(null);
  const [lastCommandStatus, setLastCommandStatus] = useState<string | null>(null);
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
  const canReadSchedule = hasPermission(currentTenant, "project.read");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const canWriteSchedule = hasPermission(currentTenant, "task.write");
  const scheduleQuery = useQuery<ScheduleSnapshot>({
    queryKey: ganttQueryKeys.schedule(testUser, openedProjectId, refreshKey, manualRefreshNonce, canReadAudit),
    queryFn: () => fetchScheduleSnapshot(openedProjectId),
    enabled: canReadSchedule,
    retry: false
  });
  const schedule = canReadSchedule ? scheduleQuery.data?.schedule ?? null : null;
  const audit = canReadSchedule ? scheduleQuery.data?.audit ?? null : null;
  const loadState: GanttLoadState = !canReadSchedule
    ? "denied"
    : scheduleQuery.isFetching && scheduleQuery.data === undefined
      ? "loading"
      : scheduleQuery.isError
        ? "error"
        : schedule
          ? schedule.schedulePlan.wbsNodes.length > 0
            ? "ready"
            : "empty"
          : "idle";
  const isLoading = scheduleQuery.isFetching;
  const ganttView = useMemo(() => (schedule ? buildProjectScheduleGanttView(schedule) : null), [schedule]);
  const rows = ganttView?.rows ?? [];
  const taskRows = rows.filter((row) => row.taskId !== undefined);
  const activeProjectId = schedule?.schedulePlan.projectId ?? selectedProjectId;
  const firstStageId =
    schedule?.schedulePlan.wbsNodes.find((node) => node.stageId !== undefined)?.stageId ?? `${activeProjectId}:stage-initiation`;
  const commandInFlight = pendingCommand !== null;

  async function fetchScheduleSnapshot(nextProjectId: string): Promise<ScheduleSnapshot> {
    const nextSchedule = await apiClient.getProjectSchedule(testUser, nextProjectId);
    const nextAudit = canReadAudit ? await apiClient.getProjectScheduleAudit(testUser, nextProjectId).catch(() => null) : null;

    return {
      schedule: nextSchedule,
      audit: nextAudit
    };
  }

  useEffect(() => {
    setSelectedProjectId(projectId);
    setOpenedProjectId(projectId);
  }, [projectId, refreshKey]);

  useEffect(() => {
    if (!canReadSchedule) {
      setStatus("Нет доступа к Гантту");
      setCommandIssues([]);
      return;
    }
    if (scheduleQuery.isFetching && scheduleQuery.data === undefined) {
      setStatus("Загрузка Гантта");
      return;
    }
    if (scheduleQuery.isError) {
      setStatus(getErrorMessage(scheduleQuery.error));
      return;
    }
    if (scheduleQuery.isSuccess) {
      setCommandIssues([]);
      setStatus(
        lastCommandStatus ??
          (scheduleQuery.data.audit === null && canReadAudit ? "Гантт загружен, аудит временно недоступен" : "Гантт загружен")
      );
    }
  }, [
    canReadAudit,
    canReadSchedule,
    lastCommandStatus,
    scheduleQuery.data,
    scheduleQuery.error,
    scheduleQuery.isError,
    scheduleQuery.isFetching,
    scheduleQuery.isSuccess
  ]);

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

  const createTaskMutation = useMutation({
    mutationFn: (request: CreateScheduleTaskRequestDto) => apiClient.createScheduleTask(testUser, activeProjectId, request)
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, request }: { taskId: string; request: UpdateScheduleTaskRequestDto }) =>
      apiClient.updateScheduleTask(testUser, activeProjectId, taskId, request)
  });
  const createDependencyMutation = useMutation({
    mutationFn: (request: Parameters<Phase5ScheduleApiClient["createFinishToStartDependency"]>[2]) =>
      apiClient.createFinishToStartDependency(testUser, activeProjectId, request)
  });
  const captureBaselineMutation = useMutation({
    mutationFn: (request: Parameters<Phase5ScheduleApiClient["captureBaseline"]>[2]) =>
      apiClient.captureBaseline(testUser, activeProjectId, request)
  });

  function openSelectedProject() {
    setLastCommandStatus(null);
    setOpenedProjectId(selectedProjectId);
    setManualRefreshNonce((current) => current + 1);
  }

  async function runScheduleCommand(
    commandName: GanttCommandName,
    command: () => Promise<unknown>,
    pendingLabel: string,
    successLabel: string
  ) {
    if (commandInFlight) return;
    const commandProjectId = activeProjectId;
    setPendingCommand(commandName);
    setLastCommandStatus(null);
    setCommandIssues([]);
    setStatus(pendingLabel);
    try {
      await command();
      await scheduleQuery.refetch();
      if (selectedProjectId === commandProjectId) {
        setLastCommandStatus(successLabel);
        setStatus(successLabel);
      }
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
      () => createTaskMutation.mutateAsync(request),
      "Создание задачи через API",
      "Задача создана через API"
    );
  }

  function saveScheduleTask(taskId: string) {
    const draft = scheduleEditDrafts[taskId];
    if (draft === undefined) return;

    void runScheduleCommand(
      "update-task",
      () =>
        updateTaskMutation.mutateAsync({
          taskId,
          request: {
          plannedStartDate: draft.plannedStartDate,
          plannedFinishDate: draft.plannedFinishDate,
          plannedWorkHours: Number(draft.plannedWorkHours),
          progressPercent: Number(draft.progressPercent)
          }
        }),
      "Сохранение расписания задачи через API",
      "Расписание задачи сохранено через API"
    );
  }

  function createDependency() {
    void runScheduleCommand(
      "dependency",
      () =>
        createDependencyMutation.mutateAsync({
          id: `dependency-${dependencyDraft.predecessorTaskId}-${dependencyDraft.successorTaskId}`,
          predecessorTaskId: dependencyDraft.predecessorTaskId,
          successorTaskId: dependencyDraft.successorTaskId,
          type: "finish_to_start"
        }),
      "Создание FS-связи через API",
      "FS-связь создана через API"
    );
  }

  function captureBaseline() {
    void runScheduleCommand(
      "baseline",
      () =>
        captureBaselineMutation.mutateAsync({
          id: `baseline-${activeProjectId}-draft`
        }),
      "Фиксация базового плана через API",
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
            disabled={commandInFlight}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            value={selectedProjectId}
          />
        </label>
        <button disabled={isLoading || commandInFlight} type="button" onClick={openSelectedProject}>
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
