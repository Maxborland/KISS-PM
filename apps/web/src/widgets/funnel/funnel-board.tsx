"use client";

import { useMemo } from "react";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";
import {
  DealKanbanCard,
  Kanban,
  type DealKanbanItem,
  type KanbanColumnDef
} from "@/widgets/kanban";

export type FunnelBoardProps = {
  stages: FunnelStage[];
  deals: FunnelDeal[];
  onMoveDeal?: (dealId: string, toStageId: string) => void;
  onOpenDeal?: (id: string) => void;
};

/**
 * @deprecated Используйте `<Kanban boardVariant="funnel">` с `DealKanbanCard`
 *   и `useFunnelState.reorderDeal`. Этот компонент — тонкая обёртка, оставлена
 *   для обратной совместимости и упрощённого DnD без reorder внутри стадии.
 */
export function FunnelBoard({ stages, deals, onMoveDeal, onOpenDeal }: FunnelBoardProps) {
  const columns = useMemo<KanbanColumnDef<string>[]>(
    () => stages.map((s) => ({ id: s.id, title: s.title, emptyLabel: "Нет сделок" })),
    [stages]
  );

  const stageLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of stages) map[s.id] = s.title;
    return map;
  }, [stages]);

  const items = useMemo<DealKanbanItem<string>[]>(
    () =>
      deals.map((d) => ({
        id: d.id,
        columnId: d.stage,
        title: d.title,
        client: d.client,
        contactName: d.contactName ?? "Контакт не указан",
        amount: d.amount,
        probability: d.probability ?? 0,
        plannedFinish: d.plannedFinish ?? new Date().toISOString(),
        plannedHours: d.plannedHours ?? 0,
        feasibilityStatus: d.feasibilityStatus ?? null,
        projectType: d.projectType ?? "Тип не указан",
        owner: d.owner,
        stageLabel: stageLabel[d.stage] ?? d.stage,
        stageTone: d.stage === "won" ? "success" : "info"
      })),
    [deals, stageLabel]
  );

  return (
    <Kanban<DealKanbanItem<string>, string>
      boardVariant="funnel"
      columns={columns}
      items={items}
      renderCard={(item, ctx) => (
        <DealKanbanCard
          item={item}
          draggable={ctx.draggable}
          isDragging={ctx.isDragging}
          {...(onOpenDeal ? { onOpen: onOpenDeal } : {})}
        />
      )}
      {...(onMoveDeal ? { onItemMove: (id, toColumnId) => onMoveDeal(id, toColumnId) } : {})}
    />
  );
}
