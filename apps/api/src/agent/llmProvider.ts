/**
 * Абстракция LLM-провайдера для агента (P-agent slice 2).
 *
 * Интерфейс — подмножество Anthropic Messages API (text / tool_use / tool_result).
 * Две реализации:
 *   - createAnthropicLlmProvider — боевой, @anthropic-ai/sdk, ключ только server-side;
 *   - createMockLlmProvider      — детерминированный (скриптованная последовательность
 *                                  ответов) для тестов / Storybook / CI без сети.
 * Фабрика createAgentLlmProviderFromEnv выбирает боевой при наличии ANTHROPIC_API_KEY,
 * иначе mock. setAgentLlmProviderOverride — инъекция в тестах.
 */

import { createOpenRouterLlmProvider } from "./openRouterProvider";

export type LlmToolSchema = { name: string; description: string; input_schema: Record<string, unknown> };

export type LlmTextBlock = { type: "text"; text: string };
export type LlmToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock;

export type LlmToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type LlmMessage = { role: "user" | "assistant"; content: string | Array<LlmContentBlock | LlmToolResultBlock> };

export type LlmUsage = { inputTokens: number; outputTokens: number };
export type LlmResponse = { stopReason: string; content: LlmContentBlock[]; usage?: LlmUsage };

export interface LlmProvider {
  readonly model: string;
  createMessage(input: { system: string; messages: LlmMessage[]; tools: LlmToolSchema[] }): Promise<LlmResponse>;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6"; // переопределяется KISS_PM_AGENT_MODEL

// ---- боевой провайдер (Anthropic SDK) ----
export function createAnthropicLlmProvider(opts: { apiKey: string; model?: string; maxTokens?: number }): LlmProvider {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 1024;
  // SDK импортируется лениво, чтобы окружения без ключа/без сети не платили за загрузку.
  return {
    model,
    async createMessage(input) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: opts.apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: input.system,
        messages: input.messages as Parameters<typeof client.messages.create>[0]["messages"],
        tools: input.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.input_schema as { type: "object" } }))
      });
      const content = (response.content as unknown as Array<{ type: string; [k: string]: unknown }>).flatMap((block): LlmContentBlock[] => {
        if (block.type === "text") return [{ type: "text", text: String(block.text ?? "") }];
        if (block.type === "tool_use") return [{ type: "tool_use", id: String(block.id), name: String(block.name), input: (block.input as Record<string, unknown>) ?? {} }];
        return [];
      });
      const usage = response.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      const base: LlmResponse = { stopReason: String(response.stop_reason ?? "end_turn"), content };
      return usage ? { ...base, usage: { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 } } : base;
    }
  };
}

// ---- mock-провайдер (детерминированный) ----
// Скрипт = последовательность ответов; каждый вызов отдаёт следующий, последний повторяется.
export function createMockLlmProvider(responses: LlmResponse[] = [], model = "mock-llm"): LlmProvider {
  let index = 0;
  return {
    model,
    createMessage() {
      const fallback: LlmResponse = { stopReason: "end_turn", content: [{ type: "text", text: "Предложений нет." }] };
      const next = responses.length === 0 ? fallback : responses[Math.min(index, responses.length - 1)]!;
      index += 1;
      return Promise.resolve(next);
    }
  };
}

// ---- demo-провайдер (детерминированный «мозг» без сети) ----
// Не настоящий LLM: читает беседу и ведёт простой флоу list_my_tasks → предложить
// change_task_status первой задачи → завершиться. Для dev/e2e/Storybook без ключа.
export function createDemoLlmProvider(): LlmProvider {
  return {
    model: "demo-llm",
    createMessage(input) {
      let tasks: Array<{ id?: string; projectId?: string }> | null = null;
      let alreadyProposed = false;
      for (const message of input.messages) {
        if (!Array.isArray(message.content)) continue;
        for (const block of message.content) {
          if (block.type !== "tool_result") continue;
          try {
            const parsed = JSON.parse(block.content) as { tasks?: unknown; status?: unknown };
            if (Array.isArray(parsed.tasks)) tasks = parsed.tasks as Array<{ id?: string; projectId?: string }>;
            if (parsed.status === "proposed") alreadyProposed = true;
          } catch {
            /* ignore */
          }
        }
      }
      const has = (name: string) => input.tools.some((tool) => tool.name === name);

      if (alreadyProposed) {
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Демо-агент: подготовил предложение, жду подтверждения." }] });
      }
      if (tasks === null) {
        if (has("list_my_tasks")) {
          return Promise.resolve({ stopReason: "tool_use", content: [{ type: "tool_use", id: "demo-a", name: "list_my_tasks", input: {} }] });
        }
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Демо-агент: нет доступных инструментов анализа." }] });
      }
      const first = tasks.find((task) => task.id && task.projectId);
      // comment_task вместо change_task_status: у demo нет знания реальных statusId
      // тенанта (прежний хардкод "status-review" не существовал в seed и всегда
      // ронял execute), а комментарий честно применим в любой инсталляции.
      if (first && has("comment_task")) {
        return Promise.resolve({
          stopReason: "tool_use",
          content: [{ type: "tool_use", id: "demo-m", name: "comment_task", input: { taskId: first.id!, body: "Демо-агент: зафиксировал статус по задаче." } }]
        });
      }
      return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Демо-агент: подходящих безопасных действий не найдено." }] });
    }
  };
}

