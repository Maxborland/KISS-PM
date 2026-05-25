import {
  canApplyTemplateImprovements,
  canExecuteManagementActions,
  canManageProjects,
  canManageRetrospectives,
  canReadProjectPlan,
  canReadProjects,
  canReadRetrospectives,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  buildClosurePlanFactSummary,
  buildClosureSnapshotPayload,
  buildTemplateImprovementImpact,
  type ClosureLessonCategory,
  type ClosureLessonImpact,
  type PlanSnapshot,
  type ProjectClosureSnapshot,
  type RetrospectiveLesson,
  type RetrospectiveReadModel,
  type TemplateImprovementAction,
  type TenantUser
} from "@kiss-pm/domain";
import { randomUUID } from "node:crypto";

import type { ApiTenantDataSource, ManagementAuditEventInput, ProjectRecord } from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

type TemplateImprovementActionPersistenceInput = Omit<
  TemplateImprovementAction,
  "createdAt" | "appliedAt"
> & {
  createdAt: Date;
  appliedAt: Date | null;
};

type ClosureFailureResult = {
  ok: false;
  status: 404 | 409;
  error: "project_not_found" | "project_not_closable";
};

export function registerRetrospectiveRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/workspace/projects/:projectId/closure", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getRetrospectiveReadModel) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = readDecision(actor, profile);
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const projectId = context.req.param("projectId");
    const project = await findProject(deps.dataSource, actor.tenantId, projectId);
    if (!project) return context.json({ error: "project_not_found" }, 404);

    const readModel = await deps.dataSource.getRetrospectiveReadModel(
      actor.tenantId,
      projectId
    );
    return context.json({ project, ...readModel });
  });

  app.post("/api/workspace/projects/:projectId/closure/preview", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot || !deps.dataSource.listProjectTasks) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = readDecision(actor, profile);
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const projectId = context.req.param("projectId");
    const project = await findProject(deps.dataSource, actor.tenantId, projectId);
    if (!project) return context.json({ error: "project_not_found" }, 404);
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, projectId);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    const tasks = await deps.dataSource.listProjectTasks(actor.tenantId, projectId);
    const planFactSummary = buildClosurePlanFactSummary({
      snapshot,
      factTasks: tasks.map((task) => ({
        id: task.id,
        actualWorkMinutes: task.actualWork * 60,
        progress: task.progress,
        statusCategory: task.statusCategory
      }))
    });
    return context.json({
      canClose: project.status === "active" || project.status === "paused",
      projectStatus: project.status,
      planFactSummary,
      proposedTemplateImprovement: project.templateId
        ? buildTemplateImprovementProposal(project, "preview", planFactSummary, actor.id)
        : null
    });
  });

  app.post("/api/workspace/projects/:projectId/closure/close", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getPlanSnapshot ||
      !deps.dataSource.listProjectTasks ||
      !deps.dataSource.closeProject ||
      !deps.dataSource.withTransaction ||
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseClosureBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = closeDecision(actor, profile);
    if (!decision.allowed) {
      await appendDeniedAudit(deps, actor, "project.close_denied", {
        projectId: context.req.param("projectId")
      }, decision);
      return context.json({ error: decision.reason }, 403);
    }
    const projectId = context.req.param("projectId");

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.getPlanSnapshot ||
        !transactionDataSource.listProjectTasks ||
        !transactionDataSource.closeProject ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const project = await findProject(transactionDataSource, actor.tenantId, projectId);
      if (!project) return { ok: false as const, status: 404, error: "project_not_found" };
      if (project.status !== "active" && project.status !== "paused") {
        return { ok: false as const, status: 409, error: "project_not_closable" };
      }
      const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      const tasks = await transactionDataSource.listProjectTasks(actor.tenantId, projectId);
      const closedAt = new Date();
      const planFactSummary = buildClosurePlanFactSummary({
        snapshot,
        factTasks: tasks.map((task) => ({
          id: task.id,
          actualWorkMinutes: task.actualWork * 60,
          progress: task.progress,
          statusCategory: task.statusCategory
        }))
      });
      const snapshotId = `closure-${randomUUID()}`;
      const auditEventId = `audit-${randomUUID()}`;
      const closureSnapshot: Omit<ProjectClosureSnapshot, "closedAt"> & { closedAt: Date } = {
        id: snapshotId,
        tenantId: actor.tenantId,
        projectId,
        projectStatusBefore: project.status,
        planVersion: snapshot.planVersion,
        snapshotPayload: buildClosureSnapshotPayload(snapshot),
        planFactSummary,
        closedByUserId: actor.id,
        closedAt,
        closeReason: parsed.value.closeReason,
        auditEventId
      };
      const lessons = parsed.value.lessons.map((lesson) => ({
        ...lesson,
        id: `lesson-${randomUUID()}`,
        tenantId: actor.tenantId,
        projectId,
        snapshotId,
        createdByUserId: actor.id,
        createdAt: closedAt
      }));
      const improvementActions = project.templateId
        ? [
            buildTemplateImprovementActionInput(
              project,
              snapshotId,
              planFactSummary,
              actor.id,
              closedAt
            )
          ]
        : [];

      let readModel: RetrospectiveReadModel;
      try {
        readModel = await transactionDataSource.closeProject({
          snapshot: closureSnapshot,
          lessons,
          templateImprovementActions: improvementActions
        });
      } catch (error) {
        const mappedError = closurePersistenceErrorResult(error);
        if (mappedError) return mappedError;
        throw error;
      }
      await deps.appendManagementAuditEvent(
        {
          auditEventId,
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "project.closed",
          sourceWorkflow: "closure",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: { closeReason: parsed.value.closeReason },
          beforeState: { project, planVersion: snapshot.planVersion },
          afterState: {
            snapshotId,
            planFactSummary,
            lessonIds: readModel.lessons.map((lesson) => lesson.id),
            templateImprovementActionIds: readModel.templateImprovementActions.map(
              (action) => action.id
            )
          },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, body: { projectId, ...readModel, auditEventId } };
    });

    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      if (result.status === 409) return context.json({ error: result.error }, 409);
      return context.json({ error: result.error }, 400);
    }
    return context.json(result.body);
  });

  app.post("/api/workspace/projects/:projectId/closure/lessons", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getRetrospectiveReadModel ||
      !deps.dataSource.addRetrospectiveLesson ||
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseLessonBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const profile = await deps.getActorProfile(actor);
    const decision = canManageRetrospectives({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const projectId = context.req.param("projectId");
    const readModel = await deps.dataSource.getRetrospectiveReadModel(actor.tenantId, projectId);
    if (!readModel.snapshot) return context.json({ error: "closure_snapshot_not_found" }, 404);
    const lesson = await deps.dataSource.addRetrospectiveLesson({
      ...parsed.value,
      id: `lesson-${randomUUID()}`,
      tenantId: actor.tenantId,
      projectId,
      snapshotId: readModel.snapshot.id,
      createdByUserId: actor.id,
      createdAt: new Date()
    });
    const auditEventId = await deps.appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "retrospective.lesson.created",
      sourceWorkflow: "closure",
      sourceEntity: { type: "ProjectClosureSnapshot", id: readModel.snapshot.id },
      commandInput: { lesson },
      beforeState: null,
      afterState: { lesson },
      permissionResult: decision,
      executionResult: { status: "succeeded" }
    });
    return context.json({ lesson, auditEventId }, 201);
  });

  app.post(
    "/api/workspace/projects/:projectId/closure/template-improvement-actions/:actionId/apply",
    async (context) => {
      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (
        !deps.dataSource.applyTemplateImprovementAction ||
        !deps.dataSource.appendAuditEvent ||
        !deps.dataSource.withTransaction
      ) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }
      const profile = await deps.getActorProfile(actor);
      const decision = templateImprovementDecision(actor, profile);
      if (!decision.allowed) return context.json({ error: decision.reason }, 403);
      const projectId = context.req.param("projectId");
      const actionId = context.req.param("actionId");
      const auditEventId = `audit-${randomUUID()}`;
      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.applyTemplateImprovementAction ||
          !transactionDataSource.appendAuditEvent
        ) {
          return { ok: false as const, status: 501, error: "persistence_not_configured" };
        }
        const action = await transactionDataSource.applyTemplateImprovementAction({
          tenantId: actor.tenantId,
          projectId,
          actionId,
          actorUserId: actor.id,
          auditEventId,
          appliedAt: new Date()
        });
        if (!action) {
          return {
            ok: false as const,
            status: 404,
            error: "template_improvement_action_not_found"
          };
        }
        await deps.appendManagementAuditEvent(
          {
            auditEventId,
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "template_improvement.applied",
            sourceWorkflow: "closure",
            sourceEntity: { type: "TemplateImprovementAction", id: action.id },
            commandInput: { actionId },
            beforeState: null,
            afterState: { action },
            permissionResult: decision,
            executionResult: { status: "succeeded" }
          },
          transactionDataSource
        );
        return { ok: true as const, body: { action, auditEventId } };
      });
      if (!result.ok) {
        if (result.status === 501) return context.json({ error: result.error }, 501);
        if (result.status === 404) return context.json({ error: result.error }, 404);
        return context.json({ error: result.error }, 400);
      }
      return context.json(result.body);
    }
  );

  app.get("/api/tenant/current/project-templates/:templateId/retrospective-insights", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listTemplateImprovementActions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = readDecision(actor, profile);
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const actions = await deps.dataSource.listTemplateImprovementActions({
      tenantId: actor.tenantId,
      templateId: context.req.param("templateId"),
      status: "applied"
    });
    return context.json({
      templateId: context.req.param("templateId"),
      appliedImprovements: actions,
      estimationLearning: summarizeTemplateLearning(actions)
    });
  });
}

