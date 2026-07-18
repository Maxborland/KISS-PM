import type { Handler, Hono } from "hono";
import { randomUUID } from "node:crypto";

import {
  canApplyPlanningScenarios,
  canPreviewPlanningScenarios
} from "@kiss-pm/access-control";
import { buildCompensatingCommandBatch, isBlockingValidationIssue, proposePlanningScenarios } from "@kiss-pm/domain";

import { readLimitedJsonBody } from "../jsonBody";
import { persistPlanningNotifications } from "../collaborationNotificationService";
import { parseScenarioApplyEnvelope, parseScenarioPreviewEnvelope } from "../planningParsers";
import { requireCapabilities } from "../dataSourceCapabilities";
import { previewPlanningCommand, previewPlanningCommands } from "./planningCommandCore";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { createPlanningReadModel } from "./planningReadModel";
import { canReadPlanningReadModel, includeResourceExceptionsFor } from "./planningRouteAuth";
import { denyPlanningAction, emitPlanVersionFromBody } from "./planningRouteResponders";
import {
  appendPlanningAuditIfConfigured,
  errorResponseBody,
  hashJson,
  parseProjectRouteParam,
  parseScenarioProposalRouteParam,
  serializeScenarioProposal,
  validateCommandDataSourcePreconditions,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import {
  parseScenarioProposal,
  scenarioIsAvailable,
  scenarioRequiresAcceptedRiskReason,
  validateScenarioRunIntegrity,
  withAcceptedRiskReason
} from "./planningScenarioIntegrity";

/**
 * Preview/apply планировочных сценариев (вынесено из registerPlanningRoutes по бюджету
 * здоровья роутов): preview стейджит persisted scenario runs с TTL, apply — governed
 * применение выбранного предложения с version-lock, аудитом и компенсациями для отката.
 */
export function registerPlanningScenarioRoutes(app: Hono, deps: PlanningRouteDeps) {
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
  const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, projectId);
  if (!snapshot) return context.json({ error: "project_not_found" }, 404);
  if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
    return context.json({ error: "plan_version_conflict", currentPlanVersion: snapshot.planVersion }, 409);
  }

  const readModel = createPlanningReadModel(snapshot, { includeResourceExceptions: includeResourceExceptionsFor({ actor, profile }) });
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
  const scenarioDenyInput = {
    scenarioRunId: parsedScenarioRunId.value,
    clientPlanVersion: parsed.value.clientPlanVersion
  };
  if (!decision.allowed) {
    return await denyPlanningAction(deps, context, {
      actor,
      projectId: parsedProjectId.value,
      actionType: "planning.scenario_denied",
      decision,
      commandInput: scenarioDenyInput
    });
  }
  const readDecision = canReadPlanningReadModel({ actor, profile });
  if (!readDecision.allowed) {
    return await denyPlanningAction(deps, context, {
      actor,
      projectId: parsedProjectId.value,
      actionType: "planning.scenario_denied",
      decision: readDecision,
      commandInput: scenarioDenyInput
    });
  }

  const result = await deps.runDataSourceTransaction(async (rawStore) => {
    const transactionDataSource = requireCapabilities(rawStore, [
      "getPlanSnapshot",
      "findPlanningScenarioRun",
      "applyPlanningCommand",
      "incrementPlanVersion",
      "markPlanningScenarioRunApplied",
      "appendAuditEvent",
      "lockTenantResourcePlanning",
    ]);
    if (!transactionDataSource) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }

    const projectId = parsedProjectId.value;
    await transactionDataSource.lockTenantResourcePlanning(actor.tenantId);
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
    if (!scenarioIsAvailable(proposal)) {
      return {
        ok: false as const,
        status: 409,
        error: "scenario_unavailable",
        unavailableReason: proposal.unavailableReason
      };
    }
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
        acceptedRiskIds: proposal.planDelta.acceptedRiskIds,
        // Сценарный коммит откатим там, где его команды инвертируемы (reassignment):
        // тот же контракт компенсаций, что у apply-command-batch. Для необратимых
        // (принятие риска и т.п.) batch честно пуст — revert-last откажет.
        compensatingCommands: buildCompensatingCommandBatch(commandsToApply, snapshot)
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
        readModel: createPlanningReadModel(appliedSnapshot, { includeResourceExceptions: includeResourceExceptionsFor({ actor, profile }) })
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
