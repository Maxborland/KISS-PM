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
};

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
    propose(goal: string) {
      return requestJson<AgentProposeResponse>("/api/workspace/agent/propose", { method: "POST", body: JSON.stringify({ goal }) });
    },
    execute(actions: AgentActionInput[]) {
      return requestJson<AgentExecuteResponse>("/api/workspace/agent/execute", { method: "POST", body: JSON.stringify({ actions }) });
    }
  };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