function readDecision(actor: TenantUser, profile: AccessProfile): PolicyDecision {
  const projectDecision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
  if (!projectDecision.allowed) return projectDecision;
  const planDecision = canReadProjectPlan({ actor, profile, targetTenantId: actor.tenantId });
  if (!planDecision.allowed) return planDecision;
  return canReadRetrospectives({ actor, profile, targetTenantId: actor.tenantId });
}

function closeDecision(actor: TenantUser, profile: AccessProfile): PolicyDecision {
  const manageProjectDecision = canManageProjects({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!manageProjectDecision.allowed) return manageProjectDecision;
  const executeDecision = canExecuteManagementActions({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!executeDecision.allowed) return executeDecision;
  return canManageRetrospectives({ actor, profile, targetTenantId: actor.tenantId });
}

function templateImprovementDecision(
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const executeDecision = canExecuteManagementActions({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
  if (!executeDecision.allowed) return executeDecision;
  return canApplyTemplateImprovements({
    actor,
    profile,
    targetTenantId: actor.tenantId
  });
}

async function findProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  return (await dataSource.listProjects?.(tenantId))?.find((project) => project.id === projectId);
}

function parseClosureBody(input: unknown):
  | { ok: true; value: { closeReason: string; lessons: Array<Omit<RetrospectiveLesson, "id" | "tenantId" | "projectId" | "snapshotId" | "createdByUserId" | "createdAt">> } }
  | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "closure_input_invalid" };
  const closeReason = stringField(input, "closeReason");
  if (!closeReason) return { ok: false, error: "closure_reason_required" };
  const lessons = Array.isArray(input.lessons) ? input.lessons : [];
  const parsedLessons = lessons.map(parseLessonValue);
  if (parsedLessons.some((lesson) => !lesson)) {
    return { ok: false, error: "retrospective_lesson_invalid" };
  }
  return {
    ok: true,
    value: {
      closeReason,
      lessons: parsedLessons.filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson))
    }
  };
}

