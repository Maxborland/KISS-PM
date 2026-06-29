import type { ApiApp, ApiRouteDeps } from "../routeTypes";
import { readLimitedJsonBody } from "../jsonBody";
import { createPlanningReadModel } from "../planning/planningReadModel";
import { createTaskCommandWorkspace } from "../project-work/taskCommandWorkspace";
import { runAgentLoop, type AnalyzeExecutor } from "./agentLoop";
import { createAgentLlmProviderFromEnv } from "./llmProvider";
import { AGENT_TOOLS, allowedToolsForActor, findAgentTool, listToolAvailability, type AgentTool } from "./toolRegistry";

const AGENT_SYSTEM_PROMPT = [
  "Ты — ассистент-агент в системе управления проектами KISS-PM.",
  "Помогай сотруднику, используя ТОЛЬКО предоставленные инструменты — они уже отфильтрованы по",
  "его уровню доступа: ты не можешь делать то, что сотруднику не разрешено.",
  "Сначала используй analyze-инструменты (только чтение), чтобы понять ситуацию.",
  "Затем ПРЕДЛОЖИ конкретные действия через mutation-инструменты — они НЕ применяются сразу,",
  "сотрудник подтвердит каждое действие. Не выдумывай идентификаторы — бери их из результатов",
  "analyze. Объясняй кратко и по-русски."
].join(" ");

// Какие analyze-инструменты подключены к данным. Сценарные mutation-инструменты по ресурсам
// (preview/apply) пока возвращают предложение, но не исполняются в /execute — это route-bound
// транзакционная логика, выносится в переиспользуемый сервис отдельным слайсом.
const WIRED_ANALYZE = new Set(["list_my_tasks", "read_project_plan", "detect_resource_overloads"]);

const OVERLOAD_CAP = 30; // ponytail: режем payload до топ-N перегрузок (по минутам), upgrade — пагинация если мало

export function buildAnalyzeExecutor(deps: ApiRouteDeps, actorTenantId: string, actorUserId: string): AnalyzeExecutor {
  return async (tool: AgentTool, input: Record<string, unknown>) => {
    if (tool.name === "list_my_tasks") {
      if (!deps.dataSource.listMyWorkTasks) return { tasks: [], note: "persistence_not_configured" };
      const tasks = await deps.dataSource.listMyWorkTasks(actorTenantId, actorUserId);
      return {
        tasks: tasks.map((task) => ({ id: task.id, title: task.title, statusId: task.statusId, projectId: task.projectId, priority: task.priority }))
      };
    }

    if (tool.name === "read_project_plan") {
      const projectId = typeof input.projectId === "string" ? input.projectId : "";
      if (!projectId) return { note: "projectId_required" };
      if (!deps.dataSource.getPlanSnapshot) return { note: "persistence_not_configured" };
      const snapshot = await deps.dataSource.getPlanSnapshot(actorTenantId, projectId);
      if (!snapshot) return { note: "project_not_found", projectId };
      const readModel = createPlanningReadModel(snapshot);
      return {
        projectId,
        planVersion: readModel.planVersion,
        tasks: readModel.authored.tasks.map((task) => ({ id: task.id, title: task.title })),
        overloadCount: readModel.resourceLoad.overloads.length,
        overloads: readModel.resourceLoad.overloads
          .slice(0, OVERLOAD_CAP)
          .map((overload) => ({ resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }))
      };
    }

    if (tool.name === "detect_resource_overloads") {
      if (!deps.dataSource.getPlanSnapshot) return { note: "persistence_not_configured", overloads: [] };
      const wanted = typeof input.projectId === "string" && input.projectId ? input.projectId : null;
      const projectIds = wanted
        ? [wanted]
        : deps.dataSource.listProjects
          ? (await deps.dataSource.listProjects(actorTenantId)).map((project) => project.id)
          : [];
      const overloads: Array<{ projectId: string; resourceId: string; date: string; overloadMinutes: number; taskIds: string[] }> = [];
      for (const projectId of projectIds) {
        const snapshot = await deps.dataSource.getPlanSnapshot(actorTenantId, projectId);
        if (!snapshot) continue;
        const readModel = createPlanningReadModel(snapshot);
        for (const overload of readModel.resourceLoad.overloads) {
          overloads.push({ projectId, resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds });
        }
      }
      overloads.sort((left, right) => right.overloadMinutes - left.overloadMinutes);
      return { overloadCount: overloads.length, overloads: overloads.slice(0, OVERLOAD_CAP) };
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

  // Применение ПОДТВЕРЖДённых действий. Делегирует в существующие governed-команды:
  // повторная RBAC-проверка (грубая capability + точная внутри команды) + валидация + audit.
  app.post("/api/workspace/agent/execute", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const actions = (body.value as { actions?: unknown }).actions;
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > 20) {
      return context.json({ error: "invalid_actions" }, 400);
    }

    const profile = await deps.getActorProfile(actor);
    const taskWorkspace = createTaskCommandWorkspace(deps);
    const results: Array<{ tool: string; ok: boolean; status?: number; error?: string; result?: unknown }> = [];

    for (const raw of actions) {
      const action = raw as { tool?: unknown; input?: unknown };
      const toolName = typeof action.tool === "string" ? action.tool : "";
      const input = (action.input && typeof action.input === "object" ? action.input : {}) as Record<string, unknown>;
      const tool = findAgentTool(toolName);

      if (!tool || tool.kind !== "mutation") {
        results.push({ tool: toolName, ok: false, status: 400, error: "invalid_action" });
        continue;
      }
      // Грубая RBAC-проверка (defense-in-depth; точная — внутри команды).
      const coarse = tool.capability({ actor, profile });
      if (!coarse.allowed) {
        results.push({ tool: toolName, ok: false, status: 403, error: coarse.reason });
        continue;
      }

      if (tool.name === "change_task_status") {
        const projectId = typeof input.projectId === "string" ? input.projectId : "";
        const taskId = typeof input.taskId === "string" ? input.taskId : "";
        const statusId = typeof input.statusId === "string" ? input.statusId : "";
        if (!projectId || !taskId || !statusId) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        const preflight = await taskWorkspace.preflightTransitionTaskStatus({ actor, profile, projectId });
        if (!preflight.ok) {
          results.push({ tool: tool.name, ok: false, status: preflight.status, error: preflight.error });
          continue;
        }
        const transition = await taskWorkspace.transitionTaskStatus({ actor, profile, projectId, taskId, body: { statusId } });
        if (!transition.ok) {
          results.push({ tool: tool.name, ok: false, status: transition.status, error: transition.error });
          continue;
        }
        results.push({ tool: tool.name, ok: true, result: { task: transition.task } });
        continue;
      }

      // Остальные mutation (update/create/comment/planning) подключаются в следующих слайсах.
      results.push({ tool: tool.name, ok: false, status: 501, error: "tool_not_executable_yet" });
    }

    const anyApplied = results.some((r) => r.ok);
    return context.json({ results, applied: anyApplied }, anyApplied ? 200 : 422);
  });
}
