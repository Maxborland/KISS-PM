"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Folder, MoreHorizontal } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Field } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { ApiError, apiFetch } from "@/lib/api";
import { KanbanBoard, KanbanColumn } from "@/widgets/kanban/kanban-board";
import { KanbanCard } from "@/widgets/kanban/kanban-card";
import { Gantt } from "@/widgets/gantt";
import type { GanttData } from "@/widgets/gantt";
import { SCREEN_META, type ScreenId } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

type RuntimeScreenId =
  | "01-dashboard"
  | "02-my-work"
  | "05-deals"
  | "06-deal-card"
  | "07-projects-list"
  | "07b-project-detail"
  | "09-admin"
  | "11-agent"
  | "10-settings"
  | "12-project-gantt"
  | "13-project-resources";

type AuthMe = { user: RuntimeUser; permissions: string[]; workspace: { id: string } };
type RuntimeUser = { id: string; name: string; email?: string; positionName?: string | null; status?: string };
type Opportunity = {
  id: string;
  title: string;
  clientName: string;
  contactName?: string | null;
  stageId: string | null;
  contractValue: number;
  plannedStart: string;
  plannedFinish: string;
  probability: number;
  feasibilityStatus?: string | null;
};
type DealStage = { id: string; name: string; sortOrder: number };
type Project = { id: string; title: string; clientName: string; status: string; plannedStart: string; plannedFinish: string; plannedHours: number; contractValue: number };
type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  statusId: string;
  statusName: string;
  statusCategory: string;
  priority: string;
  plannedStart: string;
  plannedFinish: string;
  plannedWork: number;
  progress: number;
  updatedAt?: string;
  participants?: Array<{ userId: string; role: string }>;
};
type TaskStatus = { id: string; name: string; category: string; sortOrder: number; status: string };
type AuditEvent = { id: string; actionType: string; createdAt: string; executionResult?: Record<string, unknown> | null; sourceEntity?: Record<string, unknown> | null };
type PlanningReadModel = {
  project: { id: string; title: string; plannedStart: string; plannedFinish: string };
  authored: { tasks: Array<{ id: string; title: string; statusId: string; plannedStart: string | null; plannedFinish: string | null; workMinutes?: number | null }>; assignments: Array<{ id: string; taskId: string; resourceId: string; role: string; workMinutes: number | null }> };
  planVersion: number;
};
type PlanningPreview = { planDelta: { changedTaskIds: string[]; changedAssignmentIds: string[]; changedDependencyIds: string[] }; validationIssues: Array<{ code: string; message: string; severity: string }> };
type AccessProfile = { id: string; name: string; permissions: string[] };
type CapacitySummary = { overloadUserCount?: number; overloadedEmployeeCount?: number; overloadedEmployees?: number; totalWorkMinutes?: number; totalPlannedMinutes?: number; totalCapacityMinutes?: number; totalOverloadMinutes?: number; monthIso?: string };
type CapacityDay = { date: string; workMinutes: number; capacityMinutes: number; freeMinutes: number; overloadMinutes: number; heat: string };
type CapacityTreeNode = { id: string; type: string; name: string; days: CapacityDay[]; children?: CapacityTreeNode[] };

type QueryState<T> = { data: T | undefined; isLoading: boolean; error: Error | null };

const PERMISSIONS = {
  manageOpportunities: "tenant.opportunities.manage",
  readResourceFeasibility: "tenant.resource_feasibility.read",
  manageProjectActivation: "tenant.project_activation.manage",
  createTasks: "tenant.tasks.create",
  editTasks: "tenant.tasks.edit",
  manageProjectPlan: "tenant.project_plan.manage"
} as const;

type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];


export function RuntimeScreenView({ id, entityId }: { id: RuntimeScreenId; entityId?: string }) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => apiFetch<AuthMe>("/api/auth/me"), retry: false });

  if (me.isLoading) return <ChromeState title="Проверяем сессию" lead="Загружаем профиль и права рабочего пространства." />;
  if (isUnauthorized(me.error)) return <RuntimeLogin />;
  if (me.error || !me.data) return <ChromeState title="Не удалось открыть рабочую область" lead={errorMessage(me.error)} />;

  const meta = runtimeScreenMeta(id);
  return (
    <WorkspaceChrome meta={meta}>
      <RuntimeScreenContent id={id} entityId={entityId} me={me.data} />
    </WorkspaceChrome>
  );
}

function RuntimeScreenContent({ id, entityId, me }: { id: RuntimeScreenId; entityId: string | undefined; me: AuthMe }) {
  if (id === "01-dashboard") return <DashboardRuntime me={me} />;
  if (id === "02-my-work") return <MyWorkRuntime me={me} />;
  if (id === "05-deals") return <DealsRuntime me={me} />;
  if (id === "06-deal-card") return entityId ? <DealDetailRuntime id={entityId} me={me} /> : <MissingRouteContext entity="сделки" />;
  if (id === "07-projects-list") return <ProjectsRuntime />;
  if (id === "07b-project-detail") return entityId ? <ProjectDetailRuntime id={entityId} me={me} /> : <MissingRouteContext entity="проекта" />;
  if (id === "12-project-gantt") return entityId ? <ProjectGanttRuntime id={entityId} me={me} /> : <MissingRouteContext entity="проекта" />;
  if (id === "13-project-resources") return entityId ? <ProjectResourcesRuntime id={entityId} /> : <MissingRouteContext entity="проекта" />;
  if (id === "09-admin") return <AdminRuntime section={entityId === "roles" || entityId === "audit" ? entityId : "users"} />;
  if (id === "11-agent") return <AgentRuntime me={me} />;
  return <SettingsRuntime />;
}

function MissingRouteContext({ entity }: { entity: string }) {
  return (
    <PageIntro
      title="Не удалось открыть экран"
      lead={`В маршруте нет идентификатора ${entity}. Вернитесь к списку и откройте запись оттуда.`}
    />
  );
}

