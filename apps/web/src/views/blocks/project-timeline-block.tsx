"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Field, FormActions, FormGrid } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { Project, Task } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";
import { Gantt } from "@/widgets/gantt";
import type { GanttData, GanttZoom } from "@/widgets/gantt";

export type ProjectTimelineBlockProps = {
  dateActionDisabledReason?: string | undefined;
  dateActionError?: unknown;
  dateActionPending?: boolean;
  project: Project;
  data: GanttData;
  onOpenTask?: (href: string) => void;
  onUpdateTaskDueDate?: ((task: Task, dueDate: string) => Promise<unknown> | void) | undefined;
  tasks?: Task[];
};

export function ProjectTimelineBlock({
  dateActionDisabledReason = "Изменение сроков доступно пользователям с правом редактирования задач.",
  dateActionError,
  dateActionPending = false,
  project,
  data,
  onOpenTask = (href) => window.location.assign(href),
  onUpdateTaskDueDate,
  tasks = []
}: ProjectTimelineBlockProps) {
  const [zoom, setZoom] = useState<RuntimeTimelineZoom>("day");
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.archivedAt == null),
    [tasks]
  );
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const selectedTask = activeTasks.find((task) => task.id === selectedTaskId) ?? activeTasks[0];
  const [dueDate, setDueDate] = useState("");
  const [localError, setLocalError] = useState("");
  const canUpdateTaskDueDate = Boolean(onUpdateTaskDueDate && selectedTask);

  useEffect(() => {
    if (!activeTasks.length) {
      if (selectedTaskId) setSelectedTaskId("");
      return;
    }
    if (!selectedTaskId || !activeTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(activeTasks[0]?.id ?? "");
    }
  }, [activeTasks, selectedTaskId]);

  useEffect(() => {
    if (selectedTask) {
      setDueDate(getDateInputValue(selectedTask.plannedFinish));
      setLocalError("");
    }
  }, [selectedTask]);

  const handleTimelineRowOpen = (rowId: string) => {
    const href = resolveTimelineTaskHref(project, data, rowId);
    if (!href) return;
    onOpenTask(href);
  };

  async function handleDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (!selectedTask || !dueDate || !canUpdateTaskDueDate) return;

    if (isBeforeDateInput(dueDate, getDateInputValue(selectedTask.plannedStart))) {
      setLocalError("Финиш не может быть раньше старта задачи.");
      return;
    }

    if (dueDate === getDateInputValue(selectedTask.plannedFinish)) {
      setLocalError("Выберите новую дату финиша.");
      return;
    }

    try {
      await onUpdateTaskDueDate?.(selectedTask, dueDate);
    } catch {
      return;
    }
  }

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
        <>
          <div className="view-toolbar" aria-label="Масштаб план-графика">
            <Segmented
              name="project-timeline-zoom"
              value={zoom}
              onChange={setZoom}
              options={RUNTIME_TIMELINE_ZOOM_OPTIONS}
            />
          </div>
          <form aria-label="Изменение срока задачи в план-графике" onSubmit={(event) => void handleDateSubmit(event)}>
            <FormGrid columns={3}>
              <Field
                label="Задача"
                {...(!onUpdateTaskDueDate ? { hint: dateActionDisabledReason } : {})}
              >
                <Select
                  value={selectedTask?.id ?? ""}
                  disabled={!activeTasks.length || dateActionPending}
                  onValueChange={setSelectedTaskId}
                >
                  <SelectTrigger aria-label="Задача для изменения срока">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Финиш" error={localError}>
                <Input
                  aria-label="Новый финиш задачи"
                  type="date"
                  value={dueDate}
                  disabled={!selectedTask || dateActionPending}
                  onChange={(event) => setDueDate(event.currentTarget.value)}
                />
              </Field>
              <Field label="Действие">
                <FormActions align="start">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!canUpdateTaskDueDate || dateActionPending || !dueDate}
                    title={!canUpdateTaskDueDate ? dateActionDisabledReason : undefined}
                  >
                    {dateActionPending ? "Сохраняем…" : "Обновить срок"}
                  </Button>
                </FormActions>
              </Field>
            </FormGrid>
            {dateActionError ? (
              <p className="field__error" role="alert">
                Не удалось обновить срок задачи. Проверьте права, дату и актуальность данных.
              </p>
            ) : null}
          </form>
          <Gantt
            data={data}
            zoom={zoom}
            interactionMode="readonly"
            showBaseline={false}
            showCriticalPath
            showDependencies={false}
            onBarClick={handleTimelineRowOpen}
            onBarDoubleClick={handleTimelineRowOpen}
          />
        </>
      )}
    </div>
  );
}

type RuntimeTimelineZoom = Extract<GanttZoom, "day" | "week" | "month">;

const RUNTIME_TIMELINE_ZOOM_OPTIONS: Array<{ value: RuntimeTimelineZoom; label: string }> = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" }
];

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

function getDateInputValue(value: string): string {
  return value.slice(0, 10);
}

function isBeforeDateInput(value: string, minValue: string): boolean {
  return new Date(`${value}T00:00:00.000Z`) < new Date(`${minValue}T00:00:00.000Z`);
}
