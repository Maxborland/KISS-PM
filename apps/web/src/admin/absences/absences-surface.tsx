"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { useAbsences } from "@/admin/lib/use-admin-ops";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { useSessionUser } from "@/shell/use-session-user";
import { makeRuError } from "@/lib/error-messages";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { ABSENCE_TYPES, type AbsenceType, type ResourceAbsence, type WorkspaceUser } from "@/admin/lib/admin-client";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60 [@media(pointer:coarse)]:min-h-[var(--touch-target)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// RU-коды ошибок отсутствий (зеркало absencesRoutes).
const absencesErr = makeRuError({
  resource_absence_invalid: "Некорректные данные отсутствия",
  resource_absence_invalid_range: "Некорректный период: конец не раньше начала, длительность до 370 дней",
  resource_absence_not_found: "Отсутствие не найдено — список обновлён",
  invalid_user_id: "Выберите сотрудника",
  invalid_absence_id: "Некорректный идентификатор отсутствия"
}, "Не удалось выполнить действие");

// Типы отсутствий (боевой RESOURCE_ABSENCE_TYPES) — RU-подписи.
export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  vacation: "Отпуск",
  admin_leave: "Административный отпуск",
  sick_leave: "Больничный",
  maternity_leave: "Декретный отпуск",
  truancy: "Прогул"
};

const fmtDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
};

