import {
  canManageProjectBaselines,
  canManageProjectPlan,
  canManageProjectResources,
  canApplyPlanningScenarios,
  canPreviewPlanningScenarios,
  canReadProjectPlan,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  buildResourceLoadMatrix,
  calculatePlan,
  diffCalendarDays,
  isBlockingValidationIssue,
  proposePlanningScenarios,
  reducePlanningCommand,
  type PlanningCommand,
  type PlanSnapshot,
  type ScenarioProposal,
  type ScenarioTarget,
  type ValidationIssue
} from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import type { PlanningScenarioRunRecord } from "@kiss-pm/persistence";
import type { Handler, Hono } from "hono";
import { createHash, randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parsePlanningCommand,
  parsePlanningCommandEnvelope,
  parseScenarioApplyEnvelope,
  parseScenarioPreviewEnvelope
} from "./planningParsers";

const planningEngineVersion = "planning-core-v1";

type PlanningRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<string>;
};

export function registerPlanningRoutes(app: Hono, deps: PlanningRouteDeps) {
  app.get("/api/workspace/projects/:projectId/planning/read-model", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const decision = canReadProjectPlan({ actor, profile, targetTenantId: actor.tenantId });
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
    const readDecision = canReadProjectPlan({ actor, profile, targetTenantId: actor.tenantId });
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

    const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.getPlanSnapshot ||
        !transactionDataSource.applyPlanningCommand ||
        !transactionDataSource.incrementPlanVersion ||
        !transactionDataSource.appendAuditEvent
      ) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }

      const projectId = context.req.param("projectId");
      await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
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
      return {
        ok: true as const,
        body: {
          applied: preview.planDelta,
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

    return context.json(result.body);
  };

  app.post("/api/workspace/projects/:projectId/planning/scenarios/:scenarioId/apply", applyScenarioProposal);
  app.post("/api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply", applyScenarioProposal);
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

function scenarioRequiresAcceptedRiskReason(proposal: ScenarioProposal): boolean {
  return proposal.planDelta.commands.some((command) => command.type === "risk.accept_overload");
}

function withAcceptedRiskReason(
  commands: PlanningCommand[],
  acceptedRiskReason: string | null
): PlanningCommand[] {
  if (!acceptedRiskReason) return commands;
  return commands.map((command) =>
    command.type === "risk.accept_overload"
      ? {
          ...command,
          payload: {
            ...command.payload,
            acceptedRiskReason
          }
        }
      : command
  );
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
  if (command.type === "assignment.upsert" || command.type === "assignment.delete" || command.type === "resource.reserve") {
    return canManageProjectResources(input);
  }
  return canManageProjectPlan(input);
}

async function validateCommandDataSourcePreconditions(
  dataSource: ApiTenantDataSource,
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
  auditDataSource?: ApiTenantDataSource
): Promise<string> {
  if (!(auditDataSource ?? deps.dataSource).appendAuditEvent) {
    throw new Error("audit_not_configured");
  }
  return deps.appendManagementAuditEvent(input, auditDataSource);
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseScenarioProposal(input: Record<string, unknown>): ScenarioProposal | null {
  if (!Array.isArray((input as { planDelta?: { commands?: unknown[] } }).planDelta?.commands)) {
    return null;
  }
  const commands = (input as { planDelta: { commands: unknown[] } }).planDelta.commands.map(
    (command) => parsePlanningCommand(command)
  );
  if (commands.some((command) => !command.ok)) return null;
  return {
    ...(input as unknown as ScenarioProposal),
    planDelta: {
      ...(input as unknown as ScenarioProposal).planDelta,
      commands: commands.map((command) => (command.ok ? command.value : neverCommand()))
    }
  };
}

function neverCommand(): PlanningCommand {
  throw new Error("unreachable_invalid_planning_command");
}
