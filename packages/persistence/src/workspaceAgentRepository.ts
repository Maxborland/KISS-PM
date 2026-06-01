import { and, desc, eq, isNull } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { workspaceAgentMessages } from "./schema";

export type WorkspaceAgentFocusType = "project" | "task" | "deal";

export type WorkspaceAgentContextFocus = {
  type: WorkspaceAgentFocusType;
  id: string;
  title?: string;
};

export type WorkspaceAgentThreadContext = {
  focus?: WorkspaceAgentContextFocus;
};

export type WorkspaceAgentMessageRecord = {
  id: string;
  tenantId: TenantId;
  authorUserId: UserId;
  body: string;
  context: WorkspaceAgentThreadContext;
  createdAt: Date;
};

export type WorkspaceAgentRepository = {
  listWorkspaceAgentMessages(input: {
    tenantId: TenantId;
    context: WorkspaceAgentThreadContext;
    limit?: number;
  }): Promise<WorkspaceAgentMessageRecord[]>;
  createWorkspaceAgentMessage(input: WorkspaceAgentMessageRecord): Promise<WorkspaceAgentMessageRecord>;
};

export function createWorkspaceAgentRepository(db: KissPmDatabase): WorkspaceAgentRepository {
  return {
    async listWorkspaceAgentMessages(input) {
      const filters = [eq(workspaceAgentMessages.tenantId, input.tenantId)];
      if (input.context.focus) {
        filters.push(
          eq(workspaceAgentMessages.focusType, input.context.focus.type),
          eq(workspaceAgentMessages.focusId, input.context.focus.id)
        );
      } else {
        filters.push(isNull(workspaceAgentMessages.focusType), isNull(workspaceAgentMessages.focusId));
      }

      const rows = await db
        .select()
        .from(workspaceAgentMessages)
        .where(and(...filters))
        .orderBy(desc(workspaceAgentMessages.createdAt), desc(workspaceAgentMessages.id))
        .limit(input.limit ?? 100);

      return rows.reverse().map(mapWorkspaceAgentMessage);
    },
    async createWorkspaceAgentMessage(input) {
      const [row] = await db
        .insert(workspaceAgentMessages)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          authorUserId: input.authorUserId,
          focusType: input.context.focus?.type ?? null,
          focusId: input.context.focus?.id ?? null,
          body: input.body,
          context: input.context,
          createdAt: input.createdAt
        })
        .returning();

      if (!row) throw new Error("Workspace agent message insert returned no row");
      return mapWorkspaceAgentMessage(row);
    }
  };
}

function mapWorkspaceAgentMessage(
  row: typeof workspaceAgentMessages.$inferSelect
): WorkspaceAgentMessageRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    authorUserId: row.authorUserId,
    body: row.body,
    context: normalizeContext(row.context),
    createdAt: row.createdAt
  };
}

function normalizeContext(value: Record<string, unknown>): WorkspaceAgentThreadContext {
  const focus = value.focus;
  if (!isRecord(focus)) return {};

  const type = focus.type;
  const id = focus.id;
  if (!isFocusType(type) || typeof id !== "string") return {};

  return {
    focus: {
      type,
      id,
      ...(typeof focus.title === "string" ? { title: focus.title } : {})
    }
  };
}

function isFocusType(value: unknown): value is WorkspaceAgentFocusType {
  return value === "project" || value === "task" || value === "deal";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
