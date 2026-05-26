import { DEAL_KANBAN_FIELD } from "@/widgets/kanban/deal-kanban-profiles";
import type { DealKanbanItem } from "@/widgets/kanban/deal-kanban-card";
import type { FunnelDeal } from "@/widgets/funnel/types";

/** Все поля профиля сделки — для standalone-карточек и демо. */
export const ALL_DEAL_KANBAN_FIELDS = new Set<string>(Object.values(DEAL_KANBAN_FIELD));

export function dealToKanbanItem(
  deal: FunnelDeal,
  stage: { id: string; title: string }
): DealKanbanItem<string> {
  const item: DealKanbanItem<string> = {
    id: deal.id,
    columnId: deal.stage,
    title: deal.title,
    client: deal.client,
    contactName: deal.contactName ?? "Контакт не указан",
    amount: deal.amount,
    probability: typeof deal.probability === "number" ? deal.probability : 0,
    plannedFinish: deal.plannedFinish ?? new Date().toISOString(),
    plannedHours: deal.plannedHours ?? 0,
    feasibilityStatus: deal.feasibilityStatus ?? null,
    projectType: deal.projectType ?? "Тип не указан",
    owner: deal.owner,
    stageLabel: stage.title,
    stageTone: stage.id === "won" ? "success" : "info"
  };
  if (deal.probabilityTrend) item.probabilityTrend = deal.probabilityTrend;
  return item;
}
