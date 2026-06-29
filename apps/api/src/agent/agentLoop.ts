import type { AgentTool } from "./toolRegistry";
import type { LlmContentBlock, LlmMessage, LlmProvider, LlmToolResultBlock } from "./llmProvider";

/**
 * Цикл агента (P-agent slice 2): ведёт диалог LLM ↔ инструменты.
 *
 * - analyze-инструменты исполняются ВЖИВУЮ (только чтение) и их результат отдаётся LLM.
 * - mutation-инструменты НЕ исполняются: записываются как предлагаемые действия и LLM
 *   получает синтетический результат "proposed (pending confirmation)". Реальное применение —
 *   отдельным /execute по подтверждению (slice 3), с повторной server-side RBAC-проверкой.
 *
 * RBAC: вызывающий обязан передавать ТОЛЬКО разрешённые актору tools (allowedToolsForActor),
 * так что LLM физически не видит недоступные инструменты.
 */
export type ProposedAction = { tool: string; title: string; input: Record<string, unknown> };
export type AnalyzeResult = { tool: string; input: Record<string, unknown>; result: unknown };

export type AgentStopReason = "completed" | "max_iterations" | "token_budget" | "deadline";

export type AgentLoopResult = {
  reasoning: string;
  proposedActions: ProposedAction[];
  analyzeResults: AnalyzeResult[];
  iterations: number;
  model: string;
  stopReason: AgentStopReason;
  outputTokens: number;
};

export type AnalyzeExecutor = (tool: AgentTool, input: Record<string, unknown>) => Promise<unknown>;

export type AgentLimits = {
  maxIterations?: number;
  maxTotalOutputTokens?: number;
  timeoutMs?: number;
};

export async function runAgentLoop(input: {
  provider: LlmProvider;
  system: string;
  goal: string;
  tools: AgentTool[];
  executeAnalyze: AnalyzeExecutor;
  maxIterations?: number;
  limits?: AgentLimits;
  now?: () => number; // инъекция времени для тестов (по умолчанию Date.now)
}): Promise<AgentLoopResult> {
  const maxIterations = input.limits?.maxIterations ?? input.maxIterations ?? 6;
  const maxTotalOutputTokens = input.limits?.maxTotalOutputTokens ?? Number.POSITIVE_INFINITY;
  const clock = input.now ?? (() => Date.now());
  const deadline = input.limits?.timeoutMs && input.limits.timeoutMs > 0 ? clock() + input.limits.timeoutMs : Number.POSITIVE_INFINITY;
  const toolByName = new Map(input.tools.map((tool) => [tool.name, tool]));
  const toolSchemas = input.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema }));

  const messages: LlmMessage[] = [{ role: "user", content: input.goal }];
  const proposedActions: ProposedAction[] = [];
  const analyzeResults: AnalyzeResult[] = [];
  const reasoningParts: string[] = [];

  let iterations = 0;
  let outputTokens = 0;
  let stopReason: AgentStopReason = "completed";
  while (true) {
    if (iterations >= maxIterations) { stopReason = "max_iterations"; break; }
    if (clock() >= deadline) { stopReason = "deadline"; break; }
    if (outputTokens >= maxTotalOutputTokens) { stopReason = "token_budget"; break; }
    iterations += 1;
    const response = await input.provider.createMessage({ system: input.system, messages, tools: toolSchemas });
    outputTokens += response.usage?.outputTokens ?? 0;
    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim().length > 0) reasoningParts.push(block.text.trim());
    }

    const toolUses = response.content.filter((block): block is Extract<LlmContentBlock, { type: "tool_use" }> => block.type === "tool_use");
    if (response.stopReason !== "tool_use" || toolUses.length === 0) { stopReason = "completed"; break; }
    // Превышен бюджет токенов на этом ответе — не запускаем ещё одну итерацию.
    if (outputTokens >= maxTotalOutputTokens) { stopReason = "token_budget"; break; }

    const toolResults: LlmToolResultBlock[] = [];
    for (const use of toolUses) {
      const tool = toolByName.get(use.name);
      if (!tool) {
        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify({ error: "unknown_or_forbidden_tool" }), is_error: true });
        continue;
      }
      if (tool.kind === "analyze") {
        try {
          const result = await input.executeAnalyze(tool, use.input);
          analyzeResults.push({ tool: tool.name, input: use.input, result });
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result).slice(0, 16_000) });
        } catch (error) {
          toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify({ error: error instanceof Error ? error.message : "analyze_failed" }), is_error: true });
        }
      } else {
        // mutation: записываем как предложение, НЕ исполняем.
        proposedActions.push({ tool: tool.name, title: tool.title, input: use.input });
        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify({ status: "proposed", note: "pending user confirmation" }) });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    reasoning: reasoningParts.join("\n\n"),
    proposedActions,
    analyzeResults,
    iterations,
    model: input.provider.model,
    stopReason,
    outputTokens
  };
}
