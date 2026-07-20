/**
 * Единая точка разрешения бюджета генерации агента (ревью F4).
 *
 * До этого пол max_tokens под reasoning жил ТОЛЬКО внутри OpenRouter-провайдера, а
 * `reasoningEffort` вообще не доезжал до Anthropic-пути: сигнатура createAnthropicLlmProvider
 * не имела такого поля, поэтому TypeScript молчал, а оператор с ANTHROPIC_API_KEY получал
 * тишину вместо reasoning и обрезанные ответы на дефолтных 1024 токенах.
 *
 * Здесь бюджет считается один раз и одинаково для обоих провайдеров; провайдер лишь
 * переводит его в свой протокол (Anthropic — thinking.budget_tokens, OpenRouter —
 * reasoning.effort, бюджет выводит сам).
 */

/** Уровни усилия рассуждения — единственные допустимые значения KISS_PM_AGENT_REASONING_EFFORT. */
export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/** Бюджет extended thinking по уровню усилия (Anthropic требует его явно, в токенах). */
const THINKING_BUDGET_BY_EFFORT: Record<ReasoningEffort, number> = {
  low: 1024,
  medium: 4096,
  high: 8192
};

/**
 * Пол max_tokens при включённом reasoning. У Anthropic (и у OpenRouter поверх него)
 * max_tokens должен быть СТРОГО больше бюджета размышления, иначе на вывод не остаётся
 * места и живой запрос падает. Держим запас в HEADROOM токенов сверх бюджета.
 */
const REASONING_MAX_TOKENS_FLOOR = 8192;
const REASONING_OUTPUT_HEADROOM = 1024;
const DEFAULT_MAX_TOKENS = 1024;

export type GenerationBudget = {
  maxTokens: number;
  /** Задан ⇔ reasoning включён: столько токенов модель тратит на размышление. */
  thinkingBudgetTokens?: number;
};

export function resolveGenerationBudget(opts: {
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
}): GenerationBudget {
  if (!opts.reasoningEffort) {
    return { maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS };
  }
  const thinkingBudgetTokens = THINKING_BUDGET_BY_EFFORT[opts.reasoningEffort];
  return {
    thinkingBudgetTokens,
    maxTokens: Math.max(
      opts.maxTokens ?? 0,
      REASONING_MAX_TOKENS_FLOOR,
      thinkingBudgetTokens + REASONING_OUTPUT_HEADROOM
    )
  };
}

/**
 * Разбор KISS_PM_AGENT_REASONING_EFFORT. Пусто → reasoning выключен. Непонятное значение —
 * НЕ молчаливый дефолт: опечатка в env иначе выглядела бы как «reasoning включён», хотя он
 * выключен. Ручка либо работает, либо падает громко.
 */
export function parseReasoningEffort(raw: string | undefined): ReasoningEffort | undefined {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.length === 0) return undefined;
  if ((REASONING_EFFORTS as readonly string[]).includes(value)) return value as ReasoningEffort;
  throw new Error(
    `KISS_PM_AGENT_REASONING_EFFORT: недопустимое значение «${raw}» — допустимы ${REASONING_EFFORTS.join(" | ")}`
  );
}
