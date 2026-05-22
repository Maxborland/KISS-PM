import type { PlanningCommand, ScenarioProposal, ScenarioTarget, ValidationIssue } from "@kiss-pm/domain";

import { encodePathSegment, requestJson } from "../api";
import type { PlanningReadModel } from "./planningReadModelMapper";

export type PlanningCommandEnvelope = {
  command: PlanningCommand;
  clientPlanVersion: number;
  idempotencyKey?: string;
};

export type PlanningCommandPreviewResponse = {
  before: PlanningReadModel;
  after: PlanningReadModel;
  planDelta: unknown;
  validationIssues: ValidationIssue[];
  permissionPreview: {
    allowed: boolean;
    reason: string;
  };
  auditPreview: {
    actionType: string;
    sourceWorkflow: "planning";
    planVersionBefore: number;
    planVersionAfter: number;
  };
};

export type PlanningCommandApplyResponse = {
  applied: unknown;
  newPlanVersion: number;
  auditEventId: string | null;
  readModel: PlanningReadModel;
};

export type PlanningScenarioPreviewEnvelope = {
  target: ScenarioTarget;
  clientPlanVersion: number;
};

export type PlanningScenarioPreviewResponse = {
  proposals: ScenarioProposal[];
  planVersion: number;
  engineVersion: string;
  expiresAt: string;
};

export type PlanningScenarioApplyEnvelope = {
  clientPlanVersion: number;
  acceptedRiskReason?: string;
};

export type PlanningScenarioApplyResponse = {
  scenarioRunId: string;
  newPlanVersion: number;
  auditEventId: string | null;
  readModel: PlanningReadModel;
};

export function fetchPlanningReadModel(projectId: string): Promise<PlanningReadModel> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}/planning/read-model`);
}

export function previewPlanningCommand(
  projectId: string,
  envelope: PlanningCommandEnvelope
): Promise<PlanningCommandPreviewResponse> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}/planning/preview-command`, {
    method: "POST",
    body: envelope
  });
}

export function applyPlanningCommand(
  projectId: string,
  envelope: PlanningCommandEnvelope
): Promise<PlanningCommandApplyResponse> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}/planning/apply-command`, {
    method: "POST",
    body: envelope
  });
}

export function previewPlanningScenarioProposals(
  projectId: string,
  envelope: PlanningScenarioPreviewEnvelope
): Promise<PlanningScenarioPreviewResponse> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}/planning/scenario-proposals`, {
    method: "POST",
    body: envelope
  });
}

export function applyPlanningScenarioProposal(
  projectId: string,
  proposalId: string,
  envelope: PlanningScenarioApplyEnvelope
): Promise<PlanningScenarioApplyResponse> {
  return requestJson(
    `/api/workspace/projects/${encodePathSegment(projectId)}/planning/scenario-proposals/${encodePathSegment(proposalId)}/apply`,
    {
      method: "POST",
      body: envelope
    }
  );
}
