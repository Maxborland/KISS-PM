"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { Project, Task } from "@/lib/api-types";
import { formatDateRange, formatHours, formatRub } from "@/lib/mock-data/format";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export type ProjectDetailBlockProps = {
  project: Project;
  tasks: Task[];
  readOnly?: boolean;
};

export function ProjectDetailBlock({ project, tasks, readOnly = false }: ProjectDetailBlockProps) {
  const activeTasks = tasks.filter((task) => task.archivedAt == null);
  const overdueTasks = activeTasks.filter((task) => isOverdueTask(task));
  const blockedTasks = activeTasks.filter((task) => task.status === "waiting");
  const completion = resolveCompletion(activeTasks);
  const editDisabledReason = readOnly
    ? "Изменение проекта будет подключено в следующем API-срезе"
    : "Сохранение проекта пока не подключено к API";

  return (
    <>
      <RoutePageIntro
        title={project.title}
        lead={`${project.id} · ${project.clientName} · ${formatDateRange(project.plannedStart, project.plannedFinish)}`}
        actions={
          <Button
            variant="primary"
            disabled
            title={editDisabledReason}
          >
            Обновить проект
          </Button>
        }
      />

      <div className="bento">
        <div className="bento__cell bento__cell--4">
          <CardPanel title="Сводка" subtitle="Ключевые параметры проекта">
            <div className="fact-list">
              <div><span>Клиент</span><strong>{project.clientName}</strong></div>
              <div><span>Статус</span><strong>{projectStatusLabel(project.status)}</strong></div>
              <div><span>Период</span><strong>{formatDateRange(project.plannedStart, project.plannedFinish)}</strong></div>
              <div><span>Бюджет</span><strong>{formatRub(project.contractValue)}</strong></div>
              <div><span>План часов</span><strong>{formatHours(project.plannedHours)}</strong></div>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel title="Что требует внимания" subtitle="Задачи и сроки проекта">
            <div className="fact-list">
              <div><span>Задач</span><strong>{activeTasks.length}</strong></div>
              <div><span>Готовность</span><strong>{completion}%</strong></div>
              <div><span>Ожидают</span><strong>{blockedTasks.length}</strong></div>
              <div><span>Просрочены</span><strong>{overdueTasks.length}</strong></div>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--12">
          <CardPanel title="Задачи проекта" subtitle="Текущий контур работ" flush>
            {activeTasks.length === 0 ? (
              <EmptyState
                title="Задач пока нет"
                description="Когда команда создаст задачи проекта, они появятся здесь без демо-данных."
              />
            ) : (
              <DataTable compact>
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Ответственный</th>
                    <th>Статус</th>
                    <th>Срок</th>
                    <th>План</th>
                    <th>Прогресс</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <CellStack title={task.title} subtitle={task.id} />
                      </td>
                      <td>{task.ownerUserId}</td>
                      <td>
                        <Chip variant={taskStatusVariant(task.status)}>{task.statusName}</Chip>
                      </td>
                      <td>{formatDateRange(task.plannedStart, task.plannedFinish)}</td>
                      <td className="mono">{formatHours(task.plannedWork)}</td>
                      <td className="mono">{task.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardPanel>
        </div>
      </div>
    </>
  );
}

function projectStatusLabel(status: string): string {
  if (status === "active") return "Активен";
  if (status === "draft") return "Черновик";
  if (status === "closed") return "Закрыт";
  if (status === "paused") return "Пауза";
  return status;
}

function taskStatusVariant(status: Task["status"]): "info" | "success" | "warning" {
  if (status === "done") return "success";
  if (status === "waiting") return "warning";
  return "info";
}

function isOverdueTask(task: Task): boolean {
  return task.status !== "done" && new Date(task.plannedFinish).getTime() < Date.now();
}

function resolveCompletion(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
}
