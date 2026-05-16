import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GanttControlSurface } from "./GanttControlSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  Phase5ScheduleApiClient,
  ProjectScheduleAuditDto,
  ProjectScheduleDto,
  ScheduleCommandResultDto,
  ScheduleActionExecutionDto,
  ScheduleValidationIssueDto
} from "./phase5ScheduleApiClient";
import { withTestQueryClient } from "./testQueryClient";

const projectId = "project-phase4-main";

function createCurrentTenant(permissions = ["tenant.read", "project.read", "task.read", "audit.read"]): CurrentTenantDto {
  return {
    tenant: {
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    },
    actor: {
      id: "project-manager-a",
      displayName: "Руководитель проекта",
      accessProfileId: "profile-project-manager-a"
    },
    labels: {},
    permissions
  };
}

function createSchedule(): ProjectScheduleDto {
  return {
    schedulePlan: {
      id: `schedule-plan-${projectId}`,
      tenantId: "tenant-a",
      projectId,
      version: 4,
      baselineId: "baseline-phase5-draft",
      status: "active",
      wbsNodes: [
        {
          id: "wbs-stage-initiation",
          tenantId: "tenant-a",
          projectId,
          stageId: `${projectId}:stage-initiation`,
          sortOrder: 10
        },
        {
          id: "wbs-task-kickoff",
          tenantId: "tenant-a",
          projectId,
          parentId: "wbs-stage-initiation",
          taskId: "task-phase5-kickoff",
          sortOrder: 20,
          schedule: {
            plannedStartDate: "2026-06-01",
            plannedFinishDate: "2026-06-03",
            durationDays: 3
          },
          plannedWorkHours: 12,
          progressPercent: 40
        }
      ],
      dependencies: []
    },
    baseline: {
      id: "baseline-phase5-draft",
      tenantId: "tenant-a",
      projectId,
      schedulePlanId: `schedule-plan-${projectId}`,
      createdBy: "project-manager-a",
      createdAt: "2026-05-15T15:00:00.000Z",
      taskBaselineValues: [
        {
          taskId: "task-phase5-kickoff",
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-03",
          durationDays: 3,
          progressPercent: 40
        }
      ]
    },
    validationIssues: [
      {
        code: "finish_to_start_conflict",
        severity: "blocking",
        message: "Successor task starts before predecessor task finishes.",
        nodeId: "wbs-task-kickoff",
        dependencyId: "dependency-phase5",
        fieldRefs: ["plannedStartDate", "plannedFinishDate"]
      }
    ]
  };
}

function createAudit(actionExecutions: ScheduleActionExecutionDto[] = []): ProjectScheduleAuditDto {
  return {
    events: [],
    actionExecutions:
      actionExecutions.length > 0
        ? actionExecutions
        : [
            {
              id: "action-schedule-1",
              tenantId: "tenant-a",
              actorId: "project-manager-a",
              commandType: "schedule.task.update",
              requiredPermission: "task.write",
              status: "succeeded",
              source: { entityType: "project", entityId: projectId },
              target: { entityType: "task", entityId: "task-phase5-kickoff" },
              before: null,
              after: null,
              timestamp: "2026-05-15T15:00:00.000Z",
              correlationId: "schedule-project-phase4-main-1",
              trace: ["schedule:task schedule fields updated"]
            }
          ]
  };
}

