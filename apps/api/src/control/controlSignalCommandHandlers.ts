import {
  canManageControlSignals,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type {
  ControlSignal,
  ControlSignalStatus,
  TenantUser
} from "@kiss-pm/domain";

import type { ControlSignalCommandDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";

type ControlSignalStatusCommand = {
  status: ControlSignalStatus;
  acceptedRiskReason?: string;
};

type ControlSignalStatusDeps = {
  auditDataSource: ManagementAuditDataSource;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ControlSignalCommandDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type ControlSignalStatusResult =
  | { ok: true; signal: ControlSignal; auditEventId: string }
  | { ok: false; status: 400 | 403 | 404 | 501; error: string };

export async function executeUpdateControlSignalStatus(input: {
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  signalId: string;
  body: unknown;
  deps: ControlSignalStatusDeps;
}): Promise<ControlSignalStatusResult> {
  const parsed = parseSignalStatusBody(input.body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const decision = canManageControlSignals({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) {
    await appendControlSignalDeniedAudit({
      actor: input.actor,
      projectId: input.projectId,
      signalId: input.signalId,
      commandInput: parsed.value,
      permissionResult: decision,
      deps: input.deps
    });
    return { ok: false, status: 403, error: decision.reason };
  }

  return input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listControlSignals ||
      !transactionDataSource.upsertControlSignal ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }
    const signal = (await transactionDataSource.listControlSignals(input.actor.tenantId, input.projectId)).find(
      (candidate) => candidate.id === input.signalId
    );
    if (!signal) return { ok: false as const, status: 404, error: "control_signal_not_found" };

    const updated = await transactionDataSource.upsertControlSignal({
      ...signal,
      status: parsed.value.status,
      updatedAt: new Date().toISOString()
    });
    const auditEventId = await input.deps.appendManagementAuditEvent(
      controlSignalAuditInput({
        actor: input.actor,
        actionType:
          parsed.value.status === "accepted_risk"
            ? "control_signal.risk_accepted"
            : "control_signal.status_changed",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: parsed.value,
        beforeState: { signal },
        afterState: { signal: updated },
        permissionResult: decision,
        executionResult: { status: "succeeded" }
      }),
      transactionDataSource
    );
    return { ok: true as const, signal: updated, auditEventId };
  });
}

async function appendControlSignalDeniedAudit(input: {
  actor: TenantUser;
  projectId: string;
  signalId: string;
  commandInput: ControlSignalStatusCommand;
  permissionResult: PolicyDecision;
  deps: ControlSignalStatusDeps;
}) {
  await input.deps.appendManagementAuditEvent(
    {
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: "control_signal.status_change_denied",
      sourceWorkflow: "control",
      sourceEntity: { type: "ControlSignal", id: input.signalId },
      commandInput: {
        projectId: input.projectId,
        signalId: input.signalId,
        ...input.commandInput
      },
      beforeState: null,
      afterState: null,
      permissionResult: input.permissionResult,
      executionResult: {
        status: "denied",
        error: input.permissionResult.reason
      }
    },
    input.deps.auditDataSource
  );
}

function controlSignalAuditInput(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
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

function parseSignalStatusBody(input: unknown): { ok: true; value: ControlSignalStatusCommand } | { ok: false; error: string } {
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
  const acceptedRiskReason = stringField(input, "acceptedRiskReason");
  if (status === "accepted_risk" && !acceptedRiskReason) {
    return { ok: false, error: "accepted_risk_reason_required" };
  }
  return {
    ok: true,
    value: acceptedRiskReason ? { status, acceptedRiskReason } : { status }
  };
}

function isObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function stringField(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
