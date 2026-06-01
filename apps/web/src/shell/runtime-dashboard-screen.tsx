"use client";

import { useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListChecks,
  SendHorizontal,
  ShieldCheck
} from "lucide-react";

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
  currentUserId,
  isSendingWorkspaceAgentMessage = false,
  workspaceAgentMessageError = null,
  onSendWorkspaceAgentMessage
}: {
  data: DashboardReadModel;
  currentUserId?: string;
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
            <div className="runtime-agent" aria-label="Единый управленческий агент">
              <section className="runtime-agent__chat" aria-label="Чат с Генри Ганттом">
                <header className="runtime-agent__header">
                  <div className="runtime-agent__title">
                    <span className="runtime-agent__mark"><Bot aria-hidden /></span>
                    <div>
                      <h3>Генри Гантт</h3>
                      <span>Агент рабочей области</span>
                    </div>
                  </div>
                  <div className="runtime-agent__status">
                    <span className="dot dot--success" />
                    Ждет подтверждения перед изменениями
                  </div>
                </header>

                <div className="runtime-agent__body">
                  {data.workspaceAgentThread.messages.length === 0 ? (
                    <EmptyState
                      title="История пуста"
                      description="Задайте вопрос по портфелю, задачам, срокам или загрузке."
                    />
                  ) : (
                    data.workspaceAgentThread.messages.slice(-6).map((message) => {
                      const isOwnMessage = currentUserId ? message.authorUserId === currentUserId : true;
                      return (
                        <article
                          key={message.id}
                          className={`runtime-agent-message${isOwnMessage ? " runtime-agent-message--user" : ""}`}
                        >
                          <span className="runtime-agent-message__avatar" aria-hidden>
                            {isOwnMessage ? "Вы" : <Bot aria-hidden />}
                          </span>
                          <div className="runtime-agent-message__content">
                            <div className="runtime-agent-message__meta">
                              <span>{isOwnMessage ? "Вы" : "Генри Гантт"}</span>
                              <time>{formatDate(message.createdAt)}</time>
                            </div>
                            <p>{message.body}</p>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <form
                  className="runtime-agent__composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = agentInput.trim();
                    if (!body || !onSendWorkspaceAgentMessage) return;
                    void onSendWorkspaceAgentMessage(body).then(() => setAgentInput(""));
                  }}
                >
                  <Textarea
                    aria-label="Сообщение Генри Гантту"
                    placeholder="Спросить, что требует внимания сегодня"
                    value={agentInput}
                    onChange={(event) => setAgentInput(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="icon"
                    aria-label="Отправить сообщение"
                    disabled={!agentInput.trim() || isSendingWorkspaceAgentMessage || !onSendWorkspaceAgentMessage}
                  >
                    <SendHorizontal aria-hidden />
                  </Button>
                </form>
                {workspaceAgentMessageError ? (
                  <p className="runtime-agent__error">Не удалось отправить сообщение агенту.</p>
                ) : null}
              </section>

              <aside className="runtime-agent-review" aria-label="Сверка изменений">
                <header className="runtime-agent-review__header">
                  <ShieldCheck aria-hidden />
                  <div>
                    <span>Сверка изменений</span>
                    <strong>0 предложений</strong>
                  </div>
                </header>
                <div className="runtime-agent-review__list">
                  <div className="runtime-agent-review__step is-done">
                    <CheckCircle2 aria-hidden />
                    <span>Контекст рабочей области подключен</span>
                  </div>
                  <div className="runtime-agent-review__step">
                    <Clock3 aria-hidden />
                    <span>Action proposal API будет подключен отдельным slice</span>
                  </div>
                </div>
                <p>
                  Генри пока сохраняет сообщения и читает контекст. Изменения появятся здесь только после
                  backend-контракта подтверждаемых действий.
                </p>
              </aside>
            </div>
          </CardPanel>
        </div>
      </div>
    </>
  );
}

function isPastDate(value: string): boolean {
  return value.slice(0, 10) < getRuntimeTodayIsoDate();
}
