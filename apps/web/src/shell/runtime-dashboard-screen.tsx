"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  FolderKanban,
  ListChecks
} from "lucide-react";

import { AgentCockpitBlock } from "@/views/blocks/agent-cockpit-block";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { KpiTile } from "@/components/domain/kpi-tile";
import { NumericValue } from "@/components/domain/numeric-value";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardReadModel } from "@/lib/api/read-models";
import { formatDate, formatDateRange } from "@/lib/mock-data/format";
import { getRuntimeTodayIsoDate, getScheduledTaskDailyWorkMinutes } from "@/lib/scheduled-tasks";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function RuntimeDashboardScreen({
  data,
  currentUserId,
  isSendingWorkspaceAgentMessage = false,
  isConfirmingWorkspaceAgentAction = false,
  workspaceAgentMessageError = null,
  workspaceAgentActionError = null,
  onSendWorkspaceAgentMessage,
  onConfirmWorkspaceAgentAction
}: {
  data: DashboardReadModel;
  currentUserId?: string;
  isSendingWorkspaceAgentMessage?: boolean;
  isConfirmingWorkspaceAgentAction?: boolean;
  workspaceAgentMessageError?: unknown;
  workspaceAgentActionError?: unknown;
  onSendWorkspaceAgentMessage?: (body: string) => Promise<unknown>;
  onConfirmWorkspaceAgentAction?: (proposalId: string, decision: "apply" | "reject") => Promise<unknown>;
}) {
  const activeProjects = data.projects.filter((project) => project.status === "active");
  const unfinishedTasks = data.tasks.filter((task) => task.statusCategory !== "done");
  const overdueTasks = unfinishedTasks.filter((task) => isPastDate(task.plannedFinish));
  const operationsCockpitUnavailable = data.operationsCockpit.agentContext.unavailableSources.find(
    (source) => source.source === "operations_cockpit"
  );
  const resourceWorkloadUnavailable = findUnavailableSource(data, "resource_workload");
  const opportunityPipelineUnavailable = findUnavailableSource(data, "opportunity_pipeline");
  const attentionItems = data.operationsCockpit.attentionItems.slice(0, 5);
  const workloadHints = data.operationsCockpit.workloadHints.byPerson.slice(0, 4);
  const pipelineDeals = data.operationsCockpit.pipelinePressure.deals.slice(0, 4);
  const today = getRuntimeTodayIsoDate();
  const todayWorkHours = Math.round(
    data.scheduledTasks.reduce((sum, task) => sum + getScheduledTaskDailyWorkMinutes(task, today), 0) / 60
  );
  const taskRows = unfinishedTasks.slice(0, 5);

  return (
    <>
      <RoutePageIntro
        lead="Живая сводка по проектам, срочным сигналам, загрузке и агентским предложениям рабочей области."
      />

      <div className="bento">
        <div className="bento__cell tile tile--metric">
          <KpiTile
            label="Активные проекты"
            value={<NumericValue value={activeProjects.length} />}
            meta={<span className="tile__foot"><FolderKanban className="size-4" aria-hidden /> портфель</span>}
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
            value={<NumericValue value={data.operationsCockpit.indicators.overdueTasks || overdueTasks.length} />}
            meta={<span className="tile__foot"><BriefcaseBusiness className="size-4" aria-hidden /> задачи</span>}
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
          <CardPanel
            title="Что требует внимания"
            subtitle={operationsCockpitUnavailable ? "контекст недоступен" : `${attentionItems.length} сигналов`}
            flush
          >
            {operationsCockpitUnavailable ? (
              <EmptyState
                title="Операционный контекст не подключен"
                description={`Источник сигналов внимания недоступен: ${operationsCockpitUnavailable.reason}.`}
              />
            ) : attentionItems.length === 0 ? (
              <EmptyState
                title="Критичных сигналов нет"
                description="В доступном runtime-контексте нет просрочек, блокеров или готовых к запуску сделок."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Сигнал</th>
                    <th>Причина</th>
                    <th>Срок</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <a href={resolveAttentionEntityHref(item)} aria-label={`Открыть сигнал: ${item.title}`}>
                          <CellStack title={item.title} subtitle={item.entity.title} />
                        </a>
                      </td>
                      <td>{item.reason}</td>
                      <td className="mono cell-muted">{item.dueDate ? formatDate(item.dueDate) : "без срока"}</td>
                      <td>
                        <Chip variant={item.severity === "critical" ? "danger" : "warning"}>
                          {attentionSeverityLabel(item.severity)}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--4">
          <CardPanel
            title="Ресурсные риски"
            subtitle={resourceWorkloadUnavailable ? "контекст скрыт" : `${workloadHints.length} человек`}
            flush
          >
            {resourceWorkloadUnavailable ? (
              <EmptyState
                title="Загрузка недоступна"
                description={`Источник ресурсной загрузки недоступен: ${resourceWorkloadUnavailable.reason}.`}
              />
            ) : workloadHints.length === 0 ? (
              <EmptyState
                title="Перегруз не найден"
                description="В доступном контексте нет людей с критичной нагрузкой."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Человек</th>
                    <th>Нагрузка</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadHints.map((person) => (
                    <tr key={person.userId}>
                      <td>
                        <CellStack title={person.name} subtitle={person.positionName ?? "роль не указана"} />
                      </td>
                      <td>
                        <CellStack
                          title={`${person.activeTaskCount} задач`}
                          subtitle={`${person.plannedWorkHours} ч · ${person.overdueTaskCount} просрочено`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardPanel>
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
          <CardPanel
            title="Давление воронки"
            subtitle={opportunityPipelineUnavailable ? "контекст скрыт" : `${pipelineDeals.length} сделок`}
            flush
          >
            {opportunityPipelineUnavailable ? (
              <EmptyState
                title="Воронка недоступна"
                description={`Источник сделок недоступен: ${opportunityPipelineUnavailable.reason}.`}
              />
            ) : pipelineDeals.length === 0 ? (
              <EmptyState
                title="Pipeline не давит на портфель"
                description="В доступном контексте нет сделок, которые уже нужно учитывать в загрузке."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Сделка</th>
                    <th>Клиент</th>
                    <th>Вероятность</th>
                    <th>План</th>
                    <th>Реалистичность</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineDeals.map((deal) => (
                    <tr key={deal.id}>
                      <td>
                        <CellStack title={deal.title} subtitle={`${deal.plannedHours} ч`} />
                      </td>
                      <td>{deal.clientName}</td>
                      <td className="mono">{deal.probability}%</td>
                      <td className="mono cell-muted">{formatDate(deal.plannedFinish)}</td>
                      <td>
                        <Chip variant={deal.feasibilityStatus === "at_risk" ? "warning" : "info"}>
                          {feasibilityStatusLabel(deal.feasibilityStatus)}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--12">
          <CardPanel title="Управленческий агент" subtitle="Единый поток рабочей области" flush>
            <AgentCockpitBlock
              thread={data.workspaceAgentThread}
              operationsCockpit={data.operationsCockpit}
              currentUserId={currentUserId}
              isSending={isSendingWorkspaceAgentMessage}
              isConfirming={isConfirmingWorkspaceAgentAction}
              messageError={workspaceAgentMessageError}
              actionError={workspaceAgentActionError}
              onSendMessage={onSendWorkspaceAgentMessage}
              onConfirmProposal={onConfirmWorkspaceAgentAction}
            />
          </CardPanel>
        </div>
      </div>
    </>
  );
}

function isPastDate(value: string): boolean {
  return value.slice(0, 10) < getRuntimeTodayIsoDate();
}

function findUnavailableSource(data: DashboardReadModel, source: string) {
  return data.operationsCockpit.agentContext.unavailableSources.find((entry) => entry.source === source);
}

function resolveAttentionEntityHref(
  item: DashboardReadModel["operationsCockpit"]["attentionItems"][number]
): string {
  if (item.entity.type === "project") return `/projects/${item.entity.id}`;
  if (item.entity.type === "task") {
    const projectPath = item.projectId ? `/projects/${item.projectId}` : "/my-work";
    return `${projectPath}?taskId=${item.entity.id}`;
  }
  return `/deals?dealId=${item.entity.id}`;
}

function attentionSeverityLabel(severity: "critical" | "warning" | "info"): string {
  if (severity === "critical") return "критично";
  if (severity === "warning") return "риск";
  return "инфо";
}

function feasibilityStatusLabel(status: string | null): string {
  if (status === "at_risk") return "есть риск";
  if (status === "ready") return "готово";
  if (status === "blocked") return "заблокировано";
  return "не оценено";
}
