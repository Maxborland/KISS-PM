/* ============================================================
   Contract-grounded mock backend агента (Storybook).

   ЧЕСТНОСТЬ: in-memory мок, зеркалящий боевой контракт агента
   (GET /agent/tools, POST /agent/propose, POST /agent/execute). Актор —
   Администратор (полный набор прав), поэтому все инструменты доступны.
   propose — детерминированный демо-«мозг» (как боевой createDemoLlmProvider без
   ключа): анализирует задачи → предлагает безопасный forward-переход. execute —
   реально меняет статус задачи в in-memory сторе (как governed transitionTaskStatus).
   Переключение на боевой LLM/бэк = apiOrigin (live) + ANTHROPIC_API_KEY на сервере.
   ============================================================ */

type MockTask = { id: string; title: string; statusId: string; projectId: string };

// Forward-путь по категориям статусов (подмножество ALLOWED_TRANSITIONS).
const FORWARD: Record<string, string> = { new: "in_progress", waiting: "in_progress", in_progress: "review", review: "done", done: "" };
const STATUS_CAT: Record<string, string> = {
  "status-new": "new", "status-waiting": "waiting", "status-in-progress": "in_progress", "status-review": "review", "status-done": "done"
};
const STATUS_NAME: Record<string, string> = {
  "status-new": "Новая", "status-waiting": "Ожидание", "status-in-progress": "В работе", "status-review": "На проверке", "status-done": "Готово"
};
const statusForCat = (cat: string): string | null => Object.keys(STATUS_CAT).find((id) => STATUS_CAT[id] === cat) ?? null;

const TOOLS = [
  { name: "list_my_tasks", title: "Мои задачи", description: "Задачи текущего сотрудника (только чтение).", kind: "analyze" as const },
  { name: "detect_resource_overloads", title: "Найти перегрузки ресурсов", description: "Перегруженные ресурсы (только чтение).", kind: "analyze" as const },
  { name: "preview_resource_resolution", title: "Предложить план разрешения перегрузки", description: "Варианты плана (только превью).", kind: "analyze" as const },
  { name: "change_task_status", title: "Сменить статус задачи", description: "Перевести задачу в следующий статус.", kind: "mutation" as const },
  { name: "update_task", title: "Изменить задачу", description: "Изменить поля задачи.", kind: "mutation" as const },
  { name: "comment_task", title: "Прокомментировать задачу", description: "Добавить комментарий.", kind: "mutation" as const },
  { name: "apply_resource_resolution", title: "Применить план разрешения перегрузки", description: "Применить выбранный сценарий.", kind: "mutation" as const }
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (error: string, status: number) => json({ error }, status);

export function createMockAgentFetch(): typeof fetch {
  const tasks: MockTask[] = [
    { id: "task-portal-1", title: "Согласовать макеты с клиентом", statusId: "status-in-progress", projectId: "proj-portal" },
    { id: "task-portal-2", title: "Сбор требований к витрине", statusId: "status-new", projectId: "proj-portal" },
    { id: "task-portal-3", title: "Финальная приёмка портала", statusId: "status-review", projectId: "proj-portal" }
  ];

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try { const p: unknown = JSON.parse(String(init.body)); if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>; } catch { return err("invalid_json", 400); }
    }

    // Каталог инструментов — актор-админ: всё доступно.
    if (path === "/api/workspace/agent/tools" && method === "GET") {
      return json({ tools: TOOLS.map((t) => ({ ...t, allowed: true, reason: "same_tenant_permission_granted" })) });
    }

    // Предложение: демо-«мозг» — первый безопасный forward-переход.
    if (path === "/api/workspace/agent/propose" && method === "POST") {
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      if (goal.length === 0 || goal.length > 2000) return err("invalid_goal", 400);
      const advanceable = tasks
        .map((task) => ({ task, nextCat: FORWARD[STATUS_CAT[task.statusId] ?? ""] ?? "" }))
        .filter((x) => x.nextCat && statusForCat(x.nextCat));
      const pick = advanceable[0] ?? null;
      const proposedActions = pick
        ? [{
            tool: "change_task_status",
            title: "Сменить статус задачи",
            input: { projectId: pick.task.projectId, taskId: pick.task.id, statusId: statusForCat(pick.nextCat)! },
            capability: { allowed: true, reason: "same_tenant_permission_granted" }
          }]
        : [];
      return json({
        goal,
        model: "demo-llm",
        reasoning: pick
          ? `Предлагаю продвинуть «${pick.task.title}»: ${STATUS_NAME[pick.task.statusId]} → ${STATUS_NAME[statusForCat(pick.nextCat)!]}. До подтверждения ничего не меняется.`
          : "Сейчас нет безопасных действий — задачи в финальных статусах.",
        analyzeResults: [{ tool: "list_my_tasks", input: {}, result: { tasks: tasks.map((t) => ({ id: t.id, title: t.title, statusId: t.statusId, projectId: t.projectId })) } }],
        proposedActions,
        iterations: pick ? 3 : 1
      });
    }

    // Применение подтверждённых действий — меняем статус в in-memory сторе.
    if (path === "/api/workspace/agent/execute" && method === "POST") {
      const actions = Array.isArray(body.actions) ? body.actions : [];
      if (actions.length === 0 || actions.length > 20) return err("invalid_actions", 400);
      const results = actions.map((raw: unknown) => {
        const a = (raw && typeof raw === "object" ? raw : {}) as { tool?: unknown; input?: unknown };
        const tool = typeof a.tool === "string" ? a.tool : "";
        const inp = (a.input && typeof a.input === "object" ? a.input : {}) as Record<string, unknown>;
        if (tool !== "change_task_status") return { tool, ok: false, status: 501, error: "tool_not_executable_yet" };
        const task = tasks.find((t) => t.id === inp.taskId);
        if (!task) return { tool, ok: false, status: 404, error: "task_not_found" };
        const targetCat = STATUS_CAT[String(inp.statusId)];
        const allowedNext = FORWARD[STATUS_CAT[task.statusId] ?? ""];
        if (!targetCat || targetCat !== allowedNext) return { tool, ok: false, status: 409, error: "task_status_transition_forbidden" };
        task.statusId = String(inp.statusId);
        return { tool, ok: true, result: { task: { id: task.id, statusId: task.statusId } } };
      });
      const applied = results.some((r) => r.ok);
      return json({ results, applied }, applied ? 200 : 422);
    }

    return err("not_found", 404);
  };
  return mockFetch;
}
