"use client";

import { useCallback } from "react";

import {
  guardData,
  type MutationDataResult
} from "../../lib/domain-client";
import { useResource, type LoadStatus, type ResourceState } from "../../lib/use-resource";
import type {
  ActionItemCreateInput,
  ActionItemPatchInput,
  DecisionCreateInput,
  DecisionLogEntryView,
  KnowledgeActionItemView,
  KnowledgeClient,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentVersionView,
  KnowledgeDocumentView,
  KnowledgeUserView,
  KnowledgeVersionCreateInput
} from "./knowledge-client";

/* ============================================================
   Хуки поверхности «База знаний» (зеркало use-comms/use-workspace):
   useKnowledge — три списка (документы/решения/поручения) + справочник
   имён одним loader'ом (useResource: 403 → forbidden), мутации через
   guardData с автоперезагрузкой списков после успеха.
   useKnowledgeDocument — деталь документа (документ + все версии),
   рефетч при смене documentId и после «новая версия».
   ============================================================ */

export type KnowledgeLoadStatus = LoadStatus;
export type KnowledgeDataResult<T> = MutationDataResult<T>;

export type KnowledgeData = {
  documents: KnowledgeDocumentView[];
  decisions: DecisionLogEntryView[];
  actionItems: KnowledgeActionItemView[];
  users: KnowledgeUserView[];
};

export type KnowledgeDocumentDetail = {
  document: KnowledgeDocumentView;
  versions: KnowledgeDocumentVersionView[];
};

export function useKnowledge(client: KnowledgeClient, projectId: string) {
  const loader = useCallback(async (): Promise<KnowledgeData> => {
    const [documents, decisions, actionItems, users] = await Promise.all([
      client.listDocuments(projectId),
      client.listDecisions(projectId),
      client.listActionItems(projectId),
      // Справочник имён — толерантно: его недоступность не должна валить
      // поверхность (владельцы будут показаны по id).
      client.listUsers().catch(() => ({ users: [] as KnowledgeUserView[] }))
    ]);
    return {
      documents: documents.documents,
      decisions: decisions.decisions,
      actionItems: actionItems.actionItems,
      users: users.users
    };
  }, [client, projectId]);

  const state = useResource(loader);
  const reload = state.reload;

  const createDocument = useCallback(
    async (input: KnowledgeDocumentCreateInput) => {
      const result = await guardData(() => client.createDocument(projectId, input));
      if (result.ok) await reload();
      return result;
    },
    [client, projectId, reload]
  );

  const createDecision = useCallback(
    async (input: DecisionCreateInput) => {
      const result = await guardData(() => client.createDecision(projectId, input));
      if (result.ok) await reload();
      return result;
    },
    [client, projectId, reload]
  );

  const createActionItem = useCallback(
    async (input: ActionItemCreateInput) => {
      const result = await guardData(() => client.createActionItem(projectId, input));
      if (result.ok) await reload();
      return result;
    },
    [client, projectId, reload]
  );

  const patchActionItem = useCallback(
    async (actionItemId: string, input: ActionItemPatchInput) => {
      const result = await guardData(() => client.updateActionItem(projectId, actionItemId, input));
      if (result.ok) await reload();
      return result;
    },
    [client, projectId, reload]
  );

  return { ...state, createDocument, createDecision, createActionItem, patchActionItem };
}

export function useKnowledgeDocument(
  client: KnowledgeClient,
  projectId: string,
  documentId: string | null
): ResourceState<KnowledgeDocumentDetail | null> & {
  createVersion: (input: KnowledgeVersionCreateInput) => Promise<KnowledgeDataResult<KnowledgeDocumentDetail["document"]>>;
} {
  const loader = useCallback(async (): Promise<KnowledgeDocumentDetail | null> => {
    if (!documentId) return null;
    return client.getDocument(projectId, documentId);
  }, [client, projectId, documentId]);

  const state = useResource(loader);
  const reload = state.reload;

  // Редактирование = новая версия документа; после успеха деталь перечитывается
  // (versions + currentVersionId), список документов обновляет вызывающий.
  const createVersion = useCallback(
    async (input: KnowledgeVersionCreateInput) => {
      if (!documentId) return { ok: false as const, message: "knowledge_document_not_found" };
      const result = await guardData(async () => {
        const created = await client.createDocumentVersion(projectId, documentId, input);
        return created.document;
      });
      if (result.ok) await reload();
      return result;
    },
    [client, projectId, documentId, reload]
  );

  return { ...state, createVersion };
}
