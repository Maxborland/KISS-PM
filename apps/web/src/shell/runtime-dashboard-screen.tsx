"use client";

import { BriefcaseBusiness, CalendarClock, FolderKanban, ListChecks } from "lucide-react";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { KpiTile } from "@/components/domain/kpi-tile";
import { NumericValue } from "@/components/domain/numeric-value";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { ScheduledTask } from "@/lib/api-types";
import type { DashboardReadModel } from "@/lib/api/read-models";
import { formatDate, formatDateRange } from "@/lib/mock-data/format";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function RuntimeDashboardScreen({ data }: { data: DashboardReadModel }) {
  const activeProjects = data.projects.filter((project) => project.status === "active");
  const unfinishedTasks = data.tasks.filter((task) => task.statusCategory !== "done");
  const overdueTasks = unfinishedTasks.filter((task) => isPastDate(task.plannedFinish));
  const today = getDashboardTodayIsoDate();
  const todayWorkHours = Math.round(
    data.scheduledTasks.reduce((sum, task) => sum + getScheduledTaskDailyWorkMinutes(task, today), 0) / 60
  );
  const taskRows = unfinishedTasks.slice(0, 5);

  return (
    <>
      <RoutePageIntro
        lead="Runtime-сводка по проектам и вашей работе. CRM/KPI виджеты подключатся после отдельного dashboard API."
      />

      <div className="bento">
        <div className="bento__cell tile tile--metric">
          <KpiTile
            label="Активные проекты"
            value={<NumericValue value={activeProjects.length} />}
            meta={<span className="tile__foot"><FolderKanban className="size-4" aria-hidden /> live API</span>}
          />
        </div>
        <div className="bento__cell tile tile--metric">
          <KpiTile
            label="Мои задачи"
            value={<NumericValue value={unfinishedTasks.length} />}
            meta={<span className="tile__foot"><ListChecks className="size-4" aria-hidden /> не завершены</span>}
          />
        </div>
        <div className="bento__cell tile tile--metric">
          <KpiTile
            label="Просрочено"
            value={<NumericValue value={overdueTasks.length} />}
            meta={<span className="tile__foot"><BriefcaseBusiness className="size-4" aria-hidden /> требует внимания</span>}
          />
        </div>
        <div className="bento__cell tile tile--metric">
          <KpiTile
            label="План сегодня"
            value={<NumericValue value={todayWorkHours} suffix=" ч" />}
            meta={<span className="tile__foot"><CalendarClock className="size-4" aria-hidden /> scheduled tasks</span>}
          />
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel title="Ближайшие задачи" subtitle={`${taskRows.length} из ${unfinishedTasks.length}`} flush>
            {taskRows.length === 0 ? (
              <EmptyState
                title="Задач нет"
                description="Runtime API не вернул незавершенные задачи для вашего пользователя."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Статус</th>
                    <th>Срок</th>
                    <th>Прогресс</th>
                  </tr>
                </thead>
                <tbody>
                  {taskRows.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <CellStack title={task.title} subtitle={task.id} />
                      </td>
                      <td>
                        <Chip variant={task.statusCategory === "review" ? "warning" : "info"}>
                          {task.statusName}
                        </Chip>
                      </td>
                      <td className="mono cell-muted">{formatDate(task.plannedFinish)}</td>
                      <td>{task.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--4">
          <CardPanel title="План на сегодня" subtitle={`${data.scheduledTasks.length} слотов`} flush>
            {data.scheduledTasks.length === 0 ? (
              <EmptyState
                title="План пуст"
                description="На сегодня нет scheduled tasks в доступном API."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Период</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scheduledTasks.slice(0, 4).map((task) => (
                    <tr key={task.id}>
                      <td>
                        <CellStack title={task.title} subtitle={task.projectTitle} />
                      </td>
                      <td className="mono">{formatDateRange(task.plannedStart, task.plannedFinish)}</td>
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

function isPastDate(value: string): boolean {
  return value.slice(0, 10) < getDashboardTodayIsoDate();
}

function getDashboardTodayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getScheduledTaskDailyWorkMinutes(
  task: Pick<ScheduledTask, "plannedStart" | "plannedFinish" | "workMinutes">,
  targetDate: string = getDashboardTodayIsoDate()
): number {
  const start = task.plannedStart.slice(0, 10);
  const finish = task.plannedFinish.slice(0, 10);

  if (targetDate < start || targetDate > finish) return 0;

  const days = inclusiveCalendarDays(start, finish);
  if (days <= 1) return task.workMinutes;

  return Math.round(task.workMinutes / days);
}

function inclusiveCalendarDays(start: string, finish: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const finishMs = Date.parse(`${finish}T00:00:00.000Z`);

  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs <= startMs) {
    return 1;
  }

  return Math.floor((finishMs - startMs) / 86_400_000) + 1;
}
