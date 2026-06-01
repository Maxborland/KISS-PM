"use client";

import { useState } from "react";
import { BriefcaseBusiness, CalendarClock, FolderKanban, ListChecks } from "lucide-react";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { KpiTile } from "@/components/domain/kpi-tile";
import { NumericValue } from "@/components/domain/numeric-value";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardReadModel } from "@/lib/api/read-models";
import { formatDate, formatDateRange } from "@/lib/mock-data/format";
import { getRuntimeTodayIsoDate, getScheduledTaskDailyWorkMinutes } from "@/lib/scheduled-tasks";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function RuntimeDashboardScreen({
  data,
  isSendingWorkspaceAgentMessage = false,
  workspaceAgentMessageError = null,
  onSendWorkspaceAgentMessage
}: {
  data: DashboardReadModel;
  isSendingWorkspaceAgentMessage?: boolean;
  workspaceAgentMessageError?: unknown;
  onSendWorkspaceAgentMessage?: (body: string) => Promise<unknown>;
}) {
  const [agentInput, setAgentInput] = useState("");
  const activeProjects = data.projects.filter((project) => project.status === "active");
  const unfinishedTasks = data.tasks.filter((task) => task.statusCategory !== "done");
  const overdueTasks = unfinishedTasks.filter((task) => isPastDate(task.plannedFinish));
  const today = getRuntimeTodayIsoDate();
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

        <div className="bento__cell bento__cell--12">
          <CardPanel title="Управленческий агент" subtitle="Единый поток рабочей области" flush>
            {data.workspaceAgentThread.messages.length === 0 ? (
              <EmptyState
                title="История пуста"
                description="Задайте вопрос по портфелю, задачам, срокам или загрузке."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Сообщение</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workspaceAgentThread.messages.slice(-5).map((message) => (
                    <tr key={message.id}>
                      <td>
                        <CellStack title={message.body} subtitle={message.authorUserId} />
                      </td>
                      <td className="mono cell-muted">{formatDate(message.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}

            <form
              className="u-flex-col u-gap-3 u-pad-5"
              onSubmit={(event) => {
                event.preventDefault();
                const body = agentInput.trim();
                if (!body || !onSendWorkspaceAgentMessage) return;
                void onSendWorkspaceAgentMessage(body).then(() => setAgentInput(""));
              }}
            >
              <Textarea
                aria-label="Сообщение агенту"
                placeholder="Спросить, что требует внимания сегодня"
                value={agentInput}
                onChange={(event) => setAgentInput(event.target.value)}
              />
              {workspaceAgentMessageError ? (
                <p className="u-text-xs u-text-muted">Не удалось отправить сообщение агенту.</p>
              ) : null}
              <div className="u-flex">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!agentInput.trim() || isSendingWorkspaceAgentMessage || !onSendWorkspaceAgentMessage}
                >
                  {isSendingWorkspaceAgentMessage ? "Отправляем…" : "Отправить"}
                </Button>
              </div>
            </form>
          </CardPanel>
        </div>
      </div>
    </>
  );
}

function isPastDate(value: string): boolean {
  return value.slice(0, 10) < getRuntimeTodayIsoDate();
}
