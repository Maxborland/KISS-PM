"use client";

import { EmptyState } from "@/components/ui/empty-state";
import type { Project } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";
import { Gantt } from "@/widgets/gantt";
import type { GanttData } from "@/widgets/gantt";

export type ProjectTimelineBlockProps = {
  project: Project;
  data: GanttData;
  onOpenTask?: (href: string) => void;
};

export function ProjectTimelineBlock({
  project,
  data,
  onOpenTask = (href) => window.location.assign(href)
}: ProjectTimelineBlockProps) {
  const handleTimelineRowOpen = (rowId: string) => {
    const href = resolveTimelineTaskHref(project, data, rowId);
    if (!href) return;
    onOpenTask(href);
  };

  return (
    <div className="gantt-workspace" data-runtime-surface="project-timeline">
      <RoutePageIntro
        title={`Гант · ${project.title}`}
        lead={`${project.clientName} · ${formatDate(project.plannedStart)} - ${formatDate(project.plannedFinish)}`}
      />
      {data.rows.length === 0 ? (
        <EmptyState
          level="L2"
          title="План проекта пока пуст"
          description="Добавьте задачи в карточке проекта, и они появятся в план-графике без демо-данных."
        />
      ) : (
        <Gantt
          data={data}
          interactionMode="readonly"
          showBaseline={false}
          showCriticalPath
          showDependencies={false}
          onBarClick={handleTimelineRowOpen}
          onBarDoubleClick={handleTimelineRowOpen}
        />
      )}
    </div>
  );
}

export function resolveTimelineTaskHref(
  project: Project,
  data: GanttData,
  rowId: string
): string | null {
  const row = data.rows.find((item) => item.id === rowId);
  if (!row || row.kind === "summary") return null;

  const projectId = row.projectId ?? project.id;
  return `/projects/${encodeURIComponent(projectId)}?taskId=${encodeURIComponent(row.id)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(value));
}