const daysBetween = (fromIso: string, toIso: string): number | null => {
  const from = new Date(`${fromIso}T00:00:00.000Z`).getTime();
  const to = new Date(`${toIso}T00:00:00.000Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  return Math.round((to - from) / 86_400_000) + 1;
};

// Дефолтный период: ±180 дней вокруг сегодня (361 день — внутри боевого лимита 370).
const defaultRange = (): { from: string; to: string } => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  return { from: day(-180), to: day(180) };
};

/**
 * Admin «Отсутствия» (Н3) — отпуска/больничные сотрудников на боевом контракте
 * /api/tenant/current/absences (createAdminClient + in-memory mock, swap = apiOrigin).
 * Чтение — tenant.absences.read (403 → «Доступ ограничен»), создание/удаление —
 * tenant.absences.manage; удаление только через подтверждение.
 */
export function AdminAbsencesSurface() {
  const { live } = useAdminRuntime();
  const [range, setRange] = useState(defaultRange());
  const { absences, users, hasData, status, error, reload, create, remove } = useAbsences(range.from, range.to);
  const [busy, setBusy] = useState(false);
  const sessionUser = useSessionUser();

  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name);
    return m;
  }, [users]);
  // Имя сотрудника; если справочник пользователей роли недоступен (403) — фолбэк, не сырой id.
  const who = (userId: string): string => userName.get(userId) ?? `Участник ${userId.slice(-4)}`;

  const canManage = sessionUser?.permissions.includes("tenant.absences.manage") ?? false;
  const createDisabledReason = !canManage
    ? "Недостаточно прав для управления отсутствиями."
    : users.length === 0
      ? "Создание недоступно: справочник сотрудников не загрузился (нет права чтения пользователей)."
      : undefined;

  const surfaceStatus = surfaceStatusOf(status, hasData);

  const removeAbsence = async (a: ResourceAbsence) => {
    setBusy(true);
    const res = await remove(a.id);
    setBusy(false);
    if (res.ok) toast.success("Отсутствие удалено");
    else toast.error(`Отклонено: ${absencesErr(res.code, res.message)}`);
  };

  return (
    <AdminFrame
      activeTab="Отсутствия"
      subtitle="Отсутствия уменьшают доступную ёмкость ресурса в планировании и расчёте осуществимости на период отсутствия"
      actions={<CreateAbsenceDialog users={users} busy={busy} setBusy={setBusy} create={create} disabledReason={createDisabledReason} />}
    >
      <div data-testid="absences-page">
        {!live ? (
          <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
            <span>Реальный контракт: GET/POST/DELETE /api/tenant/current/absences (createAdminClient + in-memory mock, swap = apiOrigin). GET требует обязательный период fromDate..toDate ≤ 370 дней. Чтение — tenant.absences.read, мутации — tenant.absences.manage.</span>
          </div>
        ) : null}

        {/* Фильтр периода: GET без периода невозможен (боевой контракт) — период всегда явный. */}
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <label className={labelCls}>Период с
            <Input type="date" value={range.from} onChange={(e) => { if (e.target.value) setRange((r) => ({ ...r, from: e.target.value })); }} className="h-8 w-[160px] text-[length:var(--text-xs)]" />
          </label>
          <label className={labelCls}>по
            <Input type="date" value={range.to} onChange={(e) => { if (e.target.value) setRange((r) => ({ ...r, to: e.target.value })); }} className="h-8 w-[160px] text-[length:var(--text-xs)]" />
          </label>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={(c) => absencesErr(c)}
          empty={{ title: "Отсутствий за период нет", description: "Добавьте отпуск, больничный или другой невыход — планирование учтёт его автоматически." }}
        >
          <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <table data-testid="absences-table" className="w-full border-collapse text-[length:var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                  <th className="px-3 py-2 font-semibold">Сотрудник</th>
                  <th className="px-3 py-2 font-semibold">Тип</th>
                  <th className="px-3 py-2 font-semibold">Период</th>
                  <th className="px-3 py-2 font-semibold">Дней</th>
                  <th className="px-3 py-2 font-semibold">Причина</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2" data-testid={`absence-cell-${a.userId}-${a.dateFrom}`}>
                      <div className="font-medium text-[var(--text-strong)]">{who(a.userId)}</div>
                      {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{a.userId}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-strong)]">{ABSENCE_TYPE_LABEL[a.type] ?? a.type}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{fmtDay(a.dateFrom)} — {fmtDay(a.dateTo)}</td>
                    <td className="px-3 py-2 text-[var(--muted-strong)]">{daysBetween(a.dateFrom, a.dateTo) ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{a.reason ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end">
                        <ConfirmDialog
                          title={`Удалить отсутствие «${who(a.userId)}»?`}
                          description={`${ABSENCE_TYPE_LABEL[a.type] ?? a.type}, ${fmtDay(a.dateFrom)} — ${fmtDay(a.dateTo)}. Ёмкость ресурса на этот период снова станет доступной планированию.`}
                          confirmLabel="Удалить"
                          onConfirm={() => removeAbsence(a)}
                        >
                          <Button variant="ghost" size="sm" disabled={busy || !canManage} title={canManage ? "Удалить" : "Недостаточно прав для управления отсутствиями."}><Trash2 className="size-3.5" aria-hidden /></Button>
                        </ConfirmDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
            Показаны отсутствия, пересекающие период {fmtDay(range.from)} — {fmtDay(range.to)}.
          </p>
        </SurfaceState>
      </div>
    </AdminFrame>
  );
}

function CreateAbsenceDialog({ users, busy, setBusy, create, disabledReason }: {
  users: WorkspaceUser[];
  busy: boolean; setBusy: (v: boolean) => void;
  create: ReturnType<typeof useAbsences>["create"];
  disabledReason?: string | undefined;
}) {
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<AbsenceType>("vacation");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");

  const days = dateFrom && dateTo ? daysBetween(dateFrom, dateTo) : null;
  const valid = userId.length > 0 && dateFrom.length > 0 && dateTo.length > 0 && days !== null && days <= 370;

  return (
    <FormDialog
      title="Новое отсутствие"
      trigger={<Button data-testid="absence-create-open" variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Добавить отсутствие"}><Plus className="size-3.5" aria-hidden />Добавить отсутствие</Button>}
      submitLabel="Сохранить"
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[480px]"
      successToast="Отсутствие добавлено"
      onSubmit={async () => {
        if (disabledReason) return disabledReason;
        if (!valid) return null;
        setBusy(true);
        const res = await create({ userId, type, dateFrom, dateTo, reason: reason.trim() || null });
        setBusy(false);
        return res.ok ? null : absencesErr(res.code, res.message);
      }}
      onSuccess={() => { setUserId(""); setType("vacation"); setDateFrom(""); setDateTo(""); setReason(""); }}
    >
      <div data-testid="absence-create-dialog" className="flex flex-col gap-3">
        <label className={labelCls}>Сотрудник
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selCls} disabled={users.length === 0}>
            <option value="">— выберите сотрудника —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className={labelCls}>Тип отсутствия
          <select value={type} onChange={(e) => setType(e.target.value as AbsenceType)} className={selCls}>
            {ABSENCE_TYPES.map((t) => <option key={t} value={t}>{ABSENCE_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>С даты<Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label className={labelCls}>По дату<Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-invalid={Boolean(dateFrom && dateTo && days === null)} /></label>
        </div>
        {days !== null ? (
          <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">{days > 370 ? "Период слишком длинный: максимум 370 дней." : `Длительность: ${days} дн. Ёмкость ресурса на эти дни будет исключена из планирования.`}</p>
        ) : dateFrom && dateTo ? (
          <p className="text-[length:var(--text-xs)] text-[var(--danger)]">Дата окончания раньше даты начала.</p>
        ) : null}
        <label className={labelCls}>Причина (необязательно)<Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="комментарий до 500 символов" maxLength={500} /></label>
      </div>
    </FormDialog>
  );
}
