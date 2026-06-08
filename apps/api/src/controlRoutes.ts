import {
  canApplyPlanningScenarios,
  canReadAuditEvents,
  canReadProjects,
  canExecuteManagementActions,
  canManageCorrectiveActions,
  canManageControlSignals,
  canManageProjectPlan,
  canManageProjectResources,
  canManageKpiDefinitions,
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
  isBlockingValidationIssue,
  proposeManagementActions,
  validateKpiFormula,
  type ControlSignal,
  type CorrectiveAction,
  type KpiDefinition,
  type ManagementActionCandidate,
  type TenantUser
} from "@kiss-pm/domain";
import { randomUUID } from "node:crypto";
import type { TaskRecord } from "@kiss-pm/persistence";

import type { ApiTenantDataSource, AuditEventListItem, ProjectRecord } from "./apiTypes";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";
import {
  persistControlSignalNotifications,
  persistPlanningNotifications
} from "./collaborationNotificationService";
import { readLimitedJsonBody } from "./jsonBody";
import { invalidateCapacityCacheForTenant } from "./capacity/registerCapacityRoutes";
import { notifyPlanVersionChanged } from "./planningEventBus";
import { previewPlanningCommands } from "./planning/planningCommandCore";
import { PLANNING_ENGINE_VERSION } from "./planning/planningConstants";
import { createPlanningReadModel } from "./planning/planningReadModel";
import { permissionForCommand } from "./planning/planningRouteAuth";
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


  app.get("/api/tenant/current/operational-control-queue", async (context) => {
    const query = parseOperationalControlQueueQuery({
      asOf: context.req.query("asOf"),
      limit: context.req.query("limit")
    });
    if (!query.ok) return context.json({ error: query.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await deps.getActorProfile(actor);
    const projectDecision = canReadProjects({ actor, profile, targetTenantId: actor.tenantId });
    if (!projectDecision.allowed) return context.json({ error: projectDecision.reason }, 403);
    const controlDecision = canReadControlSignals({ actor, profile, targetTenantId: actor.tenantId });
    if (!controlDecision.allowed) return context.json({ error: controlDecision.reason }, 403);
    const auditDecision = canReadAuditEvents({ actor, profile, targetTenantId: actor.tenantId });
    if (!auditDecision.allowed) return context.json({ error: auditDecision.reason }, 403);

    if (
      !deps.dataSource.listProjects ||
      !deps.dataSource.listProjectTasks ||
      !deps.dataSource.listControlSignals ||
      !deps.dataSource.listCorrectiveActions ||
      !deps.dataSource.listAuditEventsByTenantId
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const items = await buildOperationalControlQueue({
      dataSource: deps.dataSource,
      tenantId: actor.tenantId,
      asOf: query.value.asOf,
      limit: query.value.limit
    });

    return context.json({
      asOf: query.value.asOf.toISOString(),
      limit: query.value.limit,
      items
    });
  });
  app.post("/api/tenant/current/kpi-definitions", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.upsertKpiDefinition || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const decision = canManageKpiDefinitions({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) {
      await deps.appendManagementAuditEvent({
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "kpi.definition.upsert_denied",
        sourceWorkflow: "control",
        sourceEntity: { type: "KpiDefinition", id: "__unknown__" },
        commandInput: { route: "/api/tenant/current/kpi-definitions" },
        beforeState: null,
        afterState: null,
        permissionResult: decision,
        executionResult: { status: "denied" }
      });
      return context.json({ error: decision.reason }, 403);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseKpiDefinitionBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.upsertKpiDefinition || !transactionDataSource.appendAuditEvent) {
        return { ok: false as const };
      }
      const definition = await transactionDataSource.upsertKpiDefinition(parsed.value);
      const auditEventId = await appendControlAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "kpi.definition.upserted",
          sourceWorkflow: "control",
          sourceEntity: { type: "KpiDefinition", id: definition.id },
          commandInput: { definition },
          beforeState: null,
          afterState: { definition },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, definition, auditEventId };
    });
    if (!result.ok) return context.json({ error: "persistence_not_configured" }, 501);
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
      const executeDecision = canExecuteManagementActions({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!executeDecision.allowed) {
        await appendManagementActionDeniedAudit(deps, {
          actor,
          projectId,
          signalId,
          actionId,
          permissionResult: executeDecision,
          stage: "apply"
        });
        return context.json({ error: executeDecision.reason }, 403);
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
          stage: "apply"
        });
        return context.json({ error: controlReadDecision.reason }, 403);
      }

      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsed = parseActionApplyBody(body.value);
      if (!parsed.ok) return context.json({ error: parsed.error }, 400);

      const signal = (await deps.dataSource.listControlSignals(actor.tenantId, projectId)).find(
        (candidate) => candidate.id === signalId
      );
      const action = signal?.scenarioProposals.find((candidate) => candidate.id === actionId);
      if (!signal || !action) return context.json({ error: "action_candidate_not_found" }, 404);
      if (!action.planDelta || action.planDelta.commands.length === 0) {
        return context.json({ error: "action_candidate_has_no_plan_delta" }, 400);
      }

      const requiredDecision = decisionForActionPermissions(action, actor, profile);
      if (!requiredDecision.allowed) {
        const deniedResult = await deps.runDataSourceTransaction(async (transactionDataSource) => {
          if (!transactionDataSource.appendAuditEvent || !transactionDataSource.createActionExecution) {
            return { ok: false as const, status: 501, error: "persistence_not_configured" };
          }
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
            executionResult: { status: "denied" }
          }, transactionDataSource);
          await transactionDataSource.createActionExecution({
            id: `action-exec-${randomUUID()}`,
            tenantId: actor.tenantId,
            projectId,
            actionType: action.type,
            targetEntity: action.targetEntity,
            actorUserId: actor.id,
            input: action.input,
            previewPayload: { action },
            resultPayload: { error: requiredDecision.reason },
            status: "denied",
            auditEventId
          });
          return { ok: true as const };
        });
        if (!deniedResult.ok) return context.json({ error: deniedResult.error }, 501);
        return context.json({ error: requiredDecision.reason }, 403);
      }

      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.listControlSignals ||
          !transactionDataSource.listProjects ||
          !transactionDataSource.getPlanSnapshot ||
          !transactionDataSource.applyPlanningCommand ||
          !transactionDataSource.incrementPlanVersion ||
          !transactionDataSource.appendAuditEvent ||
          !transactionDataSource.createActionExecution
        ) {
          return { ok: false as const, status: 501, error: "persistence_not_configured" };
        }

        await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
        const lockedSignal = (
          await transactionDataSource.listControlSignals(actor.tenantId, projectId)
        ).find((candidate) => candidate.id === signalId);
        const lockedAction = lockedSignal?.scenarioProposals.find(
          (candidate) => candidate.id === actionId
        );
        if (!lockedSignal || !lockedAction?.planDelta) {
          return { ok: false as const, status: 404, error: "action_candidate_not_found" };
        }
        if (lockedAction.planDelta.commands.length === 0) {
          return { ok: false as const, status: 400, error: "action_candidate_has_no_plan_delta" };
        }
        const lockedDecision = decisionForActionPermissions(lockedAction, actor, profile);
        if (!lockedDecision.allowed) {
          const auditEventId = await appendControlAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "management_action.denied",
            sourceWorkflow: "control",
            sourceEntity: { type: "ControlSignal", id: signalId },
            commandInput: { actionId, requiredPermissions: lockedAction.requiredPermissions },
            beforeState: { signal: lockedSignal },
            afterState: null,
            permissionResult: lockedDecision,
            executionResult: { status: "denied" }
          }, transactionDataSource);
          await transactionDataSource.createActionExecution({
            id: `action-exec-${randomUUID()}`,
            tenantId: actor.tenantId,
            projectId,
            actionType: lockedAction.type,
            targetEntity: lockedAction.targetEntity,
            actorUserId: actor.id,
            input: lockedAction.input,
            previewPayload: { action: lockedAction },
            resultPayload: { error: lockedDecision.reason },
            status: "denied",
            auditEventId
          });
          return { ok: false as const, status: 403, error: lockedDecision.reason };
        }

        const activeProject = await findActiveControlProject(
          transactionDataSource,
          actor.tenantId,
          projectId
        );
        if (!activeProject) return { ok: false as const, status: 404, error: "project_not_found" };

        const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
        if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
        if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
          const auditEventId = await appendControlAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "management_action.conflict",
            sourceWorkflow: "control",
            sourceEntity: { type: "ControlSignal", id: signalId },
            commandInput: { actionId, clientPlanVersion: parsed.value.clientPlanVersion },
            beforeState: { planVersion: snapshot.planVersion },
            afterState: null,
            permissionResult: lockedDecision,
            executionResult: { status: "conflict" }
          }, transactionDataSource);
          await transactionDataSource.createActionExecution({
            id: `action-exec-${randomUUID()}`,
            tenantId: actor.tenantId,
            projectId,
            actionType: lockedAction.type,
            targetEntity: lockedAction.targetEntity,
            actorUserId: actor.id,
            input: lockedAction.input,
            previewPayload: { action: lockedAction },
            resultPayload: {
              error: "plan_version_conflict",
              currentPlanVersion: snapshot.planVersion
            },
            status: "failed",
            auditEventId
          });
          return {
            ok: false as const,
            status: 409,
            error: "plan_version_conflict",
            currentPlanVersion: snapshot.planVersion
          };
        }

        const preview = await previewPlanningCommands(
          snapshot,
          lockedAction.planDelta.commands,
          transactionDataSource,
          actor.tenantId
        );
        if (preview.validationIssues.some(isBlockingValidationIssue)) {
          const auditEventId = await appendControlAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "management_action.precondition_failed",
            sourceWorkflow: "control",
            sourceEntity: { type: "ControlSignal", id: signalId },
            commandInput: { actionId, commands: lockedAction.planDelta.commands },
            beforeState: summarizeSnapshot(snapshot),
            afterState: null,
            permissionResult: lockedDecision,
            executionResult: { status: "failed", validationIssues: preview.validationIssues }
          }, transactionDataSource);
          await transactionDataSource.createActionExecution({
            id: `action-exec-${randomUUID()}`,
            tenantId: actor.tenantId,
            projectId,
            actionType: lockedAction.type,
            targetEntity: lockedAction.targetEntity,
            actorUserId: actor.id,
            input: lockedAction.input,
            previewPayload: { action: lockedAction },
            resultPayload: { validationIssues: preview.validationIssues },
            status: "failed",
            auditEventId
          });
          return {
            ok: false as const,
            status: 409,
            error: "planning_precondition_failed",
            validationIssues: preview.validationIssues
          };
        }

        for (const command of lockedAction.planDelta.commands) {
          await transactionDataSource.applyPlanningCommand({
            tenantId: actor.tenantId,
            projectId,
            actorUserId: actor.id,
            command
          });
        }
        const newPlanVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, projectId);
        const auditEventId = await appendControlAuditIfConfigured(deps, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "management_action.applied",
          sourceWorkflow: "control",
          sourceEntity: { type: "ControlSignal", id: signalId },
          commandInput: { action: lockedAction, clientPlanVersion: parsed.value.clientPlanVersion },
          beforeState: summarizeSnapshot(snapshot),
          afterState: {
            planVersion: newPlanVersion,
            changedTaskIds: preview.planDelta.changedTaskIds,
            changedAssignmentIds: preview.planDelta.changedAssignmentIds,
            changedDependencyIds: preview.planDelta.changedDependencyIds
          },
          permissionResult: lockedDecision,
          executionResult: { status: "succeeded", validationIssues: preview.validationIssues }
        }, transactionDataSource);
        const execution = await transactionDataSource.createActionExecution({
          id: `action-exec-${randomUUID()}`,
          tenantId: actor.tenantId,
          projectId,
          actionType: lockedAction.type,
          targetEntity: lockedAction.targetEntity,
          actorUserId: actor.id,
          input: lockedAction.input,
          previewPayload: { action: lockedAction, validationIssues: preview.validationIssues },
          resultPayload: { planDelta: preview.planDelta, newPlanVersion },
          status: "succeeded",
          auditEventId
        });
        const appliedSnapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
        if (!appliedSnapshot) return { ok: false as const, status: 404, error: "project_not_found" };
        await persistPlanningNotifications({
          dataSource: transactionDataSource,
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          beforeSnapshot: snapshot,
          afterSnapshot: appliedSnapshot,
          commands: lockedAction.planDelta.commands
        });

        return {
          ok: true as const,
          body: {
            applied: preview.planDelta,
            newPlanVersion,
            auditEventId,
            actionExecution: execution,
            readModel: createPlanningReadModel(appliedSnapshot)
          }
        };
      });

      if (!result.ok) {
        if (result.status === 501) return context.json({ error: result.error }, 501);
        if (result.status === 404) return context.json({ error: result.error }, 404);
        if (result.status === 403) return context.json({ error: result.error }, 403);
        if (result.status === 409) {
          const { status: _status, ok: _ok, ...responseBody } = result;
          return context.json(responseBody, 409);
        }
        return context.json({ error: result.error }, 400);
      }

      invalidateCapacityCacheForTenant(actor.tenantId);
      notifyPlanVersionChanged(projectId, result.body.newPlanVersion);
      return context.json(result.body);
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
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseSignalStatusBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const profile = await deps.getActorProfile(actor);
    const decision = canManageControlSignals({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const { projectId, signalId } = routeIds.value;
    if (!deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.listControlSignals ||
        !transactionDataSource.upsertControlSignal ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const signal = (await transactionDataSource.listControlSignals(actor.tenantId, projectId)).find(
        (candidate) => candidate.id === signalId
      );
      if (!signal) return { ok: false as const, status: 404, error: "control_signal_not_found" };
      const updated = await transactionDataSource.upsertControlSignal({
        ...signal,
        status: parsed.value.status,
        updatedAt: new Date().toISOString()
      });
      const auditEventId = await appendControlAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType:
            parsed.value.status === "accepted_risk"
              ? "control_signal.risk_accepted"
              : "control_signal.status_changed",
          sourceWorkflow: "control",
          sourceEntity: { type: "ControlSignal", id: signalId },
          commandInput: parsed.value,
          beforeState: { signal },
          afterState: { signal: updated },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, signal: updated, auditEventId };
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      return context.json({ error: result.error }, 404);
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
    const decision = canManageCorrectiveActions({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const { projectId, signalId } = routeIds.value;
    const parsed = parseCorrectiveActionBody(body.value, actor.tenantId, projectId, signalId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    if (!deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.listControlSignals ||
        !transactionDataSource.createCorrectiveAction ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const signal = (await transactionDataSource.listControlSignals(actor.tenantId, projectId)).find(
        (candidate) => candidate.id === signalId
      );
      if (!signal) return { ok: false as const, status: 404, error: "control_signal_not_found" };
      const correctiveAction = await transactionDataSource.createCorrectiveAction(parsed.value);
      const auditEventId = await appendControlAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "corrective_action.created",
          sourceWorkflow: "control",
          sourceEntity: { type: "ControlSignal", id: signalId },
          commandInput: { correctiveAction },
          beforeState: { signal },
          afterState: { correctiveAction },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      const execution = await transactionDataSource.createActionExecution?.({
        id: `action-exec-${randomUUID()}`,
        tenantId: actor.tenantId,
        projectId,
        actionType: "create_corrective_action",
        targetEntity: { type: "ControlSignal", id: signalId },
        actorUserId: actor.id,
        input: { correctiveAction },
        previewPayload: null,
        resultPayload: { correctiveAction },
        status: "succeeded",
        auditEventId
      });
      return { ok: true as const, correctiveAction, actionExecution: execution ?? null, auditEventId };
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      return context.json({ error: result.error }, 404);
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
    const decision = canManageCorrectiveActions({ actor, profile, targetTenantId: actor.tenantId });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    if (!deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.listCorrectiveActions ||
        !transactionDataSource.updateCorrectiveAction ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const existing = (await transactionDataSource.listCorrectiveActions(actor.tenantId, projectId.value)).find(
        (candidate) => candidate.id === correctiveActionId.value
      );
      if (!existing) return { ok: false as const, status: 404, error: "corrective_action_not_found" };
      const parsed = parseCorrectiveActionPatchBody(body.value, existing);
      if (!parsed.ok) return { ok: false as const, status: 400, error: parsed.error };
      const correctiveAction = await transactionDataSource.updateCorrectiveAction(parsed.value);
      const auditEventId = await appendControlAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "corrective_action.updated",
          sourceWorkflow: "control",
          sourceEntity: { type: "CorrectiveAction", id: correctiveAction.id },
          commandInput: { correctiveAction },
          beforeState: { correctiveAction: existing },
          afterState: { correctiveAction },
          permissionResult: decision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return { ok: true as const, correctiveAction, auditEventId };
    });
    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      return context.json({ error: result.error }, 400);
    }
    return context.json({ correctiveAction: result.correctiveAction, auditEventId: result.auditEventId });
  });
}


type OperationalControlQueueQuery = {
  asOf: Date;
  limit: number;
};

type OperationalControlQueueSeverity = "critical" | "warning" | "info";
type OperationalControlQueuePriority = "critical" | "high" | "normal" | "low";
type OperationalControlQueueSignalKind =
  | "control_signal"
  | "corrective_action"
  | "task_overdue"
  | "task_status"
  | "project_overdue"
  | "audit_event";

type OperationalControlQueueItem = {
  id: string;
  tenantId: string;
  signalKind: OperationalControlQueueSignalKind;
  severity: OperationalControlQueueSeverity;
  priority: OperationalControlQueuePriority;
  project: {
    id: string;
    title: string;
    status: ProjectRecord["status"];
    plannedFinish: string;
  };
  entity: {
    type: string;
    id: string;
    label: string;
  };
  task?: {
    id: string;
    title: string;
    status: string;
    statusId: string;
    statusName: string;
    statusCategory: string;
    priority: string;
    plannedFinish: string;
    ownerUserId: string;
  };
  status: {
    value: string;
    category?: string;
  };
  dueDate: string | null;
  overdue: boolean;
  reason: string;
  allowedActions: string[];
  source: {
    workflow: string;
    entityType: string;
    entityId: string;
    metric?: string;
    auditEventId?: string;
  };
  sourceTimestamps: {
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    dueAt?: string | undefined;
  };
};

type OperationalControlQueueSortItem = OperationalControlQueueItem & {
  sort: {
    dueDate: string | null;
    timestamp: string;
  };
};

const defaultOperationalControlQueueLimit = 50;
const maxOperationalControlQueueLimit = 100;

function parseOperationalControlQueueQuery(input: {
  asOf: string | undefined;
  limit: string | undefined;
}): { ok: true; value: OperationalControlQueueQuery } | { ok: false; error: string } {
  const asOf = parseOperationalQueueAsOf(input.asOf);
  if (!asOf) return { ok: false, error: "invalid_operational_queue_as_of" };
  const limit = parseOperationalQueueLimit(input.limit);
  if (limit === null) return { ok: false, error: "invalid_operational_queue_limit" };
  return { ok: true, value: { asOf, limit } };
}

function parseOperationalQueueAsOf(value: string | undefined): Date | null {
  const normalized = value?.trim();
  if (!normalized) return new Date();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseOperationalQueueLimit(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return defaultOperationalControlQueueLimit;
  if (!/^(0|[1-9]\d*)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxOperationalControlQueueLimit) return null;
  return parsed;
}

async function buildOperationalControlQueue(input: {
  dataSource: ApiTenantDataSource;
  tenantId: string;
  asOf: Date;
  limit: number;
}): Promise<OperationalControlQueueItem[]> {
  const rawProjects = await input.dataSource.listProjects?.(input.tenantId) ?? [];
  const projects = rawProjects
    .filter((project) => project.tenantId === input.tenantId)
    .filter((project) => project.status === "active" || project.status === "paused");
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const allTasks: TaskRecord[] = [];
  const items: OperationalControlQueueSortItem[] = [];
  const signalById = new Map<string, ControlSignal>();
  const signalProjectById = new Map<string, string>();
  const correctiveActionProjectById = new Map<string, string>();

  for (const project of projects) {
    const [tasks, signals, correctiveActions] = await Promise.all([
      input.dataSource.listProjectTasks?.(input.tenantId, project.id) ?? Promise.resolve([]),
      input.dataSource.listControlSignals?.(input.tenantId, project.id) ?? Promise.resolve([]),
      input.dataSource.listCorrectiveActions?.(input.tenantId, project.id) ?? Promise.resolve([])
    ]);
    const tenantTasks = tasks.filter((task) => task.tenantId === input.tenantId && task.projectId === project.id);
    allTasks.push(...tenantTasks);
    const tenantSignals = signals.filter(
      (signal) => signal.tenantId === input.tenantId && signal.projectId === project.id
    );
    for (const signal of tenantSignals) {
      signalById.set(signal.id, signal);
      signalProjectById.set(signal.id, signal.projectId);
    }
    const tenantCorrectiveActions = correctiveActions.filter(
      (action) => action.tenantId === input.tenantId && action.projectId === project.id
    );
    for (const action of tenantCorrectiveActions) correctiveActionProjectById.set(action.id, action.projectId);

    items.push(...queueItemsForProject(project, input.asOf));
    items.push(...queueItemsForTasks(project, tenantTasks, input.asOf));
    items.push(...queueItemsForControlSignals(project, tenantSignals));
    items.push(...queueItemsForCorrectiveActions(
      project,
      tenantCorrectiveActions,
      signalById,
      input.asOf
    ));
  }

  const taskProjectById = new Map(allTasks.map((task) => [task.id, task.projectId]));
  const auditEvents = await input.dataSource.listAuditEventsByTenantId?.(input.tenantId, { limit: 100 }) ?? [];
  items.push(...queueItemsForAuditEvents(
    auditEvents,
    projectById,
    taskProjectById,
    signalProjectById,
    correctiveActionProjectById
  ));

  return sortOperationalControlQueue(items)
    .slice(0, input.limit)
    .map(({ sort: _sort, ...item }) => item);
}

function queueItemsForProject(
  project: ProjectRecord,
  asOf: Date
): OperationalControlQueueSortItem[] {
  if (!isDateBefore(project.plannedFinish, asOf)) return [];
  const dueDate = dateOnly(project.plannedFinish);
  return [
    withQueueSort({
      id: `project-overdue:${project.id}`,
      tenantId: project.tenantId,
      signalKind: "project_overdue",
      severity: "critical",
      priority: "critical",
      project: projectContext(project),
      entity: { type: "Project", id: project.id, label: project.title },
      status: { value: project.status },
      dueDate,
      overdue: true,
      reason: `Project planned finish is overdue: ${project.title}`,
      allowedActions: ["open_gantt", "generate_planning_solution"],
      source: { workflow: "project_lifecycle", entityType: "Project", entityId: project.id },
      sourceTimestamps: compactTimestamps({
        createdAt: isoDateTime(project.createdAt),
        updatedAt: isoDateTime(project.activatedAt ?? project.createdAt),
        dueAt: dueDate
      })
    })
  ];
}

function queueItemsForTasks(
  project: ProjectRecord,
  tasks: TaskRecord[],
  asOf: Date
): OperationalControlQueueSortItem[] {
  const items: OperationalControlQueueSortItem[] = [];
  for (const task of tasks) {
    if (task.archivedAt || task.statusCategory === "done") continue;
    if (isDateBefore(task.plannedFinish, asOf)) {
      const dueDate = dateOnly(task.plannedFinish);
      const severity = task.priority === "critical" || task.priority === "high" ? "critical" : "warning";
      items.push(withQueueSort({
        id: `task-overdue:${project.id}:${task.id}`,
        tenantId: task.tenantId,
        signalKind: "task_overdue",
        severity,
        priority: task.priority,
        project: projectContext(project),
        task: taskContext(task),
        entity: { type: "Task", id: task.id, label: task.title },
        status: { value: task.status, category: task.statusCategory },
        dueDate,
        overdue: true,
        reason: `Task is overdue: ${task.title}`,
        allowedActions: ["open_gantt"],
        source: { workflow: "project_work", entityType: "Task", entityId: task.id },
        sourceTimestamps: compactTimestamps({
          createdAt: isoDateTime(task.createdAt),
          updatedAt: isoDateTime(task.updatedAt),
          dueAt: dueDate
        })
      }));
    }
    if (task.statusCategory === "waiting") {
      items.push(withQueueSort({
        id: `task-status:${project.id}:${task.id}`,
        tenantId: task.tenantId,
        signalKind: "task_status",
        severity: "warning",
        priority: task.priority === "critical" ? "critical" : task.priority === "high" ? "high" : "normal",
        project: projectContext(project),
        task: taskContext(task),
        entity: { type: "Task", id: task.id, label: task.title },
        status: { value: task.status, category: task.statusCategory },
        dueDate: dateOnly(task.plannedFinish),
        overdue: isDateBefore(task.plannedFinish, asOf),
        reason: `Task is waiting: ${task.title}`,
        allowedActions: ["open_gantt"],
        source: { workflow: "project_work", entityType: "Task", entityId: task.id },
        sourceTimestamps: compactTimestamps({
          createdAt: isoDateTime(task.createdAt),
          updatedAt: isoDateTime(task.updatedAt),
          dueAt: dateOnly(task.plannedFinish)
        })
      }));
    }
  }
  return items;
}

function queueItemsForControlSignals(
  project: ProjectRecord,
  signals: ControlSignal[]
): OperationalControlQueueSortItem[] {
  return signals
    .filter((signal) => signal.status !== "resolved")
    .map((signal) => withQueueSort({
      id: `control-signal:${project.id}:${signal.id}`,
      tenantId: signal.tenantId,
      signalKind: "control_signal",
      severity: signal.severity,
      priority: priorityForSeverity(signal.severity),
      project: projectContext(project),
      entity: { type: "ControlSignal", id: signal.id, label: signal.explanation },
      status: { value: signal.status },
      dueDate: null,
      overdue: false,
      reason: signal.explanation,
      allowedActions: signal.allowedActions,
      source: {
        workflow: "control",
        entityType: "ControlSignal",
        entityId: signal.id,
        metric: signal.sourceMetric
      },
      sourceTimestamps: compactTimestamps({
        createdAt: signal.createdAt,
        updatedAt: signal.updatedAt
      })
    }));
}

function queueItemsForCorrectiveActions(
  project: ProjectRecord,
  correctiveActions: CorrectiveAction[],
  signalById: Map<string, ControlSignal>,
  asOf: Date
): OperationalControlQueueSortItem[] {
  return correctiveActions
    .filter((action) => action.status === "open" || action.status === "in_progress")
    .map((action) => {
      const signal = signalById.get(action.controlSignalId);
      const overdue = action.dueDate ? isDateStringBefore(action.dueDate, asOf) : false;
      const severity = signal?.severity ?? (overdue ? "critical" : "warning");
      return withQueueSort({
        id: `corrective-action:${project.id}:${action.id}`,
        tenantId: action.tenantId,
        signalKind: "corrective_action",
        severity,
        priority: priorityForSeverity(severity),
        project: projectContext(project),
        entity: { type: "CorrectiveAction", id: action.id, label: action.title },
        status: { value: action.status },
        dueDate: action.dueDate,
        overdue,
        reason: overdue
          ? `Corrective action is overdue: ${action.title}`
          : `Corrective action needs follow-up: ${action.title}`,
        allowedActions: ["create_corrective_action"],
        source: { workflow: "control", entityType: "CorrectiveAction", entityId: action.id },
        sourceTimestamps: compactTimestamps({ dueAt: action.dueDate ?? undefined })
      });
    });
}

function queueItemsForAuditEvents(
  auditEvents: AuditEventListItem[],
  projectById: Map<string, ProjectRecord>,
  taskProjectById: Map<string, string>,
  signalProjectById: Map<string, string>,
  correctiveActionProjectById: Map<string, string>
): OperationalControlQueueSortItem[] {
  return auditEvents.flatMap((event) => {
    if (event.tenantId && !projectById.size) return [];
    const status = stringStatus(event.executionResult?.status);
    const failed = status === "failed" || event.actionType.endsWith("_failed");
    const denied = status === "denied" || event.actionType.endsWith("_denied") || event.actionType.endsWith("_conflict");
    if (!failed && !denied) return [];
    const project = resolveAuditProject(
      event,
      projectById,
      taskProjectById,
      signalProjectById,
      correctiveActionProjectById
    );
    if (!project) return [];
    const severity: OperationalControlQueueSeverity = failed ? "critical" : "warning";
    return [withQueueSort({
      id: `audit-event:${project.id}:${event.id}`,
      tenantId: event.tenantId,
      signalKind: "audit_event",
      severity,
      priority: priorityForSeverity(severity),
      project: projectContext(project),
      entity: { type: "AuditEvent", id: event.id, label: event.actionType },
      status: { value: status ?? "unknown" },
      dueDate: null,
      overdue: false,
      reason: `Audit event requires attention: ${event.actionType}`,
      allowedActions: [],
      source: {
        workflow: event.sourceWorkflow ?? "audit",
        entityType: "AuditEvent",
        entityId: event.id,
        auditEventId: event.id
      },
      sourceTimestamps: compactTimestamps({ createdAt: isoDateTime(event.createdAt) })
    })];
  });
}

function resolveAuditProject(
  event: AuditEventListItem,
  projectById: Map<string, ProjectRecord>,
  taskProjectById: Map<string, string>,
  signalProjectById: Map<string, string>,
  correctiveActionProjectById: Map<string, string>
): ProjectRecord | undefined {
  const sourceEntity = event.sourceEntity;
  const type = typeof sourceEntity.type === "string" ? sourceEntity.type : undefined;
  const id = typeof sourceEntity.id === "string" ? sourceEntity.id : undefined;
  if (!type || !id) return undefined;
  if (type === "Project") return projectById.get(id);
  if (type === "Task") {
    const projectId = taskProjectById.get(id);
    return projectId ? projectById.get(projectId) : undefined;
  }
  if (type === "ControlSignal") {
    const projectId = signalProjectById.get(id);
    return projectId ? projectById.get(projectId) : undefined;
  }
  if (type === "CorrectiveAction") {
    const projectId = correctiveActionProjectById.get(id);
    return projectId ? projectById.get(projectId) : undefined;
  }
  return undefined;
}

function sortOperationalControlQueue(items: OperationalControlQueueSortItem[]) {
  return items.sort((left, right) =>
    severityRank(left.severity) - severityRank(right.severity) ||
    Number(right.overdue) - Number(left.overdue) ||
    compareNullableDate(left.sort.dueDate, right.sort.dueDate) ||
    priorityRank(left.priority) - priorityRank(right.priority) ||
    right.sort.timestamp.localeCompare(left.sort.timestamp) ||
    left.id.localeCompare(right.id)
  );
}

function withQueueSort(item: OperationalControlQueueItem): OperationalControlQueueSortItem {
  return {
    ...item,
    sort: {
      dueDate: item.dueDate,
      timestamp: item.sourceTimestamps.updatedAt ?? item.sourceTimestamps.createdAt ?? item.sourceTimestamps.dueAt ?? ""
    }
  };
}

function projectContext(project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    plannedFinish: dateOnly(project.plannedFinish)
  };
}

function taskContext(task: TaskRecord) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    statusId: task.statusId,
    statusName: task.statusName,
    statusCategory: task.statusCategory,
    priority: task.priority,
    plannedFinish: dateOnly(task.plannedFinish),
    ownerUserId: task.ownerUserId
  };
}

