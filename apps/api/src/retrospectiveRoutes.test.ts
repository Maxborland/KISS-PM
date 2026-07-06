import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type {
  PlanSnapshot,
  ProjectClosureSnapshot,
  RetrospectiveLesson,
  RetrospectiveReadModel,
  TemplateImprovementAction,
  TenantUser
} from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource, AuditEventListItem, ProjectRecord } from "./apiTypes";

describe("retrospective routes", () => {
  it("rejects malformed route identifiers before session and persistence lookup", async () => {
    const app = createApp();
    const actionHeaders = { "x-kiss-pm-action": "same-origin" };

    const read = await app.request("/api/workspace/projects/bad..project/closure");
    const preview = await app.request(
      "/api/workspace/projects/bad..project/closure/preview",
      { method: "POST", headers: actionHeaders }
    );
    const close = await app.request("/api/workspace/projects/bad..project/closure/close", {
      method: "POST",
      headers: actionHeaders
    });
    const lessons = await app.request(
      "/api/workspace/projects/bad..project/closure/lessons",
      { method: "POST", headers: actionHeaders }
    );
    const badProjectApply = await app.request(
      "/api/workspace/projects/bad..project/closure/template-improvement-actions/template-improvement-550e8400-e29b-41d4-a716-446655440000/apply",
      { method: "POST", headers: actionHeaders }
    );
    const badActionApply = await app.request(
      "/api/workspace/projects/project-alpha/closure/template-improvement-actions/bad..action/apply",
      { method: "POST", headers: actionHeaders }
    );
    const insights = await app.request(
      "/api/tenant/current/project-templates/bad..template/retrospective-insights"
    );

    for (const response of [read, preview, close, lessons, badProjectApply]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid_project_id" });
    }
    expect(badActionApply.status).toBe(400);
    await expect(badActionApply.json()).resolves.toEqual({
      error: "invalid_template_improvement_action_id"
    });
    expect(insights.status).toBe(400);
    await expect(insights.json()).resolves.toEqual({
      error: "invalid_project_template_id"
    });
  });

  it("previews and closes an active project with snapshot, lessons, template action and audit", async () => {
    const state = createRetrospectiveDataSource();
    const app = createApp({ dataSource: state.dataSource });

    const previewResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/preview",
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );
    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({
      canClose: true,
      projectStatus: "active",
      planFactSummary: {
        planVersion: 7,
        plannedWorkMinutes: 720,
        actualWorkMinutes: 900,
        workVarianceMinutes: 180
      },
      proposedTemplateImprovement: {
        templateId: "template-alpha",
        status: "proposed"
      }
    });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          closeReason: "Работы приняты заказчиком",
          lessons: [
            {
              category: "schedule",
              title: "Раньше подключать архитектора",
              body: "Архитектурная оценка сократила бы переделки.",
              impact: "negative"
            }
          ]
        })
      }
    );
    expect(closeResponse.status).toBe(200);
    const closeBody = (await closeResponse.json()) as RetrospectiveReadModel & {
      auditEventId: string;
    };

    expect(state.projects[0]?.status).toBe("closed");
    expect(closeBody.snapshot).toMatchObject({
      projectId: "project-alpha",
      projectStatusBefore: "active",
      planVersion: 7,
      closeReason: "Работы приняты заказчиком"
    });
    expect(closeBody.lessons).toEqual([
      expect.objectContaining({
        category: "schedule",
        title: "Раньше подключать архитектора"
      })
    ]);
    expect(closeBody.templateImprovementActions).toEqual([
      expect.objectContaining({
        templateId: "template-alpha",
        status: "proposed"
      })
    ]);
    expect(state.auditEvents.map((event) => event.actionType)).toContain("project.closed");
  });

  it("denies closure without manage permissions and writes denied audit", async () => {
    const state = createRetrospectiveDataSource({
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.retrospectives.read"
      ]
    });
    const app = createApp({ dataSource: state.dataSource });

    const response = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Готово" })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(state.projects[0]?.status).toBe("active");
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "project.close_denied",
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("denies closure without project plan read permission before building a snapshot", async () => {
    const state = createRetrospectiveDataSource({
      permissions: [
        "tenant.projects.manage",
        "tenant.management_actions.execute",
        "tenant.retrospectives.manage"
      ]
    });
    const app = createApp({ dataSource: state.dataSource });

    const response = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Готово" })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(state.projects[0]?.status).toBe("active");
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "project.close_denied",
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("audits denied closure read and preview requests", async () => {
    const state = createRetrospectiveDataSource({ permissions: [] });
    const app = createApp({ dataSource: state.dataSource });

    const readResponse = await app.request("/api/workspace/projects/project-alpha/closure", {
      headers: { cookie: "kiss_pm_session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" }
    });
    const previewResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/preview",
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );

    expect(readResponse.status).toBe(403);
    expect(previewResponse.status).toBe(403);
    await expect(readResponse.json()).resolves.toEqual({ error: "permission_missing" });
    await expect(previewResponse.json()).resolves.toEqual({ error: "permission_missing" });
    expect(state.auditEvents.map((event) => event.actionType)).toEqual([
      "closure.preview_denied",
      "closure.read_denied"
    ]);
  });

  it("denies retrospective lesson creation without manage permission and writes denied audit", async () => {
    const state = createRetrospectiveDataSource({
      permissions: [
        "tenant.projects.read",
        "tenant.project_plan.read",
        "tenant.retrospectives.read"
      ]
    });
    const app = createApp({ dataSource: state.dataSource });

    const response = await app.request(
      "/api/workspace/projects/project-alpha/closure/lessons",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          category: "process",
          title: "Согласовать чеклист",
          body: "Нужен единый чеклист закрытия.",
          impact: "positive"
        })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        actionType: "retrospective.lesson_create_denied",
        input: { projectId: "project-alpha" },
        executionResult: { status: "denied" }
      })
    ]);
  });

  it("returns persistence_not_configured when closure routes cannot resolve projects", async () => {
    const state = createRetrospectiveDataSource();
    delete state.dataSource.listProjects;
    const app = createApp({ dataSource: state.dataSource });

    const readResponse = await app.request("/api/workspace/projects/project-alpha/closure", {
      headers: { cookie: "kiss_pm_session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" }
    });
    expect(readResponse.status).toBe(501);
    await expect(readResponse.json()).resolves.toEqual({ error: "persistence_not_configured" });

    const previewResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/preview",
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );
    expect(previewResponse.status).toBe(501);
    await expect(previewResponse.json()).resolves.toEqual({ error: "persistence_not_configured" });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Готово" })
      }
    );
    expect(closeResponse.status).toBe(501);
    await expect(closeResponse.json()).resolves.toEqual({ error: "persistence_not_configured" });
  });

  it("maps closeProject project_not_closable throws to a stable conflict response", async () => {
    const state = createRetrospectiveDataSource({ closeProjectError: "project_not_closable" });
    const app = createApp({ dataSource: state.dataSource });

    const response = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Повторное закрытие" })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "project_not_closable" });
    expect(state.auditEvents.map((event) => event.actionType)).not.toContain("project.closed");
    expect(state.auditEvents.map((event) => event.actionType)).toEqual(["project.close_conflict"]);
  });

  it("maps closeProject project_not_found throws to a stable not found response", async () => {
    const state = createRetrospectiveDataSource({ closeProjectError: "project_not_found" });
    const app = createApp({ dataSource: state.dataSource });

    const response = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Повторное закрытие" })
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "project_not_found" });
    expect(state.auditEvents.map((event) => event.actionType)).not.toContain("project.closed");
    expect(state.auditEvents.map((event) => event.actionType)).toEqual(["project.close_failed"]);
  });

  it("applies template improvement through governed action and exposes template insights", async () => {
    const state = createRetrospectiveDataSource();
    const app = createApp({ dataSource: state.dataSource });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Работы приняты" })
      }
    );
    expect(closeResponse.status).toBe(200);
    const closeBody = (await closeResponse.json()) as RetrospectiveReadModel;
    const actionId = closeBody.templateImprovementActions[0]?.id;
    expect(actionId).toBeTruthy();

    const applyResponse = await app.request(
      `/api/workspace/projects/project-alpha/closure/template-improvement-actions/${actionId}/apply`,
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );
    expect(applyResponse.status).toBe(200);
    await expect(applyResponse.json()).resolves.toMatchObject({
      action: {
        id: actionId,
        status: "applied",
        appliedByUserId: "user-alpha-admin"
      }
    });

    const insightsResponse = await app.request(
      "/api/tenant/current/project-templates/template-alpha/retrospective-insights",
      { headers: { cookie: "kiss_pm_session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" } }
    );
    expect(insightsResponse.status).toBe(200);
    await expect(insightsResponse.json()).resolves.toMatchObject({
      templateId: "template-alpha",
      estimationLearning: {
        appliedActionCount: 1,
        plannedWorkDeltaMinutes: 180,
        plannedDurationDeltaDays: -6
      }
    });
    expect(state.auditEvents.map((event) => event.actionType)).toEqual(
      expect.arrayContaining(["project.closed", "template_improvement.applied"])
    );
  });

  it("returns conflict when applying an already applied template improvement action", async () => {
    const state = createRetrospectiveDataSource();
    const app = createApp({ dataSource: state.dataSource });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Работы приняты" })
      }
    );
    expect(closeResponse.status).toBe(200);
    const closeBody = (await closeResponse.json()) as RetrospectiveReadModel;
    const actionId = closeBody.templateImprovementActions[0]?.id;
    expect(actionId).toBeTruthy();

    const firstApplyResponse = await app.request(
      `/api/workspace/projects/project-alpha/closure/template-improvement-actions/${actionId}/apply`,
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );
    expect(firstApplyResponse.status).toBe(200);

    const retryResponse = await app.request(
      `/api/workspace/projects/project-alpha/closure/template-improvement-actions/${actionId}/apply`,
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );

    expect(retryResponse.status).toBe(409);
    await expect(retryResponse.json()).resolves.toEqual({
      error: "template_improvement_action_already_applied"
    });
    expect(
      state.auditEvents.filter((event) => event.actionType === "template_improvement.applied")
    ).toHaveLength(1);
    expect(
      state.auditEvents.filter((event) => event.actionType === "template_improvement.apply_conflict")
    ).toHaveLength(1);
  });

  it("denies template improvement apply without permission and writes denied audit", async () => {
    const state = createRetrospectiveDataSource({
      permissions: [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.project_plan.read",
        "tenant.management_actions.execute",
        "tenant.retrospectives.read",
        "tenant.retrospectives.manage"
      ]
    });
    const app = createApp({ dataSource: state.dataSource });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Работы приняты" })
      }
    );
    expect(closeResponse.status).toBe(200);
    const closeBody = (await closeResponse.json()) as RetrospectiveReadModel;
    const actionId = closeBody.templateImprovementActions[0]?.id;
    expect(actionId).toBeTruthy();

    const response = await app.request(
      `/api/workspace/projects/project-alpha/closure/template-improvement-actions/${actionId}/apply`,
      { method: "POST", headers: mutationHeaders(), body: JSON.stringify({}) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "permission_missing" });
    expect(
      state.auditEvents.filter((event) => event.actionType === "template_improvement.apply_denied")
    ).toEqual([
      expect.objectContaining({
        input: { projectId: "project-alpha", actionId },
        executionResult: { status: "denied" }
      })
    ]);
    expect(
      state.auditEvents.filter((event) => event.actionType === "template_improvement.applied")
    ).toHaveLength(0);
  });

  it("rolls back lesson creation when lesson audit write fails", async () => {
    const state = createRetrospectiveDataSource();
    const app = createApp({ dataSource: state.dataSource });

    const closeResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/close",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({ closeReason: "Работы приняты" })
      }
    );
    expect(closeResponse.status).toBe(200);
    state.failAuditActionTypes.add("retrospective.lesson.created");

    const lessonResponse = await app.request(
      "/api/workspace/projects/project-alpha/closure/lessons",
      {
        method: "POST",
        headers: mutationHeaders(),
        body: JSON.stringify({
          category: "process",
          title: "Согласовать чеклист",
          body: "Нужен единый чеклист закрытия.",
          impact: "positive"
        })
      }
    );

    expect(lessonResponse.status).toBe(500);
    state.failAuditActionTypes.clear();
    const readResponse = await app.request("/api/workspace/projects/project-alpha/closure", {
      headers: { cookie: "kiss_pm_session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" }
    });
    expect(readResponse.status).toBe(200);
    const readBody = (await readResponse.json()) as RetrospectiveReadModel;
    expect(readBody.lessons).toEqual([]);
  });
});

