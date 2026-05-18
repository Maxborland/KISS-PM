import type { AccessProfile } from "@kiss-pm/access-control";
import type { Tenant, TenantId, TenantUser, UserId } from "@kiss-pm/domain";

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
};
