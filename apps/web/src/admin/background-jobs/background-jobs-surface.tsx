"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { useBackgroundJobs } from "@/admin/lib/use-admin-ops";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { makeRuError } from "@/lib/error-messages";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import type { BackgroundJobEvent, BackgroundJobRun, BackgroundJobStatus } from "@/admin/lib/admin-client";

// RU-коды ошибок фоновых задач (зеркало backgroundJobRoutes).
const jobsErr = makeRuError({
  background_jobs_not_configured: "Фоновые задачи не сконфигурированы на сервере",
  background_job_status_invalid: "Некорректный фильтр статуса",
  background_job_limit_invalid: "Некорректный лимит списка",
  background_job_id_invalid: "Некорректный идентификатор прогона",
  background_job_kind_invalid: "Неизвестный тип задачи",
  background_job_kind_not_implemented: "Задача этого типа ещё не реализована"
}, "Не удалось выполнить действие");

// RU-подписи kinds (боевой backgroundJobKinds домена). Kinds без реализации
// помечены честно — их постановка отклоняется API (501 not_implemented).
const JOB_KIND_LABEL: Record<string, string> = {
  "storage.asset_cleanup": "Очистка архивных файлов",
  "capacity.cache_warmup": "Прогрев кэша ёмкости",
  "calls.recording_janitor": "Санация записей звонков",
  "planning.expired_runs_purge": "Очистка истёкших прогонов планирования",
  "notification.dispatch": "Рассылка уведомлений (не реализовано)",
  "connector.sync": "Синхронизация коннекторов (не реализовано)",
  "search.projection_rebuild": "Перестроение поискового индекса (не реализовано)",
  "calls.recording_compose": "Сборка записи звонка (не реализовано)"
};
const jobKindLabel = (kind: string): string => JOB_KIND_LABEL[kind] ?? kind;

const JOB_STATUS_LABEL: Record<BackgroundJobStatus, string> = {
  queued: "В очереди",
  running: "Выполняется",
  succeeded: "Успешно",
  dead: "Провалена",
  cancelled: "Отменена"
};

function JobStatusChip({ status }: { status: BackgroundJobStatus }) {
  const label = JOB_STATUS_LABEL[status] ?? status;
  if (status === "succeeded") return <Chip variant="success">{label}</Chip>;
  if (status === "dead") return <Chip variant="danger">{label}</Chip>;
  if (status === "cancelled") return <Chip variant="warning">{label}</Chip>;
  if (status === "running") return <Chip variant="violet">{label}</Chip>;
  return <Chip variant="info">{label}</Chip>;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  enqueued: "Поставлена в очередь",
  claimed: "Взята воркером",
  succeeded: "Успешно завершена",
  failed: "Ошибка выполнения",
  retry_scheduled: "Запланирован повтор",
  dead: "Провалена окончательно",
  cancelled: "Отменена"
};

const fmt = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};

/**
 * Admin «Фоновые задачи» (Н4) — read-only обзор прогонов системных задач на боевом
 * контракте GET /api/workspace/background-jobs/runs (+ /:runId/events). Право —
 * tenant.background_jobs.read (403 → «Доступ ограничен»). Управляющих контролов нет:
 * ручек retry/cancel в API не существует — UI их честно не рисует. GET-роута
 * расписаний тоже нет — расписания здесь не показываются.
 */
export function AdminBackgroundJobsSurface() {
  const { live } = useAdminRuntime();
  const { runs, hasData, status, error, reload, getEvents, statusFilter, setStatusFilter } = useBackgroundJobs();
  const [eventsFor, setEventsFor] = useState<{ run: BackgroundJobRun; events: BackgroundJobEvent[] } | null>(null);

  const surfaceStatus = surfaceStatusOf(status, hasData);

  const openEvents = async (run: BackgroundJobRun) => {
    const events = await getEvents(run.id);
    if (events === null) {
      toast.error("Не удалось загрузить события прогона");
      return;
    }
    setEventsFor({ run, events });
  };

  return (
    <AdminFrame
      activeTab="Фоновые задачи"
      subtitle="Прогоны системных фоновых задач: обслуживание хранилища, кэша ёмкости, записей звонков и планирования"
    >
      <div data-testid="background-jobs-page">
        {!live ? (
          <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
            <span>Реальный контракт: GET /api/workspace/background-jobs/runs (+ /:runId/events), read-only (createAdminClient + in-memory mock, swap = apiOrigin). Право — tenant.background_jobs.read. Ручек retry/cancel и списка расписаний в API нет.</span>
          </div>
        ) : null}

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            Статус
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BackgroundJobStatus | "")}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">Все статусы</option>
              {(Object.keys(JOB_STATUS_LABEL) as BackgroundJobStatus[]).map((s) => (
                <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
        </div>

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={(c) => jobsErr(c)}
          empty={{ title: "Прогонов пока нет", description: "Системные задачи ставятся в очередь по расписаниям воркера — прогоны появятся здесь." }}
        >
          <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <table data-testid="background-jobs-table" className="w-full border-collapse text-[length:var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                  <th className="px-3 py-2 font-semibold">Задача</th>
                  <th className="px-3 py-2 font-semibold">Статус</th>
                  <th className="px-3 py-2 font-semibold">Попытки</th>
                  <th className="px-3 py-2 font-semibold">Запуск не раньше</th>
                  <th className="px-3 py-2 font-semibold">Завершена</th>
                  <th className="px-3 py-2 font-semibold">Ошибка</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
                      По заданному фильтру прогонов не найдено.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--text-strong)]">{jobKindLabel(run.kind)}</div>
                        {prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{run.kind}</div> : null}
                      </td>
                      <td className="px-3 py-2"><JobStatusChip status={run.status} /></td>
                      <td className="px-3 py-2 text-[var(--muted-strong)]">{run.attempt} из {run.maxAttempts}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">{fmt(run.runAfter)}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">{fmt(run.finishedAt)}</td>
                      <td className="px-3 py-2">
                        {run.lastError ? <span className="v4-mono break-all text-[length:var(--text-xs)] text-[var(--danger)]">{run.lastError}</span> : <span className="text-[var(--muted-soft)]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end">
                          <Button variant="ghost" size="sm" onClick={() => void openEvents(run)} title="История событий прогона">События</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Честные подписи: объём выборки и отсутствие ручки расписаний. */}
          <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
            Показаны последние {runs.length} прогонов{statusFilter ? ` со статусом «${JOB_STATUS_LABEL[statusFilter]}»` : ""} (максимум 50).
            Расписания задач управляются системой; отдельного API для их просмотра пока нет.
          </p>
        </SurfaceState>

        <Dialog open={eventsFor !== null} onOpenChange={(open) => { if (!open) setEventsFor(null); }}>
          <DialogContent data-testid="background-job-events-dialog" className="max-w-[560px]">
            <DialogHeader>
              <DialogTitle>События прогона — {eventsFor ? jobKindLabel(eventsFor.run.kind) : ""}</DialogTitle>
              <DialogDescription>
                Хронология обработки воркером{eventsFor ? `: ${eventsFor.run.id}` : ""}. Последние 100 событий.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-auto">
              {eventsFor && eventsFor.events.length === 0 ? (
                <p className="px-1 py-4 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">Событий у прогона пока нет.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(eventsFor?.events ?? []).map((event) => (
                    <li key={event.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}</span>
                        <span className="text-[length:var(--text-xs)] text-[var(--muted)]">{fmt(event.createdAt)}</span>
                      </div>
                      {event.message ? <div className="mt-0.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{event.message}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="default">Закрыть</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminFrame>
  );
}
