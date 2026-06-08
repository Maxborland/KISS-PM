import { canManageProjectPlan, canManageProjectResources } from "@kiss-pm/access-control";
import {
  isBlockingValidationIssue,
  maxPlanDate,
  proposeAutoPlanningSolutions,
  parsePlanDate,
  type AutoPlanningSolverMode,
  type PlanningCommand
} from "@kiss-pm/domain";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import { readLimitedJsonBody } from "../jsonBody";
import { persistPlanningNotifications } from "../collaborationNotificationService";
import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { notifyPlanVersionChanged } from "../planningEventBus";
import { parsePlanningCommand, parseScenarioApplyEnvelope } from "../planningParsers";
import { previewPlanningCommands } from "./planningCommandCore";
import { PLANNING_ENGINE_VERSION } from "./planningConstants";
import { createPlanningReadModel } from "./planningReadModel";
import { canReadPlanningReadModel, permissionForCommand } from "./planningRouteAuth";
import {
  appendPlanningAuditIfConfigured,
  errorResponseBody,
  hashJson,
  parseProjectRouteParam,
  parseSolverProposalRouteParam,
  parseSolverRunRouteParam,
  requireActivePlanningProject,
  summarizeSnapshot,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import { withAcceptedRiskReason } from "./planningScenarioIntegrity";

type AutoSolverRunEnvelope = {
  mode: AutoPlanningSolverMode;
  clientPlanVersion: number;
  targetDeadline?: string | null;
};

export function registerPlanningAutoSolverRoutes(app: Hono, deps: PlanningRouteDeps): void {
  app.post("/api/workspace/projects/:projectId/planning/auto-solver-runs", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !deps.dataSource.getPlanSnapshot ||
      !deps.dataSource.createPlanningSolverRun ||
      !deps.dataSource.appendAuditEvent ||
      !deps.dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseAutoSolverRunEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const projectId = parsedProjectId.value;
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      await appendAutoSolverDeniedAuditIfConfigured(deps, {
        actor,
        projectId,
        operation: "create",
        permissionResult: readDecision
      });
      return context.json({ error: readDecision.reason }, 403);
    }
    const manageDecision = canManageProjectPlan({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!manageDecision.allowed) {
      await appendAutoSolverDeniedAuditIfConfigured(deps, {
        actor,
        projectId,
        operation: "create",
        permissionResult: manageDecision
      });
      return context.json({ error: manageDecision.reason }, 403);
    }
    const resourceManageDecision = canManageProjectResources({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!resourceManageDecision.allowed) {
      await appendAutoSolverDeniedAuditIfConfigured(deps, {
        actor,
        projectId,
        operation: "create",
        permissionResult: resourceManageDecision
      });
      return context.json({ error: resourceManageDecision.reason }, 403);
    }

    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, projectId);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
      return context.json({ error: "plan_version_conflict", currentPlanVersion: snapshot.planVersion }, 409);
    }

    const solverHorizonFinish = parsed.value.targetDeadline
      ? maxPlanDate(
          maxPlanDate(snapshot.project.plannedFinish, snapshot.project.deadline ?? snapshot.project.plannedFinish),
          parsed.value.targetDeadline
        )
      : maxPlanDate(snapshot.project.plannedFinish, snapshot.project.deadline ?? snapshot.project.plannedFinish);
    const solverOccupancyWindows = deps.dataSource.listOccupancyWindows
      ? await deps.dataSource.listOccupancyWindows({
          tenantId: actor.tenantId,
          from: new Date(`${snapshot.project.plannedStart}T00:00:00.000Z`),
          to: new Date(`${solverHorizonFinish}T23:59:59.999Z`)
        })
      : snapshot.occupancyWindows;
    const solverSnapshot = parsed.value.targetDeadline
      ? {
          ...snapshot,
          occupancyWindows: solverOccupancyWindows,
          project: {
            ...snapshot.project,
            deadline: parsed.value.targetDeadline
          }
        }
      : { ...snapshot, occupancyWindows: solverOccupancyWindows };
    const runResult = proposeAutoPlanningSolutions({
      mode: parsed.value.mode,
      snapshot: solverSnapshot,
      targetDeadline: parsed.value.targetDeadline ?? null,
      calculatedAt: solverSnapshot.capturedAt,
      engineVersion: PLANNING_ENGINE_VERSION
    });
    const runId = `planning-auto-solver-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const proposals = runResult.proposals.map((proposal, index): Record<string, unknown> => ({
      ...proposal,
      id: `proposal-${index + 1}`,
      conflictEffect: proposal.kind === "accepted_overload" ? "accepted_overload" : "removed",
      label: proposal.kind === "accepted_overload" ? "Accept controlled overload" : "Resolve without overlap"
    }));
    const proposalPayloadHash = hashJson(proposals);
    const run = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createPlanningSolverRun || !transactionDataSource.appendAuditEvent) {
        throw new Error("persistence_not_configured");
      }
      const persistedRun = await transactionDataSource.createPlanningSolverRun({
        id: runId,
        tenantId: actor.tenantId,
        projectId,
        mode: parsed.value.mode,
        clientPlanVersion: snapshot.planVersion,
        engineVersion: PLANNING_ENGINE_VERSION,
        inputSnapshotMetadata: {
          ...summarizeSnapshot(snapshot),
          targetDeadline: parsed.value.targetDeadline ?? null,
          search: runResult.search
        },
        targetDeadline: parsed.value.targetDeadline ?? null,
        proposals,
        proposalPayloadHash,
        actorUserId: actor.id,
        expiresAt
      });
      await appendPlanningAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.auto_solver.run_created",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: parsed.value,
          beforeState: summarizeSnapshot(snapshot),
          afterState: {
            runId,
            proposalCount: proposals.length,
            expiresAt: expiresAt.toISOString()
          },
          permissionResult: manageDecision,
          executionResult: { status: "succeeded" }
        },
        transactionDataSource
      );
      return persistedRun;
    });

    return context.json({
      runId: run.id,
      mode: run.mode,
      clientPlanVersion: run.clientPlanVersion,
      engineVersion: run.engineVersion,
      targetDeadline: run.targetDeadline,
      proposalPayloadHash: run.proposalPayloadHash,
      expiresAt: run.expiresAt.toISOString(),
      appliedProposalId: run.appliedProposalId,
      proposals: run.proposals
    });
  });

  app.get("/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
    const parsedRunId = parseSolverRunRouteParam(context);
    if (!parsedRunId.ok) return context.json({ error: parsedRunId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.findPlanningSolverRun) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await deps.getActorProfile(actor);
    const projectId = parsedProjectId.value;
    const runId = parsedRunId.value;
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      await appendAutoSolverDeniedAuditIfConfigured(deps, {
        actor,
        projectId,
        runId,
        operation: "read",
        permissionResult: readDecision
      });
      return context.json({ error: readDecision.reason }, 403);
    }
    const resourceManageDecision = canManageProjectResources({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!resourceManageDecision.allowed) {
      await appendAutoSolverDeniedAuditIfConfigured(deps, {
        actor,
        projectId,
        runId,
        operation: "read",
        permissionResult: resourceManageDecision
      });
      return context.json({ error: resourceManageDecision.reason }, 403);
    }

    const run = await deps.dataSource.findPlanningSolverRun(
      actor.tenantId,
      projectId,
      runId
    );
    if (!run) return context.json({ error: "planning_solver_run_not_found" }, 404);
    return context.json({
      runId: run.id,
      mode: run.mode,
      clientPlanVersion: run.clientPlanVersion,
      engineVersion: run.engineVersion,
      inputSnapshotMetadata: run.inputSnapshotMetadata,
      targetDeadline: run.targetDeadline,
      proposalPayloadHash: run.proposalPayloadHash,
      expiresAt: run.expiresAt.toISOString(),
      appliedProposalId: run.appliedProposalId,
      appliedAt: run.appliedAt?.toISOString() ?? null,
      proposals: run.proposals
    });
  });

  app.post(
    "/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId/proposals/:proposalId/apply",
    async (context) => {
      const parsedProjectId = parseProjectRouteParam(context);
      if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);
      const parsedRunId = parseSolverRunRouteParam(context);
      if (!parsedRunId.ok) return context.json({ error: parsedRunId.error }, 400);
      const parsedProposalId = parseSolverProposalRouteParam(context);
      if (!parsedProposalId.ok) return context.json({ error: parsedProposalId.error }, 400);

      const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (!deps.dataSource.appendAuditEvent) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }

      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsedApply = parseScenarioApplyEnvelope(body.value);
      if (!parsedApply.ok) return context.json({ error: "planning_solver_invalid" }, 400);

      const profile = await deps.getActorProfile(actor);
      const projectId = parsedProjectId.value;
      const runId = parsedRunId.value;
      const proposalId = parsedProposalId.value;
      const readDecision = canReadPlanningReadModel({ actor, profile });
      if (!readDecision.allowed) {
        await appendAutoSolverDeniedAuditIfConfigured(deps, {
          actor,
          projectId,
          runId,
          proposalId,
          operation: "apply",
          permissionResult: readDecision
        });
        return context.json({ error: readDecision.reason }, 403);
      }

      const result = await deps.runDataSourceTransaction(async (transactionDataSource) => {
        if (
          !transactionDataSource.getPlanSnapshot ||
          !transactionDataSource.findPlanningSolverRun ||
          !transactionDataSource.markPlanningSolverRunApplied ||
          !transactionDataSource.applyPlanningCommand ||
          !transactionDataSource.incrementPlanVersion ||
          !transactionDataSource.appendAuditEvent
        ) {
          return { ok: false as const, status: 501, error: "persistence_not_configured" };
        }

        await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
        const activeProject = await requireActivePlanningProject(
          transactionDataSource,
          actor.tenantId,
          projectId
        );
        if (!activeProject.ok) return activeProject;
        const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
        if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
        const run = await transactionDataSource.findPlanningSolverRun(actor.tenantId, projectId, runId);
        if (!run) return { ok: false as const, status: 404, error: "planning_solver_run_not_found" };
        if (run.appliedAt) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_already_applied",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId },
            beforeState: {
              planVersion: snapshot.planVersion,
              appliedProposalId: run.appliedProposalId,
              appliedAt: run.appliedAt.toISOString()
            },
            afterState: null,
            permissionResult: readDecision,
            executionResult: { status: "rejected", reason: "planning_solver_run_already_applied" }
          }, transactionDataSource);
          return { ok: false as const, status: 409, error: "planning_solver_run_already_applied" };
        }
        if (run.expiresAt.getTime() <= Date.now()) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_expired",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId },
            beforeState: {
              planVersion: snapshot.planVersion,
              expiresAt: run.expiresAt.toISOString()
            },
            afterState: null,
            permissionResult: readDecision,
            executionResult: { status: "rejected", reason: "planning_solver_run_expired" }
          }, transactionDataSource);
          return { ok: false as const, status: 409, error: "planning_solver_run_expired" };
        }
        if (hashJson(run.proposals) !== run.proposalPayloadHash) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_payload_hash_mismatch",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId },
            beforeState: {
              planVersion: snapshot.planVersion,
              proposalPayloadHash: run.proposalPayloadHash
            },
            afterState: null,
            permissionResult: readDecision,
            executionResult: { status: "rejected", reason: "planning_solver_payload_hash_mismatch" }
          }, transactionDataSource);
          return { ok: false as const, status: 409, error: "planning_solver_payload_hash_mismatch" };
        }
        if (
          snapshot.planVersion !== run.clientPlanVersion ||
          parsedApply.value.clientPlanVersion !== run.clientPlanVersion
        ) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_conflict",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: {
              runId,
              proposalId,
              clientPlanVersion: parsedApply.value.clientPlanVersion
            },
            beforeState: summarizeSnapshot(snapshot),
            afterState: null,
            permissionResult: readDecision,
            executionResult: {
              status: "conflict",
              runPlanVersion: run.clientPlanVersion,
              currentPlanVersion: snapshot.planVersion
            }
          }, transactionDataSource);
          return {
            ok: false as const,
            status: 409,
            error: "plan_version_conflict",
            currentPlanVersion: snapshot.planVersion
          };
        }

        const proposal = parseAutoSolverProposal(
          run.proposals.find((candidate) => candidate.id === proposalId)
        );
        if (!proposal) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_proposal_not_found",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId },
            beforeState: {
              planVersion: snapshot.planVersion,
              proposalCount: run.proposals.length
            },
            afterState: null,
            permissionResult: readDecision,
            executionResult: { status: "rejected", reason: "planning_solver_proposal_not_found" }
          }, transactionDataSource);
          return { ok: false as const, status: 404, error: "planning_solver_proposal_not_found" };
        }
        if (requiresAcceptedRiskReason(proposal.planDelta.commands) && !parsedApply.value.acceptedRiskReason) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_precondition_failed",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId },
            beforeState: summarizeSnapshot(snapshot),
            afterState: null,
            permissionResult: readDecision,
            executionResult: { status: "precondition_failed", reason: "accepted_risk_reason_required" }
          }, transactionDataSource);
          return { ok: false as const, status: 409, error: "accepted_risk_reason_required" };
        }
        const commands = withAcceptedRiskReason(
          proposal.planDelta.commands,
          parsedApply.value.acceptedRiskReason
        );
        for (const command of commands) {
          const decision = permissionForCommand(command, actor, profile);
          if (!decision.allowed) {
            await appendPlanningAuditIfConfigured(deps, {
              tenantId: actor.tenantId,
              actorUserId: actor.id,
              actionType: "planning.auto_solver.apply_denied",
              sourceWorkflow: "planning",
              sourceEntity: { type: "Project", id: projectId },
              commandInput: { runId, proposalId, command },
              beforeState: summarizeSnapshot(snapshot),
              afterState: null,
              permissionResult: decision,
              executionResult: { status: "denied" }
            }, transactionDataSource);
            return { ok: false as const, status: 403, error: decision.reason };
          }
        }

        const preview = await previewPlanningCommands(
          snapshot,
          commands,
          transactionDataSource,
          actor.tenantId
        );
        if (preview.validationIssues.some(isBlockingValidationIssue)) {
          await appendPlanningAuditIfConfigured(deps, {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.auto_solver.apply_precondition_failed",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: { runId, proposalId, commands },
            beforeState: summarizeSnapshot(snapshot),
            afterState: null,
            permissionResult: { allowed: true, reason: "same_tenant_permission_granted" },
            executionResult: {
              status: "precondition_failed",
              validationIssues: preview.validationIssues
            }
          }, transactionDataSource);
          return {
            ok: false as const,
            status: 409,
            error: "planning_precondition_failed",
            validationIssues: preview.validationIssues
          };
        }

        for (const command of commands) {
          await transactionDataSource.applyPlanningCommand({
            tenantId: actor.tenantId,
            projectId,
            actorUserId: actor.id,
            command
          });
        }
        const appliedAt = new Date();
        await transactionDataSource.markPlanningSolverRunApplied({
          tenantId: actor.tenantId,
          projectId,
          runId,
          proposalId,
          appliedAt
        });
        const newPlanVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, projectId);
        const auditEventId = await appendPlanningAuditIfConfigured(deps, {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "planning.auto_solver.proposal_applied",
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: { runId, proposalId, commands },
          beforeState: summarizeSnapshot(snapshot),
          afterState: {
            planVersion: newPlanVersion,
            changedTaskIds: preview.planDelta.changedTaskIds,
            changedAssignmentIds: preview.planDelta.changedAssignmentIds,
            changedDependencyIds: preview.planDelta.changedDependencyIds
          },
          permissionResult: { allowed: true, reason: "same_tenant_permission_granted" },
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
          commands
        });
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
        if (result.status === 403) return context.json({ error: result.error }, 403);
        if (result.status === 409) return context.json(errorResponseBody(result), 409);
        return context.json({ error: result.error }, 400);
      }
      invalidateCapacityCacheForTenant(actor.tenantId);
      notifyPlanVersionChanged(projectId, result.body.newPlanVersion);
      return context.json(result.body);
    }
  );
}

function parseAutoSolverRunEnvelope(input: unknown):
  | { ok: true; value: AutoSolverRunEnvelope }
  | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: "planning_solver_invalid" };
  const mode = input.mode;
  const clientPlanVersion = input.clientPlanVersion;
  const targetDeadline = input.targetDeadline;
  if (
    (mode !== "schedule" && mode !== "repair") ||
    typeof clientPlanVersion !== "number" ||
    !Number.isInteger(clientPlanVersion) ||
    clientPlanVersion < 1 ||
    (targetDeadline !== undefined && targetDeadline !== null && !isPlanDate(targetDeadline))
  ) {
    return { ok: false, error: "planning_solver_invalid" };
  }
  return {
    ok: true,
    value: {
      mode,
      clientPlanVersion,
      targetDeadline: typeof targetDeadline === "string" ? targetDeadline : null
    }
  };
}

function parseAutoSolverProposal(input: unknown): { planDelta: { commands: PlanningCommand[] } } | null {
  if (!isRecord(input) || !isRecord(input.planDelta) || !Array.isArray(input.planDelta.commands)) {
    return null;
  }
  const commands: PlanningCommand[] = [];
  for (const command of input.planDelta.commands) {
    const parsed = parsePlanningCommand(command);
    if (!parsed.ok) return null;
    commands.push(parsed.value);
  }
  return { planDelta: { commands } };
}

function requiresAcceptedRiskReason(commands: PlanningCommand[]): boolean {
  return commands.some((command) => command.type === "risk.accept_overload");
}

async function appendAutoSolverDeniedAuditIfConfigured(
  deps: PlanningRouteDeps,
  input: {
    actor: { tenantId: string; id: string };
    projectId: string;
    runId?: string;
    proposalId?: string;
    operation: "create" | "read" | "apply";
    permissionResult: Record<string, unknown>;
  }
): Promise<void> {
  if (!deps.dataSource.appendAuditEvent) return;
  await appendPlanningAuditIfConfigured(deps, {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: `planning.auto_solver.${input.operation}_denied`,
    sourceWorkflow: "planning",
    sourceEntity: { type: "Project", id: input.projectId },
    commandInput: {
      projectId: input.projectId,
      runId: input.runId ?? null,
      proposalId: input.proposalId ?? null
    },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: { status: "denied", operation: input.operation }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlanDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    parsePlanDate(value);
    return true;
  } catch {
    return false;
  }
}
