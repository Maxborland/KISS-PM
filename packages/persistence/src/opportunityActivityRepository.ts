import { and, desc, eq } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { opportunityActivities } from "./schema";

export type OpportunityActivityType = "comment" | "task";
export type OpportunityActivityStatus = "todo" | "done";

export type OpportunityActivityRecord = {
  id: string;
  tenantId: TenantId;
  opportunityId: string;
  type: OpportunityActivityType;
  title: string | null;
  body: string | null;
  status: OpportunityActivityStatus | null;
  dueDate: Date | null;
  assigneeUserId: UserId | null;
  authorUserId: UserId;
  createdAt: Date;
  updatedAt: Date;
};

export type OpportunityActivityInput = Omit<
  OpportunityActivityRecord,
  "createdAt" | "updatedAt"
>;

export type OpportunityActivityUpdateInput = {
  tenantId: TenantId;
  opportunityId: string;
  activityId: string;
  status: OpportunityActivityStatus;
};

export type OpportunityActivityRepository = {
  listOpportunityActivities(
    tenantId: TenantId,
    opportunityId: string
  ): Promise<OpportunityActivityRecord[]>;
  createOpportunityActivity(
    input: OpportunityActivityInput
  ): Promise<OpportunityActivityRecord>;
  updateOpportunityActivity(
    input: OpportunityActivityUpdateInput
  ): Promise<OpportunityActivityRecord | undefined>;
};

export function createOpportunityActivityRepository(
  db: KissPmDatabase
): OpportunityActivityRepository {
  return {
    async listOpportunityActivities(tenantId, opportunityId) {
      const rows = await db
        .select()
        .from(opportunityActivities)
        .where(
          and(
            eq(opportunityActivities.tenantId, tenantId),
            eq(opportunityActivities.opportunityId, opportunityId)
          )
        )
        .orderBy(
          desc(opportunityActivities.createdAt),
          desc(opportunityActivities.id)
        );

      return rows.map(mapOpportunityActivityRecord);
    },
    async createOpportunityActivity(input) {
      const now = new Date();
      const [row] = await db
        .insert(opportunityActivities)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          opportunityId: input.opportunityId,
          type: input.type,
          title: input.title,
          body: input.body,
          status: input.status,
          dueDate: input.dueDate,
          assigneeUserId: input.assigneeUserId,
          authorUserId: input.authorUserId,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      if (!row) throw new Error("Opportunity activity insert returned no row");
      return mapOpportunityActivityRecord(row);
    },
    async updateOpportunityActivity(input) {
      const [row] = await db
        .update(opportunityActivities)
        .set({
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(opportunityActivities.tenantId, input.tenantId),
            eq(opportunityActivities.opportunityId, input.opportunityId),
            eq(opportunityActivities.id, input.activityId),
            eq(opportunityActivities.type, "task")
          )
        )
        .returning();

      return row ? mapOpportunityActivityRecord(row) : undefined;
    }
  };
}

function mapOpportunityActivityRecord(
  row: typeof opportunityActivities.$inferSelect
): OpportunityActivityRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId,
    type: row.type as OpportunityActivityType,
    title: row.title,
    body: row.body,
    status: row.status as OpportunityActivityStatus | null,
    dueDate: row.dueDate,
    assigneeUserId: row.assigneeUserId,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
