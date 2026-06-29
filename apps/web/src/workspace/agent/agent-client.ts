/* ============================================================
   Agent API client — тонкий типизированный клиент над ручками агента:
     GET  /api/workspace/agent/tools    — каталог инструментов под права актора
     POST /api/workspace/agent/propose  — LLM-цикл → предложенные действия (без мутаций)
     POST /api/workspace/agent/execute  — применить подтверждённые действия (governed)

   Зеркало createWorkspaceClient/createCrmClient: инъекция fetchImpl, credentials:include,
   x-kiss-pm-action:same-origin. Переключение на боевой = apiOrigin без fetchImpl-мока.
   ============================================================ */

export type AgentApiClientOptions = { apiOrigin: string; fetchImpl?: typeof fetch; credentials?: RequestCredentials };

export class AgentApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.name = "AgentApiError";
    this.status = status;
    this.code = code;
  }
}

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

// События живого хода работы агента (SSE /propose/stream).
export type AgentStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "analyze"; tool: string; title: string; ok: boolean }
  | { type: "proposal"; tool: string; title: string };

export type AgentExecuteResultItem = { tool: string; ok: boolean; status?: number; error?: string; result?: unknown };
export type AgentExecuteResponse = { results: AgentExecuteResultItem[]; applied: boolean };

export type AgentActionInput = { tool: string; input: Record<string, unknown> };

export function createAgentClient(options: AgentApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials = options.credentials ?? "include";

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${options.apiOrigin}${path}`, {
      ...init,
      credentials,
      headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", ...(init?.headers ?? {}) }
    });
    const raw = await response.text();
    let body: Record<string, unknown> = {};
    if (raw.length > 0) {
      try {
        const parsed: unknown = JSON.parse(raw);
        body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { error: "invalid_json_response" };
      } catch {
        body = { error: "invalid_json_response" };
      }
    }
    if (!response.ok) throw new AgentApiError(response.status, typeof body.error === "string" ? body.error : "request_failed");
    return body as T;
  }

  return {
    listTools() {
      return requestJson<{ tools: AgentToolAvailability[] }>("/api/workspace/agent/tools");
    },
    propose(goal: string, attachmentIds: string[] = []) {
      return requestJson<AgentProposeResponse>("/api/workspace/agent/propose", { method: "POST", body: JSON.stringify({ goal, attachmentIds }) });
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
      if (!response.ok) throw new AgentApiError(response.status, typeof body.error === "string" ? body.error : "upload_failed");
      const attachment = (body.attachment ?? {}) as { id?: unknown; safeDisplayName?: unknown; originalName?: unknown };
      return { id: String(attachment.id ?? ""), name: String(attachment.safeDisplayName ?? attachment.originalName ?? file.name) };
    },
    // Активные проекты тенанта — для выбора якоря вложения.
    async listProjects(): Promise<Array<{ id: string; label: string }>> {
      const body = await requestJson<{ projects?: Array<{ id?: string; title?: string; name?: string }> }>("/api/workspace/projects");
      return (body.projects ?? []).map((project) => ({ id: String(project.id ?? ""), label: String(project.title ?? project.name ?? project.id ?? "") })).filter((p) => p.id.length > 0);
    },
    // Потоковое предложение: вызывает onEvent на каждое SSE-событие, резолвится финальным `done`.
    async proposeStream(goal: string, onEvent: (event: AgentStreamEvent) => void, attachmentIds: string[] = []): Promise<AgentProposeResponse> {
      const response = await fetchImpl(`${options.apiOrigin}/api/workspace/agent/propose/stream`, {
        method: "POST",
        credentials,
        headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin" },
        body: JSON.stringify({ goal, attachmentIds })
      });
      if (!response.ok) {
        const raw = await response.text();
        let err = "request_failed";
        try { const parsed = JSON.parse(raw) as { error?: string }; if (typeof parsed.error === "string") err = parsed.error; } catch { /* keep */ }
        throw new AgentApiError(response.status, err);
      }
      if (!response.body) throw new AgentApiError(500, "stream_unsupported");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done: AgentProposeResponse | null = null;
      const handleEvent = (eventName: string, data: string) => {
        if (data.length === 0) return;
        if (eventName === "done") { done = JSON.parse(data) as AgentProposeResponse; return; }
        if (eventName === "error") { const e = JSON.parse(data) as { error?: string }; throw new AgentApiError(500, e.error ?? "agent_failed"); }
        onEvent(JSON.parse(data) as AgentStreamEvent);
      };
      // Парсим SSE-кадры (event:/data:), разделённые пустой строкой.
      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
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
      if (!done) throw new AgentApiError(500, "stream_incomplete");
      return done;
    },
    execute(actions: AgentActionInput[]) {
      return requestJson<AgentExecuteResponse>("/api/workspace/agent/execute", { method: "POST", body: JSON.stringify({ actions }) });
    }
  };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
