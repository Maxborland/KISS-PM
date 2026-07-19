"use client";

import { useState } from "react";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState } from "@/components/domain/surface-state";
import { adminErr } from "@/admin/ui/admin-bits";
import { makeRuError } from "@/lib/error-messages";
import { useSessionUser } from "@/shell/use-session-user";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import type { Position } from "@/admin/lib/admin-client";
import type { TaskStatusCategory, WorkspaceTaskStatus } from "@/workspace/lib/workspace-client";
import { usePositionsReference, useTaskStatusesReference, type ReferencesLoadStatus } from "./use-references";

/* ============================================================
   Workspace «Настройки → Справочники» (Н12): должности и статусы задач.
   Оба справочника — ПОЛНЫЙ цикл поверх боевых контрактов:
   - должности: GET/POST/PATCH/DELETE /api/workspace/positions
     (удаление занятой должности сервер отклоняет: 409 position_assigned);
   - статусы задач: GET/POST/PATCH/DELETE /api/workspace/task-statuses
     (DELETE = архив; системные статусы не архивируются и не меняют
     категорию: 409 system_task_status_required / …_category_locked).
   Мутации — только с подтверждением/через диалог, ошибки — честные RU-тексты кодов.
   ============================================================ */

const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";
const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60 [@media(pointer:coarse)]:min-h-[var(--touch-target)]";
const thCls = "px-3 py-2 font-semibold";

// RU-маппер кодов справочника статусов (боевые коды taskStatusRoutes/taskStatusWorkspace + parseCreateTaskStatusBody).
const STATUS_ERR: Record<string, string> = {
  invalid_task_status_id: "Идентификатор статуса: a-z, 0-9, _-, длина 3…120",
  invalid_task_status_name: "Название статуса — от 2 до 80 символов",
  invalid_task_status_category: "Выберите категорию статуса",
  invalid_task_status_sort_order: "Порядок — целое число от 1 до 10000",
  invalid_task_status_state: "Некорректное состояние статуса",
  task_status_id_taken: "Идентификатор статуса уже занят",
  task_status_name_taken: "Статус с таким названием уже существует",
  task_status_sort_order_taken: "Этот порядковый номер уже занят другим статусом",
  task_status_not_found: "Статус не найден",
  system_task_status_required: "Системный статус нельзя архивировать — он обязателен для процесса задач",
  system_task_status_category_locked: "У системного статуса нельзя менять категорию"
};
export const taskStatusErr = makeRuError(STATUS_ERR, "Не удалось выполнить действие");

// Категории (боевой check task_statuses_category_chk) — подписи по-русски.
const CATEGORY_LABEL: Record<TaskStatusCategory, string> = {
  new: "Новая",
  waiting: "Ожидание",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово"
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskStatusCategory[];

// Слаг из названия → допустимый идентификатор (id обязателен в боевом parseCreateTaskStatusBody).
// Зеркало slugify из roles-surface: транслит не делаем — кириллица отбрасывается, поэтому суффикс-время.
const slugify = (prefix: string, name: string): string => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const id = base.length >= 3 ? base : `${base || prefix}-${Date.now().toString(36)}`;
  return `${prefix}-${id}`.replace(new RegExp(`^${prefix}-${prefix}-`), `${prefix}-`).slice(0, 120);
};

const surfaceStatusOf = (status: ReferencesLoadStatus, empty: boolean) =>
  status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : status === "error" ? "error" : empty ? "empty" : "ready";

export function ReferencesTab() {
  const sessionUser = useSessionUser();
  const permissions = sessionUser?.permissions ?? [];
  return (
    <div className="flex flex-col gap-4">
      {prototypeNotesEnabled ? (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальные контракты: GET/POST/PATCH/DELETE /api/workspace/positions (RBAC tenant.positions.manage) и /api/workspace/task-statuses (RBAC tenant.task_statuses.manage; DELETE = архив, системные статусы защищены). Клиенты createAdminClient/createWorkspaceClient + contract-mock; swap = apiOrigin.</span>
        </div>
      ) : null}
      <PositionsSection canManage={permissions.includes("tenant.positions.manage")} />
      <TaskStatusesSection canManage={permissions.includes("tenant.task_statuses.manage")} />
    </div>
  );
}

