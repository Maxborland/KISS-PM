import type { PlanningCommand, PlanningReadModel, ValidationIssue } from "@kiss-pm/domain";

// Канонический тип read-model живёт в @kiss-pm/domain (владелец проекции). planning-client лишь
// ре-экспортит его, чтобы web и api видели одну форму — раньше здесь был Record<string,unknown>×8,
// стиравший тип на границе пакета.
export type { PlanningReadModel };

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
