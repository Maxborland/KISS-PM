import {
  canExecuteManagementActions,
  canManageControlSignals,
  canReadControlSignals,
  canReadKpiDefinitions,
  canReadProjectPlan,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  buildResourceLoadMatrix,
  calculatePlan,
  createControlSignalsFromEvaluations,
  createDefaultProjectKpiDefinitions,
  evaluateProjectKpis,
  proposeManagementActions,
  type ControlSignal,
  type KpiDefinition,
  type TenantUser
} from "@kiss-pm/domain";
import { randomUUID } from "node:crypto";

import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import {
  persistControlSignalNotifications
} from "./collaborationNotificationService";
import { readLimitedJsonBody } from "./jsonBody";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { notifyPlanVersionChanged } from "./planningEventBus";
import { PLANNING_ENGINE_VERSION } from "./planning/planningConstants";
import { createPlanningReadModel } from "./planning/planningReadModel";
import { executeApplyManagementAction } from "./control/managementActionApplyHandler";
import { decisionForActionPermissions } from "./control/managementActionPermissions";
import {
  executeCreateCorrectiveAction,
  executeUpdateCorrectiveAction
} from "./control/correctiveActionCommandHandlers";
import { executeUpdateControlSignalStatus } from "./control/controlSignalCommandHandlers";
import { executeUpsertKpiDefinition } from "./control/kpiDefinitionCommandHandlers";
import { includeResourceExceptionsFor } from "./planning/planningRouteAuth";
import { summarizeSnapshot } from "./planning/planningRouteHelpers";
import {
  parseControlSignalIdParam,
  parseCorrectiveActionIdParam,
  parseManagementActionIdParam,
  parseProjectIdParam
} from "./routeParamParsers";

