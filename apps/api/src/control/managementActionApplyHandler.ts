import { randomUUID } from "node:crypto";

import {
  canExecuteManagementActions,
  canReadControlSignals,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type {
  ControlSignal,
  PlanDelta,
  PlanSnapshot,
  TenantUser,
  ValidationIssue
} from "@kiss-pm/domain";
import { isBlockingValidationIssue } from "@kiss-pm/domain";
import type { ActionExecutionRecord } from "@kiss-pm/persistence";

import type { ControlDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import { persistPlanningNotifications } from "../collaborationNotificationService";
import { previewPlanningCommands } from "../planning/planningCommandCore";
import { summarizeSnapshot } from "../planning/planningRouteHelpers";
import { decisionForActionPermissions } from "./managementActionPermissions";

type ManagementActionApplyCommand = {
  clientPlanVersion: number;
};

type ManagementActionApplyBodyReaderResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

type ManagementActionApplyDeps = {
  dataSource: ControlDataPort;
  auditDataSource: ManagementAuditDataSource;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ControlDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type ManagementActionApplyResult =
  | {
      status: 200;
      body: {
        applied: PlanDelta;
        newPlanVersion: number;
        auditEventId: string;
        actionExecution: ActionExecutionRecord;
        appliedSnapshot: PlanSnapshot;
      };
    }
  | { status: 400 | 403 | 404 | 413 | 415 | 501; body: { error: string } }
  | {
      status: 409;
      body:
        | { error: "plan_version_conflict"; currentPlanVersion: number }
        | { error: "planning_precondition_failed"; validationIssues: ValidationIssue[] };
    };

export async function executeApplyManagementAction(input: {
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  signalId: string;
  actionId: string;
  readBody(): Promise<ManagementActionApplyBodyReaderResult>;
  deps: ManagementActionApplyDeps;
}): Promise<ManagementActionApplyResult> {
  if (
    !input.deps.dataSource.listControlSignals ||
    !input.deps.dataSource.createActionExecution ||
    !input.deps.dataSource.appendAuditEvent
  ) {
    return { status: 501, body: { error: "persistence_not_configured" } };
  }

  const executeDecision = canExecuteManagementActions({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!executeDecision.allowed) {
    await appendManagementActionDeniedAudit({
      ...input,
      permissionResult: executeDecision
    });
    return { status: 403, body: { error: executeDecision.reason } };
  }

  const controlReadDecision = canReadControlSignals({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!controlReadDecision.allowed) {
    await appendManagementActionDeniedAudit({
      ...input,
      permissionResult: controlReadDecision
    });
    return { status: 403, body: { error: controlReadDecision.reason } };
  }

  const body = await input.readBody();
  if (!body.ok) return { status: body.status, body: { error: body.error } };
  const parsed = parseActionApplyBody(body.value);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  const signal = (await input.deps.dataSource.listControlSignals(input.actor.tenantId, input.projectId)).find(
    (candidate) => candidate.id === input.signalId
  );
  const action = signal?.scenarioProposals.find((candidate) => candidate.id === input.actionId);
  if (!signal || !action) return { status: 404, body: { error: "action_candidate_not_found" } };
  if (!action.planDelta || action.planDelta.commands.length === 0) {
    return { status: 400, body: { error: "action_candidate_has_no_plan_delta" } };
  }

  const requiredDecision = decisionForActionPermissions(action, input.actor, input.profile);
  if (!requiredDecision.allowed) {
    const deniedResult = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.appendAuditEvent || !transactionDataSource.createActionExecution) {
        return { ok: false as const, status: 501, error: "persistence_not_configured" };
      }
      const auditEventId = await appendControlAudit({
        deps: input.deps,
        actor: input.actor,
        actionType: "management_action.denied",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: {
          actionId: input.actionId,
          requiredPermissions: action.requiredPermissions
        },
        beforeState: { signal },
        afterState: null,
        permissionResult: requiredDecision,
        executionResult: { status: "denied" },
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
        previewPayload: { action },
        resultPayload: { error: requiredDecision.reason },
        status: "denied",
        auditEventId
      });
      return { ok: true as const };
    });
    if (!deniedResult.ok) return { status: 501, body: { error: deniedResult.error } };
    return { status: 403, body: { error: requiredDecision.reason } };
  }

  const result = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.listControlSignals ||
      !transactionDataSource.getPlanSnapshot ||
      !transactionDataSource.applyPlanningCommand ||
      !transactionDataSource.incrementPlanVersion ||
      !transactionDataSource.appendAuditEvent ||
      !transactionDataSource.createActionExecution
    ) {
      return { ok: false as const, status: 501, error: "persistence_not_configured" };
    }

    await transactionDataSource.lockTenantResourcePlanning?.(input.actor.tenantId);
    const lockedSignal = (
      await transactionDataSource.listControlSignals(input.actor.tenantId, input.projectId)
    ).find((candidate) => candidate.id === input.signalId);
    const lockedAction = lockedSignal?.scenarioProposals.find(
      (candidate) => candidate.id === input.actionId
    );
    if (!lockedSignal || !lockedAction?.planDelta) {
      return { ok: false as const, status: 404, error: "action_candidate_not_found" };
    }
    if (lockedAction.planDelta.commands.length === 0) {
      return { ok: false as const, status: 400, error: "action_candidate_has_no_plan_delta" };
    }

    const lockedDecision = decisionForActionPermissions(lockedAction, input.actor, input.profile);
    if (!lockedDecision.allowed) {
      const auditEventId = await appendControlAudit({
        deps: input.deps,
        actor: input.actor,
        actionType: "management_action.denied",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: {
          actionId: input.actionId,
          requiredPermissions: lockedAction.requiredPermissions
        },
        beforeState: { signal: lockedSignal },
        afterState: null,
        permissionResult: lockedDecision,
        executionResult: { status: "denied" },
        auditDataSource: transactionDataSource
      });
      await transactionDataSource.createActionExecution({
        id: `action-exec-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        projectId: input.projectId,
        actionType: lockedAction.type,
        targetEntity: lockedAction.targetEntity,
        actorUserId: input.actor.id,
        input: lockedAction.input,
        previewPayload: { action: lockedAction },
        resultPayload: { error: lockedDecision.reason },
        status: "denied",
        auditEventId
      });
      return { ok: false as const, status: 403, error: lockedDecision.reason };
    }

    const snapshot = await transactionDataSource.getPlanSnapshot(input.actor.tenantId, input.projectId);
    if (!snapshot) return { ok: false as const, status: 404, error: "project_not_found" };
    if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
      const auditEventId = await appendControlAudit({
        deps: input.deps,
        actor: input.actor,
        actionType: "management_action.conflict",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: {
          actionId: input.actionId,
          clientPlanVersion: parsed.value.clientPlanVersion
        },
        beforeState: { planVersion: snapshot.planVersion },
        afterState: null,
        permissionResult: lockedDecision,
        executionResult: { status: "conflict" },
        auditDataSource: transactionDataSource
      });
      await transactionDataSource.createActionExecution({
        id: `action-exec-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        projectId: input.projectId,
        actionType: lockedAction.type,
        targetEntity: lockedAction.targetEntity,
        actorUserId: input.actor.id,
        input: lockedAction.input,
        previewPayload: { action: lockedAction },
        resultPayload: {
          error: "plan_version_conflict",
          currentPlanVersion: snapshot.planVersion
        },
        status: "failed",
        auditEventId
      });
      return {
        ok: false as const,
        status: 409,
        error: "plan_version_conflict",
        currentPlanVersion: snapshot.planVersion
      };
    }

    const preview = await previewPlanningCommands(
      snapshot,
      lockedAction.planDelta.commands,
      transactionDataSource,
      input.actor.tenantId
    );
    if (preview.validationIssues.some(isBlockingValidationIssue)) {
      const auditEventId = await appendControlAudit({
        deps: input.deps,
        actor: input.actor,
        actionType: "management_action.precondition_failed",
        sourceEntity: { type: "ControlSignal", id: input.signalId },
        commandInput: {
          actionId: input.actionId,
          commands: lockedAction.planDelta.commands
        },
        beforeState: summarizeSnapshot(snapshot),
        afterState: null,
        permissionResult: lockedDecision,
        executionResult: {
          status: "failed",
          validationIssues: preview.validationIssues
        },
        auditDataSource: transactionDataSource
      });
      await transactionDataSource.createActionExecution({
        id: `action-exec-${randomUUID()}`,
        tenantId: input.actor.tenantId,
        projectId: input.projectId,
        actionType: lockedAction.type,
        targetEntity: lockedAction.targetEntity,
        actorUserId: input.actor.id,
        input: lockedAction.input,
        previewPayload: { action: lockedAction },
        resultPayload: { validationIssues: preview.validationIssues },
        status: "failed",
        auditEventId
      });
      return {
        ok: false as const,
        status: 409,
        error: "planning_precondition_failed",
        validationIssues: preview.validationIssues
      };
    }

    for (const command of lockedAction.planDelta.commands) {
      await transactionDataSource.applyPlanningCommand({
        tenantId: input.actor.tenantId,
        projectId: input.projectId,
        actorUserId: input.actor.id,
        command
      });
    }
    const newPlanVersion = await transactionDataSource.incrementPlanVersion(
      input.actor.tenantId,
      input.projectId
    );
    const auditEventId = await appendControlAudit({
      deps: input.deps,
      actor: input.actor,
      actionType: "management_action.applied",
      sourceEntity: { type: "ControlSignal", id: input.signalId },
      commandInput: {
        action: lockedAction,
        clientPlanVersion: parsed.value.clientPlanVersion
      },
      beforeState: summarizeSnapshot(snapshot),
      afterState: {
        planVersion: newPlanVersion,
        changedTaskIds: preview.planDelta.changedTaskIds,
        changedAssignmentIds: preview.planDelta.changedAssignmentIds,
        changedDependencyIds: preview.planDelta.changedDependencyIds
      },
      permissionResult: lockedDecision,
      executionResult: {
        status: "succeeded",
        validationIssues: preview.validationIssues
      },
      auditDataSource: transactionDataSource
    });
    const execution = await transactionDataSource.createActionExecution({
      id: `action-exec-${randomUUID()}`,
      tenantId: input.actor.tenantId,
      projectId: input.projectId,
      actionType: lockedAction.type,
      targetEntity: lockedAction.targetEntity,
      actorUserId: input.actor.id,
      input: lockedAction.input,
      previewPayload: {
        action: lockedAction,
        validationIssues: preview.validationIssues
      },
      resultPayload: { planDelta: preview.planDelta, newPlanVersion },
      status: "succeeded",
      auditEventId
    });
    const appliedSnapshot = await transactionDataSource.getPlanSnapshot(
      input.actor.tenantId,
      input.projectId
    );
    if (!appliedSnapshot) return { ok: false as const, status: 404, error: "project_not_found" };
    await persistPlanningNotifications({
      dataSource: transactionDataSource,
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      beforeSnapshot: snapshot,
      afterSnapshot: appliedSnapshot,
      commands: lockedAction.planDelta.commands
    });

    return {
      ok: true as const,
      body: {
        applied: preview.planDelta,
        newPlanVersion,
        auditEventId,
        actionExecution: execution,
        appliedSnapshot
      }
    };
  });

  if (!result.ok) {
    if (
      result.status === 409 &&
      result.error === "plan_version_conflict" &&
      "currentPlanVersion" in result
    ) {
      return {
        status: 409,
        body: {
          error: "plan_version_conflict",
          currentPlanVersion: result.currentPlanVersion
        }
      };
    }
    if (
      result.status === 409 &&
      result.error === "planning_precondition_failed" &&
      "validationIssues" in result
    ) {
      return {
        status: 409,
        body: {
          error: "planning_precondition_failed",
          validationIssues: result.validationIssues
        }
      };
    }
    if (result.status === 501) return { status: 501, body: { error: result.error } };
    if (result.status === 404) return { status: 404, body: { error: result.error } };
    if (result.status === 403) return { status: 403, body: { error: result.error } };
    return { status: 400, body: { error: result.error } };
  }

  return { status: 200, body: result.body };
}

async function appendManagementActionDeniedAudit(input: {
  actor: TenantUser;
  projectId: string;
  signalId: string;
  actionId: string;
  permissionResult: PolicyDecision;
  deps: ManagementActionApplyDeps;
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
    executionResult: { status: "denied", stage: "apply" },
    auditDataSource: input.deps.auditDataSource
  });
}

async function appendControlAudit(input: {
  deps: ManagementActionApplyDeps;
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

function parseActionApplyBody(
  input: unknown
): { ok: true; value: ManagementActionApplyCommand } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "management_action_input_invalid" };
  const clientPlanVersion = integerField(input, "clientPlanVersion");
  if (clientPlanVersion === null || clientPlanVersion < 1) {
    return { ok: false, error: "management_action_input_invalid" };
  }
  return { ok: true, value: { clientPlanVersion } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function integerField(input: Record<string, unknown>, field: string): number | null {
  const value = input[field];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
