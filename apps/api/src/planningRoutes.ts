import {
  canManageProjectBaselines,
  canManageProjectPlan,
  canManageProjectResources,
  canApplyPlanningScenarios,
  canPreviewPlanningScenarios,
  canReadProjectPlan,
  canReadProjectResources,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  buildResourceLoadMatrix,
  calculatePlan,
  diffCalendarDays,
  isBlockingValidationIssue,
  proposeAutoPlanningSolutions,
  proposePlanningScenarios,
  reducePlanningCommand,
  type PlanningCommand,
  type PlanSnapshot,
  type ScenarioTarget,
  type ValidationIssue
} from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import type { PlanningScenarioRunRecord, PlanningSolverRunRecord } from "@kiss-pm/persistence";
import type { Handler, Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import { applyGovernedPlanningDelta } from "./governedPlanningApply";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseAutoSolverApplyEnvelope,
  parseAutoSolverRunEnvelope,
  parsePlanningCommandEnvelope,
  parseScenarioApplyEnvelope,
  parseScenarioPreviewEnvelope
} from "./planningParsers";
import {
  hashJson,
  parseAutoSolverProposal,
  parseScenarioProposal,
  proposalRequiresAcceptedRiskReason,
  proposalRequiresResourceManage,
  withAcceptedRiskReason
} from "./planningProposalCodec";

const planningEngineVersion = "planning-core-v1";

