import { and, desc, eq, gt, gte, isNull, lt, lte, ne, or, sql } from "drizzle-orm";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { Tenant, TenantId, TenantUser, UserId } from "@kiss-pm/domain";

import {
  type AuditEventRecord,
  type AuditEventRecordInput,
  createAuditEventRecord
} from "./auditEvent";
import { createBackgroundJobRepository, type BackgroundJobRepository } from "./backgroundJobRepository";
import type { KissPmDatabase } from "./connection";
import {
  accessProfiles,
  auditEvents,
  passwordResetTokens,
  positions,
  tenants,
  tenantUsers,
  userCredentials,
  userSessions,
  writeFlowIdempotencyKeys
} from "./schema";
import { createAttachmentRepository, type AttachmentRepository } from "./attachmentRepository";
import { createCollaborationRepository, type CollaborationRepository } from "./collaborationRepository";
import { createCrmActivityRepository, type CrmActivityRepository } from "./crmActivityRepository";
import { createControlRepository, type ControlRepository } from "./controlRepository";
import { createControlSurfaceRepository, type ControlSurfaceRepository } from "./controlSurfaceRepository";
import { createKnowledgeRepository, type KnowledgeRepository } from "./knowledgeRepository";
import { createPlanningRepository, type PlanningRepository } from "./planningRepository";
import { createPlanningSavedViewsRepository, type PlanningSavedViewsRepository } from "./planningSavedViewsRepository";
import { createProjectIntakeRepository, type ProjectIntakeRepository } from "./projectIntakeRepository";
import { createProjectWorkRepository, type ProjectWorkRepository } from "./projectWorkRepository";
import { createOccupancyRepository, type OccupancyRepository } from "./occupancyRepository";
import { createResourceAbsencesRepository, type ResourceAbsencesRepository } from "./resourceAbsencesRepository";
import { createRetrospectiveRepository, type RetrospectiveRepository } from "./retrospectiveRepository";
import { createTenantProductionCalendarRepository, type TenantProductionCalendarRepository } from "./tenantProductionCalendarRepository";
import { createTenantSecurityPolicyRepository, type TenantSecurityPolicyRepository } from "./tenantSecurityPolicyRepository";
import {
  createCrmRepository,
  type ClientInput,
  type ClientRecord,
  type ContactInput,
  type ContactRecord,
  type CrmPipelineInput,
  type CrmPipelineStageAutomationDefinitionInput,
  type CrmPipelineStageInput,
  type CrmPipelineTransitionRuleInput,
  type CrmRepository,
  type DealStageInput,
  type DealStageRecord,
  type ProductInput,
  type ProductRecord,
  type ProjectTypeInput,
  type ProjectTypeRecord
} from "./crmRepository";
import {
  mapAccessProfileRecord,
  mapPositionRecord,
  mapTenantUser,
  mapWorkspaceUserRecord,
  toPermission
} from "./repositoryMappers";
import { createWorkspaceConfigRepository } from "./workspaceConfigRepository";

