import type { KanbanItem } from "./types";

export type PriorityLevel = "urgent" | "critical" | "high" | "normal" | "med" | "low";

export type LandingTaskKanbanItem<C extends string = string> = KanbanItem<C> & {
  title: string;
  priority: PriorityLevel;
  priorityLabel: string;
  meta?: { label: string }[];
  assignees: { initials: string; color?: "c1" | "c2" | "c3" | "c4" | "c5" }[];
  comments?: number;
  date: string;
  highlight?: boolean;
};

export type LandingTaskKanbanCardProps<C extends string = string> = {
  item: LandingTaskKanbanItem<C>;
  draggable: boolean;
  isDragging: boolean;
};

export function LandingTaskKanbanCard<C extends string = string>({
  item,
  draggable,
  isDragging,
}: LandingTaskKanbanCardProps<C>) {
  return (
    <article
      className={[
        "kanban-card",
        item.highlight ? "kanban-card--highlight" : "",
        draggable ? "kanban-card--draggable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-dnd-active={draggable ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      data-card-id={item.id}
    >
      <div className="kanban-card__head">
        <span className="kanban-card__id">{item.id}</span>
        <span className={`priority-flag priority-flag--${item.priority}`}>{item.priorityLabel}</span>
      </div>
      <div className="kanban-card__title">{item.title}</div>
      {(item.meta ?? []).map((m) => (
        <div key={m.label} className="kanban-card__meta">
          <span>{m.label}</span>
        </div>
      ))}
      <div className="kanban-card__foot">
        <span className="avatar-group" role="group" aria-label="Исполнители">
          {item.assignees.slice(0, 3).map((a, index) => (
            <span
              key={`${item.id}-${index}`}
              className={`avatar avatar--sm avatar--${a.color ?? "c4"}`}
              title={a.initials}
            >
              {a.initials}
            </span>
          ))}
        </span>
        <div className="kanban-card__foot-meta">
          {item.comments != null ? (
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
              {item.comments}
            </span>
          ) : null}
          {item.date ? <span className="mono">{item.date}</span> : null}
        </div>
      </div>
    </article>
  );
}
