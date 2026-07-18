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

type MockTask = { id: string; title: string; statusId: string; projectId: string; updatedAt: string };

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

/** Статус LLM-провайдера инсталляции (зеркало ответа боевого GET /agent/tools). */
export type MockAgentProvider = { model: string; live: boolean; configured?: boolean };

/** Варианты contract-mock для витрины состояний (Storybook). Без опций поведение
    прежнее: один forward-переход, без provider в tools, без квитанции. */
export type MockAgentFetchOptions = {
  /** Провайдер в ответе GET /agent/tools: live=false → баннер «Демо-режим» (G7-01). */
  provider?: MockAgentProvider;
  /** POST /agent/propose отвечает 503 agent_provider_not_configured (инсталляция без LLM-ключа). */
  providerNotConfigured?: boolean;
  /** propose предлагает ВСЕ безопасные forward-переходы (многокарточная сверка), а не первый. */
  proposeAllForward?: boolean;
  /** Адресуемая квитанция применения: плановое действие в предложении, audit-id в результатах
      execute и correlationId батча — как при сконфигурированной audit-персистентности. */
  executeReceipt?: boolean;
};

// Сценарий Storybook: useAgent создаёт mock-fetch БЕЗ аргументов (боевой код не знает
// о вариантах витрины), поэтому stories задают вариант заранее через setMockAgentScenario —
// фабрика читает его как значение по умолчанию. Вне Storybook сценарий не выставляется.
let storyScenario: MockAgentFetchOptions | null = null;
export function setMockAgentScenario(options: MockAgentFetchOptions | null): void {
  storyScenario = options;
}

