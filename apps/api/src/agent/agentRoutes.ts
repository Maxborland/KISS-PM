import type { ApiApp, ApiRouteDeps } from "../routeTypes";
import { readLimitedJsonBody } from "../jsonBody";
import { runAgentLoop, type AnalyzeExecutor } from "./agentLoop";
import { createAgentLlmProviderFromEnv } from "./llmProvider";
import { AGENT_TOOLS, allowedToolsForActor, listToolAvailability, type AgentTool } from "./toolRegistry";

const AGENT_SYSTEM_PROMPT = [
  "Ты — ассистент-агент в системе управления проектами KISS-PM.",
  "Помогай сотруднику, используя ТОЛЬКО предоставленные инструменты — они уже отфильтрованы по",
  "его уровню доступа: ты не можешь делать то, что сотруднику не разрешено.",
  "Сначала используй analyze-инструменты (только чтение), чтобы понять ситуацию.",
  "Затем ПРЕДЛОЖИ конкретные действия через mutation-инструменты — они НЕ применяются сразу,",
  "сотрудник подтвердит каждое действие. Не выдумывай идентификаторы — бери их из результатов",
  "analyze. Объясняй кратко и по-русски."
].join(" ");

// Какие analyze-инструменты уже подключены к данным (slice 2). Остальные analyze (план/ресурсы)
// подключаются в slice 3 и пока не предлагаются LLM, чтобы он не звал неготовое.
const WIRED_ANALYZE = new Set(["list_my_tasks"]);

function buildAnalyzeExecutor(deps: ApiRouteDeps, actorTenantId: string, actorUserId: string): AnalyzeExecutor {
  return async (tool: AgentTool) => {
    if (tool.name === "list_my_tasks") {
      if (!deps.dataSource.listMyWorkTasks) return { tasks: [], note: "persistence_not_configured" };
      const tasks = await deps.dataSource.listMyWorkTasks(actorTenantId, actorUserId);
      return {
        tasks: tasks.map((task) => ({ id: task.id, title: task.title, statusId: task.statusId, projectId: task.projectId, priority: task.priority }))
      };
    }
    throw new Error("analyze_tool_not_wired");
  };
}

/**
 * Маршруты агента (P-agent).
 * Slice 1: GET /tools. Slice 2: POST /propose (LLM-цикл, analyze live, mutation как предложения).
 * Slice 3 добавит POST /execute (governed apply) + analyze план/ресурсов.
 */
export function registerAgentRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/workspace/agent/tools", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    return context.json({ tools: listToolAvailability(actor, profile) });
  });

  app.post("/api/workspace/agent/propose", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const goal = typeof (body.value as { goal?: unknown }).goal === "string" ? (body.value as { goal: string }).goal.trim() : "";
    if (goal.length === 0 || goal.length > 2000) return context.json({ error: "invalid_goal" }, 400);

    const profile = await deps.getActorProfile(actor);
    const allowed = allowedToolsForActor(actor, profile);
    // LLM получает: разрешённые mutation-инструменты (как предлагаемые) + подключённые analyze.
    const offered = allowed.filter((tool) => tool.kind === "mutation" || WIRED_ANALYZE.has(tool.name));

    const provider = createAgentLlmProviderFromEnv();
    const result = await runAgentLoop({
      provider,
      system: AGENT_SYSTEM_PROMPT,
      goal,
      tools: offered,
      executeAnalyze: buildAnalyzeExecutor(deps, actor.tenantId, actor.id)
    });

    // Аннотируем предложения грубым capability (точная проверка — при /execute).
    const capabilityByTool = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool.capability({ actor, profile })]));
    const proposedActions = result.proposedActions.map((action) => ({
      ...action,
      capability: capabilityByTool.get(action.tool) ?? { allowed: false, reason: "permission_missing" }
    }));

    return context.json({
      goal,
      model: result.model,
      reasoning: result.reasoning,
      analyzeResults: result.analyzeResults,
      proposedActions,
      iterations: result.iterations
    });
  });
}