export type PersistedAccessProfile = AccessProfile;
export type AccessProfileRecord = AccessProfile & {
  tenantId: TenantId;
  name: string;
};
export type AuditEventListItem = AuditEventRecord;
/** Keyset-курсор ленты аудита: сортировка (createdAt desc, id desc) стабильна и уникальна. */
export type AuditEventCursor = { createdAt: Date; id: string };
/** Серверные фильтры + keyset-пагинация журнала аудита (см. auditRoutes). */
export type AuditEventQueryOptions = {
  limit?: number;
  projectId?: string | null;
  actorUserId?: string | null;
  actionType?: string | null;
  executionResult?: string | null;
  fromDate?: Date | null;
  toDate?: Date | null;
  cursor?: AuditEventCursor | null;
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
export type CustomFieldDefinitionInput = Omit<CustomFieldDefinitionRecord, "createdAt" | "updatedAt">;
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
export type ProjectTemplateInput = Omit<ProjectTemplateRecord, "createdAt" | "updatedAt">;
export type { ClientInput, ClientRecord, ContactInput, ContactRecord, CrmPipelineInput, CrmPipelineStageAutomationDefinitionInput, CrmPipelineStageInput, CrmPipelineTransitionRuleInput, DealStageInput, DealStageRecord, ProductInput, ProductRecord, ProjectTypeInput, ProjectTypeRecord };
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
export type WriteFlowIdempotencyClaim = {
  claimed: boolean;
  resourceId: string;
  // true when an existing key was found but with a DIFFERENT request hash (same clientRequestId
  // reused for a different payload). The caller must reject with 409 rather than return the old row.
  conflict: boolean;
};

export type PostgresTenantDataSource = CrmRepository &
  ProjectIntakeRepository &
  PlanningRepository &
  PlanningSavedViewsRepository &
  ProjectWorkRepository &
  TenantProductionCalendarRepository &
  TenantSecurityPolicyRepository &
  ResourceAbsencesRepository &
  OccupancyRepository &
  ControlRepository &
  ControlSurfaceRepository &
  KnowledgeRepository &
  RetrospectiveRepository &
  AttachmentRepository &
  BackgroundJobRepository &
  CollaborationRepository &
  CrmActivityRepository & {
  db: KissPmDatabase;
  listDevUsers(): Promise<TenantUser[]>;
  findUserById(userId: UserId): Promise<TenantUser | undefined>;
  findTenantById(tenantId: TenantId): Promise<Tenant | undefined>;
  listTenants(): Promise<Tenant[]>;
  findAccessProfileById(
    tenantId: TenantId,
    accessProfileId: string
  ): Promise<PersistedAccessProfile | undefined>;
  listUsersByTenantId(tenantId: TenantId): Promise<TenantUser[]>;
  listAccessProfilesByTenantId(tenantId: TenantId): Promise<AccessProfileRecord[]>;
  createAccessProfile(input: AccessProfileRecord): Promise<AccessProfileRecord>;
  updateAccessProfile(input: AccessProfileRecord): Promise<AccessProfileRecord>;
  deleteAccessProfile(tenantId: TenantId, accessProfileId: string): Promise<void>;
  listWorkspaceUsers(tenantId: TenantId): Promise<WorkspaceUserRecord[]>;
  createWorkspaceUser(input: Omit<WorkspaceUserRecord, "positionName">): Promise<WorkspaceUserRecord>;
  updateWorkspaceUser(input: Omit<WorkspaceUserRecord, "positionName">): Promise<WorkspaceUserRecord>;
  deleteWorkspaceUser(tenantId: TenantId, userId: UserId): Promise<void>;
  listPositions(tenantId: TenantId): Promise<PositionRecord[]>;
  createPosition(input: PositionRecord): Promise<PositionRecord>;
  updatePosition(input: PositionRecord): Promise<PositionRecord>;
  deletePosition(tenantId: TenantId, positionId: string): Promise<void>;
  listCustomFieldDefinitions(
    tenantId: TenantId
  ): Promise<CustomFieldDefinitionRecord[]>;
  createCustomFieldDefinition(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  deleteCustomFieldDefinition(
    tenantId: TenantId,
    fieldId: string
  ): Promise<CustomFieldDefinitionRecord | undefined>;
  updateCustomFieldDefinition(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  listProjectTemplates(tenantId: TenantId): Promise<ProjectTemplateRecord[]>;
  createProjectTemplate(input: ProjectTemplateInput): Promise<ProjectTemplateRecord>;
  updateProjectTemplate(input: ProjectTemplateInput): Promise<ProjectTemplateRecord>;
  findCredentialByEmail(email: string): Promise<UserCredentialRecord | undefined>;
  upsertCredential(input: UserCredentialRecord): Promise<void>;
  updateCredentialEmail(tenantId: TenantId, userId: UserId, email: string): Promise<void>;
  updateCredentialPassword(
    tenantId: TenantId,
    userId: UserId,
    input: { passwordHash: string; passwordSalt: string }
  ): Promise<void>;
  createTenant(input: { id: string; name: string }): Promise<void>;
  createSession(input: UserSessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | undefined>;
  listUserSessions(tenantId: TenantId, userId: UserId): Promise<UserSessionRecord[]>;
  touchSession(tokenHash: string, lastSeenAt: Date): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteSessionById(tenantId: TenantId, userId: UserId, sessionId: string): Promise<boolean>;
  deleteSessionsByUserId(tenantId: TenantId, userId: UserId): Promise<void>;
  createPasswordResetToken(input: PasswordResetTokenRecord): Promise<void>;
  findPasswordResetTokenByHash(
    tokenHash: string
  ): Promise<PasswordResetTokenRecord | undefined>;
  // Возвращает число затронутых строк: 1 — токен погашен этим вызовом, 0 —
  // он уже был погашен (гонка двойного использования). Условие IS NULL делает
  // погашение атомарным, а вызывающий код проверяет результат внутри транзакции.
  markPasswordResetTokenConsumed(
    tenantId: TenantId,
    id: string,
    consumedAt: Date
  ): Promise<number>;
  deletePasswordResetTokensByUserId(
    tenantId: TenantId,
    userId: UserId
  ): Promise<void>;
  deleteOtherPasswordResetTokensByUserId(
    tenantId: TenantId,
    userId: UserId,
    preservedTokenId: string
  ): Promise<void>;
  withTransaction<T>(
    operation: (transactionDataSource: PostgresTenantDataSource) => Promise<T>
  ): Promise<T>;
  lockTenantResourcePlanning(tenantId: TenantId): Promise<void>;
  lockCallRecordingStart(tenantId: TenantId, roomId: string, sessionId: string): Promise<void>;
  claimWriteFlowIdempotencyKey(input: {
    tenantId: TenantId;
    actorUserId: UserId;
    surface: string;
    clientRequestId: string;
    resourceId: string;
    requestHash?: string;
  }): Promise<WriteFlowIdempotencyClaim>;
  appendAuditEvent(input: AuditEventRecordInput): Promise<void>;
  listAuditEventsByTenantId(
    tenantId: TenantId,
    options?: AuditEventQueryOptions
  ): Promise<AuditEventListItem[]>;
  /** Точечная выборка audit-события (tenant-scoped): адресуемые квитанции агента
      не должны зависеть от окна limit ленты. */
  getAuditEventById(
    tenantId: TenantId,
    auditEventId: string
  ): Promise<AuditEventListItem | undefined>;
};

// Маппер строки токена сброса пароля в доменную запись (Date↔timestamptz, nullable-поля).
function mapPasswordResetTokenRecord(row: {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  requestedIp: string | null;
  createdAt: Date;
}): PasswordResetTokenRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    requestedIp: row.requestedIp,
    createdAt: row.createdAt
  };
}

export function createPostgresTenantDataSource(
  db: KissPmDatabase
): PostgresTenantDataSource {
  return {
    db,
    ...createCrmRepository(db),
    ...createControlRepository(db),
    ...createControlSurfaceRepository(db),
    ...createKnowledgeRepository(db),
    ...createRetrospectiveRepository(db),
    ...createProjectIntakeRepository(db),
    ...createPlanningRepository(db),
    ...createPlanningSavedViewsRepository(db),
    ...createProjectWorkRepository(db),
    ...createTenantProductionCalendarRepository(db),
    ...createTenantSecurityPolicyRepository(db),
    ...createResourceAbsencesRepository(db),
    ...createOccupancyRepository(db),
    ...createAttachmentRepository(db),
    ...createBackgroundJobRepository(db),
    ...createCollaborationRepository(db),
    ...createCrmActivityRepository(db),
    ...createWorkspaceConfigRepository(db),
    async listDevUsers() {
      const rows = await db.select().from(tenantUsers).orderBy(tenantUsers.id);
      return rows.map(mapTenantUser);
    },
    async findUserById(userId) {
      const [row] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.id, userId))
        .limit(1);

      return row ? mapTenantUser(row) : undefined;
    },
    async findTenantById(tenantId) {
      const [row] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return row
        ? {
            id: row.id,
            name: row.name
          }
        : undefined;
    },
    async listTenants() {
      const rows = await db.select().from(tenants).orderBy(tenants.id);
      return rows.map((row) => ({
        id: row.id,
        name: row.name
      }));
    },
    async findAccessProfileById(tenantId, accessProfileId) {
      const [row] = await db
        .select()
        .from(accessProfiles)
        .where(
          and(
            eq(accessProfiles.tenantId, tenantId),
            eq(accessProfiles.id, accessProfileId)
          )
        )
        .limit(1);

      return row
        ? {
            id: row.id,
            permissions: row.permissions.map(toPermission)
          }
        : undefined;
    },
    async listUsersByTenantId(tenantId) {
      const rows = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .orderBy(tenantUsers.id);

      return rows.map(mapTenantUser);
    },
    async listAccessProfilesByTenantId(tenantId) {
      const rows = await db
        .select()
        .from(accessProfiles)
        .where(eq(accessProfiles.tenantId, tenantId))
        .orderBy(accessProfiles.id);

      return rows.map(mapAccessProfileRecord);
    },
    async createAccessProfile(input) {
      const [row] = await db
        .insert(accessProfiles)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          name: input.name,
          permissions: input.permissions.map(toPermission),
          createdAt: new Date()
        })
        .returning();

      if (!row) {
        throw new Error("Access profile insert returned no row");
      }

      return mapAccessProfileRecord(row);
    },
    async updateAccessProfile(input) {
      const [row] = await db
        .update(accessProfiles)
        .set({
          name: input.name,
          permissions: input.permissions.map(toPermission)
        })
        .where(
          and(
            eq(accessProfiles.tenantId, input.tenantId),
            eq(accessProfiles.id, input.id)
          )
        )
        .returning();

      if (!row) {
        throw new Error("Access profile update returned no row");
      }

      return mapAccessProfileRecord(row);
    },
    async deleteAccessProfile(tenantId, accessProfileId) {
      await db
        .delete(accessProfiles)
        .where(
          and(
            eq(accessProfiles.tenantId, tenantId),
            eq(accessProfiles.id, accessProfileId)
          )
        );
    },
    async listWorkspaceUsers(tenantId) {
      const rows = await db
        .select({
          user: tenantUsers,
          positionName: positions.name
        })
        .from(tenantUsers)
        .leftJoin(
          positions,
          and(
            eq(positions.tenantId, tenantUsers.tenantId),
            eq(positions.id, tenantUsers.positionId)
          )
        )
        .where(eq(tenantUsers.tenantId, tenantId))
        .orderBy(tenantUsers.name);

      return rows.map((row) => mapWorkspaceUserRecord(row.user, row.positionName));
    },
    async createWorkspaceUser(input) {
      const [row] = await db
        .insert(tenantUsers)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          accessProfileId: input.accessProfileId,
          positionId: input.positionId,
          email: input.email,
          name: input.name,
          phone: input.phone,
          telegram: input.telegram,
          status: input.status,
          theme: input.theme,
          accentColor: input.accentColor,
          createdAt: new Date()
        })
        .returning();

      if (!row) {
        throw new Error("User insert returned no row");
      }

      const position = input.positionId
        ? (await this.listPositions(input.tenantId)).find(
            (item) => item.id === input.positionId
          )
        : undefined;

      return mapWorkspaceUserRecord(row, position?.name ?? null);
    },
    async updateWorkspaceUser(input) {
      const [row] = await db
        .update(tenantUsers)
        .set({
          accessProfileId: input.accessProfileId,
          positionId: input.positionId,
          email: input.email,
          name: input.name,
          phone: input.phone,
          telegram: input.telegram,
          status: input.status,
          theme: input.theme,
          accentColor: input.accentColor
        })
        .where(
          and(eq(tenantUsers.tenantId, input.tenantId), eq(tenantUsers.id, input.id))
        )
        .returning();

      if (!row) {
        throw new Error("User update returned no row");
      }

      const position = input.positionId
        ? (await this.listPositions(input.tenantId)).find(
            (item) => item.id === input.positionId
          )
        : undefined;

      return mapWorkspaceUserRecord(row, position?.name ?? null);
    },
    async deleteWorkspaceUser(tenantId, userId) {
      await db
        .delete(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.id, userId)));
    },
    async listPositions(tenantId) {
      const rows = await db
        .select()
        .from(positions)
        .where(eq(positions.tenantId, tenantId))
        .orderBy(positions.name);

      return rows.map(mapPositionRecord);
    },
    async createPosition(input) {
      const [row] = await db
        .insert(positions)
        .values({
          ...input,
          createdAt: new Date()
        })
        .returning();

      if (!row) {
        throw new Error("Position insert returned no row");
      }

      return mapPositionRecord(row);
    },
    async updatePosition(input) {
      const [row] = await db
        .update(positions)
        .set({
          name: input.name,
          description: input.description
        })
        .where(
          and(eq(positions.tenantId, input.tenantId), eq(positions.id, input.id))
        )
        .returning();

      if (!row) {
        throw new Error("Position update returned no row");
      }

      return mapPositionRecord(row);
    },
    async deletePosition(tenantId, positionId) {
      await db
        .delete(positions)
        .where(and(eq(positions.tenantId, tenantId), eq(positions.id, positionId)));
    },
    async findCredentialByEmail(email) {
      const [row] = await db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.email, email.toLowerCase()))
        .limit(1);

      return row
        ? {
            userId: row.userId,
            tenantId: row.tenantId,
            email: row.email,
            passwordHash: row.passwordHash,
            passwordSalt: row.passwordSalt
          }
        : undefined;
    },
    async upsertCredential(input) {
      await db
        .insert(userCredentials)
        .values({
          ...input,
          email: input.email.toLowerCase(),
          createdAt: new Date()
        })
        .onConflictDoUpdate({
          target: userCredentials.userId,
          set: {
            tenantId: input.tenantId,
            email: input.email.toLowerCase(),
            passwordHash: input.passwordHash,
            passwordSalt: input.passwordSalt
          }
        });
    },
    async updateCredentialEmail(tenantId, userId, email) {
      await db
        .update(userCredentials)
        .set({
          email: email.toLowerCase()
        })
        .where(
          and(
            eq(userCredentials.tenantId, tenantId),
            eq(userCredentials.userId, userId)
          )
        );
    },
    async updateCredentialPassword(tenantId, userId, input) {
      await db
        .update(userCredentials)
        .set({
          passwordHash: input.passwordHash,
          passwordSalt: input.passwordSalt
        })
        .where(
          and(
            eq(userCredentials.tenantId, tenantId),
            eq(userCredentials.userId, userId)
          )
        );
    },
    async createTenant(input) {
      await db.insert(tenants).values({
        id: input.id,
        name: input.name,
        createdAt: new Date()
      });
    },
    async createSession(input) {
      const now = new Date();
      await db.insert(userSessions).values({
        ...input,
        createdAt: now,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        lastSeenAt: input.lastSeenAt ?? now
      });
    },
    async findSessionByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.tokenHash, tokenHash))
        .limit(1);

      return row ? mapUserSession(row) : undefined;
    },
    async listUserSessions(tenantId, userId) {
      const rows = await db
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.tenantId, tenantId),
            eq(userSessions.userId, userId),
            gt(userSessions.expiresAt, new Date())
          )
        )
        .orderBy(desc(userSessions.lastSeenAt), desc(userSessions.createdAt));
      return rows.map(mapUserSession);
    },
    async touchSession(tokenHash, lastSeenAt) {
      await db
        .update(userSessions)
        .set({ lastSeenAt })
        .where(eq(userSessions.tokenHash, tokenHash));
    },
    async deleteSessionByTokenHash(tokenHash) {
      await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
    },
    async deleteSessionById(tenantId, userId, sessionId) {
      const deleted = await db
        .delete(userSessions)
        .where(
          and(
            eq(userSessions.tenantId, tenantId),
            eq(userSessions.userId, userId),
            eq(userSessions.id, sessionId)
          )
        )
        .returning({ id: userSessions.id });
      return deleted.length > 0;
    },
    async deleteSessionsByUserId(tenantId, userId) {
      await db
        .delete(userSessions)
        .where(and(eq(userSessions.tenantId, tenantId), eq(userSessions.userId, userId)));
    },
    async createPasswordResetToken(input) {
      await db.insert(passwordResetTokens).values({
        id: input.id,
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        consumedAt: input.consumedAt,
        requestedIp: input.requestedIp,
        createdAt: input.createdAt
      });
    },
    async findPasswordResetTokenByHash(tokenHash) {
      const [row] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);

      return row ? mapPasswordResetTokenRecord(row) : undefined;
    },
    async markPasswordResetTokenConsumed(tenantId, id, consumedAt) {
      // Атомарное одноразовое погашение: WHERE ... AND consumed_at IS NULL.
      // .returning() даёт реально обновлённые строки — длина 0 означает, что
      // токен уже был погашен (параллельный confirm), и вызывающий код прервёт
      // транзакцию с reset_token_used.
      const rows = await db
        .update(passwordResetTokens)
        .set({ consumedAt })
        .where(
          and(
            eq(passwordResetTokens.tenantId, tenantId),
            eq(passwordResetTokens.id, id),
            isNull(passwordResetTokens.consumedAt)
          )
        )
        .returning({ id: passwordResetTokens.id });
      return rows.length;
    },
    async deletePasswordResetTokensByUserId(tenantId, userId) {
      await db
        .delete(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tenantId, tenantId),
            eq(passwordResetTokens.userId, userId)
          )
        );
    },
    async deleteOtherPasswordResetTokensByUserId(tenantId, userId, preservedTokenId) {
      await db
        .delete(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tenantId, tenantId),
            eq(passwordResetTokens.userId, userId),
            ne(passwordResetTokens.id, preservedTokenId)
          )
        );
    },
    async withTransaction(operation) {
      return db.transaction((transaction) =>
        operation(
          createPostgresTenantDataSource(
            transaction as unknown as KissPmDatabase
          )
        )
      );
    },
    async lockTenantResourcePlanning(tenantId) {
      await db.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${tenantId}),
          hashtext('kiss_pm_resource_planning')
        )
      `);
    },
    async lockCallRecordingStart(tenantId, roomId, sessionId) {
      await db.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${tenantId}),
          hashtext(${`call_recording_start:${roomId}:${sessionId}`})
        )
      `);
    },
    async claimWriteFlowIdempotencyKey(input) {
      const [inserted] = await db
        .insert(writeFlowIdempotencyKeys)
        .values({
          tenantId: input.tenantId,
          surface: input.surface,
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          resourceId: input.resourceId,
          requestHash: input.requestHash ?? null,
          createdAt: new Date()
        })
        .onConflictDoNothing({
          target: [
            writeFlowIdempotencyKeys.tenantId,
            writeFlowIdempotencyKeys.surface,
            writeFlowIdempotencyKeys.actorUserId,
            writeFlowIdempotencyKeys.clientRequestId
          ]
        })
        .returning({ resourceId: writeFlowIdempotencyKeys.resourceId });
      if (inserted) return { claimed: true, resourceId: inserted.resourceId, conflict: false };

      const [existing] = await db
        .select({
          resourceId: writeFlowIdempotencyKeys.resourceId,
          requestHash: writeFlowIdempotencyKeys.requestHash
        })
        .from(writeFlowIdempotencyKeys)
        .where(
          and(
            eq(writeFlowIdempotencyKeys.tenantId, input.tenantId),
            eq(writeFlowIdempotencyKeys.surface, input.surface),
            eq(writeFlowIdempotencyKeys.actorUserId, input.actorUserId),
            eq(writeFlowIdempotencyKeys.clientRequestId, input.clientRequestId)
          )
        )
        .limit(1);
      if (!existing) throw new Error("write_flow_idempotency_key_missing");
      // Same key, different payload → conflict (otherwise the caller returns the OLD resource as a
      // success and silently drops the new content). Legacy rows (null stored hash) are treated as
      // non-conflicting so pre-migration keys keep replaying rather than hard-failing.
      const conflict =
        input.requestHash != null &&
        existing.requestHash != null &&
        existing.requestHash !== input.requestHash;
      return { claimed: false, resourceId: existing.resourceId, conflict };
    },
    async appendAuditEvent(input) {
      const event = createAuditEventRecord(input);

      await db.insert(auditEvents).values({
        id: event.id,
        tenantId: event.tenantId,
        actorUserId: event.actorUserId,
        actionType: event.actionType,
        sourceSurfaceId: event.sourceSurfaceId,
        sourceWorkflow: event.sourceWorkflow,
        sourceEntity: event.sourceEntity,
        input: event.input,
        beforeState: event.beforeState,
        afterState: event.afterState,
        permissionResult: event.permissionResult,
        executionResult: event.executionResult,
        correlationId: event.correlationId,
        createdAt: event.createdAt
      });
    },
    async listAuditEventsByTenantId(tenantId, options) {
      const filters = [eq(auditEvents.tenantId, tenantId)];
      if (options?.projectId) {
        filters.push(
          sql`${auditEvents.sourceEntity} ->> 'type' = 'Project'`,
          sql`${auditEvents.sourceEntity} ->> 'id' = ${options.projectId}`
        );
      }
      if (options?.actorUserId) {
        filters.push(eq(auditEvents.actorUserId, options.actorUserId));
      }
      if (options?.actionType) {
        filters.push(eq(auditEvents.actionType, options.actionType));
      }
      if (options?.executionResult) {
        filters.push(sql`${auditEvents.executionResult} ->> 'status' = ${options.executionResult}`);
      }
      if (options?.fromDate) {
        filters.push(gte(auditEvents.createdAt, options.fromDate));
      }
      if (options?.toDate) {
        filters.push(lte(auditEvents.createdAt, options.toDate));
      }
      // Keyset: строго «после» курсора в порядке (createdAt desc, id desc).
      if (options?.cursor) {
        const keyset = or(
          lt(auditEvents.createdAt, options.cursor.createdAt),
          and(
            eq(auditEvents.createdAt, options.cursor.createdAt),
            lt(auditEvents.id, options.cursor.id)
          )
        );
        if (keyset) filters.push(keyset);
      }
      const buildQuery = () =>
        db
          .select()
          .from(auditEvents)
          .where(and(...filters))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
      const rows =
        options?.limit === undefined
          ? await buildQuery()
          : await buildQuery().limit(options.limit);

      return rows.map(mapAuditEventRow);
    },
    async getAuditEventById(tenantId, auditEventId) {
      const [row] = await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.tenantId, tenantId), eq(auditEvents.id, auditEventId)))
        .limit(1);
      return row ? mapAuditEventRow(row) : undefined;
    }
  };
}

function mapAuditEventRow(row: typeof auditEvents.$inferSelect): AuditEventListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    actionType: row.actionType,
    sourceSurfaceId: row.sourceSurfaceId,
    sourceWorkflow: row.sourceWorkflow,
    sourceEntity: row.sourceEntity,
    input: row.input,
    beforeState: row.beforeState ?? null,
    afterState: row.afterState ?? null,
    permissionResult: row.permissionResult,
    executionResult: row.executionResult,
    correlationId: row.correlationId,
    createdAt: row.createdAt
  };
}

function mapUserSession(row: typeof userSessions.$inferSelect): UserSessionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    lastSeenAt: row.lastSeenAt
  };
}
