import {
  canApplyPlanningScenarios,
  canPreviewPlanningScenarios
} from "@kiss-pm/access-control";
import { isBlockingValidationIssue, proposePlanningScenarios } from "@kiss-pm/domain";
import type { Handler, Hono } from "hono";
import { randomUUID } from "node:crypto";

import { readLimitedJsonBody } from "../jsonBody";
import { persistPlanningNotifications } from "../collaborationNotificationService";
import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { notifyPlanVersionChanged } from "../planningEventBus";
import { registerPlanningEventsRoute } from "../planningEventsRoute";
import { registerPlanningAutoSolverRoutes } from "./planningAutoSolverRoutes";
import { registerPlanningSavedViewRoutes } from "./planningSavedViewRoutes";
import {
  parsePlanningCommandEnvelope,
  parsePlanningCommandBatchEnvelope,
  parseScenarioApplyEnvelope,
  parseScenarioPreviewEnvelope
} from "../planningParsers";
import { previewPlanningCommand, previewPlanningCommands } from "./planningCommandCore";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { createPlanningReadModel } from "./planningReadModel";
import { canReadPlanningReadModel, permissionForCommand } from "./planningRouteAuth";
import {
  appendPlanningAuditIfConfigured,
  auditActionForCommand,
  errorResponseBody,
  hashJson,
  parseProjectRouteParam,
  parseScenarioProposalRouteParam,
  requireActivePlanningProject,
  requireReadablePlanningProject,
  serializeScenarioProposal,
  summarizeSnapshot,
  validateCommandDataSourcePreconditions,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import {
  parseScenarioProposal,
  scenarioRequiresAcceptedRiskReason,
  validateScenarioRunIntegrity,
  withAcceptedRiskReason
} from "./planningScenarioIntegrity";

export type { PlanningRouteDeps };

function emitPlanVersionFromBody(
  tenantId: string,
  projectId: string,
  body: { newPlanVersion?: number }
) {
  if (typeof body.newPlanVersion === "number") {
    invalidateCapacityCacheForTenant(tenantId);
    notifyPlanVersionChanged(projectId, body.newPlanVersion);
  }
}

export function registerPlanningRoutes(app: Hono, deps: PlanningRouteDeps) {
  registerPlanningEventsRoute(app, {
    dataSource: deps.dataSource,
    getSessionActorFromHeaders: deps.getSessionActorFromHeaders,
    getActorProfile: deps.getActorProfile
  });
  registerPlanningAutoSolverRoutes(app, deps);
  registerPlanningSavedViewRoutes(app, deps);

  app.get("/api/workspace/projects/:projectId/planning/read-model", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const decision = canReadPlanningReadModel({ actor, profile });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const readableProject = await requireReadablePlanningProject(
      deps.dataSource,
      actor.tenantId,
      parsedProjectId.value
    );
    if (!readableProject.ok) return context.json({ error: readableProject.error }, readableProject.status);
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, parsedProjectId.value);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);

    return context.json(createPlanningReadModel(snapshot));
  });

  app.post("/api/workspace/projects/:projectId/planning/preview-command", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePlanningCommandEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      return context.json({
        error: readDecision.reason,
        permissionPreview: readDecision
      }, 403);
    }

    const permissionPreview = permissionForCommand(parsed.value.command, actor, profile);
    if (!permissionPreview.allowed) {
      return context.json({
        error: permissionPreview.reason,
        permissionPreview
      }, 403);
    }

    const activeProject = await requireActivePlanningProject(
      deps.dataSource,
      actor.tenantId,
      parsedProjectId.value
    );
    if (!activeProject.ok) return context.json({ error: activeProject.error }, activeProject.status);
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, parsedProjectId.value);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
      return context.json({ error: "plan_version_conflict", currentPlanVersion: snapshot.planVersion }, 409);
    }

    const preview = previewPlanningCommand(snapshot, parsed.value.command);
    const validationIssues = [
      ...preview.validationIssues,
      ...(await validateCommandDataSourcePreconditions(
        deps.dataSource,
        actor.tenantId,
        parsed.value.command
      ))
    ];
    const hasBlockingValidationIssue = validationIssues.some(isBlockingValidationIssue);
    return context.json({
      before: createPlanningReadModel(snapshot),
      after: createPlanningReadModel(preview.nextSnapshot),
      planDelta: preview.planDelta,
      validationIssues,
      permissionPreview,
      auditPreview: {
        actionType: auditActionForCommand(parsed.value.command),
        sourceWorkflow: "planning",
        planVersionBefore: snapshot.planVersion,
        planVersionAfter: hasBlockingValidationIssue ? snapshot.planVersion : snapshot.planVersion + 1
      }
    });
  });

  app.post("/api/workspace/projects/:projectId/planning/apply-command", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePlanningCommandEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = permissionForCommand(parsed.value.command, actor, profile);
    if (!decision.allowed) {
      await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.command_denied",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: parsedProjectId.value },
        commandInput: { command: parsed.value.command },
        beforeState: null,
        afterState: null,
        permissionResult: decision,
        executionResult: { status: "denied" }
      });
      return context.json({ error: decision.reason }, 403);
    }
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.command_denied",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: parsedProjectId.value },
        commandInput: { command: parsed.value.command },
        beforeState: null,
        afterState: null,
        permissionResult: readDecision,
        executionResult: { status: "denied" }
      });
      return context.json({ error: readDecision.reason }, 403);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.getPlanSnapshot ||
        !transactionDataSource.applyPlanningCommand ||
        !transactionDataSource.incrementPlanVersion ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      if (
        parsed.value.idempotencyKey &&
        (!transactionDataSource.findPlanningCommandIdempotency ||
          !transactionDataSource.createPlanningCommandIdempotency)
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }

      const projectId = parsedProjectId.value;
      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
      const idempotencyKey = parsed.value.idempotencyKey;
      const requestHash = idempotencyKey
        ? hashJson({
            actorUserId: actor.id,
            clientPlanVersion: parsed.value.clientPlanVersion,
            command: parsed.value.command
          })
        : null;
      if (idempotencyKey && requestHash) {
        const existingIdempotency = await transactionDataSource.findPlanningCommandIdempotency?.(
          actor.tenantId,
          projectId,
          idempotencyKey
        );
        if (existingIdempotency) {
          if (
            existingIdempotency.actorUserId !== actor.id ||
            existingIdempotency.requestHash !== requestHash
          ) {
            return { ok: false as const, status: 409, error: "idempotency_key_conflict" };
          }
          return { ok: true as const, body: existingIdempotency.responsePayload };
        }
      }
      const activeProject = await requireActivePlanningProject(
        transactionDataSource,
        actor.tenantId,
        projectId
      );
      if (!activeProject.ok) return activeProject;
      const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
        await appendPlanningAuditIfConfigured(deps, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.command_conflict",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: { command: parsed.value.command, clientPlanVersion: parsed.value.clientPlanVersion },
          beforeState: { planVersion: snapshot.planVersion },
          afterState: null,
          permissionResult: decision,
          executionResult: { status: "conflict" }
        }, transactionDataSource);
        return {
          ok: false as const,
          status: 409,
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        };
      }

      const preview = previewPlanningCommand(snapshot, parsed.value.command);
      const validationIssues = [
        ...preview.validationIssues,
        ...(await validateCommandDataSourcePreconditions(
          transactionDataSource,
          actor.tenantId,
          parsed.value.command
        ))
      ];
      if (validationIssues.some(isBlockingValidationIssue)) {
        return {
          ok: false as const,
          status: 409,
          error: "planning_precondition_failed",
          validationIssues
        };
      }

      await transactionDataSource.applyPlanningCommand({
        tenantId: actor.tenantId,
        projectId,
        actorUserId: actor.id,
        command: parsed.value.command
      });
      const newPlanVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, projectId);
      const auditEventId = await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: auditActionForCommand(parsed.value.command),
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: projectId },
        commandInput: { command: parsed.value.command, idempotencyKey: parsed.value.idempotencyKey ?? null },
        beforeState: summarizeSnapshot(snapshot),
        afterState: {
          planVersion: newPlanVersion,
          changedTaskIds: preview.planDelta.changedTaskIds,
          changedAssignmentIds: preview.planDelta.changedAssignmentIds,
          changedDependencyIds: preview.planDelta.changedDependencyIds
        },
        permissionResult: decision,
        executionResult: { status: "succeeded", validationIssues }
      }, transactionDataSource);
      const appliedSnapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!appliedSnapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      await persistPlanningNotifications({
        dataSource: transactionDataSource,
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        beforeSnapshot: snapshot,
        afterSnapshot: appliedSnapshot,
        commands: [parsed.value.command]
      });
      const responseBody = {
        applied: preview.planDelta,
        newPlanVersion,
        auditEventId,
        readModel: createPlanningReadModel(appliedSnapshot)
      };
      if (idempotencyKey && requestHash) {
        await transactionDataSource.createPlanningCommandIdempotency?.({
          tenantId: actor.tenantId,
          projectId,
          idempotencyKey,
          requestHash,
          responsePayload: responseBody,
          actorUserId: actor.id
        });
      }
      return {
        ok: true as const,
        body: responseBody
      };
    });

    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      if (result.status === 409) return context.json(errorResponseBody(result), 409);
      return context.json({ error: result.error }, 400);
    }

    emitPlanVersionFromBody(
      actor.tenantId,
      parsedProjectId.value,
      result.body as { newPlanVersion?: number }
    );
    return context.json(result.body);
  });

  app.post("/api/workspace/projects/:projectId/planning/apply-command-batch", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePlanningCommandBatchEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const projectId = parsedProjectId.value;
    for (const command of parsed.value.commands) {
      const decision = permissionForCommand(command, actor, profile);
      if (!decision.allowed) {
        await appendPlanningAuditIfConfigured(deps, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.command_denied",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: { commands: parsed.value.commands, command },
          beforeState: null,
          afterState: null,
          permissionResult: decision,
          executionResult: { status: "denied" }
        });
        return context.json({ error: decision.reason }, 403);
      }
    }
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      return context.json({ error: readDecision.reason }, 403);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.getPlanSnapshot ||
        !transactionDataSource.applyPlanningCommand ||
        !transactionDataSource.incrementPlanVersion ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      if (
        parsed.value.idempotencyKey &&
        (!transactionDataSource.findPlanningCommandIdempotency ||
          !transactionDataSource.createPlanningCommandIdempotency)
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }

      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
      const idempotencyKey = parsed.value.idempotencyKey;
      const requestHash = idempotencyKey
        ? hashJson({
            actorUserId: actor.id,
            clientPlanVersion: parsed.value.clientPlanVersion,
            commands: parsed.value.commands
          })
        : null;
      if (idempotencyKey && requestHash) {
        const existingIdempotency = await transactionDataSource.findPlanningCommandIdempotency?.(
          actor.tenantId,
          projectId,
          idempotencyKey
        );
        if (existingIdempotency) {
          if (
            existingIdempotency.actorUserId !== actor.id ||
            existingIdempotency.requestHash !== requestHash
          ) {
            return { ok: false as const, status: 409, error: "idempotency_key_conflict" };
          }
          return { ok: true as const, body: existingIdempotency.responsePayload };
        }
      }

      const activeProject = await requireActivePlanningProject(
        transactionDataSource,
        actor.tenantId,
        projectId
      );
      if (!activeProject.ok) return activeProject;
      const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
        return {
          ok: false as const,
          status: 409,
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        };
      }

      const batchPreview = await previewPlanningCommands(
        snapshot,
        parsed.value.commands,
        transactionDataSource,
        actor.tenantId
      );
      if (batchPreview.validationIssues.some(isBlockingValidationIssue)) {
        return {
          ok: false as const,
          status: 409,
          error: "planning_precondition_failed",
          validationIssues: batchPreview.validationIssues
        };
      }

      for (const command of parsed.value.commands) {
        await transactionDataSource.applyPlanningCommand({
          tenantId: actor.tenantId,
          projectId,
          actorUserId: actor.id,
          command
        });
      }
      const newPlanVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, projectId);
      const auditEventId = await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.command_batch.applied",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: projectId },
        commandInput: {
          commands: parsed.value.commands,
          idempotencyKey: parsed.value.idempotencyKey ?? null
        },
        beforeState: summarizeSnapshot(snapshot),
        afterState: {
          planVersion: newPlanVersion,
          changedTaskIds: batchPreview.planDelta.changedTaskIds,
          changedAssignmentIds: batchPreview.planDelta.changedAssignmentIds,
          changedDependencyIds: batchPreview.planDelta.changedDependencyIds
        },
        permissionResult: { allowed: true, reason: "same_tenant_permission_granted" },
        executionResult: { status: "succeeded", validationIssues: batchPreview.validationIssues }
      }, transactionDataSource);
      const appliedSnapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!appliedSnapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      await persistPlanningNotifications({
        dataSource: transactionDataSource,
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        beforeSnapshot: snapshot,
        afterSnapshot: appliedSnapshot,
        commands: parsed.value.commands
      });
      const responseBody = {
        applied: batchPreview.planDelta,
        newPlanVersion,
        auditEventId,
        readModel: createPlanningReadModel(appliedSnapshot)
      };
      if (idempotencyKey && requestHash) {
        await transactionDataSource.createPlanningCommandIdempotency?.({
          tenantId: actor.tenantId,
          projectId,
          idempotencyKey,
          requestHash,
          responsePayload: responseBody,
          actorUserId: actor.id
        });
      }
      return { ok: true as const, body: responseBody };
    });

    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      if (result.status === 409) return context.json(errorResponseBody(result), 409);
      return context.json({ error: result.error }, 400);
    }

    emitPlanVersionFromBody(actor.tenantId, projectId, result.body as { newPlanVersion?: number });
    return context.json(result.body);
  });

  if (process.env.KISS_PM_E2E_TEST_HOOKS === "1") {
    app.post("/api/workspace/projects/:projectId/planning/test/bump-plan-version", async (context) => {
      const parsedProjectId = parseProjectRouteParam(context);
      if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (!deps.dataSource.incrementPlanVersion) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }
      const profile = await deps.getActorProfile(actor);
      const readDecision = canReadPlanningReadModel({ actor, profile });
      if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);
      const activeProject = await requireActivePlanningProject(
        deps.dataSource,
        actor.tenantId,
        parsedProjectId.value
      );
      if (!activeProject.ok) return context.json({ error: activeProject.error }, activeProject.status);
      const projectId = parsedProjectId.value;
      const newPlanVersion = await deps.dataSource.incrementPlanVersion(actor.tenantId, projectId);
      notifyPlanVersionChanged(projectId, newPlanVersion);
      return context.json({ newPlanVersion });
    });
  }

  app.get("/api/workspace/projects/:projectId/planning/baselines", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);
    const readableProject = await requireReadablePlanningProject(
      deps.dataSource,
      actor.tenantId,
      parsedProjectId.value
    );
    if (!readableProject.ok) return context.json({ error: readableProject.error }, readableProject.status);
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, parsedProjectId.value);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    return context.json({
      baselines: snapshot.baselines.map((baseline) => ({
        id: baseline.id,
        capturedAt: baseline.capturedAt,
        taskCount: baseline.tasks.length
      }))
    });
  });

  const previewScenarioProposals: Handler = async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getPlanSnapshot ||
      !deps.dataSource.createPlanningScenarioRun ||
      !deps.dataSource.appendAuditEvent ||
      !deps.dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseScenarioPreviewEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = canPreviewPlanningScenarios({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      return context.json({
        error: readDecision.reason,
        permissionPreview: readDecision
      }, 403);
    }

    const projectId = parsedProjectId.value;
    const activeProject = await requireActivePlanningProject(
      deps.dataSource,
      actor.tenantId,
      projectId
    );
    if (!activeProject.ok) return context.json({ error: activeProject.error }, activeProject.status);
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, projectId);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
      return context.json({ error: "plan_version_conflict", currentPlanVersion: snapshot.planVersion }, 409);
    }

    const readModel = createPlanningReadModel(snapshot);
    const proposals = proposePlanningScenarios({
      snapshot,
      calculatedPlan: readModel.calculatedPlan,
      resourceLoad: readModel.resourceLoad,
      target: parsed.value.target
    });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const persistedProposals = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createPlanningScenarioRun || !transactionDataSource.appendAuditEvent) {
        throw new Error("persistence_not_configured");
      }
      const transactionProposals = [];
      for (const proposal of proposals) {
        const runId = `planning-scenario-${randomUUID()}`;
        const persistedProposal = { ...proposal, id: runId };
        const proposalPayload = serializeScenarioProposal(persistedProposal);
        await transactionDataSource.createPlanningScenarioRun({
          id: runId,
          tenantId: actor.tenantId,
          projectId,
          planVersion: snapshot.planVersion,
          engineVersion: PLANNING_ENGINE_VERSION,
          targetConflict: parsed.value.target,
          proposalPayload,
          proposalPayloadHash: hashJson(proposalPayload),
          actorUserId: actor.id,
          expiresAt
        });
        transactionProposals.push(persistedProposal);
      }
      await appendPlanningAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.scenario.previewed",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: { target: parsed.value.target },
          beforeState: { planVersion: snapshot.planVersion },
          afterState: {
            proposalIds: transactionProposals.map((proposal) => proposal.id),
            proposalCount: transactionProposals.length,
            expiresAt: expiresAt.toISOString()
          },
          permissionResult: decision
        },
        transactionDataSource
      );
      return transactionProposals;
    });

    return context.json({
      proposals: persistedProposals,
      planVersion: snapshot.planVersion,
      engineVersion: PLANNING_ENGINE_VERSION,
      expiresAt: expiresAt.toISOString()
    });
  };

  app.post("/api/workspace/projects/:projectId/planning/scenarios/preview", previewScenarioProposals);
  app.post("/api/workspace/projects/:projectId/planning/scenario-proposals", previewScenarioProposals);

  const applyScenarioProposal: Handler = async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
    const parsedScenarioRunId = parseScenarioProposalRouteParam(context);
    if (!parsedScenarioRunId.ok) return context.json({ error: parsedScenarioRunId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseScenarioApplyEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const decision = canApplyPlanningScenarios({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.scenario_denied",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: parsedProjectId.value },
        commandInput: {
          scenarioRunId: parsedScenarioRunId.value,
          clientPlanVersion: parsed.value.clientPlanVersion
        },
        beforeState: null,
        afterState: null,
        permissionResult: decision,
        executionResult: { status: "denied" }
      });
      return context.json({ error: decision.reason }, 403);
    }
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.scenario_denied",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: parsedProjectId.value },
        commandInput: {
          scenarioRunId: parsedScenarioRunId.value,
          clientPlanVersion: parsed.value.clientPlanVersion
        },
        beforeState: null,
        afterState: null,
        permissionResult: readDecision,
        executionResult: { status: "denied" }
      });
      return context.json({ error: readDecision.reason }, 403);
    }

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.getPlanSnapshot ||
        !transactionDataSource.findPlanningScenarioRun ||
        !transactionDataSource.applyPlanningCommand ||
        !transactionDataSource.incrementPlanVersion ||
        !transactionDataSource.markPlanningScenarioRunApplied ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }

      const projectId = parsedProjectId.value;
      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
      const activeProject = await requireActivePlanningProject(
        transactionDataSource,
        actor.tenantId,
        projectId
      );
      if (!activeProject.ok) return activeProject;
      const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
        return {
          ok: false as const,
          status: 409,
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        };
      }

      const scenarioRun = await transactionDataSource.findPlanningScenarioRun(
        actor.tenantId,
        projectId,
        parsedScenarioRunId.value
      );
      if (!scenarioRun) return { ok: false as const, status: 404, error: "scenario_not_found" };
      if (scenarioRun.appliedAt) return { ok: false as const, status: 409, error: "planning_scenario_already_applied" };
      if (scenarioRun.expiresAt.getTime() <= Date.now()) {
        return { ok: false as const, status: 409, error: "scenario_expired" };
      }
      if (scenarioRun.planVersion !== snapshot.planVersion) {
        return {
          ok: false as const,
          status: 409,
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        };
      }
      if (hashJson(scenarioRun.proposalPayload) !== scenarioRun.proposalPayloadHash) {
        return { ok: false as const, status: 409, error: "planning_scenario_hash_mismatch" };
      }

      const proposal = parseScenarioProposal(scenarioRun.proposalPayload);
      if (!proposal) return { ok: false as const, status: 409, error: "planning_scenario_invalid" };
      const integrityError = validateScenarioRunIntegrity(scenarioRun, snapshot);
      if (integrityError) {
        return { ok: false as const, status: 409, error: integrityError };
      }
      if (scenarioRequiresAcceptedRiskReason(proposal) && !parsed.value.acceptedRiskReason) {
        return {
          ok: false as const,
          status: 400,
          error: "accepted_risk_reason_required"
        };
      }
      const commandsToApply = withAcceptedRiskReason(
        proposal.planDelta.commands,
        parsed.value.acceptedRiskReason
      );
      let preview = {
        nextSnapshot: snapshot,
        validationIssues: [] as ReturnType<typeof previewPlanningCommand>["validationIssues"]
      };
      for (const command of commandsToApply) {
        const next = previewPlanningCommand(preview.nextSnapshot, command);
        preview = {
          nextSnapshot: next.nextSnapshot,
          validationIssues: [
            ...preview.validationIssues,
            ...next.validationIssues,
            ...(await validateCommandDataSourcePreconditions(
              transactionDataSource,
              actor.tenantId,
              command
            ))
          ]
        };
      }
      if (preview.validationIssues.some(isBlockingValidationIssue)) {
        return {
          ok: false as const,
          status: 409,
          error: "planning_precondition_failed",
          validationIssues: preview.validationIssues
        };
      }

      for (const command of commandsToApply) {
        await transactionDataSource.applyPlanningCommand({
          tenantId: actor.tenantId,
          projectId,
          actorUserId: actor.id,
          command
        });
      }
      const newPlanVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, projectId);
      await transactionDataSource.markPlanningScenarioRunApplied({
        tenantId: actor.tenantId,
        projectId,
        scenarioRunId: scenarioRun.id,
        appliedAt: new Date()
      });
      const auditEventId = await appendPlanningAuditIfConfigured(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.scenario.applied",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: projectId },
        commandInput: {
          scenarioRunId: scenarioRun.id,
          acceptedRiskReason: parsed.value.acceptedRiskReason,
          commands: commandsToApply
        },
        beforeState: { planVersion: snapshot.planVersion },
        afterState: {
          planVersion: newPlanVersion,
          changedTaskIds: proposal.planDelta.changedTaskIds,
          changedAssignmentIds: proposal.planDelta.changedAssignmentIds,
          acceptedRiskIds: proposal.planDelta.acceptedRiskIds
        },
        permissionResult: decision,
        executionResult: { status: "succeeded", validationIssues: preview.validationIssues }
      }, transactionDataSource);
      const appliedSnapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!appliedSnapshot) return { ok: false as const, status: 404, error: "project_not_found" };
      await persistPlanningNotifications({
        dataSource: transactionDataSource,
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        beforeSnapshot: snapshot,
        afterSnapshot: appliedSnapshot,
        commands: commandsToApply
      });
      return {
        ok: true as const,
        body: {
          scenarioRunId: scenarioRun.id,
          newPlanVersion,
          auditEventId,
          readModel: createPlanningReadModel(appliedSnapshot)
        }
      };
    });

    if (!result.ok) {
      if (result.status === 501) return context.json({ error: result.error }, 501);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      if (result.status === 409) return context.json(errorResponseBody(result), 409);
      if (result.status === 400) return context.json({ error: result.error }, 400);
      return context.json({ error: result.error }, 400);
    }

    emitPlanVersionFromBody(
      actor.tenantId,
      parsedProjectId.value,
      result.body as { newPlanVersion?: number }
    );
    return context.json(result.body);
  };

  app.post("/api/workspace/projects/:projectId/planning/scenarios/:scenarioId/apply", applyScenarioProposal);
  app.post("/api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply", applyScenarioProposal);

}
