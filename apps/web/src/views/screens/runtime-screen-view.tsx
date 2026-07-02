"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Calendar, ChevronDown, ChevronUp, Clock, Filter, Folder, Inbox, Link2, MoreHorizontal, Plus, Trash2, Unlink, Users } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { Field } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppPreloader, FeedSkeleton, TableSkeleton } from "@/components/ui/loaders";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { ApiError, apiFetch } from "@/lib/api";
import { KanbanBoard, KanbanColumn } from "@/widgets/kanban/kanban-board";
import { KanbanCard } from "@/widgets/kanban/kanban-card";
import { Gantt, applyCollapse } from "@/widgets/gantt";
import { nextTaskStatus, type TaskStatusCategory } from "@/lib/task-status";
import { useCollapsedIds } from "@/lib/use-collapsed-ids";
import type { GanttData, GanttRow } from "@/widgets/gantt";
import { ResourceMatrix, ResourceMatrixLegend, ResourceMatrixStats } from "@/widgets/resource-matrix";
import type { DayCell, DayHeader, MatrixPercent, MatrixRow, ResourceMatrixData } from "@/widgets/resource-matrix";
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
type PlanningTask = { id: string; title: string; statusId: string; parentTaskId?: string | null; plannedStart: string | null; plannedFinish: string | null; durationMinutes?: number | null; workMinutes?: number | null; percentComplete?: number | null; schedulingMode?: string | null; taskType?: string | null; wbsCode?: string | null };
type PlanningReadModel = {
  project: { id: string; title: string; plannedStart: string; plannedFinish: string };
  resources: Array<{ id: string; name: string }>;
  // API (createPlanningReadModel) отдаёт куда больше, чем web потреблял — ниже только поля, которые реально читаем.
  authored: { tasks: PlanningTask[]; dependencies?: Array<{ id: string; predecessorTaskId: string; successorTaskId: string; type: string }>; baselines?: Array<{ id: string; capturedAt: string }>; assignments: Array<{ id: string; taskId: string; resourceId: string; role: string; workMinutes: number | null }> };
  calculatedPlan?: { criticalPathTaskIds?: string[]; tasks?: Array<{ id: string; totalSlackMinutes?: number | null }> };
  planVersion: number;
};
type PlanningPreview = { planDelta: { changedTaskIds: string[]; changedAssignmentIds: string[]; changedDependencyIds: string[] }; validationIssues: Array<{ code: string; message: string; severity: string }> };
type AccessProfile = { id: string; name: string; permissions: string[] };
type CapacitySummary = { overloadUserCount?: number; overloadedEmployeeCount?: number; overloadedEmployees?: number; totalWorkMinutes?: number; totalPlannedMinutes?: number; totalCapacityMinutes?: number; totalOverloadMinutes?: number; monthIso?: string };
// Реальная форма /capacity/tree (hierarchyMode "org"): direction → unit → position → employee, богатые дневные ячейки.
type CapacityDayCell = { date: string; workMinutes: number; capacityMinutes: number; freeMinutes: number; overloadMinutes: number; isWeekend: boolean; isHoliday: boolean; hasAbsence: boolean; isFreeDay: boolean; isException: boolean; isOverload: boolean; heat: number };
type CapacityEmployeeRow = { user: { id: string; name: string; positionName?: string | null }; days: CapacityDayCell[] };
type CapacityPosition = { position: { id: string; name: string }; rows: CapacityEmployeeRow[]; positionDays: CapacityDayCell[] };
type CapacityUnit = { unit: { id: string; name: string }; unitDays: CapacityDayCell[]; positions: CapacityPosition[] };
type CapacityOrgGroup = { direction: { id: string; name: string }; directionDays: CapacityDayCell[]; units: CapacityUnit[] };
type CapacityTree = { monthIso: string; hierarchyMode: string; days: Array<{ date: string; isoWeekday: number; isWeekend: boolean; isHoliday: boolean }>; orgGroups: CapacityOrgGroup[]; unassignedRows?: CapacityEmployeeRow[] };

