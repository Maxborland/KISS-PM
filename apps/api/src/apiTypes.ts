import type { AccessProfile } from "@kiss-pm/access-control";
import type {
  PlanningCommand,
  CrmPipeline,
  CrmPipelineStage,
  CrmPipelineStageAutomationDefinition,
  CrmPipelineTransitionRule,
  BackgroundJobEvent,
  BackgroundJobKind,
  BackgroundJobRun,
  BackgroundJobSchedule,
  BackgroundJobStatus,
  CallEvent,
  CallParticipantState,
  CallRecording,
  CallRoom,
  CallRoomStatus,
  CallSession,
  CallSessionStatus,
  CommunicationChannel,
  CommunicationChannelMember,
  CommunicationChannelType,
  CollaborationEntityType,
  ControlSignal,
  CorrectiveAction,
  Conversation,
  ConversationReadState,
  DecisionLogEntry,
  DiscussionMessage,
  KnowledgeActionItem,
  KnowledgeDocument,
  KnowledgeDocumentVersion,
  KpiDefinition,
  KpiEvaluation,
  Meeting,
  MeetingActionItem,
  MeetingActionItemStatus,
  MeetingExternalLink,
  MeetingNote,
  MeetingParticipant,
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MessageMention,
  MessageReaction,
  MessageSticker,
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
  TenantSecurityPolicy,
  TenantUser,
  TemplateImprovementAction,
  UserNotification,
  UserId,
  StickerAsset,
  StickerPack
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
  PipelineInput,
  PipelineRecord,
  StageTransitionInput,
  StageTransitionRecord,
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
import type { EmailProvider } from "./emailProvider";
import type { LiveKitEgressProvider } from "./communications/recording/livekitEgressProvider";
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
  // Мультиворонки: воронка стадии (null — «бесхозная» стадия legacy-периода).
  pipelineId: string | null;
  name: string;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DealStageInput = Omit<DealStageRecord, "createdAt" | "updatedAt">;

export type CrmPipelineInput = Omit<CrmPipeline, "createdAt" | "updatedAt">;
export type CrmPipelineStageInput = Omit<CrmPipelineStage, "createdAt" | "updatedAt">;
export type CrmPipelineTransitionRuleInput = Omit<
  CrmPipelineTransitionRule,
  "createdAt" | "updatedAt"
>;
export type CrmPipelineStageAutomationDefinitionInput = Omit<
  CrmPipelineStageAutomationDefinition,
  "createdAt" | "updatedAt"
>;

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
  pipelineId: string | null;
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
  | "pipelineId"
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
  createdAt?: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: Date | null;
};

