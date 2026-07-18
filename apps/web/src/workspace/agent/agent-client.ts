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
  preconditionVersions?: { taskUpdatedAt?: string };
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
};

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
};
export type AgentExecuteSummary = Record<AgentExecuteStatus, number>;
export type AgentExecuteResponse = {
  results: AgentExecuteResultItem[];
  applied: boolean;
  summary: AgentExecuteSummary;
  correlationId?: string;
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
  preconditionVersions?: { taskUpdatedAt?: string };
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
    propose(goal: string, attachmentIds: string[] = [], history: AgentHistoryTurn[] = []) {
      return requestJson<AgentProposeResponse>("/api/workspace/agent/propose", { method: "POST", body: JSON.stringify({ goal, attachmentIds, history }) });
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
    async proposeStream(goal: string, onEvent: (event: AgentStreamEvent) => void, attachmentIds: string[] = [], history: AgentHistoryTurn[] = []): Promise<AgentProposeResponse> {
      const response = await fetchImpl(`${options.apiOrigin}/api/workspace/agent/propose/stream`, {
        method: "POST",
        credentials,
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ goal, attachmentIds, history })
      });
      if (!response.ok) {
        const raw = await response.text();
        let err = "request_failed";
        try { const parsed = JSON.parse(raw) as { error?: string }; if (typeof parsed.error === "string") err = parsed.error; } catch { /* keep */ }
        throw new DomainApiError(response.status, err, { error: err });
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