/* ============================ Должности ============================ */

function PositionsSection({ canManage }: { canManage: boolean }) {
  const { positions, status, error, reload, createPosition, updatePosition, deletePosition } = usePositionsReference();
  const [busy, setBusy] = useState(false);
  const disabledReason = canManage ? undefined : "Недостаточно прав для управления должностями (tenant.positions.manage).";

  const remove = async (p: Position) => {
    setBusy(true);
    const res = await deletePosition(p.id);
    setBusy(false);
    if (res.ok) toast.success(`Должность «${p.name}» удалена`);
    else toast.error(`Отклонено: ${adminErr(res.code, res.message)}`);
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">Должности</h2>
          <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Справочник должностей: назначаются пользователям, участвуют в планировании мощности</p>
        </div>
        <PositionFormDialog
          mode="create"
          busy={busy}
          setBusy={setBusy}
          submit={(input) => createPosition(input)}
          disabledReason={disabledReason}
        />
      </div>
      <div className="p-0">
        <SurfaceState
          status={surfaceStatusOf(status, (positions ?? []).length === 0)}
          error={error}
          onRetry={() => void reload()}
          errorFormat={(c) => adminErr(c)}
          empty={{ title: "Должностей пока нет", description: "Создайте первую должность справочника." }}
        >
          {positions ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[length:var(--text-sm)]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                    <th className={thCls}>Название</th>
                    <th className={thCls}>Описание</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--text-strong)]">{p.name}</div>
                        {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{p.id}</div> : null}
                      </td>
                      <td className="max-w-[420px] px-3 py-2 text-[var(--muted)]">{p.description ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <PositionFormDialog
                            mode="edit"
                            position={p}
                            busy={busy}
                            setBusy={setBusy}
                            submit={(input) => updatePosition(p.id, input)}
                            disabledReason={disabledReason}
                          />
                          <ConfirmDialog
                            title={`Удалить должность «${p.name}»?`}
                            description="Действие необратимо. Должность, назначенную пользователям, сервер удалить не даст — сначала переназначьте их."
                            confirmLabel="Удалить"
                            onConfirm={() => remove(p)}
                          >
                            <Button variant="ghost" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Удалить"} aria-label={`Удалить должность «${p.name}»`}>
                              <Trash2 className="size-3.5" aria-hidden />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SurfaceState>
      </div>
    </section>
  );
}