type PlanningRouteDeps = {
  dataSource: PlanningRouteDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: PlanningMutationDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type PlanningRouteDataSource = Pick<
  ApiTenantDataSource,
  | "appendAuditEvent"
  | "createPlanningScenarioRun"
  | "createPlanningSolverRun"
  | "findPlanningSolverRun"
  | "getPlanSnapshot"
  | "listTaskStatuses"
  | "listWorkspaceUsers"
>;

type PlanningMutationDataSource = PlanningRouteDataSource &
  Pick<
    ApiTenantDataSource,
    | "applyPlanningCommand"
    | "createPlanningCommandIdempotency"
    | "findPlanningCommandIdempotency"
    | "findPlanningScenarioRun"
    | "findPlanningSolverRun"
    | "incrementPlanVersion"
    | "lockTenantResourcePlanning"
    | "markPlanningScenarioRunApplied"
    | "markPlanningSolverRunApplied"
  >;

export function registerPlanningRoutes(app: Hono, deps: PlanningRouteDeps) {
  app.get("/api/workspace/projects/:projectId/planning/read-model", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const decision = canReadPlanningReadModel({ actor, profile });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, context.req.param("projectId"));
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);

    return context.json(createPlanningReadModel(snapshot));
  });

  app.post("/api/workspace/projects/:projectId/planning/preview-command", async (context) => {
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

    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, context.req.param("projectId"));
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
        sourceEntity: { type: "Project", id: context.req.param("projectId") },
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
        sourceEntity: { type: "Project", id: context.req.param("projectId") },
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

      const projectId = context.req.param("projectId");
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

      const planningApplyDataSource = {
        applyPlanningCommand: (input: Parameters<NonNullable<typeof transactionDataSource.applyPlanningCommand>>[0]) =>
          transactionDataSource.applyPlanningCommand!(input),
        getPlanSnapshot: (tenantId: string, projectId: string) =>
          transactionDataSource.getPlanSnapshot!(tenantId, projectId),
        incrementPlanVersion: (tenantId: string, projectId: string) =>
          transactionDataSource.incrementPlanVersion!(tenantId, projectId)
      };
      const applied = await applyGovernedPlanningDelta({
        dataSource: planningApplyDataSource,
        tenantId: actor.tenantId,
        projectId,
        actorUserId: actor.id,
        snapshot,
        commands: [parsed.value.command],
        permissionResult: decision,
        previewCommand: previewPlanningCommand,
        validateCommandPreconditions: (command) =>
          validateCommandDataSourcePreconditions(transactionDataSource, actor.tenantId, command),
        appendAuditEvent: deps.appendManagementAuditEvent,
        auditDataSource: transactionDataSource,
        createReadModel: createPlanningReadModel,
        buildAuditInput: ({ newPlanVersion, validationIssues, preview }) => ({
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
        })
      });
      if (!applied.ok) return applied;
      const responseBody = {
        applied: applied.body.preview.planDelta,
        newPlanVersion: applied.body.newPlanVersion,
        auditEventId: applied.body.auditEventId,
        readModel: applied.body.readModel
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

    return context.json(result.body);
  });

  const previewScenarioProposals: Handler = async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getPlanSnapshot ||
      !deps.dataSource.createPlanningScenarioRun ||
      !deps.dataSource.appendAuditEvent
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

    const projectId = getRequiredRouteParam(context, "projectId");
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
    const persistedProposals = [];
    for (const proposal of proposals) {
      const runId = `planning-scenario-${randomUUID()}`;
      const persistedProposal = { ...proposal, id: runId };
      await deps.dataSource.createPlanningScenarioRun({
        id: runId,
        tenantId: actor.tenantId,
        projectId,
        planVersion: snapshot.planVersion,
        engineVersion: planningEngineVersion,
        targetConflict: parsed.value.target,
        proposalPayload: persistedProposal as unknown as Record<string, unknown>,
        proposalPayloadHash: hashJson(persistedProposal),
        actorUserId: actor.id,
        expiresAt
      });
      persistedProposals.push(persistedProposal);
    }
    await appendPlanningAuditIfConfigured(deps, {
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "planning.scenario.previewed",
      sourceWorkflow: "planning",
      sourceEntity: { type: "Project", id: projectId },
      commandInput: { target: parsed.value.target },
      beforeState: { planVersion: snapshot.planVersion },
      afterState: {
        proposalIds: persistedProposals.map((proposal) => proposal.id),
        proposalCount: persistedProposals.length,
        expiresAt: expiresAt.toISOString()
      },
      permissionResult: decision
    });

    return context.json({
      proposals: persistedProposals,
      planVersion: snapshot.planVersion,
      engineVersion: planningEngineVersion,
      expiresAt: expiresAt.toISOString()
    });
  };

  app.post("/api/workspace/projects/:projectId/planning/scenarios/preview", previewScenarioProposals);
  app.post("/api/workspace/projects/:projectId/planning/scenario-proposals", previewScenarioProposals);

  const applyScenarioProposal: Handler = async (context) => {
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
        sourceEntity: { type: "Project", id: getRequiredRouteParam(context, "projectId") },
        commandInput: {
          scenarioRunId: getScenarioProposalId(context),
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
        sourceEntity: { type: "Project", id: getRequiredRouteParam(context, "projectId") },
        commandInput: {
          scenarioRunId: getScenarioProposalId(context),
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

      const projectId = getRequiredRouteParam(context, "projectId");
      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
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
        getScenarioProposalId(context)
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
      if (proposalRequiresAcceptedRiskReason(proposal) && !parsed.value.acceptedRiskReason) {
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
      const planningApplyDataSource = {
        applyPlanningCommand: (input: Parameters<NonNullable<typeof transactionDataSource.applyPlanningCommand>>[0]) =>
          transactionDataSource.applyPlanningCommand!(input),
        getPlanSnapshot: (tenantId: string, projectId: string) =>
          transactionDataSource.getPlanSnapshot!(tenantId, projectId),
        incrementPlanVersion: (tenantId: string, projectId: string) =>
          transactionDataSource.incrementPlanVersion!(tenantId, projectId)
      };
      const markPlanningScenarioRunApplied = transactionDataSource.markPlanningScenarioRunApplied;

      const applied = await applyGovernedPlanningDelta({
        dataSource: planningApplyDataSource,
        tenantId: actor.tenantId,
        projectId,
        actorUserId: actor.id,
        snapshot,
        commands: commandsToApply,
        permissionResult: decision,
        previewCommand: previewPlanningCommand,
        validateCommandPreconditions: (command) =>
          validateCommandDataSourcePreconditions(transactionDataSource, actor.tenantId, command),
        appendAuditEvent: deps.appendManagementAuditEvent,
        auditDataSource: transactionDataSource,
        createReadModel: createPlanningReadModel,
        afterCommandsApplied: async () => {
          await markPlanningScenarioRunApplied({
            tenantId: actor.tenantId,
            projectId,
            scenarioRunId: scenarioRun.id,
            appliedAt: new Date()
          });
        },
        buildAuditInput: ({ newPlanVersion, validationIssues, preview }) => ({
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
            changedTaskIds: preview.planDelta.changedTaskIds,
            changedAssignmentIds: preview.planDelta.changedAssignmentIds,
            acceptedRiskIds: preview.planDelta.acceptedRiskIds
          },
          permissionResult: decision,
          executionResult: { status: "succeeded", validationIssues }
        })
      });
      if (!applied.ok) return applied;
      return {
        ok: true as const,
        body: {
          scenarioRunId: scenarioRun.id,
          newPlanVersion: applied.body.newPlanVersion,
          auditEventId: applied.body.auditEventId,
          readModel: applied.body.readModel
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

    return context.json(result.body);
  };

  app.post("/api/workspace/projects/:projectId/planning/scenarios/:scenarioId/apply", applyScenarioProposal);
  app.post("/api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply", applyScenarioProposal);

  app.post("/api/workspace/projects/:projectId/planning/auto-solver-runs", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getPlanSnapshot ||
      !deps.dataSource.createPlanningSolverRun ||
      !deps.dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseAutoSolverRunEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);
    const decision = canPreviewPlanningScenarios({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const projectId = getRequiredRouteParam(context, "projectId");
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, projectId);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
      return context.json({ error: "plan_version_conflict", currentPlanVersion: snapshot.planVersion }, 409);
    }

    const solverResult = proposeAutoPlanningSolutions({
      snapshot,
      mode: parsed.value.mode,
      targetDeadline: parsed.value.targetDeadline,
      engineVersion: planningEngineVersion
    });
    const runId = `planning-solver-${randomUUID()}`;
    const proposals = solverResult.proposals.map((proposal, index) => ({
      ...proposal,
      id: `${runId}-proposal-${index + 1}`
    }));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const solverRun = await deps.dataSource.createPlanningSolverRun({
      id: runId,
      tenantId: actor.tenantId,
      projectId,
      mode: parsed.value.mode,
      clientPlanVersion: snapshot.planVersion,
      engineVersion: planningEngineVersion,
      inputSnapshotMetadata: {
        planVersion: snapshot.planVersion,
        capturedAt: snapshot.capturedAt,
        taskCount: snapshot.tasks.length,
        assignmentCount: snapshot.assignments.length
      },
      targetDeadline: solverResult.targetDeadline,
      proposals: proposals as unknown as Record<string, unknown>[],
      proposalPayloadHash: hashJson(proposals),
      actorUserId: actor.id,
      expiresAt
    });
    await appendPlanningAuditIfConfigured(deps, {
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "planning.auto_solver_run.created",
      sourceWorkflow: "planning",
      sourceEntity: { type: "Project", id: projectId },
      commandInput: parsed.value,
      beforeState: { planVersion: snapshot.planVersion },
      afterState: {
        solverRunId: runId,
        proposalIds: proposals.map((proposal) => proposal.id),
        proposalCount: proposals.length,
        expiresAt: expiresAt.toISOString()
      },
      permissionResult: decision
    });

    return context.json(formatSolverRunResponse(solverRun));
  });

  app.get("/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.findPlanningSolverRun) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);
    const solverRun = await deps.dataSource.findPlanningSolverRun(
      actor.tenantId,
      getRequiredRouteParam(context, "projectId"),
      getRequiredRouteParam(context, "runId")
    );
    if (!solverRun) return context.json({ error: "planning_auto_solver_run_not_found" }, 404);
    return context.json(formatSolverRunResponse(solverRun));
  });

  app.post(
    "/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId/proposals/:proposalId/apply",
    async (context) => {
      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsed = parseAutoSolverApplyEnvelope(body.value);
      if (!parsed.ok) return context.json({ error: parsed.error }, 400);

      const profile = await deps.getActorProfile(actor);
      const planDecision = canManageProjectPlan({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!planDecision.allowed) return context.json({ error: planDecision.reason }, 403);

      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.getPlanSnapshot ||
          !transactionDataSource.findPlanningSolverRun ||
          !transactionDataSource.applyPlanningCommand ||
          !transactionDataSource.incrementPlanVersion ||
          !transactionDataSource.markPlanningSolverRunApplied ||
          !transactionDataSource.appendAuditEvent
        ) {
          return { ok: false as const, status: 501, error: "persistence_not_configured" };
        }

        const projectId = getRequiredRouteParam(context, "projectId");
        const runId = getRequiredRouteParam(context, "runId");
        const proposalId = getRequiredRouteParam(context, "proposalId");
        await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
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

        const solverRun = await transactionDataSource.findPlanningSolverRun(actor.tenantId, projectId, runId);
        if (!solverRun) return { ok: false as const, status: 404, error: "planning_auto_solver_run_not_found" };
        if (solverRun.appliedAt) return { ok: false as const, status: 409, error: "planning_auto_solver_already_applied" };
        if (solverRun.expiresAt.getTime() <= Date.now()) {
          return { ok: false as const, status: 409, error: "planning_auto_solver_expired" };
        }
        if (solverRun.clientPlanVersion !== snapshot.planVersion) {
          return {
            ok: false as const,
            status: 409,
            error: "plan_version_conflict",
            currentPlanVersion: snapshot.planVersion
          };
        }
        if (hashJson(solverRun.proposals) !== solverRun.proposalPayloadHash) {
          return { ok: false as const, status: 409, error: "planning_auto_solver_hash_mismatch" };
        }
        const proposal = parseAutoSolverProposal(
          solverRun.proposals.find((candidate) => candidate.id === proposalId)
        );
        if (!proposal) return { ok: false as const, status: 404, error: "planning_auto_solver_proposal_not_found" };
        const resourceDecision = proposalRequiresResourceManage(proposal)
          ? canManageProjectResources({ actor, profile, targetTenantId: actor.tenantId })
          : planDecision;
        if (!resourceDecision.allowed) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.denied",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId },
            beforeState: { planVersion: snapshot.planVersion },
            afterState: null,
            permissionResult: resourceDecision,
            executionResult: { status: "denied" }
          }, transactionDataSource);
          return { ok: false as const, status: 403, error: resourceDecision.reason };
        }
        if (proposalRequiresAcceptedRiskReason(proposal) && !parsed.value.acceptedRiskReason) {
          return { ok: false as const, status: 400, error: "accepted_risk_reason_required" };
        }

        const commandsToApply = withAcceptedRiskReason(
          proposal.planDelta.commands,
          parsed.value.acceptedRiskReason
        );
        const planningApplyDataSource = {
          applyPlanningCommand: (input: Parameters<NonNullable<typeof transactionDataSource.applyPlanningCommand>>[0]) =>
            transactionDataSource.applyPlanningCommand!(input),
          getPlanSnapshot: (tenantId: string, projectId: string) =>
            transactionDataSource.getPlanSnapshot!(tenantId, projectId),
          incrementPlanVersion: (tenantId: string, projectId: string) =>
            transactionDataSource.incrementPlanVersion!(tenantId, projectId)
        };
        const markPlanningSolverRunApplied = transactionDataSource.markPlanningSolverRunApplied;

        const applied = await applyGovernedPlanningDelta({
          dataSource: planningApplyDataSource,
          tenantId: actor.tenantId,
          projectId,
          actorUserId: actor.id,
          snapshot,
          commands: commandsToApply,
          permissionResult: resourceDecision,
          previewCommand: previewPlanningCommand,
          validateCommandPreconditions: (command) =>
            validateCommandDataSourcePreconditions(transactionDataSource, actor.tenantId, command),
          appendAuditEvent: deps.appendManagementAuditEvent,
          auditDataSource: transactionDataSource,
          createReadModel: createPlanningReadModel,
          afterCommandsApplied: async () => {
            await markPlanningSolverRunApplied({
              tenantId: actor.tenantId,
              projectId,
              solverRunId: solverRun.id,
              proposalId,
              appliedAt: new Date()
            });
          },
          buildAuditInput: ({ newPlanVersion, validationIssues, preview }) => ({
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.proposal_applied",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId, commands: commandsToApply },
            beforeState: { planVersion: snapshot.planVersion },
            afterState: {
              planVersion: newPlanVersion,
              changedTaskIds: preview.planDelta.changedTaskIds,
              changedAssignmentIds: preview.planDelta.changedAssignmentIds,
              acceptedRiskIds: preview.planDelta.acceptedRiskIds
            },
            permissionResult: resourceDecision,
            executionResult: { status: "succeeded", validationIssues }
          })
        });
        if (!applied.ok) return applied;
        return {
          ok: true as const,
          body: {
            solverRunId: solverRun.id,
            proposalId,
            newPlanVersion: applied.body.newPlanVersion,
            auditEventId: applied.body.auditEventId,
            readModel: applied.body.readModel
          }
        };
      });

      if (!result.ok) {
        if (result.status === 501) return context.json({ error: result.error }, 501);
        if (result.status === 404) return context.json({ error: result.error }, 404);
        if (result.status === 409) return context.json(errorResponseBody(result), 409);
        if (result.status === 403) return context.json({ error: result.error }, 403);
        if (result.status === 400) return context.json({ error: result.error }, 400);
        return context.json({ error: result.error }, 400);
      }

      return context.json(result.body);
    }
  );
}

