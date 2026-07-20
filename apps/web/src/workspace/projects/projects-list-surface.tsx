"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { WorkspaceShell } from "@/delivery/ui/workspace-shell";
import { useProjects, useWorkspaceUsers } from "@/workspace/lib/use-workspace";
import type {
  ProjectRecord,
  ProjectStatusAction,
  ProjectStatusFilter
} from "@/workspace/lib/workspace-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

/* ============================================================
   Workspace — поверхность «Проекты» (список проектов рабочей области).
   Каркас: WorkspaceShell (левая навигация + топбар).

   ЧЕСТНОСТЬ:
   - Боевой контракт GET /api/workspace/projects?status=active|closed|paused|all;
     транспорт — contract-mock, переключение на боевой = apiOrigin; данные in-memory.
   - Фильтр статуса — реальный query-параметр ручки (не клиентская подмена).
   - Создание/переименование/пауза/возобновление/переоткрытие — реальные мутации
     (POST /projects, PATCH /projects/:id, POST /projects/:id/{reopen,pause,resume}).
     Каждая мутация — с подтверждением/формой; ошибка — честный тост с кодом.

   Состояния — только через <SurfaceState> (loading/error/empty).
   ============================================================ */

// Доступные фильтры статуса (значения — боевой query-параметр ?status=).
export const PROJECTS_LIST_AVAILABLE_FILTERS = [
  { value: "active", label: "Активные" },
  { value: "paused", label: "Приостановленные" },
  { value: "closed", label: "Закрытые" },
  { value: "all", label: "Все" }
] as const satisfies readonly { value: ProjectStatusFilter; label: string }[];

// Сервер уже фильтрует по статусу; локально возвращаем как есть (защита от undefined).
export function getVisibleProjects(projects: ProjectRecord[]): ProjectRecord[] {
  return projects ?? [];
}

// Аватары/инициалы/цвет — по образцу deals-surface (детерминированно по справочнику).
const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const initials = (name: string) => {
  const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
};

// Денежный форматтер — зеркало money() из crm-bits/deals-surface.
const money = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`
    : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`;

// ISO-дата (YYYY-MM-DD) → ДД.ММ.ГГГГ. Невалидную строку отдаём как есть.
const fmtDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

// RU-маппер кодов ошибок (локальный, как ERR_RU в deals-surface).
const ERR_RU: Record<string, string> = {
  load_failed: "Не удалось загрузить проекты",
  request_failed: "Запрос не выполнен",
  invalid_json_response: "Некорректный ответ сервера",
  invalid_project_title: "Некорректное название проекта",
  invalid_planned_dates: "Некорректные плановые даты",
  project_status_transition_not_allowed: "Переход статуса недоступен",
  project_not_found: "Проект не найден",
  project_id_taken: "Проект с таким идентификатором уже существует"
};
export const projectsErrorMessage = (code?: string) =>
  (code && ERR_RU[code]) || (code ? "Запрос не выполнен" : "Не удалось загрузить");

const mutationError = (code?: string) => ERR_RU[code ?? ""] ?? "Действие не выполнено" + (code ? ` (${code})` : "");

// Человекочитаемый статус проекта (боевой status — свободная строка; известные — переводим).
const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  draft: "Черновик",
  paused: "На паузе",
  closed: "Закрыт",
  cancelled: "Отменён",
  archived: "Архив"
};
const statusVariant = (status: string) =>
  status === "active"
    ? "success"
    : status === "paused"
      ? "warning"
      : status === "closed" || status === "cancelled" || status === "archived"
        ? "danger"
        : "info";

