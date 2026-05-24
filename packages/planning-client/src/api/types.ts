import type { PlanningCommand, ValidationIssue } from "@kiss-pm/domain";

export type PlanningReadModel = {
  project: Record<string, unknown>;
  authored: {
    tasks: Array<Record<string, unknown>>;
    dependencies: Array<Record<string, unknown>>;
    assignments: Array<Record<string, unknown>>;
    baselines: Array<Record<string, unknown>>;
  };
  calculatedPlan: Record<string, unknown>;
  baselineComparison: Record<string, unknown>;
  resourceLoad: Record<string, unknown>;
  validationIssues: ValidationIssue[];
  planVersion: number;
  engineVersion: string;
};

export type PlanningPreviewResponse = {
  before: PlanningReadModel;
  after: PlanningReadModel;
  planDelta: {
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    changedDependencyIds: string[];
  };
  validationIssues: ValidationIssue[];
};

export type PlanningApplyResponse = {
  applied: {
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    changedDependencyIds: string[];
  };
  newPlanVersion: number;
  auditEventId: string;
  readModel: PlanningReadModel;
};

export type PlanningApiClientOptions = {
  apiOrigin: string;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
};

export type PlanningCommandRequest = {
  command: PlanningCommand;
  clientPlanVersion: number;
  idempotencyKey?: string;
};

export type PlanningCommandBatchRequest = {
  commands: PlanningCommand[];
  clientPlanVersion: number;
  idempotencyKey?: string;
};
