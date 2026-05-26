import type { AccessProfile } from "@kiss-pm/access-control";
import type {
  PlanningCommand,
  CallEvent,
  CallParticipantState,
  CallRecording,
  CallRoom,
  CallRoomStatus,
  CallSession,
  CallSessionStatus,
  CollaborationEntityType,
  ControlSignal,
  CorrectiveAction,
  Conversation,
  ConversationReadState,
  DiscussionMessage,
  KpiDefinition,
  KpiEvaluation,
  Meeting,
  MeetingActionItem,
  MeetingExternalLink,
  MeetingNote,
  MeetingParticipant,
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MessageMention,
  NotificationPreference,
  OccupancyWindow,
  PlanSnapshot,
  ProjectClosureSnapshot,
  ResourceCalendarEvent,
  ResourcePersonalCalendar,
  RetrospectiveLesson,
  RetrospectiveReadModel,
  Tenant,
  TenantId,
  TenantUser,
  TemplateImprovementAction,
  UserNotification,
  UserId
} from "@kiss-pm/domain";
import type {
  CrmActivityEntityType,
  CrmActivityInput,
  CrmActivityRecord,
  CrmActivityTransitionResult,
  CrmActivityUpdateInput,
  PlanningCommandIdempotencyInput,
  PlanningCommandIdempotencyRecord,
  PlanningScenarioRunInput,
  PlanningScenarioRunRecord,
  PlanningSolverRunInput,
  PlanningSolverRunRecord,
  ControlSurfaceArchiveInput,
  ControlSurfaceDraftInput,
  ControlSurfacePublishInput,
  ControlSurfaceRecord,
  ControlSurfaceRollbackInput,
  ControlSurfaceVersionRecord,
  AttachmentEntityType,
  AttachmentReadModel,
  EntityAttachmentInput,
  ExternalReferenceInput,
  ExternalReferenceRecord,
  FileAssetInput,
  FileAssetRecord,
  PersonalCalendarEventInput,
  ActionExecutionInput,
  ActionExecutionRecord,
  TaskActivityInput,
  TaskActivityRecord,
  TaskMetadataInput,
  TaskRecord,
  TaskStatusInput,
  TaskStatusRecord
} from "@kiss-pm/persistence";
import type { AuthRateLimiter } from "./authRateLimit";
import type { ReadinessChecks } from "./healthRoutes";
import type { StorageProvider } from "./storageProvider";
import type { VideoProvider } from "./videoProvider";

export type AccessProfileRecord = AccessProfile & {
  tenantId: TenantId;
  name: string;
};

export type AuditEventListItem = {
  id: string;
  tenantId: TenantId;
  actorUserId: UserId;
  actionType: string;
  sourceSurfaceId: string | null;
  sourceWorkflow: string | null;
  sourceEntity: Record<string, unknown>;
  input: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: Record<string, unknown>;
  executionResult: Record<string, unknown>;
  correlationId: string;
  createdAt: Date;
};

export type WorkspaceUserRecord = TenantUser & {
  email: string;
  positionId: string | null;
  positionName: string | null;
  phone: string | null;
  telegram: string | null;
  status: string;
  theme: string;
  accentColor: string;
};

export type PositionRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
};

export type CrmEntityStatus = "active" | "archived";

export type ClientRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientInput = Omit<ClientRecord, "createdAt" | "updatedAt">;

