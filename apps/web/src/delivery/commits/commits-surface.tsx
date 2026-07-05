"use client";

import { useEffect, useMemo, useState } from "react";
import { GitCommitVertical, RotateCcw } from "lucide-react";
import { buildCompensatingCommands, type PlanningReadModel } from "@kiss-pm/planning-client";

import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { usePlanning, type CommitMetaView, type CommitsView } from "@/delivery/lib/use-planning";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к baseline B2", tone: "warning" } };
const dt = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

// тип-чип по actionType (как в макете 09-audit)
const typeOf = (actionType: string): { label: string; cls: string } => {
  if (actionType.startsWith("planning.baseline")) return { label: "baseline", cls: "bg-[var(--info-soft)] text-[var(--info)]" };
  if (actionType.startsWith("planning.scenario")) return { label: "сценарий", cls: "bg-[color-mix(in_oklab,var(--violet)_16%,var(--panel))] text-[var(--violet)]" };
  if (actionType.startsWith("planning.overload")) return { label: "перегруз", cls: "bg-[var(--warning-soft)] text-[var(--warning-text)]" };
  if (actionType.startsWith("planning.assignment")) return { label: "назначение", cls: "bg-[var(--warning-soft)] text-[var(--warning-text)]" };
  if (actionType.startsWith("planning.calendar")) return { label: "календарь", cls: "bg-[var(--panel-strong)] text-[var(--muted-strong)]" };
  return { label: "план", cls: "bg-[var(--info-soft)] text-[var(--info)]" };
};

