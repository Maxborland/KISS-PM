import type { ActorContext, TenantId, TenantOwned } from "@kiss-pm/domain-core";
import { createProjectDraftFromOpportunity } from "@kiss-pm/project-core";
import type {
  ProjectDraft,
  ProjectDraftDemandSnapshot,
  ProjectDraftFeasibilitySnapshot,
  ProjectDraftSourceOpportunity,
  ProjectDraftTemplateSnapshot
} from "@kiss-pm/project-core";

export const packageName = "@kiss-pm/action-engine";

export type ActionExecutionStatus = "succeeded" | "failed" | "denied";

export type ActionEntityRef = {
  entityType: string;
  entityId: string;
};

export type ActionExecutionLog = TenantOwned & {
  id: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: ActionExecutionStatus;
  source: ActionEntityRef;
  target?: ActionEntityRef;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  trace: string[];
};

export type ProjectDraftReadinessSnapshot = {
  ready: boolean;
  nextAction: string;
  trace: string[];
};

export type CreateProjectDraftFromOpportunityCommandInput = {
  actor: ActorContext;
  requiredPermission: "project_draft.create";
  now: string;
  readiness: ProjectDraftReadinessSnapshot;
  sourceOpportunity: ProjectDraftSourceOpportunity;
  processTemplate: ProjectDraftTemplateSnapshot;
  demand: ProjectDraftDemandSnapshot;
  feasibility: ProjectDraftFeasibilitySnapshot;
  existingDraft?: ProjectDraft;
};

export type CreateProjectDraftFromOpportunityCommandResult = {
  projectDraft: ProjectDraft;
  actionExecution: ActionExecutionLog;
};

export class ActionEngineModelError extends Error {
  constructor(
    readonly code: "validation_error" | "tenant_mismatch" | "conflict" | "precondition_failed",
    message: string
  ) {
    super(message);
    this.name = "ActionEngineModelError";
  }
}

function requireNonEmptyString(value: string | undefined, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ActionEngineModelError("validation_error", `${fieldName} is required`);
  }

  return value;
}

function requireValidTimestamp(value: string | undefined, fieldName: string): string {
  const timestamp = requireNonEmptyString(value, fieldName);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be a valid timestamp`);
  }

  return timestamp;
}

function requireObject<T extends object>(value: T | undefined, fieldName: string): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be an object`);
  }

  return value;
}

function requireStringArray(value: string[] | undefined, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ActionEngineModelError("validation_error", `${fieldName} must be an array`);
  }

  return value.map((entry) => requireNonEmptyString(entry, `${fieldName}[]`));
}

function assertTenant(tenantId: TenantId, entity: TenantOwned, fieldName: string): void {
  if (entity.tenantId !== tenantId) {
    throw new ActionEngineModelError("tenant_mismatch", `${fieldName} tenant mismatch`);
  }
}

function createActionExecutionLog(input: {
  actor: ActorContext;
  commandType: string;
  requiredPermission: string;
  status: ActionExecutionStatus;
  source: ActionEntityRef;
  target?: ActionEntityRef;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  trace: string[];
}): ActionExecutionLog {
  const tenantId = requireNonEmptyString(input.actor.tenantId, "actor.tenantId");
  const actorId = requireNonEmptyString(input.actor.actorId, "actor.actorId");
  const correlationId = requireNonEmptyString(input.actor.correlationId, "actor.correlationId");
  const source = requireObject(input.source, "actionExecution.source");
  const target = input.target !== undefined ? requireObject(input.target, "actionExecution.target") : undefined;

  return {
    id: `action-${correlationId}`,
    tenantId,
    actorId,
    commandType: requireNonEmptyString(input.commandType, "actionExecution.commandType"),
    requiredPermission: requireNonEmptyString(input.requiredPermission, "actionExecution.requiredPermission"),
    status: input.status,
    source: {
      entityType: requireNonEmptyString(source.entityType, "actionExecution.source.entityType"),
      entityId: requireNonEmptyString(source.entityId, "actionExecution.source.entityId")
    },
    ...(target !== undefined
      ? {
          target: {
            entityType: requireNonEmptyString(target.entityType, "actionExecution.target.entityType"),
            entityId: requireNonEmptyString(target.entityId, "actionExecution.target.entityId")
          }
        }
      : {}),
    before: input.before === null ? null : structuredClone(input.before),
    after: input.after === null ? null : structuredClone(input.after),
    timestamp: requireValidTimestamp(input.timestamp, "actionExecution.timestamp"),
    correlationId,
    trace: requireStringArray(input.trace, "actionExecution.trace")
  };
}

