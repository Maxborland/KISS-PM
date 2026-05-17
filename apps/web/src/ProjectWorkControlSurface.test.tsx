import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectWorkControlSurface } from "./ProjectWorkControlSurface";
import { createPhase4ProjectWorkApiClient } from "./phase4ProjectWorkApiClient";
import type {
  KanbanProjectDto,
  ManagedProjectDto,
  Phase4ProjectWorkApiClient,
  TaskDto,
  TaskParticipantRole
} from "./phase4ProjectWorkApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

const projectId = "project-phase4-main";
const stageInitiationId = `${projectId}:stage-initiation`;
const stageDeliveryId = `${projectId}:stage-delivery`;
const taskId = "task-phase4-kickoff";

function createProject(stageStatus: "blocked" | "active" = "blocked", tasks: TaskDto[] = []): ManagedProjectDto {
  return {
    id: projectId,
    tenantId: "tenant-a",
    title: "Внедрение портала АКМЕ",
    lifecycleStatus: "active",
    currentStageId: stageStatus === "active" ? stageDeliveryId : stageInitiationId,
    sourceDraftId: "project-draft-opportunity-seed-ready",
    sourceOpportunity: {
      type: "crm_opportunity",
      opportunityId: "opportunity-seed-ready",
      title: "Внедрение портала АКМЕ",
      contactIds: ["contact-opportunity-seed-ready"],
      plannedStartDate: "2026-06-01",
      desiredFinishDate: "2026-06-30"
    },
    processTemplateSnapshot: {
      templateId: "process-template-integrations-tenant-a",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 2,
      active: true,
      updatedAt: "2026-05-15T09:50:00+07:00",
      stageTemplates: [
        {
          id: "stage-initiation",
          key: "initiation",
          label: "Инициация",
          version: 1,
          requiredArtifactTemplates: [
            {
              id: "artifact-charter",
              key: "project_charter",
              label: "Паспорт проекта",
              required: true
            }
          ],
          approvalTemplates: [
            {
              id: "approval-charter",
              key: "charter_approval",
              label: "Согласование паспорта",
              approverRoleKey: "project_principal",
              required: true
            }
          ],
          taskTemplates: [
            {
              id: "task-template-kickoff",
              key: "kickoff",
              label: "Провести старт проекта",
              defaultParticipantRoleKeys: ["executor", "controller"],
              required: true
            }
          ]
        },
        {
          id: "stage-delivery",
          key: "delivery",
          label: "Исполнение",
          version: 1,
          requiredArtifactTemplates: [],
          approvalTemplates: [],
          taskTemplates: [
            {
              id: "task-template-delivery",
              key: "delivery_work",
              label: "Выполнить поставку",
              defaultParticipantRoleKeys: ["executor"],
              required: true
            }
          ]
        }
      ]
    },
    stages: [
      {
        id: stageInitiationId,
        tenantId: "tenant-a",
        projectId,
        templateId: "stage-initiation",
        templateKey: "initiation",
        templateVersion: 1,
        label: "Инициация",
        sortOrder: 10,
        status: stageStatus === "active" ? "completed" : "active"
      },
      {
        id: stageDeliveryId,
        tenantId: "tenant-a",
        projectId,
        templateId: "stage-delivery",
        templateKey: "delivery",
        templateVersion: 1,
        label: "Исполнение",
        sortOrder: 20,
        status: stageStatus === "active" ? "active" : "pending"
      }
    ],
    stageHistory: [],
    tasks,
    taskParticipants: tasks.length
      ? [
          {
            id: "participant-kickoff-executor",
            tenantId: "tenant-a",
            projectId,
            stageId: stageInitiationId,
            taskId,
            userId: "executor-a",
            role: "executor",
            addedBy: "project-manager-a",
            addedAt: "2026-05-15T10:05:00.000Z",
            correlationId: "corr-participant-executor"
          },
          {
            id: "participant-kickoff-controller",
            tenantId: "tenant-a",
            projectId,
            stageId: stageInitiationId,
            taskId,
            userId: "project-manager-a",
            role: "controller",
            addedBy: "project-manager-a",
            addedAt: "2026-05-15T10:06:00.000Z",
            correlationId: "corr-participant-controller"
          }
        ]
      : [],
    taskComments: [],
    taskStatusHistory: [],
    artifacts: [],
    approvalRequests: [],
    createdBy: "project-manager-a",
    createdAt: "2026-05-15T10:01:00.000Z",
    updatedAt: "2026-05-15T10:01:00.000Z",
    correlationId: `corr-project-from-template-${projectId}`
  };
}