function DashboardRuntime({ me }: { me: AuthMe }) {
  const projects = useProjects();
  const myWork = useMyWork();
  const deals = useOpportunities();
  const statuses = useTaskStatuses();
  const audit = useAuditEvents(6);
  const capacity = useCapacitySummary(currentMonthIso());
  const tasks = myWork.data?.tasks ?? [];
  const activeProjects = projects.data?.projects ?? [];
  const opportunities = deals.data?.opportunities ?? [];
  const overdueTasks = tasks.filter((task) => isOverdue(task));
  const blockedTasks = tasks.filter((task) => task.statusCategory === "waiting");
  const attentionTasks = [...overdueTasks, ...blockedTasks.filter((task) => !overdueTasks.some((overdue) => overdue.id === task.id))].slice(0, 5);
  const nextDeal = [...opportunities].sort((left, right) => new Date(left.plannedStart).getTime() - new Date(right.plannedStart).getTime())[0];

  return (
    <>
      <PageIntro
        title={`Добро пожаловать, ${firstName(me.user.name)}`}
        lead={`Фокус на сегодня: ${overdueTasks.length} просрочек, ${blockedTasks.length} блокеров, ${capacityCount(capacity.data)} перегрузок.`}
        actions={<BemAvatar initials={initials(me.user.name)} color="c4" size="xl" />}
      />
      <div className="bento">
        <MetricTile label="Активные проекты" value={activeProjects.length} sub="в работе" />
        <MetricTile label="Просрочено" value={overdueTasks.length} sub="задач требуют решения" danger={overdueTasks.length > 0} />
        <MetricTile label="Блокеры" value={blockedTasks.length} sub="задач в ожидании" danger={blockedTasks.length > 0} />
        <MetricTile label="Перегрузка" value={capacityCount(capacity.data)} sub="людей в зоне риска" danger={capacityCount(capacity.data) > 0} />
        <div className="bento__cell bento__cell--8">
          <CardPanel title="Требует внимания" subtitle="Просрочки и блокеры из текущих задач" flush>
            <StateGate state={myWork} empty="Срочных задач нет.">
              {attentionTasks.length > 0 ? <TaskTable tasks={attentionTasks} statuses={statuses.data?.taskStatuses ?? []} auth={me} compactActions /> : <p className="u-text-sm u-text-muted">Сейчас нет просрочек или блокеров.</p>}
            </StateGate>
          </CardPanel>
        </div>
        <div className="bento__cell bento__cell--4">
          <CardPanel title="Следующее управленческое действие" subtitle="Не декоративная кнопка — переход в рабочий контур">
            <div className="u-stack-3">
              {attentionTasks[0] ? (
                <>
                  <p className="u-text-body u-text-strong">{attentionTasks[0].title}</p>
                  <p className="u-text-sm u-text-muted">Откройте задачу в «Моя работа», обновите статус или зафиксируйте комментарий.</p>
                  <Button variant="primary" asChild><Link href="/my-work">Открыть работу</Link></Button>
                </>
              ) : nextDeal ? (
                <>
                  <p className="u-text-body u-text-strong">{nextDeal.title}</p>
                  <p className="u-text-sm u-text-muted">Ближайший старт: {formatDate(nextDeal.plannedStart)}. Проверьте реализуемость перед передачей в проект.</p>
                  <Button variant="primary" asChild><Link href={`/deals/${nextDeal.id}`}>Открыть сделку</Link></Button>
                </>
              ) : (
                <p className="u-text-sm u-text-muted">Нет срочного действия. Проверьте проекты или воронку.</p>
              )}
            </div>
          </CardPanel>
        </div>
        <div className="bento__cell bento__cell--8"><TasksPanel state={myWork} tasks={tasks.slice(0, 5)} statuses={statuses.data?.taskStatuses ?? []} auth={me} /></div>
        <div className="bento__cell bento__cell--4"><AuditPanel state={audit} /></div>
      </div>
    </>
  );
}

function MyWorkRuntime({ me }: { me: AuthMe }) {
  const [mode, setMode] = useState<"kanban" | "list">("kanban");
  const myWork = useMyWork();
  const statuses = useTaskStatuses();
  const tasks = myWork.data?.tasks ?? [];
  return (
    <>
      <PageIntro title="Моя работа" lead="Канбан и список задач в одном рабочем контуре. Статус, комментарий и блокер сохраняются после действия." />
      <div className="view-toolbar"><Segmented name="my-work-mode" value={mode} onChange={setMode} options={[{ value: "kanban", label: "Канбан" }, { value: "list", label: "Список" }]} /></div>
      <StateGate state={myWork} empty="Назначенных задач нет.">
        {mode === "list" ? (
          <TaskTable tasks={tasks} statuses={statuses.data?.taskStatuses ?? []} actorId={me.user.id} auth={me} />
        ) : (
          <TaskKanban tasks={tasks} statuses={statuses.data?.taskStatuses ?? []} auth={me} />
        )}
      </StateGate>
    </>
  );
}


function AgentRuntime({ me }: { me: AuthMe }) {
  const myWork = useMyWork();
  const statuses = useTaskStatuses();
  const audit = useAuditEvents(5);
  const queryClient = useQueryClient();
  const [proposalOpen, setProposalOpen] = useState(false);
  const tasks = myWork.data?.tasks ?? [];
  const task = tasks.find((item) => nextStatus(statuses.data?.taskStatuses ?? [], item));
  const next = task ? nextStatus(statuses.data?.taskStatuses ?? [], task) : null;
  const reason = disabledReason(me, PERMISSIONS.editTasks);
  const apply = useMutation({
    mutationFn: () => {
      if (!task || !next) throw new Error("Нет доступного действия");
      if (reason) throw new Error(reason);
      return apiFetch(`/api/workspace/projects/${task.projectId}/tasks/${task.id}/status`, { method: "PATCH", json: { statusId: next.id } });
    },
    onSuccess: async () => {
      toast.success("Предложение применено");
      setProposalOpen(false);
      await queryClient.invalidateQueries();
    }
  });

  return (
    <>
      <PageIntro title="Агент" lead="Агент готовит безопасное предложение по текущим задачам и ждёт подтверждения перед изменением." />
      <div className="entity-grid">
        <div className="entity-grid__main">
          <CardPanel title="Предложение" subtitle="Без подтверждения данные не меняются">
            <StateGate state={myWork} empty="Нет задач для предложения.">
              {task && next ? (
                <div className="u-stack-3">
                  <p className="u-text-body">Предложение: перевести задачу «{task.title}» в статус «{next.name}».</p>
                  {!proposalOpen ? (
                    <>
                      <Button variant="primary" disabled={Boolean(reason)} title={reason ?? undefined} onClick={() => setProposalOpen(true)}>Подготовить предложение</Button>
                      <DisabledReason reason={reason} />
                    </>
                  ) : (
                    <div className="u-stack-2">
                      <p className="u-text-sm u-text-muted">Подтвердите действие. До подтверждения изменение не отправляется.</p>
                      <Button variant="primary" disabled={Boolean(reason) || apply.isPending} title={reason ?? undefined} onClick={() => apply.mutate()}>Подтвердить действие</Button>
                      <Button variant="secondary" disabled={apply.isPending} onClick={() => setProposalOpen(false)}>Отменить</Button>
                      <DisabledReason reason={reason} />
                    </div>
                  )}
                  <MutationMessage error={apply.error} />
                </div>
              ) : (
                <p className="u-text-sm u-text-muted">Сейчас нет безопасного перехода статуса для предложения.</p>
              )}
            </StateGate>
          </CardPanel>
        </div>
        <aside className="entity-grid__aside">
          <AuditPanel state={audit} />
        </aside>
      </div>
    </>
  );
}