function createApiClient(schedule: ProjectScheduleDto = createSchedule()): Phase5ScheduleApiClient {
  return {
    getProjectSchedule: vi.fn(async () => schedule),
    getProjectScheduleAudit: vi.fn(async () => createAudit()),
    createScheduleTask: vi.fn(),
    updateScheduleTask: vi.fn(),
    createFinishToStartDependency: vi.fn(),
    captureBaseline: vi.fn()
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function cloneSchedule(schedule: ProjectScheduleDto): ProjectScheduleDto {
  return structuredClone(schedule);
}

function createMutableApiClient() {
  let schedule = cloneSchedule(createSchedule());
  let actionExecutions = createAudit().actionExecutions;

  const apiClient: Phase5ScheduleApiClient = {
    getProjectSchedule: vi.fn(async () => cloneSchedule(schedule)),
    getProjectScheduleAudit: vi.fn(async () => createAudit(actionExecutions)),
    createScheduleTask: vi.fn(async (_testUser, nextProjectId, input) => {
      const taskId = input.id ?? `${nextProjectId}:schedule-task:test`;
      schedule = {
        ...schedule,
        schedulePlan: {
          ...schedule.schedulePlan,
          version: schedule.schedulePlan.version + 1,
          wbsNodes: [
            ...schedule.schedulePlan.wbsNodes,
            {
              id: `wbs-${taskId}`,
              tenantId: "tenant-a",
              projectId: nextProjectId,
              parentId: "wbs-stage-initiation",
              taskId,
              sortOrder: 30,
              schedule: {
                plannedStartDate: input.plannedStartDate,
                plannedFinishDate: input.plannedFinishDate,
                durationDays: 2
              },
              plannedWorkHours: input.plannedWorkHours,
              progressPercent: input.progressPercent
            }
          ]
        },
        validationIssues: []
      };
      actionExecutions = [
        ...actionExecutions,
        {
          id: `action-create-${taskId}`,
          tenantId: "tenant-a",
          actorId: "project-manager-a",
          commandType: "schedule.task.create",
          requiredPermission: "task.write",
          status: "succeeded",
          source: { entityType: "project", entityId: nextProjectId },
          target: { entityType: "task", entityId: taskId },
          before: null,
          after: { taskId },
          timestamp: "2026-05-15T15:01:00.000Z",
          correlationId: `schedule-create-${taskId}`,
          trace: ["schedule:canonical task created"]
        }
      ];

      return {
        task: { id: taskId, projectId: nextProjectId },
        ...cloneSchedule(schedule),
        actionExecution: actionExecutions.at(-1) as ScheduleActionExecutionDto
      };
    }),
    updateScheduleTask: vi.fn(async (_testUser, nextProjectId, taskId, input) => {
      schedule = {
        ...schedule,
        schedulePlan: {
          ...schedule.schedulePlan,
          version: schedule.schedulePlan.version + 1,
          wbsNodes: schedule.schedulePlan.wbsNodes.map((node) =>
            node.taskId === taskId
              ? {
                  ...node,
                  schedule: {
                    plannedStartDate: input.plannedStartDate,
                    plannedFinishDate: input.plannedFinishDate,
                    durationDays: 1
                  },
                  plannedWorkHours: input.plannedWorkHours,
                  progressPercent: input.progressPercent
                }
              : node
          )
        }
      };

      return {
        task: { id: taskId, projectId: nextProjectId },
        ...cloneSchedule(schedule),
        actionExecution: createAudit().actionExecutions[0]
      };
    }),
    createFinishToStartDependency: vi.fn(async (_testUser, nextProjectId, input) => {
      schedule = {
        ...schedule,
        schedulePlan: {
          ...schedule.schedulePlan,
          dependencies: [
            ...schedule.schedulePlan.dependencies,
            {
              id: input.id ?? `dependency-${input.predecessorTaskId}-${input.successorTaskId}`,
              tenantId: "tenant-a",
              projectId: nextProjectId,
              predecessorTaskId: input.predecessorTaskId,
              successorTaskId: input.successorTaskId,
              type: "finish_to_start"
            }
          ]
        },
        validationIssues: []
      };

      return {
        dependency: schedule.schedulePlan.dependencies.at(-1),
        ...cloneSchedule(schedule),
        actionExecution: createAudit().actionExecutions[0]
      };
    }),
    captureBaseline: vi.fn(async (_testUser, nextProjectId, input) => {
      schedule = {
        ...schedule,
        schedulePlan: {
          ...schedule.schedulePlan,
          baselineId: input.id ?? "baseline-phase5-ui"
        },
        baseline: {
          id: input.id ?? "baseline-phase5-ui",
          tenantId: "tenant-a",
          projectId: nextProjectId,
          schedulePlanId: schedule.schedulePlan.id,
          createdBy: "project-manager-a",
          createdAt: "2026-05-15T15:02:00.000Z",
          taskBaselineValues: schedule.schedulePlan.wbsNodes
            .filter((node) => node.taskId !== undefined)
            .map((node) => ({
              taskId: node.taskId as string,
              plannedStartDate: node.schedule?.plannedStartDate,
              plannedFinishDate: node.schedule?.plannedFinishDate,
              durationDays: node.schedule?.durationDays,
              progressPercent: node.progressPercent
            }))
        }
      };

      return {
        ...cloneSchedule(schedule),
        actionExecution: createAudit().actionExecutions[0]
      };
    })
  };

  return apiClient;
}

describe("Gantt control surface", () => {
  it("renders WBS schedule rows, baseline values, validation warnings, and audit evidence", async () => {
    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={createApiClient()}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-surface")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("gantt-status")).toHaveTextContent("Гантт загружен");
    });

    const row = screen.getByTestId("gantt-row-task-phase5-kickoff");
    expect(row).toHaveTextContent("task-phase5-kickoff");
    expect(row).toHaveTextContent("2026-06-01");
    expect(row).toHaveTextContent("2026-06-03");
    expect(row).toHaveTextContent("12");
    expect(row).toHaveTextContent("40");
    expect(row).toHaveTextContent("finish_to_start_conflict");
    expect(screen.getByTestId("gantt-wbs-table")).toHaveTextContent("project-phase4-main:stage-initiation");
    expect(screen.getByTestId("gantt-bars")).toHaveTextContent("task-phase5-kickoff");
    expect(screen.getByTestId("gantt-action-evidence")).toHaveTextContent("Расписание обновлено");
  });

  it("keeps the schedule visible when audit readback is temporarily unavailable", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.getProjectScheduleAudit).mockRejectedValueOnce(new Error("Audit readback unavailable"));

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-row-task-phase5-kickoff")).toHaveTextContent("task-phase5-kickoff");
    expect(screen.getByTestId("gantt-status")).toHaveTextContent("Гантт загружен, аудит временно недоступен");
    expect(screen.queryByTestId("gantt-error-state")).not.toBeInTheDocument();
    expect(screen.getByTestId("gantt-action-evidence")).toHaveTextContent("Действий пока нет");
  });

  it("shows a denied state without calling schedule APIs when user cannot read schedule", async () => {
    const apiClient = createApiClient();

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(["tenant.read"])}
        testUser="readonly-observer-a"
      />
    ));

    expect(await screen.findByTestId("gantt-denied")).toHaveTextContent("Нет доступа к Гантту");
    expect(apiClient.getProjectSchedule).not.toHaveBeenCalled();
  });

  it("opens a selected project from the portfolio entrypoint", async () => {
    const apiClient = createApiClient({
      ...createSchedule(),
      schedulePlan: {
        ...createSchedule().schedulePlan,
        projectId: "project-phase5-selected",
        wbsNodes: []
      },
      validationIssues: [],
      baseline: undefined
    });

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    ));

    const input = await screen.findByLabelText("ID проекта для Гантта");
    fireEvent.change(input, { target: { value: "project-phase5-selected" } });
    fireEvent.click(screen.getByRole("button", { name: "Открыть Гантт" }));

    await waitFor(() => {
      expect(apiClient.getProjectSchedule).toHaveBeenLastCalledWith("project-manager-a", "project-phase5-selected");
    });
    expect(within(screen.getByTestId("gantt-empty-state")).getByText("В расписании пока нет задач")).toBeInTheDocument();
  });

  it("reloads the active project when the entrypoint asks for the same project again", async () => {
    const apiClient = createApiClient();
    const { rerender } = render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        projectId={projectId}
        refreshKey={0}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-row-task-phase5-kickoff")).toBeInTheDocument();
    rerender(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        projectId={projectId}
        refreshKey={1}
        testUser="project-manager-a"
      />
    ));

    await waitFor(() => {
      expect(apiClient.getProjectSchedule).toHaveBeenCalledTimes(2);
    });
  });

  it("renders loading and error states without showing the empty schedule message", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.getProjectSchedule).mockRejectedValueOnce(new Error("API расписания недоступен"));

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-loading-state")).toHaveTextContent("Получаем WBS");
    expect(screen.queryByTestId("gantt-empty-state")).not.toBeInTheDocument();
    expect(await screen.findByTestId("gantt-error-state")).toHaveTextContent("API расписания недоступен");
    expect(screen.queryByTestId("gantt-empty-state")).not.toBeInTheDocument();
  });

  it("creates canonical tasks, edits schedule fields, creates FS dependencies, and reloads from API readback", async () => {
    const apiClient = createMutableApiClient();

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant([
          "tenant.read",
          "project.read",
          "task.read",
          "task.write",
          "audit.read"
        ])}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-row-task-phase5-kickoff")).toHaveTextContent("task-phase5-kickoff");
    fireEvent.change(screen.getByLabelText("ID новой задачи"), { target: { value: "task-phase5-created" } });
    fireEvent.change(screen.getByLabelText("Старт новой задачи"), { target: { value: "2026-06-04" } });
    fireEvent.change(screen.getByLabelText("Финиш новой задачи"), { target: { value: "2026-06-05" } });
    fireEvent.change(screen.getByLabelText("Плановая работа новой задачи"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Прогресс новой задачи"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать задачу в Гантте" }));

    expect(await screen.findByTestId("gantt-row-task-phase5-created")).toHaveTextContent("task-phase5-created");
    expect(apiClient.createScheduleTask).toHaveBeenCalledWith(
      "project-manager-a",
      projectId,
      expect.objectContaining({
        id: "task-phase5-created",
        plannedStartDate: "2026-06-04",
        plannedFinishDate: "2026-06-05",
        plannedWorkHours: 8,
        progressPercent: 0
      })
    );
    await waitFor(() => {
      expect(apiClient.getProjectSchedule).toHaveBeenCalledTimes(2);
    });

    fireEvent.change(screen.getByLabelText("Старт task-phase5-created"), { target: { value: "2026-06-06" } });
    fireEvent.change(screen.getByLabelText("Финиш task-phase5-created"), { target: { value: "2026-06-06" } });
    fireEvent.change(screen.getByLabelText("Работа task-phase5-created"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Прогресс task-phase5-created"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить task-phase5-created" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Старт task-phase5-created")).toHaveValue("2026-06-06");
    });
    expect(screen.getByLabelText("Прогресс task-phase5-created")).toHaveValue(25);
    expect(screen.getByTestId("gantt-row-task-phase5-created")).toHaveTextContent("1");
    await waitFor(() => {
      expect(apiClient.getProjectSchedule).toHaveBeenCalledTimes(3);
    });
    expect(apiClient.updateScheduleTask).toHaveBeenCalledWith(
      "project-manager-a",
      projectId,
      "task-phase5-created",
      {
        plannedStartDate: "2026-06-06",
        plannedFinishDate: "2026-06-06",
        plannedWorkHours: 6,
        progressPercent: 25
      }
    );

    fireEvent.change(screen.getByLabelText("Предшественник FS"), { target: { value: "task-phase5-kickoff" } });
    fireEvent.change(screen.getByLabelText("Последователь FS"), { target: { value: "task-phase5-created" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать FS-связь" }));

    await waitFor(() => {
      expect(apiClient.createFinishToStartDependency).toHaveBeenCalledWith(
        "project-manager-a",
        projectId,
        expect.objectContaining({
          predecessorTaskId: "task-phase5-kickoff",
          successorTaskId: "task-phase5-created",
          type: "finish_to_start"
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Зафиксировать базовый план" }));
    await waitFor(() => {
      expect(apiClient.captureBaseline).toHaveBeenCalledWith(
        "project-manager-a",
        projectId,
        expect.objectContaining({ id: "baseline-project-phase4-main-draft" })
      );
    });
    expect(screen.getByTestId("gantt-row-task-phase5-kickoff")).toHaveTextContent("2026-06-01 / 2026-06-03 / 3 / 40%");
  });

  it("shows pending command feedback and blocks project switching until API readback completes", async () => {
    const apiClient = createApiClient();
    const createTaskDeferred = createDeferred<ScheduleCommandResultDto>();
    vi.mocked(apiClient.createScheduleTask).mockReturnValueOnce(createTaskDeferred.promise);

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant([
          "tenant.read",
          "project.read",
          "task.read",
          "task.write",
          "audit.read"
        ])}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-row-task-phase5-kickoff")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Создать задачу в Гантте" }));

    await waitFor(() => {
      expect(screen.getByTestId("gantt-status")).toHaveTextContent("Создание задачи через API");
    });
    expect(screen.getByLabelText("ID проекта для Гантта")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Открыть Гантт" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Создать задачу в Гантте" })).toBeDisabled();
    expect(screen.getByTestId("gantt-status")).not.toHaveTextContent("Задача создана через API");

    createTaskDeferred.resolve({
      ...createSchedule(),
      actionExecution: createAudit().actionExecutions[0]
    });

    await waitFor(() => {
      expect(screen.getByTestId("gantt-status")).toHaveTextContent("Задача создана через API");
    });
    expect(screen.getByLabelText("ID проекта для Гантта")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Открыть Гантт" })).not.toBeDisabled();
    expect(apiClient.getProjectSchedule).toHaveBeenCalledTimes(2);
  });

  it("shows denied and validation states for schedule commands without local-only mutation", async () => {
    const apiClient = createApiClient();

    const { unmount } = render(withTestQueryClient(
      <GanttControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(["tenant.read", "project.read", "task.read", "audit.read"])}
        testUser="readonly-observer-a"
      />
    ));

    expect(await screen.findByTestId("gantt-command-denied")).toHaveTextContent("Изменение расписания недоступно по правам");
    expect(screen.queryByRole("button", { name: "Создать задачу в Гантте" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Старт task-phase5-kickoff")).not.toBeInTheDocument();
    expect(apiClient.createScheduleTask).not.toHaveBeenCalled();
    unmount();

    const validationIssue: ScheduleValidationIssueDto = {
      code: "finish_to_start_conflict",
      severity: "blocking",
      message: "Successor task starts before predecessor task finishes.",
      dependencyId: "dependency-invalid",
      fieldRefs: ["plannedStartDate", "plannedFinishDate"]
    };
    const writerClient = createMutableApiClient();
    vi.mocked(writerClient.createFinishToStartDependency).mockRejectedValueOnce(
      Object.assign(new Error("Команда расписания заблокирована"), {
        code: "precondition_failed",
        validationIssues: [validationIssue]
      })
    );

    render(withTestQueryClient(
      <GanttControlSurface
        apiClient={writerClient}
        currentTenant={createCurrentTenant([
          "tenant.read",
          "project.read",
          "task.read",
          "task.write",
          "audit.read"
        ])}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("gantt-row-task-phase5-kickoff")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Предшественник FS"), { target: { value: "task-phase5-kickoff" } });
    fireEvent.change(screen.getByLabelText("Последователь FS"), { target: { value: "task-phase5-kickoff" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать FS-связь" }));

    expect(await screen.findByTestId("gantt-command-issues")).toHaveTextContent("finish_to_start_conflict");
    expect(screen.getByTestId("gantt-command-issues")).toHaveTextContent("Команда расписания заблокирована");
    expect(screen.getByTestId("gantt-command-issues")).toHaveTextContent("Последователь начинается раньше завершения предшественника");
    expect(screen.getByTestId("gantt-command-issues")).not.toHaveTextContent("Successor task starts before predecessor task finishes");
  });
});
