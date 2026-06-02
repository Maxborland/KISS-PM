"use client";

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { mockTaskProjectRef } from "@/views/catalog";

export type TaskDetailTask = {
  id: string;
  title: string;
  stage?: { label: string; tone?: "info" | "violet" | "success" | "warning" };
  project?: string | undefined;
};

export type TaskDetailDrawerProps = {
  task: TaskDetailTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Маршрут на полноценную страницу карточки задачи. В Storybook ведёт на
   * историю `screens-задачи--task-card`; в продукте подставляется реальный
   * URL задачи (например, `/tasks/MDS-39`).
   */
  taskHref?: string | null;
};

const DEFAULT_STORYBOOK_TASK_HREF =
  "?path=/story/screens-задачи--task-card&viewMode=story";

export function TaskDetailDrawer({
  task,
  open,
  onOpenChange,
  taskHref = DEFAULT_STORYBOOK_TASK_HREF
}: TaskDetailDrawerProps) {
  const subtitle = task ? (task.project ? `${task.id} · ${task.project}` : mockTaskProjectRef(task.id)) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="xl" className="task-drawer">
        {task ? (
          <>
            <SheetHeader className="task-drawer__head">
              <SheetTitle className="sr-only">{task.title}</SheetTitle>
              <SheetDescription className="sr-only">
                {subtitle
                  ? `Карточка задачи ${task.title}: ${subtitle}.`
                  : `Карточка задачи ${task.title}.`}
              </SheetDescription>
              {taskHref ? (
                <Button
                  asChild
                  variant="secondary"
                  size="icon"
                  className="task-drawer__open-full"
                >
                  <a
                    target="_top"
                    rel="noreferrer"
                    href={taskHref}
                    aria-label="Открыть карточку задачи как страницу"
                    title="Открыть как страницу"
                  >
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              ) : null}
            </SheetHeader>
            <SheetBody className="task-drawer__body">
              <EntityDetailBlock
                title={task.title}
                subtitle={subtitle}
                variant="task"
                {...(task.stage ? { stage: task.stage } : {})}
              />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
