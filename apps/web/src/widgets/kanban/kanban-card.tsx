import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { PriorityFlag, type PriorityLevel } from "@/components/domain/priority-flag";
import { cn } from "@/lib/cn";

export type KanbanCardProps = {
  id: string;
  title: string;
  priority: PriorityLevel;
  priorityLabel: string;
  meta?: { label: string }[];
  assignees?: { initials: string; color?: "c1" | "c2" | "c3" | "c4" | "c5" }[];
  comments?: number;
  date?: string;
  highlight?: boolean;
  foot?: ReactNode;
};

export function KanbanCard({
  id,
  title,
  priority,
  priorityLabel,
  meta = [],
  assignees = [],
  comments,
  date,
  highlight,
  foot
}: KanbanCardProps) {
  return (
    <article className={cn("kanban-card", highlight && "kanban-card--highlight")}>
      <div className="kanban-card__head">
        <span className="kanban-card__id">{id}</span>
        <PriorityFlag level={priority} label={priorityLabel} />
      </div>
      <div className="kanban-card__title">{title}</div>
      {meta.map((m) => (
        <div key={m.label} className="kanban-card__meta">
          <span>{m.label}</span>
        </div>
      ))}
      <div className="kanban-card__foot">
        {assignees.length > 0 ? (
          <BemAvatarStack>
            {assignees.map((a) => (
              <BemAvatar
                key={a.initials}
                initials={a.initials}
                {...(a.color ? { color: a.color } : {})}
              />
            ))}
          </BemAvatarStack>
        ) : null}
        <div className="kanban-card__foot-meta">
          {comments != null ? (
            <span>
              <MessageSquare className="size-3.5" aria-hidden />
              {comments}
            </span>
          ) : null}
          {date ? <span className="mono">{date}</span> : null}
        </div>
      </div>
      {foot}
    </article>
  );
}
