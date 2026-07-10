import type { Hono } from "hono";
import { canManageProjectPlan } from "@kiss-pm/access-control";
import { isBlockingValidationIssue, type PlanningCommand } from "@kiss-pm/domain";

import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { persistPlanningNotifications } from "../collaborationNotificationService";
import { requireCapabilities } from "../dataSourceCapabilities";
import { readLimitedJsonBody } from "../jsonBody";
import { notifyPlanVersionChanged } from "../planningEventBus";
import { parsePlanningCommand, parsePlanningRevertEnvelope } from "../planningParsers";
import { permissionForCommand } from "./planningCommandPermissions";
import { previewPlanningCommands } from "./planningCommandCore";
import { createPlanningReadModel } from "./planningReadModel";
import { includeResourceExceptionsFor } from "./planningRouteAuth";
import {
  appendPlanningAuditIfConfigured,
  errorResponseBody,
  hashJson,
  parseProjectRouteParam,
  summarizeSnapshot,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import { denyPlanningAction } from "./planningRouteResponders";
import { normalizeTaskCreateStatus } from "./taskCreateNormalization";

const REVERT_ACTION = "planning.commit.reverted";

class PlanningRevertTransactionAbort extends Error {
  readonly result = {
    ok: false as const,
    status: 404 as const,
    error: "project_not_found" as const
  };
}

export function registerPlanningRevertRoute(app: Hono, deps: PlanningRouteDeps) {
  app.post("/api/workspace/projects/:projectId/planning/revert-last", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listAuditEventsByTenantId || !deps.dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const projectId = parsedProjectId.value;
    const profile = await deps.getActorProfile(actor);
    const manageDecision = canManageProjectPlan({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!manageDecision.allowed) {
      return await denyPlanningAction(deps, context, {
        actor,
        projectId,
        actionType: "planning.command_denied",
        decision: manageDecision,
        commandInput: {}
      });
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePlanningRevertEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await deps.runDataSourceTransaction(async (rawStore) => {
      const transactionDataSource = requireCapabilities(rawStore, [
        "appendAuditEvent",
        "applyPlanningCommand",
        "createPlanningCommandIdempotency",
        "findPlanningCommandIdempotency",
        "getPlanSnapshot",
        "incrementPlanVersion",
        "listAuditEventsByTenantId",
        "lockTenantResourcePlanning"
      ]);
      if (!transactionDataSource) {
        return { ok: false as const, status: 501 as const, error: "persistence_not_configured" };
      }

      await transactionDataSource.lockTenantResourcePlanning(actor.tenantId);
      const requestHash = hashJson({
        operation: "planning.revert",
        actorUserId: actor.id,
        targetCommitId: parsed.value.targetCommitId,
        clientPlanVersion: parsed.value.clientPlanVersion
      });
      const existingIdempotency = await transactionDataSource.findPlanningCommandIdempotency(
        actor.tenantId,
        projectId,
        parsed.value.idempotencyKey
      );
      if (existingIdempotency) {
        if (
          existingIdempotency.actorUserId !== actor.id ||
          existingIdempotency.requestHash !== requestHash
        ) {
          return { ok: false as const, status: 409 as const, error: "idempotency_key_conflict" };
        }
        return { ok: true as const, body: existingIdempotency.responsePayload, replayed: true };
      }

      const snapshot = await transactionDataSource.getPlanSnapshot(actor.tenantId, projectId);
      if (!snapshot) {
        return { ok: false as const, status: 404 as const, error: "project_not_found" };
      }
      if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
        await appendPlanningAuditIfConfigured(
          deps,
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "planning.command_conflict",
            sourceWorkflow: "planning",
            sourceEntity: { type: "Project", id: projectId },
            commandInput: {
              targetCommitId: parsed.value.targetCommitId,
              clientPlanVersion: parsed.value.clientPlanVersion
            },
            beforeState: { planVersion: snapshot.planVersion },
            afterState: null,
            permissionResult: manageDecision,
            executionResult: { status: "conflict" }
          },
          transactionDataSource
        );
        return {
          ok: false as const,
          status: 409 as const,
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        };
      }

      const events = await transactionDataSource.listAuditEventsByTenantId(actor.tenantId, {
        projectId
      });
      const target = events.find((event) => event.id === parsed.value.targetCommitId);
      if (!target) {
        return { ok: false as const, status: 404 as const, error: "planning_commit_not_found" };
      }
      if (events.some((event) => isSuccessfulRevertOf(event, parsed.value.targetCommitId))) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "planning_commit_already_reverted"
        };
      }

      const commands = parseCompensatingCommands(target.afterState?.compensatingCommands);
      const targetPlanVersion = target.afterState?.planVersion;
      if (
        target.sourceWorkflow !== "planning" ||
        target.sourceEntity.type !== "Project" ||
        target.sourceEntity.id !== projectId ||
        target.executionResult.status !== "succeeded" ||
        commands === null
      ) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "planning_commit_not_revertible"
        };
      }
      if (targetPlanVersion !== snapshot.planVersion) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "planning_commit_not_current",
          currentPlanVersion: snapshot.planVersion
        };
      }

      for (const command of commands) {
        const decision = permissionForCommand(command, actor, profile);
        if (!decision.allowed) {
          await appendPlanningAuditIfConfigured(
            deps,
            {
              tenantId: actor.tenantId,
              actorUserId: actor.id,
              actionType: "planning.command_denied",
              sourceWorkflow: "planning",
              sourceEntity: { type: "Project", id: projectId },
              commandInput: { targetCommitId: target.id, command },
              beforeState: summarizeSnapshot(snapshot),
              afterState: null,
              permissionResult: decision,
              executionResult: { status: "denied" }
            },
            transactionDataSource
          );
          return { ok: false as const, status: 403 as const, error: decision.reason };
        }
      }

      const normalizedCommands = await Promise.all(
        commands.map((command) =>
          normalizeTaskCreateStatus(transactionDataSource, actor.tenantId, command)
        )
      );
      const preview = await previewPlanningCommands(
        snapshot,
        normalizedCommands,
        transactionDataSource,
        actor.tenantId
      );
      if (preview.validationIssues.some(isBlockingValidationIssue)) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "planning_precondition_failed",
          validationIssues: preview.validationIssues
        };
      }

      for (const command of normalizedCommands) {
        await transactionDataSource.applyPlanningCommand({
          tenantId: actor.tenantId,
          projectId,
          actorUserId: actor.id,
          command
        });
      }
      const newPlanVersion = await transactionDataSource.incrementPlanVersion(
        actor.tenantId,
        projectId
      );
      const auditEventId = await appendPlanningAuditIfConfigured(
        deps,
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: REVERT_ACTION,
          sourceWorkflow: "planning",
          sourceEntity: { type: "Project", id: projectId },
          commandInput: {
            targetCommitId: target.id,
            idempotencyKey: parsed.value.idempotencyKey,
            commands: normalizedCommands
          },
          beforeState: summarizeSnapshot(snapshot),
          afterState: {
            planVersion: newPlanVersion,
            revertedCommitId: target.id,
            changedTaskIds: preview.planDelta.changedTaskIds,
            changedAssignmentIds: preview.planDelta.changedAssignmentIds,
            changedDependencyIds: preview.planDelta.changedDependencyIds,
            compensatingCommands: []
          },
          permissionResult: { allowed: true, reason: "same_tenant_permission_granted" },
          executionResult: { status: "succeeded", validationIssues: preview.validationIssues }
        },
        transactionDataSource
      );
      const appliedSnapshot = await transactionDataSource.getPlanSnapshot(
        actor.tenantId,
        projectId
      );
      if (!appliedSnapshot) {
        throw new PlanningRevertTransactionAbort();
      }
      await persistPlanningNotifications({
        dataSource: transactionDataSource,
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        beforeSnapshot: snapshot,
        afterSnapshot: appliedSnapshot,
        commands: normalizedCommands
      });

      const responseBody = {
        reverted: target.id,
        applied: preview.planDelta,
        newPlanVersion,
        auditEventId,
        readModel: createPlanningReadModel(appliedSnapshot, {
          includeResourceExceptions: includeResourceExceptionsFor({ actor, profile })
        })
      };
      await transactionDataSource.createPlanningCommandIdempotency({
        tenantId: actor.tenantId,
        projectId,
        idempotencyKey: parsed.value.idempotencyKey,
        requestHash,
        responsePayload: responseBody,
        actorUserId: actor.id
      });
      return { ok: true as const, body: responseBody, replayed: false };
    }).catch((error: unknown) => {
      if (error instanceof PlanningRevertTransactionAbort) return error.result;
      throw error;
    });

    if (!result.ok) {
      if (result.status === 403) return context.json({ error: result.error }, 403);
      if (result.status === 404) return context.json({ error: result.error }, 404);
      if (result.status === 409) return context.json(errorResponseBody(result), 409);
      return context.json({ error: result.error }, 501);
    }

    const newPlanVersion = result.body.newPlanVersion;
    if (!result.replayed && typeof newPlanVersion === "number") {
      invalidateCapacityCacheForTenant(actor.tenantId);
      notifyPlanVersionChanged(actor.tenantId, projectId, newPlanVersion);
    }
    return context.json(result.body);
  });
}

function parseCompensatingCommands(value: unknown): PlanningCommand[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const commands: PlanningCommand[] = [];
  for (const item of value) {
    const parsed = parsePlanningCommand(item);
    if (!parsed.ok) return null;
    commands.push(parsed.value);
  }
  return commands;
}

function isSuccessfulRevertOf(
  event: {
    actionType: string;
    input: Record<string, unknown>;
    executionResult: Record<string, unknown>;
  },
  targetCommitId: string
): boolean {
  return (
    event.actionType === REVERT_ACTION &&
    event.input.targetCommitId === targetCommitId &&
    event.executionResult.status === "succeeded"
  );
}
