/* ============================================================
   Agent API client — тонкий типизированный клиент над ручками агента:
     GET  /api/workspace/agent/tools    — каталог инструментов под права актора
     POST /api/workspace/agent/propose  — LLM-цикл → предложенные действия (без мутаций)
     POST /api/workspace/agent/execute  — применить подтверждённые действия (governed)

   Зеркало createWorkspaceClient/createCrmClient: инъекция fetchImpl, credentials:include,
   x-kiss-pm-action:same-origin. Переключение на боевой = apiOrigin без fetchImpl-мока.
   ============================================================ */

import { createRequestJson, DomainApiError, type DomainClientOptions } from "../../lib/domain-client";

export type AgentApiClientOptions = DomainClientOptions;

// Общий класс ошибки транспорта; алиас сохраняет прежнее имя для instanceof-проверок.
// Надмножество прежнего AgentApiError: добавилось поле body (раньше тела не было).
export { DomainApiError as AgentApiError };

export type AgentToolKind = "analyze" | "mutation";
export type AgentToolAvailability = { name: string; title: string; description: string; kind: AgentToolKind; allowed: boolean; reason: string };

export type AgentCapability = { allowed: boolean; reason: string };
export type ProposedAction = {
  tool: string;
  title: string;
  input: Record<string, unknown>;
  capability: AgentCapability;
  preview: { before: string; after: string };
  preconditionVersions?: { taskUpdatedAt?: string; planVersion?: number };
};
export type AnalyzeResult = { tool: string; input: Record<string, unknown>; result: unknown };

export type AgentProposeResponse = {
  goal: string;
  model: string;
  reasoning: string;
  analyzeResults: AnalyzeResult[];
  proposedActions: ProposedAction[];
  iterations: number;
  stopReason?: string;
  outputTokens?: number;
  // Персистентность (P1): id треда и записанных сервером ходов (user + ответ агента).
  // Отсутствуют честно, если collaboration-персистентность не сконфигурирована.
  threadId?: string;
  messageIds?: string[];
};

// Персистентный тред агента (guarded GET /agent/thread + существующий messages-роут).
export type AgentThreadInfo = { id: string };
export type AgentThreadOutcome = {
  tool: string;
  status: string;
  auditEventId?: string;
  planningAuditEventId?: string;
  planVersion?: number;
  projectId?: string;
};
export type AgentThreadTurn = {
  id: string;
  createdAt: string;
  body: string;
  role: "user" | "agent";
  kind?: "error" | "result";
  proposal?: { actionsTotal?: number; actions?: Array<{ tool?: string; title?: string }> };
  correlationId?: string;
  outcomes?: AgentThreadOutcome[];
};
// rawCount — размер СЫРОГО окна сообщений (до фильтра agent-метки): по нему клиент
// решает, есть ли более ранняя история (окно короче лимита = истории больше нет).
export type AgentThreadHistoryPage = { turns: AgentThreadTurn[]; nextCursor: string | null; rawCount: number };

export const AGENT_HISTORY_PAGE_LIMIT = 30;

// Ходы треда — только сообщения с metadata.agent (беседа agent-типа readonly для клиента,
// но контракт не запрещает будущие системные сообщения — незнакомое пропускаем честно).
function decodeThreadTurns(value: unknown): AgentThreadHistoryPage {
  const record = (value && typeof value === "object" ? value : {}) as { messages?: unknown; nextCursor?: unknown };
  const messages = Array.isArray(record.messages) ? record.messages : [];
  const turns: AgentThreadTurn[] = [];
  for (const raw of messages) {
    const message = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const metadata = (message.metadata && typeof message.metadata === "object" ? message.metadata : {}) as { agent?: unknown };
    const agent = (metadata.agent && typeof metadata.agent === "object" ? metadata.agent : null) as
      | { role?: unknown; kind?: unknown; proposal?: unknown; correlationId?: unknown; outcomes?: unknown }
      | null;
    if (!agent || (agent.role !== "user" && agent.role !== "agent")) continue;
    if (typeof message.id !== "string" || typeof message.body !== "string") continue;
    const outcomes = Array.isArray(agent.outcomes)
      ? agent.outcomes.flatMap((entry): AgentThreadOutcome[] => {
          const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
          if (typeof item.tool !== "string" || typeof item.status !== "string") return [];
          return [{
            tool: item.tool,
            status: item.status,
            ...(typeof item.auditEventId === "string" ? { auditEventId: item.auditEventId } : {}),
            ...(typeof item.planningAuditEventId === "string" ? { planningAuditEventId: item.planningAuditEventId } : {}),
            ...(typeof item.planVersion === "number" ? { planVersion: item.planVersion } : {}),
            ...(typeof item.projectId === "string" ? { projectId: item.projectId } : {})
          }];
        })
      : undefined;
    turns.push({
      id: message.id,
      createdAt: typeof message.createdAt === "string" ? message.createdAt : "",
      body: message.body,
      role: agent.role,
      ...(agent.kind === "error" || agent.kind === "result" ? { kind: agent.kind } : {}),
      ...(agent.proposal && typeof agent.proposal === "object" ? { proposal: agent.proposal as NonNullable<AgentThreadTurn["proposal"]> } : {}),
      ...(typeof agent.correlationId === "string" ? { correlationId: agent.correlationId } : {}),
      ...(outcomes && outcomes.length > 0 ? { outcomes } : {})
    });
  }
  return { turns, nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null, rawCount: messages.length };
}