type QueryState<T> = { data: T | undefined; isLoading: boolean; error: Error | null; refetch?: () => unknown };

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

  if (me.isLoading) return <AppPreloader />;
  if (isUnauthorized(me.error)) return <RuntimeLogin />;
  if (me.error || !me.data) return <ChromeState title="Не удалось открыть рабочую область" lead={errorMessage(me.error)} />;

  const meta = runtimeScreenMeta(id);
  return (
    <WorkspaceChrome
      meta={meta}
      user={{ name: me.data.user.name, initials: initials(me.data.user.name), color: "c4", ...(me.data.user.email ? { email: me.data.user.email } : {}) }}
    >
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
  if (id === "13-project-resources") return entityId ? <ProjectResourcesRuntime id={entityId} me={me} /> : <MissingRouteContext entity="проекта" />;
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
        <MetricTile label="Активные проекты" value={activeProjects.length} sub="в работе" feature icon={<Folder />} href="/projects" />
        <MetricTile label="Просрочено" value={overdueTasks.length} sub="задач требуют решения" danger={overdueTasks.length > 0} icon={<Clock />} href="/my-work" />
        <MetricTile label="Блокеры" value={blockedTasks.length} sub="задач в ожидании" danger={blockedTasks.length > 0} icon={<Ban />} href="/my-work" />
        <MetricTile label="Перегрузка" value={capacityCount(capacity.data)} sub="людей в зоне риска" danger={capacityCount(capacity.data) > 0} icon={<Users />} href="/projects" />
        <div className="bento__cell bento__cell--8">
          <CardPanel title="Требует внимания" subtitle="Просрочки и блокеры из текущих задач" flush>
            <StateGate state={myWork} empty="Срочных задач нет." skeleton={<TableSkeleton columns={4} rows={4} />}>
              {attentionTasks.length > 0 ? <TaskTable tasks={attentionTasks} statuses={statuses.data?.taskStatuses ?? []} auth={me} compactActions /> : <p className="u-text-sm u-text-muted">Сейчас нет просрочек или блокеров.</p>}
            </StateGate>
          </CardPanel>
        </div>
        <div className="bento__cell bento__cell--4">
          <CardPanel title="Следующее управленческое действие" subtitle="Не декоративная кнопка — переход в рабочий контур">
            <div className="flex flex-col items-start gap-[var(--space-3)]">
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
      <StateGate state={myWork} empty="Назначенных задач нет." skeleton={<TableSkeleton columns={5} rows={6} />} isEmpty={(d) => d.tasks.length === 0}>
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
      <StateGate state={deals} empty="Сделок пока нет." skeleton={<TableSkeleton columns={5} rows={6} />} isEmpty={(d) => d.opportunities.length === 0}>
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
  const [confirmActivate, setConfirmActivate] = useState(false);
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
      setConfirmActivate(false);
      router.push(`/projects/${payload.project.id}`);
    }
  });
  const item = deal.data?.opportunity;
  return (
    <>
      <PageIntro
        title={item?.title ?? "Карточка сделки"}
        lead={item ? `${item.clientName} · ${dateRange(item.plannedStart, item.plannedFinish)}` : "Загружаем сделку"}
        actions={
          <>
            <Button variant="secondary" onClick={() => feasibility.mutate()} disabled={Boolean(feasibilityReason) || feasibility.isPending} title={feasibilityReason ?? undefined}>Проверить реализуемость</Button>
            <Dialog open={confirmActivate} onOpenChange={setConfirmActivate}>
              <DialogTrigger asChild>
                <Button variant="primary" disabled={Boolean(activateReason) || activate.isPending} title={activateReason ?? undefined}>Активировать проект</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Активировать проект?</DialogTitle>
                  <DialogDescription>
                    Сделка{item ? ` «${item.title}»` : ""} станет проектом. Действие необратимо — вернуть запись в воронку нельзя.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setConfirmActivate(false)} disabled={activate.isPending}>Отмена</Button>
                  <Button variant="primary" onClick={() => activate.mutate()} disabled={activate.isPending}>Активировать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
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
      <StateGate state={projects} empty="Активных проектов пока нет." skeleton={<TableSkeleton columns={5} rows={6} />} isEmpty={(d) => d.projects.length === 0}>
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

type PlanCommand = { type: string; payload: Record<string, unknown> };
const DEP_TYPES = [["FS", "Оконч.→Начало"], ["SS", "Начало→Начало"], ["FF", "Оконч.→Оконч."], ["SF", "Начало→Оконч."]] as const;
function isSummaryTask(taskId: string, tasks: PlanningTask[]) { return tasks.some((task) => task.parentTaskId === taskId); }
function orderedGanttSiblings(parentId: string | null, tasks: PlanningTask[]) { return tasks.filter((task) => (task.parentTaskId ?? null) === parentId).sort((left, right) => compareWbs(left.wbsCode ?? "", right.wbsCode ?? "")); }
function indentCommand(task: PlanningTask, tasks: PlanningTask[]): PlanCommand | null {
  const siblings = orderedGanttSiblings(task.parentTaskId ?? null, tasks);
  const prev = siblings[siblings.findIndex((sibling) => sibling.id === task.id) - 1];
  if (!prev) return null;
  return { type: "task.move_wbs", payload: { taskId: task.id, parentTaskId: prev.id, sortOrder: orderedGanttSiblings(prev.id, tasks).length } };
}
function outdentCommand(task: PlanningTask, tasks: PlanningTask[]): PlanCommand | null {
  const parentId = task.parentTaskId ?? null;
  if (parentId === null) return null;
  const grandParentId = tasks.find((candidate) => candidate.id === parentId)?.parentTaskId ?? null;
  const parentIndex = orderedGanttSiblings(grandParentId, tasks).findIndex((sibling) => sibling.id === parentId);
  return { type: "task.move_wbs", payload: { taskId: task.id, parentTaskId: grandParentId, sortOrder: parentIndex + 1 } };
}

function ProjectGanttRuntime({ id, me }: { id: string; me: AuthMe }) {
  const planning = usePlanning(id);
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<PlanningPreview | null>(null);
  // ponytail: zoom презентационный — виджет рисует фиксированную дневную сетку (как и Storybook-Гант). Ceiling: настоящая зум-гранулярность, если виджет начнёт её учитывать.
  const [zoom, setZoom] = useState<"hour" | "day" | "week" | "month">("day");
  const [showCritical, setShowCritical] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const { collapsedIds, toggleCollapse } = useCollapsedIds();
  const reason = disabledReason(me, PERMISSIONS.manageProjectPlan);
  const data = useMemo(() => (planning.data ? toGanttData(planning.data, showCritical) : undefined), [planning.data, showCritical]);
  const shownData = useMemo(() => {
    if (!data) return data;
    const query = filter.trim().toLowerCase();
    const rows = applyCollapse(data.rows, collapsedIds).filter(
      (row) => !query || row.name.toLowerCase().includes(query)
    );
    return { ...data, rows };
  }, [data, filter, collapsedIds]);
  const tasks = planning.data?.authored.tasks ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
  const command = planning.data ? nextScheduleCommand(planning.data) : null;
  const ganttStats = useMemo(() => {
    const allTasks = planning.data?.authored.tasks ?? [];
    const parentIds = new Set(allTasks.map((task) => task.parentTaskId).filter(Boolean));
    const leaves = allTasks.filter((task) => !parentIds.has(task.id) && (task.workMinutes ?? 0) > 0);
    const totalWork = leaves.reduce((sum, task) => sum + (task.workMinutes ?? 0), 0);
    const earned = leaves.reduce((sum, task) => sum + (task.workMinutes ?? 0) * Math.max(0, Math.min(1, (task.percentComplete ?? 0) / 100)), 0);
    return {
      progressPct: totalWork > 0 ? Math.round((earned / totalWork) * 100) : 0,
      taskCount: leaves.length,
      criticalCount: planning.data?.calculatedPlan?.criticalPathTaskIds?.length ?? 0
    };
  }, [planning.data]);
  const toolbarApply = useMutation({
    mutationFn: (cmd: PlanCommand) => {
      if (reason) throw new Error(reason);
      if (!planning.data) throw new Error("План не загружен");
      return apiFetch(`/api/workspace/projects/${id}/planning/apply-command`, { method: "POST", json: { command: cmd, clientPlanVersion: planning.data.planVersion, idempotencyKey: `gantt-${cmd.type}-${planning.data.planVersion}-${Math.random().toString(36).slice(2, 8)}` } });
    },
    onSuccess: async () => { toast.success("План изменён"); setSelectedId(null); await queryClient.invalidateQueries({ queryKey: ["planning", id] }); },
    onError: (error) => toast.error(errorMessage(error))
  });
  // P0-2: drag бара сдвигает плановые даты задачи на N дней и применяет через apply-command.
  const moveTask = (taskId: string, dayDelta: number) => {
    if (dayDelta === 0) return;
    const target = (planning.data?.authored.tasks ?? []).find((task) => task.id === taskId);
    if (!target?.plannedStart || !target.plannedFinish) return;
    toolbarApply.mutate({
      type: "task.update_schedule",
      payload: {
        taskId,
        plannedStart: isoDate(addDays(new Date(target.plannedStart), dayDelta)),
        plannedFinish: isoDate(addDays(new Date(target.plannedFinish), dayDelta))
      }
    });
  };
  // P0-2: растягивание правого края бара меняет длительность (сдвигает plannedFinish, start фикс).
  const resizeTask = (taskId: string, dayDelta: number) => {
    if (dayDelta === 0) return;
    const target = (planning.data?.authored.tasks ?? []).find((task) => task.id === taskId);
    if (!target?.plannedStart || !target.plannedFinish) return;
    const newFinish = isoDate(addDays(new Date(target.plannedFinish), dayDelta));
    if (new Date(newFinish).getTime() <= new Date(target.plannedStart).getTime()) return; // не короче 1 дня
    toolbarApply.mutate({
      type: "task.update_schedule",
      payload: { taskId, plannedStart: target.plannedStart, plannedFinish: newFinish }
    });
  };
  const moveWbs = (direction: "in" | "out") => {
    if (!selectedTask) return;
    const cmd = direction === "in" ? indentCommand(selectedTask, tasks) : outdentCommand(selectedTask, tasks);
    if (!cmd) { toast.error(direction === "in" ? "Нет предыдущей задачи того же уровня" : "Задача уже на верхнем уровне"); return; }
    toolbarApply.mutate(cmd);
  };
  const previewMutation = useMutation({
    mutationFn: () => {
      if (reason) throw new Error(reason);
      if (!planning.data || !command) throw new Error("Нет задачи для предпросмотра");
      return apiFetch<PlanningPreview>(`/api/workspace/projects/${id}/planning/preview-command`, { method: "POST", json: { command, clientPlanVersion: planning.data.planVersion } });
    },
    onSuccess: (payload) => { setPreview(payload); toast.success("Предпросмотр подготовлен"); }
  });
  const applyMutation = useMutation({
    mutationFn: () => {
      if (reason) throw new Error(reason);
      if (!planning.data || !command) throw new Error("Сначала перечитайте план");
      return apiFetch(`/api/workspace/projects/${id}/planning/apply-command`, { method: "POST", json: { command, clientPlanVersion: planning.data.planVersion, idempotencyKey: `runtime-shift-${planning.data.planVersion}-${command.payload.taskId}` } });
    },
    onSuccess: async () => { toast.success("Изменение плана применено"); setPreview(null); await queryClient.invalidateQueries({ queryKey: ["planning", id] }); }
  });
  const selectHint = reason ?? (!selectedTask ? "Выберите задачу в таблице" : undefined);
  const rowOpsDisabled = !selectedTask || Boolean(reason) || toolbarApply.isPending;
  return (
    <>
      <PageIntro
        title={`Гант · ${planning.data?.project.title ?? "Проект"}`}
        lead="План-факт и WBS проекта из текущего плана. Изменение проходит через сверку и применение с версией плана."
        actions={<><Button variant="secondary" disabled={Boolean(reason) || !command || previewMutation.isPending} title={reason ?? undefined} onClick={() => previewMutation.mutate()}>Подготовить сверку</Button><Button variant="primary" disabled={Boolean(reason) || !preview || applyMutation.isPending} title={reason ?? undefined} onClick={() => applyMutation.mutate()}>Применить</Button></>}
      />
      <DisabledReason reason={reason} />
      <StateGate state={planning} empty="План проекта пока пуст.">
        <div className="gantt-toolbar" role="toolbar" aria-label="Действия Ганта">
          <div className="gantt-toolbar__group">
            <GanttAddTaskDialog projectId={id} planning={planning.data} parentTask={selectedTask && isSummaryTask(selectedTask.id, tasks) ? selectedTask : null} reason={reason} />
            <ConfirmIconButton icon={<Trash2 className="size-4" />} label="Удалить" disabled={rowOpsDisabled} title={selectHint} dialogTitle="Архивировать задачу?" dialogBody={selectedTask ? `Задача «${selectedTask.title}» будет перенесена в архив.` : ""} confirmLabel="Архивировать" onConfirm={() => selectedTask && toolbarApply.mutate({ type: "task.delete_or_archive", payload: { taskId: selectedTask.id, mode: "archive" } })} />
          </div>
          <div className="gantt-toolbar__group">
            <Button variant="ghost" size="icon-sm" aria-label="Уровень выше" disabled={rowOpsDisabled} title={selectHint} onClick={() => moveWbs("out")}><ChevronUp className="size-4" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Уровень глубже" disabled={rowOpsDisabled} title={selectHint} onClick={() => moveWbs("in")}><ChevronDown className="size-4" /></Button>
          </div>
          <div className="gantt-toolbar__group">
            <GanttLinkDialog projectId={id} planning={planning.data} reason={reason} />
            <GanttUnlinkDialog projectId={id} planning={planning.data} reason={reason} />
          </div>
          <span className="gantt-toolbar__sep" />
          <Button variant={showCritical ? "primary" : "ghost"} size="sm" aria-pressed={showCritical} onClick={() => setShowCritical((value) => !value)}>крит. путь</Button>
          <GanttBaselineDialog projectId={id} planning={planning.data} reason={reason} />
          <span className="gantt-toolbar__sep" />
          <GanttFilterPopover value={filter} onChange={setFilter} />
          <div className="gantt-toolbar__spacer" />
          <Segmented name="gantt-zoom" value={zoom} onChange={setZoom} options={[{ value: "hour", label: "Час" }, { value: "day", label: "День" }, { value: "week", label: "Нед" }, { value: "month", label: "Мес" }]} />
        </div>
        <div className="gantt-stats">
          <span className="gantt-stats__item"><span className="gantt-stats__label">Прогресс</span><span className="gantt-stats__value">{ganttStats.progressPct}%</span></span>
          <span className="gantt-stats__item"><span className="gantt-stats__label">Задач</span><span className="gantt-stats__value">{ganttStats.taskCount}</span></span>
          <span className="gantt-stats__item"><span className="gantt-stats__label">Крит. путь</span><span className="gantt-stats__value">{ganttStats.criticalCount}</span></span>
          <span className="gantt-stats__item"><span className="gantt-stats__label">Версия</span><span className="gantt-stats__value">{planning.data?.planVersion ?? 0}</span></span>
        </div>
        {preview ? <CardPanel title="Сверка изменения" subtitle="До применения план не меняется"><p className="u-text-body">Будет изменено задач: {preview.planDelta.changedTaskIds.length}. Проверок: {preview.validationIssues.length}.</p></CardPanel> : null}
        {shownData ? <Gantt data={shownData} selectedId={selectedId} onSelectRow={setSelectedId} onToggleCollapse={toggleCollapse} {...(reason ? {} : { onMoveTask: moveTask, onResizeTask: resizeTask })} /> : null}
      </StateGate>
      <MutationMessage error={previewMutation.error ?? applyMutation.error ?? toolbarApply.error} />
    </>
  );
}

function ConfirmIconButton({ icon, label, disabled, title, dialogTitle, dialogBody, confirmLabel, onConfirm }: { icon: ReactNode; label: string; disabled?: boolean; title?: string | undefined; dialogTitle: string; dialogBody: string; confirmLabel: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} title={title}>{icon}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle><DialogDescription>{dialogBody}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="primary" onClick={() => { onConfirm(); setOpen(false); }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function usePlanApply(projectId: string, planning: PlanningReadModel | undefined, reason: string | null, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cmd: PlanCommand) => {
      if (reason) throw new Error(reason);
      if (!planning) throw new Error("План не загружен");
      return apiFetch(`/api/workspace/projects/${projectId}/planning/apply-command`, { method: "POST", json: { command: cmd, clientPlanVersion: planning.planVersion, idempotencyKey: `gantt-${cmd.type}-${planning.planVersion}-${Math.random().toString(36).slice(2, 8)}` } });
    },
    onSuccess: async () => { toast.success("План изменён"); onDone(); await queryClient.invalidateQueries({ queryKey: ["planning", projectId] }); },
    onError: (error) => toast.error(errorMessage(error))
  });
}

