/**
 * OpenRouter LLM-провайдер (OpenAI-совместимый /chat/completions) для агента.
 *
 * OpenRouter проксирует множество моделей за единым OpenAI-форматом — поэтому здесь нет SDK,
 * только fetch + трансляция нашего внутреннего формата (Anthropic-подобные content-блоки
 * text/tool_use/tool_result) в OpenAI messages/tool_calls и обратно. Ключ — только server-side.
 */
import type { LlmContentBlock, LlmMessage, LlmProvider, LlmResponse, LlmToolSchema } from "./llmProvider";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenAiToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

// Наш формат → OpenAI messages.
export function toOpenAiMessages(system: string, messages: LlmMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    if (message.role === "assistant") {
      const text = message.content
        .filter((block): block is Extract<LlmContentBlock, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("");
      const toolCalls: OpenAiToolCall[] = message.content
        .filter((block): block is Extract<LlmContentBlock, { type: "tool_use" }> => block.type === "tool_use")
        .map((block) => ({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input) } }));
      out.push({ role: "assistant", content: text.length > 0 ? text : null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) });
    } else {
      // user-сообщение с tool_result-блоками → отдельные tool-сообщения OpenAI.
      for (const block of message.content) {
        if (block.type === "tool_result") out.push({ role: "tool", tool_call_id: block.tool_use_id, content: block.content });
      }
    }
  }
  return out;
}

export function toOpenAiTools(tools: LlmToolSchema[]) {
  return tools.map((tool) => ({ type: "function" as const, function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }));
}

// OpenAI ответ → наш LlmResponse.
export function fromOpenAiResponse(data: unknown): LlmResponse {
  const choice = (data as { choices?: Array<{ message?: unknown; finish_reason?: unknown }> }).choices?.[0];
  const message = (choice?.message ?? {}) as { content?: unknown; tool_calls?: unknown };
  const content: LlmContentBlock[] = [];
  if (typeof message.content === "string" && message.content.trim().length > 0) {
    content.push({ type: "text", text: message.content });
  }
  const toolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as OpenAiToolCall[]) : [];
  for (const call of toolCalls) {
    let input: Record<string, unknown> = {};
    try { const parsed: unknown = JSON.parse(call.function?.arguments || "{}"); if (parsed && typeof parsed === "object") input = parsed as Record<string, unknown>; } catch { /* keep {} */ }
    content.push({ type: "tool_use", id: String(call.id), name: String(call.function?.name ?? ""), input });
  }
  const stopReason = choice?.finish_reason === "tool_calls" || toolCalls.length > 0 ? "tool_use" : "end_turn";
  const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
  const base: LlmResponse = { stopReason, content };
  return usage ? { ...base, usage: { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 } } : base;
}

export function createOpenRouterLlmProvider(opts: { apiKey: string; model: string; maxTokens?: number; reasoningEffort?: string; fetchImpl?: typeof fetch }): LlmProvider {
  const fetchImpl = opts.fetchImpl ?? fetch;
  // Reasoning-effort (low|medium|high) для reasoning-моделей передаём как top-level
  // `reasoning.effort` — OpenRouter нормализует его под конкретный провайдер. Пусто —
  // не отправляем ключ, модель берёт свой дефолт.
  const reasoning = opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {};
  // При включённом reasoning на Anthropic-пути OpenRouter выводит reasoning-budget с
  // минимумом 1024 токена и требует max_tokens СТРОГО больше бюджета. Дефолтный
  // max_tokens=1024 сломал бы каждый живой запрос. Поднимаем пол до 8192 (бюджет +
  // запас на вывод), сохраняя явный KISS_PM_AGENT_MAX_TOKENS, если он больше.
  const REASONING_MAX_TOKENS_FLOOR = 8192;
  const maxTokens = opts.reasoningEffort
    ? Math.max(opts.maxTokens ?? 0, REASONING_MAX_TOKENS_FLOOR)
    : opts.maxTokens ?? 1024;
  return {
    model: opts.model,
    async createMessage(input) {
      const response = await fetchImpl(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
          // OpenRouter рекомендует идентифицировать приложение (необязательно, но полезно для квот).
          "HTTP-Referer": "https://kiss-pm.local",
          "X-Title": "KISS-PM Agent"
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: maxTokens,
          messages: toOpenAiMessages(input.system, input.messages),
          tools: toOpenAiTools(input.tools),
          tool_choice: "auto",
          ...reasoning
        })
      });
      if (!response.ok) {
        throw new Error(`openrouter_${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
      return fromOpenAiResponse(await response.json());
    }
  };
}