export type PasswordResetTokenRecord = {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  requestedIp: string | null;
  createdAt: Date;
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
  listPipelines?(tenantId: TenantId): Promise<PipelineRecord[]>;
  findPipelineById?(
    tenantId: TenantId,
    pipelineId: string
  ): Promise<PipelineRecord | undefined>;
  createPipeline?(input: PipelineInput): Promise<PipelineRecord>;
  updatePipeline?(input: PipelineInput): Promise<PipelineRecord>;
  listStageTransitions?(
    tenantId: TenantId,
    pipelineId?: string
  ): Promise<StageTransitionRecord[]>;
  findStageTransitionById?(
    tenantId: TenantId,
    transitionId: string
  ): Promise<StageTransitionRecord | undefined>;
  createStageTransition?(input: StageTransitionInput): Promise<StageTransitionRecord>;
  deleteStageTransition?(tenantId: TenantId, transitionId: string): Promise<void>;
  listCrmPipelines?(tenantId: TenantId): Promise<CrmPipeline[]>;
  findCrmPipelineById?(tenantId: TenantId, pipelineId: string): Promise<CrmPipeline | undefined>;
  createCrmPipeline?(input: CrmPipelineInput): Promise<CrmPipeline>;
  updateCrmPipeline?(input: CrmPipelineInput): Promise<CrmPipeline>;
  refreshCrmPipelineLifecycleGraph?(
    tenantId: TenantId,
    pipelineId: string
  ): Promise<CrmPipeline | undefined>;
  listCrmPipelineStages?(tenantId: TenantId, pipelineId?: string): Promise<CrmPipelineStage[]>;
  findCrmPipelineStageById?(
    tenantId: TenantId,
    pipelineId: string,
    stageId: string
  ): Promise<CrmPipelineStage | undefined>;
  createCrmPipelineStage?(input: CrmPipelineStageInput): Promise<CrmPipelineStage>;
  updateCrmPipelineStage?(input: CrmPipelineStageInput): Promise<CrmPipelineStage>;
  listCrmPipelineTransitionRules?(
    tenantId: TenantId,
    pipelineId: string
  ): Promise<CrmPipelineTransitionRule[]>;
  findCrmPipelineTransitionRuleById?(
    tenantId: TenantId,
    pipelineId: string,
    ruleId: string
  ): Promise<CrmPipelineTransitionRule | undefined>;
  createCrmPipelineTransitionRule?(
    input: CrmPipelineTransitionRuleInput
  ): Promise<CrmPipelineTransitionRule>;
  updateCrmPipelineTransitionRule?(
    input: CrmPipelineTransitionRuleInput
  ): Promise<CrmPipelineTransitionRule>;
  listCrmPipelineStageAutomationDefinitions?(
    tenantId: TenantId,
    pipelineId: string
  ): Promise<CrmPipelineStageAutomationDefinition[]>;
  findCrmPipelineStageAutomationDefinitionById?(
    tenantId: TenantId,
    pipelineId: string,
    automationId: string
  ): Promise<CrmPipelineStageAutomationDefinition | undefined>;
  createCrmPipelineStageAutomationDefinition?(
    input: CrmPipelineStageAutomationDefinitionInput
  ): Promise<CrmPipelineStageAutomationDefinition>;
  updateCrmPipelineStageAutomationDefinition?(
    input: CrmPipelineStageAutomationDefinitionInput
  ): Promise<CrmPipelineStageAutomationDefinition>;
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
    pipelineId?: string | null;
  }): Promise<OpportunityRecord | undefined>;
  updateOpportunityPipeline?(input: {
    tenantId: TenantId;
    opportunityId: string;
    stageId: string;
    pipelineId: string;
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
    checksumSha256: string | null;
  }): Promise<FileAssetRecord | undefined>;
  markFileAssetFailed?(input: {
    tenantId: TenantId;
    assetId: string;
  }): Promise<FileAssetRecord | undefined>;
  findFileAssetById?(tenantId: TenantId, assetId: string): Promise<FileAssetRecord | undefined>;
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
  enqueueBackgroundJob?(input: {
    id: string;
    tenantId: TenantId;
    kind: BackgroundJobKind;
    payload: Record<string, unknown>;
    idempotencyKey?: string | null;
    priority?: number;
    maxAttempts?: number;
    runAfter?: Date;
  }): Promise<BackgroundJobRun>;
  claimNextBackgroundJob?(input: {
    workerId: string;
    now: Date;
    kinds?: BackgroundJobKind[];
    leaseTimeoutMs?: number;
  }): Promise<BackgroundJobRun | undefined>;
  completeBackgroundJob?(input: {
    tenantId: TenantId;
    jobId: string;
    finishedAt: Date;
    workerId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BackgroundJobRun | undefined>;
  failBackgroundJob?(input: {
    tenantId: TenantId;
    jobId: string;
    failedAt: Date;
    error: string;
    workerId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BackgroundJobRun | undefined>;
  listBackgroundJobs?(input: {
    tenantId: TenantId;
    status?: BackgroundJobStatus | null;
    limit: number;
  }): Promise<BackgroundJobRun[]>;
  listBackgroundJobEvents?(input: {
    tenantId: TenantId;
    jobId: string;
    limit: number;
  }): Promise<BackgroundJobEvent[]>;
  upsertBackgroundJobSchedule?(input: {
    id: string;
    tenantId: TenantId;
    kind: BackgroundJobKind;
    scheduleKey: string;
    payload: Record<string, unknown>;
    intervalSeconds: number;
    enabled: boolean;
    nextRunAt: Date;
  }): Promise<BackgroundJobSchedule>;
  listDueBackgroundJobSchedules?(input: {
    now: Date;
    limit: number;
  }): Promise<BackgroundJobSchedule[]>;
  markBackgroundJobScheduleEnqueued?(input: {
    tenantId: TenantId;
    scheduleId: string;
    enqueuedAt: Date;
  }): Promise<BackgroundJobSchedule | undefined>;
  listArchivedFileAssetsForCleanup?(input: {
    tenantId: TenantId;
    archivedBefore: Date;
    limit: number;
  }): Promise<FileAssetRecord[]>;
  markFileAssetPurged?(input: {
    tenantId: TenantId;
    assetId: string;
    purgedAt: Date;
  }): Promise<FileAssetRecord | undefined>;
  findCredentialByEmail?(
    email: string
  ): Promise<UserCredentialRecord | undefined>;
  upsertCredential?(input: UserCredentialRecord): Promise<void>;
  updateCredentialEmail?(
    tenantId: TenantId,
    userId: UserId,
    email: string
  ): Promise<void>;
  updateCredentialPassword?(
    tenantId: TenantId,
    userId: UserId,
    input: { passwordHash: string; passwordSalt: string }
  ): Promise<void>;
  createTenant?(input: { id: string; name: string }): Promise<void>;
  createSession?(input: UserSessionRecord): Promise<void>;
  findSessionByTokenHash?(
    tokenHash: string
  ): Promise<UserSessionRecord | undefined>;
  listUserSessions?(tenantId: TenantId, userId: UserId): Promise<UserSessionRecord[]>;
  touchSession?(tokenHash: string, lastSeenAt: Date): Promise<void>;
  deleteSessionByTokenHash?(tokenHash: string): Promise<void>;
  deleteSessionById?(tenantId: TenantId, userId: UserId, sessionId: string): Promise<boolean>;
  deleteSessionsByUserId?(tenantId: TenantId, userId: UserId): Promise<void>;
  createPasswordResetToken?(input: PasswordResetTokenRecord): Promise<void>;
  findPasswordResetTokenByHash?(
    tokenHash: string
  ): Promise<PasswordResetTokenRecord | undefined>;
  // Возвращает число затронутых строк (атомарное single-use: WHERE consumed_at IS NULL).
  markPasswordResetTokenConsumed?(
    tenantId: TenantId,
    id: string,
    consumedAt: Date
  ): Promise<number>;
  deletePasswordResetTokensByUserId?(
    tenantId: TenantId,
    userId: UserId
  ): Promise<void>;
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
  ensureWorkspaceGeneralChannel?(input: {
    tenantId: TenantId;
    createdByUserId: UserId;
    title?: string;
  }): Promise<CommunicationChannel>;
  createCommunicationChannel?(input: Omit<
    CommunicationChannel,
    "createdAt" | "updatedAt" | "archivedAt"
  >): Promise<CommunicationChannel>;
  updateCommunicationChannel?(input: {
    tenantId: TenantId;
    channelId: string;
    title?: string;
    description?: string;
  }): Promise<CommunicationChannel | undefined>;
  archiveCommunicationChannel?(input: {
    tenantId: TenantId;
    channelId: string;
  }): Promise<CommunicationChannel | undefined>;
  findCommunicationChannel?(
    tenantId: TenantId,
    channelId: string
  ): Promise<CommunicationChannel | undefined>;
  listCommunicationChannels?(input: {
    tenantId: TenantId;
    channelType?: CommunicationChannelType;
  }): Promise<CommunicationChannel[]>;
  upsertCommunicationChannelMember?(input: Omit<
    CommunicationChannelMember,
    "createdAt" | "archivedAt"
  >): Promise<CommunicationChannelMember>;
  archiveCommunicationChannelMember?(input: {
    tenantId: TenantId;
    channelId: string;
    userId: UserId;
  }): Promise<CommunicationChannelMember | undefined>;
  listCommunicationChannelMembers?(input: {
    tenantId: TenantId;
    channelId: string;
  }): Promise<CommunicationChannelMember[]>;
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
  addConversationMembers?(input: { tenantId: TenantId; conversationId: string; userIds: string[] }): Promise<void>;
  isConversationMember?(tenantId: TenantId, conversationId: string, userId: UserId): Promise<boolean>;
  listConversationMemberIds?(tenantId: TenantId, conversationId: string): Promise<string[]>;
  listDirectConversationsForUser?(tenantId: TenantId, userId: UserId): Promise<Conversation[]>;
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
  unpinDiscussionMessage?(input: {
    tenantId: TenantId;
    messageId: string;
  }): Promise<DiscussionMessage | undefined>;
  replaceMessageMentions?(input: {
    tenantId: TenantId;
    messageId: string;
    mentionedUserIds: UserId[];
  }): Promise<MessageMention[]>;
  listMessageMentions?(tenantId: TenantId, messageId: string): Promise<MessageMention[]>;
  upsertMessageReaction?(input: Omit<
    MessageReaction,
    "createdAt" | "archivedAt"
  >): Promise<MessageReaction>;
  archiveMessageReaction?(input: {
    tenantId: TenantId;
    messageId: string;
    reactionId: string;
    userId: UserId;
  }): Promise<MessageReaction | undefined>;
  listMessageReactionsByMessageIds?(input: {
    tenantId: TenantId;
    messageIds: string[];
  }): Promise<MessageReaction[]>;
  createStickerPack?(input: Omit<StickerPack, "createdAt" | "archivedAt">): Promise<StickerPack>;
  archiveStickerPack?(input: {
    tenantId: TenantId;
    packId: string;
  }): Promise<StickerPack | undefined>;
  listStickerPacks?(tenantId: TenantId): Promise<StickerPack[]>;
  createStickerAsset?(input: Omit<StickerAsset, "createdAt" | "archivedAt">): Promise<StickerAsset>;
  findStickerAsset?(tenantId: TenantId, stickerAssetId: string): Promise<StickerAsset | undefined>;
  archiveStickerAsset?(input: {
    tenantId: TenantId;
    stickerAssetId: string;
  }): Promise<StickerAsset | undefined>;
  listStickerAssets?(input: {
    tenantId: TenantId;
    packId: string;
  }): Promise<StickerAsset[]>;
  createMessageSticker?(input: Omit<MessageSticker, "createdAt">): Promise<MessageSticker>;
  listMessageStickersByMessageIds?(input: {
    tenantId: TenantId;
    messageIds: string[];
  }): Promise<MessageSticker[]>;
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
  countUnreadConversationMessagesForUser?(input: { tenantId: TenantId; userId: UserId }): Promise<number>;
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
  getTenantSecurityPolicy?(tenantId: TenantId): Promise<TenantSecurityPolicy>;
  upsertTenantSecurityPolicy?(
    tenantId: TenantId,
    policy: TenantSecurityPolicy
  ): Promise<TenantSecurityPolicy>;
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
  updateMeetingActionItem?(input: {
    tenantId: TenantId;
    meetingId: string;
    actionItemId: string;
    status: MeetingActionItemStatus;
  }): Promise<MeetingActionItem | undefined>;
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
  findActiveCallSessionByRoom?(input: {
    tenantId: TenantId;
    roomId: string;
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
  findCallRecordingByEgressId?(input: {
    tenantId: TenantId;
    egressId: string;
  }): Promise<CallRecording | undefined>;
  listCallRecordingsByGroup?(input: {
    tenantId: TenantId;
    recordingGroupId: string;
  }): Promise<CallRecording[]>;
  updateCallRecordingByEgress?(input: {
    tenantId: TenantId;
    egressId: string;
    status: CallRecording["status"];
    attachmentId?: string | null;
    durationSeconds?: number | null;
    endedAt?: Date | null;
  }): Promise<CallRecording | undefined>;
  failStaleInProgressRecordings?(input: {
    tenantId: TenantId;
    olderThan: Date;
  }): Promise<CallRecording[]>;
  createKnowledgeDocument?(input: Omit<
    KnowledgeDocument,
    "createdAt" | "updatedAt" | "archivedAt" | "currentVersionId"
  >): Promise<KnowledgeDocument>;
  findKnowledgeDocument?(input: {
    tenantId: TenantId;
    projectId: string;
    documentId: string;
  }): Promise<KnowledgeDocument | undefined>;
  findKnowledgeDocumentById?(input: {
    tenantId: TenantId;
    documentId: string;
  }): Promise<KnowledgeDocument | undefined>;
  listKnowledgeDocuments?(input: {
    tenantId: TenantId;
    projectId: string;
  }): Promise<KnowledgeDocument[]>;
  archiveKnowledgeDocument?(input: {
    tenantId: TenantId;
    projectId: string;
    documentId: string;
  }): Promise<KnowledgeDocument | undefined>;
  createKnowledgeDocumentVersion?(input: Omit<
    KnowledgeDocumentVersion,
    "createdAt" | "versionNumber"
  >): Promise<{ document: KnowledgeDocument; version: KnowledgeDocumentVersion }>;
  listKnowledgeDocumentVersions?(input: {
    tenantId: TenantId;
    documentId: string;
  }): Promise<KnowledgeDocumentVersion[]>;
  createDecisionLogEntry?(input: Omit<
    DecisionLogEntry,
    "createdAt" | "updatedAt" | "archivedAt"
  >): Promise<DecisionLogEntry>;
  updateDecisionLogEntry?(input: {
    tenantId: TenantId;
    projectId: string;
    decisionId: string;
    title: string;
    decision: string;
    rationale: string | null;
    status: DecisionLogEntry["status"];
  }): Promise<DecisionLogEntry | undefined>;
  findDecisionLogEntry?(input: {
    tenantId: TenantId;
    projectId: string;
    decisionId: string;
  }): Promise<DecisionLogEntry | undefined>;
  listDecisionLogEntries?(input: {
    tenantId: TenantId;
    projectId: string;
  }): Promise<DecisionLogEntry[]>;
  createKnowledgeActionItem?(input: Omit<
    KnowledgeActionItem,
    "createdAt" | "updatedAt" | "archivedAt"
  >): Promise<KnowledgeActionItem>;
  updateKnowledgeActionItem?(input: {
    tenantId: TenantId;
    projectId: string;
    actionItemId: string;
    title: string;
    description: string | null;
    ownerUserId: UserId;
    dueDate: string | null;
    status: KnowledgeActionItem["status"];
  }): Promise<KnowledgeActionItem | undefined>;
  findKnowledgeActionItem?(input: {
    tenantId: TenantId;
    projectId: string;
    actionItemId: string;
  }): Promise<KnowledgeActionItem | undefined>;
  listKnowledgeActionItems?(input: {
    tenantId: TenantId;
    projectId: string;
  }): Promise<KnowledgeActionItem[]>;
  findProjectMeeting?(input: {
    tenantId: TenantId;
    projectId: string;
    meetingId: string;
  }): Promise<{ id: string } | undefined>;
  searchKnowledge?(input: {
    tenantId: TenantId;
    query: string;
    limit: number;
  }): Promise<{
    documents: KnowledgeDocument[];
    decisions: DecisionLogEntry[];
    actionItems: KnowledgeActionItem[];
  }>;
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
  egressProvider?: LiveKitEgressProvider | null;
  authRateLimiter?: AuthRateLimiter;
  emailProvider?: EmailProvider;
  readinessChecks?: ReadinessChecks;
  secureCookies?: boolean;
  trustedMutationOrigins?: string[];
  trustForwardedAuthHeaders?: boolean;
  enableDevTenantRoutes?: boolean;
};
