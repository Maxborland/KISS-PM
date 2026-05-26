"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties, KeyboardEvent } from "react";

import { MoneyValue } from "@/components/domain/money-value";
import { ParticipantList } from "@/components/domain/participant-list";
import { Chip } from "@/components/ui/chip";
import { ProbabilityRing } from "@/components/ui/probability-ring";
import { TrendArrow } from "@/components/ui/trend-arrow";
import { cn } from "@/lib/cn";
import { parseDealAmount } from "@/widgets/kanban/deal-kanban-profiles";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";

export type DealCardProps = {
  deal: FunnelDeal;
  stage: FunnelStage;
  draggable?: boolean;
  onOpen?: (id: string) => void;
};

/**
 * Standalone-карточка сделки (экран 06). Использует тот же BEM `.kanban-card`,
 * что и `DealKanbanCard` в generic Kanban.
 */
export function DealCard({ deal, stage, draggable = false, onOpen }: DealCardProps) {
  const drag = useDraggable({ id: deal.id, disabled: !draggable });
  const isInteractive = Boolean(onOpen);
  const trend = deal.probabilityTrend ?? "flat";

  const style: CSSProperties | undefined =
    draggable && drag.transform
      ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
      : undefined;

  const handleClick = onOpen ? () => onOpen(deal.id) : undefined;
  const handleKey = onOpen
    ? (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(deal.id);
        }
      }
    : undefined;

  return (
    <article
      ref={draggable ? drag.setNodeRef : undefined}
      className={cn(
        "kanban-card",
        draggable && "kanban-card--draggable",
        isInteractive && !draggable && "kanban-card--interactive"
      )}
      style={style}
      data-deal-id={deal.id}
      data-card-id={deal.id}
      data-dnd-active={draggable ? "true" : undefined}
      data-dragging={drag.isDragging ? "true" : undefined}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={isInteractive ? `Открыть сделку ${deal.id}: ${deal.title}` : undefined}
    >
      <div className="kanban-card__head">
        <span className="kanban-card__id mono">{deal.id}</span>
        <Chip variant={stage.id === "won" ? "success" : "info"}>{stage.title}</Chip>
      </div>
      <div className="kanban-card__title">{deal.title}</div>
      <p className="kanban-card__meta">
        <span>{deal.client}</span>
        <span>·</span>
        <span>{deal.contactName ?? "Контакт не указан"}</span>
      </p>
      <div className="kanban-card__foot">
        <ParticipantList
          participants={[{ id: deal.id, name: deal.owner.initials, initials: deal.owner.initials }]}
          maxAvatars={1}
          layout="compact"
        />
        <div className="kanban-card__foot-meta kanban-card__foot-meta--deal">
          <MoneyValue amount={parseDealAmount(deal.amount)} />
          <ProbabilityRing value={deal.probability ?? 0} />
          <TrendArrow
            direction={trend}
            label={trend === "up" ? "рост" : trend === "down" ? "спад" : "без изм."}
          />
        </div>
      </div>
    </article>
  );
}