// Реплика истории треда (память чата) — отправляется в propose перед текущей целью.
export type AgentHistoryTurn = { role: "user" | "assistant"; text: string };

// События живого хода работы агента (SSE /propose/stream).
export type AgentStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "analyze"; tool: string; title: string; ok: boolean }
  | { type: "proposal"; tool: string; title: string };

export type AgentExecuteStatus = "applied" | "denied" | "conflict" | "failed";
export type AgentExecuteResultItem = {
  tool: string;
  ok: boolean;
  status: AgentExecuteStatus;
  error?: string;
  result?: unknown;
  currentVersions?: { taskUpdatedAt?: string };
  // Квитанция (fail-closed): id audit-события agent-action-* — только для applied/denied
  // при сконфигурированной audit-персистентности; planningAuditEventId/planVersion — только
  // для планообразующих applied-действий (это событие адресуемо на вкладке «Коммиты»).
  auditEventId?: string;
  planningAuditEventId?: string;
  planVersion?: number;
  projectId?: string;
};
export type AgentExecuteSummary = Record<AgentExecuteStatus, number>;
export type AgentExecuteResponse = {
  results: AgentExecuteResultItem[];
  applied: boolean;
  summary: AgentExecuteSummary;
  correlationId?: string;
  // Персистентность (P1): id треда и записанного сервером result-сообщения.
  threadId?: string;
  messageId?: string;
};

const EXECUTE_STATUS_VALUES = ["applied", "denied", "conflict", "failed"] as const;
const EXECUTE_STATUSES = new Set<AgentExecuteStatus>(EXECUTE_STATUS_VALUES);

function decodeExecuteResponse(value: unknown, actions: AgentActionInput[]): AgentExecuteResponse {
  if (!value || typeof value !== "object") throw new DomainApiError(502, "invalid_execute_response", { error: "invalid_execute_response" });
  const response = value as Partial<AgentExecuteResponse>;
  const resultsValid = Array.isArray(response.results)
    && response.results.length === actions.length
    && response.results.every((item, index) =>
      item
      && item.tool === actions[index]?.tool
      && typeof item.ok === "boolean"
      && EXECUTE_STATUSES.has(item.status)
      && item.ok === (item.status === "applied")
      && (item.auditEventId === undefined || typeof item.auditEventId === "string")
      && (item.planningAuditEventId === undefined || typeof item.planningAuditEventId === "string")
      && (item.planVersion === undefined || typeof item.planVersion === "number")
      && (item.projectId === undefined || typeof item.projectId === "string")
    );
  const summary = response.summary;
  const summaryValid = summary && EXECUTE_STATUS_VALUES.every((status) =>
    Number.isInteger(summary[status]) && summary[status] >= 0
  );
  // correlationId опционален: без сконфигурированной audit-персистентности его честно нет.
  if (
    !resultsValid || !summaryValid || typeof response.applied !== "boolean"
    || (response.correlationId !== undefined && typeof response.correlationId !== "string")
  ) {
    throw new DomainApiError(502, "invalid_execute_response", { error: "invalid_execute_response" });
  }
  const counts: AgentExecuteSummary = { applied: 0, denied: 0, conflict: 0, failed: 0 };
  for (const result of response.results!) counts[result.status] += 1;
  if (
    EXECUTE_STATUS_VALUES.some((status) => summary[status] !== counts[status])
    || response.applied !== (counts.applied > 0)
  ) {
    throw new DomainApiError(502, "invalid_execute_response", { error: "invalid_execute_response" });
  }
  return response as AgentExecuteResponse;
}

export type AgentActionInput = {
  tool: string;
  input: Record<string, unknown>;
  preconditionVersions?: { taskUpdatedAt?: string; planVersion?: number };
};