function createTask(status: TaskDto["status"] = "todo"): TaskDto {
  return {
    id: taskId,
    tenantId: "tenant-a",
    projectId,
    stageId: stageInitiationId,
    title: "Провести старт проекта",
    status,
    dueDate: "2026-06-05",
    plannedWorkHours: 12,
    sourceTemplate: {
      type: "stage_task_template",
      processTemplateId: "process-template-integrations-tenant-a",
      processTemplateKey: "implementation.integration_heavy",
      processTemplateVersion: 2,
      stageTemplateId: "stage-initiation",
      stageTemplateKey: "initiation",
      stageTemplateVersion: 1,
      taskTemplateId: "task-template-kickoff",
      taskTemplateKey: "kickoff",
      taskTemplateVersion: 1,
      defaultParticipantRoleKeys: ["executor", "controller"]
    },
    createdBy: "project-manager-a",
    createdAt: "2026-05-15T10:07:00.000Z",
    updatedAt: "2026-05-15T10:07:00.000Z",
    correlationId: `corr-task-create-${taskId}`
  };
}

function createImportedProject(tasks: TaskDto[] = []): ManagedProjectDto {
  const importedProjectId = "imported-project-p11-ui";
  const importedStageId = `${importedProjectId}:stage-initiation`;

  return {
    ...createProject("blocked", tasks),
    id: importedProjectId,
    title: "Импорт: API проект",
    sourceDraftId: "imported-draft-p11-ui",
    sourceOpportunity: {
      type: "crm_opportunity",
      opportunityId: "imported-opportunity-p11-ui",
      title: "Импорт: API сделка",
      contactIds: ["imported-contact-p11-ui"],
      plannedStartDate: "2026-12-01",
      desiredFinishDate: "2026-12-31"
    },
    stages: createProject("blocked", []).stages.map((stage) => ({
      ...stage,
      projectId: importedProjectId,
      id: stage.templateKey === "initiation" ? importedStageId : `${importedProjectId}:stage-${stage.templateKey}`
    })),
    currentStageId: importedStageId,
    tasks,
    taskParticipants: [],
    createdBy: "tenant-admin-a",
    correlationId: "corr-imported-project-p11-ui"
  };
}

function createImportedTask(status: TaskDto["status"] = "todo"): TaskDto {
  const importedProjectId = "imported-project-p11-ui";
  const importedStageId = `${importedProjectId}:stage-initiation`;

  return {
    ...createTask(status),
    id: "imported-task-p11-ui",
    projectId: importedProjectId,
    stageId: importedStageId,
    title: "API imported task",
    dueDate: "2026-12-15",
    plannedWorkHours: 16,
    createdBy: "tenant-admin-a",
    correlationId: "corr-imported-task-p11-ui"
  };
}

function createKanban(tasks: TaskDto[]): KanbanProjectDto {
  const statuses: TaskDto["status"][] = ["todo", "in_progress", "blocked", "done", "cancelled"];

  return {
    projectId,
    columns: statuses.map((status) => ({
      status,
      tasks: tasks.filter((task) => task.status === status)
    }))
  };
}

function createCurrentTenant(
  permissions?: string[],
  actor: CurrentTenantDto["actor"] = {
    id: "project-manager-a",
    displayName: "Руководитель проекта",
    accessProfileId: "profile-project-manager-a"
  }
): CurrentTenantDto {
  return {
    tenant: {
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    },
    actor,
    labels: {},
    permissions:
      permissions ?? [
        "tenant.read",
        "project.create_from_template",
        "project.read",
        "project.lifecycle.transition",
        "project.artifact.write",
        "project.approval.write",
        "task.read",
        "task.write",
        "task.status.write",
        "task.comment.write",
        "audit.read"
      ]
  };
}

