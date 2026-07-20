import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";

import type {
  DecisionLogEntry,
  DecisionLogStatus,
  KnowledgeActionItem,
  KnowledgeActionItemStatus,
  KnowledgeActionTargetType,
  KnowledgeApprovalStatus,
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeDocumentType,
  KnowledgeDocumentVersion,
  TenantId,
  UserId
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  decisionLogEntries,
  knowledgeActionItems,
  knowledgeDocuments,
  knowledgeDocumentVersions,
  meetings
} from "./schema";

export type KnowledgeDocumentInput = Omit<
  KnowledgeDocument,
  "createdAt" | "updatedAt" | "archivedAt" | "currentVersionId"
>;
export type KnowledgeDocumentVersionInput = Omit<
  KnowledgeDocumentVersion,
  "createdAt" | "versionNumber"
>;
export type DecisionLogEntryInput = Omit<
  DecisionLogEntry,
  "createdAt" | "updatedAt" | "archivedAt"
>;
export type KnowledgeActionItemInput = Omit<
  KnowledgeActionItem,
  "createdAt" | "updatedAt" | "archivedAt"
>;

export type KnowledgeRepository = {
  createKnowledgeDocument(input: KnowledgeDocumentInput): Promise<KnowledgeDocument>;
  findKnowledgeDocument(input: {
    tenantId: TenantId;
    projectId: string;
    documentId: string;
  }): Promise<KnowledgeDocument | undefined>;
  findKnowledgeDocumentById(input: {
    tenantId: TenantId;
    documentId: string;
  }): Promise<KnowledgeDocument | undefined>;
  listKnowledgeDocuments(input: {
    tenantId: TenantId;
    projectId: string;
  }): Promise<KnowledgeDocument[]>;
  archiveKnowledgeDocument(input: {
    tenantId: TenantId;
    projectId: string;
    documentId: string;
  }): Promise<KnowledgeDocument | undefined>;
  createKnowledgeDocumentVersion(
    input: KnowledgeDocumentVersionInput
  ): Promise<{ document: KnowledgeDocument; version: KnowledgeDocumentVersion }>;
  restoreKnowledgeDocumentVersion(input: {
    tenantId: TenantId;
    projectId: string;
    documentId: string;
    versionId: string;
    newVersionId: string;
    createdByUserId: UserId;
  }): Promise<{ document: KnowledgeDocument; version: KnowledgeDocumentVersion } | undefined>;
  listKnowledgeDocumentVersions(input: {
    tenantId: TenantId;
    documentId: string;
  }): Promise<KnowledgeDocumentVersion[]>;
  createDecisionLogEntry(input: DecisionLogEntryInput): Promise<DecisionLogEntry>;
  updateDecisionLogEntry(input: {
    tenantId: TenantId;
    projectId: string;
    decisionId: string;
    title: string;
    decision: string;
    rationale: string | null;
    status: DecisionLogStatus;
  }): Promise<DecisionLogEntry | undefined>;
  findDecisionLogEntry(input: {
    tenantId: TenantId;
    projectId: string;
    decisionId: string;
  }): Promise<DecisionLogEntry | undefined>;
  deleteKnowledgeDecision(input: {
    tenantId: TenantId;
    projectId: string;
    decisionId: string;
  }): Promise<DecisionLogEntry | undefined>;
  listDecisionLogEntries(input: {
    tenantId: TenantId;
    projectId: string;
  }): Promise<DecisionLogEntry[]>;
  createKnowledgeActionItem(input: KnowledgeActionItemInput): Promise<KnowledgeActionItem>;
  updateKnowledgeActionItem(input: {
    tenantId: TenantId;
    projectId: string;
    actionItemId: string;
    title: string;
    description: string | null;
    ownerUserId: UserId;
    dueDate: string | null;
    status: KnowledgeActionItemStatus;
  }): Promise<KnowledgeActionItem | undefined>;
  findKnowledgeActionItem(input: {
    tenantId: TenantId;
    projectId: string;
    actionItemId: string;
  }): Promise<KnowledgeActionItem | undefined>;
  deleteKnowledgeActionItem(input: {
    tenantId: TenantId;
    projectId: string;
    actionItemId: string;
  }): Promise<KnowledgeActionItem | undefined>;
  listKnowledgeActionItems(input: {
    tenantId: TenantId;
    projectId: string;
  }): Promise<KnowledgeActionItem[]>;
  findProjectMeeting(input: {
    tenantId: TenantId;
    projectId: string;
    meetingId: string;
  }): Promise<{ id: string } | undefined>;
  searchKnowledge(input: {
    tenantId: TenantId;
    query: string;
    limit: number;
  }): Promise<{
    documents: KnowledgeDocument[];
    decisions: DecisionLogEntry[];
    actionItems: KnowledgeActionItem[];
  }>;
};

