import { describe, expect, it } from "vitest";

import { parseReasoningEffort, resolveGenerationBudget } from "./generationBudget";

// ── Ревью F4: ручка reasoning не должна быть no-op ──
// Пол max_tokens под reasoning жил только внутри OpenRouter-провайдера, а reasoningEffort
// вообще не передавался в createAnthropicLlmProvider (в его сигнатуре не было такого поля,
// поэтому TypeScript и не ругался). Оператор с ANTHROPIC_API_KEY получал тишину вместо
// рассуждения и обрезанные ответы на дефолтных 1024 токенах.
describe("resolveGenerationBudget: единый бюджет генерации", () => {
  it("без reasoning — дефолт 1024 и никакого бюджета размышления", () => {
    expect(resolveGenerationBudget({})).toEqual({ maxTokens: 1024 });
    expect(resolveGenerationBudget({ maxTokens: 2048 })).toEqual({ maxTokens: 2048 });
  });

  it("с reasoning — бюджет размышления задан, а max_tokens поднят выше него", () => {
    for (const effort of ["low", "medium", "high"] as const) {
      const budget = resolveGenerationBudget({ reasoningEffort: effort });

      expect(budget.thinkingBudgetTokens).toBeGreaterThan(0);
      // Anthropic требует max_tokens СТРОГО больше бюджета размышления, иначе на вывод
      // не остаётся места и живой запрос падает.
      expect(budget.maxTokens).toBeGreaterThan(budget.thinkingBudgetTokens!);
      expect(budget.maxTokens).toBeGreaterThanOrEqual(8192);
    }
  });

  it("больший явный max_tokens побеждает пол, меньший — подтягивается до пола", () => {
    expect(resolveGenerationBudget({ maxTokens: 32_000, reasoningEffort: "high" }).maxTokens).toBe(32_000);
    // Прежний дефолт 1024 при включённом reasoning ломал каждый живой запрос.
    expect(resolveGenerationBudget({ maxTokens: 1024, reasoningEffort: "high" }).maxTokens).toBeGreaterThanOrEqual(8192);
  });

  it("более высокое усилие не даёт меньший бюджет размышления", () => {
    const low = resolveGenerationBudget({ reasoningEffort: "low" }).thinkingBudgetTokens!;
    const medium = resolveGenerationBudget({ reasoningEffort: "medium" }).thinkingBudgetTokens!;
    const high = resolveGenerationBudget({ reasoningEffort: "high" }).thinkingBudgetTokens!;

    expect(medium).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(medium);
  });
});

describe("parseReasoningEffort: ручка либо работает, либо падает громко", () => {
  it("пусто/не задано — reasoning выключен", () => {
    expect(parseReasoningEffort(undefined)).toBeUndefined();
    expect(parseReasoningEffort("")).toBeUndefined();
    expect(parseReasoningEffort("   ")).toBeUndefined();
  });

  it("низкий/средний/высокий разбираются, регистр и пробелы не важны", () => {
    expect(parseReasoningEffort("low")).toBe("low");
    expect(parseReasoningEffort(" HIGH ")).toBe("high");
  });

  it("опечатка — громкая ошибка, а не молчаливый дефолт", () => {
    // Молчаливый фолбэк выглядел бы как «reasoning включён», хотя он выключен —
    // ровно тот исход, которого требование F4 запрещает.
    expect(() => parseReasoningEffort("ultra")).toThrow(/KISS_PM_AGENT_REASONING_EFFORT/);
    expect(() => parseReasoningEffort("true")).toThrow(/low \| medium \| high/);
  });
});