// ---- scripted-провайдер (детерминированный, только для e2e за двойным гейтом) ----
// Ведёт полный живой путь без сети и без мока HTTP-роутов: рассуждение →
// list_my_tasks (analyze) → предложение comment_task по первой задаче → завершение.
// comment_task выбран сознательно: его execute реально проходит governed-роут
// комментариев на живом backend (в отличие от change_task_status, где demo-провайдер
// хардкодит несуществующий statusId).
export function createScriptedLlmProvider(): LlmProvider {
  return {
    model: "scripted-llm",
    createMessage(input) {
      const has = (name: string) => input.tools.some((tool) => tool.name === name);
      // Текущая цель — последнее строковое user-сообщение (tool_result тоже role=user,
      // но с массивом блоков; история предыдущих ходов идёт раньше цели).
      let currentGoal = "";
      for (const message of input.messages) {
        if (message.role === "user" && typeof message.content === "string") currentGoal = message.content;
      }

      type Overload = { projectId?: string; resourceId?: string; date?: string; overloadMinutes?: number; taskIds?: string[] };
      type PreviewData = { projectId?: string; clientPlanVersion?: number; proposals?: Array<{ scenarioId?: string; profile?: string; conflictEffect?: string }> };
      let tasks: Array<{ id?: string; title?: string }> | null = null;
      let overloads: Overload[] | null = null;
      let previewData: PreviewData | null = null;
      let alreadyProposed = false;
      for (const message of input.messages) {
        if (!Array.isArray(message.content)) continue;
        for (const block of message.content) {
          if (block.type === "tool_use" && (block.name === "comment_task" || block.name === "apply_resource_resolution")) alreadyProposed = true;
          if (block.type !== "tool_result") continue;
          try {
            const parsed = JSON.parse(block.content) as { tasks?: unknown; overloads?: unknown; proposals?: unknown };
            if (Array.isArray(parsed.tasks)) tasks = parsed.tasks as Array<{ id?: string; title?: string }>;
            if (Array.isArray(parsed.overloads)) overloads = parsed.overloads as Overload[];
            if (Array.isArray(parsed.proposals)) previewData = parsed as PreviewData;
          } catch {
            /* ignore */
          }
        }
      }

      if (alreadyProposed) {
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Скриптованный агент: предложение готово, жду подтверждения." }] });
      }

      // Сценарный флоу PM-as-code: перегруз → живой preview сценариев → предложение apply.
      if (/перегру/i.test(currentGoal)) {
        if (overloads === null && has("detect_resource_overloads")) {
          return Promise.resolve({
            stopReason: "tool_use",
            content: [
              { type: "text", text: "Скриптованный агент: ищу перегруженные ресурсы." },
              { type: "tool_use", id: "scripted-o1", name: "detect_resource_overloads", input: {} }
            ]
          });
        }
        const target = (overloads ?? []).find((overload) => overload.projectId && overload.resourceId && overload.date);
        if (!target) {
          return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Скриптованный агент: перегрузок не найдено." }] });
        }
        if (previewData === null && has("preview_resource_resolution")) {
          return Promise.resolve({
            stopReason: "tool_use",
            content: [{
              type: "tool_use",
              id: "scripted-o2",
              name: "preview_resource_resolution",
              input: {
                projectId: target.projectId!,
                target: { resourceId: target.resourceId!, date: target.date!, overloadMinutes: target.overloadMinutes ?? 0, taskIds: target.taskIds ?? [] }
              }
            }]
          });
        }
        // Предпочитаем сценарий без принятия риска; aggressive — только с обоснованием.
        const proposals = previewData?.proposals ?? [];
        const chosen = proposals.find((proposal) => proposal.scenarioId && proposal.conflictEffect !== "accepted")
          ?? proposals.find((proposal) => proposal.scenarioId);
        if (chosen && previewData && has("apply_resource_resolution")) {
          return Promise.resolve({
            stopReason: "tool_use",
            content: [{
              type: "tool_use",
              id: "scripted-o3",
              name: "apply_resource_resolution",
              input: {
                projectId: previewData.projectId ?? target.projectId!,
                scenarioId: chosen.scenarioId!,
                ...(typeof previewData.clientPlanVersion === "number" ? { clientPlanVersion: previewData.clientPlanVersion } : {}),
                ...(chosen.conflictEffect === "accepted" ? { acceptedRiskReason: "Скриптованный e2e: сохранить сроки, приняв перегруз" } : {})
              }
            }]
          });
        }
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Скриптованный агент: применимых сценариев не найдено." }] });
      }

      if (tasks === null && has("list_my_tasks")) {
        return Promise.resolve({
          stopReason: "tool_use",
          content: [
            { type: "text", text: "Скриптованный агент: смотрю ваши задачи." },
            { type: "tool_use", id: "scripted-a", name: "list_my_tasks", input: {} }
          ]
        });
      }
      const first = (tasks ?? []).find((task) => task.id);
      if (first && has("comment_task")) {
        return Promise.resolve({
          stopReason: "tool_use",
          content: [{ type: "tool_use", id: "scripted-m", name: "comment_task", input: { taskId: first.id!, body: `Скриптованный агент: статус по задаче «${first.title ?? first.id}» зафиксирован.` } }]
        });
      }
      return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "Скриптованный агент: подходящих действий не найдено." }] });
    }
  };
}

