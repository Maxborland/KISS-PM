import type { ApiTenantDataSource } from "./apiTypes";

export type TenantIdentityDataPort = Pick<
  ApiTenantDataSource,
  | "findAccessProfileById"
  | "findSessionByTokenHash"
  | "findTenantById"
  | "findUserById"
  | "listDevUsers"
  | "listUsersByTenantId"
  | "listWorkspaceUsers"
>;

export type AuditDataPort = Pick<ApiTenantDataSource, "appendAuditEvent" | "listAuditEventsByTenantId">;

export type EntityLookupDataPort = Pick<
  ApiTenantDataSource,
  | "findClientById"
  | "findContactById"
  | "findOpportunityById"
  | "findProductById"
  | "findTaskById"
  | "listProjects"
>;

export type AttachmentDataPort = EntityLookupDataPort &
  Pick<
    ApiTenantDataSource,
    | "archiveAttachment"
    | "createEntityAttachment"
    | "createExternalReference"
    | "createPendingFileAsset"
    | "findAttachmentById"
    | "listEntityAttachments"
    | "markFileAssetFailed"
    | "markFileAssetReady"
    | "withTransaction"
  >;

export type CommunicationDataPort = EntityLookupDataPort &
  Pick<
    ApiTenantDataSource,
    | "createCallEvent"
    | "createCallRecording"
    | "createCallRoom"
    | "createCallSession"
    | "endCallSession"
    | "findActiveCallSessionForUpdate"
    | "findAttachmentById"
    | "findCallRoom"
    | "findCallSession"
    | "listCallEvents"
    | "listCallParticipantStates"
    | "listCallRecordings"
    | "listCallRoomsByEntity"
    | "listUsersByTenantId"
    | "updateCallRoomStatus"
    | "upsertCallParticipantState"
  >;

export type PlanningDataPort = Pick<
  ApiTenantDataSource,
  | "applyPlanningCommand"
  | "createPlanningCommandIdempotency"
  | "createPlanningScenarioRun"
  | "createPlanningSolverRun"
  | "ensurePlanVersion"
  | "findPlanningCommandIdempotency"
  | "findPlanningScenarioRun"
  | "findPlanningSolverRun"
  | "getPlanSnapshot"
  | "incrementPlanVersion"
  | "lockTenantResourcePlanning"
  | "markPlanningScenarioRunApplied"
  | "markPlanningSolverRunApplied"
>;

export type TransactionDataPort = Pick<ApiTenantDataSource, "withTransaction">;

export type ApiCapabilities = {
  readonly audit: AuditDataPort;
  readonly attachments: AttachmentDataPort;
  readonly communications: CommunicationDataPort;
  readonly planning: PlanningDataPort;
  readonly tenantIdentity: TenantIdentityDataPort;
};

export function createApiCapabilities(dataSource: ApiTenantDataSource): ApiCapabilities {
  return {
    audit: dataSource,
    attachments: dataSource,
    communications: dataSource,
    planning: dataSource,
    tenantIdentity: dataSource
  };
}
