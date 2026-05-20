import { and, desc, eq, ne } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { crmActivities } from "./schema";

export type CrmActivityEntityType = "opportunity" | "client" | "contact" | "product";
export type CrmActivityType = "comment" | "task" | "file";
export type CrmActivityStatus = "todo" | "done";

export type CrmActivityRecord = {
  id: string;
  tenantId: TenantId;
  entityType: CrmActivityEntityType;
  entityId: string;
  type: CrmActivityType;
  title: string | null;
  body: string | null;
  status: CrmActivityStatus | null;
  dueDate: Date | null;
  assigneeUserId: UserId | null;
  authorUserId: UserId;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CrmActivityInput = Omit<
  CrmActivityRecord,
  "createdAt" | "updatedAt"
>;

export type CrmActivityUpdateInput = {
  tenantId: TenantId;
  entityType: CrmActivityEntityType;
  entityId: string;
  activityId: string;
  status: CrmActivityStatus;
};

export type CrmActivityTransitionResult =
  | {
      found: false;
    }
  | {
      found: true;
      changed: false;
      activity: CrmActivityRecord;
    }
  | {
      found: true;
      changed: true;
      beforeState: CrmActivityRecord;
      activity: CrmActivityRecord;
    };

export type CrmActivityRepository = {
  listCrmActivities(
    tenantId: TenantId,
    entityType: CrmActivityEntityType,
    entityId: string
  ): Promise<CrmActivityRecord[]>;
  createCrmActivity(
    input: CrmActivityInput
  ): Promise<CrmActivityRecord>;
  updateCrmActivity(
    input: CrmActivityUpdateInput
  ): Promise<CrmActivityRecord | undefined>;
  transitionCrmActivityStatus(
    input: CrmActivityUpdateInput
  ): Promise<CrmActivityTransitionResult>;
};

export function createCrmActivityRepository(
  db: KissPmDatabase
): CrmActivityRepository {
  return {
    async listCrmActivities(tenantId, entityType, entityId) {
      const rows = await db
        .select()
        .from(crmActivities)
        .where(
          and(
            eq(crmActivities.tenantId, tenantId),
            eq(crmActivities.entityType, entityType),
            eq(crmActivities.entityId, entityId)
          )
        )
        .orderBy(
          desc(crmActivities.createdAt),
          desc(crmActivities.id)
        );

      return rows.map(mapCrmActivityRecord);
    },
    async createCrmActivity(input) {
      const now = new Date();
      const [row] = await db
        .insert(crmActivities)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          type: input.type,
          title: input.title,
          body: input.body,
          status: input.status,
          dueDate: input.dueDate,
          assigneeUserId: input.assigneeUserId,
          authorUserId: input.authorUserId,
          fileUrl: input.fileUrl,
          fileSizeBytes: input.fileSizeBytes,
          mimeType: input.mimeType,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!row) throw new Error("CRM activity insert returned no row");
      return mapCrmActivityRecord(row);
    },
    async updateCrmActivity(input) {
      const [row] = await db
        .update(crmActivities)
        .set({
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(crmActivities.tenantId, input.tenantId),
            eq(crmActivities.entityType, input.entityType),
            eq(crmActivities.entityId, input.entityId),
            eq(crmActivities.id, input.activityId),
            eq(crmActivities.type, "task")
          )
        )
        .returning();

      return row ? mapCrmActivityRecord(row) : undefined;
    },
    async transitionCrmActivityStatus(input) {
      const [beforeRow] = await db
        .select()
        .from(crmActivities)
        .where(
          and(
            eq(crmActivities.tenantId, input.tenantId),
            eq(crmActivities.entityType, input.entityType),
            eq(crmActivities.entityId, input.entityId),
            eq(crmActivities.id, input.activityId),
            eq(crmActivities.type, "task")
          )
        )
        .limit(1);

      if (!beforeRow) return { found: false };

      const beforeState = mapCrmActivityRecord(beforeRow);
      if (beforeState.status === input.status) {
        return {
          found: true,
          changed: false,
          activity: beforeState
        };
      }

      const [updatedRow] = await db
        .update(crmActivities)
        .set({
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(crmActivities.tenantId, input.tenantId),
            eq(crmActivities.entityType, input.entityType),
            eq(crmActivities.entityId, input.entityId),
            eq(crmActivities.id, input.activityId),
            eq(crmActivities.type, "task"),
            ne(crmActivities.status, input.status)
          )
        )
        .returning();

      if (!updatedRow) {
        const [currentRow] = await db
          .select()
          .from(crmActivities)
          .where(
            and(
              eq(crmActivities.tenantId, input.tenantId),
              eq(crmActivities.entityType, input.entityType),
              eq(crmActivities.entityId, input.entityId),
              eq(crmActivities.id, input.activityId),
              eq(crmActivities.type, "task")
            )
          )
          .limit(1);
        if (!currentRow) return { found: false };

        return {
          found: true,
          changed: false,
          activity: mapCrmActivityRecord(currentRow)
        };
      }

      return {
        found: true,
        changed: true,
        beforeState,
        activity: mapCrmActivityRecord(updatedRow)
      };
    }
  };
}

function mapCrmActivityRecord(
  row: typeof crmActivities.$inferSelect
): CrmActivityRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as CrmActivityEntityType,
    entityId: row.entityId,
    type: row.type as CrmActivityType,
    title: row.title,
    body: row.body,
    status: row.status as CrmActivityStatus | null,
    dueDate: row.dueDate,
    assigneeUserId: row.assigneeUserId,
    authorUserId: row.authorUserId,
    fileUrl: row.fileUrl,
    fileSizeBytes: row.fileSizeBytes,
    mimeType: row.mimeType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
