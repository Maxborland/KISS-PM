"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties, KeyboardEvent } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";

export type DealCardProps = {
  deal: FunnelDeal;
  stage: FunnelStage;
  draggable?: boolean;
  onOpen?: (id: string) => void;
};

export function DealCard({ deal, stage, draggable = false, onOpen }: DealCardProps) {
  const drag = useDraggable({ id: deal.id, disabled: !draggable });
  const isInteractive = Boolean(onOpen);

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
        "deal-card",
        draggable && "deal-card--draggable",
        isInteractive && !draggable && "deal-card--interactive"
      )}
      style={style}
      data-deal-id={deal.id}
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
      <div className="deal-card__head">
        <span className="deal-card__id mono">{deal.id}</span>
        <BemAvatar {...deal.owner} size="sm" />
      </div>
      <h3 className="deal-card__title">{deal.title}</h3>
      <p className="deal-card__client">{deal.client} · {deal.contactName ?? "контакт не указан"}</p>
      <div className="deal-card__foot">
        <Chip variant={stage.id === "won" ? "success" : "info"}>{stage.title}</Chip>
        <span className="mono u-text-xs u-text-strong">{deal.amount}</span>
        <span className="mono u-text-xs">{deal.probability ?? 0}%</span>
      </div>
    </article>
  );
}