function DealsRuntime({ me }: { me: AuthMe }) {
  const [mode, setMode] = useState<"kanban" | "list" | "forecast">("kanban");
  const deals = useOpportunities();
  const stages = useDealStages();
  const items = deals.data?.opportunities ?? [];
  const stageItems = stages.data?.dealStages ?? [];
  return (
    <>
      <PageIntro title="Сделки" lead="Воронка продаж и активные возможности." />
      <div className="view-toolbar">
        <Segmented name="deals-mode" value={mode} onChange={setMode} options={[{ value: "kanban", label: "Канбан" }, { value: "list", label: "Список" }, { value: "forecast", label: "Прогноз" }]} />
      </div>
      <StateGate state={deals} empty="Сделок пока нет.">
        {mode === "kanban" ? <DealsFunnel deals={items} stages={stageItems} /> : mode === "forecast" ? <ForecastPanel deals={items} /> : null}
        {mode !== "forecast" ? <DealsTable deals={items} stages={stageItems} auth={me} /> : null}
      </StateGate>
    </>
  );
}

function DealDetailRuntime({ id, me }: { id: string; me: AuthMe }) {
  const deal = useQuery({ queryKey: ["opportunity", id], queryFn: () => apiFetch<{ opportunity: Opportunity }>(`/api/workspace/opportunities/${id}`) });
  const queryClient = useQueryClient();
  const router = useRouter();
  const feasibilityReason = disabledReason(me, PERMISSIONS.readResourceFeasibility);
  const activateReason = disabledReason(me, PERMISSIONS.manageProjectActivation);
  const feasibility = useMutation({
    mutationFn: () => {
      if (feasibilityReason) throw new Error(feasibilityReason);
      return apiFetch(`/api/workspace/opportunities/${id}/feasibility`, { method: "POST" });
    },
    onSuccess: async () => {
      toast.success("Проверка реализуемости сохранена");
      await queryClient.invalidateQueries({ queryKey: ["opportunity", id] });
    }
  });
  const activate = useMutation({
    mutationFn: () => {
      if (activateReason) throw new Error(activateReason);
      return apiFetch<{ project: Project }>(`/api/workspace/opportunities/${id}/activate`, { method: "POST", json: { acceptedRiskReason: "Проверено в рабочем контуре" } });
    },
    onSuccess: async (payload) => {
      toast.success("Проект активирован");
      router.push(`/projects/${payload.project.id}`);
    }
  });
  const item = deal.data?.opportunity;
  return (
    <>
      <PageIntro
        title={item?.title ?? "Карточка сделки"}
        lead={item ? `${item.clientName} · ${dateRange(item.plannedStart, item.plannedFinish)}` : "Загружаем сделку"}
        actions={<><Button variant="secondary" onClick={() => feasibility.mutate()} disabled={Boolean(feasibilityReason) || feasibility.isPending} title={feasibilityReason ?? undefined}>Проверить реализуемость</Button><Button variant="primary" onClick={() => activate.mutate()} disabled={Boolean(activateReason) || activate.isPending} title={activateReason ?? undefined}>Активировать проект</Button></>}
      />
      <DisabledReason reason={feasibilityReason ?? activateReason} />
      <StateGate state={deal} empty="Сделка не найдена.">
        {item ? <EntityCards title="Описание" description={`${item.title}. Контакт: ${item.contactName ?? "не указан"}. Вероятность: ${item.probability}%. Бюджет: ${money(item.contractValue)}.`} aside={<FactList facts={[['Клиент', item.clientName], ['Сумма', money(item.contractValue)], ['Срок', dateRange(item.plannedStart, item.plannedFinish)], ['Статус проверки', item.feasibilityStatus ? businessStatus(item.feasibilityStatus) : 'Не проводилась']]} />} /> : null}
      </StateGate>
      <MutationMessage error={feasibility.error ?? activate.error} />
    </>
  );
}
function ProjectsRuntime() {
  const projects = useProjects();
  return (
    <>
      <PageIntro title="Проекты" lead={`${projects.data?.projects.length ?? 0} активных проектов в работе.`} />
      <StateGate state={projects} empty="Активных проектов пока нет.">
        <ProjectsTable projects={projects.data?.projects ?? []} />
      </StateGate>
    </>
  );
}

function ProjectDetailRuntime({ id, me }: { id: string; me: AuthMe }) {
  const project = useProject(id);
  const tasks = project.data?.tasks ?? [];
  const statuses = useTaskStatuses();
  const item = project.data?.project;
  return (
    <>
      <PageIntro title={item?.title ?? "Проект"} lead={item ? `${item.clientName} · ${dateRange(item.plannedStart, item.plannedFinish)}` : "Загружаем проект"} actions={<><Button variant="secondary" asChild><Link href={`/projects/${id}/timeline`}><Calendar className="size-4" aria-hidden />Гант</Link></Button><Button variant="primary" asChild><Link href={`/projects/${id}/resources`}>Ресурсы</Link></Button></>} />
      <StateGate state={project} empty="Проект не найден.">
        {item ? <EntityCards title="Контур проекта" description={`${item.title}: план ${item.plannedHours} ч, бюджет ${money(item.contractValue)}. Ниже можно создать задачу, сменить статус или зафиксировать комментарий.`} aside={<FactList facts={[['Клиент', item.clientName], ['Статус', businessStatus(item.status)], ['Период', dateRange(item.plannedStart, item.plannedFinish)], ['Задач', String(tasks.length)]]} />} /> : null}
        <div className="u-mt-3"><CreateTaskPanel projectId={id} actorId={me.user.id} defaultStatusId={statuses.data?.taskStatuses[0]?.id} auth={me} /></div>
        <div className="u-mt-3"><TaskTable tasks={tasks} statuses={statuses.data?.taskStatuses ?? []} actorId={me.user.id} auth={me} /></div>
      </StateGate>
    </>
  );
}

