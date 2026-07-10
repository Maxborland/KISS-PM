import { and, asc, eq, or } from "drizzle-orm";

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
  updateSavedViewName(
    tenantId: TenantId,
    projectId: string,
    viewId: string,
    actorUserId: UserId,
    name: string
  ): Promise<PlanningSavedViewRecord | null>;
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
        .returning()
        .catch(rethrowSavedViewNameConflict);

      if (!row) throw new Error("planning_saved_view_insert_failed");
      return mapSavedView(row);
    },

    async updateSavedViewName(tenantId, projectId, viewId, actorUserId, name) {
      const [row] = await db
        .update(planningSavedViews)
        .set({ name })
        .where(
          and(
            eq(planningSavedViews.tenantId, tenantId),
            eq(planningSavedViews.projectId, projectId),
            eq(planningSavedViews.id, viewId),
            or(
              eq(planningSavedViews.scope, "project"),
              eq(planningSavedViews.ownerUserId, actorUserId)
            )
          )
        )
        .returning()
        .catch(rethrowSavedViewNameConflict);

      return row ? mapSavedView(row) : null;
    },

    async deleteSavedView(tenantId, projectId, viewId, actorUserId) {
      const [row] = await db
        .delete(planningSavedViews)
        .where(
          and(
            eq(planningSavedViews.tenantId, tenantId),
            eq(planningSavedViews.projectId, projectId),
            eq(planningSavedViews.id, viewId),
            or(
              eq(planningSavedViews.scope, "project"),
              eq(planningSavedViews.ownerUserId, actorUserId)
            )
          )
        )
        .returning({ id: planningSavedViews.id });
      return Boolean(row);
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
function rethrowSavedViewNameConflict(error: unknown): never {
  const wrapped = error as { code?: string; constraint?: string; cause?: unknown; message?: string };
  const value = (wrapped.cause ?? wrapped) as { code?: string; constraint?: string; message?: string };
  const constraint = value.constraint ?? "";
  const message = `${wrapped.message ?? ""} ${value.message ?? ""}`;
  if (value.code === "23505" && (
    (constraint.startsWith("planning_saved_views_") && constraint.endsWith("_name_uidx")) ||
    message.includes("planning_saved_views_project_name_uidx") ||
    message.includes("planning_saved_views_user_name_uidx")
  )) {
    throw new Error("planning_saved_view_name_conflict");
  }
  throw error;
}