function GanttAddTaskDialog({ projectId, planning, parentTask, reason }: { projectId: string; planning: PlanningReadModel | undefined; parentTask: PlanningTask | null; reason: string | null }) {
  const statuses = useTaskStatuses();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(isoDate(new Date()));
  const [finish, setFinish] = useState(isoDate(addDays(new Date(), 1)));
  const [hours, setHours] = useState("8");
  const apply = usePlanApply(projectId, planning, reason, () => setOpen(false));
  const statusId = statuses.data?.taskStatuses[0]?.id;
  const submit = () => {
    if (!title.trim() || !statusId) { toast.error("Введите название"); return; }
    apply.mutate({ type: "task.create", payload: { id: crypto.randomUUID(), projectId, parentTaskId: parentTask?.id ?? null, title: title.trim(), statusId, plannedStart: start, plannedFinish: finish, durationMinutes: null, workMinutes: Math.max(0, Math.round(Number(hours) * 60)), assignments: [] } });
    setTitle("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Добавить" disabled={Boolean(reason)} title={reason ?? undefined}><Plus className="size-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новая задача</DialogTitle><DialogDescription>{parentTask ? `Внутри: ${parentTask.title}` : "На верхнем уровне плана"}</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)]">
          <Field label="Название" htmlFor="gantt-add-title"><Input id="gantt-add-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: согласовать ТЗ" /></Field>
          <div className="flex gap-[var(--space-3)]">
            <Field label="Начало" htmlFor="gantt-add-start"><Input id="gantt-add-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></Field>
            <Field label="Окончание" htmlFor="gantt-add-finish"><Input id="gantt-add-finish" type="date" value={finish} onChange={(event) => setFinish(event.target.value)} /></Field>
            <Field label="Труд., ч" htmlFor="gantt-add-hours"><Input id="gantt-add-hours" type="number" min={0} value={hours} onChange={(event) => setHours(event.target.value)} /></Field>
          </div>
          <MutationMessage error={apply.error} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="primary" disabled={apply.isPending || !statusId} onClick={submit}>Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GanttLinkDialog({ projectId, planning, reason }: { projectId: string; planning: PlanningReadModel | undefined; reason: string | null }) {
  const [open, setOpen] = useState(false);
  const [predecessor, setPredecessor] = useState("");
  const [successor, setSuccessor] = useState("");
  const [type, setType] = useState<string>("FS");
  const apply = usePlanApply(projectId, planning, reason, () => setOpen(false));
  const tasks = planning?.authored.tasks ?? [];
  const submit = () => {
    if (!predecessor || !successor || predecessor === successor) { toast.error("Выберите две разные задачи"); return; }
    apply.mutate({ type: "dependency.upsert", payload: { id: crypto.randomUUID(), predecessorTaskId: predecessor, successorTaskId: successor, dependencyType: type, lagMinutes: 0 } });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Связать" disabled={Boolean(reason)} title={reason ?? undefined}><Link2 className="size-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Связь задач</DialogTitle><DialogDescription>Предшественник → последователь, тип зависимости.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)]">
          <Field label="Предшественник" htmlFor="link-pred"><Select value={predecessor} onValueChange={setPredecessor}><SelectTrigger id="link-pred" className="w-full"><SelectValue placeholder="Задача" /></SelectTrigger><SelectContent>{tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.wbsCode ? `${task.wbsCode} · ` : ""}{task.title}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Последователь" htmlFor="link-succ"><Select value={successor} onValueChange={setSuccessor}><SelectTrigger id="link-succ" className="w-full"><SelectValue placeholder="Задача" /></SelectTrigger><SelectContent>{tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.wbsCode ? `${task.wbsCode} · ` : ""}{task.title}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Тип" htmlFor="link-type"><Select value={type} onValueChange={setType}><SelectTrigger id="link-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{DEP_TYPES.map(([value, text]) => <SelectItem key={value} value={value}>{value} · {text}</SelectItem>)}</SelectContent></Select></Field>
          <MutationMessage error={apply.error} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button><Button variant="primary" disabled={apply.isPending} onClick={submit}>Связать</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GanttUnlinkDialog({ projectId, planning, reason }: { projectId: string; planning: PlanningReadModel | undefined; reason: string | null }) {
  const [open, setOpen] = useState(false);
  const [dependencyId, setDependencyId] = useState("");
  const apply = usePlanApply(projectId, planning, reason, () => setOpen(false));
  const dependencies = planning?.authored.dependencies ?? [];
  const wbsById = new Map((planning?.authored.tasks ?? []).map((task) => [task.id, task.wbsCode || task.title]));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Снять связь" disabled={Boolean(reason) || dependencies.length === 0} title={reason ?? (dependencies.length === 0 ? "Связей нет" : undefined)}><Unlink className="size-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Снять связь</DialogTitle><DialogDescription>Выберите зависимость для удаления.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)]">
          <Field label="Связь" htmlFor="unlink-dep"><Select value={dependencyId} onValueChange={setDependencyId}><SelectTrigger id="unlink-dep" className="w-full"><SelectValue placeholder="Зависимость" /></SelectTrigger><SelectContent>{dependencies.map((dependency) => <SelectItem key={dependency.id} value={dependency.id}>{wbsById.get(dependency.predecessorTaskId)} → {wbsById.get(dependency.successorTaskId)} ({dependency.type})</SelectItem>)}</SelectContent></Select></Field>
          <MutationMessage error={apply.error} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button><Button variant="primary" disabled={apply.isPending || !dependencyId} onClick={() => dependencyId && apply.mutate({ type: "dependency.delete", payload: { dependencyId } })}>Снять</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GanttBaselineDialog({ projectId, planning, reason }: { projectId: string; planning: PlanningReadModel | undefined; reason: string | null }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const apply = usePlanApply(projectId, planning, reason, () => setOpen(false));
  const existing = planning?.authored.baselines?.length ?? 0;
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setLabel(`Базовый план ${existing + 1}`); }}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" disabled={Boolean(reason)} title={reason ?? undefined}>Базовый план</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Зафиксировать базовый план</DialogTitle><DialogDescription>Снимок текущего плана для сравнения. Базовых планов сейчас: {existing}.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)]">
          <Field label="Название" htmlFor="baseline-label"><Input id="baseline-label" value={label} onChange={(event) => setLabel(event.target.value)} /></Field>
          <MutationMessage error={apply.error} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button><Button variant="primary" disabled={apply.isPending || !label.trim()} onClick={() => apply.mutate({ type: "baseline.capture", payload: { baselineId: crypto.randomUUID(), label: label.trim() } })}>Зафиксировать</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GanttFilterPopover({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant={value ? "secondary" : "ghost"} size="icon-sm" aria-label="Фильтр"><Filter className="size-4" /></Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[16rem]">
        <Field label="Фильтр по названию" htmlFor="gantt-filter"><Input id="gantt-filter" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Поиск задачи" /></Field>
      </PopoverContent>
    </Popover>
  );
}

const ASSIGN_ROLES = ["executor", "co_executor", "controller", "approver", "observer"] as const;
function monthLabel(iso: string) { return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(`${iso}-01T00:00:00`)); }
function monthRange(centerIso: string): string[] {
  const [year, month] = centerIso.split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date((year ?? 2026), (month ?? 1) - 1 - 3 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function ProjectResourcesRuntime({ id, me }: { id: string; me: AuthMe }) {
  const planning = usePlanning(id);
  const planMonth = planning.data?.project.plannedStart?.slice(0, 7);
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const monthIso = monthOverride ?? planMonth ?? currentMonthIso();
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const { collapsedIds, toggleCollapse } = useCollapsedIds();
  const capacity = useCapacitySummary(monthIso);
  const capacityTree = useCapacityTree(monthIso, id);
  const positions = useMemo(() => collectResourcePositions(capacityTree.data), [capacityTree.data]);
  const matrix = useMemo(() => {
    if (!capacityTree.data || !capacity.data) return undefined;
    const built = toResourceMatrix(capacityTree.data, capacity.data, positionFilter);
    return { ...built, rows: applyCollapse(built.rows, collapsedIds) };
  }, [capacityTree.data, capacity.data, positionFilter, collapsedIds]);
  const months = useMemo(() => monthRange(monthIso), [monthIso]);
  const activeRole = positions.find((position) => position.id === positionFilter)?.name;
  return (
    <>
      <PageIntro
        title={`Ресурсы · ${planning.data?.project.title ?? "Проект"}`}
        lead="Дневная матрица загрузки на месяц: ёмкость, назначения и перегрузки по людям."
        actions={<>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={positionFilter ? "secondary" : "ghost"} size="sm"><Filter className="size-4" aria-hidden />{activeRole ?? "Роли"}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPositionFilter(null)}>Все роли</DropdownMenuItem>
              {positions.map((position) => <DropdownMenuItem key={position.id} onClick={() => setPositionFilter(position.id)}>{position.name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm"><Calendar className="size-4" aria-hidden />{monthLabel(monthIso)}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[18rem] overflow-y-auto">
              {months.map((month) => <DropdownMenuItem key={month} onClick={() => setMonthOverride(month)}>{monthLabel(month)}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <AssignResourceDialog projectId={id} planning={planning.data} me={me} />
        </>}
      />
      <StateGate state={capacityTree} empty="Данных загрузки нет." skeleton={<TableSkeleton columns={6} rows={6} />}>
        {matrix ? (
          <>
            <ResourceMatrixStats stats={matrix.stats} />
            <div className="u-flex u-items-center u-justify-between u-gap-3 u-mb-3"><ResourceMatrixLegend /></div>
            <ResourceMatrix data={matrix} onToggleCollapse={toggleCollapse} />
          </>
        ) : null}
      </StateGate>
      <div className="u-mt-3">
        <CardPanel title="Назначения проекта" subtitle="По задачам текущего плана" flush>
          <StateGate state={planning} empty="Назначений пока нет.">
            {planning.data ? <AssignmentsTable planning={planning.data} /> : null}
          </StateGate>
        </CardPanel>
      </div>
    </>
  );
}

function AssignResourceDialog({ projectId, planning, me }: { projectId: string; planning: PlanningReadModel | undefined; me: AuthMe }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [role, setRole] = useState<string>("executor");
  const [hours, setHours] = useState("8");
  const [preview, setPreview] = useState<PlanningPreview | null>(null);
  const reason = disabledReason(me, PERMISSIONS.manageProjectPlan);
  const assignableTasks = (planning?.authored.tasks ?? []).filter((task) => (task.workMinutes ?? 0) > 0);
  const command = useMemo(() => {
    if (!taskId || !resourceId) return null;
    return { type: "assignment.upsert" as const, payload: { id: crypto.randomUUID(), taskId, resourceId, role, unitsPermille: 1000, workMinutes: Math.max(0, Math.round(Number(hours) * 60)) || null } };
  }, [taskId, resourceId, role, hours]);
  const previewMutation = useMutation({
    mutationFn: () => { if (!planning || !command) throw new Error("Выберите задачу и ресурс"); return apiFetch<PlanningPreview>(`/api/workspace/projects/${projectId}/planning/preview-command`, { method: "POST", json: { command, clientPlanVersion: planning.planVersion } }); },
    onSuccess: (payload) => { setPreview(payload); toast.success("Предпросмотр подготовлен"); }
  });
  const applyMutation = useMutation({
    mutationFn: () => { if (!planning || !command) throw new Error("Нет команды"); return apiFetch(`/api/workspace/projects/${projectId}/planning/apply-command`, { method: "POST", json: { command, clientPlanVersion: planning.planVersion, idempotencyKey: `assign-${command.payload.id}` } }); },
    onSuccess: async () => { toast.success("Ресурс назначен"); setOpen(false); setPreview(null); await queryClient.invalidateQueries(); }
  });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPreview(null); }}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm" disabled={Boolean(reason)} title={reason ?? undefined}><Plus className="size-4" aria-hidden />Назначить</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Назначить ресурс на задачу</DialogTitle>
          <DialogDescription>Назначение проходит через сверку и применение с версией плана.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-[var(--space-3)]">
          <Field label="Задача" htmlFor="assign-task">
            <Select value={taskId} onValueChange={(value) => { setTaskId(value); setPreview(null); }}>
              <SelectTrigger id="assign-task" className="w-full"><SelectValue placeholder="Выберите задачу" /></SelectTrigger>
              <SelectContent>{assignableTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ресурс" htmlFor="assign-resource">
            <Select value={resourceId} onValueChange={(value) => { setResourceId(value); setPreview(null); }}>
              <SelectTrigger id="assign-resource" className="w-full"><SelectValue placeholder="Выберите ресурс" /></SelectTrigger>
              <SelectContent>{(planning?.resources ?? []).map((resource) => <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Роль" htmlFor="assign-role">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="assign-role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ASSIGN_ROLES.map((value) => <SelectItem key={value} value={value}>{businessStatus(value)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Трудоёмкость, ч" htmlFor="assign-hours">
            <Input id="assign-hours" type="number" min={0} value={hours} onChange={(event) => { setHours(event.target.value); setPreview(null); }} />
          </Field>
          {preview ? <p className="u-text-sm u-text-muted">Будет изменено: задач {preview.planDelta.changedTaskIds.length}, назначений {preview.planDelta.changedAssignmentIds.length}. Проверок: {preview.validationIssues.length}.</p> : null}
          <MutationMessage error={previewMutation.error ?? applyMutation.error} />
        </div>
        <DialogFooter>
          <Button variant="secondary" disabled={!command || previewMutation.isPending} onClick={() => previewMutation.mutate()}>Подготовить сверку</Button>
          <Button variant="primary" disabled={!preview || applyMutation.isPending} onClick={() => applyMutation.mutate()}>Назначить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentsTable({ planning }: { planning: PlanningReadModel }) {
  const tasksById = new Map(planning.authored.tasks.map((task) => [task.id, task]));
  const resourcesById = new Map(planning.resources.map((resource) => [resource.id, resource.name]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Задача</TableHead>
          <TableHead>Роль</TableHead>
          <TableHead>Ресурс</TableHead>
          <TableHead numeric>План</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {planning.authored.assignments.map((assignment) => {
          const task = tasksById.get(assignment.taskId);
          return (
            <TableRow key={assignment.id}>
              <TableCell className="max-w-[20rem] font-medium">{task?.title ?? "Задача без названия"}</TableCell>
              <TableCell className="text-[var(--muted)]">{businessStatus(assignment.role)}</TableCell>
              <TableCell className="text-[var(--muted)]">{resourcesById.get(assignment.resourceId) ?? "—"}</TableCell>
              <TableCell numeric className="whitespace-nowrap">{Math.round((assignment.workMinutes ?? 0) / 60)} ч</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();
  const login = useMutation({ mutationFn: () => apiFetch("/api/auth/login", { method: "POST", json: { email, password } }), onSuccess: async () => { await queryClient.invalidateQueries(); router.push("/dashboard"); } });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); login.mutate(); }
  return (
    <div className="app-canvas login-screen"><div className="app-canvas__panel app-canvas__panel--bare"><main className="login-screen__main"><form className="login-card" noValidate onSubmit={submit}><div className="login-card__brand"><span className="login-card__brand-mark" aria-hidden>К</span><div className="login-card__brand-text"><span className="login-card__brand-title">KISS PM</span><span className="login-card__brand-meta">Вход в рабочее пространство</span></div></div><h1 className="login-card__title">Войти</h1><p className="login-card__lead">Корпоративный email и пароль рабочей области.</p><div className="login-card__form"><Field label="Email" required htmlFor="login-email"><Input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Field><Field label="Пароль" required htmlFor="login-password"><Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></Field></div><div className="login-card__foot"><Button variant="primary" type="submit" className="w-full" disabled={login.isPending}>Войти</Button>{login.error ? <p className="u-text-sm u-text-muted">{errorMessage(login.error)}</p> : null}</div></form></main></div></div>
  );
}

function ChromeState({ title, lead }: { title: string; lead: string }) { return <WorkspaceChrome meta={{ breadcrumb: [{ label: title, current: true }], activeNav: "Дашборд" }}><PageIntro title={title} lead={lead} /></WorkspaceChrome>; }
function StateGate<T>({ state, empty, skeleton, isEmpty, children }: { state: QueryState<T>; empty: string; skeleton?: ReactNode; isEmpty?: (data: T) => boolean; children: ReactNode }) { if (state.isLoading) return <>{skeleton ?? <TableSkeleton />}</>; if (state.error) return <ErrorState title="Не удалось загрузить данные" description={errorMessage(state.error)} {...(state.refetch ? { onRetry: state.refetch } : {})} />; if (!state.data || isEmpty?.(state.data)) return <div className="state-illu"><div className="state-illu__art" aria-hidden><Inbox className="size-8 text-[var(--muted)]" strokeWidth={1.75} /></div><p className="state-illu__title">{empty}</p></div>; return <>{children}</>; }
function MetricTile({ label, value, sub, danger, feature, icon, href }: { label: string; value: number | string; sub: string; danger?: boolean; feature?: boolean; icon?: ReactNode; href?: string }) {
  const className = cn(
    "bento__cell flex flex-col rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--panel)] p-[var(--space-5)] shadow-[var(--shadow-sm)]",
    feature && "border-transparent [background-image:var(--accent-grad-soft)]",
    href &&
      "cursor-pointer transition-[box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
  );
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--text-sm)] font-medium text-[var(--muted)]">{label}</span>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] [&>svg]:size-4",
              danger
                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                : feature
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--panel-strong)] text-[var(--muted)]"
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-[var(--space-3)] text-[2rem] font-extrabold leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums]",
          danger ? "text-[var(--danger)]" : feature ? "text-[var(--accent)]" : "text-[var(--text)]"
        )}
      >
        {value}
      </div>
      <div className="mt-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--muted)]">{sub}</div>
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function TaskKanban({ tasks, statuses, auth }: { tasks: Task[]; statuses: TaskStatus[]; auth: AuthMe }) {
  const groups = [["new", "Бэклог"], ["in_progress", "В работе"], ["review", "Проверка"], ["done", "Готово"]] as const;
  return <KanbanBoard>{groups.map(([category, title]) => {
    const items = tasks.filter((task) => task.statusCategory === category);
    return <KanbanColumn key={category} title={title} count={items.length}>{items.length === 0 ? <p className="u-text-xs u-text-muted">Нет задач</p> : items.map((task, index) => <KanbanCard key={task.id} id={`Задача ${index + 1}`} title={task.title} priority={priorityLevel(task.priority)} priorityLabel={businessStatus(task.priority)} meta={[{ label: `Срок: ${formatDate(task.plannedFinish)}` }, { label: task.statusName }]} assignees={[{ initials: "ИИ", color: "c1" }]} date={formatDate(task.plannedFinish)} foot={<TaskAdvanceButton task={task} statuses={statuses} auth={auth} />}/>)}</KanbanColumn>;
  })}</KanbanBoard>;
}
// Semantic enum→badge mapping for task status (neutral default; color only when the value carries meaning).
function taskStatusTone(category: string): React.ComponentProps<typeof Badge>["variant"] {
  if (category === "done") return "success";
  if (category === "waiting") return "warning";
  if (category === "review" || category === "in_progress") return "info";
  return "secondary";
}
function TaskDetailSheet({ task, children }: { task: Task; children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>Детали задачи · только просмотр</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-[var(--space-4)]">
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Badge variant={taskStatusTone(task.statusCategory)}>{task.statusName}</Badge>
            <Badge variant="secondary">{businessStatus(task.priority)}</Badge>
          </div>
          <dl className="flex flex-col gap-[var(--space-2)]">
            <div><dt className="u-text-xs u-text-muted">Срок</dt><dd className="u-text-body u-text-strong">{dateRange(task.plannedStart, task.plannedFinish)}</dd></div>
            <div><dt className="u-text-xs u-text-muted">Прогресс</dt><dd className="u-text-body u-text-strong">{task.progress}%</dd></div>
            <div><dt className="u-text-xs u-text-muted">Трудоёмкость</dt><dd className="u-text-body u-text-strong">{task.plannedWork} ч</dd></div>
            <div><dt className="u-text-xs u-text-muted">Участников</dt><dd className="u-text-body u-text-strong">{task.participants?.length ?? 0}</dd></div>
          </dl>
          <div>
            <p className="u-text-xs u-text-muted">Описание</p>
            <p className="u-text-body">{task.description ?? "Без описания"}</p>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
function TaskTable({ tasks, statuses, actorId, auth, compactActions = false }: { tasks: Task[]; statuses: TaskStatus[]; actorId?: string | undefined; auth: AuthMe; compactActions?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Задача</TableHead>
          <TableHead numeric>Срок</TableHead>
          <TableHead>Статус</TableHead>
          {compactActions ? null : <TableHead numeric>Прогресс</TableHead>}
          <TableHead>
            <span className="sr-only">Действие</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="max-w-[20rem]">
              <TaskDetailSheet task={task}>
                <button
                  type="button"
                  className="-mx-1 block w-full rounded-[var(--radius-sm)] px-1 text-left transition-colors hover:bg-[var(--panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                >
                  <CellStack title={task.title} subtitle={task.description ?? "Без описания"} truncate />
                </button>
              </TaskDetailSheet>
            </TableCell>
            <TableCell numeric className="whitespace-nowrap text-[var(--muted)]">{formatDate(task.plannedFinish)}</TableCell>
            <TableCell>
              <Badge variant={taskStatusTone(task.statusCategory)}>{task.statusName}</Badge>
            </TableCell>
            {compactActions ? null : <TableCell numeric>{task.progress}%</TableCell>}
            <TableCell align="right">
              <div className="flex items-center justify-end gap-2">
                <TaskAdvanceButton task={task} statuses={statuses} auth={auth} />
                {compactActions ? null : <TaskCommentForm task={task} actorId={actorId} statuses={statuses} auth={auth} />}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  return <span><Button variant="secondary" size="sm" className="min-w-[8rem] justify-center" disabled={Boolean(reason) || !next || mutation.isPending} title={reason ?? undefined} onClick={() => mutation.mutate()}>{next ? `→ ${next.name}` : "Финал"}</Button><DisabledReason reason={reason} /></span>;
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
function DealsTable({ deals, stages, auth }: { deals: Opportunity[]; stages: DealStage[]; auth: AuthMe }) {
  return (
    <Table className="mt-4">
      <TableHeader>
        <TableRow>
          <TableHead>Сделка</TableHead>
          <TableHead>Клиент</TableHead>
          <TableHead>Стадия</TableHead>
          <TableHead numeric>Сумма</TableHead>
          <TableHead>
            <span className="sr-only">Действие</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.map((deal) => (
          <TableRow key={deal.id}>
            <TableCell className="max-w-[20rem]">
              <CellStack title={deal.title} subtitle={deal.contactName ?? "Контакт не указан"} truncate />
            </TableCell>
            <TableCell truncate className="text-[var(--muted)]">{deal.clientName}</TableCell>
            <TableCell>
              <Badge variant="secondary">{stageName(stages, deal.stageId)}</Badge>
            </TableCell>
            <TableCell numeric className="whitespace-nowrap">{money(deal.contractValue)}</TableCell>
            <TableCell align="right">
              <DealAdvanceButton deal={deal} stages={stages} auth={auth} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function DealAdvanceButton({ deal, stages, auth }: { deal: Opportunity; stages: DealStage[]; auth: AuthMe }) { const queryClient = useQueryClient(); const next = nextStage(stages, deal.stageId); const reason = disabledReason(auth, PERMISSIONS.manageOpportunities); const mutation = useMutation({ mutationFn: () => { if (reason) throw new Error(reason); return apiFetch(`/api/workspace/opportunities/${deal.id}/stage`, { method: "PATCH", json: { stageId: next?.id } }); }, onSuccess: async () => { toast.success("Стадия сделки сохранена"); await queryClient.invalidateQueries(); } }); return <span><Button variant="secondary" size="sm" className="min-w-[8rem] justify-center" disabled={Boolean(reason) || !next || mutation.isPending} title={reason ?? undefined} onClick={() => mutation.mutate()}>{next ? `→ ${next.name}` : "Финал"}</Button><DisabledReason reason={reason} /></span>; }
function ForecastPanel({ deals }: { deals: Opportunity[] }) { const total = deals.reduce((sum, deal) => sum + deal.contractValue * (deal.probability / 100), 0); return <CardPanel title="Прогноз продаж" subtitle="Расчёт по вероятности сделок"><div className="tile__value">{money(total)}</div><p className="u-text-sm u-text-muted">Прогноз считается из текущей воронки.</p></CardPanel>; }

function ProjectsTable({ projects }: { projects: Project[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Клиент</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead numeric>Срок</TableHead>
          <TableHead>
            <span className="sr-only">Действия</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id} className="group">
            <TableCell className="max-w-[22rem]">
              <CellStack
                title={project.title}
                subtitle={dateRange(project.plannedStart, project.plannedFinish)}
                truncate
                icon={<Folder className="size-4" aria-hidden />}
              />
            </TableCell>
            <TableCell truncate className="text-[var(--muted)]">{project.clientName}</TableCell>
            <TableCell>
              <Badge variant="secondary">{businessStatus(project.status)}</Badge>
            </TableCell>
            <TableCell numeric className="whitespace-nowrap text-[var(--muted)]">{formatDate(project.plannedFinish)}</TableCell>
            <TableCell align="right">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Действия: ${project.title}`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Действия</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}`}>Открыть проект</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}/timeline`}>План-график</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}/resources`}>Ресурсы</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function TasksPanel({ state, tasks, statuses, auth }: { state: QueryState<{ tasks: Task[] }>; tasks: Task[]; statuses: TaskStatus[]; auth: AuthMe }) {
  return <CardPanel title="Ближайшие задачи" subtitle={`${tasks.length} задач`} flush actions={<Button variant="ghost" size="sm" asChild><Link href="/my-work">Вся работа</Link></Button>}><StateGate state={state} empty="Задач нет."><TaskTable tasks={tasks} statuses={statuses} auth={auth} compactActions /></StateGate></CardPanel>;
}
function AuditPanel({ state }: { state: QueryState<{ auditEvents: AuditEvent[] }> }) {
  return <CardPanel title="Журнал" subtitle="Последние события" flush><StateGate state={state} empty="Событий нет." skeleton={<FeedSkeleton />} isEmpty={(d) => d.auditEvents.length === 0}><ul className="feed">{(state.data?.auditEvents ?? []).map((event) => <li key={event.id} className="feed__item"><BemAvatar initials="А" color="c4" size="sm" /><div><div className="feed__head"><strong className="u-text-body u-text-strong">{businessStatus(event.actionType)}</strong><span className="u-text-xs u-text-muted">{formatDate(event.createdAt)}</span></div><p className="u-text-body">{auditResultLabel(event)}</p></div></li>)}</ul></StateGate></CardPanel>;
}
function EntityCards({ title, description, aside }: { title: string; description: string; aside: ReactNode }) { return <div className="entity-grid"><div className="entity-grid__main"><CardPanel title={title} subtitle="Контекст для команды"><p className="u-text-body">{description}</p></CardPanel></div><aside className="entity-grid__aside"><CardPanel title="Параметры" subtitle="Свойства сущности">{aside}</CardPanel></aside></div>; }
function FactList({ facts }: { facts: Array<[string, string]> }) { return <dl className="u-stack-2">{facts.map(([label, value]) => <div key={label}><dt className="u-text-xs u-text-muted">{label}</dt><dd className="u-text-body u-text-strong">{value}</dd></div>)}</dl>; }
function UsersTable({ state }: { state: QueryState<{ users: RuntimeUser[] }> }) {
  return (
    <CardPanel title="Пользователи" subtitle="Команда рабочей области" flush>
      <StateGate state={state} empty="Пользователей нет." isEmpty={(d) => d.users.length === 0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Должность</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(state.data?.users ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell truncate className="text-[var(--muted)]">{user.email ?? "—"}</TableCell>
                <TableCell className="text-[var(--muted)]">{user.positionName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{businessStatus(user.status ?? "active")}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </StateGate>
    </CardPanel>
  );
}
function RolesPanel({ state }: { state: QueryState<{ accessProfiles: AccessProfile[] }> }) { return <CardPanel title="Роли" subtitle="Профили доступа"><StateGate state={state} empty="Ролей нет."><ul className="link-list">{(state.data?.accessProfiles ?? []).map((role) => <li key={role.id}>{role.name} · {role.permissions.length} прав</li>)}</ul></StateGate></CardPanel>; }
function MutationMessage({ error }: { error: Error | null }) { return error ? <p className="u-text-sm u-text-muted u-mt-3">{errorMessage(error)}</p> : null; }
function can(auth: AuthMe, permission: Permission) { return auth.permissions.includes(permission); }
function disabledReason(auth: AuthMe, permission: Permission) { return can(auth, permission) ? null : "Недостаточно прав для этого действия."; }
function DisabledReason({ reason }: { reason: string | null }) { return reason ? <p className="u-text-xs u-text-muted">{reason}</p> : null; }

function useOpportunities() { return useQuery({ queryKey: ["opportunities"], queryFn: () => apiFetch<{ opportunities: Opportunity[] }>("/api/workspace/opportunities") }); }
function useDealStages() { return useQuery({ queryKey: ["deal-stages"], queryFn: () => apiFetch<{ dealStages: DealStage[] }>("/api/workspace/deal-stages") }); }
function useCapacityTree(monthIso: string, projectId: string) { return useQuery({ queryKey: ["capacity-tree", monthIso, projectId], queryFn: () => apiFetch<CapacityTree>(`/api/workspace/capacity/tree?monthIso=${monthIso}&projectId=${projectId}`) }); }
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
const CAPACITY_WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;
const MATRIX_AVATAR_COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"] as const;
function capacityDayCell(day: CapacityDayCell): DayCell {
  if (day.isWeekend) return { kind: "weekend" };
  if (day.isHoliday) return { kind: "holiday" };
  if (day.hasAbsence) return { kind: "vacation" };
  if (day.isFreeDay || day.workMinutes === 0) return { kind: "zero" };
  const hours = Math.round((day.workMinutes / 60) * 10) / 10;
  const level = day.isOverload || day.overloadMinutes > 0 ? "over" : day.capacityMinutes > 0 && day.workMinutes / day.capacityMinutes >= 0.9 ? "high" : "normal";
  return { kind: "load", hours, level };
}
function capacityMonthPercent(days: CapacityDayCell[]): MatrixPercent {
  const work = days.reduce((sum, day) => sum + day.workMinutes, 0);
  const capacity = days.reduce((sum, day) => sum + day.capacityMinutes, 0);
  const value = capacity > 0 ? Math.round((work / capacity) * 100) : 0;
  const level = value > 100 ? "over" : value >= 90 ? "high" : value >= 80 ? "norm" : value >= 50 ? "mid" : "low";
  return { value, level };
}
function collectResourcePositions(tree: CapacityTree | undefined): Array<{ id: string; name: string }> {
  if (!tree) return [];
  const seen = new Map<string, string>();
  for (const group of tree.orgGroups) for (const unit of group.units) for (const position of unit.positions) if (!seen.has(position.position.id)) seen.set(position.position.id, position.position.name);
  return [...seen].map(([id, name]) => ({ id, name }));
}
// Маппинг реального /capacity/tree в дневную матрицу виджета. ponytail: org-режим (orgGroups); __unplaced__ direction скрываем, глубже 3-го уровня indent упирается в 2.
function toResourceMatrix(tree: CapacityTree, summary: CapacitySummary, positionFilterId?: string | null): ResourceMatrixData {
  const filtering = Boolean(positionFilterId);
  const todayIso = isoDate(new Date());
  const days: DayHeader[] = tree.days.map((day) => ({
    day: Number(day.date.slice(8, 10)),
    weekdayShort: CAPACITY_WEEKDAYS_RU[day.isoWeekday % 7] ?? "",
    weekend: day.isWeekend,
    holiday: day.isHoliday,
    today: day.date === todayIso
  }));
  const rows: MatrixRow[] = [];
  let personSeq = 0;
  const pushPerson = (row: CapacityEmployeeRow, indent: 0 | 1 | 2, parentId?: string) => {
    rows.push({ id: `emp-${row.user.id}`, kind: "person", indent, ...(parentId ? { parentId } : {}), name: row.user.name, avatar: { initials: initials(row.user.name), color: MATRIX_AVATAR_COLORS[personSeq++ % MATRIX_AVATAR_COLORS.length] ?? "c1" }, percent: capacityMonthPercent(row.days), cells: row.days.map(capacityDayCell) });
  };
  for (const group of tree.orgGroups) {
    const showDirection = group.direction.id !== "__unplaced__" && !filtering;
    const directionRowId = `dir-${group.direction.id}`;
    if (showDirection) rows.push({ id: directionRowId, kind: "workshop", indent: 0, name: group.direction.name, collapsible: true, percent: capacityMonthPercent(group.directionDays), cells: group.directionDays.map(capacityDayCell) });
    const unitIndent = (showDirection ? 1 : 0) as 0 | 1 | 2;
    const posIndent = (filtering ? 0 : Math.min(unitIndent + 1, 2)) as 0 | 1 | 2;
    for (const unit of group.units) {
      const unitRowId = `unit-${unit.unit.id}`;
      if (!filtering) rows.push({ id: unitRowId, kind: "sub", indent: unitIndent, ...(showDirection ? { parentId: directionRowId } : {}), name: unit.unit.name, collapsible: true, percent: capacityMonthPercent(unit.unitDays), cells: unit.unitDays.map(capacityDayCell) });
      for (const position of unit.positions) {
        if (positionFilterId && position.position.id !== positionFilterId) continue;
        const positionRowId = `pos-${position.position.id}`;
        rows.push({ id: positionRowId, kind: "role", indent: posIndent, ...(filtering ? {} : { parentId: unitRowId }), name: position.position.name, collapsible: true, percent: capacityMonthPercent(position.positionDays), cells: position.positionDays.map(capacityDayCell) });
        for (const row of position.rows) pushPerson(row, filtering ? 1 : 2, positionRowId);
      }
    }
  }
  if (!filtering) for (const row of tree.unassignedRows ?? []) pushPerson(row, 0);
  const capacity = summary.totalCapacityMinutes ?? 0;
  const work = summary.totalWorkMinutes ?? 0;
  return {
    days,
    rows,
    stats: {
      capacityHours: Math.round(capacity / 60),
      assignedHours: Math.round(work / 60),
      loadPct: capacity > 0 ? Math.round((work / capacity) * 100) : 0,
      freeHours: Math.round(Math.max(0, capacity - work) / 60),
      employees: rows.filter((row) => row.kind === "person").length
    }
  };
}
function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days); // UTC — консистентно с isoDate (toISOString) и date-only планом
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
// BUG-004: следующий статус выбираем по матрице переходов бэкенда (nextTaskStatus), а не по sortOrder —
// иначе фронт предлагал переход, который бэк отклоняет 409.
function nextStatus(statuses: TaskStatus[], task: Task): TaskStatus | null {
  return nextTaskStatus(statuses as Array<TaskStatus & { category: TaskStatusCategory }>, {
    statusCategory: task.statusCategory as TaskStatusCategory
  });
}
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
    ok: "В норме",
    warning: "Предупреждение",
    conflict: "Конфликт",
    blocked: "Заблокировано",
    sufficient: "Достаточно",
    insufficient: "Недостаточно",
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
// Числовое сравнение WBS-кодов ("1.2" < "1.10"); локальная копия логики persistence/planningWbs, чтобы не тянуть серверный пакет в web.
function compareWbs(left: string, right: string): number {
  const a = left.split("."), b = right.split(".");
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i], y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = Number(x), ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny) && nx !== ny) return nx - ny;
    if (x !== y) return x.localeCompare(y, undefined, { numeric: true });
  }
  return 0;
}

function toGanttData(model: PlanningReadModel, showCritical = true): GanttData {
  const dayMs = 86_400_000;
  // UTC-полночь: плановые даты — date-only (парсятся как UTC), а UTC не имеет DST, поэтому
  // startOfBase + index·dayMs всегда точная UTC-полночь дня N (без дрейфа на переводе часов).
  const midnight = (value: string | Date) => { const d = new Date(value); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  // Диапазон таймлайна = от самой ранней до самой поздней даты плана (не фиксированные 30 дней — иначе многомесячный проект обрезается).
  const times = [midnight(model.project.plannedStart), midnight(model.project.plannedFinish)];
  for (const task of model.authored.tasks) {
    if (task.plannedStart) times.push(midnight(task.plannedStart));
    if (task.plannedFinish) times.push(midnight(task.plannedFinish));
  }
  const startOfBase = Math.min(...times);
  const endOfRange = Math.max(...times);
  const base = new Date(startOfBase);
  const now = new Date();
  const todayIndex = Math.round((midnight(now) - startOfBase) / dayMs);
  const spanDays = Math.max(30, Math.round((endOfRange - startOfBase) / dayMs) + 1);
  const days = Array.from({ length: spanDays }, (_, index) => {
    const day = new Date(startOfBase + index * dayMs);
    const weekdayShort = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" }).format(day).slice(0, 2);
    const weekday = day.getUTCDay();
    return { iso: day.toISOString().slice(0, 10), day: day.getUTCDate(), weekdayShort, weekend: weekday === 0 || weekday === 6, today: index === todayIndex };
  });
  const resourceNameById = new Map(model.resources.map((resource) => [resource.id, resource.name]));
  const resourceNameByTask = new Map<string, string>();
  for (const assignment of model.authored.assignments) {
    if (resourceNameByTask.has(assignment.taskId)) continue;
    const name = resourceNameById.get(assignment.resourceId);
    if (name) resourceNameByTask.set(assignment.taskId, name);
  }
  const criticalIds = new Set(showCritical ? model.calculatedPlan?.criticalPathTaskIds ?? [] : []);
  // Резерв (slack) в днях по задаче для tooltip (UX-009).
  // TODO: 8ч-день захардкожен; точный перевод требует per-task рабочих минут/день из календаря
  // ресурса (read-model их пока не отдаёт) — иначе для нестандартного календаря дни резерва неточны.
  const MINUTES_PER_WORKING_DAY = 480;
  const slackDaysByTask = new Map<string, number>();
  for (const calcTask of model.calculatedPlan?.tasks ?? []) {
    if (calcTask.totalSlackMinutes != null) slackDaysByTask.set(calcTask.id, Math.round(calcTask.totalSlackMinutes / MINUTES_PER_WORKING_DAY));
  }
  const taskById = new Map(model.authored.tasks.map((task) => [task.id, task]));
  const wbsById = new Map(model.authored.tasks.map((task) => [task.id, task.wbsCode ?? ""]));
  const predecessorsByTask = new Map<string, string[]>();
  const predecessorIdsByTask = new Map<string, string[]>();
  for (const dependency of model.authored.dependencies ?? []) {
    const code = wbsById.get(dependency.predecessorTaskId);
    if (!code) continue;
    predecessorsByTask.set(dependency.successorTaskId, [...(predecessorsByTask.get(dependency.successorTaskId) ?? []), code]);
    predecessorIdsByTask.set(dependency.successorTaskId, [...(predecessorIdsByTask.get(dependency.successorTaskId) ?? []), dependency.predecessorTaskId]);
  }
  const childrenByParent = new Map<string | null, PlanningTask[]>();
  for (const task of model.authored.tasks) {
    const parentId = task.parentTaskId ?? null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), task]);
  }
  const startDayOf = (task: PlanningTask) =>
    task.plannedStart ? Math.max(0, Math.round((new Date(task.plannedStart).getTime() - base.getTime()) / 86_400_000)) : 0;
  const finishDayOf = (task: PlanningTask, start: number) =>
    task.plannedFinish ? Math.max(start + 1, Math.round((new Date(task.plannedFinish).getTime() - base.getTime()) / 86_400_000) + 1) : start + 1;
  // Прогресс суммарной строки — труд-взвешенный roll-up листьев (модель не хранит % фазы).
  const rollup = (id: string): { work: number; earned: number } => {
    const kids = childrenByParent.get(id) ?? [];
    if (kids.length === 0) {
      const task = taskById.get(id);
      const work = task?.workMinutes ?? 0;
      return { work, earned: work * Math.max(0, Math.min(1, (task?.percentComplete ?? 0) / 100)) };
    }
    return kids.reduce((acc, kid) => { const r = rollup(kid.id); return { work: acc.work + r.work, earned: acc.earned + r.earned }; }, { work: 0, earned: 0 });
  };

  const rows: GanttRow[] = [];
  const walk = (parentId: string | null, level: number): void => {
    const siblings = [...(childrenByParent.get(parentId) ?? [])].sort((l, r) => compareWbs(l.wbsCode ?? "", r.wbsCode ?? ""));
    for (const task of siblings) {
      const summary = (childrenByParent.get(task.id)?.length ?? 0) > 0;
      // ponytail: модель не знает типа "веха" — эвристика «лист без работы». Ceiling: добавить TaskType "milestone", если появится в домене.
      const milestone = !summary && (task.workMinutes ?? 0) === 0;
      const start = startDayOf(task);
      const finish = finishDayOf(task, start);
      const resourceName = resourceNameByTask.get(task.id);
      const progress = summary ? (() => { const r = rollup(task.id); return r.work > 0 ? r.earned / r.work : 0; })() : Math.max(0, Math.min(1, (task.percentComplete ?? 0) / 100));
      rows.push({
        id: task.id,
        ...(parentId ? { parentId } : {}),
        level: Math.min(level, 3) as 0 | 1 | 2 | 3,
        kind: summary ? "summary" : milestone ? "milestone" : "task",
        name: task.title,
        wbs: task.wbsCode ?? "",
        startDay: start,
        durationDays: Math.max(1, finish - start),
        progress,
        mode: task.schedulingMode === "manual" ? "Руч." : "Авто",
        workMinutes: task.workMinutes ?? null,
        startLabel: task.plannedStart ? formatDate(task.plannedStart) : "—",
        finishLabel: task.plannedFinish ? formatDate(task.plannedFinish) : "—",
        ...(criticalIds.has(task.id) ? { critical: true } : {}),
        ...(predecessorsByTask.has(task.id) ? { predecessorLabel: predecessorsByTask.get(task.id)!.join(", ") } : {}),
        ...(predecessorIdsByTask.has(task.id) ? { predecessorIds: predecessorIdsByTask.get(task.id)! } : {}),
        ...(slackDaysByTask.has(task.id) ? { slackDays: slackDaysByTask.get(task.id)! } : {}),
        ...(summary ? { collapsible: true } : {}),
        ...(resourceName ? { resourceName, assignee: { initials: initials(resourceName), color: "c1" as const } } : {})
      });
      walk(task.id, level + 1);
    }
  };
  walk(null, 0);

  return {
    monthLabel: new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(base),
    days,
    rows
  };
}
