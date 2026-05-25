"use client";

import { MessageSquare } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { PriorityFlag, type PriorityLevel } from "@/components/domain/priority-flag";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

import { TASK_KANBAN_FIELD } from "@/widgets/kanban/task-kanban-profiles";
import type { KanbanItem } from "@/widgets/kanban/types";

export type TaskKanbanItem<C extends string = string> = KanbanItem<C> & {
  title: string;
  priority: PriorityLevel;
  priorityLabel: string;
  meta?: { label: string }[];
  assignees: { initials: string; color?: "c1" | "c2" | "c3" | "c4" | "c5" }[];
  comments?: number;
  date: string;
  progress?: number;
  plannedWork?: number;
  actualWork?: number;
  requiresAcceptance?: boolean;
  ownerName?: string;
  requesterName?: string;
  statusName?: string;
  highlight?: boolean;
  foot?: ReactNode;
};

export type TaskKanbanCardProps<C extends string = string> = {
  item: TaskKanbanItem<C>;
  draggable: boolean;
  isDragging: boolean;
  onOpen?: (id: string) => void;
  /** Если не задан — показываются все поля (обратная совместимость для demo). */
  visibleFields?: ReadonlySet<string>;
};

export function TaskKanbanCard<C extends string = string>({
  item,
  draggable,
  isDragging,
  onOpen,
  visibleFields
}: TaskKanbanCardProps<C>) {
  const isInteractive = Boolean(onOpen);

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
  const showPriority = show(TASK_KANBAN_FIELD.priority);
  const showMeta = show(TASK_KANBAN_FIELD.meta);
  const showAssignees = show(TASK_KANBAN_FIELD.assignees);
  const showComments = show(TASK_KANBAN_FIELD.comments);
  const showDate = show(TASK_KANBAN_FIELD.date);
  const showProgress = show(TASK_KANBAN_FIELD.progress);
  const showWork = show(TASK_KANBAN_FIELD.work);
  const showAcceptance = show(TASK_KANBAN_FIELD.acceptance);
  const showFoot = showAssignees || showComments || showDate || showWork || showAcceptance;

  return (
    <article
      className={cn(
        "kanban-card",
        item.highlight && "kanban-card--highlight",
        draggable && "kanban-card--draggable",
        isInteractive && !draggable && "kanban-card--interactive"
      )}
      data-dnd-active={draggable ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      data-card-id={item.id}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={isInteractive ? `Открыть карточку ${item.id}: ${item.title}` : undefined}
    >
      <div className="kanban-card__head">
        <span className="kanban-card__id">{item.id}</span>
        {showPriority ? <PriorityFlag level={item.priority} label={item.priorityLabel} /> : null}
      </div>
      <div className="kanban-card__title">{item.title}</div>
      {showMeta
        ? (item.meta ?? []).map((m) => (
            <div key={m.label} className="kanban-card__meta">
              <span>{m.label}</span>
            </div>
          ))
        : null}
      {showProgress && item.progress != null ? (
        <div className="kanban-card__meta">
          <span>Прогресс {item.progress}%</span>
          {item.statusName ? <span>{item.statusName}</span> : null}
        </div>
      ) : null}
      {showFoot ? (
        <div className="kanban-card__foot">
          {showAssignees && item.assignees.length > 0 ? (
            <BemAvatarStack>
              {item.assignees.map((a) => (
                <BemAvatar
                  key={a.initials}
                  initials={a.initials}
                  {...(a.color ? { color: a.color } : {})}
                />
              ))}
            </BemAvatarStack>
          ) : null}
          <div className="kanban-card__foot-meta">
            {showComments && item.comments != null ? (
              <span>
                <MessageSquare className="size-3.5" aria-hidden />
                {item.comments}
              </span>
            ) : null}
            {showDate && item.date ? <span className="mono">{item.date}</span> : null}
            {showWork && item.plannedWork != null ? (
              <span>{Math.round(item.actualWork ?? 0)}/{Math.round(item.plannedWork)} мин</span>
            ) : null}
            {showAcceptance && item.requiresAcceptance ? <Chip variant="warning">Приемка</Chip> : null}
          </div>
        </div>
      ) : null}
      {item.foot}
    </article>
  );
}
