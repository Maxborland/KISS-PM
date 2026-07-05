import type { AccessProfile } from "@kiss-pm/access-control";
import {
  buildCompensatingCommands,
  isBlockingValidationIssue,
  type PlanningCommand,
  type TenantUser,
  type ValidationIssue
} from "@kiss-pm/domain";

import type { PlanningCommandDataPort } from "../apiDataPorts";
import type { ManagementAuditDataSource, ManagementAuditEventInput } from "../apiTypes";
import { persistPlanningNotifications } from "../collaborationNotificationService";
import { previewPlanningCommand } from "./planningCommandCore";
import { permissionForCommand } from "./planningCommandPermissions";
import { createPlanningReadModel } from "./planningReadModel";
import { canReadPlanningReadModel, includeResourceExceptionsFor } from "./planningRouteAuth";
import {
  auditActionForCommand,
  hashJson,
  summarizeSnapshot,
  validateCommandDataSourcePreconditions
} from "./planningRouteHelpers";
import { normalizeTaskCreateStatus } from "./taskCreateNormalization";

export type ApplyPlanningCommandEnvelope = {
  command: PlanningCommand;
  clientPlanVersion: number;
  idempotencyKey?: string;
};

type ApplyPlanningCommandResponseBody = Record<string, unknown>;

export type ApplyPlanningCommandResult =
  | { ok: true; body: ApplyPlanningCommandResponseBody }
  | {
      ok: false;
      status: 403 | 404 | 409 | 501;
      error: string;
      currentPlanVersion?: number;
      validationIssues?: ValidationIssue[];
    };

export type ApplyPlanningCommandDeps = {
  auditDataSource: ManagementAuditDataSource;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: PlanningCommandDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

export async function executeApplyPlanningCommand(input: {
  deps: ApplyPlanningCommandDeps;
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  envelope: ApplyPlanningCommandEnvelope;
}): Promise<ApplyPlanningCommandResult> {
  const { actor, deps, envelope, profile, projectId } = input;
  if (!deps.auditDataSource.appendAuditEvent) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = permissionForCommand(envelope.command, actor, profile);
  if (!decision.allowed) {
    await appendPlanningAudit(deps, {
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "planning.command_denied",
      sourceWorkflow: "planning",
      sourceEntity: { type: "Project", id: projectId },
      commandInput: { command: envelope.command },
      beforeState: null,
      afterState: null,
      permissionResult: decision,
      executionResult: { status: "denied" }
    });
    return { ok: false, status: 403, error: decision.reason };
  }

  const readDecision = canReadPlanningReadModel({ actor, profile });
  if (!readDecision.allowed) {
    await appendPlanningAudit(deps, {
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "planning.command_denied",
      sourceWorkflow: "planning",
      sourceEntity: { type: "Project", id: projectId },
      commandInput: { command: envelope.command },
      beforeState: null,
      afterState: null,
      permissionResult: readDecision,
      executionResult: { status: "denied" }
    });
    return { ok: false, status: 403, error: readDecision.reason };
  }

  return deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.getPlanSnapshot ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.incrementPlanVersion ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }
    if (
      envelope.idempotencyKey &&
      (!transactionDataSource.findPlanningCommandIdempotency ||
        !transactionDataSource.createPlanningCommandIdempotency)
    ) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }

    await transactionDataSource.lockTenantResourcePlanning?.(actor.tenantId);
    const idempotencyKey = envelope.idempotencyKey;
    const requestHash = idempotencyKey
      ? hashJson({
          actorUserId: actor.id,
          clientPlanVersion: envelope.clientPlanVersion,
          command: envelope.command
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
    // Новая задача стартует в начальном статусе тенанта — клиентский statusId для
    // task.create нормализуем (BUG-PROJ-01: UI слал несуществующий "todo").
    const command = await normalizeTaskCreateStatus(
      transactionDataSource,
      actor.tenantId,
      envelope.command
    );
    if (snapshot.planVersion !== envelope.clientPlanVersion) {
      await appendPlanningAudit(deps, {
        tenantId: actor.tenantId,
        actorUserId: actor.id,
        actionType: "planning.command_conflict",
        sourceWorkflow: "planning",
        sourceEntity: { type: "Project", id: projectId },
        commandInput: { command: envelope.command, clientPlanVersion: envelope.clientPlanVersion },
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

    const preview = previewPlanningCommand(snapshot, command);
    const validationIssues = [
      ...preview.validationIssues,
      ...(await validateCommandDataSourcePreconditions(
        transactionDataSource,
        actor.tenantId,
        command
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
      command
    });
    const newPlanVersion = await transactionDataSource.incrementPlanVersion(actor.tenantId, projectId);
    const auditEventId = await appendPlanningAudit(deps, {
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: auditActionForCommand(command),
      sourceWorkflow: "planning",
      sourceEntity: { type: "Project", id: projectId },
      commandInput: { command, idempotencyKey: envelope.idempotencyKey ?? null },
      beforeState: summarizeSnapshot(snapshot),
      afterState: {
        planVersion: newPlanVersion,
        changedTaskIds: preview.planDelta.changedTaskIds,
        changedAssignmentIds: preview.planDelta.changedAssignmentIds,
        changedDependencyIds: preview.planDelta.changedDependencyIds,
        // BUG-PROJ-24: компенсирующие команды (инверсия по снапшоту «до») — их
        // проигрывает revert-эндпоинт; [] = коммит необратим.
        compensatingCommands: buildCompensatingCommands(command, snapshot)
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
      commands: [command]
    });
    const responseBody = {
      applied: preview.planDelta,
      newPlanVersion,
      auditEventId,
      readModel: createPlanningReadModel(appliedSnapshot, {
        includeResourceExceptions: includeResourceExceptionsFor({ actor, profile })
      })
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
}

async function appendPlanningAudit(
  deps: ApplyPlanningCommandDeps,
  input: ManagementAuditEventInput,
  auditDataSource: ManagementAuditDataSource = deps.auditDataSource
): Promise<string> {
  if (!auditDataSource.appendAuditEvent) {
    throw new Error("audit_not_configured");
  }
  return deps.appendManagementAuditEvent(input, auditDataSource);
}