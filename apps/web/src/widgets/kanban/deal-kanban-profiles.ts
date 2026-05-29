import type { KanbanComparators } from "@/widgets/kanban/kanban-column-sort";
import type {
  KanbanCardViewProfile,
  KanbanCardViewState,
  KanbanSortOption
} from "@/widgets/kanban/types";
import type { DealKanbanItem } from "@/widgets/kanban/deal-kanban-card";

export const DEAL_KANBAN_FIELD = {
  id: "id",
  client: "client",
  contact: "contact",
  amount: "amount",
  probability: "probability",
  plannedFinish: "plannedFinish",
  plannedHours: "plannedHours",
  feasibility: "feasibility",
  projectType: "projectType",
  stage: "stage",
  owner: "owner"
} as const;

export type DealKanbanFieldId = (typeof DEAL_KANBAN_FIELD)[keyof typeof DEAL_KANBAN_FIELD];

export const DEAL_KANBAN_VIEW_PROFILE: KanbanCardViewProfile = {
  id: "deal",
  label: "Сделки",
  fields: [
    { id: DEAL_KANBAN_FIELD.id, label: "ID", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.client, label: "Клиент", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.contact, label: "Контакт", defaultOn: false },
    { id: DEAL_KANBAN_FIELD.amount, label: "Сумма", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.probability, label: "Вероятность", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.plannedFinish, label: "План-финиш", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.plannedHours, label: "План-часы", defaultOn: false },
    { id: DEAL_KANBAN_FIELD.feasibility, label: "Оценка осуществимости", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.projectType, label: "Тип проекта", defaultOn: false },
    { id: DEAL_KANBAN_FIELD.stage, label: "Стадия", defaultOn: true },
    { id: DEAL_KANBAN_FIELD.owner, label: "Ответственный", defaultOn: true }
  ]
};

export const DEAL_KANBAN_SORT_OPTIONS: KanbanSortOption[] = [
  { key: "manual", label: "Ручной порядок" },
  { key: "amount-desc", label: "По сумме (больше)" },
  { key: "amount-asc", label: "По сумме (меньше)" },
  { key: "probability-desc", label: "По вероятности" },
  { key: "finish-asc", label: "По план-финишу" },
  { key: "title-asc", label: "По названию" },
  { key: "client-asc", label: "По клиенту" }
];

const RUB_AMOUNT_RE = /[\d\s\u00a0]+/g;

/**
 * Парсит сумму вида `"890 000 ₽"`. Для нечисловых значений возвращает 0.
 */
export function parseDealAmount(amount: string): number {
  const matches = amount.match(RUB_AMOUNT_RE);
  if (!matches) return 0;
  const digits = matches.join("").replace(/[\s\u00a0]/g, "");
  return digits ? Number(digits) : 0;
}

export function buildDealKanbanComparators<
  T extends DealKanbanItem<C>,
  C extends string
>(): KanbanComparators<T> {
  return {
    "amount-desc": (a, b) => parseDealAmount(b.amount) - parseDealAmount(a.amount),
    "amount-asc": (a, b) => parseDealAmount(a.amount) - parseDealAmount(b.amount),
    "probability-desc": (a, b) => (b.probability ?? 0) - (a.probability ?? 0),
    "finish-asc": (a, b) =>
      Date.parse(a.plannedFinish ?? "") - Date.parse(b.plannedFinish ?? ""),
    "title-asc": (a, b) => a.title.localeCompare(b.title, "ru"),
    "client-asc": (a, b) => a.client.localeCompare(b.client, "ru")
  };
}

export function defaultDealKanbanViewState(): KanbanCardViewState {
  const state: KanbanCardViewState = {};
  for (const f of DEAL_KANBAN_VIEW_PROFILE.fields) state[f.id] = f.defaultOn;
  return state;
}