export type ContactRecord = {
  id: string;
  tenantId: TenantId;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  role: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactInput = Omit<ContactRecord, "createdAt" | "updatedAt">;

export type ProductType = "service" | "goods";

export type ProductRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  sku: string | null;
  type: ProductType;
  unit: string;
  price: number;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductInput = Omit<ProductRecord, "createdAt" | "updatedAt">;

export type ProjectTypeRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectTypeInput = Omit<ProjectTypeRecord, "createdAt" | "updatedAt">;

export type DealStageRecord = {
  id: string;
  tenantId: TenantId;
  name: string;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DealStageInput = Omit<DealStageRecord, "createdAt" | "updatedAt">;

export type CustomFieldDefinitionRecord = {
  id: string;
  tenantId: TenantId;
  systemKey: string;
  tenantLabel: string;
  targetEntity: string;
  fieldType: string;
  required: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomFieldDefinitionInput = Omit<
  CustomFieldDefinitionRecord,
  "createdAt" | "updatedAt"
>;

export type ProjectTemplateRecord = {
  id: string;
  tenantId: TenantId;
  systemKey: string;
  tenantLabel: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectTemplateInput = Omit<
  ProjectTemplateRecord,
  "createdAt" | "updatedAt"
>;

export type PositionDemandRecord = {
  positionId: string;
  requiredHours: number;
};

export type OpportunityCustomFieldValues = Record<string, string>;
export type OpportunityFinalStatus = "won_closed" | "lost_rejected";

export type OpportunityRecord = {
  id: string;
  tenantId: TenantId;
  clientId: string | null;
  primaryContactId: string | null;
  ownerUserId: string | null;
  projectTypeId: string | null;
  stageId: string | null;
  clientName: string;
  contactName: string;
  title: string;
  projectType: string;
  description: string | null;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHourlyRate: number;
  plannedHours: number;
  probability: number;
  status: string;
  templateId: string | null;
  feasibilityStatus: string | null;
  feasibilityResult: Record<string, unknown> | null;
  feasibilityCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  demand: PositionDemandRecord[];
  customFieldValues: OpportunityCustomFieldValues;
};

export type OpportunityInput = Omit<
  OpportunityRecord,
  | "createdAt"
  | "updatedAt"
  | "feasibilityStatus"
  | "feasibilityResult"
  | "feasibilityCheckedAt"
  | "ownerUserId"
  | "customFieldValues"
> & {
  ownerUserId?: string | null;
  customFieldValues?: OpportunityCustomFieldValues;
};
export type OpportunityUpdateInput = Omit<
  OpportunityInput,
  "id" | "clientName" | "contactName" | "projectType" | "status"
>;

export type ProjectRecord = {
  id: string;
  tenantId: TenantId;
  sourceType: "opportunity" | "workspace_inbox" | "manual";
  sourceOpportunityId: string | null;
  clientId: string | null;
  projectTypeId: string | null;
  title: string;
  clientName: string;
  status: string;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHours: number;
  templateId: string | null;
  createdAt: Date;
  activatedAt: Date | null;
  closedAt: Date | null;
  demand: PositionDemandRecord[];
};

export type ProjectInput = Omit<
  ProjectRecord,
  "createdAt" | "activatedAt" | "closedAt" | "sourceType" | "sourceOpportunityId"
> & {
  sourceOpportunityId: string;
};
export type ProjectDraftActivationInput = {
  tenantId: TenantId;
  projectId: string;
};
export type WorkspaceInboxProjectInput = {
  tenantId: TenantId;
  plannedStart: Date;
  plannedFinish: Date;
};

export type UserCredentialRecord = {
  userId: UserId;
  tenantId: TenantId;
  email: string;
  passwordHash: string;
  passwordSalt: string;
};

export type UserSessionRecord = {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  tokenHash: string;
  expiresAt: Date;
};

export type ManagementAuditEventInput = {
  auditEventId?: string;
  tenantId: TenantId;
  actorUserId: UserId;
  actionType: string;
  sourceWorkflow: string;
  sourceEntity: {
    type: string;
    id: string;
  };
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
};

export type ManagementAuditDataSource = Pick<ApiTenantDataSource, "appendAuditEvent">;

export type ApiTenantDataSource = {
  listDevUsers(): Promise<TenantUser[]>;
  findUserById(userId: UserId): Promise<TenantUser | undefined>;
  findTenantById(tenantId: TenantId): Promise<Tenant | undefined>;
  findAccessProfileById?(
    tenantId: TenantId,
    accessProfileId: string
  ): Promise<AccessProfile | undefined>;
  listUsersByTenantId(tenantId: TenantId): Promise<TenantUser[]>;
  listAccessProfilesByTenantId?(
    tenantId: TenantId
  ): Promise<AccessProfileRecord[]>;
  createAccessProfile?(
    input: AccessProfileRecord
  ): Promise<AccessProfileRecord>;
  updateAccessProfile?(
    input: AccessProfileRecord
  ): Promise<AccessProfileRecord>;
  deleteAccessProfile?(tenantId: TenantId, accessProfileId: string): Promise<void>;
  listWorkspaceUsers?(tenantId: TenantId): Promise<WorkspaceUserRecord[]>;
  createWorkspaceUser?(
    input: Omit<WorkspaceUserRecord, "positionName">
  ): Promise<WorkspaceUserRecord>;
  updateWorkspaceUser?(
    input: Omit<WorkspaceUserRecord, "positionName">
  ): Promise<WorkspaceUserRecord>;
  deleteWorkspaceUser?(tenantId: TenantId, userId: UserId): Promise<void>;
  listPositions?(tenantId: TenantId): Promise<PositionRecord[]>;
  createPosition?(input: PositionRecord): Promise<PositionRecord>;
  updatePosition?(input: PositionRecord): Promise<PositionRecord>;
  deletePosition?(tenantId: TenantId, positionId: string): Promise<void>;
  listClients?(tenantId: TenantId): Promise<ClientRecord[]>;
  findClientById?(tenantId: TenantId, clientId: string): Promise<ClientRecord | undefined>;
  createClient?(input: ClientInput): Promise<ClientRecord>;
  updateClient?(input: ClientInput): Promise<ClientRecord>;
  listContacts?(tenantId: TenantId): Promise<ContactRecord[]>;
  findContactById?(
    tenantId: TenantId,
    contactId: string
  ): Promise<ContactRecord | undefined>;
  createContact?(input: ContactInput): Promise<ContactRecord>;
  updateContact?(input: ContactInput): Promise<ContactRecord>;
  listProducts?(tenantId: TenantId): Promise<ProductRecord[]>;
  findProductById?(
    tenantId: TenantId,
    productId: string
  ): Promise<ProductRecord | undefined>;
  createProduct?(input: ProductInput): Promise<ProductRecord>;
  updateProduct?(input: ProductInput): Promise<ProductRecord>;
  listProjectTypes?(tenantId: TenantId): Promise<ProjectTypeRecord[]>;
  findProjectTypeById?(
    tenantId: TenantId,
    projectTypeId: string
  ): Promise<ProjectTypeRecord | undefined>;
  createProjectType?(input: ProjectTypeInput): Promise<ProjectTypeRecord>;
  updateProjectType?(input: ProjectTypeInput): Promise<ProjectTypeRecord>;
  listDealStages?(tenantId: TenantId): Promise<DealStageRecord[]>;
  findDealStageById?(
    tenantId: TenantId,
    stageId: string
  ): Promise<DealStageRecord | undefined>;
  createDealStage?(input: DealStageInput): Promise<DealStageRecord>;
  updateDealStage?(input: DealStageInput): Promise<DealStageRecord>;
  listCustomFieldDefinitions?(
    tenantId: TenantId
  ): Promise<CustomFieldDefinitionRecord[]>;
  createCustomFieldDefinition?(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  updateCustomFieldDefinition?(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  listProjectTemplates?(tenantId: TenantId): Promise<ProjectTemplateRecord[]>;
  createProjectTemplate?(
    input: ProjectTemplateInput
  ): Promise<ProjectTemplateRecord>;
  updateProjectTemplate?(
    input: ProjectTemplateInput
  ): Promise<ProjectTemplateRecord>;
  listOpportunities?(tenantId: TenantId): Promise<OpportunityRecord[]>;
  findOpportunityById?(
    tenantId: TenantId,
    opportunityId: string
  ): Promise<OpportunityRecord | undefined>;
  createOpportunity?(input: OpportunityInput): Promise<OpportunityRecord>;
  updateOpportunity?(input: OpportunityInput): Promise<OpportunityRecord | undefined>;
  updateOpportunityFeasibility?(input: {
    tenantId: TenantId;
    opportunityId: string;
    status: string;
    feasibilityStatus: string;
    feasibilityResult: Record<string, unknown>;
  }): Promise<OpportunityRecord | undefined>;
  updateOpportunityStage?(input: {
    tenantId: TenantId;
    opportunityId: string;
    stageId: string;
  }): Promise<OpportunityRecord | undefined>;
  finalizeOpportunity?(input: {
    tenantId: TenantId;
    opportunityId: string;
    status: OpportunityFinalStatus;
  }): Promise<OpportunityRecord | undefined>;
  listCrmActivities?(
    tenantId: TenantId,
    entityType: CrmActivityEntityType,
    entityId: string
  ): Promise<CrmActivityRecord[]>;
  createCrmActivity?(
    input: CrmActivityInput
  ): Promise<CrmActivityRecord | undefined>;
  updateCrmActivity?(
    input: CrmActivityUpdateInput
  ): Promise<CrmActivityRecord | undefined>;
  transitionCrmActivityStatus?(
    input: CrmActivityUpdateInput
  ): Promise<CrmActivityTransitionResult>;
  listProjects?(tenantId: TenantId): Promise<ProjectRecord[]>;
  ensureWorkspaceInboxProject?(
    input: WorkspaceInboxProjectInput
  ): Promise<ProjectRecord>;
  createProjectDraftFromOpportunity?(input: ProjectInput): Promise<ProjectRecord>;
  activateProjectDraft?(input: ProjectDraftActivationInput): Promise<ProjectRecord>;
  listProjectTasks?(tenantId: TenantId, projectId: string): Promise<TaskRecord[]>;
  listMyWorkTasks?(tenantId: TenantId, userId: UserId): Promise<TaskRecord[]>;
  listScheduledTasks?(input: {
    tenantId: TenantId;
    assigneeUserId: UserId;
    fromDate: string;
    toDate: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      title: string;
      projectId: string;
      projectTitle: string;
      plannedStart: Date;
      plannedFinish: Date;
      workMinutes: number;
      createdAt: Date;
      statusId: string;
    }>
  >;
  findTaskById?(tenantId: TenantId, taskId: string): Promise<TaskRecord | undefined>;
  listTaskStatuses?(tenantId: TenantId): Promise<TaskStatusRecord[]>;
  createTaskStatus?(input: TaskStatusInput): Promise<TaskStatusRecord>;
  updateTaskStatusDefinition?(input: TaskStatusInput): Promise<TaskStatusRecord>;
  archiveTaskStatus?(
    tenantId: TenantId,
    statusId: string
  ): Promise<TaskStatusRecord | undefined>;
  // Task planning fields are intentionally mutated only through applyPlanningCommand.
  // Compatibility task endpoints may update non-planning metadata after the command.
  updateTaskMetadata?(input: TaskMetadataInput): Promise<TaskRecord | undefined>;
  listTaskActivities?(tenantId: TenantId, taskId: string): Promise<TaskActivityRecord[]>;
  createTaskActivity?(input: TaskActivityInput): Promise<TaskActivityRecord>;
  createPendingFileAsset?(input: FileAssetInput): Promise<FileAssetRecord>;
  markFileAssetReady?(input: {
    tenantId: TenantId;
    assetId: string;
    sizeBytes: number;
    checksumSha256: string;
  }): Promise<FileAssetRecord | undefined>;
  markFileAssetFailed?(input: {
    tenantId: TenantId;
    assetId: string;
  }): Promise<FileAssetRecord | undefined>;
  createExternalReference?(input: ExternalReferenceInput): Promise<ExternalReferenceRecord>;
  createEntityAttachment?(input: EntityAttachmentInput): Promise<AttachmentReadModel>;
  listEntityAttachments?(input: {
    tenantId: TenantId;
    entityType: AttachmentEntityType;
    entityId: string;
  }): Promise<AttachmentReadModel[]>;
  listAttachmentActivityItems?(input: {
    tenantId: TenantId;
    entityType: AttachmentEntityType;
    entityId: string;
  }): Promise<AttachmentReadModel[]>;
  findAttachmentById?(
    tenantId: TenantId,
    attachmentId: string
  ): Promise<AttachmentReadModel | undefined>;
  archiveAttachment?(input: {
    tenantId: TenantId;
    attachmentId: string;
  }): Promise<AttachmentReadModel | undefined>;
  searchAttachments?(input: {
    tenantId: TenantId;
    query: string;
    limit: number;
    offset?: number;
  }): Promise<AttachmentReadModel[]>;
  findCredentialByEmail?(
    email: string
  ): Promise<UserCredentialRecord | undefined>;
  upsertCredential?(input: UserCredentialRecord): Promise<void>;
  updateCredentialEmail?(
    tenantId: TenantId,
    userId: UserId,
    email: string
  ): Promise<void>;
  createSession?(input: UserSessionRecord): Promise<void>;
  findSessionByTokenHash?(
    tokenHash: string
  ): Promise<UserSessionRecord | undefined>;
  deleteSessionByTokenHash?(tokenHash: string): Promise<void>;
  deleteSessionsByUserId?(tenantId: TenantId, userId: UserId): Promise<void>;
  withTransaction?<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  lockTenantResourcePlanning?(tenantId: TenantId): Promise<void>;
  listSavedViews?(
    tenantId: TenantId,
    projectId: string,
    actorUserId: UserId
  ): Promise<
    Array<{
      id: string;
      tenantId: TenantId;
      projectId: string;
      ownerUserId: UserId;
      scope: "user" | "project";
      name: string;
      payload: Record<string, unknown>;
      createdAt: Date;
    }>
  >;
  createSavedView?(input: {
    id: string;
    tenantId: TenantId;
    projectId: string;
    ownerUserId: UserId;
    scope: "user" | "project";
    name: string;
    payload: Record<string, unknown>;
  }): Promise<{
    id: string;
    name: string;
    scope: "user" | "project";
    payload: Record<string, unknown>;
  }>;
  deleteSavedView?(
    tenantId: TenantId,
    projectId: string,
    viewId: string,
    actorUserId: UserId
  ): Promise<boolean>;
  listKpiDefinitions?(tenantId: TenantId): Promise<KpiDefinition[]>;
  upsertKpiDefinition?(input: KpiDefinition): Promise<KpiDefinition>;
  createKpiEvaluation?(input: KpiEvaluation): Promise<KpiEvaluation>;
  listKpiEvaluations?(tenantId: TenantId, projectId: string): Promise<KpiEvaluation[]>;
  upsertControlSignal?(input: ControlSignal): Promise<ControlSignal>;
  listControlSignals?(tenantId: TenantId, projectId: string): Promise<ControlSignal[]>;
  createCorrectiveAction?(input: CorrectiveAction): Promise<CorrectiveAction>;
  updateCorrectiveAction?(input: CorrectiveAction): Promise<CorrectiveAction>;
  listCorrectiveActions?(tenantId: TenantId, projectId: string): Promise<CorrectiveAction[]>;
  createActionExecution?(input: ActionExecutionInput): Promise<ActionExecutionRecord>;
  listActionExecutions?(tenantId: TenantId, projectId: string): Promise<ActionExecutionRecord[]>;
  getRetrospectiveReadModel?(
    tenantId: TenantId,
    projectId: string
  ): Promise<RetrospectiveReadModel>;
  closeProject?(input: {
    snapshot: Omit<ProjectClosureSnapshot, "closedAt"> & { closedAt: Date };
    lessons: Array<Omit<RetrospectiveLesson, "createdAt"> & { createdAt?: Date }>;
    templateImprovementActions: Array<
      Omit<TemplateImprovementAction, "createdAt" | "appliedAt"> & {
        createdAt?: Date;
        appliedAt?: Date | null;
      }
    >;
  }): Promise<RetrospectiveReadModel>;
  addRetrospectiveLesson?(
    input: Omit<RetrospectiveLesson, "createdAt"> & { createdAt?: Date }
  ): Promise<RetrospectiveLesson>;
  applyTemplateImprovementAction?(input: {
    tenantId: TenantId;
    projectId: string;
    actionId: string;
    actorUserId: UserId;
    auditEventId: string;
    appliedAt: Date;
  }): Promise<TemplateImprovementAction | undefined>;
  listTemplateImprovementActions?(input: {
    tenantId: TenantId;
    templateId: string;
    status?: TemplateImprovementAction["status"];
  }): Promise<TemplateImprovementAction[]>;
  listControlSurfaces?(tenantId: TenantId): Promise<ControlSurfaceRecord[]>;
  findControlSurface?(tenantId: TenantId, surfaceId: string): Promise<ControlSurfaceRecord | undefined>;
  upsertControlSurfaceDraft?(input: ControlSurfaceDraftInput): Promise<ControlSurfaceRecord>;
  publishControlSurface?(input: ControlSurfacePublishInput): Promise<{
    surface: ControlSurfaceRecord;
    version: ControlSurfaceVersionRecord;
  }>;
  archiveControlSurface?(input: ControlSurfaceArchiveInput): Promise<ControlSurfaceRecord | undefined>;
  listControlSurfaceVersions?(
    tenantId: TenantId,
    surfaceId: string
  ): Promise<ControlSurfaceVersionRecord[]>;
  rollbackControlSurfaceToVersion?(input: ControlSurfaceRollbackInput): Promise<
    | {
        surface: ControlSurfaceRecord;
        version: ControlSurfaceVersionRecord;
      }
    | undefined
  >;
  getPlanSnapshot?(tenantId: TenantId, projectId: string): Promise<PlanSnapshot | undefined>;
  ensurePlanVersion?(tenantId: TenantId, projectId: string): Promise<number>;
  incrementPlanVersion?(tenantId: TenantId, projectId: string): Promise<number>;
  createPlanningScenarioRun?(
    input: PlanningScenarioRunInput
  ): Promise<PlanningScenarioRunRecord>;
  findPlanningScenarioRun?(
    tenantId: TenantId,
    projectId: string,
    scenarioRunId: string
  ): Promise<PlanningScenarioRunRecord | undefined>;
  markPlanningScenarioRunApplied?(input: {
    tenantId: TenantId;
    projectId: string;
    scenarioRunId: string;
    appliedAt: Date;
  }): Promise<void>;
  createPlanningSolverRun?(
    input: PlanningSolverRunInput
  ): Promise<PlanningSolverRunRecord>;
  findPlanningSolverRun?(
    tenantId: TenantId,
    projectId: string,
    runId: string
  ): Promise<PlanningSolverRunRecord | undefined>;
  markPlanningSolverRunApplied?(input: {
    tenantId: TenantId;
    projectId: string;
    runId: string;
    proposalId: string;
    appliedAt: Date;
  }): Promise<void>;
  findPlanningCommandIdempotency?(
    tenantId: TenantId,
    projectId: string,
    idempotencyKey: string
  ): Promise<PlanningCommandIdempotencyRecord | undefined>;
  createPlanningCommandIdempotency?(
    input: PlanningCommandIdempotencyInput
  ): Promise<void>;
  applyPlanningCommand?(input: {
    tenantId: TenantId;
    projectId: string;
    actorUserId: UserId;
    command: PlanningCommand;
  }): Promise<void>;
  appendAuditEvent?(input: {
    id: string;
    tenantId: TenantId;
    actorUserId: UserId;
    actionType: string;
    sourceSurfaceId?: string | null;
    sourceWorkflow?: string | null;
    sourceEntity: {
      type: string;
      id: string;
    };
    input: Record<string, unknown>;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    permissionResult: Record<string, unknown>;
    executionResult: Record<string, unknown>;
    correlationId: string;
    createdAt: Date;
  }): Promise<void>;
  listAuditEventsByTenantId?(
    tenantId: TenantId,
    options?: {
      limit?: number;
      projectId?: string | null;
    }
  ): Promise<AuditEventListItem[]>;
  ensureConversation?(input: Omit<Conversation, "createdAt" | "archivedAt">): Promise<Conversation>;
  findConversation?(
    tenantId: TenantId,
    conversationId: string
  ): Promise<Conversation | undefined>;
  listConversationsByEntity?(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<Conversation[]>;
  createDiscussionMessage?(input: Omit<
    DiscussionMessage,
    "createdAt" | "editedAt" | "archivedAt" | "pinnedAt" | "pinnedByUserId"
  >): Promise<DiscussionMessage>;
  listDiscussionMessages?(input: {
    tenantId: TenantId;
    conversationId: string;
    limit: number;
    cursor?: string;
  }): Promise<DiscussionMessage[]>;
  findDiscussionMessage?(
    tenantId: TenantId,
    messageId: string
  ): Promise<DiscussionMessage | undefined>;
  updateDiscussionMessage?(input: {
    tenantId: TenantId;
    messageId: string;
    body: string;
    metadata: Record<string, unknown>;
  }): Promise<DiscussionMessage | undefined>;
  archiveDiscussionMessage?(input: {
    tenantId: TenantId;
    messageId: string;
  }): Promise<DiscussionMessage | undefined>;
  pinDiscussionMessage?(input: {
    tenantId: TenantId;
    messageId: string;
    pinnedByUserId: UserId;
  }): Promise<DiscussionMessage | undefined>;
  replaceMessageMentions?(input: {
    tenantId: TenantId;
    messageId: string;
    mentionedUserIds: UserId[];
  }): Promise<MessageMention[]>;
  listMessageMentions?(tenantId: TenantId, messageId: string): Promise<MessageMention[]>;
  getConversationReadState?(input: {
    tenantId: TenantId;
    conversationId: string;
    userId: UserId;
  }): Promise<ConversationReadState>;
  markConversationRead?(input: {
    tenantId: TenantId;
    conversationId: string;
    userId: UserId;
  }): Promise<ConversationReadState>;
  createUserNotification?(input: Omit<
    UserNotification,
    "createdAt" | "readAt" | "archivedAt"
  >): Promise<UserNotification>;
  listUserNotifications?(input: {
    tenantId: TenantId;
    userId: UserId;
    status?: "unread" | "read";
    limit: number;
  }): Promise<UserNotification[]>;
  markUserNotificationRead?(input: {
    tenantId: TenantId;
    notificationId: string;
    userId: UserId;
  }): Promise<UserNotification | undefined>;
  listNotificationPreferences?(
    tenantId: TenantId,
    userId: UserId
  ): Promise<NotificationPreference[]>;
  upsertNotificationPreferences?(input: NotificationPreference[]): Promise<NotificationPreference[]>;
  createMeeting?(input: Omit<Meeting, "createdAt" | "archivedAt">): Promise<Meeting>;
  updateMeeting?(input: {
    tenantId: TenantId;
    meetingId: string;
    title: string;
    agenda: string;
    scheduledStart: Date;
    scheduledFinish: Date;
    status: MeetingStatus;
  }): Promise<Meeting | undefined>;
  findMeeting?(tenantId: TenantId, meetingId: string): Promise<Meeting | undefined>;
  listMeetingsByEntity?(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<Meeting[]>;
  replaceMeetingParticipants?(input: {
    tenantId: TenantId;
    meetingId: string;
    participants: Array<{
      userId: UserId;
      role: MeetingParticipantRole;
      response: MeetingParticipantResponse;
    }>;
  }): Promise<MeetingParticipant[]>;
  listMeetingParticipants?(
    tenantId: TenantId,
    meetingId: string
  ): Promise<MeetingParticipant[]>;
  createMeetingExternalLink?(input: Omit<
    MeetingExternalLink,
    "createdAt" | "archivedAt"
  >): Promise<MeetingExternalLink>;
  listMeetingExternalLinks?(
    tenantId: TenantId,
    meetingId: string
  ): Promise<MeetingExternalLink[]>;
  createMeetingNote?(input: Omit<MeetingNote, "createdAt" | "editedAt" | "archivedAt">): Promise<MeetingNote>;
  listMeetingNotes?(tenantId: TenantId, meetingId: string): Promise<MeetingNote[]>;
  createMeetingActionItem?(input: Omit<
    MeetingActionItem,
    "createdAt" | "archivedAt"
  >): Promise<MeetingActionItem>;
  listMeetingActionItems?(
    tenantId: TenantId,
    meetingId: string
  ): Promise<MeetingActionItem[]>;
  createCallRoom?(input: Omit<
    CallRoom,
    "createdAt" | "updatedAt" | "archivedAt"
  >): Promise<CallRoom>;
  findCallRoom?(tenantId: TenantId, roomId: string): Promise<CallRoom | undefined>;
  listCallRoomsByEntity?(input: {
    tenantId: TenantId;
    entityType: CollaborationEntityType;
    entityId: string;
  }): Promise<CallRoom[]>;
  updateCallRoomStatus?(input: {
    tenantId: TenantId;
    roomId: string;
    status: CallRoomStatus;
  }): Promise<CallRoom | undefined>;
  createCallSession?(input: Omit<
    CallSession,
    "startedAt" | "endedByUserId" | "endedAt" | "failureReason"
  >): Promise<CallSession>;
  findCallSession?(
    tenantId: TenantId,
    sessionId: string
  ): Promise<CallSession | undefined>;
  findActiveCallSessionForUpdate?(input: {
    tenantId: TenantId;
    roomId: string;
    sessionId: string;
  }): Promise<CallSession | undefined>;
  endCallSession?(input: {
    tenantId: TenantId;
    sessionId: string;
    endedByUserId: UserId;
    status: Exclude<CallSessionStatus, "active">;
    failureReason?: string | null;
  }): Promise<CallSession | undefined>;
  upsertCallParticipantState?(input: Omit<
    CallParticipantState,
    "joinedAt" | "leftAt" | "lastSeenAt"
  >): Promise<CallParticipantState>;
  listCallParticipantStates?(input: {
    tenantId: TenantId;
    roomId: string;
    sessionId: string;
  }): Promise<CallParticipantState[]>;
  createCallEvent?(input: Omit<CallEvent, "createdAt">): Promise<CallEvent>;
  listCallEvents?(input: {
    tenantId: TenantId;
    roomId: string;
    limit: number;
  }): Promise<CallEvent[]>;
  createCallRecording?(input: Omit<CallRecording, "createdAt" | "archivedAt">): Promise<CallRecording>;
  listCallRecordings?(input: {
    tenantId: TenantId;
    roomId: string;
  }): Promise<CallRecording[]>;
  ensureManualPersonalCalendar?(input: {
    tenantId: TenantId;
    userId: UserId;
    createdByUserId: UserId;
  }): Promise<ResourcePersonalCalendar>;
  findPersonalCalendar?(input: {
    tenantId: TenantId;
    userId: UserId;
  }): Promise<ResourcePersonalCalendar | undefined>;
  createPersonalCalendarEvent?(input: PersonalCalendarEventInput): Promise<ResourceCalendarEvent>;
  updatePersonalCalendarEvent?(input: {
    tenantId: TenantId;
    eventId: string;
    userId: UserId;
    title?: string | null;
    startsAt: Date;
    finishesAt: Date;
    workMinutes?: number | null;
    capacityImpact: "busy" | "unavailable" | "tentative";
    visibility: "public" | "busy_only" | "private";
    metadata?: Record<string, unknown>;
  }): Promise<ResourceCalendarEvent | undefined>;
  archivePersonalCalendarEvent?(input: {
    tenantId: TenantId;
    eventId: string;
    userId: UserId;
  }): Promise<ResourceCalendarEvent | undefined>;
  listPersonalCalendarEvents?(input: {
    tenantId: TenantId;
    userId: UserId;
    from: Date;
    to: Date;
  }): Promise<ResourceCalendarEvent[]>;
  listOccupancyWindows?(input: {
    tenantId: TenantId;
    resourceId?: UserId | undefined;
    from: Date;
    to: Date;
  }): Promise<OccupancyWindow[]>;
};

export type CreateAppOptions = {
  dataSource?: ApiTenantDataSource;
  storageProvider?: StorageProvider;
  videoProvider?: VideoProvider;
  authRateLimiter?: AuthRateLimiter;
  readinessChecks?: ReadinessChecks;
  secureCookies?: boolean;
  trustedMutationOrigins?: string[];
  trustForwardedAuthHeaders?: boolean;
  enableDevTenantRoutes?: boolean;
};
