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
export type ProposedAction = { tool: string; title: string; input: Record<string, unknown>; capability: AgentCapability };
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

export type AgentExecuteResultItem = { tool: string; ok: boolean; status?: number; error?: string; result?: unknown };
export type AgentExecuteResponse = { results: AgentExecuteResultItem[]; applied: boolean };

export type AgentActionInput = { tool: string; input: Record<string, unknown> };

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
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
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
    execute(actions: AgentActionInput[]) {
      return requestJson<AgentExecuteResponse>("/api/workspace/agent/execute", { method: "POST", body: JSON.stringify({ actions }) });
    }
  };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