function createApiClient(options: { initialTaskStatus?: TaskDto["status"] } = {}): Phase4ProjectWorkApiClient {
  let task: TaskDto | null = options.initialTaskStatus ? createTask(options.initialTaskStatus) : null;
  let project: ManagedProjectDto | null = task ? createProject("blocked", [task]) : null;

  const apiClient: Phase4ProjectWorkApiClient = {
    ensureProjectDraft: vi.fn(async () => ({
      id: "project-draft-opportunity-seed-ready",
      status: "draft"
    })),
    createProjectFromTemplate: vi.fn(async () => {
      project = createProject("blocked", task ? [task] : []);
      return project;
    }),
    getProject: vi.fn(async () => {
      if (!project) {
        throw Object.assign(new Error("Объект не найден"), { code: "not_found" });
      }

      return project;
    }),
    transitionProjectStage: vi.fn(async () => {
      if (!project) throw new Error("project required");
      if (project.artifacts.length === 0 || project.approvalRequests.length === 0) {
        throw Object.assign(new Error("Условия перехода не выполнены"), {
          code: "precondition_failed",
          transitionError: {
            code: "stage_gate_blocked",
            message: "Условия перехода не выполнены",
            blockers: [
              {
                code: "missing_required_artifact",
                message: "Нужен паспорт проекта",
                stageId: stageInitiationId,
                templateId: "artifact-charter",
                templateKey: "project_charter"
              },
              {
                code: "required_approval_not_approved",
                message: "Нужно согласование паспорта",
                stageId: stageInitiationId,
                templateId: "approval-charter",
                templateKey: "charter_approval"
              }
            ]
          }
        });
      }

      project = {
        ...createProject("active", task ? [task] : []),
        artifacts: project.artifacts,
        approvalRequests: project.approvalRequests
      };
      return project;
    }),
    recordArtifact: vi.fn(async () => {
      if (!project) throw new Error("project required");
      project = {
        ...project,
        artifacts: [
          {
            id: "artifact-phase4-charter",
            tenantId: "tenant-a",
            projectId,
            stageId: stageInitiationId,
            templateId: "artifact-charter",
            templateKey: "project_charter",
            status: "accepted",
            evidenceRef: "artifact://phase4/charter",
            actorId: "project-manager-a",
            occurredAt: "2026-05-15T10:08:00.000Z"
          }
        ]
      };
      return project;
    }),
    recordApproval: vi.fn(async () => {
      if (!project) throw new Error("project required");
      project = {
        ...project,
        approvalRequests: [
          {
            id: "approval-phase4-charter",
            tenantId: "tenant-a",
            projectId,
            stageId: stageInitiationId,
            templateId: "approval-charter",
            templateKey: "charter_approval",
            requestedBy: "project-manager-a",
            requestedAt: "2026-05-15T10:09:00.000Z",
            status: "approved",
            decidedBy: "project-manager-a",
            decidedAt: "2026-05-15T10:10:00.000Z"
          }
        ]
      };
      return project;
    }),
    listProjectTasks: vi.fn(async () => (task ? [task] : [])),
    createProjectTask: vi.fn(async () => {
      task = createTask("todo");
      project = project ? { ...project, tasks: [task] } : createProject("blocked", [task]);
      return {
        task,
        participants: project.taskParticipants,
        project
      };
    }),
    changeTaskStatus: vi.fn(async () => {
      if (!task) throw new Error("task required");
      task = createTask("in_progress");
      project = project ? { ...project, tasks: [task] } : createProject("blocked", [task]);
      return {
        task,
        statusHistory: [
          {
            id: `${taskId}:status:1`,
            tenantId: "tenant-a",
            projectId,
            stageId: stageInitiationId,
            taskId,
            fromStatus: "todo" as const,
            toStatus: "in_progress" as const,
            actorId: "executor-a",
            changedAt: "2026-05-15T10:12:00.000Z",
            correlationId: `corr-task-status-${taskId}-in_progress`
          }
        ]
      };
    }),
    addTaskComment: vi.fn(async () => ({
      id: `${taskId}:comment:1`,
      tenantId: "tenant-a",
      projectId,
      stageId: stageInitiationId,
      taskId,
      body: "Начал работу",
      authorId: "executor-a",
      createdAt: "2026-05-15T10:13:00.000Z",
      correlationId: `corr-task-comment-${taskId}`
    })),
    listMyTasks: vi.fn(async (queueUser, roles) => {
      if (!task) return [];
      if (queueUser === "executor-a" && roles?.includes("executor")) {
        return [{ ...task, relationRoles: ["executor" as const] }];
      }
      if (queueUser === "project-manager-a" && roles?.includes("controller")) {
        return [{ ...task, relationRoles: ["controller" as const] }];
      }

      return [];
    }),
    getKanbanProject: vi.fn(async () => createKanban(task ? [task] : [])),
    listAuditEventsForTarget: vi.fn(async () =>
      task?.status === "in_progress"
        ? [
            {
              id: "audit-task-status",
              tenantId: "tenant-a",
              actorId: "executor-a",
              actionKey: "task.status.change",
              target: { entityType: "task", entityId: taskId },
              result: "success",
              timestamp: "2026-05-15T10:12:00.000Z",
              correlationId: `corr-api-task-status-${taskId}`
            }
          ]
        : []
    )
  };

  return apiClient;
}