export function createKnowledgeRepository(db: KissPmDatabase): KnowledgeRepository {
  return {
    async createKnowledgeDocument(input) {
      const now = new Date();
      const [row] = await db
        .insert(knowledgeDocuments)
        .values({
          ...input,
          currentVersionId: null,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      if (!row) throw new Error("Knowledge document insert returned no row");
      return mapKnowledgeDocument(row);
    },
    async findKnowledgeDocument(input) {
      const [row] = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.projectId, input.projectId),
            eq(knowledgeDocuments.id, input.documentId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .limit(1);
      return row ? mapKnowledgeDocument(row) : undefined;
    },
    async findKnowledgeDocumentById(input) {
      const [row] = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.documentId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .limit(1);
      return row ? mapKnowledgeDocument(row) : undefined;
    },
    async listKnowledgeDocuments(input) {
      const rows = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.projectId, input.projectId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .orderBy(desc(knowledgeDocuments.updatedAt), desc(knowledgeDocuments.id));
      return rows.map(mapKnowledgeDocument);
    },
    async archiveKnowledgeDocument(input) {
      const now = new Date();
      const [row] = await db
        .update(knowledgeDocuments)
        .set({ status: "archived", archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.projectId, input.projectId),
            eq(knowledgeDocuments.id, input.documentId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .returning();
      return row ? mapKnowledgeDocument(row) : undefined;
    },
    async createKnowledgeDocumentVersion(input) {
      const now = new Date();
      const [latest] = await db
        .select({ versionNumber: knowledgeDocumentVersions.versionNumber })
        .from(knowledgeDocumentVersions)
        .where(
          and(
            eq(knowledgeDocumentVersions.tenantId, input.tenantId),
            eq(knowledgeDocumentVersions.documentId, input.documentId)
          )
        )
        .orderBy(desc(knowledgeDocumentVersions.versionNumber))
        .limit(1);
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const [versionRow] = await db
        .insert(knowledgeDocumentVersions)
        .values({
          ...input,
          versionNumber,
          createdAt: now
        })
        .returning();
      if (!versionRow) throw new Error("Knowledge document version insert returned no row");
      const [documentRow] = await db
        .update(knowledgeDocuments)
        .set({
          title: input.title,
          summary: input.summary,
          currentVersionId: versionRow.id,
          updatedAt: now
        })
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.documentId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .returning();
      if (!documentRow) throw new Error("Knowledge document not found");
      return {
        document: mapKnowledgeDocument(documentRow),
        version: mapKnowledgeDocumentVersion(versionRow)
      };
    },
    async restoreKnowledgeDocumentVersion(input) {
      const now = new Date();
      // Восстановление не переписывает историю: берём содержимое выбранной
      // прошлой версии и публикуем его как новую текущую версию документа.
      const [documentRow] = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.projectId, input.projectId),
            eq(knowledgeDocuments.id, input.documentId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .limit(1);
      if (!documentRow) return undefined;
      const [sourceRow] = await db
        .select()
        .from(knowledgeDocumentVersions)
        .where(
          and(
            eq(knowledgeDocumentVersions.tenantId, input.tenantId),
            eq(knowledgeDocumentVersions.documentId, input.documentId),
            eq(knowledgeDocumentVersions.id, input.versionId)
          )
        )
        .limit(1);
      if (!sourceRow) return undefined;
      const [latest] = await db
        .select({ versionNumber: knowledgeDocumentVersions.versionNumber })
        .from(knowledgeDocumentVersions)
        .where(
          and(
            eq(knowledgeDocumentVersions.tenantId, input.tenantId),
            eq(knowledgeDocumentVersions.documentId, input.documentId)
          )
        )
        .orderBy(desc(knowledgeDocumentVersions.versionNumber))
        .limit(1);
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const [versionRow] = await db
        .insert(knowledgeDocumentVersions)
        .values({
          id: input.newVersionId,
          tenantId: input.tenantId,
          documentId: input.documentId,
          versionNumber,
          title: sourceRow.title,
          body: sourceRow.body,
          summary: sourceRow.summary,
          changeReason: sourceRow.changeReason,
          createdByUserId: input.createdByUserId,
          createdAt: now
        })
        .returning();
      if (!versionRow) throw new Error("Knowledge document version insert returned no row");
      const [updatedDocumentRow] = await db
        .update(knowledgeDocuments)
        .set({
          title: sourceRow.title,
          summary: sourceRow.summary,
          currentVersionId: versionRow.id,
          updatedAt: now
        })
        .where(
          and(
            eq(knowledgeDocuments.tenantId, input.tenantId),
            eq(knowledgeDocuments.id, input.documentId),
            isNull(knowledgeDocuments.archivedAt)
          )
        )
        .returning();
      if (!updatedDocumentRow) throw new Error("Knowledge document not found");
      return {
        document: mapKnowledgeDocument(updatedDocumentRow),
        version: mapKnowledgeDocumentVersion(versionRow)
      };
    },
    async listKnowledgeDocumentVersions(input) {
      const rows = await db
        .select()
        .from(knowledgeDocumentVersions)
        .where(
          and(
            eq(knowledgeDocumentVersions.tenantId, input.tenantId),
            eq(knowledgeDocumentVersions.documentId, input.documentId)
          )
        )
        .orderBy(desc(knowledgeDocumentVersions.versionNumber));
      return rows.map(mapKnowledgeDocumentVersion);
    },
    async createDecisionLogEntry(input) {
      const now = new Date();
      const [row] = await db
        .insert(decisionLogEntries)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Decision log insert returned no row");
      return mapDecisionLogEntry(row);
    },
    async updateDecisionLogEntry(input) {
      const [row] = await db
        .update(decisionLogEntries)
        .set({
          title: input.title,
          decision: input.decision,
          rationale: input.rationale,
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(decisionLogEntries.tenantId, input.tenantId),
            eq(decisionLogEntries.projectId, input.projectId),
            eq(decisionLogEntries.id, input.decisionId),
            isNull(decisionLogEntries.archivedAt)
          )
        )
        .returning();
      return row ? mapDecisionLogEntry(row) : undefined;
    },
    async findDecisionLogEntry(input) {
      const [row] = await db
        .select()
        .from(decisionLogEntries)
        .where(
          and(
            eq(decisionLogEntries.tenantId, input.tenantId),
            eq(decisionLogEntries.projectId, input.projectId),
            eq(decisionLogEntries.id, input.decisionId),
            isNull(decisionLogEntries.archivedAt)
          )
        )
        .limit(1);
      return row ? mapDecisionLogEntry(row) : undefined;
    },
    async deleteKnowledgeDecision(input) {
      // Мягкое удаление: выставляем archivedAt, чтобы запись исчезла из всех
      // выборок (все они фильтруют isNull(archivedAt)), но история/аудит целы.
      const now = new Date();
      const [row] = await db
        .update(decisionLogEntries)
        .set({ archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(decisionLogEntries.tenantId, input.tenantId),
            eq(decisionLogEntries.projectId, input.projectId),
            eq(decisionLogEntries.id, input.decisionId),
            isNull(decisionLogEntries.archivedAt)
          )
        )
        .returning();
      return row ? mapDecisionLogEntry(row) : undefined;
    },
    async listDecisionLogEntries(input) {
      const rows = await db
        .select()
        .from(decisionLogEntries)
        .where(
          and(
            eq(decisionLogEntries.tenantId, input.tenantId),
            eq(decisionLogEntries.projectId, input.projectId),
            isNull(decisionLogEntries.archivedAt)
          )
        )
        .orderBy(desc(decisionLogEntries.updatedAt), desc(decisionLogEntries.id));
      return rows.map(mapDecisionLogEntry);
    },
    async createKnowledgeActionItem(input) {
      const now = new Date();
      const [row] = await db
        .insert(knowledgeActionItems)
        .values({ ...input, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Knowledge action item insert returned no row");
      return mapKnowledgeActionItem(row);
    },
    async updateKnowledgeActionItem(input) {
      const [row] = await db
        .update(knowledgeActionItems)
        .set({
          title: input.title,
          description: input.description,
          ownerUserId: input.ownerUserId,
          dueDate: input.dueDate,
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(knowledgeActionItems.tenantId, input.tenantId),
            eq(knowledgeActionItems.projectId, input.projectId),
            eq(knowledgeActionItems.id, input.actionItemId),
            isNull(knowledgeActionItems.archivedAt)
          )
        )
        .returning();
      return row ? mapKnowledgeActionItem(row) : undefined;
    },
    async findKnowledgeActionItem(input) {
      const [row] = await db
        .select()
        .from(knowledgeActionItems)
        .where(
          and(
            eq(knowledgeActionItems.tenantId, input.tenantId),
            eq(knowledgeActionItems.projectId, input.projectId),
            eq(knowledgeActionItems.id, input.actionItemId),
            isNull(knowledgeActionItems.archivedAt)
          )
        )
        .limit(1);
      return row ? mapKnowledgeActionItem(row) : undefined;
    },
    async deleteKnowledgeActionItem(input) {
      // Мягкое удаление: выставляем archivedAt (аналогично решениям журнала).
      const now = new Date();
      const [row] = await db
        .update(knowledgeActionItems)
        .set({ archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(knowledgeActionItems.tenantId, input.tenantId),
            eq(knowledgeActionItems.projectId, input.projectId),
            eq(knowledgeActionItems.id, input.actionItemId),
            isNull(knowledgeActionItems.archivedAt)
          )
        )
        .returning();
      return row ? mapKnowledgeActionItem(row) : undefined;
    },
    async listKnowledgeActionItems(input) {
      const rows = await db
        .select()
        .from(knowledgeActionItems)
        .where(
          and(
            eq(knowledgeActionItems.tenantId, input.tenantId),
            eq(knowledgeActionItems.projectId, input.projectId),
            isNull(knowledgeActionItems.archivedAt)
          )
        )
        .orderBy(asc(knowledgeActionItems.dueDate), desc(knowledgeActionItems.updatedAt));
      return rows.map(mapKnowledgeActionItem);
    },
    async findProjectMeeting(input) {
      const [row] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(
          and(
            eq(meetings.tenantId, input.tenantId),
            eq(meetings.id, input.meetingId),
            eq(meetings.entityType, "project"),
            eq(meetings.entityId, input.projectId),
            isNull(meetings.archivedAt)
          )
        )
        .limit(1);
      return row;
    },
    async searchKnowledge(input) {
      const pattern = `%${escapeLikePattern(input.query)}%`;
      const [documents, decisions, actionItems] = await Promise.all([
        db
          .select()
          .from(knowledgeDocuments)
          .where(
            and(
              eq(knowledgeDocuments.tenantId, input.tenantId),
              isNull(knowledgeDocuments.archivedAt),
              or(
                ilike(knowledgeDocuments.title, pattern),
                ilike(knowledgeDocuments.summary, pattern),
                ilike(knowledgeDocuments.documentType, pattern)
              )
            )
          )
          .orderBy(desc(knowledgeDocuments.updatedAt))
          .limit(input.limit),
        db
          .select()
          .from(decisionLogEntries)
          .where(
            and(
              eq(decisionLogEntries.tenantId, input.tenantId),
              isNull(decisionLogEntries.archivedAt),
              or(
                ilike(decisionLogEntries.title, pattern),
                ilike(decisionLogEntries.decision, pattern),
                ilike(decisionLogEntries.rationale, pattern)
              )
            )
          )
          .orderBy(desc(decisionLogEntries.updatedAt))
          .limit(input.limit),
        db
          .select()
          .from(knowledgeActionItems)
          .where(
            and(
              eq(knowledgeActionItems.tenantId, input.tenantId),
              isNull(knowledgeActionItems.archivedAt),
              or(
                ilike(knowledgeActionItems.title, pattern),
                ilike(knowledgeActionItems.description, pattern),
                ilike(knowledgeActionItems.status, pattern)
              )
            )
          )
          .orderBy(desc(knowledgeActionItems.updatedAt))
          .limit(input.limit)
      ]);
      return {
        documents: documents.map(mapKnowledgeDocument),
        decisions: decisions.map(mapDecisionLogEntry),
        actionItems: actionItems.map(mapKnowledgeActionItem)
      };
    }
  };
}

function mapKnowledgeDocument(row: typeof knowledgeDocuments.$inferSelect): KnowledgeDocument {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    title: row.title,
    summary: row.summary,
    documentType: row.documentType as KnowledgeDocumentType,
    status: row.status as KnowledgeDocumentStatus,
    currentVersionId: row.currentVersionId,
    sourceMeetingId: row.sourceMeetingId,
    approvalStatus: row.approvalStatus as KnowledgeApprovalStatus,
    approvalRequestedByUserId: row.approvalRequestedByUserId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

function mapKnowledgeDocumentVersion(
  row: typeof knowledgeDocumentVersions.$inferSelect
): KnowledgeDocumentVersion {
  return {
    id: row.id,
    tenantId: row.tenantId,
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    title: row.title,
    body: row.body,
    summary: row.summary,
    changeReason: row.changeReason,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt
  };
}

function mapDecisionLogEntry(row: typeof decisionLogEntries.$inferSelect): DecisionLogEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    title: row.title,
    decision: row.decision,
    rationale: row.rationale,
    status: row.status as DecisionLogStatus,
    sourceMeetingId: row.sourceMeetingId,
    documentId: row.documentId,
    supersedesDecisionId: row.supersedesDecisionId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

function mapKnowledgeActionItem(row: typeof knowledgeActionItems.$inferSelect): KnowledgeActionItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    ownerUserId: row.ownerUserId,
    dueDate: row.dueDate,
    status: row.status as KnowledgeActionItemStatus,
    sourceMeetingId: row.sourceMeetingId,
    documentId: row.documentId,
    decisionId: row.decisionId,
    targetEntityType: row.targetEntityType as KnowledgeActionTargetType | null,
    targetEntityId: row.targetEntityId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
