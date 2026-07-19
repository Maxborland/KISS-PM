import type {
  AutoPlanningSolverMode,
  AutoPlanningSolverProposal,
  PlanningCommand,
  PlanningReadModel,
  ScenarioProposal,
  ValidationIssue
} from "@kiss-pm/domain";

// Канонический тип read-model живёт в @kiss-pm/domain (владелец проекции). planning-client лишь
// ре-экспортит его, чтобы web и api видели одну форму — раньше здесь был Record<string,unknown>×8,
// стиравший тип на границе пакета.
export type { PlanningReadModel };

// Решение пермишен-проверки, которое превью возвращает вместе с расчётом
// (боевой preview-command/preview-command-batch уже отдают эти поля).
export type PlanningPermissionPreview = {
  allowed: boolean;
  reason: string;
};

// Аудит-событие, которое будет записано, если команду применить.
export type PlanningAuditPreview = {
  actionType: string;
  sourceWorkflow: string;
  planVersionBefore: number;
  planVersionAfter: number;
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
  // preview-command отдаёт единичный permissionPreview, preview-command-batch — массив
  // permissionPreviews (по одному на команду). Оба optional: старые ответы и мок-сессии
  // без этих полей остаются валидными.
  permissionPreview?: PlanningPermissionPreview;
  permissionPreviews?: PlanningPermissionPreview[];
  auditPreview?: PlanningAuditPreview;
};

// Wire-контракт превью сценариев: persisted-run id внутри proposals + срок годности предложения.
// ScenarioProposal — канонический доменный тип (владелец — @kiss-pm/domain/scenarioPlanning).
export type ScenarioPreviewResponse = {
  proposals: ScenarioProposal[];
  planVersion: number;
  engineVersion: string;
  expiresAt: string;
};

// Wire-контракт авто-солвера (второй источник предложений в «Сценариях»).
// Сервер (planningAutoSolverRoutes) поверх доменного AutoPlanningSolverProposal
// добавляет conflictEffect и label; run персистентный, живёт до expiresAt и одноразовый.
export type AutoSolverWireProposal = AutoPlanningSolverProposal & {
  conflictEffect: "removed" | "accepted_overload";
  label: string;
};

export type AutoSolverRunResponse = {
  runId: string;
  mode: AutoPlanningSolverMode;
  clientPlanVersion: number;
  engineVersion: string;
  targetDeadline: string | null;
  proposalPayloadHash: string;
  expiresAt: string;
  appliedProposalId: string | null;
  proposals: AutoSolverWireProposal[];
};

// GET одного run дополнительно отдаёт метаданные входного снапшота и факт применения.
export type AutoSolverRunDetailResponse = AutoSolverRunResponse & {
  inputSnapshotMetadata: Record<string, unknown>;
  appliedAt: string | null;
};

export type AutoSolverRunRequest = {
  mode: AutoPlanningSolverMode;
  clientPlanVersion: number;
  targetDeadline?: string | null;
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

export type PlanningRevertRequest = {
  targetCommitId: string;
  clientPlanVersion: number;
  idempotencyKey: string;
};