export function ProjectCommits({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { readModel, status, error, reload, applyBatch, revertLast, loadCommits } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const [data, setData] = useState<CommitsView | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!readModel) return;
    void loadCommits().then((c) => { setData(c); setSel((s) => s ?? c.commits[0]?.auditEventId ?? null); });
  }, [readModel?.planVersion, loadCommits, readModel]);

  const taskTitle = useMemo(() => {
    const m = new Map((readModel?.authored.tasks ?? []).map((t) => [t.id, t]));
    return (id: string) => { const t = m.get(id); return t ? `${t.wbsCode} ${t.title}` : id; };
  }, [readModel]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="Коммиты">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const projectMeta = deriveProjectMeta(readModel, projectBase);
  const commits = data?.commits ?? [];
  const latestRevert = data?.latestRevert ?? null;
  const selected = commits.find((c) => c.auditEventId === sel) ?? commits[0] ?? null;

  const onRevert = async (c: CommitMetaView) => {
    if (!latestRevert || c.auditEventId !== latestRevert.auditEventId) return;
    const before = latestRevert.before as PlanningReadModel;
    const inverses = latestRevert.commands.slice().reverse().flatMap((cmd) => buildCompensatingCommands(cmd, before));
    if (inverses.length === 0) { setNotice("Откат недоступен для этой операции (создание/перенос/назначение)"); return; }
    setBusy(true); setNotice(null);
    const res = await applyBatch(inverses);
    setBusy(false);
    if (res.ok) { setNotice(`Откат применён компенсирующим коммитом v${res.planVersion}`); const fresh = await loadCommits(); setData(fresh); setSel(fresh.commits[0]?.auditEventId ?? null); }
    else setNotice(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.message}`);
  };

  // BUG-PROJ-24: откат последнего обратимого коммита через серверный revert-last —
  // работает из истории (не зависит от in-session state).
  const onRevertLast = async () => {
    setBusy(true); setNotice(null);
    const res = await revertLast();
    setBusy(false);
    if (res.ok) { setNotice(`Откат применён компенсирующим коммитом v${res.planVersion}`); const fresh = await loadCommits(); setData(fresh); setSel(fresh.commits[0]?.auditEventId ?? null); }
    else if (res.message === "nothing_to_revert") setNotice("Нет обратимого коммита для отката");
    else setNotice(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.message}`);
  };

  return (
    <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="Коммиты">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Коммиты плана</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">PM-as-code: каждая правка плана — версия с аудит-событием. Откат последнего обратимого коммита — компенсирующими командами.</p>
        </div>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void onRevertLast()}><RotateCcw className="size-3.5" aria-hidden />Откатить последний</Button>
      </div>

      {prototypeNotesEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          История версий текущей сессии (auditEventId / planVersion реальны). Откат — через buildCompensatingCommands + apply-command-batch (обратимы правки задач/связей). Данные in-memory.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* лента коммитов */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Лента ({commits.length})</div>
          {commits.map((c) => {
            const type = typeOf(c.actionType);
            const active = c.auditEventId === sel;
            const canRevert = latestRevert?.auditEventId === c.auditEventId;
            return (
              <button key={c.auditEventId} type="button" onClick={() => setSel(c.auditEventId)} className={cn("flex w-full items-start gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--panel-subtle)]", active && "bg-[var(--accent-soft)]")}>
                <span className="mono mt-0.5 w-[78px] shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]">{hhmm(c.at)}</span>
                <GitCommitVertical className="mt-0.5 size-4 shrink-0 text-[var(--muted-soft)]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="mono shrink-0 rounded bg-[var(--panel-strong)] px-1 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">v{c.version}</span>
                    <span className="truncate text-[length:var(--text-sm)] text-[var(--text)]">{c.summary}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
                    {c.changedTaskIds.length > 0 ? <span>задач: {c.changedTaskIds.length}</span> : null}
                    {canRevert ? <span className={cn("inline-flex items-center gap-0.5 font-medium text-[var(--accent)]", busy ? "cursor-default opacity-50" : "cursor-pointer hover:underline")} onClick={(e) => { e.stopPropagation(); if (!busy) void onRevert(c); }}><RotateCcw className="size-3" aria-hidden />Откатить</span> : c.revertible ? <span className="text-[var(--muted-soft)]" title="Откат доступен только для последнего обратимого коммита сессии">обратимый</span> : null}
                  </span>
                </span>
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", type.cls)}>{type.label}</span>
              </button>
            );
          })}
          {commits.length === 0 ? <div className="px-3 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted)]">История пуста.</div> : null}
        </div>

        {/* детали события */}
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Детали коммита</div>
          {selected ? (
            <div className="px-3 py-3 text-[length:var(--text-sm)]">
              <div className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{selected.summary}</div>
              <div className="mono mt-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">{selected.actionType}</div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Версия плана</span><span className="mono text-[var(--text-strong)]">v{selected.version - 1} → v{selected.version}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Когда</span><span className="mono text-[var(--text-strong)]">{dt(selected.at)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Аудит-событие</span><span className="mono text-[var(--muted-strong)]">{selected.auditEventId}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Источник</span><span className="text-[var(--muted-strong)]">планировщик</span></div>
              </div>

              {selected.changedTaskIds.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Затронутые задачи ({selected.changedTaskIds.length})</div>
                  <ul className="space-y-1">
                    {selected.changedTaskIds.slice(0, 8).map((id) => <li key={id} className="truncate rounded-[var(--radius-sm)] bg-[var(--panel-subtle)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--text)]">{taskTitle(id)}</li>)}
                  </ul>
                </div>
              ) : null}

              {latestRevert?.auditEventId === selected.auditEventId ? (
                <Button variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={() => void onRevert(selected)}><RotateCcw className="size-3.5" aria-hidden />Откатить коммит</Button>
              ) : selected.revertible ? <p className="mt-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Откат доступен только для последнего обратимого коммита.</p> : <p className="mt-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Откат недоступен (необратимая операция или системная запись).</p>}

              <details className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                <summary className="cursor-pointer px-2 py-1.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Показать raw payload</summary>
                <pre className="mono overflow-auto rounded-b-[var(--radius-md)] bg-[var(--text-strong)] px-2 py-2 text-[length:var(--text-2xs)] leading-relaxed text-[var(--panel)]">{JSON.stringify({ version: selected.version, actionType: selected.actionType, auditEventId: selected.auditEventId, changedTaskIds: selected.changedTaskIds, revertible: selected.revertible, at: selected.at }, null, 2)}</pre>
              </details>
            </div>
          ) : <div className="px-3 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Выберите коммит из ленты.</div>}
        </div>
      </div>

      {notice ? <div key={notice} className="anim-rise-in-fast mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </DeliveryFrame>
  );
}
