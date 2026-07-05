import { describe, expect, it, vi } from "vitest";

import type { LlmMessage } from "./llmProvider";
import { createOpenRouterLlmProvider, fromOpenAiResponse, toOpenAiMessages } from "./openRouterProvider";

describe("openRouterProvider translation", () => {
  it("toOpenAiMessages: goal/assistant tool_use/user tool_result → OpenAI roles", () => {
    const messages: LlmMessage[] = [
      { role: "user", content: "Продвинь задачи" },
      { role: "assistant", content: [
        { type: "text", text: "Смотрю задачи." },
        { type: "tool_use", id: "call-1", name: "list_my_tasks", input: {} }
      ] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "call-1", content: '{"tasks":[]}' }] }
    ];
    const out = toOpenAiMessages("СИСТЕМА", messages);
    expect(out[0]).toEqual({ role: "system", content: "СИСТЕМА" });
    expect(out[1]).toEqual({ role: "user", content: "Продвинь задачи" });
    expect(out[2]).toEqual({
      role: "assistant",
      content: "Смотрю задачи.",
      tool_calls: [{ id: "call-1", type: "function", function: { name: "list_my_tasks", arguments: "{}" } }]
    });
    expect(out[3]).toEqual({ role: "tool", tool_call_id: "call-1", content: '{"tasks":[]}' });
  });

  it("fromOpenAiResponse: tool_calls → tool_use, finish_reason → stopReason, usage", () => {
    const data = {
      choices: [{
        finish_reason: "tool_calls",
        message: { content: "Предлагаю.", tool_calls: [{ id: "c1", type: "function", function: { name: "change_task_status", arguments: '{"taskId":"t1","statusId":"s"}' } }] }
      }],
      usage: { prompt_tokens: 100, completion_tokens: 20 }
    };
    const res = fromOpenAiResponse(data);
    expect(res.stopReason).toBe("tool_use");
    expect(res.content[0]).toEqual({ type: "text", text: "Предлагаю." });
    expect(res.content[1]).toEqual({ type: "tool_use", id: "c1", name: "change_task_status", input: { taskId: "t1", statusId: "s" } });
    expect(res.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
  });

  it("fromOpenAiResponse: чистый текст → stopReason end_turn", () => {
    const res = fromOpenAiResponse({ choices: [{ finish_reason: "stop", message: { content: "Готово." } }] });
    expect(res.stopReason).toBe("end_turn");
    expect(res.content).toEqual([{ type: "text", text: "Готово." }]);
  });

  it("createOpenRouterLlmProvider: шлёт OpenAI-запрос и парсит ответ", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "ок" } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }), { status: 200 })
    );
    const provider = createOpenRouterLlmProvider({ apiKey: "key", model: "anthropic/claude-3.7-sonnet", fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await provider.createMessage({ system: "s", messages: [{ role: "user", content: "hi" }], tools: [{ name: "t", description: "d", input_schema: { type: "object", properties: {} } }] });

    expect(res.content).toEqual([{ type: "text", text: "ок" }]);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("openrouter.ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("anthropic/claude-3.7-sonnet");
    expect(body.tools[0]).toEqual({ type: "function", function: { name: "t", description: "d", parameters: { type: "object", properties: {} } } });
    expect(body.tool_choice).toBe("auto");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer key" });
  });

  it("createOpenRouterLlmProvider: не-2xx → ошибка с кодом", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    const provider = createOpenRouterLlmProvider({ apiKey: "key", model: "m", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(provider.createMessage({ system: "s", messages: [], tools: [] })).rejects.toThrow(/openrouter_429/);
  });
});