function getScenarioProposalId(context: Parameters<Handler>[0]): string {
  return getRequiredRouteParam(context, "scenarioId", "proposalId");
}

function errorResponseBody<T extends { ok?: false; status?: number; error: string }>(
  result: T
): Omit<T, "ok" | "status"> {
  const { ok: _ok, status: _status, ...body } = result;
  return body;
}

function getRequiredRouteParam(context: Parameters<Handler>[0], ...keys: string[]): string {
  for (const key of keys) {
    const value = context.req.param(key);
    if (value) return value;
  }
  throw new Error(`missing_route_param:${keys.join("|")}`);
}

function formatSolverRunResponse(run: PlanningSolverRunRecord) {
  return {
    id: run.id,
    projectId: run.projectId,
    mode: run.mode,
    clientPlanVersion: run.clientPlanVersion,
    engineVersion: run.engineVersion,
    inputSnapshotMetadata: run.inputSnapshotMetadata,
    targetDeadline: run.targetDeadline,
    proposals: run.proposals,
    expiresAt: run.expiresAt.toISOString(),
    appliedProposalId: run.appliedProposalId,
    appliedAt: run.appliedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString()
  };
}

function validateScenarioRunIntegrity(
  scenarioRun: PlanningScenarioRunRecord,
  snapshot: PlanSnapshot
): string | null {
  if (scenarioRun.engineVersion !== planningEngineVersion) {
    return "planning_scenario_engine_mismatch";
  }
  const target = parseScenarioTargetRecord(scenarioRun.targetConflict);
  if (!target) return "planning_scenario_target_mismatch";

  const readModel = createPlanningReadModel(snapshot);
  const overload = readModel.resourceLoad.overloads.find(
    (candidate) =>
      candidate.granularity === "day" &&
      candidate.resourceId === target.resourceId &&
      candidate.date === target.date
  );
  if (!overload) return "planning_scenario_target_mismatch";
  if (overload.overloadMinutes !== target.overloadMinutes) {
    return "planning_scenario_target_mismatch";
  }
  if (!sameStringSet(overload.taskIds, target.taskIds)) {
    return "planning_scenario_target_mismatch";
  }
  return null;
}

