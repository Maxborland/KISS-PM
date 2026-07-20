import { describe, it, expect, vi } from "vitest";

import { createMockWorkspaceFetch, CURRENT_USER_ID, MOCK_PROJECT_ID } from "./mock-workspace-backend";
import { WorkspaceApiError, createWorkspaceClient, type TaskRecord } from "./workspace-client";

function client() {
  return createWorkspaceClient({ apiOrigin: "", fetchImpl: createMockWorkspaceFetch() });
}

function taskUpdateInput(task: TaskRecord) {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    statusId: task.statusId,
    plannedStart: task.plannedStart.slice(0, 10),
    plannedFinish: task.plannedFinish.slice(0, 10),
    durationWorkingDays: task.durationWorkingDays,
    plannedWork: task.plannedWork,
    requiresAcceptance: task.requiresAcceptance,
    participants: task.participants,
    clientUpdatedAt: task.updatedAt
  };
}

describe("contract-mock workspace backend", () => {
  it("lists only active projects, including the delivery-consistent project", async () => {
    const c = client();
    const { projects } = await c.listProjects();
    expect(projects.length).toBeGreaterThanOrEqual(3);
    expect(projects.every((p) => p.status === "active")).toBe(true);
    const r2 = projects.find((p) => p.id === MOCK_PROJECT_ID);
    expect(r2?.title).toBe("Производственный портал · Релиз 2"); // согласовано с Project Delivery
    expect(r2?.clientName).toBe("ООО «Ромашка»"); // согласовано с CRM-моком
    expect(r2?.sourceOpportunityId).toBe("opp-2207"); // источник = сделка delivery/CRM
    expect(r2?.contractValue).toBe(4_800_000);
  });

  it("returns project detail with its tasks for the delivery-consistent project", async () => {
    const c = client();
    const { project, tasks } = await c.getProjectDetail(MOCK_PROJECT_ID);
    expect(project.id).toBe(MOCK_PROJECT_ID);
    expect(project.plannedStart).toBe("2026-03-02"); // старт = planning PROJECT_START_ISO
    expect(project.plannedFinish).toBe("2026-07-12"); // срок = planning deadline / opp-2207 finish
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.projectId === MOCK_PROJECT_ID)).toBe(true);
  });

  it("rejects project detail for an unknown projectId (404 project_not_found)", async () => {
    const c = client();
    await expect(c.getProjectDetail("proj-does-not-exist")).rejects.toMatchObject({ status: 404, code: "project_not_found" });
  });

  it("rejects project detail for a malformed projectId (400 invalid_project_id)", async () => {
    const c = client();
    await expect(c.getProjectDetail("X")).rejects.toMatchObject({ status: 400, code: "invalid_project_id" });
  });

  it("lists my-work tasks for the current user only, across projects", async () => {
    const c = client();
    const { tasks } = await c.listMyWork();
    expect(tasks.length).toBeGreaterThanOrEqual(6);
    expect(tasks.every((t) => t.ownerUserId === CURRENT_USER_ID)).toBe(true);
    expect(new Set(tasks.map((t) => t.projectId)).size).toBeGreaterThan(1); // разные проекты
    expect(new Set(tasks.map((t) => t.status)).size).toBeGreaterThan(1); // разные статусы
  });

  it("project detail is wider than my-work: includes tasks of other assignees", async () => {
    const c = client();
    const { tasks } = await c.getProjectDetail(MOCK_PROJECT_ID);
    expect(tasks.some((t) => t.ownerUserId !== CURRENT_USER_ID)).toBe(true);
  });

  it("transitions a task status (new -> in_progress) and returns the updated task", async () => {
    const c = client();
    // task-loyalty-integration: статус new, исполнитель u-petrov.
    const { task } = await c.updateTaskStatus("proj-loyalty", "task-loyalty-integration", "status-in-progress");
    expect(task.status).toBe("in_progress");
    expect(task.statusId).toBe("status-in-progress");
    // повторный GET my-work отражает изменение в той же сессии
    const { tasks } = await c.listMyWork();
    expect(tasks.find((t) => t.id === "task-loyalty-integration")?.status).toBe("in_progress");
  });

  it("rejects a forbidden transition (done -> in_progress) with 409 task_status_transition_not_allowed", async () => {
    const c = client();
    // task-r2-requirements сидирована как done (терминальный статус).
    await expect(c.updateTaskStatus(MOCK_PROJECT_ID, "task-r2-requirements", "status-in-progress"))
      .rejects.toMatchObject({ status: 409, code: "task_status_transition_not_allowed" });
  });

  it("rejects an unknown target status (400 task_status_not_found)", async () => {
    const c = client();
    await expect(c.updateTaskStatus("proj-loyalty", "task-loyalty-integration", "status-zzz"))
      .rejects.toMatchObject({ status: 400, code: "task_status_not_found" });
  });

  it("rejects a malformed status body (400 invalid_task_status)", async () => {
    const c = client();
    // "cancelled" явно запрещён парсером (как parseUpdateTaskStatusBody).
    await expect(c.updateTaskStatus("proj-loyalty", "task-loyalty-integration", "cancelled"))
      .rejects.toMatchObject({ status: 400, code: "invalid_task_status" });
  });

  it("rejects status change for a task not in the given project (404 task_not_found)", async () => {
    const c = client();
    // task-loyalty-integration принадлежит proj-loyalty, не MOCK_PROJECT_ID.
    await expect(c.updateTaskStatus(MOCK_PROJECT_ID, "task-loyalty-integration", "status-in-progress"))
      .rejects.toMatchObject({ status: 404, code: "task_not_found" });
  });

  it("rejects status change for an unknown project (404 project_not_found)", async () => {
    const c = client();
    await expect(c.updateTaskStatus("proj-does-not-exist", "task-loyalty-integration", "status-in-progress"))
      .rejects.toBeInstanceOf(WorkspaceApiError);
    await expect(c.updateTaskStatus("proj-does-not-exist", "task-loyalty-integration", "status-in-progress"))
      .rejects.toMatchObject({ status: 404, code: "project_not_found" });
  });

  it("completes a review task into done (review -> done) and sets progress 100", async () => {
    const c = client();
    // task-r2-acceptance сидирована в review (requiresAcceptance=true). В моке RBAC упрощён → переход разрешён.
    const { task } = await c.updateTaskStatus(MOCK_PROJECT_ID, "task-r2-acceptance", "status-done");
    expect(task.status).toBe("done");
    expect(task.progress).toBe(100);
  });

  it("mirrors live task version conflicts after same-millisecond task mutations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T08:00:00.000Z"));
    try {
      const c = client();
      const { task } = await c.getTaskDetail("task-loyalty-integration");
      const staleUpdate = taskUpdateInput(task);

      const { task: edited } = await c.updateTask(task.id, {
        ...staleUpdate,
        title: `${task.title} (обновлена)`
      });
      expect(edited.updatedAt).toBe("2026-03-02T08:00:00.001Z");
      await expect(c.updateTask(task.id, staleUpdate))
        .rejects.toMatchObject({ status: 409, code: "task_version_conflict" });

      const afterStatus = client();
      const { task: statusTask } = await afterStatus.getTaskDetail("task-loyalty-integration");
      const staleAfterStatus = taskUpdateInput(statusTask);
      const { task: statusChanged } = await afterStatus.updateTaskStatus(
        "proj-loyalty",
        statusTask.id,
        "status-in-progress"
      );
      expect(statusChanged.updatedAt).toBe("2026-03-02T08:00:00.001Z");
      await expect(afterStatus.updateTask(statusTask.id, staleAfterStatus))
        .rejects.toMatchObject({ status: 409, code: "task_version_conflict" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("contract-mock capacity tree (GET /api/workspace/capacity/tree)", () => {
  it("returns an org capacity tree with month days and resource rows", async () => {
    const c = client();
    const tree = await c.getCapacityTree("2026-07");
    expect(tree.monthIso).toBe("2026-07");
    expect(tree.hierarchyMode).toBe("org");
    expect(tree.days.length).toBe(31);
    expect(tree.days[0]).toMatchObject({ date: "2026-07-01", isoWeekday: 3, isWeekend: false });
    const rows = tree.orgGroups.flatMap((d) => d.units.flatMap((u) => u.positions.flatMap((p) => p.rows)));
    expect(rows.length).toBe(5);
    // Рабочий день: ёмкость 480, выходной: 0 (производственный календарь Пн–Пт).
    const anyRow = rows[0]!;
    expect(anyRow.days.find((d) => !d.isWeekend)?.capacityMinutes).toBe(480);
    expect(anyRow.days.find((d) => d.isWeekend)?.capacityMinutes).toBe(0);
  });

  it("marks the seeded overload story (u-sergeev: 600 > 480) with isOverload and heat 3", async () => {
    const c = client();
    const tree = await c.getCapacityTree("2026-07");
    const rows = tree.orgGroups.flatMap((d) => d.units.flatMap((u) => u.positions.flatMap((p) => p.rows)));
    const overloaded = rows.find((r) => r.user.id === "u-sergeev")!;
    const workDay = overloaded.days.find((d) => !d.isWeekend)!;
    expect(workDay).toMatchObject({ workMinutes: 600, overloadMinutes: 120, isOverload: true, heat: 3 });
    // Свободный ресурс без нагрузки перегруза не имеет.
    const free = rows.find((r) => r.user.id === "u-kuznetsov")!;
    expect(free.days.every((d) => !d.isOverload && d.workMinutes === 0)).toBe(true);
  });

  it("narrows projectsMix and work minutes with the projectId filter", async () => {
    const c = client();
    const full = await c.getCapacityTree("2026-07");
    const filtered = await c.getCapacityTree("2026-07", "proj-loyalty");
    const rowOf = (tree: typeof full, userId: string) =>
      tree.orgGroups.flatMap((d) => d.units.flatMap((u) => u.positions.flatMap((p) => p.rows))).find((r) => r.user.id === userId)!;
    const fullDay = rowOf(full, "u-sergeev").days.find((d) => !d.isWeekend)!;
    const filteredDay = rowOf(filtered, "u-sergeev").days.find((d) => !d.isWeekend)!;
    expect(fullDay.workMinutes).toBe(600);
    expect(filteredDay.workMinutes).toBe(240); // только proj-loyalty
    const mix = rowOf(filtered, "u-sergeev").projectsMixByDate?.[filteredDay.date];
    expect(mix).toEqual([{ projectId: "proj-loyalty", workMinutes: 240 }]);
  });

  it("rejects a malformed month (400 capacity_invalid_query)", async () => {
    const c = client();
    await expect(c.getCapacityTree("2026-13")).rejects.toMatchObject({ status: 400, code: "capacity_invalid_query" });
    await expect(c.getCapacityTree("июль")).rejects.toMatchObject({ status: 400, code: "capacity_invalid_query" });
  });

  it("rejects an unknown or malformed project filter (400 capacity_invalid_query)", async () => {
    const c = client();
    await expect(c.getCapacityTree("2026-07", "proj-does-not-exist"))
      .rejects.toMatchObject({ status: 400, code: "capacity_invalid_query" });
    await expect(c.getCapacityTree("2026-07", "X"))
      .rejects.toMatchObject({ status: 400, code: "capacity_invalid_query" });
  });
});

/* ---- справочник статусов задач: CRUD (зеркало taskStatusRoutes/taskStatusWorkspace; Н12) ---- */
describe("contract-mock workspace backend: task status definitions CRUD", () => {
  it("lists the five system statuses as active, sorted by sortOrder", async () => {
    const c = client();
    const { taskStatuses } = await c.listTaskStatuses();
    expect(taskStatuses.map((s) => s.id)).toEqual(["status-new", "status-waiting", "status-in-progress", "status-review", "status-done"]);
    expect(taskStatuses.every((s) => s.isSystem && s.status === "active")).toBe(true);
  });

  it("creates a custom status (201) and returns it in the list", async () => {
    const c = client();
    const { taskStatus } = await c.createTaskStatusDefinition({ id: "status-approval", name: "Согласование", category: "review", sortOrder: 6 });
    expect(taskStatus).toMatchObject({ id: "status-approval", name: "Согласование", category: "review", sortOrder: 6, isSystem: false, status: "active" });
    const { taskStatuses } = await c.listTaskStatuses();
    expect(taskStatuses.map((s) => s.id)).toContain("status-approval");
  });

  it("rejects unique conflicts on create: id, name and sortOrder (409, DB-uidx mirror)", async () => {
    const c = client();
    await expect(c.createTaskStatusDefinition({ id: "status-new", name: "Дубль id", category: "new", sortOrder: 7 }))
      .rejects.toMatchObject({ status: 409, code: "task_status_id_taken" });
    await expect(c.createTaskStatusDefinition({ id: "status-dup-name", name: "Готово", category: "done", sortOrder: 8 }))
      .rejects.toMatchObject({ status: 409, code: "task_status_name_taken" });
    await expect(c.createTaskStatusDefinition({ id: "status-dup-sort", name: "Дубль порядка", category: "new", sortOrder: 1 }))
      .rejects.toMatchObject({ status: 409, code: "task_status_sort_order_taken" });
  });

  it("validates the body in the parser order (400): id → name → category → sortOrder", async () => {
    const c = client();
    await expect(c.createTaskStatusDefinition({ id: "X", name: "Ок имя", category: "new", sortOrder: 9 }))
      .rejects.toMatchObject({ status: 400, code: "invalid_task_status_id" });
    await expect(c.createTaskStatusDefinition({ id: "status-x1", name: "a", category: "new", sortOrder: 9 }))
      .rejects.toMatchObject({ status: 400, code: "invalid_task_status_name" });
    await expect(c.createTaskStatusDefinition({ id: "status-x2", name: "Ок имя", category: "cancelled" as never, sortOrder: 9 }))
      .rejects.toMatchObject({ status: 400, code: "invalid_task_status_category" });
    await expect(c.createTaskStatusDefinition({ id: "status-x3", name: "Ок имя", category: "new", sortOrder: 0 }))
      .rejects.toMatchObject({ status: 400, code: "invalid_task_status_sort_order" });
  });

  it("updates a custom status and archives it via DELETE (record stays listed as archived)", async () => {
    const c = client();
    await c.createTaskStatusDefinition({ id: "status-hold", name: "Пауза", category: "waiting", sortOrder: 6 });
    const updated = await c.updateTaskStatusDefinition("status-hold", { name: "Долгая пауза", category: "waiting", sortOrder: 7 });
    expect(updated.taskStatus).toMatchObject({ id: "status-hold", name: "Долгая пауза", sortOrder: 7 });
    const archived = await c.archiveTaskStatusDefinition("status-hold");
    expect(archived.taskStatus.status).toBe("archived");
    // Повторный архив идемпотентен (боевой archiveTaskStatus возвращает запись как есть).
    await expect(c.archiveTaskStatusDefinition("status-hold")).resolves.toMatchObject({ taskStatus: { status: "archived" } });
    const { taskStatuses } = await c.listTaskStatuses();
    expect(taskStatuses.find((s) => s.id === "status-hold")?.status).toBe("archived");
  });

  it("protects system statuses: no archive (409 system_task_status_required), no category change (409 …_category_locked)", async () => {
    const c = client();
    await expect(c.archiveTaskStatusDefinition("status-done")).rejects.toMatchObject({ status: 409, code: "system_task_status_required" });
    await expect(c.updateTaskStatusDefinition("status-done", { name: "Готово", category: "review", sortOrder: 5, status: "archived" }))
      .rejects.toMatchObject({ status: 409, code: "system_task_status_required" });
    await expect(c.updateTaskStatusDefinition("status-done", { name: "Готово", category: "review", sortOrder: 5 }))
      .rejects.toMatchObject({ status: 409, code: "system_task_status_category_locked" });
  });

  it("returns 404 task_status_not_found for unknown ids and blocks task transitions into archived statuses", async () => {
    const c = client();
    await expect(c.updateTaskStatusDefinition("status-ghost", { name: "Призрак", category: "new", sortOrder: 9 }))
      .rejects.toMatchObject({ status: 404, code: "task_status_not_found" });
    await expect(c.archiveTaskStatusDefinition("status-ghost")).rejects.toMatchObject({ status: 404, code: "task_status_not_found" });
    // Архивированный кастомный статус недоступен как целевой для смены статуса задачи (как listTaskStatuses.find active).
    await c.createTaskStatusDefinition({ id: "status-limbo", name: "Лимб", category: "in_progress", sortOrder: 6 });
    await c.archiveTaskStatusDefinition("status-limbo");
    const { tasks } = await c.getProjectDetail(MOCK_PROJECT_ID);
    const task = tasks.find((t) => t.status === "new")!;
    await expect(c.updateTaskStatus(MOCK_PROJECT_ID, task.id, "status-limbo"))
      .rejects.toMatchObject({ status: 400, code: "task_status_not_found" });
  });

  describe("project lifecycle (Блок 5)", () => {
    it("filters the project list by status", async () => {
      const c = client();
      expect((await c.listProjects("closed")).projects.every((p) => p.status === "closed")).toBe(true);
      expect((await c.listProjects("paused")).projects.every((p) => p.status === "paused")).toBe(true);
      const all = (await c.listProjects("all")).projects.map((p) => p.status);
      expect(all).toContain("closed");
      expect(all).toContain("paused");
      expect(all).toContain("active");
    });

    it("creates a manual project without an opportunity", async () => {
      const c = client();
      const { project } = await c.createProject({
        title: "Внутренний R&D",
        plannedStart: "2026-08-01",
        plannedFinish: "2026-09-01"
      });
      expect(project.sourceType).toBe("manual");
      expect(project.sourceOpportunityId).toBeNull();
      expect(project.status).toBe("active");
      expect((await c.listProjects("active")).projects.some((p) => p.id === project.id)).toBe(true);
    });

    it("rejects an invalid create payload", async () => {
      const c = client();
      await expect(c.createProject({ title: "", plannedStart: "2026-08-01", plannedFinish: "2026-09-01" }))
        .rejects.toMatchObject({ status: 400, code: "invalid_project_title" });
    });

    it("renames a project via PATCH", async () => {
      const c = client();
      const { project } = await c.updateProject(MOCK_PROJECT_ID, { title: "Переименованный релиз" });
      expect(project.title).toBe("Переименованный релиз");
    });

    it("reopens a closed project", async () => {
      const c = client();
      const { project } = await c.setProjectStatus("proj-archived-crm", "reopen");
      expect(project.status).toBe("active");
      expect(project.closedAt).toBeNull();
    });

    it("resumes a paused project and rejects an illegal transition", async () => {
      const c = client();
      const { project } = await c.setProjectStatus("proj-paused-mobile", "resume");
      expect(project.status).toBe("active");
      // active → resume недопустимо.
      await expect(c.setProjectStatus("proj-paused-mobile", "resume"))
        .rejects.toMatchObject({ status: 409, code: "project_status_transition_not_allowed" });
    });
  });
});
