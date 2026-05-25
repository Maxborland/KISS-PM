import { and, asc, eq } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { planningSavedViews } from "./schema";

export type PlanningSavedViewScope = "user" | "project";

export type PlanningSavedViewRecord = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  ownerUserId: UserId;
  scope: PlanningSavedViewScope;
  name: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type PlanningSavedViewInput = Omit<PlanningSavedViewRecord, "createdAt">;

export type PlanningSavedViewsRepository = {
  listSavedViews(
    tenantId: TenantId,
    projectId: string,
    actorUserId: UserId
  ): Promise<PlanningSavedViewRecord[]>;
  createSavedView(input: PlanningSavedViewInput): Promise<PlanningSavedViewRecord>;
  deleteSavedView(
    tenantId: TenantId,
    projectId: string,
    viewId: string,
    actorUserId: UserId
  ): Promise<boolean>;
};

export function createPlanningSavedViewsRepository(
  db: KissPmDatabase
): PlanningSavedViewsRepository {
  return {
    async listSavedViews(tenantId, projectId, actorUserId) {
      const rows = await db
        .select()
        .from(planningSavedViews)
        .where(
          and(
            eq(planningSavedViews.tenantId, tenantId),
            eq(planningSavedViews.projectId, projectId)
          )
        )
        .orderBy(asc(planningSavedViews.name), asc(planningSavedViews.id));

      return rows
        .filter(
          (row) => row.scope === "project" || row.ownerUserId === actorUserId
        )
        .map(mapSavedView);
    },

    async createSavedView(input) {
      const now = new Date();
      const [row] = await db
        .insert(planningSavedViews)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          ownerUserId: input.ownerUserId,
          scope: input.scope,
          name: input.name,
          payload: input.payload,
          createdAt: now
        })
        .returning();

      if (!row) throw new Error("planning_saved_view_insert_failed");
      return mapSavedView(row);
    },

    async deleteSavedView(tenantId, projectId, viewId, actorUserId) {
      const [row] = await db
        .select()
        .from(planningSavedViews)
        .where(
          and(
            eq(planningSavedViews.tenantId, tenantId),
            eq(planningSavedViews.projectId, projectId),
            eq(planningSavedViews.id, viewId)
          )
        )
        .limit(1);

      if (!row) return false;
      if (row.scope === "user" && row.ownerUserId !== actorUserId) return false;

      await db
        .delete(planningSavedViews)
        .where(
          and(
            eq(planningSavedViews.tenantId, tenantId),
            eq(planningSavedViews.projectId, projectId),
            eq(planningSavedViews.id, viewId)
          )
        );
      return true;
    }
  };
}

function mapSavedView(row: typeof planningSavedViews.$inferSelect): PlanningSavedViewRecord {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    projectId: row.projectId,
    ownerUserId: row.ownerUserId as UserId,
    scope: row.scope as PlanningSavedViewScope,
    name: row.name,
    payload: row.payload,
    createdAt: row.createdAt
  };
}
