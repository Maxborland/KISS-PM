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
      { headers: { cookie: "kiss_pm_session=session-alpha" } }
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

  const dataSource: ApiTenantDataSource = {
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
      return operation(dataSource);
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
      auditEvents.unshift({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    }
  };

  return { dataSource, projects, auditEvents };
}

function mutationHeaders() {
  return {
    "content-type": "application/json",
    cookie: "kiss_pm_session=session-alpha",
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
