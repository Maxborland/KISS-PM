/* ============================================================
   Knowledge API client — тонкий типизированный клиент над ручками
   базы знаний проекта (apps/api/src/knowledgeRoutes.ts):
   /api/workspace/projects/:projectId/knowledge/{documents,
   documents/:id, documents/:id/versions, decisions, decisions/:id,
   action-items, action-items/:id} + справочник /api/workspace/users
   (резолв имён владельцев/авторов).

   Зеркало createWorkspaceClient: то же транспортное ядро
   createRequestJson (заголовок x-kiss-pm-action: same-origin,
   credentials), инъекция fetchImpl для contract-тестов. Даты
   пересекают провод как ISO-строки (serialize* на сервере).

   RBAC ручек: чтение — tenant.projects.read (403 → forbidden),
   мутации — tenant.projects.manage.
   ============================================================ */

import type {
  DecisionLogStatus,
  KnowledgeActionItemStatus,
  KnowledgeActionTargetType,
  KnowledgeApprovalStatus,
  KnowledgeDocumentStatus,
  KnowledgeDocumentType
} from "@kiss-pm/domain";

import { createRequestJson, DomainApiError, type DomainClientOptions } from "../../lib/domain-client";

export type KnowledgeApiClientOptions = DomainClientOptions;

// Общий класс ошибки транспорта; алиас — для instanceof-проверок поверхности.
export { DomainApiError as KnowledgeApiError };

/* ---- View-типы: сериализованные зеркала @kiss-pm/domain (Date → ISO-строка) ---- */