export function ProjectsListSurface() {
  const usersDir = useWorkspaceUsers();
  const userColor = (id: string): BemAvatarColor => {
    const i = usersDir.indexOf(id);
    return i < 0 ? "c5" : AV[i % AV.length]!;
  };
  const [filter, setFilter] = useState<ProjectStatusFilter>("active");
  const { data, status, error, reload, createProject, updateProject, setProjectStatus } =
    useProjects(filter);

  const projects = useMemo<ProjectRecord[]>(() => getVisibleProjects(data?.projects ?? []), [data]);

  const surfaceStatus =
    status === "forbidden"
      ? "forbidden"
      : status === "error"
        ? "error"
        : data
          ? projects.length === 0
            ? "empty"
            : "ready"
          : "loading";

  return (
    <WorkspaceShell activeNav="Проекты">
      <main className="min-w-0 flex-1 overflow-auto p-4">
        <ProtoBanner />

        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Проекты</h1>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Проекты рабочей области и их жизненный цикл</p>
          </div>
          <CreateProjectDialog onCreate={createProject} />
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {PROJECTS_LIST_AVAILABLE_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={projectsErrorMessage}
          loadingLabel="Загрузка проектов…"
          empty={{
            title: filter === "active" ? "Нет активных проектов" : "Нет проектов",
            description:
              filter === "active"
                ? "Создайте внутренний проект вручную или активируйте выигранную сделку из CRM."
                : "В этой выборке проектов нет. Смените фильтр статуса.",
            action:
              filter === "active" ? (
                <CreateProjectDialog onCreate={createProject} />
              ) : (
                <Button variant="secondary" onClick={() => setFilter("all")}>Показать все</Button>
              )
          }}
        >
          <ProjectsTable
            projects={projects}
            userColor={userColor}
            onRename={updateProject}
            onSetStatus={setProjectStatus}
          />
        </SurfaceState>
      </main>
    </WorkspaceShell>
  );
}

// Баннер честности «Прототип» (зеркало profile-/deals-surface).
function ProtoBanner() {
  if (!prototypeNotesEnabled) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--text-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">
        Прототип
      </span>
      <span>
        Боевые контракты: GET /api/workspace/projects?status=…, POST /projects, PATCH /projects/:id,
        POST /projects/:id/&#123;reopen,pause,resume&#125;. Транспорт — contract-mock; переключение на боевой = apiOrigin. Данные in-memory.
      </span>
    </div>
  );
}

// Диалог ручного создания внутреннего проекта (POST /api/workspace/projects).
type MutationRun = () => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
function runMutation(run: MutationRun, okMsg: string, onOk?: () => void) {
  return async () => {
    const res = await run();
    if (res.ok) {
      toast.success(okMsg);
      onOk?.();
    } else {
      toast.error(mutationError(res.code));
    }
  };
}