export function registerControlRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/tenant/current/kpi-definitions", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const decision = canReadKpiDefinitions({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    if (!deps.dataSource.listKpiDefinitions) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const definitions = await listDefinitionsOrDefaults(deps, actor.tenantId);
    return context.json({ definitions });
  });

  app.post("/api/tenant/current/kpi-definitions", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.upsertKpiDefinition || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const result = await executeUpsertKpiDefinition({
      actor,
      profile: await deps.getActorProfile(actor),
      readBody: () => readLimitedJsonBody(context),
      deps: {
        dataSource: deps.dataSource,
        appendManagementAuditEvent: deps.appendManagementAuditEvent,
        runDataSourceTransaction: (operation) =>
          deps.runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
      }
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 403) return context.json({ error: result.error }, 403);
      if (result.status === 413) return context.json({ error: result.error }, 413);
      if (result.status === 415) return context.json({ error: result.error }, 415);
      return context.json({ error: result.error }, 400);
    }
    const { definition, auditEventId } = result;
    return context.json({ definition, auditEventId });
  });

  app.get("/api/workspace/projects/:projectId/control/read-model", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const readPlanDecision = canReadProjectPlan({ actor, profile, targetTenantId: actor.tenantId });
    if (!readPlanDecision.allowed) return context.json({ error: readPlanDecision.reason }, 403);
    const kpiDefinitionsDecision = canReadKpiDefinitions({ actor, profile, targetTenantId: actor.tenantId });
    if (!kpiDefinitionsDecision.allowed) return context.json({ error: kpiDefinitionsDecision.reason }, 403);
    const controlDecision = canReadControlSignals({ actor, profile, targetTenantId: actor.tenantId });
    if (!controlDecision.allowed) return context.json({ error: controlDecision.reason }, 403);
    if (!deps.dataSource.listKpiEvaluations || !deps.dataSource.listControlSignals) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const definitions = await listDefinitionsOrDefaults(deps, actor.tenantId);
    const [evaluations, signals, correctiveActions, actionExecutions] = await Promise.all([
      deps.dataSource.listKpiEvaluations(actor.tenantId, projectId.value),
      deps.dataSource.listControlSignals(actor.tenantId, projectId.value),
      deps.dataSource.listCorrectiveActions?.(actor.tenantId, projectId.value) ?? Promise.resolve([]),
      deps.dataSource.listActionExecutions?.(actor.tenantId, projectId.value) ?? Promise.resolve([])
    ]);
    const auditEvents = ((await deps.dataSource.listAuditEventsByTenantId?.(actor.tenantId)) ?? [])
      .filter((event) => event.sourceWorkflow === "control")
      .filter(
        (event) =>
          event.sourceEntity.id === projectId.value ||
          signals.some((signal) => event.sourceEntity.id === signal.id) ||
          correctiveActions.some((action) => event.sourceEntity.id === action.id)
      );
    return context.json({
      definitions,
      evaluations,
      signals,
      correctiveActions,
      actionExecutions,
      auditEvents
    });
  });

  app.post("/api/workspace/projects/:projectId/control/evaluate", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getPlanSnapshot ||
      !deps.dataSource.listKpiDefinitions ||
      !deps.dataSource.upsertKpiDefinition ||
      !deps.dataSource.createKpiEvaluation ||
      !deps.dataSource.upsertControlSignal ||
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const readPlanDecision = canReadProjectPlan({ actor, profile, targetTenantId: actor.tenantId });
    if (!readPlanDecision.allowed) return context.json({ error: readPlanDecision.reason }, 403);
    const controlDecision = canReadControlSignals({ actor, profile, targetTenantId: actor.tenantId });
    if (!controlDecision.allowed) return context.json({ error: controlDecision.reason }, 403);
    const controlManageDecision = canManageControlSignals({ actor, profile, targetTenantId: actor.tenantId });
    if (!controlManageDecision.allowed) return context.json({ error: controlManageDecision.reason }, 403);
    if (!deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, projectId.value);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);

    const now = new Date().toISOString();
    const definitions = await deps.runDataSourceTransaction((transactionDataSource) =>
      ensureDefinitionsOrDefaults(deps, actor.tenantId, transactionDataSource)
    );
    const calculatedPlan = calculatePlan(snapshot, {
      calculatedAt: now,
      engineVersion: PLANNING_ENGINE_VERSION
    });
    const resourceLoad = buildResourceLoadMatrix({
      plan: calculatedPlan,
      resources: snapshot.resources,
      assignments: snapshot.assignments,
      assignmentAllocations: snapshot.assignmentAllocations,
      calendars: snapshot.calendars,
      calendarExceptions: snapshot.calendarExceptions,
      reservations: snapshot.reservations,
      rangeStart: snapshot.project.plannedStart,
      rangeFinish: calculatedPlan.projectFinish ?? snapshot.project.plannedFinish,
      granularities: ["day"]
    });
    const evaluations = withUniqueEvaluationIds(
      evaluateProjectKpis({ definitions, snapshot, calculatedPlan, resourceLoad, evaluatedAt: now })
    );
    const rawSignals = createControlSignalsFromEvaluations({
      definitions,
      evaluations,
      snapshot,
      now
    });
    const proposals = proposeManagementActions({
      snapshot,
      calculatedPlan,
      resourceLoad,
      signals: rawSignals,
      calculatedAt: now
    });
    const signals = rawSignals.map((signal) => ({
      ...signal,
      scenarioProposals: proposals.filter((proposal) => proposal.targetEntity.id === signal.id)
    }));

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.createKpiEvaluation ||
        !transactionDataSource.upsertControlSignal ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const };
      }
      const previousSignals =
        await transactionDataSource.listControlSignals?.(actor.tenantId, projectId.value) ?? [];
      const persistedEvaluations = [];
      for (const evaluation of evaluations) {
        persistedEvaluations.push(await transactionDataSource.createKpiEvaluation(evaluation));
      }
      const persistedSignals = [];
      for (const signal of signals) {
        persistedSignals.push(await transactionDataSource.upsertControlSignal(signal));
      }
      await persistControlSignalNotifications({
        dataSource: transactionDataSource,
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        snapshot,
        signals: persistedSignals,
        previousSignals
      });
      const auditEventId = await appendControlAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "kpi.evaluated",
          sourceWorkflow: "control",
          sourceEntity: { type: "Project", id: projectId.value },
          commandInput: { projectId: projectId.value, planVersion: snapshot.planVersion },
          beforeState: null,
          afterState: {
            evaluationIds: persistedEvaluations.map((evaluation) => evaluation.id),
            signalIds: persistedSignals.map((signal) => signal.id)
          },
          permissionResult: controlManageDecision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, persistedEvaluations, persistedSignals, auditEventId };
    });
    if (!result.ok) return context.json({ error: "persistence_not_configured" }, 501);

    return context.json({
      evaluations: result.persistedEvaluations,
      signals: result.persistedSignals,
      actionCandidates: proposals,
      auditEventId: result.auditEventId
    });
  });

  app.post(
    "/api/workspace/projects/:projectId/control/signals/:signalId/actions/:actionId/preview",
    async (context) => {
      const routeIds = parseControlActionRouteParams(context);
      if (!routeIds.ok) return context.json({ error: routeIds.error }, 400);

      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (
        !deps.dataSource.listControlSignals ||
        !deps.dataSource.createActionExecution ||
        !deps.dataSource.appendAuditEvent ||
        !deps.dataSource.withTransaction
      ) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }
      const profile = await deps.getActorProfile(actor);
      const { projectId, signalId, actionId } = routeIds.value;
      const decision = canExecuteManagementActions({ actor, profile, targetTenantId: actor.tenantId });
      if (!decision.allowed) {
        await appendManagementActionDeniedAudit(deps, {
          actor,
          projectId,
          signalId,
          actionId,
          permissionResult: decision,
          stage: "preview"
        });
        return context.json({ error: decision.reason }, 403);
      }
      const controlReadDecision = canReadControlSignals({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!controlReadDecision.allowed) {
        await appendManagementActionDeniedAudit(deps, {
          actor,
          projectId,
          signalId,
          actionId,
          permissionResult: controlReadDecision,
          stage: "preview"
        });
        return context.json({ error: controlReadDecision.reason }, 403);
      }

      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.listControlSignals ||
          !transactionDataSource.createActionExecution ||
          !transactionDataSource.appendAuditEvent
        ) {
          return { ok: false as const, status: 501, error: "persistence_not_configured" };
        }
        const signal = (await transactionDataSource.listControlSignals(actor.tenantId, projectId)).find(
          (candidate) => candidate.id === signalId
        );
        const action = signal?.scenarioProposals.find((candidate) => candidate.id === actionId);
        if (!signal || !action) return { ok: false as const, status: 404, error: "action_candidate_not_found" };

        const requiredDecision = decisionForActionPermissions(action, actor, profile);
        if (!requiredDecision.allowed) {
          const auditEventId = await appendControlAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "management_action.denied",
            sourceWorkflow: "control",
            sourceEntity: { type: "ControlSignal", id: signalId },
            commandInput: { actionId, requiredPermissions: action.requiredPermissions },
            beforeState: { signal },
            afterState: null,
            permissionResult: requiredDecision,
            executionResult: { status: "denied", stage: "preview" }
          }, transactionDataSource);
          await transactionDataSource.createActionExecution({
            id: `action-exec-${randomUUID()}`,
            tenantId: actor.tenantId,
            projectId,
            actionType: action.type,
            targetEntity: action.targetEntity,
            actorUserId: actor.id,
            input: action.input,
            previewPayload: null,
            resultPayload: { error: requiredDecision.reason },
            status: "denied",
            auditEventId
          });
          return { ok: false as const, status: 403, error: requiredDecision.reason };
        }

        const executionId = `action-exec-${randomUUID()}`;
        const auditEventId = await appendControlAuditIfConfigured(deps, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "management_action.previewed",
          sourceWorkflow: "control",
          sourceEntity: { type: "ControlSignal", id: signalId },
          commandInput: { actionId },
          beforeState: { signal },
          afterState: { action, executionId },
          permissionResult: decision,
          executionResult: { status: "previewed" }
        }, transactionDataSource);
        const execution = await transactionDataSource.createActionExecution({
          id: executionId,
          tenantId: actor.tenantId,
          projectId,
          actionType: action.type,
          targetEntity: action.targetEntity,
          actorUserId: actor.id,
          input: action.input,
          previewPayload: { action },
          resultPayload: null,
          status: "previewed",
          auditEventId
        });
        return { ok: true as const, body: { action, execution, auditEventId } };
      });

      if (!result.ok) {
        if (result.status === 501) return context.json({ error: result.error }, 501);
        if (result.status === 403) return context.json({ error: result.error }, 403);
        return context.json({ error: result.error }, 404);
      }
      return context.json(result.body);
    }
  );

  app.post(
    "/api/workspace/projects/:projectId/control/signals/:signalId/actions/:actionId/apply",
    async (context) => {
      const routeIds = parseControlActionRouteParams(context);
      if (!routeIds.ok) return context.json({ error: routeIds.error }, 400);

      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (
        !deps.dataSource.listControlSignals ||
        !deps.dataSource.createActionExecution ||
        !deps.dataSource.appendAuditEvent ||
        !deps.dataSource.withTransaction
      ) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }

      const { projectId, signalId, actionId } = routeIds.value;
      const profile = await deps.getActorProfile(actor);
      const result = await executeApplyManagementAction({
        actor,
        profile,
        projectId,
        signalId,
        actionId,
        readBody: () => readLimitedJsonBody(context),
        deps: {
          dataSource: deps.dataSource,
          auditDataSource: deps.dataSource,
          appendManagementAuditEvent: deps.appendManagementAuditEvent,
          runDataSourceTransaction: (operation) =>
            deps.runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
        }
      });

      if (result.status !== 200) {
        if (result.status === 501) return context.json(result.body, 501);
        if (result.status === 404) return context.json(result.body, 404);
        if (result.status === 403) return context.json(result.body, 403);
        if (result.status === 409) return context.json(result.body, 409);
        if (result.status === 413) return context.json(result.body, 413);
        if (result.status === 415) return context.json(result.body, 415);
        return context.json(result.body, 400);
      }

      invalidateCapacityCacheForTenant(actor.tenantId);
      notifyPlanVersionChanged(projectId, result.body.newPlanVersion);
      const { appliedSnapshot, ...responseBody } = result.body;
      return context.json({
        ...responseBody,
        readModel: createPlanningReadModel(appliedSnapshot, {
          includeResourceExceptions: includeResourceExceptionsFor({ actor, profile })
        })
      });
    }
  );
  app.post("/api/workspace/projects/:projectId/control/signals/:signalId/status", async (context) => {
    const routeIds = parseControlSignalRouteParams(context);
    if (!routeIds.ok) return context.json({ error: routeIds.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.listControlSignals ||
      !deps.dataSource.upsertControlSignal ||
      !deps.dataSource.appendAuditEvent ||
      !deps.dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);

    const { projectId, signalId } = routeIds.value;
    const result = await executeUpdateControlSignalStatus({
      actor,
      profile: await deps.getActorProfile(actor),
      projectId,
      signalId,
      body: body.value,
      deps: {
        auditDataSource: deps.dataSource,
        appendManagementAuditEvent: deps.appendManagementAuditEvent,
        runDataSourceTransaction: (operation) =>
          deps.runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
      }
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 403) return context.json({ error: result.error }, 403);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }

    return context.json({ signal: result.signal, auditEventId: result.auditEventId });
  });
  app.post("/api/workspace/projects/:projectId/control/signals/:signalId/corrective-actions", async (context) => {
    const routeIds = parseControlSignalRouteParams(context);
    if (!routeIds.ok) return context.json({ error: routeIds.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.listControlSignals ||
      !deps.dataSource.createCorrectiveAction ||
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const { projectId, signalId } = routeIds.value;

    const result = await executeCreateCorrectiveAction({
      actor,
      profile,
      projectId,
      signalId,
      body: body.value,
      deps: {
        dataSource: deps.dataSource,
        appendManagementAuditEvent: deps.appendManagementAuditEvent,
        runDataSourceTransaction: (operation) =>
          deps.runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
      }
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 403) return context.json({ error: result.error }, 403);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }
    return context.json({
      correctiveAction: result.correctiveAction,
      actionExecution: result.actionExecution,
      auditEventId: result.auditEventId
    });
  });

  app.patch("/api/workspace/projects/:projectId/control/corrective-actions/:correctiveActionId", async (context) => {
    const projectId = parseProjectIdParam(context.req.param("projectId"));
    if (!projectId.ok) return context.json({ error: projectId.error }, 400);
    const correctiveActionId = parseCorrectiveActionIdParam(context.req.param("correctiveActionId"));
    if (!correctiveActionId.ok) return context.json({ error: correctiveActionId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.listCorrectiveActions ||
      !deps.dataSource.updateCorrectiveAction ||
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const profile = await deps.getActorProfile(actor);

    const result = await executeUpdateCorrectiveAction({
      actor,
      profile,
      projectId: projectId.value,
      correctiveActionId: correctiveActionId.value,
      body: body.value,
      deps: {
        dataSource: deps.dataSource,
        appendManagementAuditEvent: deps.appendManagementAuditEvent,
        runDataSourceTransaction: (operation) =>
          deps.runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
      }
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 403) return context.json({ error: result.error }, 403);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }
    return context.json({ correctiveAction: result.correctiveAction, auditEventId: result.auditEventId });
  });
}

type RouteParamContext = {
  req: {
    param(name: string): string;
  };
};

function parseControlSignalRouteParams(
  context: RouteParamContext
):
  | { ok: true; value: { projectId: string; signalId: string } }
  | { ok: false; error: string } {
  const projectId = parseProjectIdParam(context.req.param("projectId"));
  if (!projectId.ok) return projectId;
  const signalId = parseControlSignalIdParam(context.req.param("signalId"));
  if (!signalId.ok) return signalId;
  return { ok: true, value: { projectId: projectId.value, signalId: signalId.value } };
}

function parseControlActionRouteParams(
  context: RouteParamContext
):
  | { ok: true; value: { projectId: string; signalId: string; actionId: string } }
  | { ok: false; error: string } {
  const signalRoute = parseControlSignalRouteParams(context);
  if (!signalRoute.ok) return signalRoute;
  const actionId = parseManagementActionIdParam(context.req.param("actionId"));
  if (!actionId.ok) return actionId;
  return { ok: true, value: { ...signalRoute.value, actionId: actionId.value } };
}

async function listDefinitionsOrDefaults(deps: ApiRouteDeps, tenantId: string): Promise<KpiDefinition[]> {
  const definitions = (await deps.dataSource.listKpiDefinitions?.(tenantId)) ?? [];
  return definitions.length > 0 ? definitions : createDefaultProjectKpiDefinitions(tenantId);
}

async function ensureDefinitionsOrDefaults(
  deps: ApiRouteDeps,
  tenantId: string,
  dataSource: ApiRouteDeps["dataSource"] = deps.dataSource
): Promise<KpiDefinition[]> {
  const definitions = await dataSource.listKpiDefinitions?.(tenantId);
  if (!definitions || definitions.length > 0) return definitions ?? createDefaultProjectKpiDefinitions(tenantId);
  const defaults = createDefaultProjectKpiDefinitions(tenantId);
  const persisted: KpiDefinition[] = [];
  for (const definition of defaults) {
    const upserted = await dataSource.upsertKpiDefinition?.(definition);
    if (!upserted) throw new Error("kpi_definition_persistence_not_configured");
    persisted.push(upserted);
  }
  return persisted;
}

function withUniqueEvaluationIds<T extends { id: string }>(evaluations: T[]): T[] {
  return evaluations.map((evaluation) => ({ ...evaluation, id: `kpi-eval-${randomUUID()}` }));
}

async function appendControlAuditIfConfigured(
  deps: ApiRouteDeps,
  input: Parameters<ApiRouteDeps["appendManagementAuditEvent"]>[0],
  auditDataSource = deps.dataSource
): Promise<string> {
  if (!auditDataSource.appendAuditEvent) throw new Error("audit_not_configured");
  return deps.appendManagementAuditEvent(input, auditDataSource);
}

async function appendManagementActionDeniedAudit(
  deps: ApiRouteDeps,
  input: {
    actor: TenantUser;
    projectId: string;
    signalId: string;
    actionId: string;
    permissionResult: PolicyDecision;
    stage: "preview" | "apply";
  }
): Promise<string> {
  return appendControlAuditIfConfigured(deps, {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: "management_action.denied",
    sourceWorkflow: "control",
    sourceEntity: { type: "ControlSignal", id: input.signalId },
    commandInput: {
      projectId: input.projectId,
      signalId: input.signalId,
      actionId: input.actionId
    },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: { status: "denied", stage: input.stage }
  });
}
