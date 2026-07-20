import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentLlmProviderFromEnv, createAnthropicLlmProvider } from "./llmProvider";

// Перехватываем SDK: провайдер грузит его лениво (`await import`), поэтому мок ловит вызов.
const createMessage = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMessage };
  }
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function stubAnthropicResponse(content: unknown[]): void {
  createMessage.mockResolvedValue({ content, stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 20 } });
}

const CALL = { system: "s", messages: [{ role: "user" as const, content: "цель" }], tools: [] };

// ── Ревью F4: reasoning на Anthropic-пути был no-op ──
// reasoningOpt подмешивался только в createOpenRouterLlmProvider; в сигнатуре Anthropic-провайдера
// поля reasoning вовсе не было, поэтому типы молчали, а оператор с ANTHROPIC_API_KEY получал
// тишину вместо рассуждения и ответы, обрезанные дефолтом max_tokens=1024.
describe("Anthropic-провайдер: reasoning-effort реально применяется", () => {
  it("без reasoning — thinking не отправляется, max_tokens дефолтный", async () => {
    stubAnthropicResponse([{ type: "text", text: "ответ" }]);
    const provider = createAnthropicLlmProvider({ apiKey: "k" });

    await provider.createMessage(CALL);

    const payload = createMessage.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.thinking).toBeUndefined();
    expect(payload.max_tokens).toBe(1024);
  });

  it("с reasoning — включён extended thinking и поднят max_tokens", async () => {
    stubAnthropicResponse([{ type: "text", text: "ответ" }]);
    const provider = createAnthropicLlmProvider({ apiKey: "k", reasoningEffort: "high" });

    await provider.createMessage(CALL);

    const payload = createMessage.mock.calls[0]![0] as { thinking?: { type: string; budget_tokens: number }; max_tokens: number };
    expect(payload.thinking?.type).toBe("enabled");
    expect(payload.thinking?.budget_tokens).toBeGreaterThan(0);
    // Пол max_tokens больше не живёт только в OpenRouter-провайдере.
    expect(payload.max_tokens).toBeGreaterThan(payload.thinking!.budget_tokens);
    expect(payload.max_tokens).toBeGreaterThanOrEqual(8192);
  });

  it("блоки размышления сохраняются дословно — их обязан вернуть следующий ход с tool_result", async () => {
    stubAnthropicResponse([
      { type: "thinking", thinking: "рассуждение", signature: "sig-1" },
      { type: "redacted_thinking", data: "opaque" },
      { type: "text", text: "ответ" }
    ]);
    const provider = createAnthropicLlmProvider({ apiKey: "k", reasoningEffort: "medium" });

    const response = await provider.createMessage(CALL);

    // Anthropic отвергает следующий запрос, если блок размышления не вернуть с его signature.
    expect(response.content).toEqual([
      { type: "thinking", thinking: "рассуждение", signature: "sig-1" },
      { type: "redacted_thinking", data: "opaque" },
      { type: "text", text: "ответ" }
    ]);
  });
});

describe("createAgentLlmProviderFromEnv: ручка reasoning доезжает до Anthropic", () => {
  function stubAnthropicOnlyEnv(effort: string): void {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("KISS_PM_AGENT_PROVIDER", "anthropic");
    vi.stubEnv("KISS_PM_AGENT_MAX_TOKENS", "");
    vi.stubEnv("KISS_PM_AGENT_REASONING_EFFORT", effort);
  }

  it("KISS_PM_AGENT_REASONING_EFFORT включает thinking на Anthropic-провайдере", async () => {
    stubAnthropicOnlyEnv("medium");
    stubAnthropicResponse([{ type: "text", text: "ответ" }]);

    await createAgentLlmProviderFromEnv().createMessage(CALL);

    const payload = createMessage.mock.calls[0]![0] as { thinking?: { budget_tokens: number }; max_tokens: number };
    expect(payload.thinking?.budget_tokens).toBeGreaterThan(0);
    expect(payload.max_tokens).toBeGreaterThanOrEqual(8192);
  });

  it("недопустимое значение ручки — громкая ошибка, а не тихо выключенный reasoning", () => {
    stubAnthropicOnlyEnv("maximum");

    expect(() => createAgentLlmProviderFromEnv()).toThrow(/KISS_PM_AGENT_REASONING_EFFORT/);
  });
});
