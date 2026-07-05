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
  | "findCommunicationChannel"
  | "findContactById"
  | "findKnowledgeDocumentById"
  | "findOpportunityById"
  | "findProductById"
  | "findTaskById"
  | "listCommunicationChannelMembers"
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
export type CrmClientReadDataPort = Pick<
  ApiTenantDataSource,
  | "findClientById"
  | "listClients"
>;

export type CrmClientCommandDataPort = Pick<
  ApiTenantDataSource,
  | "appendAuditEvent"
  | "createClient"
  | "findClientById"
  | "updateClient"
>;
export type CrmReadDataPort = Pick<
  ApiTenantDataSource,
  | "findClientById"
  | "findContactById"
  | "findDealStageById"
  | "findPipelineById"
  | "findProductById"
  | "findProjectTypeById"
  | "findStageTransitionById"
  | "listClients"
  | "listContacts"
  | "listDealStages"
  | "listPipelines"
  | "listProducts"
  | "listProjectTypes"
  | "listStageTransitions"
>;

export type CrmCommandDataPort = CrmReadDataPort &
  Pick<
    ApiTenantDataSource,
    | "appendAuditEvent"
    | "createClient"
    | "createContact"
    | "createDealStage"
    | "createPipeline"
    | "createProduct"
    | "createProjectType"
    | "createStageTransition"
    | "deleteStageTransition"
    | "updateClient"
    | "updateContact"
    | "updateDealStage"
    | "updatePipeline"
    | "updateProduct"
    | "updateProjectType"
  >;

export type CrmDataPort = CrmCommandDataPort;

export type CollaborationDataPort = EntityLookupDataPort &
  Pick<
    ApiTenantDataSource,
    | "addConversationMembers"
    | "archiveDiscussionMessage"
    | "archiveMessageReaction"
    | "countUnreadConversationMessagesForUser"
    | "createDiscussionMessage"
    | "createMeeting"
    | "createMeetingActionItem"
    | "createMeetingExternalLink"
    | "createMeetingNote"
    | "createMessageSticker"
    | "createUserNotification"
    | "ensureConversation"
    | "findConversation"
    | "findDiscussionMessage"
    | "findMeeting"
    | "findStickerAsset"
    | "getConversationReadState"
    | "isConversationMember"
    | "listConversationMemberIds"
    | "listConversationsByEntity"
    | "listDirectConversationsForUser"
    | "listDiscussionMessages"
    | "listMeetingParticipants"
    | "listMeetingsByEntity"
    | "listMessageReactionsByMessageIds"
    | "listMessageStickersByMessageIds"
    | "listNotificationPreferences"
    | "listUserNotifications"
    | "listUsersByTenantId"
    | "markConversationRead"
    | "markUserNotificationRead"
    | "pinDiscussionMessage"
    | "replaceMeetingParticipants"
    | "replaceMessageMentions"
    | "updateDiscussionMessage"
    | "updateMeeting"
    | "updateMeetingActionItem"
    | "upsertMessageReaction"
    | "upsertNotificationPreferences"
  >;

export type ControlSignalCommandDataPort = Pick<
  ApiTenantDataSource,
  | "appendAuditEvent"
  | "listControlSignals"
  | "upsertControlSignal"
>;
export type ControlDataPort = PlanningReadDataPort &
  Pick<
    ApiTenantDataSource,
    | "appendAuditEvent"
    | "applyPlanningCommand"
    | "createActionExecution"
    | "createCorrectiveAction"
    | "createUserNotification"
    | "createKpiEvaluation"
    | "incrementPlanVersion"
    | "listActionExecutions"
    | "listAuditEventsByTenantId"
    | "listControlSignals"
    | "listCorrectiveActions"
    | "listKpiDefinitions"
    | "listKpiEvaluations"
    | "lockTenantResourcePlanning"
    | "updateCorrectiveAction"
    | "upsertControlSignal"
    | "upsertKpiDefinition"
  >;

export type PlanningReadDataPort = Pick<
  ApiTenantDataSource,
  | "getPlanSnapshot"
  | "listTaskStatuses"
  | "listWorkspaceUsers"
>;

export type PlanningCommandDataPort = PlanningReadDataPort &
  Pick<
    ApiTenantDataSource,
    | "appendAuditEvent"
    | "applyPlanningCommand"
    | "createPlanningCommandIdempotency"
    | "createUserNotification"
    | "findPlanningCommandIdempotency"
    | "incrementPlanVersion"
    | "lockTenantResourcePlanning"
  >;

export type PlanningDataPort = PlanningCommandDataPort &
  Pick<
    ApiTenantDataSource,
    | "createPlanningScenarioRun"
    | "createPlanningSolverRun"
    | "ensurePlanVersion"
    | "findPlanningScenarioRun"
    | "findPlanningSolverRun"
    | "markPlanningScenarioRunApplied"
    | "markPlanningSolverRunApplied"
  >;

export type TransactionDataPort = Pick<ApiTenantDataSource, "withTransaction">;

export type ApiCapabilities = {
  readonly audit: AuditDataPort;
  readonly attachments: AttachmentDataPort;
  readonly collaboration: CollaborationDataPort;
  readonly communications: CommunicationDataPort;
  readonly control: ControlDataPort;
  readonly crm: CrmDataPort;
  readonly planning: PlanningDataPort;
  readonly tenantIdentity: TenantIdentityDataPort;
};

export function createApiCapabilities(dataSource: ApiTenantDataSource): ApiCapabilities {
  return {
    audit: dataSource,
    attachments: dataSource,
    collaboration: dataSource,
    communications: dataSource,
    control: dataSource,
    crm: dataSource,
    planning: dataSource,
    tenantIdentity: dataSource
  };
}
