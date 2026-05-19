import type { AccessProfile } from "@kiss-pm/access-control";
import type { Tenant, TenantId, TenantUser, UserId } from "@kiss-pm/domain";
import type {
  OpportunityActivityInput,
  OpportunityActivityRecord,
  OpportunityActivityTransitionResult,
  OpportunityActivityUpdateInput,
  TaskInput,
  TaskRecord
} from "@kiss-pm/persistence";

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
  | "customFieldValues"
> & {
  customFieldValues?: OpportunityCustomFieldValues;
};
export type OpportunityUpdateInput = Omit<
  OpportunityInput,
  "id" | "clientName" | "contactName" | "projectType" | "status"
>;

export type ProjectRecord = {
  id: string;
  tenantId: TenantId;
  sourceOpportunityId: string;
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
  demand: PositionDemandRecord[];
};

export type ProjectInput = Omit<ProjectRecord, "createdAt" | "activatedAt">;
export type ProjectDraftActivationInput = {
  tenantId: TenantId;
  projectId: string;
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
  updateOpportunity?(input: OpportunityInput): Promise<OpportunityRecord>;
  updateOpportunityFeasibility?(input: {
    tenantId: TenantId;
    opportunityId: string;
    status: string;
    feasibilityStatus: string;
    feasibilityResult: Record<string, unknown>;
  }): Promise<OpportunityRecord>;
  updateOpportunityStage?(input: {
    tenantId: TenantId;
    opportunityId: string;
    stageId: string;
  }): Promise<OpportunityRecord>;
  finalizeOpportunity?(input: {
    tenantId: TenantId;
    opportunityId: string;
    status: OpportunityFinalStatus;
  }): Promise<OpportunityRecord | undefined>;
  listOpportunityActivities?(
    tenantId: TenantId,
    opportunityId: string
  ): Promise<OpportunityActivityRecord[]>;
  createOpportunityActivity?(
    input: OpportunityActivityInput
  ): Promise<OpportunityActivityRecord>;
  updateOpportunityActivity?(
    input: OpportunityActivityUpdateInput
  ): Promise<OpportunityActivityRecord | undefined>;
  transitionOpportunityActivityStatus?(
    input: OpportunityActivityUpdateInput
  ): Promise<OpportunityActivityTransitionResult>;
  listProjects?(tenantId: TenantId): Promise<ProjectRecord[]>;
  createProjectDraftFromOpportunity?(input: ProjectInput): Promise<ProjectRecord>;
  activateProjectDraft?(input: ProjectDraftActivationInput): Promise<ProjectRecord>;
  listProjectTasks?(tenantId: TenantId, projectId: string): Promise<TaskRecord[]>;
  listMyWorkTasks?(tenantId: TenantId, userId: UserId): Promise<TaskRecord[]>;
  createTask?(input: TaskInput): Promise<TaskRecord>;
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
  withTransaction?<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  lockTenantResourcePlanning?(tenantId: TenantId): Promise<void>;
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
  listAuditEventsByTenantId?(tenantId: TenantId): Promise<AuditEventListItem[]>;
};

export type CreateAppOptions = {
  dataSource?: ApiTenantDataSource;
  secureCookies?: boolean;
  enableDevTenantRoutes?: boolean;
};
