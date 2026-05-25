import type { EntityRef, IsoDateTime, TenantId, UnknownRecord, UserId } from "./common";

export type KpiSeverity = "ok" | "warning" | "critical";
export type KpiPeriod = "snapshot" | "day" | "week" | "month";
export type KpiUnit = "days" | "minutes" | "percent" | "count";
export type ManagementActionType =
  | "create_corrective_action"
  | "generate_planning_solution"
  | "apply_planning_delta"
  | "accept_risk"
  | "move_deadline"
  | "open_gantt";

export type KpiThresholdRule = {
  severity: Exclude<KpiSeverity, "ok">;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
};

export type KpiFormula = UnknownRecord;

export type KpiDefinition = {
  id: string;
  tenantId: TenantId;
  entityType: "project";
  code: string;
  label: string;
  formula: KpiFormula;
  unit: KpiUnit;
  period: KpiPeriod;
  thresholdRules: KpiThresholdRule[];
  ownerRole: string | null;
  allowedActions: ManagementActionType[];
  version: number;
  status: "active" | "archived";
};

export type KpiEvaluation = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  definitionId: string;
  definitionVersion: number;
  formulaVersion: number;
  sourceData: UnknownRecord;
  periodStart: string | null;
  periodEnd: string | null;
  threshold: KpiThresholdRule | null;
  calculatedValue: number;
  severity: KpiSeverity;
  evaluatedAt: IsoDateTime;
};

export type ManagementActionCandidate = {
  id: string;
  type: ManagementActionType;
  label: string;
  targetEntity: EntityRef;
  requiredPermissions: string[];
  planDelta: UnknownRecord | null;
  input: UnknownRecord;
  explainability: {
    reason: string;
    deadlineDeltaDays: number;
    overloadMinutes: number;
    changedTaskIds: string[];
    changedAssignmentIds: string[];
    riskScore: number;
    cost: number;
  };
};

export type ControlSignal = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  sourceEntity: EntityRef;
  sourceMetric: string;
  evaluationId: string | null;
  severity: Exclude<KpiSeverity, "ok">;
  explanation: string;
  ownerUserId: UserId | null;
  allowedActions: ManagementActionType[];
  scenarioProposals: ManagementActionCandidate[];
  status: "open" | "acknowledged" | "resolved" | "accepted_risk";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type CorrectiveAction = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  controlSignalId: string;
  title: string;
  description: string | null;
  responsibleUserId: UserId | null;
  dueDate: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  result: string | null;
};

export type ActionExecution = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  actionType: string;
  targetEntity: EntityRef;
  actorUserId: UserId;
  input: UnknownRecord;
  previewPayload: UnknownRecord | null;
  resultPayload: UnknownRecord | null;
  status: "previewed" | "succeeded" | "failed" | "denied";
  auditEventId: string | null;
  createdAt: IsoDateTime;
};

export type AuditEvent = {
  id: string;
  tenantId: TenantId;
  actorUserId: UserId;
  actionType: string;
  sourceSurfaceId: string | null;
  sourceWorkflow: string | null;
  sourceEntity: UnknownRecord;
  input: UnknownRecord;
  beforeState: UnknownRecord | null;
  afterState: UnknownRecord | null;
  permissionResult: UnknownRecord;
  executionResult: UnknownRecord;
  correlationId: string;
  createdAt: IsoDateTime;
};