function ProjectGanttRuntime({ id, me }: { id: string; me: AuthMe }) {
  const planning = usePlanning(id);
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<PlanningPreview | null>(null);
  const data = useMemo(() => planning.data ? toGanttData(planning.data) : undefined, [planning.data]);
  const command = planning.data ? nextScheduleCommand(planning.data) : null;
  const reason = disabledReason(me, PERMISSIONS.manageProjectPlan);
  const previewMutation = useMutation({
    mutationFn: () => {
      if (reason) throw new Error(reason);
      if (!planning.data || !command) throw new Error("Нет задачи для предпросмотра");
      return apiFetch<PlanningPreview>(`/api/workspace/projects/${id}/planning/preview-command`, {
        method: "POST",
        json: { command, clientPlanVersion: planning.data.planVersion }
      });
    },
    onSuccess: (payload) => {
      setPreview(payload);
      toast.success("Предпросмотр подготовлен");
    }
  });
  const applyMutation = useMutation({
    mutationFn: () => {
      if (reason) throw new Error(reason);
      if (!planning.data || !command) throw new Error("Сначала перечитайте план");
      return apiFetch(`/api/workspace/projects/${id}/planning/apply-command`, {
        method: "POST",
        json: { command, clientPlanVersion: planning.data.planVersion, idempotencyKey: `runtime-shift-${planning.data.planVersion}-${command.payload.taskId}` }
      });
    },
    onSuccess: async () => {
      toast.success("Изменение плана применено");
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["planning", id] });
    }
  });
  return (
    <>
      <PageIntro
        title={`Гант · ${planning.data?.project.title ?? "Проект"}`}
        lead="План-факт и WBS проекта из текущего плана. Изменение проходит через сверку и применение с версией плана."
        actions={<><Button variant="secondary" disabled={Boolean(reason) || !command || previewMutation.isPending} title={reason ?? undefined} onClick={() => previewMutation.mutate()}>Подготовить сверку</Button><Button variant="primary" disabled={Boolean(reason) || !preview || applyMutation.isPending} title={reason ?? undefined} onClick={() => applyMutation.mutate()}>Применить</Button></>}
      />
      <DisabledReason reason={reason} />
      <StateGate state={planning} empty="План проекта пока пуст.">
        <div className="gantt-stats"><span className="gantt-stats__item"><span className="gantt-stats__label">Версия</span><span className="gantt-stats__value">{planning.data?.planVersion ?? 0}</span></span><span className="gantt-stats__item"><span className="gantt-stats__label">Задач</span><span className="gantt-stats__value">{planning.data?.authored.tasks.length ?? 0}</span></span><span className="gantt-stats__item"><span className="gantt-stats__label">Предпросмотр</span><span className="gantt-stats__value">{preview ? preview.planDelta.changedTaskIds.length : 0}</span></span></div>
        {preview ? <CardPanel title="Сверка изменения" subtitle="До применения план не меняется"><p className="u-text-body">Будет изменено задач: {preview.planDelta.changedTaskIds.length}. Проверок: {preview.validationIssues.length}.</p></CardPanel> : null}
        {data ? <Gantt data={data} /> : null}
      </StateGate>
      <MutationMessage error={previewMutation.error ?? applyMutation.error} />
    </>
  );
}

function ProjectResourcesRuntime({ id }: { id: string }) {
  const monthIso = currentMonthIso();
  const planning = usePlanning(id);
  const capacity = useCapacitySummary(monthIso);
  const capacityTree = useCapacityTree(monthIso, id);
  const assignedHours = planning.data?.authored.assignments.reduce((sum, assignment) => sum + ((assignment.workMinutes ?? 0) / 60), 0) ?? 0;
  const uniqueResources = new Set(planning.data?.authored.assignments.map((assignment) => assignment.resourceId) ?? []).size;
  return (
    <>
      <PageIntro title={`Ресурсы · ${planning.data?.project.title ?? "Проект"}`} lead="Загрузка строится из назначений и доступности команды: перегрузки видны по людям и задачам." />
      <div className="bento">
        <MetricTile label="Назначено" value={Math.round(assignedHours)} sub="часов в плане" />
        <MetricTile label="Участники" value={uniqueResources} sub="ресурсов с назначениями" />
        <MetricTile label="Перегрузка" value={capacityCount(capacity.data)} sub="сотрудников в зоне риска" danger={capacityCount(capacity.data) > 0} />
        <MetricTile label="Перегруз, ч" value={Math.round((capacity.data?.totalOverloadMinutes ?? 0) / 60)} sub="по общей загрузке" danger={(capacity.data?.totalOverloadMinutes ?? 0) > 0} />
      </div>
      <div className="entity-grid">
        <div className="entity-grid__main">
          <CardPanel title="Назначения проекта" subtitle="По задачам текущего плана" flush>
            <StateGate state={planning} empty="Назначений пока нет.">
              {planning.data ? <AssignmentsTable planning={planning.data} /> : null}
            </StateGate>
          </CardPanel>
        </div>
        <aside className="entity-grid__aside">
          <CapacityRiskPanel state={capacityTree} />
        </aside>
      </div>
    </>
  );
}

