import { and, desc, eq, sql } from "drizzle-orm";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { Tenant, TenantId, TenantUser, UserId } from "@kiss-pm/domain";

import {
  type AuditEventRecord,
  type AuditEventRecordInput,
  createAuditEventRecord
} from "./auditEvent";
import type { KissPmDatabase } from "./connection";
import {
  accessProfiles,
  auditEvents,
  positions,
  tenants,
  tenantUsers,
  userCredentials,
  userSessions
} from "./schema";
import { createAttachmentRepository, type AttachmentRepository } from "./attachmentRepository";
import { createCrmActivityRepository, type CrmActivityRepository } from "./crmActivityRepository";
import { createControlRepository, type ControlRepository } from "./controlRepository";
import { createControlSurfaceRepository, type ControlSurfaceRepository } from "./controlSurfaceRepository";
import { createPlanningRepository, type PlanningRepository } from "./planningRepository";
import { createPlanningSavedViewsRepository, type PlanningSavedViewsRepository } from "./planningSavedViewsRepository";
import { createProjectIntakeRepository, type ProjectIntakeRepository } from "./projectIntakeRepository";
import { createProjectWorkRepository, type ProjectWorkRepository } from "./projectWorkRepository";
import { createResourceAbsencesRepository, type ResourceAbsencesRepository } from "./resourceAbsencesRepository";
import { createRetrospectiveRepository, type RetrospectiveRepository } from "./retrospectiveRepository";
import { createTenantProductionCalendarRepository, type TenantProductionCalendarRepository } from "./tenantProductionCalendarRepository";
import {
  createCrmRepository,
  type ClientInput,
  type ClientRecord,
  type ContactInput,
  type ContactRecord,
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
export type { ClientInput, ClientRecord, ContactInput, ContactRecord, DealStageInput, DealStageRecord, ProductInput, ProductRecord, ProjectTypeInput, ProjectTypeRecord };
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
export type PostgresTenantDataSource = CrmRepository &
  ProjectIntakeRepository &
  PlanningRepository &
  PlanningSavedViewsRepository &
  ProjectWorkRepository &
  TenantProductionCalendarRepository &
  ResourceAbsencesRepository &
  ControlRepository &
  ControlSurfaceRepository &
  RetrospectiveRepository &
  AttachmentRepository &
  CrmActivityRepository & {
  db: KissPmDatabase;
  listDevUsers(): Promise<TenantUser[]>;
  findUserById(userId: UserId): Promise<TenantUser | undefined>;
  findTenantById(tenantId: TenantId): Promise<Tenant | undefined>;
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
  updateCustomFieldDefinition(
    input: CustomFieldDefinitionInput
  ): Promise<CustomFieldDefinitionRecord>;
  listProjectTemplates(tenantId: TenantId): Promise<ProjectTemplateRecord[]>;
  createProjectTemplate(input: ProjectTemplateInput): Promise<ProjectTemplateRecord>;
  updateProjectTemplate(input: ProjectTemplateInput): Promise<ProjectTemplateRecord>;
  findCredentialByEmail(email: string): Promise<UserCredentialRecord | undefined>;
  upsertCredential(input: UserCredentialRecord): Promise<void>;
  updateCredentialEmail(tenantId: TenantId, userId: UserId, email: string): Promise<void>;
  createSession(input: UserSessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | undefined>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  withTransaction<T>(
    operation: (transactionDataSource: PostgresTenantDataSource) => Promise<T>
  ): Promise<T>;
  lockTenantResourcePlanning(tenantId: TenantId): Promise<void>;
  appendAuditEvent(input: AuditEventRecordInput): Promise<void>;
  listAuditEventsByTenantId(tenantId: TenantId): Promise<AuditEventListItem[]>;
};

export function createPostgresTenantDataSource(
  db: KissPmDatabase
): PostgresTenantDataSource {
  return {
    db,
    ...createCrmRepository(db),
    ...createControlRepository(db),
    ...createControlSurfaceRepository(db),
    ...createRetrospectiveRepository(db),
    ...createProjectIntakeRepository(db),
    ...createPlanningRepository(db),
    ...createPlanningSavedViewsRepository(db),
    ...createProjectWorkRepository(db),
    ...createTenantProductionCalendarRepository(db),
    ...createResourceAbsencesRepository(db),
    ...createAttachmentRepository(db),
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
    async createSession(input) {
      await db.insert(userSessions).values({
        ...input,
        createdAt: new Date()
      });
    },
    async findSessionByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.tokenHash, tokenHash))
        .limit(1);

      return row
        ? {
            id: row.id,
            tenantId: row.tenantId,
            userId: row.userId,
            tokenHash: row.tokenHash,
            expiresAt: row.expiresAt
          }
        : undefined;
    },
    async deleteSessionByTokenHash(tokenHash) {
      await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
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
    async listAuditEventsByTenantId(tenantId) {
      const rows = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.tenantId, tenantId))
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));

      return rows.map((row) => ({
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
      }));
    }
  };
}
