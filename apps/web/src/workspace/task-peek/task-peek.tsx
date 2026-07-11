"use client";

import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { TaskPriority, TaskRecord, TaskStatusCategory } from "@/workspace/lib/workspace-client";

export type TaskPeekFact = {
  label: string;
  value: string;
};

export type TaskPeekRecord = {
  id: string;
  title: string;
  status?: { label: string; category?: TaskStatusCategory };
  progress?: number;
  project?: { id: string; name?: string };
  plannedStart?: string;
  plannedFinish?: string;
  durationWorkingDays?: number;
  plannedWork?: number;
  actualWork?: number;
  description?: string;
  facts?: readonly TaskPeekFact[];
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  critical: "Критичный"
};

const TASK_DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC"
});

function formatTaskDate(value: string) {
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!datePart) return value;
  return TASK_DATE_FORMAT.format(
    new Date(Date.UTC(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3])))
  );
}

/** Converts the workspace wire record without filling in unavailable project or task data. */
export function taskPeekRecordFromWorkspace(task: TaskRecord): TaskPeekRecord {
  const facts: TaskPeekFact[] = [{ label: "Приоритет", value: PRIORITY_LABEL[task.priority] }];
  if (task.requiresAcceptance) facts.push({ label: "Приёмка", value: "Требуется" });

  return {
    id: task.id,
    title: task.title,
    status: { label: task.statusName, category: task.statusCategory },
    progress: task.progress,
    project: { id: task.projectId },
    plannedStart: task.plannedStart,
    plannedFinish: task.plannedFinish,
    durationWorkingDays: task.durationWorkingDays,
    plannedWork: task.plannedWork,
    actualWork: task.actualWork,
    ...(task.description?.trim() ? { description: task.description } : {}),
    ...(facts.length > 0 ? { facts } : {})
  };
}

type TaskPeekProps = {
  task: TaskPeekRecord;
  /** One focusable element rendered as Radix SheetTrigger via asChild. */
  children: ReactElement;
};

type BrowserLocation = {
  pathname: string;
  search: string;
  hash: string;
};

const SERVER_LOCATION: BrowserLocation = { pathname: "", search: "", hash: "" };

function browserLocation(): BrowserLocation {
  if (typeof window === "undefined") return SERVER_LOCATION;
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}

function useBrowserLocation() {
  const [location, setLocation] = useState<BrowserLocation>(browserLocation);
  const sync = useCallback(() => setLocation(browserLocation()), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [sync]);

  return [location, sync] as const;
}

/**
 * URL-controlled Sheet. It uses the App Router when mounted by Next and falls
 * back to browser history for Storybook, where no App Router context exists.
 */
export function TaskPeek({ task, children }: TaskPeekProps): ReactElement {
  const router = useContext(AppRouterContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fallbackLocation, syncFallbackLocation] = useBrowserLocation();

  const useRouterLocation = router !== null && pathname !== null && searchParams !== null;
  const currentPathname = useRouterLocation ? pathname : fallbackLocation.pathname;
  const currentSearch = useRouterLocation ? searchParams.toString() : fallbackLocation.search;
  const currentHash = typeof window === "undefined" ? "" : window.location.hash;
  const open = new URLSearchParams(currentSearch).get("task") === task.id;

  const setOpen = useCallback((nextOpen: boolean) => {
    const params = new URLSearchParams(useRouterLocation ? searchParams.toString() : fallbackLocation.search);
    if (nextOpen) params.set("task", task.id);
    else params.delete("task");

    const query = params.toString();
    const href = `${currentPathname || "/"}${query ? `?${query}` : ""}${currentHash}`;
    if (useRouterLocation) {
      if (nextOpen) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
      return;
    }

    if (nextOpen) window.history.pushState(window.history.state, "", href);
    else window.history.replaceState(window.history.state, "", href);
    syncFallbackLocation();
  }, [currentHash, currentPathname, fallbackLocation.search, router, searchParams, syncFallbackLocation, task.id, useRouterLocation]);

  const summary = useMemo(() => {
    const parts = [task.status?.label, typeof task.progress === "number" ? `${task.progress}%` : undefined].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Детали задачи";
  }, [task.progress, task.status?.label]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>{summary}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <TaskPeekDetails task={task} />
        </SheetBody>
        <SheetFooter>
          <Button asChild variant="secondary">
            <a href={`/tasks/${encodeURIComponent(task.id)}`}>Открыть полностью</a>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Shared read-only detail fields used by the Sheet and canonical task page. */
export function TaskPeekDetails({ task }: { task: TaskPeekRecord }) {
  const details = [
    task.status ? { label: "Статус", value: task.status.label } : null,
    typeof task.progress === "number" ? { label: "Прогресс", value: `${task.progress}%` } : null,
    task.project?.name ? { label: "Проект", value: task.project.name } : null,
    task.plannedStart ? { label: "Начало", value: formatTaskDate(task.plannedStart) } : null,
    task.plannedFinish ? { label: "Окончание", value: formatTaskDate(task.plannedFinish) } : null,
    typeof task.durationWorkingDays === "number" ? { label: "Длительность", value: `${task.durationWorkingDays} раб. дн.` } : null,
    typeof task.plannedWork === "number" ? { label: "Плановые трудозатраты", value: `${task.plannedWork} ч` } : null,
    typeof task.actualWork === "number" ? { label: "Фактические трудозатраты", value: `${task.actualWork} ч` } : null
  ].filter((detail): detail is TaskPeekFact => detail !== null);

  return (
    <div className="flex flex-col gap-5">
      {details.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="min-w-0">
              <dt className="text-[length:var(--text-xs)] font-medium text-[var(--muted)]">{detail.label}</dt>
              <dd className="mt-0.5 break-words text-[length:var(--text-sm)] text-[var(--text)]">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {task.description ? (
        <section aria-labelledby="task-peek-description">
          <h2 id="task-peek-description" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Описание</h2>
          <p className="mt-2 whitespace-pre-wrap text-[length:var(--text-sm)] leading-[var(--lh-md)] text-[var(--text)]">{task.description}</p>
        </section>
      ) : null}

      {task.facts && task.facts.length > 0 ? (
        <section aria-labelledby="task-peek-facts">
          <h2 id="task-peek-facts" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Факты</h2>
          <dl className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {task.facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`} className="min-w-0">
                <dt className="text-[length:var(--text-xs)] font-medium text-[var(--muted)]">{fact.label}</dt>
                <dd className="mt-0.5 break-words text-[length:var(--text-sm)] text-[var(--text)]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