// ---- фабрика по окружению + тест-инъекция ----
let override: LlmProvider | null = null;

export function setAgentLlmProviderOverride(provider: LlmProvider | null): void {
  override = provider;
}

/**
 * Выбор провайдера по окружению. Приоритет — OpenRouter (несколько моделей за одним API),
 * затем Anthropic, затем demo/mock. Явное переопределение — KISS_PM_AGENT_PROVIDER
 * ("openrouter" | "anthropic" | "demo" | "mock"). Модель — KISS_PM_AGENT_MODEL.
 */
export function createAgentLlmProviderFromEnv(): LlmProvider {
  if (override) return override;
  const explicit = (process.env.KISS_PM_AGENT_PROVIDER ?? "").toLowerCase();
  // Тестовые провайдеры (scripted/demo) — только за гейтом test-hooks: без него
  // KISS_PM_AGENT_DEMO=true на боевой инсталляции включал бы фейкового агента
  // с configured=true (обход честного 503 agent_provider_not_configured).
  const testHooks = process.env.KISS_PM_E2E_TEST_HOOKS === "1";
  if (testHooks && process.env.KISS_PM_AGENT_SCRIPTED === "1") return createScriptedLlmProvider();
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const maxTokensRaw = Number.parseInt(process.env.KISS_PM_AGENT_MAX_TOKENS ?? "", 10);
  const maxTokens = Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : undefined;
  const maxTokensOpt = maxTokens ? { maxTokens } : {};
  const reasoningEffort = (process.env.KISS_PM_AGENT_REASONING_EFFORT ?? "").trim();
  const reasoningOpt = reasoningEffort ? { reasoningEffort } : {};

  if (openRouterKey && openRouterKey.length > 0 && (explicit === "openrouter" || explicit === "")) {
    return createOpenRouterLlmProvider({ apiKey: openRouterKey, model: process.env.KISS_PM_AGENT_MODEL || DEFAULT_OPENROUTER_MODEL, ...maxTokensOpt, ...reasoningOpt });
  }
  if (anthropicKey && (explicit === "anthropic" || explicit === "")) {
    return createAnthropicLlmProvider({ apiKey: anthropicKey, model: process.env.KISS_PM_AGENT_MODEL || DEFAULT_MODEL, ...maxTokensOpt });
  }
  if (testHooks && (explicit === "demo" || process.env.KISS_PM_AGENT_DEMO === "true")) return createDemoLlmProvider();
  return createMockLlmProvider();
}