export function createAgentClient(options: AgentApiClientOptions) {
  // fetchImpl/credentials остаются нужны напрямую: uploadAttachment (multipart без
  // content-type json) и proposeStream (SSE) не проходят через requestJson.
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";
  const requestJson = createRequestJson(options);

  return {
    listTools() {
      return requestJson<{ tools: AgentToolAvailability[]; provider?: { model: string; live: boolean; configured?: boolean } }>("/api/workspace/agent/tools");
    },
    propose(goal: string, attachmentIds: string[] = [], history: AgentHistoryTurn[] = [], threadId?: string) {
      return requestJson<AgentProposeResponse>("/api/workspace/agent/propose", { method: "POST", body: JSON.stringify({ goal, attachmentIds, history, ...(threadId ? { threadId } : {}) }) });
    },
    // Персистентный тред пользователя: create-or-get (guarded-роут P1).
    async loadThread(): Promise<AgentThreadInfo> {
      const body = await requestJson<{ conversation?: { id?: unknown } }>("/api/workspace/agent/thread");
      const id = body.conversation && typeof body.conversation.id === "string" ? body.conversation.id : "";
      if (!id) throw new DomainApiError(502, "invalid_thread_response", { error: "invalid_thread_response" });
      return { id };
    },
    // Страница истории треда (существующий messages-роут, membership-доступ).
    async loadThreadHistory(threadId: string, cursor?: string): Promise<AgentThreadHistoryPage> {
      const query = cursor
        ? `?limit=${AGENT_HISTORY_PAGE_LIMIT}&cursor=${encodeURIComponent(cursor)}`
        : `?limit=${AGENT_HISTORY_PAGE_LIMIT}`;
      const body = await requestJson<unknown>(`/api/workspace/conversations/${encodeURIComponent(threadId)}/messages${query}`);
      return decodeThreadTurns(body);
    },
    // Загрузка файла через ШТАТНУЮ ручку вложений (multipart), привязка к сущности-якорю.
    async uploadAttachment(file: File, entityType: string, entityId: string): Promise<{ id: string; name: string }> {
      const form = new FormData();
      form.append("entityType", entityType);
      form.append("entityId", entityId);
      form.append("file", file);
      // content-type НЕ ставим — браузер выставит multipart-boundary сам.
      const response = await fetchImpl(`${options.apiOrigin}/api/workspace/attachments/files`, {
        method: "POST",
        credentials,
        headers: { "x-kiss-pm-action": "same-origin" },
        body: form
      });
      const raw = await response.text();
      let body: Record<string, unknown> = {};
      try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>; } catch { /* keep */ }
      if (!response.ok) throw new DomainApiError(response.status, typeof body.error === "string" ? body.error : "upload_failed", body);
      // serializeAttachment кладёт имя под fileAsset (наверху только id) — берём оттуда.
      const attachment = (body.attachment ?? {}) as { id?: unknown; fileAsset?: { safeDisplayName?: unknown; originalName?: unknown } };
      const fileAsset = attachment.fileAsset ?? {};
      return { id: String(attachment.id ?? ""), name: String(fileAsset.safeDisplayName ?? fileAsset.originalName ?? file.name) };
    },
    // Активные проекты тенанта — для выбора якоря вложения.
    async listProjects(): Promise<Array<{ id: string; label: string }>> {
      const body = await requestJson<{ projects?: Array<{ id?: string; title?: string; name?: string }> }>("/api/workspace/projects");
      return (body.projects ?? []).map((project) => ({ id: String(project.id ?? ""), label: String(project.title ?? project.name ?? project.id ?? "") })).filter((p) => p.id.length > 0);
    },
    // Потоковое предложение: вызывает onEvent на каждое SSE-событие, резолвится финальным `done`.
    async proposeStream(goal: string, onEvent: (event: AgentStreamEvent) => void, attachmentIds: string[] = [], history: AgentHistoryTurn[] = [], threadId?: string): Promise<AgentProposeResponse> {
      const response = await fetchImpl(`${options.apiOrigin}/api/workspace/agent/propose/stream`, {
        method: "POST",
        credentials,
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ goal, attachmentIds, history, ...(threadId ? { threadId } : {}) })
      });
      if (!response.ok) {
        const raw = await response.text();
        let err = "request_failed";
        let body: Record<string, unknown> = { error: err };
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") body = parsed;
          if (typeof parsed.error === "string") err = parsed.error;
        } catch { /* keep */ }
        // Полное тело важно вызывающему: 503 agent_provider_not_configured несёт
        // threadId/messageIds персистированной сервером квитанции (P1).
        throw new DomainApiError(response.status, err, body);
      }
      if (!response.body) throw new DomainApiError(500, "stream_unsupported", { error: "stream_unsupported" });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done: AgentProposeResponse | null = null;
      const handleEvent = (eventName: string, data: string) => {
        if (data.length === 0) return;
        if (eventName === "done") { done = JSON.parse(data) as AgentProposeResponse; return; }
        if (eventName === "error") { const e = JSON.parse(data) as { error?: string }; throw new DomainApiError(500, e.error ?? "agent_failed", e as Record<string, unknown>); }
        onEvent(JSON.parse(data) as AgentStreamEvent);
      };
      try {
        // Парсим SSE-кадры (event:/data:), разделённые пустой строкой. Нормализуем CRLF→LF
        // (прокси/CDN могут переписать переводы строк) — иначе границы кадров не находятся.
        for (;;) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            let eventName = "message";
            const dataLines: string[] = [];
            for (const line of frame.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
            }
            handleEvent(eventName, dataLines.join("\n"));
          }
        }
      } finally {
        // Всегда отпускаем поток — в т.ч. когда handleEvent бросил на `event: error`.
        await reader.cancel().catch(() => {});
      }
      if (!done) throw new DomainApiError(500, "stream_incomplete", { error: "stream_incomplete" });
      return done;
    },
    async execute(actions: AgentActionInput[]) {
      const response = await requestJson<unknown>("/api/workspace/agent/execute", { method: "POST", body: JSON.stringify({ actions }) });
      return decodeExecuteResponse(response, actions);
    }
  };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