function projectDraftSummary(projectDraft: ProjectDraft): Record<string, unknown> {
  return {
    projectDraftId: projectDraft.id,
    status: projectDraft.status,
    sourceOpportunityId: projectDraft.sourceOpportunity.opportunityId,
    processTemplate: {
      templateId: projectDraft.processTemplate.templateId,
      key: projectDraft.processTemplate.key,
      version: projectDraft.processTemplate.version,
      matchConfidence: projectDraft.processTemplate.matchConfidence,
      assumptions: projectDraft.processTemplate.assumptions.map((assumption) => ({ ...assumption }))
    },
    totalPlannedWorkHours: projectDraft.demand.totalPlannedWorkHours,
    feasibilityStatus: projectDraft.feasibility.status
  };
}

export function executeCreateProjectDraftFromOpportunity(
  input: CreateProjectDraftFromOpportunityCommandInput
): CreateProjectDraftFromOpportunityCommandResult {
  const actor = requireObject(input.actor, "projectDraftCommand.actor");
  const tenantId = requireNonEmptyString(actor.tenantId, "actor.tenantId");
  const actorId = requireNonEmptyString(actor.actorId, "actor.actorId");
  const correlationId = requireNonEmptyString(actor.correlationId, "actor.correlationId");
  if (input.requiredPermission !== "project_draft.create") {
    throw new ActionEngineModelError("validation_error", "projectDraftCommand.requiredPermission is invalid");
  }
  assertTenant(tenantId, input.sourceOpportunity, "projectDraftCommand.sourceOpportunity");
  assertTenant(tenantId, input.processTemplate, "projectDraftCommand.processTemplate");
  assertTenant(tenantId, input.demand, "projectDraftCommand.demand");
  assertTenant(tenantId, input.feasibility, "projectDraftCommand.feasibility");
  if (input.existingDraft !== undefined) {
    assertTenant(tenantId, input.existingDraft, "projectDraftCommand.existingDraft");
    throw new ActionEngineModelError("conflict", "Project draft already exists for this opportunity");
  }
  const readiness = requireObject(input.readiness, "projectDraftCommand.readiness");
  if (readiness.ready !== true) {
    throw new ActionEngineModelError("precondition_failed", "Opportunity readiness is not complete");
  }
  if (input.feasibility.status !== "fit") {
    throw new ActionEngineModelError("precondition_failed", "Opportunity feasibility does not allow project draft creation");
  }

  const projectDraft = createProjectDraftFromOpportunity({
    id: `project-draft-${input.sourceOpportunity.opportunityId}`,
    tenantId,
    title: input.sourceOpportunity.title,
    createdBy: actorId,
    createdAt: input.now,
    correlationId,
    sourceOpportunity: input.sourceOpportunity,
    processTemplate: input.processTemplate,
    demand: input.demand,
    feasibility: input.feasibility
  });
  const actionExecution = createActionExecutionLog({
    actor,
    commandType: "project_draft.create_from_opportunity",
    requiredPermission: input.requiredPermission,
    status: "succeeded",
    source: {
      entityType: "opportunity",
      entityId: input.sourceOpportunity.opportunityId
    },
    target: {
      entityType: "projectDraft",
      entityId: projectDraft.id
    },
    before: null,
    after: projectDraftSummary(projectDraft),
    timestamp: input.now,
    trace: [
      "action:permission:project_draft.create",
      ...readiness.trace,
      "action:project_draft:created"
    ]
  });

  return { projectDraft, actionExecution };
}
