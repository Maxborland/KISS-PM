"use client";

import { AdminFrame } from "@/admin/ui/admin-frame";
import { adminErr, auditActionLabel, AuditResultChip } from "@/admin/ui/admin-bits";
import { SurfaceState } from "@/components/domain/surface-state";
import { useAuditEvents } from "@/admin/lib/use-audit-events";

// Дата+время события (ru-RU, как боевой формат журнала).
const fmt = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};

/**
 * Admin «Аудит» — журнал управленческих действий и системных событий на боевом
 * контракте GET /api/tenant/current/audit-events (createAdminClient + in-memory mock,
 * swap = apiOrigin). Заменяет v2-экран 09-admin/audit (монолит) реальной поверхностью.
 */
export function AdminAuditSurface() {
  const { events, status, error, reload } = useAuditEvents(50);
  const surfaceStatus = status === "loading" ? "loading" : status === "error" ? "error" : events.length === 0 ? "empty" : "ready";

  return (
    <AdminFrame activeTab="Аудит" subtitle="Журнал управленческих действий и системных событий">
      <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>Реальный контракт: GET /api/tenant/current/audit-events (createAdminClient + in-memory mock, swap = apiOrigin). Требует право чтения журнала (canReadAuditEvents). Последние события по убыванию времени.</span>
      </div>

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={(c) => adminErr(c)}
        empty={{ title: "Событий пока нет", description: "Журнал аудита пуст — управленческие действия появятся здесь." }}
      >
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                <th className="px-3 py-2 font-semibold">Действие</th>
                <th className="px-3 py-2 font-semibold">Сущность</th>
                <th className="px-3 py-2 font-semibold">Результат</th>
                <th className="px-3 py-2 font-semibold">Когда</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--text-strong)]">{auditActionLabel(event.actionType)}</div>
                    <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{event.actionType}</div>
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
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceState>
    </AdminFrame>
  );
}
