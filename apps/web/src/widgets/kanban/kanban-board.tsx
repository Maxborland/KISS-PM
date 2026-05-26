import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type KanbanColumnProps = {
  title: ReactNode;
  count?: number;
  children: ReactNode;
};

export function KanbanColumn({ title, count, children }: KanbanColumnProps) {
  return (
    <div className="kanban-col">
      <div className="kanban-col__head">
        <span className="kanban-col__title">
          {title}
          {count != null ? <Badge variant="secondary">{count}</Badge> : null}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Действия колонки">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

export function KanbanBoard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("kanban", className)}>{children}</div>;
}
