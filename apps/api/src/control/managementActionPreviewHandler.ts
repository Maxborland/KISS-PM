import { randomUUID } from "node:crypto";

import {
  canExecuteManagementActions,
  canReadControlSignals,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { ManagementActionCandidate, TenantUser } from "@kiss-pm/domain";
import type { ActionExecutionRecord } from "@kiss-pm/persistence";

import type { ControlDataPort, TransactionDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import { decisionForActionPermissions } from "./managementActionPermissions";

type ManagementActionPreviewDeps = {
  dataSource: ControlDataPort & Partial<TransactionDataPort>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ControlDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type ManagementActionPreviewResult =
  | {
      status: 200;
      body: {
        action: ManagementActionCandidate;
        execution: ActionExecutionRecord;
        auditEventId: string;
      };
    }
  | { status: 403 | 404 | 501; body: { error: string } };

export async function executePreviewManagementAction(input: {
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  signalId: string;
  actionId: string;
  deps: ManagementActionPreviewDeps;
}): Promise<ManagementActionPreviewResult> {
  if (
    !input.deps.dataSource.listControlSignals ||
    !input.deps.dataSource.createActionExecution ||
    !input.deps.dataSource.appendAuditEvent ||
    !input.deps.dataSource.withTransaction
  ) {
    return { status: 501, body: { error: "persistence_not_configured" } };
  }

  const executeDecision = canExecuteManagementActions({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!executeDecision.allowed) {
    await appendManagementActionDeniedAudit({ ...input, permissionResult: executeDecision });
    return { status: 403, body: { error: executeDecision.reason } };
  }

  const controlReadDecision = canReadControlSignals({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!controlReadDecision.allowed) {
    await appendManagementActionDeniedAudit({ ...input, permissionResult: controlReadDecision });
    return { status: 403, body: { error: controlReadDecision.reason } };
  }

  const result = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listControlSignals ||
      !transactionDataSource.createActionExecution ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { status: 501 as const, body: { error: "persistence_not_configured" } };
    }

    const signal = (await transactionDataSource.listControlSignals(input.actor.tenantId, input.projectId)).find(
      (candidate) => candidate.id === input.signalId
    );
    const action = signal?.scenarioProposals.find((candidate) => candidate.id === input.actionId);
    if (!signal || !action) return { status: 404 as const, body: { error: "action_candidate_not_found" } };

    const requiredDecision = decisionForActionPermissions(action, input.actor, input.profile);
    if (!requiredDecision.allowed) {
      const auditEventId = await appendControlAudit({
        deps: input.deps,
        actor: input.actor,
        actionType: "management_action.denied",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: { actionId: input.actionId, requiredPermissions: action.requiredPermissions },
        beforeState: { signal },
        afterState: null,
        permissionResult: requiredDecision,
        executionResult: { status: "denied", stage: "preview" },
        auditDataSource: transactionDataSource
      });
      await transactionDataSource.createActionExecution({
        id: `action-exec-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        projectId: input.projectId,
        actionType: action.type,
        targetEntity: action.targetEntity,
        actorUserId: input.actor.id,
        input: action.input,
        previewPayload: null,
        resultPayload: { error: requiredDecision.reason },
        status: "denied",
        auditEventId
      });
      return { status: 403 as const, body: { error: requiredDecision.reason } };
    }

    const executionId = `action-exec-${randomUUID()}`;
    const auditEventId = await appendControlAudit({
      deps: input.deps,
      actor: input.actor,
      actionType: "management_action.previewed",
      sourceEntity: { type: "ControlSignal", id: input.signalId },
      commandInput: { actionId: input.actionId },
      beforeState: { signal },
      afterState: { action, executionId },
      permissionResult: executeDecision,
      executionResult: { status: "previewed" },
      auditDataSource: transactionDataSource
    });
    const execution = await transactionDataSource.createActionExecution({
      id: executionId,
      tenantId: input.actor.tenantId,
      projectId: input.projectId,
      actionType: action.type,
      targetEntity: action.targetEntity,
      actorUserId: input.actor.id,
      input: action.input,
      previewPayload: { action },
      resultPayload: null,
      status: "previewed",
      auditEventId
    });
    return { status: 200 as const, body: { action, execution, auditEventId } };
  });

  return result;
}

async function appendManagementActionDeniedAudit(input: {
  actor: TenantUser;
  projectId: string;
  signalId: string;
  actionId: string;
  permissionResult: PolicyDecision;
  deps: ManagementActionPreviewDeps;
}): Promise<string> {
  return appendControlAudit({
    deps: input.deps,
    actor: input.actor,
    actionType: "management_action.denied",
    sourceEntity: { type: "ControlSignal", id: input.signalId },
    commandInput: {
      projectId: input.projectId,
      signalId: input.signalId,
      actionId: input.actionId
    },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: { status: "denied", stage: "preview" },
    auditDataSource: input.deps.dataSource
  });
}

async function appendControlAudit(input: {
  deps: ManagementActionPreviewDeps;
  actor: TenantUser;
  actionType: string;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: PolicyDecision;
  executionResult: Record<string, unknown>;
  auditDataSource: ManagementAuditDataSource;
}): Promise<string> {
  if (!input.auditDataSource.appendAuditEvent) throw new Error("audit_not_configured");
  return input.deps.appendManagementAuditEvent(
    {
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
    },
    input.auditDataSource
  );
}