function PositionFormDialog({ mode, position, busy, setBusy, submit, disabledReason }: {
  mode: "create" | "edit";
  position?: Position;
  busy: boolean; setBusy: (v: boolean) => void;
  submit: (input: { name: string; description: string | null }) => Promise<{ ok: true } | { ok: false; code?: string; message: string }>;
  disabledReason?: string | undefined;
}) {
  const [name, setName] = useState(position?.name ?? "");
  const [description, setDescription] = useState(position?.description ?? "");
  const valid = name.trim().length > 0 && name.trim().length <= 160 && description.trim().length <= 1000;
  const isEdit = mode === "edit";

  return (
    <FormDialog
      title={isEdit ? "Изменить должность" : "Новая должность"}
      trigger={
        isEdit ? (
          <Button variant="ghost" size="sm" disabled={Boolean(disabledReason)} title={disabledReason ?? "Изменить"} aria-label={`Изменить должность «${position?.name ?? ""}»`}>
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        ) : (
          <Button variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Создать должность"}>
            <Plus className="size-3.5" aria-hidden />
            Создать должность
          </Button>
        )
      }
      onOpenChange={(v) => {
        if (v) { setName(position?.name ?? ""); setDescription(position?.description ?? ""); }
      }}
      submitLabel={isEdit ? <><Pencil className="size-3.5" aria-hidden />Сохранить</> : <><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[480px]"
      successToast={isEdit ? `Должность «${name.trim()}» обновлена` : `Должность «${name.trim()}» создана`}
      onSubmit={async () => {
        if (disabledReason) return disabledReason;
        if (!valid) return null;
        setBusy(true);
        const res = await submit({ name: name.trim(), description: description.trim() ? description.trim() : null });
        setBusy(false);
        return res.ok ? null : adminErr(res.code, res.message);
      }}
      onSuccess={() => { if (!isEdit) { setName(""); setDescription(""); } }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Название
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Инженер-проектировщик" aria-invalid={name.trim().length > 160} />
        </label>
        <label className={labelCls}>Описание (необязательно)
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Зона ответственности, требования…" rows={3} aria-invalid={description.trim().length > 1000} />
        </label>
      </div>
    </FormDialog>
  );
}

/* ============================ Статусы задач ============================ */

function TaskStatusesSection({ canManage }: { canManage: boolean }) {
  const { taskStatuses, status, error, reload, createTaskStatus, updateTaskStatus, archiveTaskStatus } = useTaskStatusesReference();
  const [busy, setBusy] = useState(false);
  const disabledReason = canManage ? undefined : "Недостаточно прав для управления статусами задач (tenant.task_statuses.manage).";

  const archive = async (s: WorkspaceTaskStatus) => {
    setBusy(true);
    const res = await archiveTaskStatus(s.id);
    setBusy(false);
    if (res.ok) toast.success(`Статус «${s.name}» перенесён в архив`);
    else toast.error(`Отклонено: ${taskStatusErr(res.code, res.message)}`);
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">Статусы задач</h2>
          <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Колонки канбана и селект статуса задачи. Системные статусы защищены: их нельзя архивировать и менять категорию</p>
        </div>
        <TaskStatusFormDialog
          mode="create"
          existing={taskStatuses ?? []}
          busy={busy}
          setBusy={setBusy}
          submit={(input) => createTaskStatus({ ...input, id: slugify("status", input.name) })}
          disabledReason={disabledReason}
        />
      </div>
      <div className="p-0">
        <SurfaceState
          status={surfaceStatusOf(status, (taskStatuses ?? []).length === 0)}
          error={error}
          onRetry={() => void reload()}
          errorFormat={(c) => taskStatusErr(c)}
          empty={{ title: "Статусов пока нет", description: "Создайте первый статус задач." }}
        >
          {taskStatuses ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[length:var(--text-sm)]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                    <th className={thCls}>Порядок</th>
                    <th className={thCls}>Название</th>
                    <th className={thCls}>Категория</th>
                    <th className={thCls}>Тип</th>
                    <th className={thCls}>Состояние</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {taskStatuses.map((s) => (
                    <tr key={s.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                      <td className="v4-num px-3 py-2 text-[var(--muted)]">{s.sortOrder}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--text-strong)]">{s.name}</div>
                        {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{s.id}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">{CATEGORY_LABEL[s.category]}</td>
                      <td className="px-3 py-2">{s.isSystem ? <Chip variant="info">Системный</Chip> : <Chip variant="violet">Пользовательский</Chip>}</td>
                      <td className="px-3 py-2">
                        {s.status === "archived"
                          ? <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">В архиве</span>
                          : <Chip variant="success">Активен</Chip>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <TaskStatusFormDialog
                            mode="edit"
                            taskStatus={s}
                            existing={taskStatuses}
                            busy={busy}
                            setBusy={setBusy}
                            submit={(input) => updateTaskStatus(s.id, input)}
                            disabledReason={disabledReason}
                          />
                          {s.status === "archived" ? null : (
                            <ConfirmDialog
                              title={`Архивировать статус «${s.name}»?`}
                              description="Статус станет недоступен для новых переходов задач; существующие задачи не изменятся. Разархивировать можно правкой статуса."
                              confirmLabel="В архив"
                              onConfirm={() => archive(s)}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy || Boolean(disabledReason) || s.isSystem}
                                title={disabledReason ?? (s.isSystem ? "Системный статус нельзя архивировать" : "Архивировать")}
                                aria-label={`Архивировать статус «${s.name}»`}
                              >
                                <Archive className="size-3.5" aria-hidden />
                              </Button>
                            </ConfirmDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SurfaceState>
      </div>
    </section>
  );
}

function TaskStatusFormDialog({ mode, taskStatus, existing, busy, setBusy, submit, disabledReason }: {
  mode: "create" | "edit";
  taskStatus?: WorkspaceTaskStatus;
  existing: WorkspaceTaskStatus[];
  busy: boolean; setBusy: (v: boolean) => void;
  submit: (input: { name: string; category: TaskStatusCategory; sortOrder: number; status: "active" | "archived" }) => Promise<{ ok: true } | { ok: false; code?: string; message: string }>;
  disabledReason?: string | undefined;
}) {
  const isEdit = mode === "edit";
  const nextSortOrder = () => (existing.length > 0 ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 1);
  const [name, setName] = useState(taskStatus?.name ?? "");
  const [category, setCategory] = useState<TaskStatusCategory>(taskStatus?.category ?? "in_progress");
  const [sortOrder, setSortOrder] = useState<number>(taskStatus?.sortOrder ?? 0);
  const [active, setActive] = useState<boolean>(taskStatus ? taskStatus.status === "active" : true);

  const sortOrderValid = Number.isInteger(sortOrder) && sortOrder >= 1 && sortOrder <= 10000;
  const valid = name.trim().length >= 2 && name.trim().length <= 80 && sortOrderValid;
  const categoryLocked = Boolean(taskStatus?.isSystem);

  return (
    <FormDialog
      title={isEdit ? "Изменить статус задач" : "Новый статус задач"}
      trigger={
        isEdit ? (
          <Button variant="ghost" size="sm" disabled={Boolean(disabledReason)} title={disabledReason ?? "Изменить"} aria-label={`Изменить статус «${taskStatus?.name ?? ""}»`}>
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        ) : (
          <Button variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Создать статус"}>
            <Plus className="size-3.5" aria-hidden />
            Создать статус
          </Button>
        )
      }
      onOpenChange={(v) => {
        if (v) {
          setName(taskStatus?.name ?? "");
          setCategory(taskStatus?.category ?? "in_progress");
          setSortOrder(taskStatus?.sortOrder ?? nextSortOrder());
          setActive(taskStatus ? taskStatus.status === "active" : true);
        }
      }}
      submitLabel={isEdit ? <><Pencil className="size-3.5" aria-hidden />Сохранить</> : <><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[480px]"
      successToast={isEdit ? `Статус «${name.trim()}» обновлён` : `Статус «${name.trim()}» создан`}
      onSubmit={async () => {
        if (disabledReason) return disabledReason;
        if (!valid) return null;
        setBusy(true);
        const res = await submit({ name: name.trim(), category, sortOrder, status: active ? "active" : "archived" });
        setBusy(false);
        return res.ok ? null : taskStatusErr(res.code, res.message);
      }}
      onSuccess={() => { if (!isEdit) { setName(""); setCategory("in_progress"); setSortOrder(0); setActive(true); } }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Название (2…80 символов)
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Согласование" aria-invalid={name.trim().length > 0 && !(name.trim().length >= 2 && name.trim().length <= 80)} />
        </label>
        <label className={labelCls}>Категория
          <select value={category} onChange={(e) => setCategory(e.target.value as TaskStatusCategory)} className={selCls} disabled={categoryLocked}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          {categoryLocked ? <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">У системного статуса категория зафиксирована (сервер отклонит смену).</span> : <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Категория определяет правила переходов задач.</span>}
        </label>
        <label className={labelCls}>Порядок (1…10000)
          <Input type="number" min={1} max={10000} value={sortOrder === 0 ? "" : String(sortOrder)} onChange={(e) => setSortOrder(Math.trunc(Number(e.target.value)) || 0)} aria-invalid={sortOrder !== 0 && !sortOrderValid} className="w-28" />
        </label>
        {isEdit && !taskStatus?.isSystem ? (
          <label className={labelCls}>Состояние
            <select value={active ? "active" : "archived"} onChange={(e) => setActive(e.target.value === "active")} className={selCls}>
              <option value="active">Активен</option>
              <option value="archived">В архиве</option>
            </select>
          </label>
        ) : null}
      </div>
    </FormDialog>
  );
}
