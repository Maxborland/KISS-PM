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
  ManagementAuditEventInput,
  OpportunityInput,
  OpportunityFinalStatus,
  OpportunityRecord,
  OpportunityUpdateInput,
  ProjectInput,
  ProjectRecord
} from "../apiTypes";

export type ProjectIntakeServiceDeps = {
  dataSource: ApiTenantDataSource;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
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

export type ChangeOpportunityStageResult =
  | ServiceError
  | {
      ok: true;
      status: 200;
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
  preflightChangeOpportunityStage(input: {
    actor: TenantUser;
    opportunityId: string;
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
  changeOpportunityStage(input: {
    actor: TenantUser;
    opportunityId: string;
    stageId: string;
  }): Promise<ChangeOpportunityStageResult>;
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
