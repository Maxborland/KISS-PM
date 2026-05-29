"use client";

import { useDraggable } from "@dnd-kit/core";
import { useMemo, type CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { ALL_DEAL_KANBAN_FIELDS, dealToKanbanItem } from "@/widgets/kanban/deal-kanban-map";
import { DealKanbanCard } from "@/widgets/kanban/deal-kanban-card";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";

export type DealCardProps = {
  deal: FunnelDeal;
  stage: FunnelStage;
  draggable?: boolean;
  onOpen?: (id: string) => void;
};

/**
 * Standalone-карточка сделки (виджет/демо). Рендер через `DealKanbanCard` —
 * единая разметка с CRM-канбаном.
 */
export function DealCard({ deal, stage, draggable = false, onOpen }: DealCardProps) {
  const drag = useDraggable({ id: deal.id, disabled: !draggable });
  const item = useMemo(() => dealToKanbanItem(deal, stage), [deal, stage]);

  const style: CSSProperties | undefined =
    draggable && drag.transform
      ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
      : undefined;

  const card = (
    <DealKanbanCard
      item={item}
      draggable={false}
      isDragging={drag.isDragging}
      {...(onOpen ? { onOpen } : {})}
      visibleFields={ALL_DEAL_KANBAN_FIELDS}
    />
  );

  if (!draggable) {
    return card;
  }

  return (
    <div
      ref={drag.setNodeRef}
      className={cn("kanban-item-slot", drag.isDragging && "kanban-item-slot--dragging")}
      style={style}
      data-card-id={deal.id}
      data-dnd-active="true"
      {...drag.attributes}
      {...drag.listeners}
    >
      {card}
    </div>
  );
}
