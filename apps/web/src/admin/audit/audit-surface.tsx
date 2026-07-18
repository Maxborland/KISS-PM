"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AdminFrame } from "@/admin/ui/admin-frame";
import { adminErr, auditActionLabel, AuditResultChip } from "@/admin/ui/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { useAdmin } from "@/admin/lib/use-admin";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { useAuditEvents } from "@/admin/lib/use-audit-events";
import type { AuditEvent } from "@/admin/lib/admin-client";
import { useUrlPeekParamCleaner } from "@/workspace/lib/url-peek";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

// Дата+время события (ru-RU, как боевой формат журнала).
const fmt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};

const selCls = "h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)]";

/**
 * Admin «Аудит» — журнал управленческих действий и системных событий на боевом
 * контракте GET /api/tenant/current/audit-events (createAdminClient + in-memory mock,
 * swap = apiOrigin). Заменяет v2-экран 09-admin/audit (монолит) реальной поверхностью.
 */
export function AdminAuditSurface() {
  const { live } = useAdminRuntime();
  const { events, status, error, reload, getEvent } = useAuditEvents(50);
  // Deep-link ?event=<auditEventId> из квитанций агента: запись может быть старше
  // окна ленты (limit 50) — резолвим точечной выборкой, а не поиском в списке.
  const [deepEvent, setDeepEvent] = useState<AuditEvent | null>(null);
  // Справочник людей для колонки «Кто» (G6-05): actorUserId → имя. Если список
  // пользователей роли недоступен (403) — фолбэк «Участник xxxx», не сырой id (R3).
  const admin = useAdmin();
  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of admin.data?.users ?? []) m.set(u.id, u.name);
    return m;
  }, [admin.data]);
  const who = (actorUserId?: string | null): string =>
    actorUserId ? (userName.get(actorUserId) ?? `Участник ${actorUserId.slice(-4)}`) : "—";

  // Клиентский фильтр по типу события + поиск по подстроке (G6-07). Пагинации у API нет.
  const [typeFilter, setTypeFilter] = useState("");
  const [query, setQuery] = useState("");
  const types = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of events) if (!seen.has(e.actionType)) { seen.add(e.actionType); out.push(e.actionType); }
    return out;
  }, [events]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter && e.actionType !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        e.actionType,
        auditActionLabel(e.actionType),
        who(e.actorUserId),
        e.sourceEntity?.type ?? "",
        e.sourceEntity?.id ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    // who зависит от userName — включаем его в зависимости пересчёта.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, typeFilter, query, userName]);

  const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : status === "error" ? "error" : events.length === 0 ? "empty" : "ready";

  return (
    <AdminFrame activeTab="Аудит" subtitle="Журнал управленческих действий и системных событий">
      {!live ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт: GET /api/tenant/current/audit-events (createAdminClient + in-memory mock, swap = apiOrigin). Требует право чтения журнала (canReadAuditEvents). Последние события по убыванию времени.</span>
        </div>
      ) : null}

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={(c) => adminErr(c)}
        empty={{ title: "Событий пока нет", description: "Журнал аудита пуст — управленческие действия появятся здесь." }}
      >
        <AuditEventDeepLinkResolver getEvent={getEvent} setDeepEvent={setDeepEvent} />
        {deepEvent ? (
          <div data-testid="audit-deep-event" className="mb-3 rounded-[var(--radius-card)] border border-[var(--accent)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
                Событие по ссылке: {auditActionLabel(deepEvent.actionType)}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDeepEvent(null)}>Скрыть</Button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
              <span>Кто: {who(deepEvent.actorUserId)}</span>
              <span>Когда: {fmt(deepEvent.createdAt)}</span>
              <span className="flex items-center gap-1">Результат: <AuditResultChip status={deepEvent.executionResult?.status} /></span>
              {deepEvent.sourceEntity?.type ? <span>Сущность: {deepEvent.sourceEntity.type}{deepEvent.sourceEntity.id ? ` · ${deepEvent.sourceEntity.id}` : ""}</span> : null}
              <span className="v4-mono break-all text-[var(--muted-soft)]">{deepEvent.id}</span>
            </div>
          </div>
        ) : null}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            Тип события
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selCls}>
              <option value="">Все типы</option>
              {types.map((t) => <option key={t} value={t}>{auditActionLabel(t)}</option>)}
            </select>
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по событиям…"
            aria-label="Поиск по событиям"
            className="h-8 max-w-[260px] text-[length:var(--text-xs)]"
          />
        </div>

        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                <th className="px-3 py-2 font-semibold">Действие</th>
                <th className="px-3 py-2 font-semibold">Кто</th>
                <th className="px-3 py-2 font-semibold">Сущность</th>
                <th className="px-3 py-2 font-semibold">Результат</th>
                <th className="px-3 py-2 font-semibold">Когда</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]">
                    По заданному фильтру событий не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((event) => {
                  const label = auditActionLabel(event.actionType);
                  return (
                    <tr key={event.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--text-strong)]">{label}</div>
                        {/* Код события — dev-подсказка (только Storybook/демо); без дублирования, когда подпись = код. */}
                        {prototypeNotesEnabled && label !== event.actionType ? (
                          <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{event.actionType}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted-strong)]">
                        <div>{who(event.actorUserId)}</div>
                        {prototypeNotesEnabled && event.actorUserId ? (
                          <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{event.actorUserId}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted-strong)]">
                        {event.sourceEntity?.type ? (
                          <>
                            <span>{event.sourceEntity.type}</span>
                            {event.sourceEntity.id ? <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]"> · {event.sourceEntity.id}</span> : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2"><AuditResultChip status={event.executionResult?.status} /></td>
                      <td className="px-3 py-2 text-[var(--muted)]">{fmt(event.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинации у API нет — честная подпись об объёме журнала. */}
        <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          {filtered.length === events.length
            ? `Показаны последние ${events.length} событий`
            : `Отфильтровано ${filtered.length} из последних ${events.length} событий`}
        </p>
      </SurfaceState>
    </AdminFrame>
  );
}

/**
 * Резолв deep-link `?event=<auditEventId>` — только в ready-ветке (useSearchParams вне её
 * заставил бы Next требовать Suspense при prerender, см. CommitDeepLinkResolver). Каждое
 * значение резолвится один раз; не найденное событие честно снимает параметр + toast.
 */
function AuditEventDeepLinkResolver({
  getEvent,
  setDeepEvent
}: {
  getEvent: (auditEventId: string) => Promise<AuditEvent | null>;
  setDeepEvent: (event: AuditEvent | null) => void;
}) {
  const searchParams = useSearchParams();
  const clearEventParam = useUrlPeekParamCleaner("event");
  const resolvedEventParamRef = useRef<string | null>(null);

  useEffect(() => {
    const search = searchParams ? searchParams.toString() : window.location.search;
    const eventParam = new URLSearchParams(search).get("event");
    if (resolvedEventParamRef.current === eventParam) return;
    resolvedEventParamRef.current = eventParam;
    if (!eventParam) {
      // Параметр снят (навигация назад / очистка после битого id) — панель
      // «Событие по ссылке» не должна показывать устаревшую запись.
      setDeepEvent(null);
      return;
    }
    let active = true;
    void getEvent(eventParam).then((event) => {
      if (!active) return;
      if (event) {
        setDeepEvent(event);
        return;
      }
      setDeepEvent(null);
      clearEventParam();
      toast.error("Событие аудита не найдено");
    });
    return () => { active = false; };
  }, [clearEventParam, getEvent, searchParams, setDeepEvent]);

  return null;
}