function parseLessonBody(input: unknown):
  | { ok: true; value: Omit<RetrospectiveLesson, "id" | "tenantId" | "projectId" | "snapshotId" | "createdByUserId" | "createdAt"> }
  | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "retrospective_lesson_invalid" };
  const parsed = parseLessonValue(input);
  return parsed ? { ok: true, value: parsed } : { ok: false, error: "retrospective_lesson_invalid" };
}

function parseLessonValue(input: unknown) {
  if (!isObject(input)) return null;
  const category = stringField(input, "category");
  const title = stringField(input, "title");
  const body = stringField(input, "body");
  const impact = stringField(input, "impact") ?? "neutral";
  if (
    !title ||
    !body ||
    !isLessonCategory(category) ||
    !isLessonImpact(impact)
  ) {
    return null;
  }
  return { category, title, body, impact };
}

function buildTemplateImprovementProposal(
  project: ProjectRecord,
  snapshotId: string,
  planFactSummary: ProjectClosureSnapshot["planFactSummary"],
  actorUserId: string,
  createdAt?: Date
): TemplateImprovementAction {
  const impact = buildTemplateImprovementImpact(planFactSummary);
  return {
    id: `template-improvement-${randomUUID()}`,
    tenantId: project.tenantId,
    projectId: project.id,
    snapshotId,
    templateId: project.templateId ?? "",
    status: "proposed",
    title: `Уточнить шаблон по закрытому проекту ${project.title}`,
    description:
      `План/факт: ${impact.plannedWorkDeltaMinutes} мин по работе, ` +
      `${impact.plannedDurationDeltaDays} дн по сроку.`,
    impact,
    createdByUserId: actorUserId,
    appliedByUserId: null,
    createdAt: (createdAt ?? new Date()).toISOString(),
    appliedAt: null,
    auditEventId: null
  };
}