function createRetrospectiveDataSource(
  input: {
    permissions?: AccessProfile["permissions"];
    closeProjectError?: "project_not_closable" | "project_not_found";
  } = {}
) {
  const actor: TenantUser = {
    id: "user-alpha-admin",
    tenantId: "tenant-alpha",
    name: "Анна Администратор",
    accessProfileId: "profile-alpha"
  };
  const profile: AccessProfile = {
    id: "profile-alpha",
    permissions:
      input.permissions ?? [
        "tenant.projects.read",
        "tenant.projects.manage",
        "tenant.project_plan.read",
        "tenant.management_actions.execute",
        "tenant.retrospectives.read",
        "tenant.retrospectives.manage",
        "tenant.template_improvements.apply"
      ]
  };
  const projects = [createProject()];
  let readModel: RetrospectiveReadModel = {
    snapshot: null,
    lessons: [],
    templateImprovementActions: []
  };
  const auditEvents: AuditEventListItem[] = [];
  const failAuditActionTypes = new Set<string>();

  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() {
      return [actor];
    },
    async findUserById(userId) {
      return userId === actor.id ? actor : undefined;
    },
    async findTenantById(tenantId) {
      return tenantId === actor.tenantId ? { id: tenantId, name: "Альфа" } : undefined;
    },
    async listUsersByTenantId() {
      return [actor];
    },
    async findAccessProfileById() {
      return profile;
    },
    async findSessionByTokenHash() {
      return {
        id: "session-alpha",
        tenantId: actor.tenantId,
        userId: actor.id,
        tokenHash: "hash",
        expiresAt: new Date("2030-01-01T00:00:00.000Z")
      };
    },
    async withTransaction(operation) {
      const projectSnapshot = projects.map((project) => ({ ...project }));
      const readModelSnapshot = readModel;
      const auditEventsSnapshot = [...auditEvents];
      try {
        return await operation(dataSource as ApiTenantDataSource);
      } catch (error) {
        projects.splice(0, projects.length, ...projectSnapshot);
        readModel = readModelSnapshot;
        auditEvents.splice(0, auditEvents.length, ...auditEventsSnapshot);
        throw error;
      }
    },
    async listProjects(tenantId) {
      return projects.filter((project) => project.tenantId === tenantId);
    },
    async getPlanSnapshot(tenantId, projectId) {
      return tenantId === actor.tenantId && projectId === "project-alpha"
        ? createSnapshot()
        : undefined;
    },
    async listProjectTasks(tenantId, projectId) {
      return tenantId === actor.tenantId && projectId === "project-alpha"
        ? createTasks()
        : [];
    },
    async getRetrospectiveReadModel() {
      return readModel;
    },
    async closeProject({ snapshot, lessons, templateImprovementActions }) {
      const project = projects.find((candidate) => candidate.id === snapshot.projectId);
      if (!project) throw new Error("project_not_found");
      if (project.status !== "active" && project.status !== "paused") {
        throw new Error("project_not_closable");
      }
      if (input.closeProjectError) throw new Error(input.closeProjectError);
      project.status = "closed";
      project.closedAt = snapshot.closedAt;
      readModel = {
        snapshot: {
          ...snapshot,
          closedAt: snapshot.closedAt.toISOString()
        },
        lessons: lessons.map((lesson) => ({
          ...lesson,
          createdAt: (lesson.createdAt ?? snapshot.closedAt).toISOString()
        })),
        templateImprovementActions: templateImprovementActions.map((action) => ({
          ...action,
          createdAt: (action.createdAt ?? snapshot.closedAt).toISOString(),
          appliedAt: action.appliedAt?.toISOString() ?? null
        }))
      };
      return readModel;
    },
    async addRetrospectiveLesson(input) {
      if (!readModel.snapshot) throw new Error("closure_snapshot_not_found");
      const lesson: RetrospectiveLesson = {
        ...input,
        createdAt: (input.createdAt ?? new Date()).toISOString()
      };
      readModel = { ...readModel, lessons: [...readModel.lessons, lesson] };
      return lesson;
    },
    async applyTemplateImprovementAction({ actionId, actorUserId, auditEventId, appliedAt }) {
      const action = readModel.templateImprovementActions.find(
        (candidate) => candidate.id === actionId && candidate.status === "proposed"
      );
      if (!action) return undefined;
      const applied: TemplateImprovementAction = {
        ...action,
        status: "applied",
        appliedByUserId: actorUserId,
        appliedAt: appliedAt.toISOString(),
        auditEventId
      };
      readModel = {
        ...readModel,
        templateImprovementActions: readModel.templateImprovementActions.map((candidate) =>
          candidate.id === actionId ? applied : candidate
        )
      };
      return applied;
    },
    async listTemplateImprovementActions({ tenantId, templateId, status }) {
      return readModel.templateImprovementActions.filter(
        (action) =>
          action.tenantId === tenantId &&
          action.templateId === templateId &&
          (!status || action.status === status)
      );
    },
    async appendAuditEvent(input) {
      if (failAuditActionTypes.has(input.actionType)) {
        throw new Error("audit_insert_failed");
      }
      auditEvents.unshift({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    }
  };

  return { dataSource, projects, auditEvents, failAuditActionTypes };
}

function mutationHeaders() {
  return {
    "content-type": "application/json",
    cookie: "kiss_pm_session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "x-kiss-pm-action": "same-origin"
  };
}

function createProject(): ProjectRecord {
  return {
    id: "project-alpha",
    tenantId: "tenant-alpha",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: "Проект Альфа",
    clientName: "Internal",
    status: "active",
    plannedStart: new Date("2026-05-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-05-10T00:00:00.000Z"),
    contractValue: 0,
    plannedHours: 12,
    templateId: "template-alpha",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    activatedAt: new Date("2026-05-01T00:00:00.000Z"),
    closedAt: null,
    demand: []
  };
}

function createTasks(): TaskRecord[] {
  const base = {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    stageId: null,
    description: null,
    priority: "normal" as const,
    requesterUserId: "user-alpha-admin",
    ownerUserId: "user-alpha-admin",
    plannedStart: new Date("2026-05-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-05-04T00:00:00.000Z"),
    durationWorkingDays: 2,
    plannedWork: 8,
    actualWork: 10,
    progress: 100,
    requiresAcceptance: false,
    source: "manual" as const,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-04T00:00:00.000Z"),
    archivedAt: null,
    participants: []
  };
  return [
    {
      ...base,
      id: "task-1",
      title: "Discovery",
      status: "done",
      statusId: "done",
      statusName: "Готово",
      statusCategory: "done"
    },
    {
      ...base,
      id: "task-2",
      title: "Build",
      status: "in_progress",
      statusId: "in-progress",
      statusName: "В работе",
      statusCategory: "in_progress",
      plannedStart: new Date("2026-05-05T00:00:00.000Z"),
      plannedFinish: new Date("2026-05-10T00:00:00.000Z"),
      plannedWork: 4,
      actualWork: 5,
      progress: 50
    }
  ];
}

function createSnapshot(): PlanSnapshot {
  return {
    tenantId: "tenant-alpha",
    projectId: "project-alpha",
    planVersion: 7,
    project: {
      id: "project-alpha",
      sourceType: "manual",
      sourceOpportunityId: null,
      plannedStart: "2026-05-01",
      plannedFinish: "2026-05-10",
      deadline: "2026-05-10",
      calendarId: null
    },
    tasks: [
      {
        id: "task-1",
        parentTaskId: null,
        wbsCode: "1",
        title: "Discovery",
        statusId: "done",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-01",
        plannedFinish: "2026-05-04",
        plannedStartInstant: { date: "2026-05-01", minuteOfDay: 540 },
        plannedFinishInstant: { date: "2026-05-04", minuteOfDay: 1080 },
        durationMinutes: 960,
        workMinutes: 480,
        percentComplete: 100,
        calendarId: null,
        customFields: {},
        constraint: null
      },
      {
        id: "task-2",
        parentTaskId: null,
        wbsCode: "2",
        title: "Build",
        statusId: "in-progress",
        schedulingMode: "auto",
        taskType: "fixed_units",
        effortDriven: false,
        plannedStart: "2026-05-05",
        plannedFinish: "2026-05-10",
        plannedStartInstant: { date: "2026-05-05", minuteOfDay: 540 },
        plannedFinishInstant: { date: "2026-05-10", minuteOfDay: 1080 },
        durationMinutes: 1440,
        workMinutes: 240,
        percentComplete: 50,
        calendarId: null,
        customFields: {},
        constraint: null
      }
    ],
    assignments: [],
    assignmentAllocations: [],
    dependencies: [],
    baselines: [],
    calendars: [],
    calendarExceptions: [],
    resources: [],
    reservations: [],
    constraints: [],
    capturedAt: "2026-05-11T10:00:00.000Z"
  };
}