function CreateProjectDialog({
  onCreate
}: {
  onCreate: (input: {
    title: string;
    plannedStart: string;
    plannedFinish: string;
  }) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [finish, setFinish] = useState("");

  const valid =
    title.trim().length > 0 &&
    start !== "" &&
    finish !== "" &&
    finish >= start;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    await runMutation(
      () => onCreate({ title: title.trim(), plannedStart: start, plannedFinish: finish }),
      "Проект создан",
      () => {
        setOpen(false);
        setTitle("");
        setStart("");
        setFinish("");
      }
    )();
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">Новый проект</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
          <DialogDescription>Внутренний проект без сделки CRM. Тип, шаблон и календарь можно задать позже.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
            Название проекта
            <Input value={title} disabled={busy} maxLength={160} placeholder="напр. Внутренний R&D" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
              Плановый старт
              <Input type="date" value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} className="w-[170px]" />
            </label>
            <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
              Плановый финиш
              <Input type="date" value={finish} disabled={busy} onChange={(e) => setFinish(e.target.value)} className="w-[170px]" />
            </label>
          </div>
          {finish !== "" && start !== "" && finish < start ? (
            <span className="text-[length:var(--text-xs)] text-[var(--danger)]">Финиш не может быть раньше старта.</span>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>Отмена</Button>
          </DialogClose>
          <Button variant="default" disabled={busy || !valid} onClick={() => void submit()}>Создать проект</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Диалог переименования проекта (PATCH /api/workspace/projects/:id, поле title).
function RenameProjectDialog({
  project,
  onRename
}: {
  project: ProjectRecord;
  onRename: (
    projectId: string,
    input: { title: string }
  ) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(project.title);

  const valid = title.trim().length > 0 && title.trim() !== project.title;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    await runMutation(() => onRename(project.id, { title: title.trim() }), "Название обновлено", () => setOpen(false))();
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setTitle(project.title); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Изменить</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Изменить проект</DialogTitle>
          <DialogDescription>Название проекта. Тип, шаблон и календарь редактируются в настройках проекта.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          Название проекта
          <Input value={title} disabled={busy} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>Отмена</Button>
          </DialogClose>
          <Button variant="default" disabled={busy || !valid} onClick={() => void submit()}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Действие статусного перехода с подтверждением (переоткрыть/пауза/возобновить).
function StatusAction({
  project,
  action,
  label,
  onSetStatus
}: {
  project: ProjectRecord;
  action: ProjectStatusAction;
  label: string;
  onSetStatus: (
    projectId: string,
    action: ProjectStatusAction
  ) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
}) {
  const okMsg =
    action === "reopen" ? "Проект переоткрыт" : action === "pause" ? "Проект приостановлен" : "Проект возобновлён";
  return (
    <ConfirmDialog
      title={`${label}: «${project.title}»?`}
      description="Действие изменит статус проекта и пересчитает загрузку ресурсов."
      confirmLabel={label}
      cancelLabel="Отмена"
      destructive={action === "pause"}
      onConfirm={runMutation(() => onSetStatus(project.id, action), okMsg)}
    >
      <Button variant="ghost" size="sm">{label}</Button>
    </ConfirmDialog>
  );
}

function RowActions({
  project,
  onRename,
  onSetStatus
}: {
  project: ProjectRecord;
  onRename: (projectId: string, input: { title: string }) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
  onSetStatus: (projectId: string, action: ProjectStatusAction) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
}) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      <RenameProjectDialog project={project} onRename={onRename} />
      {project.status === "active" ? (
        <StatusAction project={project} action="pause" label="Пауза" onSetStatus={onSetStatus} />
      ) : null}
      {project.status === "paused" ? (
        <StatusAction project={project} action="resume" label="Возобновить" onSetStatus={onSetStatus} />
      ) : null}
      {project.status === "closed" || project.status === "cancelled" ? (
        <StatusAction project={project} action="reopen" label="Переоткрыть" onSetStatus={onSetStatus} />
      ) : null}
    </span>
  );
}

// Таблица проектов: Проект · Клиент · Статус · Срок · Сумма · План.часы · Действия.
function ProjectsTable({
  projects,
  userColor,
  onRename,
  onSetStatus
}: {
  projects: ProjectRecord[];
  userColor: (id: string) => BemAvatarColor;
  onRename: (projectId: string, input: { title: string }) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
  onSetStatus: (projectId: string, action: ProjectStatusAction) => Promise<{ ok: true } | { ok: false; code?: string; message?: string }>;
}) {
  return (
    <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <table className="w-full border-collapse text-[length:var(--text-sm)]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
            <th className="px-3 py-2 font-semibold">Проект</th>
            <th className="px-3 py-2 font-semibold">Клиент</th>
            <th className="px-3 py-2 font-semibold">Статус</th>
            <th className="px-3 py-2 font-semibold">Срок</th>
            <th className="px-3 py-2 text-right font-semibold">Сумма</th>
            <th className="px-3 py-2 text-right font-semibold">План.часы</th>
            <th className="px-3 py-2 text-right font-semibold">Действия</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              className="v4-row border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--panel-subtle)]"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium text-[var(--text-strong)] hover:underline focus-visible:underline"
                >
                  {p.title}
                </Link>
                {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p.id}</div> : null}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <BemAvatar initials={initials(p.clientName)} color={userColor(p.clientId ?? p.clientName)} size="sm" title={p.clientName} />
                  <span className="text-[var(--muted-strong)]">{p.clientName}</span>
                </span>
              </td>
              <td className="px-3 py-2">
                <Chip variant={statusVariant(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Chip>
              </td>
              <td className="px-3 py-2">
                <span className="v4-num whitespace-nowrap text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                  {fmtDate(p.plannedStart)} — {fmtDate(p.plannedFinish)}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="v4-num font-semibold text-[var(--text-strong)]">{money(p.contractValue)}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="v4-num text-[var(--muted-strong)]">{p.plannedHours.toLocaleString("ru-RU")} ч</span>
              </td>
              <td className="px-3 py-2 text-right">
                <RowActions project={p} onRename={onRename} onSetStatus={onSetStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