function parseScenarioTargetRecord(input: Record<string, unknown>): ScenarioTarget | null {
  if (input.type !== "resource_overload") return null;
  if (typeof input.resourceId !== "string" || input.resourceId.trim().length === 0) return null;
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  if (typeof input.overloadMinutes !== "number" || !Number.isInteger(input.overloadMinutes) || input.overloadMinutes <= 0) {
    return null;
  }
  if (!Array.isArray(input.taskIds) || input.taskIds.some((taskId) => typeof taskId !== "string")) {
    return null;
  }
  return {
    type: "resource_overload",
    resourceId: input.resourceId,
    date: input.date,
    overloadMinutes: input.overloadMinutes,
    taskIds: input.taskIds as string[]
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  const normalize = (values: string[]) => [...new Set(values)].sort().join("\n");
  return normalize(left) === normalize(right);
}

function previewPlanningCommand(snapshot: PlanSnapshot, command: PlanningCommand) {
  const reduction = reducePlanningCommand(snapshot, command);
  const calculated = calculatePlan(reduction.nextSnapshot, {
    calculatedAt: snapshot.capturedAt,
    engineVersion: planningEngineVersion
  });
  return {
    ...reduction,
    validationIssues: [...reduction.validationIssues, ...calculated.validationIssues]
  };
}

function createPlanningReadModel(snapshot: PlanSnapshot) {
  const calculatedPlan = calculatePlan(snapshot, {
    calculatedAt: snapshot.capturedAt,
    engineVersion: planningEngineVersion
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
    rangeFinish: calculatedPlan.projectFinish ?? snapshot.project.plannedFinish
  });

  return {
    project: snapshot.project,
    authored: {
      tasks: snapshot.tasks,
      dependencies: snapshot.dependencies,
      assignments: snapshot.assignments,
      assignmentAllocations: snapshot.assignmentAllocations,
      baselines: snapshot.baselines
    },
    calculatedPlan,
    baselineComparison: createBaselineComparison(snapshot, calculatedPlan),
    resourceLoad,
    validationIssues: calculatedPlan.validationIssues,
    planVersion: snapshot.planVersion,
    engineVersion: planningEngineVersion
  };
}

function createBaselineComparison(
  snapshot: PlanSnapshot,
  calculatedPlan: ReturnType<typeof calculatePlan>
) {
  const baseline = [...snapshot.baselines].sort((left, right) =>
    right.capturedAt.localeCompare(left.capturedAt) || right.id.localeCompare(left.id)
  )[0];
  if (!baseline) {
    return {
      baselineId: null,
      capturedAt: null,
      tasks: []
    };
  }

  const calculatedTasksById = new Map(calculatedPlan.tasks.map((task) => [task.id, task]));
  return {
    baselineId: baseline.id,
    capturedAt: baseline.capturedAt,
    tasks: baseline.tasks.map((baselineTask) => {
      const current = calculatedTasksById.get(baselineTask.taskId);
      const currentStart = current?.calculatedStart ?? null;
      const currentFinish = current?.calculatedFinish ?? null;
      const currentWorkMinutes = current?.workMinutes ?? null;
      return {
        taskId: baselineTask.taskId,
        baselineStart: baselineTask.plannedStart,
        baselineFinish: baselineTask.plannedFinish,
        baselineWorkMinutes: baselineTask.workMinutes,
        currentStart,
        currentFinish,
        currentWorkMinutes,
        startDeltaDays: dateDeltaDays(baselineTask.plannedStart, currentStart),
        finishDeltaDays: dateDeltaDays(baselineTask.plannedFinish, currentFinish),
        workDeltaMinutes:
          currentWorkMinutes === null ? null : currentWorkMinutes - baselineTask.workMinutes
      };
    })
  };
}

function dateDeltaDays(baselineDate: string | null, currentDate: string | null): number | null {
  if (!baselineDate || !currentDate) return null;
  return diffCalendarDays(baselineDate, currentDate);
}

function permissionForCommand(
  command: PlanningCommand,
  actor: TenantUser,
  profile: AccessProfile
): PolicyDecision {
  const input = { actor, profile, targetTenantId: actor.tenantId };
  if (command.type === "baseline.capture") return canManageProjectBaselines(input);
  if (
    command.type === "assignment.upsert" ||
    command.type === "assignment.delete" ||
    command.type === "assignment.allocations.replace" ||
    command.type === "resource.reserve"
  ) {
    return canManageProjectResources(input);
  }
  return canManageProjectPlan(input);
}

function canReadPlanningReadModel(input: {
  actor: TenantUser;
  profile: AccessProfile;
}): PolicyDecision {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  const planDecision = canReadProjectPlan(policyInput);
  if (!planDecision.allowed) return planDecision;
  return canReadProjectResources(policyInput);
}

async function validateCommandDataSourcePreconditions(
  dataSource: PlanningRouteDataSource,
  tenantId: string,
  command: PlanningCommand
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const statusId =
    command.type === "task.create"
      ? command.payload.statusId
      : command.type === "task.update_status"
        ? command.payload.statusId
        : null;
  if (statusId && dataSource.listTaskStatuses) {
    const status = (await dataSource.listTaskStatuses(tenantId)).find(
      (candidate) => candidate.id === statusId && candidate.status === "active"
    );
    if (!status) {
      issues.push({
        code: "planning_command_invalid",
        severity: "error",
        message: "Команда ссылается на неизвестный или архивированный статус задачи",
        entity: null
      });
    }
  }

  const resourceIds = resourceIdsForCommand(command);
  if (resourceIds.length > 0 && dataSource.listWorkspaceUsers) {
    const activeResourceIds = new Set(
      (await dataSource.listWorkspaceUsers(tenantId))
        .filter((user) => user.status !== "inactive")
        .map((user) => user.id)
    );
    const invalidResourceIds = resourceIds.filter(
      (resourceId) => !activeResourceIds.has(resourceId)
    );
    if (invalidResourceIds.length > 0) {
      issues.push({
        code: "planning_command_invalid",
        severity: "error",
        message: "Команда ссылается на неизвестный или неактивный ресурс",
        entity: null
      });
    }
  }

  return issues;
}

function resourceIdsForCommand(command: PlanningCommand): string[] {
  const resourceIds =
    command.type === "task.create"
      ? command.payload.assignments.map((assignment) => assignment.resourceId)
      : command.type === "assignment.upsert" || command.type === "resource.reserve"
        ? [command.payload.resourceId]
        : command.type === "calendar.exception.upsert" && command.payload.resourceId
          ? [command.payload.resourceId]
          : [];
  return [...new Set(resourceIds)];
}

function auditActionForCommand(command: PlanningCommand): string {
  if (command.type === "task.delete_or_archive") {
    return command.payload.mode === "delete"
      ? "planning.task.deleted"
      : "planning.task.archived";
  }

  const actionByCommand: Record<Exclude<PlanningCommand["type"], "task.delete_or_archive">, string> = {
    "task.create": "planning.task.created",
    "task.update_identity": "planning.task.updated",
    "task.update_schedule": "planning.task.updated",
    "task.update_work_model": "planning.task.updated",
    "task.update_status": "planning.task.status_changed",
    "task.move_wbs": "planning.task.updated",
    "dependency.upsert": "planning.dependency.upserted",
    "dependency.delete": "planning.dependency.deleted",
    "assignment.upsert": "planning.assignment.upserted",
    "assignment.allocations.replace": "planning.assignment_allocations.replaced",
    "assignment.delete": "planning.assignment.deleted",
    "baseline.capture": "planning.baseline.captured",
    "calendar.exception.upsert": "planning.calendar_exception.upserted",
    "constraint.update": "planning.constraint.updated",
    "resource.reserve": "planning.resource_reserved",
    "risk.accept_overload": "planning.overload_risk_accepted",
    "project.deadline.move": "planning.task.updated"
  };
  return actionByCommand[command.type];
}

function summarizeSnapshot(snapshot: PlanSnapshot): Record<string, unknown> {
  return {
    projectId: snapshot.projectId,
    planVersion: snapshot.planVersion,
    taskCount: snapshot.tasks.length,
    assignmentCount: snapshot.assignments.length,
    dependencyCount: snapshot.dependencies.length
  };
}

async function appendPlanningAuditIfConfigured(
  deps: PlanningRouteDeps,
  input: ManagementAuditEventInput,
  auditDataSource?: ManagementAuditDataSource
): Promise<string> {
  if (!(auditDataSource ?? deps.dataSource).appendAuditEvent) {
    throw new Error("audit_not_configured");
  }
  return deps.appendManagementAuditEvent(input, auditDataSource);
}
