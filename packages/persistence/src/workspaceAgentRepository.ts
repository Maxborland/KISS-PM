import { and, desc, eq, isNull } from "drizzle-orm";

import type { TenantId, UserId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { workspaceAgentMessages, workspaceAgentProposals } from "./schema";

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

export type WorkspaceAgentProposalStatus = "proposed" | "applying" | "applied" | "rejected";

export type WorkspaceAgentActionProposalRecord = {
  id: string;
  tenantId: TenantId;
  actorUserId: UserId;
  messageId: string;
  actionType: string;
  title: string;
  description: string;
  context: WorkspaceAgentThreadContext;
  payload: Record<string, unknown>;
  status: WorkspaceAgentProposalStatus;
  auditEventId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type WorkspaceAgentRepository = {
  listWorkspaceAgentMessages(input: {
    tenantId: TenantId;
    context: WorkspaceAgentThreadContext;
    limit?: number;
  }): Promise<WorkspaceAgentMessageRecord[]>;
  createWorkspaceAgentMessage(input: WorkspaceAgentMessageRecord): Promise<WorkspaceAgentMessageRecord>;
  listWorkspaceAgentProposals(input: {
    tenantId: TenantId;
    context: WorkspaceAgentThreadContext;
    limit?: number;
  }): Promise<WorkspaceAgentActionProposalRecord[]>;
  createWorkspaceAgentProposal(
    input: WorkspaceAgentActionProposalRecord
  ): Promise<WorkspaceAgentActionProposalRecord>;
  findWorkspaceAgentProposal(
    tenantId: TenantId,
    proposalId: string
  ): Promise<WorkspaceAgentActionProposalRecord | undefined>;
  updateWorkspaceAgentProposalStatus(input: {
    tenantId: TenantId;
    proposalId: string;
    status: WorkspaceAgentProposalStatus;
    auditEventId: string | null;
    resolvedAt: Date | null;
    expectedStatus?: WorkspaceAgentProposalStatus;
  }): Promise<WorkspaceAgentActionProposalRecord | undefined>;
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
    },
    async listWorkspaceAgentProposals(input) {
      const filters = [eq(workspaceAgentProposals.tenantId, input.tenantId)];
      if (input.context.focus) {
        filters.push(
          eq(workspaceAgentProposals.focusType, input.context.focus.type),
          eq(workspaceAgentProposals.focusId, input.context.focus.id)
        );
      } else {
        filters.push(isNull(workspaceAgentProposals.focusType), isNull(workspaceAgentProposals.focusId));
      }

      const rows = await db
        .select()
        .from(workspaceAgentProposals)
        .where(and(...filters))
        .orderBy(desc(workspaceAgentProposals.createdAt), desc(workspaceAgentProposals.id))
        .limit(input.limit ?? 20);

      return rows.reverse().map(mapWorkspaceAgentProposal);
    },
    async createWorkspaceAgentProposal(input) {
      const [row] = await db
        .insert(workspaceAgentProposals)
        .values(toWorkspaceAgentProposalRow(input))
        .returning();

      if (!row) throw new Error("Workspace agent proposal insert returned no row");
      return mapWorkspaceAgentProposal(row);
    },
    async findWorkspaceAgentProposal(tenantId, proposalId) {
      const [row] = await db
        .select()
        .from(workspaceAgentProposals)
        .where(and(eq(workspaceAgentProposals.tenantId, tenantId), eq(workspaceAgentProposals.id, proposalId)))
        .limit(1);

      return row ? mapWorkspaceAgentProposal(row) : undefined;
    },
    async updateWorkspaceAgentProposalStatus(input) {
      const filters = [
        eq(workspaceAgentProposals.tenantId, input.tenantId),
        eq(workspaceAgentProposals.id, input.proposalId)
      ];
      if (input.expectedStatus) {
        filters.push(eq(workspaceAgentProposals.status, input.expectedStatus));
      }

      const [row] = await db
        .update(workspaceAgentProposals)
        .set({
          status: input.status,
          auditEventId: input.auditEventId,
          resolvedAt: input.resolvedAt
        })
        .where(and(...filters))
        .returning();

      return row ? mapWorkspaceAgentProposal(row) : undefined;
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

function toWorkspaceAgentProposalRow(input: WorkspaceAgentActionProposalRecord): typeof workspaceAgentProposals.$inferInsert {
  return {
    id: input.id,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    messageId: input.messageId,
    actionType: input.actionType,
    title: input.title,
    description: input.description,
    focusType: input.context.focus?.type ?? null,
    focusId: input.context.focus?.id ?? null,
    context: input.context,
    payload: input.payload,
    status: input.status,
    auditEventId: input.auditEventId,
    createdAt: input.createdAt,
    resolvedAt: input.resolvedAt
  };
}

function mapWorkspaceAgentProposal(
  row: typeof workspaceAgentProposals.$inferSelect
): WorkspaceAgentActionProposalRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    messageId: row.messageId,
    actionType: row.actionType,
    title: row.title,
    description: row.description,
    context: normalizeContext(row.context),
    payload: row.payload,
    status: row.status as WorkspaceAgentProposalStatus,
    auditEventId: row.auditEventId,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt
  };
}

function isFocusType(value: unknown): value is WorkspaceAgentFocusType {
  return value === "project" || value === "task" || value === "deal";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
