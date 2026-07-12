// Доменная модель прод-поверхности агента. Полностью отвязана от
// widgets/landing-agent-demo (маркетинговая витрина живёт отдельно).

/** RU-статусы — контракт PR4 (unit + e2e agent-partial-apply прибиты к этим строкам). */
export type AgentChangeStatus =
  | "выбрано"
  | "изменено"
  | "отклонено"
  | "требует прав"
  | "применено"
  | "пропущено"
  | "отказано"
  | "конфликт"
  | "ошибка"
  | "неизвестно";

export type AgentChange = {
  id: string;
  number: number;
  title: string;
  before: string;
  after: string;
  status: AgentChangeStatus;
  selected: boolean;
  /** Ручная правка разрешена только действиям с явным текстовым полем (EDITABLE_FIELD). */
  editable: boolean;
};

/** Статусы, после которых карточка терминальна (никаких select/edit/reject). */
export const TERMINAL_STATUSES: readonly AgentChangeStatus[] = [
  "требует прав",
  "применено",
  "пропущено",
  "отказано",
  "конфликт",
  "неизвестно"
];

/** Статусы, требующие внимания пользователя после применения. */
export const UNRESOLVED_STATUSES: readonly AgentChangeStatus[] = [
  "требует прав",
  "ошибка",
  "конфликт",
  "отказано",
  "неизвестно"
];

export type AgentMessage =
  | { id: string; role: "user"; time: string; text: string }
  | { id: string; role: "agent"; time: string; text: string; kind?: "error" | "result" }
  /** Завершённый CoT-трейс хода агента — остаётся в треде после ответа. */
  | { id: string; role: "trace"; time: string; steps: string[] };

export type AgentPhase = "draft" | "thinking" | "review-open" | "applied";
