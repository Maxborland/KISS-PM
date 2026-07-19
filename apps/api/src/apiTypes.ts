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
  AuditEventRecord,
  OpportunityInput,
  PostgresTenantDataSource,
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

// Каноническая запись аудита живёт в persistence (sourceEntity: AuditSourceEntity).
export type AuditEventListItem = AuditEventRecord;

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

// Канонические формы стадий воронки живут в persistence (pipelineId: string — без legacy-null).
export type { DealStageInput, DealStageRecord } from "@kiss-pm/persistence";

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

// Канонические формы opportunity живут в persistence (status: OpportunityStatus-union).
export type { OpportunityInput, OpportunityRecord } from "@kiss-pm/persistence";
export type OpportunityUpdateInput = Omit<
  OpportunityInput,
  "id" | "clientName" | "contactName" | "projectType" | "status"
>;

// Канонические формы проекта живут в persistence (status: ProjectStatus-union).
export type { ProjectInput, ProjectRecord } from "@kiss-pm/persistence";
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

// Контракт данных принадлежит persistence и ОБЯЗАТЕЛЕН статически. Частичные
// источники (in-memory dev-fallback, тестовые фикстуры) — поддерживаемый режим:
// они легализуются на границе ensureCompleteDataSource, а их неполноту
// обслуживают in-пробы состава и capability-guard'ы маршрутов (в т.ч.
// fail-closed-инварианты и ?.-обогащения). Прод-источник всегда полный.
export type ApiTenantDataSource = PostgresTenantDataSource;

export type CreateAppOptions = {
  // Принимает частичный источник (unit-фикстуры, in-memory): createApp
  // легализует его в полный ТИП на границе ensureCompleteDataSource (cast);
  // рантайм-неполноту обслуживают in-пробы и capability-guard'ы маршрутов.
  dataSource?: Partial<ApiTenantDataSource>;
  storageProvider?: StorageProvider;
  videoProvider?: VideoProvider;
  egressProvider?: LiveKitEgressProvider | null;
  authRateLimiter?: AuthRateLimiter;
  // Honest-флаг для /health: server.ts передаёт runtimeConfig.backgroundJobsEnabled;
  // без опции (unit-тесты, dev-fallback) воркер не запущен — false.
  backgroundJobsEnabled?: boolean;
  emailProvider?: EmailProvider;
  readinessChecks?: ReadinessChecks;
  secureCookies?: boolean;
  trustedMutationOrigins?: string[];
  trustForwardedAuthHeaders?: boolean;
  enableDevTenantRoutes?: boolean;
};