function buildTemplateImprovementActionInput(
  project: ProjectRecord,
  snapshotId: string,
  planFactSummary: ProjectClosureSnapshot["planFactSummary"],
  actorUserId: string,
  createdAt: Date
): TemplateImprovementActionPersistenceInput {
  const proposal = buildTemplateImprovementProposal(
    project,
    snapshotId,
    planFactSummary,
    actorUserId,
    createdAt
  );
  return {
    ...proposal,
    createdAt,
    appliedAt: null
  };
}

function summarizeTemplateLearning(actions: TemplateImprovementAction[]) {
  return actions.reduce(
    (summary, action) => ({
      appliedActionCount: summary.appliedActionCount + 1,
      plannedWorkDeltaMinutes:
        summary.plannedWorkDeltaMinutes + action.impact.plannedWorkDeltaMinutes,
      plannedDurationDeltaDays:
        summary.plannedDurationDeltaDays + action.impact.plannedDurationDeltaDays
    }),
    { appliedActionCount: 0, plannedWorkDeltaMinutes: 0, plannedDurationDeltaDays: 0 }
  );
}

async function appendDeniedAudit(
  deps: ApiRouteDeps,
  actor: TenantUser,
  actionType: string,
  input: Record<string, unknown>,
  decision: PolicyDecision
) {
  if (!deps.dataSource.appendAuditEvent) return;
  const auditInput: ManagementAuditEventInput = {
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    actionType,
    sourceWorkflow: "closure",
    sourceEntity: { type: "Project", id: String(input.projectId ?? "unknown") },
    commandInput: input,
    beforeState: null,
    afterState: null,
    permissionResult: decision,
    executionResult: { status: "denied" }
  };
  await deps.appendManagementAuditEvent(auditInput);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function closurePersistenceErrorResult(error: unknown): ClosureFailureResult | null {
  if (!(error instanceof Error)) return null;
  if (error.message === "project_not_found") {
    return { ok: false as const, status: 404, error: "project_not_found" };
  }
  if (error.message === "project_not_closable") {
    return { ok: false as const, status: 409, error: "project_not_closable" };
  }
  return null;
}

function stringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isLessonCategory(value: string | null): value is ClosureLessonCategory {
  return (
    value === "schedule" ||
    value === "scope" ||
    value === "resource" ||
    value === "quality" ||
    value === "communication" ||
    value === "commercial" ||
    value === "process"
  );
}

function isLessonImpact(value: string): value is ClosureLessonImpact {
  return value === "positive" || value === "negative" || value === "neutral";
}