describe("Project Work Control surface", () => {
  it("treats an existing project draft conflict as a usable deterministic draft id", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/crm/opportunities/opportunity-seed-ready/project-draft")) {
        return Response.json({ code: "conflict", message: "Черновик уже существует" }, { status: 409 });
      }
      if (url.includes("/projects/from-template")) {
        return Response.json({
          project: createProject("blocked", [])
        });
      }

      return Response.json({ code: "unexpected", message: `Unexpected request: ${url}` }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createPhase4ProjectWorkApiClient("/api");

    const draft = await client.ensureProjectDraft("project-manager-a", "opportunity-seed-ready");
    const project = await client.createProjectFromTemplate("project-manager-a", {
      projectDraftId: draft.id,
      projectId
    });

    expect(draft).toEqual({ id: "project-draft-opportunity-seed-ready", status: "draft" });
    expect(project.id).toBe(projectId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/projects/project-draft-opportunity-seed-ready"),
      expect.anything()
    );

    vi.unstubAllGlobals();
  });

  it("drives lifecycle gates, task creation, controlled tasks, Kanban, and audit readback for the current manager", async () => {
    const apiClient = createApiClient();
    const onOpenGanttProject = vi.fn();

    render(withTestQueryClient(
      <ProjectWorkControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        onOpenGanttProject={onOpenGanttProject}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("project-work-surface")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Создать управляемый проект" }));

    expect(await screen.findByTestId("managed-project-title")).toHaveTextContent("Внедрение портала АКМЕ");
    expect(screen.getByTestId("stage-progress")).toHaveTextContent("Инициация");
    fireEvent.click(screen.getByRole("button", { name: "Открыть Гантт проекта" }));
    expect(onOpenGanttProject).toHaveBeenCalledWith(projectId);

    fireEvent.click(screen.getByRole("button", { name: "Создать стартовую задачу" }));
    expect(await screen.findByTestId("project-task-list")).toHaveTextContent(taskId);
    expect(screen.getByTestId("project-task-list")).toHaveTextContent("Провести старт проекта");

    await waitFor(() => {
      expect(screen.getByTestId("my-tasks-list")).toHaveTextContent("У исполнителя пока нет задач");
      expect(screen.getByTestId("controlled-tasks-list")).toHaveTextContent(taskId);
      expect(screen.getByTestId("kanban-column-todo")).toHaveTextContent(taskId);
    });

    fireEvent.click(within(screen.getByTestId("kanban-column-todo")).getByRole("button", { name: "В работу" }));
    await waitFor(() => {
      expect(screen.getByTestId("kanban-column-in_progress")).toHaveTextContent(taskId);
    });
    expect(screen.getByTestId("task-audit-events")).toHaveTextContent("task.status.change");

    fireEvent.click(within(screen.getByTestId("kanban-column-in_progress")).getByRole("button", { name: "Комментарий" }));
    await waitFor(() => {
      expect(apiClient.addTaskComment).toHaveBeenCalledWith("project-manager-a", taskId, "Начал работу");
    });

    fireEvent.click(screen.getByRole("button", { name: "Перейти к следующей стадии" }));
    expect(await screen.findByTestId("stage-gate-blockers")).toHaveTextContent("missing_required_artifact");
    expect(screen.getByTestId("stage-gate-blockers")).toHaveTextContent("required_approval_not_approved");

    fireEvent.click(screen.getByRole("button", { name: "Принять паспорт проекта" }));
    expect(await screen.findByTestId("artifact-evidence")).toHaveTextContent("artifact-phase4-charter");
    expect(screen.getByTestId("stage-gate-blockers")).toHaveTextContent("Блокеры не обнаружены");
    fireEvent.click(screen.getByRole("button", { name: "Согласовать паспорт" }));
    expect(await screen.findByTestId("approval-evidence")).toHaveTextContent("approved");
    expect(screen.getByTestId("stage-gate-blockers")).toHaveTextContent("Блокеры не обнаружены");

    fireEvent.click(screen.getByRole("button", { name: "Перейти к следующей стадии" }));
    expect(await screen.findByTestId("stage-progress")).toHaveTextContent("Исполнение");

    expect(apiClient.createProjectTask).toHaveBeenCalledWith(
      "project-manager-a",
      projectId,
      expect.objectContaining({
        id: taskId,
        participants: expect.arrayContaining([
          expect.objectContaining({ userId: "executor-a", role: "executor" }),
          expect.objectContaining({ userId: "project-manager-a", role: "controller" })
        ])
      })
    );
    expect(apiClient.changeTaskStatus).toHaveBeenCalledWith("project-manager-a", taskId, "in_progress");
  });

  it("shows executor My Tasks and writes task commands as the logged-in executor", async () => {
    const apiClient = createApiClient({ initialTaskStatus: "todo" });

    render(withTestQueryClient(
      <ProjectWorkControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(
          ["tenant.read", "project.read", "task.read", "task.status.write", "task.comment.write"],
          {
            id: "executor-a",
            displayName: "Исполнитель",
            accessProfileId: "profile-executor-a"
          }
        )}
        testUser="executor-a"
      />
    ));

    expect(await screen.findByTestId("managed-project-title")).toHaveTextContent("Внедрение портала АКМЕ");
    await waitFor(() => {
      expect(screen.getByTestId("my-tasks-list")).toHaveTextContent(taskId);
      expect(screen.getByTestId("controlled-tasks-list")).toHaveTextContent("Контрольных задач пока нет");
      expect(screen.getByTestId("kanban-column-todo")).toHaveTextContent(taskId);
    });

    fireEvent.click(within(screen.getByTestId("kanban-column-todo")).getByRole("button", { name: "В работу" }));
    await waitFor(() => {
      expect(screen.getByTestId("kanban-column-in_progress")).toHaveTextContent(taskId);
    });
    expect(screen.getByTestId("task-audit-events")).toHaveTextContent("Аудит задачи пока пуст");
    expect(apiClient.changeTaskStatus).toHaveBeenCalledWith("executor-a", taskId, "in_progress");
    expect(apiClient.listAuditEventsForTarget).not.toHaveBeenCalled();
  });

  it("does not claim a task comment was added when the API returns no comment readback", async () => {
    const apiClient = createApiClient({ initialTaskStatus: "in_progress" });
    vi.mocked(apiClient.addTaskComment).mockResolvedValueOnce(null);

    render(withTestQueryClient(
      <ProjectWorkControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    expect(await screen.findByTestId("managed-project-title")).toHaveTextContent("Внедрение портала АКМЕ");
    fireEvent.click(within(screen.getByTestId("kanban-column-in_progress")).getByRole("button", { name: "Комментарий" }));

    expect(await screen.findByTestId("project-work-status")).toHaveTextContent("Комментарий не подтвержден API");
  });

  it("does not claim task creation when work queue readback fails", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.listProjectTasks).mockImplementation(async () => {
      if (vi.mocked(apiClient.createProjectTask).mock.calls.length > 0) {
        throw new Error("Очереди задач недоступны");
      }

      return [];
    });

    render(withTestQueryClient(
      <ProjectWorkControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Создать управляемый проект" }));
    expect(await screen.findByTestId("managed-project-title")).toHaveTextContent("Внедрение портала АКМЕ");

    fireEvent.click(screen.getByRole("button", { name: "Создать стартовую задачу" }));

    expect(await screen.findByTestId("project-work-status")).toHaveTextContent("Очереди задач недоступны");
    expect(screen.getByTestId("project-work-status")).not.toHaveTextContent("Задача создана");
  });

  it("reloads existing project work state from the API instead of relying on local component state", async () => {
    const apiClient = createApiClient();
    const { unmount } = render(withTestQueryClient(
      <ProjectWorkControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Создать управляемый проект" }));
    fireEvent.click(await screen.findByRole("button", { name: "Создать стартовую задачу" }));
    expect(await screen.findByTestId("project-task-list")).toHaveTextContent(taskId);

    unmount();
    render(withTestQueryClient(
      <ProjectWorkControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    expect(await screen.findByTestId("managed-project-title")).toHaveTextContent("Внедрение портала АКМЕ");
    expect(await screen.findByTestId("project-task-list")).toHaveTextContent(taskId);
    expect(screen.getByTestId("kanban-column-todo")).toHaveTextContent(taskId);
  });

  it("opens imported project work from canonical APIs and keeps status/audit readback after adapter disconnect", async () => {
    const importedProjectId = "imported-project-p11-ui";
    let importedTask = createImportedTask("todo");
    let importedProject = createImportedProject([importedTask]);
    const apiClient = {
      ...createApiClient(),
      getProject: vi.fn(async (_testUser: string, requestedProjectId: string) => {
        if (requestedProjectId !== importedProjectId) {
          throw Object.assign(new Error("Объект не найден"), { code: "not_found" });
        }

        return importedProject;
      }),
      listProjectTasks: vi.fn(async (_testUser: string, requestedProjectId: string) =>
        requestedProjectId === importedProjectId ? [importedTask] : []
      ),
      listMyTasks: vi.fn(async (_testUser: string, roles?: TaskParticipantRole[]) => {
        if (roles?.includes("executor")) {
          return [{ ...importedTask, relationRoles: ["executor" as const] }];
        }
        if (roles?.includes("controller")) {
          return [{ ...importedTask, relationRoles: ["controller" as const] }];
        }

        return [];
      }),
      getKanbanProject: vi.fn(async (_testUser: string, requestedProjectId: string) => ({
        ...createKanban([importedTask]),
        projectId: requestedProjectId
      })),
      changeTaskStatus: vi.fn(async (_testUser: string, requestedTaskId: string, toStatus: TaskDto["status"]) => {
        importedTask = createImportedTask(toStatus);
        importedProject = createImportedProject([importedTask]);
        return {
          task: importedTask,
          statusHistory: [
            {
              id: "imported-task-p11-ui:status:1",
              tenantId: "tenant-a",
              projectId: importedProjectId,
              stageId: `${importedProjectId}:stage-initiation`,
              taskId: requestedTaskId,
              fromStatus: "todo" as const,
              toStatus,
              actorId: "project-manager-a",
              changedAt: "2026-05-17T07:50:00.000Z",
              correlationId: "corr-imported-task-status-p11-ui"
            }
          ]
        };
      }),
      listAuditEventsForTarget: vi.fn(async () =>
        importedTask.status === "in_progress"
          ? [
              {
                id: "audit-imported-task-status",
                tenantId: "tenant-a",
                actorId: "project-manager-a",
                actionKey: "task.status.change",
                target: { entityType: "task", entityId: importedTask.id },
                result: "success",
                timestamp: "2026-05-17T07:50:00.000Z",
                correlationId: "corr-imported-task-status-p11-ui"
              }
            ]
          : []
      )
    } satisfies Phase4ProjectWorkApiClient;

    render(withTestQueryClient(
      <ProjectWorkControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant()}
        projectId={importedProjectId}
        testUser="project-manager-a"
      />
    ));

    expect(await screen.findByTestId("managed-project-title")).toHaveTextContent("Импорт: API проект");
    expect(apiClient.getProject).toHaveBeenCalledWith("project-manager-a", importedProjectId);
    await waitFor(() => {
      expect(screen.getByTestId("project-task-list")).toHaveTextContent("imported-task-p11-ui");
      expect(screen.getByTestId("project-task-list")).toHaveTextContent("API imported task");
      expect(screen.getByTestId("kanban-column-todo")).toHaveTextContent("imported-task-p11-ui");
    });

    fireEvent.click(within(screen.getByTestId("kanban-column-todo")).getByRole("button", { name: "В работу" }));

    await waitFor(() => {
      expect(screen.getByTestId("kanban-column-in_progress")).toHaveTextContent("imported-task-p11-ui");
      expect(screen.getByTestId("task-audit-events")).toHaveTextContent("task.status.change");
    });
    expect(apiClient.changeTaskStatus).toHaveBeenCalledWith("project-manager-a", "imported-task-p11-ui", "in_progress");
    expect(apiClient.listProjectTasks).toHaveBeenCalledWith("project-manager-a", importedProjectId);
    expect(apiClient.getKanbanProject).toHaveBeenCalledWith("project-manager-a", importedProjectId);
  });

  it("shows a clear denied state when a read-only actor tries the governed project command", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.createProjectFromTemplate).mockRejectedValueOnce(
      Object.assign(new Error("Доступ запрещен"), { code: "permission_denied" })
    );

    render(withTestQueryClient(
      <ProjectWorkControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(["tenant.read", "project.read", "task.read"])}
        testUser="readonly-observer-a"
      />
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Проверить запрет создания проекта" }));

    expect(await screen.findByTestId("project-work-status")).toHaveTextContent("Доступ запрещен");
    expect(apiClient.createProjectFromTemplate).toHaveBeenCalledWith(
      "readonly-observer-a",
      expect.objectContaining({
        projectDraftId: "project-draft-opportunity-seed-ready"
      })
    );
    expect(apiClient.ensureProjectDraft).not.toHaveBeenCalled();
  });
});