export function createMockAgentFetch(options?: MockAgentFetchOptions): typeof fetch {
  const opts = options ?? storyScenario ?? {};
  const tasks: MockTask[] = [
    { id: "task-portal-1", title: "Согласовать макеты с клиентом", statusId: "status-in-progress", projectId: "proj-portal", updatedAt: "2026-06-01T10:00:00.000Z" },
    { id: "task-portal-2", title: "Сбор требований к витрине", statusId: "status-new", projectId: "proj-portal", updatedAt: "2026-06-01T10:00:00.000Z" },
    { id: "task-portal-3", title: "Финальная приёмка портала", statusId: "status-review", projectId: "proj-portal", updatedAt: "2026-06-01T10:00:00.000Z" }
  ];
  // План проекта для планового действия (executeReceipt): версия — честная
  // optimistic-precondition, как planVersion боевого apply_resource_resolution.
  const plan = { projectId: "proj-portal", version: 3 };
  const planAction = () => ({
    tool: "apply_resource_resolution",
    title: "Применить план разрешения перегрузки: сценарий «Сдвиг задач» · проект proj-portal",
    input: { projectId: plan.projectId, scenarioId: "scenario-shift-1" },
    capability: { allowed: true, reason: "same_tenant_permission_granted" },
    preview: { before: "Дизайнер перегружен: 130% на неделе 24", after: "Нагрузка ≤ 100% — сдвиг двух задач вправо" },
    preconditionVersions: { planVersion: plan.version }
  });

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!;
    let body: Record<string, unknown> = {};
    if (init?.body) {
      try { const p: unknown = JSON.parse(String(init.body)); if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>; } catch { return err("invalid_json", 400); }
    }

    // Каталог инструментов — актор-админ: всё доступно. provider — только по опции
    // (боевой сервер отдаёт его всегда; дефолт мока сохранён прежним намеренно).
    if (path === "/api/workspace/agent/tools" && method === "GET") {
      return json({
        tools: TOOLS.map((t) => ({ ...t, allowed: true, reason: "same_tenant_permission_granted" })),
        ...(opts.provider ? { provider: opts.provider } : {})
      });
    }

    // Предложение: демо-«мозг» — безопасные forward-переходы (по умолчанию первый,
    // proposeAllForward — все; executeReceipt добавляет плановое действие).
    if (path === "/api/workspace/agent/propose" && method === "POST") {
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      if (goal.length === 0 || goal.length > 2000) return err("invalid_goal", 400);
      // Инсталляция без LLM-ключа: сервер отвечает 503 с кодом и провайдером, клиент
      // квитирует реплику (G7-01). Мок эфемерен — threadId/messageIds персистированной
      // сервером квитанции здесь честно отсутствуют.
      if (opts.providerNotConfigured) {
        return json({ error: "agent_provider_not_configured", provider: opts.provider ?? { model: "mock-llm", live: false, configured: false } }, 503);
      }
      const advanceable = tasks
        .map((task) => ({ task, nextCat: FORWARD[STATUS_CAT[task.statusId] ?? ""] ?? "" }))
        .filter((x) => x.nextCat && statusForCat(x.nextCat));
      const picks = opts.proposeAllForward ? advanceable : advanceable.slice(0, 1);
      const statusActions = picks.map(({ task, nextCat }) => ({
        tool: "change_task_status",
        title: `Сменить статус задачи: «${task.title}» · проект ${task.projectId}, задача ${task.id}`,
        input: { projectId: task.projectId, taskId: task.id, statusId: statusForCat(nextCat)! },
        capability: { allowed: true, reason: "same_tenant_permission_granted" },
        preview: {
          before: STATUS_NAME[task.statusId] ?? task.statusId,
          after: STATUS_NAME[statusForCat(nextCat)!] ?? statusForCat(nextCat)!
        },
        preconditionVersions: { taskUpdatedAt: task.updatedAt }
      }));
      const proposedActions = [...statusActions, ...(opts.executeReceipt ? [planAction()] : [])];
      const statusParts = picks.map(({ task, nextCat }) => `«${task.title}»: ${STATUS_NAME[task.statusId]} → ${STATUS_NAME[statusForCat(nextCat)!]}`);
      const reasoning = proposedActions.length === 0
        ? "Сейчас нет безопасных действий — задачи в финальных статусах."
        : [
            statusParts.length === 0
              ? "Предлагаю применить план разрешения перегрузки"
              : statusParts.length === 1
                ? `Предлагаю продвинуть ${statusParts[0]}`
                : `Предлагаю продвинуть задачи: ${statusParts.join("; ")}`,
            opts.executeReceipt && statusParts.length > 0 ? ", плюс применить план разрешения перегрузки — это отдельный коммит плана" : "",
            ". До подтверждения ничего не меняется."
          ].join("");
      return json({
        goal,
        model: "demo-llm",
        reasoning,
        analyzeResults: [
          { tool: "list_my_tasks", input: {}, result: { tasks: tasks.map((t) => ({ id: t.id, title: t.title, statusId: t.statusId, projectId: t.projectId })) } },
          ...(opts.executeReceipt
            ? [{ tool: "detect_resource_overloads", input: {}, result: { overloads: [{ resource: "Дизайнер", week: "2026-W24", load: 1.3 }] } }]
            : [])
        ],
        proposedActions,
        iterations: proposedActions.length > 0 ? 3 : 1
      });
    }

    // Применение подтверждённых действий — меняем статус в in-memory сторе.
    if (path === "/api/workspace/agent/execute" && method === "POST") {
      const actions = Array.isArray(body.actions) ? body.actions : [];
      if (actions.length === 0 || actions.length > 20) return err("invalid_actions", 400);
      const results = actions.map((raw: unknown, index: number) => {
        const a = (raw && typeof raw === "object" ? raw : {}) as { tool?: unknown; input?: unknown; preconditionVersions?: unknown };
        const tool = typeof a.tool === "string" ? a.tool : "";
        const inp = (a.input && typeof a.input === "object" ? a.input : {}) as Record<string, unknown>;
        // Плановое действие (executeReceipt): применяем «план» с optimistic-проверкой
        // версии; в результате — адресуемая планово-коммитная квитанция.
        if (tool === "apply_resource_resolution" && opts.executeReceipt) {
          const pre = (a.preconditionVersions && typeof a.preconditionVersions === "object"
            ? a.preconditionVersions
            : {}) as { planVersion?: unknown };
          if (pre.planVersion !== plan.version) return { tool, ok: false, status: "conflict" as const, error: "plan_version_conflict" };
          plan.version += 1;
          return {
            tool,
            ok: true,
            status: "applied" as const,
            result: { projectId: plan.projectId, planVersion: plan.version },
            planningAuditEventId: "audit-demo-9",
            planVersion: plan.version,
            projectId: plan.projectId
          };
        }
        if (tool !== "change_task_status") return { tool, ok: false, status: "failed" as const, error: "tool_not_executable_yet" };
        const task = tasks.find((t) => t.id === inp.taskId);
        if (!task) return { tool, ok: false, status: "failed" as const, error: "task_not_found" };
        const preconditionVersions = (a.preconditionVersions && typeof a.preconditionVersions === "object"
          ? a.preconditionVersions
          : {}) as { taskUpdatedAt?: unknown };
        if (preconditionVersions.taskUpdatedAt !== task.updatedAt) {
          return {
            tool,
            ok: false,
            status: "conflict" as const,
            error: "task_version_conflict",
            currentVersions: { taskUpdatedAt: task.updatedAt }
          };
        }
        const targetCat = STATUS_CAT[String(inp.statusId)];
        const allowedNext = FORWARD[STATUS_CAT[task.statusId] ?? ""];
        if (!targetCat || targetCat !== allowedNext) return { tool, ok: false, status: "conflict" as const, error: "task_status_transition_forbidden" };
        task.statusId = String(inp.statusId);
        task.updatedAt = new Date(Date.parse(task.updatedAt) + 1).toISOString();
        return {
          tool,
          ok: true,
          status: "applied" as const,
          result: { task: { id: task.id, statusId: task.statusId, updatedAt: task.updatedAt } },
          // Квитанция — только по опции: без audit-персистентности id честно отсутствуют.
          ...(opts.executeReceipt ? { auditEventId: `agent-action-demo-${index + 1}` } : {})
        };
      });
      const summary = results.reduce(
        (counts, result) => ({ ...counts, [result.status]: counts[result.status] + 1 }),
        { applied: 0, denied: 0, conflict: 0, failed: 0 }
      );
      return json({
        results,
        applied: summary.applied > 0,
        summary,
        ...(opts.executeReceipt ? { correlationId: "agent-execute-demo" } : {})
      });
    }

    return err("not_found", 404);
  };
  return mockFetch;
}
