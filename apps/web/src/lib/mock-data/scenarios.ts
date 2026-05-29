/**
 * Storybook / MSW сценарии визуальных состояний (Phase 3).
 * Состояние сериализуемо в JSON для globals и query-параметров.
 */

export const SCENARIO_NAMES = [
  "default",
  "empty",
  "loading",
  "error",
  "forbidden",
  "overload",
  "late"
] as const;

export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export type ScenarioFetchPhase = "idle" | "loading" | "success" | "error" | "forbidden";

export type ScenarioFlags = {
  /** Ресурсная матрица / capacity: перегруз по часам */
  overload?: boolean;
  /** Задачи и проекты с просроченными сроками */
  late?: boolean;
};

/** Сериализуемое состояние сценария для Storybook globals и MSW. */
export type ScenarioState = {
  name: ScenarioName;
  fetchPhase: ScenarioFetchPhase;
  delayMs?: number;
  errorMessage?: string;
  flags: ScenarioFlags;
};

export type ScenarioMeta = {
  labelRu: string;
  descriptionRu: string;
};

export const SCENARIO_META: Record<ScenarioName, ScenarioMeta> = {
  default: {
    labelRu: "По умолчанию",
    descriptionRu: "Типовые демо-данные для экранов и виджетов."
  },
  empty: {
    labelRu: "Пусто",
    descriptionRu: "Пустые списки и нулевые срезы для empty-state."
  },
  loading: {
    labelRu: "Загрузка",
    descriptionRu: "Долгий ответ API для skeleton / loading."
  },
  error: {
    labelRu: "Ошибка",
    descriptionRu: "Ответ API 500 для error-state."
  },
  forbidden: {
    labelRu: "Нет доступа",
    descriptionRu: "Ответ API 403 для forbidden-state."
  },
  overload: {
    labelRu: "Перегруз",
    descriptionRu: "Усиленные сигналы загрузки ресурсов и control."
  },
  late: {
    labelRu: "Просрочка",
    descriptionRu: "Просроченные задачи и сдвинутые дедлайны."
  }
};

const DEFAULT_ERROR_MESSAGE = "Не удалось загрузить данные. Повторите позже.";

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === "string" && (SCENARIO_NAMES as readonly string[]).includes(value);
}

export function createScenarioState(
  name: ScenarioName,
  overrides: Partial<Omit<ScenarioState, "name">> = {}
): ScenarioState {
  const baseFlags: ScenarioFlags = {
    overload: name === "overload",
    late: name === "late"
  };

  const fetchPhase: ScenarioFetchPhase =
    overrides.fetchPhase ??
    (name === "loading"
      ? "loading"
      : name === "error"
        ? "error"
        : name === "forbidden"
          ? "forbidden"
          : "success");

  const state: ScenarioState = {
    name,
    fetchPhase,
    flags: { ...baseFlags, ...overrides.flags }
  };

  const delayMs = overrides.delayMs ?? (name === "loading" ? 120_000 : undefined);
  if (delayMs !== undefined) state.delayMs = delayMs;

  const errorMessage =
    overrides.errorMessage ?? (name === "error" ? DEFAULT_ERROR_MESSAGE : undefined);
  if (errorMessage !== undefined) state.errorMessage = errorMessage;

  return state;
}

export function serializeScenarioState(state: ScenarioState): string {
  return JSON.stringify(state);
}

export function parseScenarioState(serialized: string): ScenarioState | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<ScenarioState>;
    if (!parsed || !isScenarioName(parsed.name)) return null;
    const partial: Partial<Omit<ScenarioState, "name">> = {};
    if (parsed.fetchPhase !== undefined) partial.fetchPhase = parsed.fetchPhase;
    if (parsed.delayMs !== undefined) partial.delayMs = parsed.delayMs;
    if (parsed.errorMessage !== undefined) partial.errorMessage = parsed.errorMessage;
    if (parsed.flags !== undefined) partial.flags = parsed.flags;
    return createScenarioState(parsed.name, partial);
  } catch {
    return null;
  }
}

export type ScenarioHttpBehavior =
  | { kind: "success" }
  | { kind: "loading"; delayMs: number }
  | { kind: "error"; message: string }
  | { kind: "forbidden"; reason: string };

export function scenarioHttpBehavior(name: ScenarioName): ScenarioHttpBehavior {
  switch (name) {
    case "loading":
      return { kind: "loading", delayMs: 120_000 };
    case "error":
      return { kind: "error", message: DEFAULT_ERROR_MESSAGE };
    case "forbidden":
      return { kind: "forbidden", reason: "forbidden" };
    default:
      return { kind: "success" };
  }
}