export type KnowledgeDocumentView = {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  summary: string | null;
  documentType: KnowledgeDocumentType;
  status: KnowledgeDocumentStatus;
  currentVersionId: string | null;
  sourceMeetingId: string | null;
  approvalStatus: KnowledgeApprovalStatus;
  approvalRequestedByUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type KnowledgeDocumentVersionView = {
  id: string;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  title: string;
  body: string;
  summary: string | null;
  changeReason: string | null;
  createdByUserId: string;
  createdAt: string;
};

export type DecisionLogEntryView = {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  decision: string;
  rationale: string | null;
  status: DecisionLogStatus;
  sourceMeetingId: string | null;
  documentId: string | null;
  supersedesDecisionId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type KnowledgeActionItemView = {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  dueDate: string | null;
  status: KnowledgeActionItemStatus;
  sourceMeetingId: string | null;
  documentId: string | null;
  decisionId: string | null;
  targetEntityType: KnowledgeActionTargetType | null;
  targetEntityId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

// Справочник пользователей тенанта (GET /api/workspace/users) — имена владельцев.
export type KnowledgeUserView = { id: string; name: string };

/* ---- Входы мутаций (тела POST/PATCH; поля с "?" сервер дефолтит сам) ---- */

export type KnowledgeDocumentCreateInput = {
  title: string;
  body: string;
  summary?: string;
  documentType?: KnowledgeDocumentType;
  changeReason?: string;
};

export type KnowledgeVersionCreateInput = {
  title: string;
  body: string;
  summary?: string;
  changeReason?: string;
};

export type DecisionCreateInput = {
  title: string;
  decision: string;
  rationale?: string;
  status?: DecisionLogStatus;
};

export type ActionItemCreateInput = {
  title: string;
  ownerUserId: string;
  description?: string;
  dueDate?: string;
  status?: KnowledgeActionItemStatus;
};

export type ActionItemPatchInput = {
  title?: string;
  description?: string;
  ownerUserId?: string;
  dueDate?: string;
  status?: KnowledgeActionItemStatus;
};

export function createKnowledgeClient(options: KnowledgeApiClientOptions) {
  const requestJson = createRequestJson(options);
  const enc = encodeURIComponent;
  const base = (projectId: string) => `/api/workspace/projects/${enc(projectId)}/knowledge`;

  return {
    // Документы проекта (GET …/knowledge/documents).
    listDocuments(projectId: string) {
      return requestJson<{ documents: KnowledgeDocumentView[] }>(`${base(projectId)}/documents`);
    },
    // Создание документа с первой версией (POST …/documents, 201).
    createDocument(projectId: string, input: KnowledgeDocumentCreateInput) {
      return requestJson<{ document: KnowledgeDocumentView; version: KnowledgeDocumentVersionView }>(
        `${base(projectId)}/documents`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    // Документ + все его версии (GET …/documents/:documentId).
    getDocument(projectId: string, documentId: string) {
      return requestJson<{ document: KnowledgeDocumentView; versions: KnowledgeDocumentVersionView[] }>(
        `${base(projectId)}/documents/${enc(documentId)}`
      );
    },
    // Редактирование = новая версия (POST …/documents/:documentId/versions, 409 → knowledge_version_conflict).
    createDocumentVersion(projectId: string, documentId: string, input: KnowledgeVersionCreateInput) {
      return requestJson<{ document: KnowledgeDocumentView; version: KnowledgeDocumentVersionView }>(
        `${base(projectId)}/documents/${enc(documentId)}/versions`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    // Решения проекта (GET …/knowledge/decisions).
    listDecisions(projectId: string) {
      return requestJson<{ decisions: DecisionLogEntryView[] }>(`${base(projectId)}/decisions`);
    },
    // Фиксация решения (POST …/decisions, 201).
    createDecision(projectId: string, input: DecisionCreateInput) {
      return requestJson<{ decision: DecisionLogEntryView }>(`${base(projectId)}/decisions`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // Поручения проекта (GET …/knowledge/action-items).
    listActionItems(projectId: string) {
      return requestJson<{ actionItems: KnowledgeActionItemView[] }>(`${base(projectId)}/action-items`);
    },
    // Создание поручения (POST …/action-items, 201). ownerUserId — обязателен.
    createActionItem(projectId: string, input: ActionItemCreateInput) {
      return requestJson<{ actionItem: KnowledgeActionItemView }>(`${base(projectId)}/action-items`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    // Частичное обновление поручения, в т.ч. смена статуса (PATCH …/action-items/:id).
    updateActionItem(projectId: string, actionItemId: string, input: ActionItemPatchInput) {
      return requestJson<{ actionItem: KnowledgeActionItemView }>(
        `${base(projectId)}/action-items/${enc(actionItemId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
      );
    },
    // Справочник пользователей тенанта — имена владельцев поручений и селект ответственного.
    listUsers() {
      return requestJson<{ users: KnowledgeUserView[] }>("/api/workspace/users");
    }
  };
}

export type KnowledgeClient = ReturnType<typeof createKnowledgeClient>;

/* ---- Коды ошибок ручек → русский текст (честные тосты с кодом) ---- */

const KNOWLEDGE_ERROR_MESSAGES: Record<string, string> = {
  session_required: "Сессия истекла. Войдите снова, чтобы продолжить",
  permission_missing: "Недостаточно прав для работы с базой знаний проекта",
  cross_tenant_denied: "Недостаточно прав для работы с базой знаний проекта",
  forbidden: "Недостаточно прав для работы с базой знаний проекта",
  knowledge_project_not_found: "Проект не найден: возможно, он удалён или ссылка устарела",
  knowledge_project_id_invalid: "Некорректный идентификатор проекта",
  knowledge_document_not_found: "Документ не найден: возможно, он удалён",
  knowledge_document_id_invalid: "Некорректный идентификатор документа",
  knowledge_decision_not_found: "Решение не найдено: возможно, оно удалено",
  knowledge_action_item_not_found: "Поручение не найдено: возможно, оно удалено",
  knowledge_version_conflict: "Версия уже добавлена параллельно. Обновите документ и повторите",
  knowledge_not_configured: "Сервис базы знаний временно недоступен",
  knowledge_title_required: "Укажите название",
  knowledge_title_invalid: "Название слишком длинное или содержит недопустимые символы",
  knowledge_body_required: "Заполните содержимое",
  knowledge_body_invalid: "Содержимое слишком длинное или содержит недопустимые символы",
  knowledge_summary_invalid: "Краткое описание слишком длинное или содержит недопустимые символы",
  knowledge_reason_invalid: "Комментарий слишком длинный или содержит недопустимые символы",
  knowledge_document_type_invalid: "Некорректный тип документа",
  knowledge_approval_status_invalid: "Некорректный статус согласования",
  decision_status_invalid: "Некорректный статус решения",
  knowledge_action_item_status_invalid: "Некорректный статус поручения",
  knowledge_action_due_date_invalid: "Некорректный срок (нужна дата ГГГГ-ММ-ДД)",
  knowledge_action_owner_invalid: "Некорректный ответственный",
  tenant_user_not_found: "Пользователь не найден в организации",
  invalid_json_response: "Сервис вернул некорректный ответ",
  request_failed: "Не удалось выполнить запрос к базе знаний"
};

// Код (или его отсутствие) → RU-текст; неизвестный код показываем как есть —
// честнее, чем прятать причину за общей формулировкой.
export function knowledgeErr(code?: string, fallback?: string): string {
  if (!code) return KNOWLEDGE_ERROR_MESSAGES.request_failed as string;
  return KNOWLEDGE_ERROR_MESSAGES[code] ?? fallback ?? code;
}
