"use client";

import { useMemo } from "react";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";
import {
  DealKanbanCard,
  Kanban,
  dealToKanbanItem,
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
      deals.map((d) =>
        dealToKanbanItem(d, { id: d.stage, title: stageLabel[d.stage] ?? d.stage })
      ),
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