function priorityForSeverity(severity: OperationalControlQueueSeverity): OperationalControlQueuePriority {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "normal";
}

function severityRank(severity: OperationalControlQueueSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function priorityRank(priority: OperationalControlQueuePriority): number {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function compareNullableDate(left: string | null, right: string | null): number {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}

function isDateBefore(value: Date, asOf: Date): boolean {
  return dateOnly(value) < dateOnly(asOf);
}

function isDateStringBefore(value: string, asOf: Date): boolean {
  return value < dateOnly(asOf);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isoDateTime(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

function compactTimestamps(input: {
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  dueAt?: string | undefined;
}) {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function stringStatus(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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

async function findActiveControlProject(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  projectId: string
): Promise<ProjectRecord | undefined> {
  const projects = await dataSource.listProjects?.(tenantId);
  return projects?.find((project) => project.id === projectId && project.status === "active");
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

function parseKpiDefinitionBody(
  input: unknown,
  tenantId: string
): { ok: true; value: KpiDefinition } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "kpi_definition_invalid" };
  const id = stringField(input, "id") ?? `kpi-${randomUUID()}`;
  const code = stringField(input, "code");
  const label = stringField(input, "label");
  const unit = stringField(input, "unit") ?? "count";
  const period = stringField(input, "period") ?? "snapshot";
  const status = stringField(input, "status") ?? "active";
  const version = integerField(input, "version") ?? 1;
  if (
    !code ||
    !label ||
    !validateKpiFormula(input.formula) ||
    !Array.isArray(input.thresholdRules) ||
    !isValidThresholdRules(input.thresholdRules) ||
    !isValidKpiUnit(unit) ||
    !isValidKpiPeriod(period) ||
    !isValidKpiStatus(status) ||
    version <= 0 ||
    !isValidAllowedActions(input.allowedActions)
  ) {
    return { ok: false, error: "kpi_definition_invalid" };
  }
  return {
    ok: true,
    value: {
      id,
      tenantId,
      entityType: "project",
      code,
      label,
      formula: input.formula,
      unit,
      period,
      thresholdRules: input.thresholdRules as KpiDefinition["thresholdRules"],
      ownerRole: stringField(input, "ownerRole"),
      allowedActions: Array.isArray(input.allowedActions)
        ? (input.allowedActions as KpiDefinition["allowedActions"])
        : ["create_corrective_action"],
      version,
      status
    }
  };
}

function parseCorrectiveActionBody(
  input: unknown,
  tenantId: string,
  projectId: string,
  controlSignalId: string
): { ok: true; value: CorrectiveAction } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "corrective_action_invalid" };
  const title = stringField(input, "title");
  if (!title) return { ok: false, error: "corrective_action_invalid" };
  return {
    ok: true,
    value: {
      id: stringField(input, "id") ?? `corrective-action-${randomUUID()}`,
      tenantId,
      projectId,
      controlSignalId,
      title,
      description: stringField(input, "description"),
      responsibleUserId: stringField(input, "responsibleUserId"),
      dueDate: stringField(input, "dueDate"),
      status: "open",
      result: null
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function integerField(input: Record<string, unknown>, field: string): number | null {
  const value = input[field];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function nullableStringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  if (value === null) return null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseSignalStatusBody(
  input: unknown
): { ok: true; value: { status: ControlSignal["status"]; acceptedRiskReason?: string } } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "control_signal_status_invalid" };
  const status = stringField(input, "status");
  if (
    status !== "open" &&
    status !== "acknowledged" &&
    status !== "resolved" &&
    status !== "accepted_risk"
  ) {
    return { ok: false, error: "control_signal_status_invalid" };
  }
  const acceptedRiskReason = stringField(input, "acceptedRiskReason") ?? undefined;
  if (status === "accepted_risk" && !acceptedRiskReason) {
    return { ok: false, error: "accepted_risk_reason_required" };
  }
  return {
    ok: true,
    value: acceptedRiskReason ? { status, acceptedRiskReason } : { status }
  };
}

function parseCorrectiveActionPatchBody(
  input: unknown,
  existing: CorrectiveAction
): { ok: true; value: CorrectiveAction } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "corrective_action_invalid" };
  const status = stringField(input, "status") ?? existing.status;
  if (!isValidCorrectiveActionStatus(status)) return { ok: false, error: "corrective_action_invalid" };
  return {
    ok: true,
    value: {
      ...existing,
      title: stringField(input, "title") ?? existing.title,
      description: "description" in input ? nullableStringField(input, "description") : existing.description,
      responsibleUserId:
        "responsibleUserId" in input ? nullableStringField(input, "responsibleUserId") : existing.responsibleUserId,
      dueDate: "dueDate" in input ? nullableStringField(input, "dueDate") : existing.dueDate,
      status,
      result: "result" in input ? nullableStringField(input, "result") : existing.result
    }
  };
}

function isValidThresholdRules(value: unknown[]): value is KpiDefinition["thresholdRules"] {
  return value.every(
    (item) =>
      isObject(item) &&
      (item.severity === "warning" || item.severity === "critical") &&
      (item.operator === "gt" ||
        item.operator === "gte" ||
        item.operator === "lt" ||
        item.operator === "lte" ||
        item.operator === "eq") &&
      typeof item.value === "number" &&
      Number.isFinite(item.value)
  );
}

function isValidAllowedActions(value: unknown): value is KpiDefinition["allowedActions"] | undefined {
  if (value === undefined) return true;
  const actions = [
    "create_corrective_action",
    "generate_planning_solution",
    "apply_planning_delta",
    "accept_risk",
    "move_deadline",
    "open_gantt"
  ];
  return Array.isArray(value) && value.every((item) => typeof item === "string" && actions.includes(item));
}

function isValidKpiUnit(value: string): value is KpiDefinition["unit"] {
  return ["days", "minutes", "percent", "count"].includes(value);
}

function isValidKpiPeriod(value: string): value is KpiDefinition["period"] {
  return ["snapshot", "day", "week", "month"].includes(value);
}

function isValidKpiStatus(value: string): value is KpiDefinition["status"] {
  return ["active", "archived"].includes(value);
}

function isValidCorrectiveActionStatus(value: string): value is CorrectiveAction["status"] {
  return ["open", "in_progress", "done", "cancelled"].includes(value);
}

function parseActionApplyBody(
  input: unknown
): { ok: true; value: { clientPlanVersion: number } } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "management_action_input_invalid" };
  const clientPlanVersion = integerField(input, "clientPlanVersion");
  if (clientPlanVersion === null || clientPlanVersion < 1) {
    return { ok: false, error: "management_action_input_invalid" };
  }
  return { ok: true, value: { clientPlanVersion } };
}

function decisionForActionPermissions(
  action: ManagementActionCandidate,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  for (const permission of action.requiredPermissions) {
    const decision = decisionForPermission(permission, actor, profile);
    if (!decision.allowed) return decision;
  }
  for (const command of action.planDelta?.commands ?? []) {
    const decision = permissionForCommand(command, actor, profile);
    if (!decision.allowed) return decision;
  }
  return {
    allowed: true,
    reason: "same_tenant_permission_granted"
  };
}

function decisionForPermission(
  permission: string,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (permission === "tenant.project_plan.manage") return canManageProjectPlan(input);
  if (permission === "tenant.project_resources.manage") return canManageProjectResources(input);
  if (permission === "tenant.planning_scenarios.apply") return canApplyPlanningScenarios(input);
  return {
    allowed: false,
    reason: "permission_missing"
  };
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
