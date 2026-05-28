"use client";

import type { KeyboardEvent, ReactNode } from "react";

import { MoneyValue } from "@/components/domain/money-value";
import { ParticipantList } from "@/components/domain/participant-list";
import { Chip } from "@/components/ui/chip";
import { ProbabilityRing } from "@/components/ui/probability-ring";
import { TrendArrow, type TrendDirection } from "@/components/ui/trend-arrow";
import { cn } from "@/lib/cn";

import { DEAL_KANBAN_FIELD, parseDealAmount } from "@/widgets/kanban/deal-kanban-profiles";
import type { KanbanItem } from "@/widgets/kanban/types";

export type DealKanbanOwner = {
  initials: string;
  color?: "c1" | "c2" | "c3" | "c4" | "c5";
};

export type DealKanbanItem<C extends string = string> = KanbanItem<C> & {
  title: string;
  client: string;
  contactName?: string;
  amount: string;
  probability?: number;
  probabilityTrend?: TrendDirection;
  plannedFinish?: string;
  plannedHours?: number;
  feasibilityStatus?: string | null;
  projectType?: string;
  owner: DealKanbanOwner;
  stageLabel: string;
  stageTone?: "info" | "success" | "warning" | "danger" | "violet";
  highlight?: boolean;
};

export type DealKanbanCardProps<C extends string = string> = {
  item: DealKanbanItem<C>;
  draggable: boolean;
  isDragging: boolean;
  onOpen?: (id: string) => void;
  visibleFields?: ReadonlySet<string>;
  foot?: ReactNode;
};

function feasibilityLabel(value: string): string {
  if (value === "feasible") return "Реализуемо";
  if (value === "risk") return "Риск";
  if (value === "blocked") return "Блокер";
  if (value === "not_checked") return "Не проверено";
  return value;
}

export function DealKanbanCard<C extends string = string>({
  item,
  draggable,
  isDragging,
  onOpen,
  visibleFields,
  foot
}: DealKanbanCardProps<C>) {
  const isInteractive = Boolean(onOpen);
  const useButtonSemantics = isInteractive && !draggable;

  const handleClick = onOpen ? () => onOpen(item.id) : undefined;
  const handleKey = onOpen
    ? (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item.id);
        }
      }
    : undefined;

  const show = (field: string) => (visibleFields ? visibleFields.has(field) : true);
  const showId = show(DEAL_KANBAN_FIELD.id);
  const showOwner = show(DEAL_KANBAN_FIELD.owner);
  const showClient = show(DEAL_KANBAN_FIELD.client);
  const showContact = show(DEAL_KANBAN_FIELD.contact);
  const showAmount = show(DEAL_KANBAN_FIELD.amount);
  const showProbability = show(DEAL_KANBAN_FIELD.probability);
  const showFinish = show(DEAL_KANBAN_FIELD.plannedFinish);
  const showHours = show(DEAL_KANBAN_FIELD.plannedHours);
  const showFeasibility = show(DEAL_KANBAN_FIELD.feasibility);
  const showProjectType = show(DEAL_KANBAN_FIELD.projectType);
  const showStage = show(DEAL_KANBAN_FIELD.stage);
  const stageChipTone = item.stageTone ?? (item.columnId === "won" ? "success" : "info");
  const showFoot = showStage || showAmount || showProbability || showFinish || showHours || showFeasibility;

  return (
    <article
      className={cn(
        "kanban-card",
        item.highlight && "kanban-card--highlight",
        draggable && "kanban-card--draggable",
        isInteractive && !draggable && "kanban-card--interactive"
      )}
      data-card-id={item.id}
      data-deal-id={item.id}
      data-dnd-active={draggable ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      role={useButtonSemantics ? "button" : undefined}
      tabIndex={useButtonSemantics ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={isInteractive ? `Открыть сделку ${item.id}: ${item.title}` : undefined}
    >
      <div className="kanban-card__head">
        {showId ? <span className="kanban-card__id mono">{item.id}</span> : <span />}
        {showStage ? <Chip variant={stageChipTone}>{item.stageLabel}</Chip> : null}
      </div>
      <div className="kanban-card__title">{item.title}</div>
      {showClient ? (
        <div className="kanban-card__meta">
          <span>{item.client}</span>
        </div>
      ) : null}
      {showContact || showProjectType ? (
        <div className="kanban-card__meta">
          {showContact ? <span>{item.contactName ?? "Контакт не указан"}</span> : null}
          {showProjectType ? <span>{item.projectType ?? "Тип не указан"}</span> : null}
        </div>
      ) : null}
      {showFoot || showOwner ? (
        <div className="kanban-card__foot">
          {showOwner ? (
            <ParticipantList
              participants={[{ id: item.id, name: item.owner.initials, initials: item.owner.initials }]}
              maxAvatars={1}
              layout="compact"
            />
          ) : (
            <span />
          )}
          <div className="kanban-card__foot-meta kanban-card__foot-meta--deal">
            {showAmount ? (
              <MoneyValue amount={parseDealAmount(item.amount)} className="kanban-card__deal-amount" />
            ) : null}
            {showProbability ? (
              <ProbabilityRing value={item.probability ?? 0} className="kanban-card__deal-probability" />
            ) : null}
            {showProbability && item.probabilityTrend ? (
              <TrendArrow
                className="kanban-card__deal-trend"
                direction={item.probabilityTrend}
                label={
                  item.probabilityTrend === "up"
                    ? "рост"
                    : item.probabilityTrend === "down"
                      ? "спад"
                      : "без изм."
                }
              />
            ) : null}
            {showFinish && item.plannedFinish ? (
              <span className="kanban-card__deal-date mono">
                {new Intl.DateTimeFormat("ru-RU").format(new Date(item.plannedFinish))}
              </span>
            ) : null}
            {showHours ? <span>{item.plannedHours ?? 0} ч</span> : null}
            {showFeasibility && item.feasibilityStatus ? <span>{feasibilityLabel(item.feasibilityStatus)}</span> : null}
          </div>
        </div>
      ) : null}
      {foot}
    </article>
  );
}
