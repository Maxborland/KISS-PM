import type {
  AccessProfile,
  PolicyDecision
} from "@kiss-pm/access-control";
import type {
  OpportunityFeasibilityAssessment,
  TenantUser
} from "@kiss-pm/domain";
import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput,
  OpportunityInput,
  OpportunityFinalStatus,
  OpportunityRecord,
  OpportunityUpdateInput,
  ProjectInput,
  ProjectRecord
} from "../apiTypes";

export type ProjectIntakeServiceDataSource = Pick<
  ApiTenantDataSource,
  | "activateProjectDraft"
  | "appendAuditEvent"
  | "createOpportunity"
  | "createProjectDraftFromOpportunity"
  | "finalizeOpportunity"
  | "findClientById"
  | "findContactById"
  | "findCrmPipelineById"
  | "findCrmPipelineStageById"
  | "findDealStageById"
  | "findOpportunityById"
  | "findProjectTypeById"
  | "findUserById"
  | "listCustomFieldDefinitions"
  | "listOpportunities"
  | "listPositions"
  | "listProjects"
  | "listWorkspaceUsers"
  | "lockTenantResourcePlanning"
  | "updateOpportunity"
  | "updateOpportunityFeasibility"
  | "withTransaction"
>;

export type ProjectIntakeMutationDataSource = Pick<
  ApiTenantDataSource,
  | "activateProjectDraft"
  | "appendAuditEvent"
  | "createOpportunity"
  | "createProjectDraftFromOpportunity"
  | "finalizeOpportunity"
  | "findOpportunityById"
  | "findCrmPipelineStageById"
  | "listPositions"
  | "listProjects"
  | "listWorkspaceUsers"
  | "lockTenantResourcePlanning"
  | "updateOpportunity"
  | "updateOpportunityFeasibility"
>;

export type ProjectIntakeServiceDeps = {
  dataSource: ProjectIntakeServiceDataSource;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ProjectIntakeMutationDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

export type ServiceErrorStatus = 400 | 403 | 404 | 409 | 501;
export type ServiceError = {
  ok: false;
  status: ServiceErrorStatus;
  error: string;
};
export type AuthorizedResult =
  | ServiceError
  | {
      ok: true;
      decision: PolicyDecision;
    };

export type CreateOpportunityResult =
  | ServiceError
  | {
      ok: true;
      status: 201;
      opportunity: OpportunityRecord;
    };

export type UpdateOpportunityResult =
  | ServiceError
  | {
      ok: true;
      status: 200;
      opportunity: OpportunityRecord;
    };

export type CheckOpportunityFeasibilityResult =
  | ServiceError
  | {
      ok: true;
      status: 200;
      opportunity: OpportunityRecord;
      assessment: OpportunityFeasibilityAssessment;
    };

export type ActivateProjectFromOpportunityResult =
  | ServiceError
  | {
      ok: true;
      status: 201;
      project: ProjectRecord;
    };

export type FinalizeOpportunityResult =
  | ServiceError
  | {
      ok: true;
      status: 200;
      opportunity: OpportunityRecord;
    };

export type ProjectActivationInput = Pick<ProjectInput, "id"> & {
  acceptedRiskReason?: string | null;
};

export type OpportunityFinalActionInput = {
  status: OpportunityFinalStatus;
  reason: string;
};

export type ProjectIntakeService = {
  preflightCreateOpportunity(input: {
    actor: TenantUser;
  }): Promise<AuthorizedResult>;
  preflightUpdateOpportunity(input: {
    actor: TenantUser;
    opportunityId: string;
  }): Promise<AuthorizedResult>;
  preflightFinalizeOpportunity(input: {
    actor: TenantUser;
    opportunityId: string;
  }): Promise<AuthorizedResult>;
  preflightProjectActivation(input: {
    actor: TenantUser;
    opportunityId: string;
  }): Promise<AuthorizedResult>;
  createOpportunity(input: {
    actor: TenantUser;
    input: OpportunityInput;
  }): Promise<CreateOpportunityResult>;
  updateOpportunity(input: {
    actor: TenantUser;
    opportunityId: string;
    input: OpportunityUpdateInput;
  }): Promise<UpdateOpportunityResult>;
  finalizeOpportunity(input: {
    actor: TenantUser;
    opportunityId: string;
    finalAction: OpportunityFinalActionInput;
  }): Promise<FinalizeOpportunityResult>;
  checkOpportunityFeasibility(input: {
    actor: TenantUser;
    opportunityId: string;
  }): Promise<CheckOpportunityFeasibilityResult>;
  activateProjectFromOpportunity(input: {
    actor: TenantUser;
    opportunityId: string;
    activation: ProjectActivationInput;
  }): Promise<ActivateProjectFromOpportunityResult>;
};
