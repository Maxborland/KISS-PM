import { describe, expect, it } from "vitest";

import type { Project, Task, TaskStatusDefinition, WorkspaceUser } from "./api";
import {
  canCommentTask,
  canEditTaskFields,
  filterTasks,
  getNextTaskStatusAction,
  getTaskStatusTransitionState,
  getTaskCounters,
  groupTasksByStatus
} from "./taskWorkspace";

const users: WorkspaceUser[] = [
  makeUser("user-admin", "Анна Администратор"),
  makeUser("user-executor", "Майя Воронова")
];

const projects: Project[] = [
  {
    id: "project-crm",
    tenantId: "tenant",
    sourceOpportunityId: "opp",
    clientId: "client",
    projectTypeId: "type",
    title: "CRM intake",
    clientName: "ООО Ромашка",
    status: "active",
    plannedStart: "2026-05-20",
    plannedFinish: "2026-06-20",
    contractValue: 960000,
    plannedHours: 160,
    templateId: null,
    createdAt: "2026-05-20T00:00:00Z",
    activatedAt: "2026-05-20T00:00:00Z",
    demand: []
  }
];

const statuses: TaskStatusDefinition[] = [
  makeStatus("task-status-new", "Новая", "new", 10, true),
  makeStatus("task-status-waiting", "Ожидает", "waiting", 20, false),
  makeStatus("task-status-progress", "В работе", "in_progress", 30, false),
  makeStatus("task-status-review", "На контроле", "review", 40, false),
  makeStatus("task-status-done", "Выполнено", "done", 50, true)
];

describe("task workspace helpers", () => {
  it("filters by due date, role, status, project and task internals", () => {
    const tasks = [
      makeTask("task-1", {
        title: "Подготовить ресурсную оценку",
        statusId: "task-status-progress",
        statusCategory: "in_progress",
        plannedFinish: "2026-05-20",
        participants: [{ userId: "user-executor", role: "executor" }]
      }),
      makeTask("task-2", {
        title: "Закрыть smoke замечание",
        description: "Канбан",
        statusId: "task-status-done",
        statusCategory: "done",
        plannedFinish: "2026-05-18",
        participants: [{ userId: "user-executor", role: "observer" }]
      })
    ];

    const result = filterTasks(tasks, {
      due: "today",
      role: "executor",
      statusId: "task-status-progress",
      projectId: "project-crm",
      query: "ресурсную майя"
    }, {
      currentUserId: "user-executor",
      projects,
      users,
      today: "2026-05-20"
    });

    expect(result.map((task) => task.id)).toEqual(["task-1"]);
  });

  it("groups tasks by tenant statuses in configured order", () => {
    const tasks = [
      makeTask("task-1", { statusId: "task-status-progress", statusCategory: "in_progress" }),
      makeTask("task-2", { statusId: "task-status-new", statusCategory: "new" })
    ];

    expect(groupTasksByStatus(tasks, statuses).map((group) => ({
      status: group.status.name,
      tasks: group.tasks.map((task) => task.id)
    }))).toEqual([
      { status: "Новая", tasks: ["task-2"] },
      { status: "Ожидает", tasks: [] },
      { status: "В работе", tasks: ["task-1"] },
      { status: "На контроле", tasks: [] },
      { status: "Выполнено", tasks: [] }
    ]);
  });

  it("keeps task fields read-only except requester or task edit permission", () => {
    const task = makeTask("task-1", {
      requesterUserId: "user-admin",
      participants: [{ userId: "user-executor", role: "executor" }]
    });

    expect(canEditTaskFields(task, "user-executor", [])).toBe(false);
    expect(canEditTaskFields(task, "user-admin", [])).toBe(true);
    expect(canEditTaskFields(task, "user-executor", ["tenant.tasks.edit"])).toBe(true);
    expect(canCommentTask(task, "user-executor", [])).toBe(true);
  });

  it("sends executor to review when acceptance is required", () => {
    const task = makeTask("task-1", {
      statusId: "task-status-progress",
      statusCategory: "in_progress",
      requesterUserId: "user-admin",
      ownerUserId: "user-executor",
      requiresAcceptance: true,
      participants: [{ userId: "user-executor", role: "executor" }]
    });

    expect(getNextTaskStatusAction(task, statuses, "user-executor", [])).toMatchObject({
      label: "На контроль",
      statusId: "task-status-review",
      category: "review"
    });
    expect(getNextTaskStatusAction(task, statuses, "user-admin", [])).toMatchObject({
      label: "Закрыть",
      statusId: "task-status-done",
      category: "done"
    });
  });

  it("keeps the status rail honest by disabling impossible transitions", () => {
    const task = makeTask("task-1", {
      statusId: "task-status-progress",
      statusName: "В работе",
      statusCategory: "in_progress",
      requesterUserId: "user-admin",
      ownerUserId: "user-executor",
      requiresAcceptance: true,
      participants: [{ userId: "user-executor", role: "executor" }]
    });

    expect(
      getTaskStatusTransitionState(
        task,
        statuses.find((status) => status.id === "task-status-review")!,
        "user-executor",
        []
      )
    ).toEqual({ canTransition: true });
    expect(
      getTaskStatusTransitionState(
        task,
        statuses.find((status) => status.id === "task-status-done")!,
        "user-executor",
        []
      )
    ).toMatchObject({
      canTransition: false,
      reason: "Сначала отправьте задачу на контроль постановщику"
    });
    expect(
      getTaskStatusTransitionState(
        task,
        statuses.find((status) => status.id === "task-status-new")!,
        "user-executor",
        []
      )
    ).toMatchObject({
      canTransition: false
    });
  });

  it("counts operational task badges", () => {
    const tasks = [
      makeTask("task-1", { plannedFinish: "2026-05-19", statusCategory: "in_progress", plannedWork: 12 }),
      makeTask("task-2", { plannedFinish: "2026-05-20", statusCategory: "done", plannedWork: 4 })
    ];

    expect(getTaskCounters(tasks, "2026-05-20")).toEqual({
      overdue: 1,
      inProgress: 1,
      done: 1,
      plannedWork: 16
    });
  });
});

function makeUser(id: string, name: string): WorkspaceUser {
  return {
    id,
    tenantId: "tenant",
    email: `${id}@kiss-pm.local`,
    name,
    accessProfileId: "profile",
    positionId: null,
    positionName: null,
    phone: null,
    telegram: null,
    status: "active",
    theme: "light",
    accentColor: "#2563eb"
  };
}

function makeStatus(
  id: string,
  name: string,
  category: TaskStatusDefinition["category"],
  sortOrder: number,
  isSystem: boolean
): TaskStatusDefinition {
  return {
    id,
    tenantId: "tenant",
    name,
    category,
    sortOrder,
    status: "active",
    isSystem,
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-05-20T00:00:00Z"
  };
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    tenantId: "tenant",
    projectId: "project-crm",
    stageId: null,
    title: "Задача",
    description: null,
    status: overrides.statusCategory ?? "new",
    statusId: "task-status-new",
    statusName: "Новая",
    statusCategory: "new",
    priority: "normal",
    requesterUserId: "user-admin",
    ownerUserId: "user-executor",
    plannedStart: "2026-05-20",
    plannedFinish: "2026-05-22",
    durationWorkingDays: 3,
    plannedWork: 8,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-05-20T00:00:00Z",
    archivedAt: null,
    participants: [{ userId: "user-executor", role: "executor" }],
    ...overrides
  };
}
