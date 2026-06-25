import { describe, it, expect } from "vitest";

import { createMockWorkspaceFetch, CURRENT_USER_ID, MOCK_PROJECT_ID } from "./mock-workspace-backend";
import { WorkspaceApiError, createWorkspaceClient } from "./workspace-client";

function client() {
  return createWorkspaceClient({ apiOrigin: "", fetchImpl: createMockWorkspaceFetch() });
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
});
