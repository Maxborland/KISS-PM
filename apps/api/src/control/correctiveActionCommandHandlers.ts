import { randomUUID } from "node:crypto";

import {
  canManageCorrectiveActions,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { ControlSignal, CorrectiveAction, TenantUser } from "@kiss-pm/domain";
import type { ActionExecutionRecord } from "@kiss-pm/persistence";

import type { ControlDataPort, TransactionDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";

type CorrectiveActionCommandDeps = {
  dataSource: ControlDataPort & Partial<TransactionDataPort>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ControlDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type CreateCorrectiveActionResult =
  | {
      ok: true;
      correctiveAction: CorrectiveAction;
      actionExecution: ActionExecutionRecord | null;
      auditEventId: string;
    }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string };

type UpdateCorrectiveActionResult =
  | {
      ok: true;
      correctiveAction: CorrectiveAction;
      auditEventId: string;
    }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string };

export async function executeCreateCorrectiveAction(input: {
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  signalId: string;
  body: unknown;
  deps: CorrectiveActionCommandDeps;
}): Promise<CreateCorrectiveActionResult> {
  if (
    !input.deps.dataSource.listControlSignals ||
    !input.deps.dataSource.createCorrectiveAction ||
    !input.deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageCorrectiveActions({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };

  const parsed = parseCorrectiveActionBody(
    input.body,
    input.actor.tenantId,
    input.projectId,
    input.signalId
  );
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (!input.deps.dataSource.withTransaction) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  return input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listControlSignals ||
      !transactionDataSource.createCorrectiveAction ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }

    const signal = (await transactionDataSource.listControlSignals(input.actor.tenantId, input.projectId)).find(
      (candidate) => candidate.id === input.signalId
    );
    if (!signal) return { ok: false as const, status: 404, error: "control_signal_not_found" };

    const correctiveAction = await transactionDataSource.createCorrectiveAction(parsed.value);
    const auditEventId = await input.deps.appendManagementAuditEvent(
      correctiveActionAuditInput({
        actor: input.actor,
        actionType: "corrective_action.created",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: { correctiveAction },
        beforeState: { signal },
        afterState: { correctiveAction },
        permissionResult: decision,
        executionResult: { status: "succeeded" }
      }),
      transactionDataSource
    );
    const execution = await transactionDataSource.createActionExecution?.({
      id: `action-exec-${randomUUID()}`,
      tenantId: input.actor.tenantId,
      projectId: input.projectId,
      actionType: "create_corrective_action",
      targetEntity: { type: "ControlSignal", id: input.signalId },
      actorUserId: input.actor.id,
      input: { correctiveAction },
      previewPayload: null,
      resultPayload: { correctiveAction },
      status: "succeeded",
      auditEventId
    });
    return { ok: true as const, correctiveAction, actionExecution: execution ?? null, auditEventId };
  });
}

export async function executeUpdateCorrectiveAction(input: {
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  correctiveActionId: string;
  body: unknown;
  deps: CorrectiveActionCommandDeps;
}): Promise<UpdateCorrectiveActionResult> {
  if (
    !input.deps.dataSource.listCorrectiveActions ||
    !input.deps.dataSource.updateCorrectiveAction ||
    !input.deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const decision = canManageCorrectiveActions({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) return { ok: false, status: 403, error: decision.reason };
  if (!input.deps.dataSource.withTransaction) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  return input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listCorrectiveActions ||
      !transactionDataSource.updateCorrectiveAction ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }

    const existing = (await transactionDataSource.listCorrectiveActions(input.actor.tenantId, input.projectId)).find(
      (candidate) => candidate.id === input.correctiveActionId
    );
    if (!existing) return { ok: false as const, status: 404, error: "corrective_action_not_found" };

    const parsed = parseCorrectiveActionPatchBody(input.body, existing);
    if (!parsed.ok) return { ok: false as const, status: 400, error: parsed.error };

    const correctiveAction = await transactionDataSource.updateCorrectiveAction(parsed.value);
    const auditEventId = await input.deps.appendManagementAuditEvent(
      correctiveActionAuditInput({
        actor: input.actor,
        actionType: "corrective_action.updated",
        sourceEntity: { type: "CorrectiveAction", id: correctiveAction.id },
        commandInput: { correctiveAction },
        beforeState: { correctiveAction: existing },
        afterState: { correctiveAction },
        permissionResult: decision,
        executionResult: { status: "succeeded" }
      }),
      transactionDataSource
    );
    return { ok: true as const, correctiveAction, auditEventId };
  });
}

function correctiveActionAuditInput(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  beforeState: { signal: ControlSignal } | { correctiveAction: CorrectiveAction } | null;
  afterState: { correctiveAction: CorrectiveAction } | null;
  permissionResult: PolicyDecision;
  executionResult: Record<string, unknown>;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "control",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: input.beforeState,
    afterState: input.afterState,
    permissionResult: input.permissionResult,
    executionResult: input.executionResult
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

function isValidCorrectiveActionStatus(value: string): value is CorrectiveAction["status"] {
  return ["open", "in_progress", "done", "cancelled"].includes(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function nullableStringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  if (value === null) return null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
