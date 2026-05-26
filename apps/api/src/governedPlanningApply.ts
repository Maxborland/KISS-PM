import {
  isBlockingValidationIssue,
  type PlanningCommand,
  type PlanSnapshot,
  type ValidationIssue
} from "@kiss-pm/domain";
import type { PolicyDecision } from "@kiss-pm/access-control";

import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "./apiTypes";

type PlanningApplyDataSource = {
  applyPlanningCommand(input: {
    tenantId: string;
    projectId: string;
    actorUserId: string;
    command: PlanningCommand;
  }): Promise<void>;
  getPlanSnapshot(tenantId: string, projectId: string): Promise<PlanSnapshot | undefined>;
  incrementPlanVersion(tenantId: string, projectId: string): Promise<number>;
};

type PlanningCommandPreview = {
  nextSnapshot: PlanSnapshot;
  validationIssues: ValidationIssue[];
  planDelta: {
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    changedDependencyIds: string[];
    acceptedRiskIds: string[];
  };
};

export type GovernedPlanningApplyResult =
  | {
      ok: true;
      body: {
        newPlanVersion: number;
        auditEventId: string;
        readModel: unknown;
        preview: PlanningCommandPreview;
      };
    }
  | {
      ok: false;
      status: 404 | 409;
      error: "project_not_found" | "planning_precondition_failed";
      validationIssues?: ValidationIssue[];
    };

export async function applyGovernedPlanningDelta(input: {
  dataSource: PlanningApplyDataSource;
  tenantId: string;
  projectId: string;
  actorUserId: string;
  snapshot: PlanSnapshot;
  commands: PlanningCommand[];
  permissionResult: PolicyDecision;
  previewCommand(snapshot: PlanSnapshot, command: PlanningCommand): PlanningCommandPreview;
  validateCommandPreconditions(command: PlanningCommand): Promise<ValidationIssue[]>;
  appendAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
  auditDataSource?: ManagementAuditDataSource;
  buildAuditInput(input: {
    newPlanVersion: number;
    validationIssues: ValidationIssue[];
    preview: PlanningCommandPreview;
  }): ManagementAuditEventInput;
  afterCommandsApplied?(input: {
    newPlanVersion: number;
    validationIssues: ValidationIssue[];
    preview: PlanningCommandPreview;
  }): Promise<void>;
  createReadModel(snapshot: PlanSnapshot): unknown;
}): Promise<GovernedPlanningApplyResult> {
  let preview: PlanningCommandPreview = {
    nextSnapshot: input.snapshot,
    validationIssues: [],
    planDelta: {
      changedTaskIds: [],
      changedAssignmentIds: [],
      changedDependencyIds: [],
      acceptedRiskIds: []
    }
  };

  for (const command of input.commands) {
    const next = input.previewCommand(preview.nextSnapshot, command);
    preview = {
      nextSnapshot: next.nextSnapshot,
      planDelta: mergePlanDeltas(preview.planDelta, next.planDelta),
      validationIssues: [
        ...preview.validationIssues,
        ...next.validationIssues,
        ...(await input.validateCommandPreconditions(command))
      ]
    };
  }

  if (preview.validationIssues.some(isBlockingValidationIssue)) {
    return {
      ok: false,
      status: 409,
      error: "planning_precondition_failed",
      validationIssues: preview.validationIssues
    };
  }

  for (const command of input.commands) {
    await input.dataSource.applyPlanningCommand({
      tenantId: input.tenantId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      command
    });
  }

  const newPlanVersion = await input.dataSource.incrementPlanVersion(input.tenantId, input.projectId);
  await input.afterCommandsApplied?.({
    newPlanVersion,
    validationIssues: preview.validationIssues,
    preview
  });
  const auditEventId = await input.appendAuditEvent(
    input.buildAuditInput({
      newPlanVersion,
      validationIssues: preview.validationIssues,
      preview
    }),
    input.auditDataSource
  );
  const appliedSnapshot = await input.dataSource.getPlanSnapshot(input.tenantId, input.projectId);
  if (!appliedSnapshot) return { ok: false, status: 404, error: "project_not_found" };

  return {
    ok: true,
    body: {
      newPlanVersion,
      auditEventId,
      readModel: input.createReadModel(appliedSnapshot),
      preview
    }
  };
}

function mergePlanDeltas(
  left: PlanningCommandPreview["planDelta"],
  right: PlanningCommandPreview["planDelta"]
): PlanningCommandPreview["planDelta"] {
  return {
    changedTaskIds: unique([...left.changedTaskIds, ...right.changedTaskIds]),
    changedAssignmentIds: unique([...left.changedAssignmentIds, ...right.changedAssignmentIds]),
    changedDependencyIds: unique([...left.changedDependencyIds, ...right.changedDependencyIds]),
    acceptedRiskIds: unique([...left.acceptedRiskIds, ...right.acceptedRiskIds])
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