function AssignmentsTable({ planning }: { planning: PlanningReadModel }) {
  const tasksById = new Map(planning.authored.tasks.map((task) => [task.id, task]));
  return (
    <DataTable>
      <thead>
        <tr>
          <th>Задача</th>
          <th>Роль</th>
          <th>Ресурс</th>
          <th>План</th>
        </tr>
      </thead>
      <tbody>
        {planning.authored.assignments.map((assignment, index) => {
          const task = tasksById.get(assignment.taskId);
          return (
            <tr key={assignment.id}>
              <td>{task?.title ?? "Задача без названия"}</td>
              <td>{businessStatus(assignment.role)}</td>
              <td>Ресурс {index + 1}</td>
              <td className="mono">{Math.round((assignment.workMinutes ?? 0) / 60)} ч</td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

function CapacityRiskPanel({ state }: { state: QueryState<CapacityTreeNode | CapacityTreeNode[]> }) {
  const employees = flattenCapacityNodes(state.data).filter((node) => node.type === "employee");
  const overloaded = employees
    .map((node) => ({ node, overloadMinutes: node.days.reduce((sum, day) => sum + day.overloadMinutes, 0) }))
    .filter((item) => item.overloadMinutes > 0)
    .sort((left, right) => right.overloadMinutes - left.overloadMinutes)
    .slice(0, 5);
  return (
    <CardPanel title="Риски загрузки" subtitle="По проекту и участникам">
      <StateGate state={state} empty="Данных загрузки нет.">
        {overloaded.length > 0 ? (
          <ul className="link-list">
            {overloaded.map(({ node, overloadMinutes }) => <li key={node.id}>{node.name} · перегруз {Math.round(overloadMinutes / 60)} ч</li>)}
          </ul>
        ) : (
          <p className="u-text-sm u-text-muted">Перегрузок по выбранному проекту нет.</p>
        )}
      </StateGate>
    </CardPanel>
  );
}

function AdminRuntime({ section }: { section: "users" | "roles" | "audit" }) {
  const users = useWorkspaceUsers();
  const roles = useAccessProfiles();
  const audit = useAuditEvents(12);
  const title = section === "roles" ? "Роли" : section === "audit" ? "Аудит" : "Пользователи";
  const lead = section === "roles" ? "Профили доступа доступны для просмотра; изменение ролей отключено до отдельного сценария." : section === "audit" ? "Журнал управленческих действий и системных событий." : "Состав команды и рабочие статусы пользователей.";
  return (
    <>
      <PageIntro title={title} lead={lead} />
      {section === "roles" ? <RolesPanel state={roles} /> : null}
      {section === "audit" ? <AuditPanel state={audit} /> : null}
      {section === "users" ? <UsersTable state={users} /> : null}
    </>
  );
}

function SettingsRuntime() {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => apiFetch<AuthMe>("/api/auth/me") });
  return <><PageIntro title="Настройки рабочей области" lead="Профиль, права и состояние текущей сессии." /><StateGate state={me} empty="Профиль не найден.">{me.data ? <EntityCards title="Профиль" description={`${me.data.user.name} · ${me.data.user.email ?? "без email"}. Разрешений: ${me.data.permissions.length}.`} aside={<FactList facts={[["Рабочая область", "Текущая"], ["Права", String(me.data.permissions.length)]]} />} /> : null}</StateGate></>;
}

function RuntimeLogin() {
  const [email, setEmail] = useState("admin@kiss-pm.local");
  const [password, setPassword] = useState("admin12345");
  const queryClient = useQueryClient();
  const router = useRouter();
  const login = useMutation({ mutationFn: () => apiFetch("/api/auth/login", { method: "POST", json: { email, password } }), onSuccess: async () => { await queryClient.invalidateQueries(); router.push("/dashboard"); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); login.mutate(); }
  return (
    <div className="app-canvas login-screen"><div className="app-canvas__panel app-canvas__panel--bare"><main className="login-screen__main"><form className="login-card" noValidate onSubmit={submit}><div className="login-card__brand"><span className="login-card__brand-mark" aria-hidden>К</span><div className="login-card__brand-text"><span className="login-card__brand-title">KISS PM</span><span className="login-card__brand-meta">Вход в рабочее пространство</span></div></div><h1 className="login-card__title">Войти</h1><p className="login-card__lead">Корпоративный email и пароль рабочей области.</p><div className="login-card__form"><Field label="Email" required htmlFor="login-email"><Input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Field><Field label="Пароль" required htmlFor="login-password"><Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></Field></div><div className="login-card__foot"><Button variant="primary" type="submit" className="w-full" disabled={login.isPending}>Войти</Button>{login.error ? <p className="u-text-sm u-text-muted">{errorMessage(login.error)}</p> : null}</div></form></main></div></div>
  );
}

function ChromeState({ title, lead }: { title: string; lead: string }) { return <WorkspaceChrome meta={{ breadcrumb: [{ label: title, current: true }], activeNav: "Дашборд" }}><PageIntro title={title} lead={lead} /></WorkspaceChrome>; }
function StateGate<T>({ state, empty, children }: { state: QueryState<T>; empty: string; children: ReactNode }) { if (state.isLoading) return <p className="u-text-sm u-text-muted">Загрузка данных…</p>; if (state.error) return <p className="u-text-sm u-text-muted">{errorMessage(state.error)}</p>; if (!state.data) return <p className="u-text-sm u-text-muted">{empty}</p>; return <>{children}</>; }
function MetricTile({ label, value, sub, danger }: { label: string; value: number | string; sub: string; danger?: boolean }) { return <div className="bento__cell tile"><div className="tile__head"><span className="tile__label">{label}</span><span className={danger ? "tile__icon tile__icon--danger" : "tile__icon tile__icon--accent"} /></div><div className="tile__value">{value}</div><div className="tile__sub">{sub}</div></div>; }

function TaskKanban({ tasks, statuses, auth }: { tasks: Task[]; statuses: TaskStatus[]; auth: AuthMe }) {
  const groups = [["new", "Бэклог"], ["in_progress", "В работе"], ["review", "Проверка"], ["done", "Готово"]] as const;
  return <KanbanBoard>{groups.map(([category, title]) => {
    const items = tasks.filter((task) => task.statusCategory === category);
    return <KanbanColumn key={category} title={title} count={items.length}>{items.length === 0 ? <p className="u-text-xs u-text-muted">Нет задач</p> : items.map((task, index) => <KanbanCard key={task.id} id={`Задача ${index + 1}`} title={task.title} priority={priorityLevel(task.priority)} priorityLabel={businessStatus(task.priority)} meta={[{ label: `Срок: ${formatDate(task.plannedFinish)}` }, { label: task.statusName }]} assignees={[{ initials: "ИИ", color: "c1" }]} date={formatDate(task.plannedFinish)} foot={<TaskAdvanceButton task={task} statuses={statuses} auth={auth} />}/>)}</KanbanColumn>;
  })}</KanbanBoard>;
}
function TaskTable({ tasks, statuses, actorId, auth, compactActions = false }: { tasks: Task[]; statuses: TaskStatus[]; actorId?: string | undefined; auth: AuthMe; compactActions?: boolean }) {
  return (
    <DataTable>
      <thead><tr><th>Задача</th><th>Срок</th><th>Статус</th><th>Прогресс</th><th>Действие</th></tr></thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td><CellStack title={task.title} subtitle={task.description ?? "Без описания"} /></td>
            <td className="mono cell-muted">{formatDate(task.plannedFinish)}</td>
            <td><Chip variant={task.statusCategory === "waiting" ? "warning" : "info"}>{task.statusName}</Chip></td>
            <td className="mono">{task.progress}%</td>
            <td className="cell-actions">
              <TaskAdvanceButton task={task} statuses={statuses} auth={auth} />
              {compactActions ? null : <TaskCommentForm task={task} actorId={actorId} statuses={statuses} auth={auth} />}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function TaskAdvanceButton({ task, statuses, auth }: { task: Task; statuses: TaskStatus[]; auth: AuthMe }) {
  const queryClient = useQueryClient();
  const next = nextStatus(statuses, task);
  const reason = disabledReason(auth, PERMISSIONS.editTasks);
  const mutation = useMutation({
    mutationFn: () => {
      if (reason) throw new Error(reason);
      if (!next) throw new Error("Нет доступного перехода");
      return apiFetch(`/api/workspace/projects/${task.projectId}/tasks/${task.id}/status`, { method: "PATCH", json: { statusId: next.id } });
    },
    onSuccess: async () => {
      toast.success("Статус задачи сохранён");
      await queryClient.invalidateQueries();
    }
  });
  return <span><Button variant="secondary" size="sm" disabled={Boolean(reason) || !next || mutation.isPending} title={reason ?? undefined} onClick={() => mutation.mutate()}>{next ? `В ${next.name}` : "Финал"}</Button><DisabledReason reason={reason} /></span>;
}

function TaskCommentForm({ task, actorId, statuses, auth }: { task: Task; actorId?: string | undefined; statuses: TaskStatus[]; auth: AuthMe }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const waiting = statuses.find((status) => status.category === "waiting" && status.status !== "archived");
  const reason = disabledReason(auth, PERMISSIONS.editTasks);
  const comment = useMutation({
    mutationFn: async (markBlocked: boolean) => {
      const trimmed = body.trim();
      if (reason) throw new Error(reason);
      if (!trimmed) throw new Error("Введите комментарий");
      await apiFetch(`/api/workspace/tasks/${task.id}/comments`, { method: "POST", json: { body: markBlocked ? `Блокер: ${trimmed}` : trimmed } });
      if (markBlocked && waiting && task.statusId !== waiting.id) {
        await apiFetch(`/api/workspace/projects/${task.projectId}/tasks/${task.id}/status`, { method: "PATCH", json: { statusId: waiting.id } });
      }
    },
    onSuccess: async (_, markBlocked) => {
      toast.success(markBlocked ? "Блокер зафиксирован" : "Комментарий сохранён");
      setBody("");
      await queryClient.invalidateQueries();
    }
  });
  return (
    <form className="u-flex u-items-center u-gap-2" onSubmit={(event: FormEvent) => { event.preventDefault(); comment.mutate(false); }}>
      <Input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Комментарий" aria-label={`Комментарий к задаче ${task.title}`} disabled={Boolean(reason)} title={reason ?? undefined} />
      <Button variant="secondary" size="sm" disabled={Boolean(reason) || comment.isPending || !actorId} title={reason ?? undefined} type="submit">Сохранить</Button>
      <Button variant="secondary" size="sm" disabled={Boolean(reason) || comment.isPending || !actorId || !waiting} title={reason ?? undefined} type="button" onClick={() => comment.mutate(true)}>Блокер</Button>
      <DisabledReason reason={reason} />
    </form>
  );
}

function CreateTaskPanel({ projectId, actorId, defaultStatusId, auth }: { projectId: string; actorId: string; defaultStatusId?: string | undefined; auth: AuthMe }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const reason = disabledReason(auth, PERMISSIONS.createTasks);
  const createTask = useMutation({
    mutationFn: () => {
      const trimmed = title.trim();
      if (reason) throw new Error(reason);
      if (!trimmed) throw new Error("Введите название задачи");
      return apiFetch(`/api/workspace/projects/${projectId}/tasks`, {
        method: "POST",
        json: {
          title: trimmed,
          description: "Создано из карточки проекта.",
          priority: "normal",
          statusId: defaultStatusId,
          plannedStart: today,
          plannedFinish: tomorrow,
          durationWorkingDays: 1,
          plannedWork: 8,
          requiresAcceptance: false,
          participants: [{ userId: actorId, role: "executor" }]
        }
      });
    },
    onSuccess: async () => {
      toast.success("Задача создана");
      setTitle("");
      await queryClient.invalidateQueries();
    }
  });
  return (
    <CardPanel title="Новая задача" subtitle="Минимальный рабочий сценарий с владельцем и сроком">
      <form className="u-flex u-items-center u-gap-2" onSubmit={(event: FormEvent) => { event.preventDefault(); createTask.mutate(); }}>
        <Field label="Название задачи" htmlFor="runtime-task-title">
          <Input id="runtime-task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: согласовать план работ" disabled={Boolean(reason)} title={reason ?? undefined} />
        </Field>
        <Button variant="primary" disabled={Boolean(reason) || createTask.isPending || !defaultStatusId} title={reason ?? undefined} type="submit">Создать</Button>
      </form>
      <DisabledReason reason={reason} />
      <MutationMessage error={createTask.error} />
    </CardPanel>
  );
}

function DealsFunnel({ deals, stages }: { deals: Opportunity[]; stages: DealStage[] }) { return <div className="funnel">{stages.map((stage) => <div key={stage.id} className="funnel__col"><div className="funnel__head"><span className="funnel__title">{stage.name}</span><span className="badge badge--secondary">{deals.filter((deal) => deal.stageId === stage.id).length}</span></div><div className="funnel__body">{deals.filter((deal) => deal.stageId === stage.id).map((deal) => <article key={deal.id} className="deal-card"><div className="deal-card__head"><span className="deal-card__id mono">{stage.name}</span><BemAvatar initials="ИИ" color="c1" size="sm" /></div><h3 className="deal-card__title"><Link href={`/deals/${deal.id}`}>{deal.title}</Link></h3><p className="deal-card__client">{deal.clientName}</p><div className="deal-card__foot"><Chip variant="info">{stage.name}</Chip><span className="mono u-text-xs u-text-strong">{money(deal.contractValue)}</span></div></article>)}</div></div>)}</div>; }
function DealsTable({ deals, stages, auth }: { deals: Opportunity[]; stages: DealStage[]; auth: AuthMe }) { return <DataTable className="u-mt-4"><thead><tr><th>Сделка</th><th>Клиент</th><th>Стадия</th><th>Сумма</th><th>Действие</th></tr></thead><tbody>{deals.map((deal) => <tr key={deal.id}><td><CellStack title={deal.title} subtitle={deal.contactName ?? "Контакт не указан"} /></td><td>{deal.clientName}</td><td><Chip variant="info">{stageName(stages, deal.stageId)}</Chip></td><td className="mono">{money(deal.contractValue)}</td><td><DealAdvanceButton deal={deal} stages={stages} auth={auth} /></td></tr>)}</tbody></DataTable>; }
function DealAdvanceButton({ deal, stages, auth }: { deal: Opportunity; stages: DealStage[]; auth: AuthMe }) { const queryClient = useQueryClient(); const next = nextStage(stages, deal.stageId); const reason = disabledReason(auth, PERMISSIONS.manageOpportunities); const mutation = useMutation({ mutationFn: () => { if (reason) throw new Error(reason); return apiFetch(`/api/workspace/opportunities/${deal.id}/stage`, { method: "PATCH", json: { stageId: next?.id } }); }, onSuccess: async () => { toast.success("Стадия сделки сохранена"); await queryClient.invalidateQueries(); } }); return <span><Button variant="secondary" size="sm" disabled={Boolean(reason) || !next || mutation.isPending} title={reason ?? undefined} onClick={() => mutation.mutate()}>{next ? `В ${next.name}` : "Финал"}</Button><DisabledReason reason={reason} /></span>; }
function ForecastPanel({ deals }: { deals: Opportunity[] }) { const total = deals.reduce((sum, deal) => sum + deal.contractValue * (deal.probability / 100), 0); return <CardPanel title="Прогноз продаж" subtitle="Расчёт по вероятности сделок"><div className="tile__value">{money(total)}</div><p className="u-text-sm u-text-muted">Прогноз считается из текущей воронки.</p></CardPanel>; }

function ProjectsTable({ projects }: { projects: Project[] }) { return <DataTable><thead><tr><th>Название</th><th>Клиент</th><th>Ответственный</th><th>Статус</th><th>Срок</th><th /></tr></thead><tbody>{projects.map((project, index) => <tr key={project.id} className={index === 0 ? "is-selected" : undefined}><td><CellStack title={project.title} subtitle={dateRange(project.plannedStart, project.plannedFinish)} icon={<Folder className="size-4" aria-hidden />} /></td><td>{project.clientName}</td><td><BemAvatar initials="ИИ" color="c1" /> Иванова М.</td><td><Chip variant="info">{businessStatus(project.status)}</Chip></td><td className="mono cell-muted">{formatDate(project.plannedFinish)}</td><td className="cell-actions"><Button variant="ghost" size="icon-sm" aria-label="Открыть проект" asChild><Link href={`/projects/${project.id}`}><MoreHorizontal className="size-4" /></Link></Button></td></tr>)}</tbody></DataTable>; }
function TasksPanel({ state, tasks, statuses, auth }: { state: QueryState<{ tasks: Task[] }>; tasks: Task[]; statuses: TaskStatus[]; auth: AuthMe }) {
  return <CardPanel title="Ближайшие задачи" subtitle={`${tasks.length} задач`} flush actions={<Button variant="ghost" size="sm" asChild><Link href="/my-work">Вся работа</Link></Button>}><StateGate state={state} empty="Задач нет."><TaskTable tasks={tasks} statuses={statuses} auth={auth} compactActions /></StateGate></CardPanel>;
}
function AuditPanel({ state }: { state: QueryState<{ auditEvents: AuditEvent[] }> }) {
  return <CardPanel title="Журнал" subtitle="Последние события" flush><StateGate state={state} empty="Событий нет."><ul className="feed">{(state.data?.auditEvents ?? []).map((event) => <li key={event.id} className="feed__item"><BemAvatar initials="А" color="c4" size="sm" /><div><div className="feed__head"><strong className="u-text-body u-text-strong">{businessStatus(event.actionType)}</strong><span className="u-text-xs u-text-muted">{formatDate(event.createdAt)}</span></div><p className="u-text-body">{auditResultLabel(event)}</p></div></li>)}</ul></StateGate></CardPanel>;
}
function EntityCards({ title, description, aside }: { title: string; description: string; aside: ReactNode }) { return <div className="entity-grid"><div className="entity-grid__main"><CardPanel title={title} subtitle="Контекст для команды"><p className="u-text-body">{description}</p></CardPanel></div><aside className="entity-grid__aside"><CardPanel title="Параметры" subtitle="Свойства сущности">{aside}</CardPanel></aside></div>; }
function FactList({ facts }: { facts: Array<[string, string]> }) { return <dl className="u-stack-2">{facts.map(([label, value]) => <div key={label}><dt className="u-text-xs u-text-muted">{label}</dt><dd className="u-text-body u-text-strong">{value}</dd></div>)}</dl>; }
function UsersTable({ state }: { state: QueryState<{ users: RuntimeUser[] }> }) { return <CardPanel title="Пользователи" subtitle="Команда рабочей области" flush><StateGate state={state} empty="Пользователей нет."><DataTable><thead><tr><th>Имя</th><th>Email</th><th>Должность</th><th>Статус</th></tr></thead><tbody>{(state.data?.users ?? []).map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email ?? "—"}</td><td>{user.positionName ?? "—"}</td><td><Chip variant="info">{businessStatus(user.status ?? "active")}</Chip></td></tr>)}</tbody></DataTable></StateGate></CardPanel>; }
function RolesPanel({ state }: { state: QueryState<{ accessProfiles: AccessProfile[] }> }) { return <CardPanel title="Роли" subtitle="Профили доступа"><StateGate state={state} empty="Ролей нет."><ul className="link-list">{(state.data?.accessProfiles ?? []).map((role) => <li key={role.id}>{role.name} · {role.permissions.length} прав</li>)}</ul></StateGate></CardPanel>; }
function MutationMessage({ error }: { error: Error | null }) { return error ? <p className="u-text-sm u-text-muted u-mt-3">{errorMessage(error)}</p> : null; }
function can(auth: AuthMe, permission: Permission) { return auth.permissions.includes(permission); }
function disabledReason(auth: AuthMe, permission: Permission) { return can(auth, permission) ? null : "Недостаточно прав для этого действия."; }
function DisabledReason({ reason }: { reason: string | null }) { return reason ? <p className="u-text-xs u-text-muted">{reason}</p> : null; }

function useOpportunities() { return useQuery({ queryKey: ["opportunities"], queryFn: () => apiFetch<{ opportunities: Opportunity[] }>("/api/workspace/opportunities") }); }
function useDealStages() { return useQuery({ queryKey: ["deal-stages"], queryFn: () => apiFetch<{ dealStages: DealStage[] }>("/api/workspace/deal-stages") }); }
function useCapacityTree(monthIso: string, projectId: string) { return useQuery({ queryKey: ["capacity-tree", monthIso, projectId], queryFn: () => apiFetch<CapacityTreeNode | CapacityTreeNode[]>(`/api/workspace/capacity/tree?monthIso=${monthIso}&projectId=${projectId}`) }); }
function useProjects() { return useQuery({ queryKey: ["projects"], queryFn: () => apiFetch<{ projects: Project[] }>("/api/workspace/projects") }); }
function runtimeScreenMeta(id: RuntimeScreenId) {
  if (id === "11-agent") return { breadcrumb: [{ label: "Агент", current: true }], activeNav: "Агент" };
  const meta = SCREEN_META[id as ScreenId];
  if (id === "01-dashboard") return { ...meta, activeNav: "Дашборд" };
  if (id === "02-my-work") return { ...meta, activeNav: "Моя работа" };
  if (id === "05-deals") return { ...meta, activeNav: "Сделки" };
  if (id === "06-deal-card") return { ...meta, activeNav: "Сделки", breadcrumb: [{ label: "Сделки", href: "/deals" }, { label: "Карточка", current: true }] };
  if (id === "07-projects-list") return { ...meta, activeNav: "Проекты" };
  if (id === "07b-project-detail") return { ...meta, activeNav: "Проекты", breadcrumb: [{ label: "Проекты", href: "/projects" }, { label: "Карточка", current: true }] };
  if (id === "12-project-gantt") return { ...meta, activeNav: "Проекты", breadcrumb: [{ label: "Проекты", href: "/projects" }, { label: "План-график", current: true }] };
  if (id === "13-project-resources") return { ...meta, activeNav: "Проекты", breadcrumb: [{ label: "Проекты", href: "/projects" }, { label: "Ресурсы", current: true }] };
  if (id === "09-admin") return { ...meta, activeNav: "Пользователи", breadcrumb: [{ label: "Администрирование" }, { label: "Пользователи", current: true }] };
  return { ...meta, activeNav: "Рабочая область" };
}

function useProject(id: string) { return useQuery({ queryKey: ["project", id], queryFn: () => apiFetch<{ project: Project; tasks: Task[] }>(`/api/workspace/projects/${id}`) }); }
function useMyWork() { return useQuery({ queryKey: ["my-work"], queryFn: () => apiFetch<{ tasks: Task[] }>("/api/workspace/my-work") }); }
function useTaskStatuses() { return useQuery({ queryKey: ["task-statuses"], queryFn: () => apiFetch<{ taskStatuses: TaskStatus[] }>("/api/workspace/task-statuses") }); }
function usePlanning(id: string) { return useQuery({ queryKey: ["planning", id], queryFn: () => apiFetch<PlanningReadModel>(`/api/workspace/projects/${id}/planning/read-model`) }); }
function useWorkspaceUsers() { return useQuery({ queryKey: ["workspace-users"], queryFn: () => apiFetch<{ users: RuntimeUser[] }>("/api/workspace/users") }); }
function useAccessProfiles() { return useQuery({ queryKey: ["access-profiles"], queryFn: () => apiFetch<{ accessProfiles: AccessProfile[] }>("/api/tenant/current/access-profiles") }); }
function useAuditEvents(limit: number) { return useQuery({ queryKey: ["audit-events", limit], queryFn: () => apiFetch<{ auditEvents: AuditEvent[] }>(`/api/tenant/current/audit-events?limit=${limit}`) }); }
function useCapacitySummary(monthIso: string) { return useQuery({ queryKey: ["capacity-summary", monthIso], queryFn: () => apiFetch<CapacitySummary>(`/api/workspace/capacity/summary?monthIso=${monthIso}`) }); }

function isUnauthorized(error: unknown) { return error instanceof ApiError && error.status === 401; }
function auditResultLabel(event: AuditEvent) {
  const status = String(event.executionResult?.status ?? "");
  if (status === "succeeded" || status === "success") return "Успешно";
  if (status === "failed" || status === "error") return "Ошибка";
  if (status === "denied") return "Отклонено правами";
  return "Записано в журнал";
}
function flattenCapacityNodes(input: CapacityTreeNode | CapacityTreeNode[] | undefined): CapacityTreeNode[] {
  const roots = Array.isArray(input) ? input : input ? [input] : [];
  const result: CapacityTreeNode[] = [];
  const visit = (node: CapacityTreeNode) => {
    result.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  for (const root of roots) visit(root);
  return result;
}
function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
function addOneDayIso(value: string | null) {
  if (!value) return null;
  return isoDate(addDays(new Date(value), 1));
}
function nextScheduleCommand(model: PlanningReadModel) {
  const task = model.authored.tasks.find((item) => item.plannedStart && item.plannedFinish);
  if (!task) return null;
  return {
    type: "task.update_schedule" as const,
    payload: {
      taskId: task.id,
      plannedStart: task.plannedStart,
      plannedFinish: addOneDayIso(task.plannedFinish)
    }
  };
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Неизвестная ошибка"; }
function firstName(name: string) { return name.split(/\s+/)[0] ?? name; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "PM"; }
function isOverdue(task: Task) { return task.statusCategory !== "done" && new Date(task.plannedFinish).getTime() < Date.now(); }
function stageName(stages: DealStage[], id: string | null) { return stages.find((stage) => stage.id === id)?.name ?? "Не указана"; }
function nextStage(stages: DealStage[], current: string | null) { const ordered = [...stages].sort((left, right) => left.sortOrder - right.sortOrder); const index = ordered.findIndex((stage) => stage.id === current); return ordered[index + 1] ?? null; }
function nextStatus(statuses: TaskStatus[], task: Task) { const active = statuses.filter((status) => status.status !== "archived").sort((left, right) => left.sortOrder - right.sortOrder); const index = active.findIndex((status) => status.id === task.statusId || status.category === task.statusCategory); return active[index + 1] ?? null; }
function dateRange(start: string, finish: string) { return `${formatDate(start)} — ${formatDate(finish)}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value)); }
function money(value: number) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value); }
function priorityLevel(priority: string): "low" | "normal" | "high" | "urgent" { if (priority === "critical") return "urgent"; if (priority === "high") return "high"; if (priority === "low") return "low"; return "normal"; }
function businessStatus(value: string) {
  const labels: Record<string, string> = {
    active: "Активен",
    archived: "В архиве",
    critical: "Срочно",
    high: "Высокий",
    normal: "Обычный",
    low: "Низкий",
    executor: "Исполнитель",
    co_executor: "Соисполнитель",
    requester: "Заказчик",
    controller: "Контролёр",
    approver: "Согласующий",
    observer: "Наблюдатель",
    recorded: "Записано",
    task_status_changed: "Статус задачи изменён",
    "task.status_changed": "Статус задачи изменён",
    "opportunity.stage_changed": "Стадия сделки изменена",
    "opportunity.feasibility_checked": "Проверка реализуемости",
    "opportunity.activated": "Проект активирован"
  };
  return labels[value] ?? value.replace(/[._-]+/g, " ");
}
function currentMonthIso() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; }
function capacityCount(summary: CapacitySummary | undefined) { return summary?.overloadUserCount ?? summary?.overloadedEmployeeCount ?? summary?.overloadedEmployees ?? 0; }
function toGanttData(model: PlanningReadModel): GanttData { const base = new Date(model.project.plannedStart); const days = Array.from({ length: 30 }, (_, index) => { const day = new Date(base); day.setDate(base.getDate() + index); const weekdayShort = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(day).slice(0, 2); return { day: day.getDate(), weekdayShort, weekend: day.getDay() === 0 || day.getDay() === 6, today: index === 0 }; }); return { monthLabel: new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(base), days, rows: model.authored.tasks.map((task, index) => { const start = task.plannedStart ? Math.max(0, Math.round((new Date(task.plannedStart).getTime() - base.getTime()) / 86_400_000)) : 0; const finish = task.plannedFinish ? Math.max(start + 1, Math.round((new Date(task.plannedFinish).getTime() - base.getTime()) / 86_400_000) + 1) : start + 1; return { id: task.id, level: 0, kind: "task", name: task.title, wbs: String(index + 1), startDay: start, durationDays: Math.max(1, finish - start), progress: 0.4, assignee: { initials: "ИИ", color: "c1" } }; }) }; }
