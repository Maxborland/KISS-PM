"use client";

import { useState } from "react";
import { Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/domain/form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { useProductionCalendar } from "@/admin/lib/use-admin-ops";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { useSessionUser } from "@/shell/use-session-user";
import { makeRuError } from "@/lib/error-messages";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60 [@media(pointer:coarse)]:min-h-[var(--touch-target)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// RU-коды ошибок календаря (зеркало productionCalendarRoutes).
const calendarErr = makeRuError({
  production_calendar_invalid: "Некорректные данные календаря: дата, минуты 0…1440, причина до 240 символов",
  production_calendar_exception_not_found: "Исключение уже удалено — обновите страницу"
}, "Не удалось выполнить действие");

const WEEKDAY_LABEL: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

const fmtDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).format(d);
};

const fmtMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
};

/**
 * Admin «Произв. календарь» (Н3) — рабочие дни/часы тенанта и исключения
 * (праздники, сокращённые дни) на боевом контракте:
 * GET /api/tenant/current/production-calendar, PATCH (базовый режим недели),
 * POST /bulk (upsert исключений), DELETE /exceptions/:id (удаление исключения).
 * Чтение — tenant.workspace_config.read, правка — tenant.workspace_config.manage.
 */
export function AdminProductionCalendarSurface() {
  const { live } = useAdminRuntime();
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const { calendar, status, error, reload, upsertExceptions, updateBaseMode, deleteException } = useProductionCalendar(year);
  const [busy, setBusy] = useState(false);
  const sessionUser = useSessionUser();

  const canManage = sessionUser?.permissions.includes("tenant.workspace_config.manage") ?? false;
  const manageDisabledReason = canManage ? undefined : "Недостаточно прав: нужна настройка рабочей области (workspace_config.manage).";

  const surfaceStatus = surfaceStatusOf(status, calendar !== null);
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const removeException = async (exceptionId: string) => {
    setBusy(true);
    const res = await deleteException(exceptionId);
    setBusy(false);
    if (res.ok) toast.success("Исключение календаря удалено");
    else toast.error(`Отклонено: ${calendarErr(res.code, res.message)}`);
  };

  return (
    <AdminFrame
      activeTab="Произв. календарь"
      subtitle="Календарь определяет рабочие дни и часы тенанта: от него считаются ёмкость ресурсов, сроки и осуществимость планов"
      actions={<AddExceptionDialog busy={busy} setBusy={setBusy} upsert={upsertExceptions} existing={calendar?.exceptions ?? []} disabledReason={manageDisabledReason} />}
    >
      <div data-testid="production-calendar-page">
        {!live ? (
          <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
            <span>Реальный контракт: GET /api/tenant/current/production-calendar?year=YYYY, PATCH (базовый режим), POST /bulk (upsert исключений), DELETE /exceptions/:id. Чтение — tenant.workspace_config.read, правка — tenant.workspace_config.manage.</span>
          </div>
        ) : null}

        <div className="mb-2 flex flex-wrap items-end gap-2">
          <label className={labelCls}>Год
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)]">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={(c) => calendarErr(c)}
        >
          {calendar ? (
            <>
              {/* Базовый режим недели тенанта */}
              <div className="mb-3 flex flex-wrap items-stretch gap-2">
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-card)]">
                  <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">Рабочие дни</div>
                  <div className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
                    {calendar.workingWeekdays.map((d) => WEEKDAY_LABEL[d] ?? d).join(", ") || "—"}
                  </div>
                </div>
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-card)]">
                  <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">Рабочий день</div>
                  <div className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{fmtMinutes(calendar.workingMinutesPerDay)}</div>
                </div>
                {prototypeNotesEnabled ? (
                  <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-3 py-2">
                    <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">Календарь</div>
                    <div className="v4-mono text-[length:var(--text-xs)] text-[var(--muted-soft)]">{calendar.calendarId}</div>
                  </div>
                ) : null}
                <div className="flex items-center">
                  <EditBaseModeDialog
                    busy={busy}
                    setBusy={setBusy}
                    update={updateBaseMode}
                    current={{ workingWeekdays: calendar.workingWeekdays, workingMinutesPerDay: calendar.workingMinutesPerDay }}
                    disabledReason={manageDisabledReason}
                  />
                </div>
              </div>

              {calendar.exceptions.length === 0 ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-6 text-center shadow-[var(--shadow-card)]">
                  <div data-testid="production-calendar-grid" className="text-[length:var(--text-sm)] text-[var(--muted-soft)]">
                    Исключений на {calendar.year} год нет — действует базовый режим недели.
                  </div>
                </div>
              ) : (
                <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
                  <table data-testid="production-calendar-grid" className="w-full border-collapse text-[length:var(--text-sm)]">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                        <th className="px-3 py-2 font-semibold">Дата</th>
                        <th className="px-3 py-2 font-semibold">Режим</th>
                        <th className="px-3 py-2 font-semibold">Причина</th>
                        <th className="px-3 py-2 font-semibold">Область</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {calendar.exceptions.map((e) => (
                        <tr key={e.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                          <td className="px-3 py-2 font-medium text-[var(--text-strong)]">{fmtDay(e.date)}</td>
                          <td className="px-3 py-2">
                            {e.workingMinutes === 0
                              ? <Chip variant="danger">Выходной</Chip>
                              : <Chip variant="info">Рабочий · {fmtMinutes(e.workingMinutes)}</Chip>}
                          </td>
                          <td className="px-3 py-2 text-[var(--muted)]">{e.reason ?? "—"}</td>
                          <td className="px-3 py-2 text-[var(--muted-strong)]">{e.resourceId ? `Участник ${e.resourceId.slice(-4)}` : "Вся команда"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end">
                              <ConfirmDialog
                                title={`Сбросить день ${fmtDay(e.date)}?`}
                                description={`Исключение${e.reason ? ` «${e.reason}»` : ""} будет удалено — на эту дату вернётся базовый режим недели, и ёмкость пересчитается автоматически.`}
                                confirmLabel="Удалить"
                                onConfirm={() => removeException(e.id)}
                              >
                                <Button data-testid={`production-calendar-delete-${e.id}`} variant="ghost" size="sm" disabled={busy || !canManage} title={canManage ? "Удалить/Сбросить день" : manageDisabledReason}><Trash2 className="size-3.5" aria-hidden /></Button>
                              </ConfirmDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
                Ошибочный праздник или сокращённый день можно удалить кнопкой «Сбросить день» — на эту дату вернётся базовый режим недели.
              </p>
            </>
          ) : <></>}
        </SurfaceState>
      </div>
    </AdminFrame>
  );
}

function AddExceptionDialog({ busy, setBusy, upsert, existing, disabledReason }: {
  existing: Array<{ id: string; date: string; resourceId: string | null }>;
  busy: boolean; setBusy: (v: boolean) => void;
  upsert: ReturnType<typeof useProductionCalendar>["upsertExceptions"];
  disabledReason?: string | undefined;
}) {
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<"day_off" | "short_day">("day_off");
  const [minutes, setMinutes] = useState("420");
  const [reason, setReason] = useState("");

  const parsedMinutes = mode === "day_off" ? 0 : Number.parseInt(minutes, 10);
  const minutesValid = mode === "day_off" || (Number.isInteger(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 1440);
  const valid = date.length > 0 && minutesValid && reason.trim().length <= 240;

  return (
    <FormDialog
      title="Новое исключение календаря"
      trigger={<Button data-testid="production-calendar-add-exception" variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Добавить исключение"}><Plus className="size-3.5" aria-hidden />Добавить исключение</Button>}
      submitLabel="Сохранить"
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[440px]"
      successToast="Исключение календаря сохранено"
      onSubmit={async () => {
        if (disabledReason) return disabledReason;
        if (!valid) return null;
        setBusy(true);
        // Reuse id существующего исключения той же даты (ревью #262): без него
        // «повторное добавление для уточнения» вставляло бы дубль (сервер апсертит
        // по (tenantId, id), не по дате). Базовый календарь — resourceId null.
        const existingId = existing.find((e) => e.date === date && e.resourceId === null)?.id;
        const res = await upsert([{ ...(existingId ? { id: existingId } : {}), date, workingMinutes: parsedMinutes, reason: reason.trim() || null }]);
        setBusy(false);
        return res.ok ? null : calendarErr(res.code, res.message);
      }}
      onSuccess={() => { setDate(""); setMode("day_off"); setMinutes("420"); setReason(""); }}
    >
      <div data-testid="production-calendar-exception-dialog" className="flex flex-col gap-3">
        <label className={labelCls}>Дата<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className={labelCls}>Режим дня
          <select value={mode} onChange={(e) => setMode(e.target.value as "day_off" | "short_day")} className={selCls}>
            <option value="day_off">Выходной (0 минут)</option>
            <option value="short_day">Рабочий с особой длительностью</option>
          </select>
        </label>
        {mode === "short_day" ? (
          <label className={labelCls}>Рабочих минут (1…1440)
            <Input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!minutesValid} />
          </label>
        ) : null}
        <label className={labelCls}>Причина (необязательно)<Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="например, государственный праздник" maxLength={240} /></label>
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Исключение действует на всю команду и сразу учитывается в расчётах ёмкости и сроков.</p>
      </div>
    </FormDialog>
  );
}

/**
 * Редактирование базового режима недели тенанта (PATCH …/production-calendar):
 * рабочие дни (ISO 1..7) + длительность рабочего дня в минутах (1…1440).
 * От базового режима считаются ёмкость ресурсов, CPM и осуществимость планов.
 */
function EditBaseModeDialog({ busy, setBusy, update, current, disabledReason }: {
  busy: boolean; setBusy: (v: boolean) => void;
  update: ReturnType<typeof useProductionCalendar>["updateBaseMode"];
  current: { workingWeekdays: number[]; workingMinutesPerDay: number };
  disabledReason?: string | undefined;
}) {
  const [weekdays, setWeekdays] = useState<number[]>(current.workingWeekdays);
  const [minutes, setMinutes] = useState(String(current.workingMinutesPerDay));

  const reset = () => { setWeekdays(current.workingWeekdays); setMinutes(String(current.workingMinutesPerDay)); };
  const toggle = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));

  const parsedMinutes = Number.parseInt(minutes, 10);
  const minutesValid = Number.isInteger(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 1440;
  const valid = weekdays.length >= 1 && minutesValid;

  return (
    <FormDialog
      title="Базовый режим недели"
      trigger={<Button data-testid="production-calendar-edit-base-mode" variant="outline" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Изменить базовый режим"}><SlidersHorizontal className="size-3.5" aria-hidden />Базовый режим</Button>}
      submitLabel="Сохранить"
      submitDisabled={!valid || busy || Boolean(disabledReason)}
      contentClassName="max-w-[440px]"
      successToast="Базовый режим недели обновлён"
      onSubmit={async () => {
        if (disabledReason) return disabledReason;
        if (!valid) return null;
        setBusy(true);
        const res = await update({ workingWeekdays: weekdays, workingMinutesPerDay: parsedMinutes });
        setBusy(false);
        return res.ok ? null : calendarErr(res.code, res.message);
      }}
      onOpenChange={(open) => { if (open) reset(); }}
    >
      <div data-testid="production-calendar-base-mode-dialog" className="flex flex-col gap-3">
        <div className={labelCls}>Рабочие дни недели
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEEKDAY_ORDER.map((day) => {
              const on = weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  data-testid={`production-calendar-weekday-${day}`}
                  aria-pressed={on}
                  onClick={() => toggle(day)}
                  className={`h-8 min-w-9 rounded-[var(--radius-md)] border px-2 text-[length:var(--text-xs)] font-semibold transition-colors ${on ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted-strong)]"}`}
                >
                  {WEEKDAY_LABEL[day]}
                </button>
              );
            })}
          </div>
        </div>
        <label className={labelCls}>Минут в рабочем дне (1…1440)
          <Input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!minutesValid} />
          {minutesValid ? <span className="text-[length:var(--text-2xs)] font-normal text-[var(--muted-soft)]">≈ {fmtMinutes(parsedMinutes)}</span> : null}
        </label>
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Новый режим сразу применяется к расчёту ёмкости, сроков и осуществимости планов.</p>
      </div>
    </FormDialog>
  );
}
