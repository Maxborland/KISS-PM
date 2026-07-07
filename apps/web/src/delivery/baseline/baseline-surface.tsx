"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Camera, Check, GitCommitVertical, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { isoToDay, MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { usePlanning } from "@/delivery/lib/use-planning";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { createPlanningCommand } from "@kiss-pm/domain";

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к базовому плану B2", tone: "warning" } };
const h = (min: number) => Math.round(min / 60);
const ddmm = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const ddmmYyyy = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const dt = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const deltaCls = (d: number) => (d > 0 ? "text-[var(--warning-text)]" : d < 0 ? "text-[var(--success-text)]" : "text-[var(--muted)]");
const signDays = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)} дн.`;
const signH = (m: number) => `${m > 0 ? "+" : m < 0 ? "−" : ""}${h(Math.abs(m))} ч`;
let NID = 0;
const nid = (p: string) => `${p}-n${(NID += 1)}`;

export function ProjectBaseline({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { readModel, status, error, reload, apply } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [label, setLabel] = useState("");

  const model = useMemo(() => {
    if (!readModel) return null;
    const bc = readModel.baselineComparison;
    const baselines = (readModel.authored.baselines ?? []).slice().sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
    const taskById = new Map(readModel.authored.tasks.map((t) => [t.id, t]));
    const critical = new Set(readModel.calculatedPlan.criticalPathTaskIds ?? []);
    const projectFinish = readModel.calculatedPlan.projectFinish;
    return { bc, baselines, taskById, critical, projectFinish };
  }, [readModel]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии model+readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !model || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} activeTab="Baseline">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const tasks = model.bc.tasks;
  const withBase = tasks.filter((t) => t.baselineFinish !== null);
  const baseFinishDay = withBase.length ? Math.max(...withBase.map((t) => isoToDay(t.baselineFinish!))) : 0;
  // projectFinish в типизированном контракте — PlanDate | null; при отсутствии финиша считаем 0 (нет базы для дельты)
  const curFinishDay = model.projectFinish ? isoToDay(model.projectFinish) : 0;
  const projFinishDelta = baseFinishDay ? curFinishDay - baseFinishDay : 0;
  // изменена = сдвиг по сроку/труду ИЛИ удалена после фиксации (current* = null)
  const changed = tasks.filter((t) => t.currentFinish === null || (t.finishDeltaDays ?? 0) !== 0 || (t.workDeltaMinutes ?? 0) !== 0);
  const totalWorkDelta = tasks.reduce((s, t) => s + (t.workDeltaMinutes ?? 0), 0);
  // хром выводим из РЕАЛЬНЫХ данных (а не статической заглушки PROJECT), чтобы шапка не противоречила плитке
  const projectMeta: ProjectMeta = {
    name: projectBase.name, code: projectBase.code, status: projectBase.status, statusTone: projectBase.statusTone ?? "info",
    planVersion: `v${readModel.planVersion}`, deadline: ddmmYyyy(typeof readModel.project.deadline === "string" ? readModel.project.deadline : null), finish: ddmmYyyy(model.projectFinish),
    ...(baseFinishDay && projFinishDelta !== 0 ? { variance: { label: `${signDays(projFinishDelta)} к базовому плану`, tone: projFinishDelta > 0 ? ("warning" as const) : ("success" as const) } } : {})
  };
  const rows = onlyChanged ? changed : tasks;
  const activeId = model.bc.baselineId;
  const spanDay = Math.max(1, Math.max(curFinishDay, baseFinishDay));

  const onCapture = async () => {
    setBusy(true);
    const res = await apply(createPlanningCommand({ type: "baseline.capture", payload: { baselineId: nid("baseline"), label: label.trim() || "Снимок плана" } }));
    setBusy(false); setCapturing(false); setLabel("");
    if (res.ok) toast.success(`Базовый план зафиксирован · коммит v${res.planVersion}`);
    else toast.error(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.message}`);
  };

  const tiles = [
    { label: "Финиш проекта", value: ddmm(model.projectFinish), sub: baseFinishDay ? signDays(projFinishDelta) : "нет базового плана", tone: projFinishDelta > 0 ? "text-[var(--warning-text)]" : projFinishDelta < 0 ? "text-[var(--success-text)]" : "text-[var(--text-strong)]" },
    { label: "Изменилось задач", value: `${changed.length}`, sub: `из ${tasks.length} · ${tasks.length ? Math.round((changed.length / tasks.length) * 100) : 0}%`, tone: "text-[var(--text-strong)]" },
    { label: "Δ работы", value: signH(totalWorkDelta), sub: "к базовому плану", tone: totalWorkDelta > 0 ? "text-[var(--warning-text)]" : totalWorkDelta < 0 ? "text-[var(--success-text)]" : "text-[var(--text-strong)]" }
  ];

  return (
    <DeliveryFrame project={projectMeta} activeTab="Baseline">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Базовый план</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Сравнение текущего плана с зафиксированным базовым: отклонения по срокам и трудозатратам.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="secondary" size="sm"><Link href={`/projects/${projectId}/schedule`}>Слой в «Графике»</Link></Button>
          {capturing ? (
            <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-1.5 py-1">
              <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Название снимка" className="h-7 w-[160px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]" />
              <Button variant="default" size="sm" disabled={busy} onClick={() => void onCapture()}><Check className="size-3.5" aria-hidden />Зафиксировать</Button>
              <button type="button" onClick={() => { setCapturing(false); setLabel(""); }} className="grid size-7 place-items-center rounded text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label="Отмена"><X className="size-4" aria-hidden /></button>
            </div>
          ) : <Button variant="default" size="sm" disabled={busy} onClick={() => setCapturing(true)}><Camera className="size-3.5" aria-hidden />Зафиксировать базовый план</Button>}
        </div>
      </div>

      {prototypeNotesEnabled ? (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт: baselineComparison (per-task дельты сроков/труда) + команда baseline.capture (фиксация снимка, аудит planning.baseline.captured). Данные in-memory.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* левая колонка: история базовых планов */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">История ({model.baselines.length})</div>
            {model.baselines.map((b) => {
              const active = b.id === activeId;
              return (
                <div key={b.id} className={cn("flex items-start gap-2 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0", active && "bg-[var(--info-soft)]")}>
                  <GitCommitVertical className={cn("mt-0.5 size-4 shrink-0", active ? "text-[var(--info)]" : "text-[var(--muted-soft)]")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{b.label || "Снимок плана"}</span>
                      <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", active ? "bg-[var(--info-soft)] text-[var(--info)]" : "bg-[var(--panel-strong)] text-[var(--muted-soft)]")}>{active ? "активный" : "архив"}</span>
                    </div>
                    <div className="mono mt-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">{dt(b.capturedAt)} · {b.tasks.length} задач</div>
                  </div>
                </div>
              );
            })}
            {model.baselines.length === 0 ? <div className="px-3 py-4 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Базовый план не зафиксирован.</div> : null}
          </div>
          <p className="px-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Активным считается последний зафиксированный снимок; с ним и сравнивается текущий план.</p>
        </div>

        {/* правая колонка: метрики + таблица отклонений */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-card)]">
                <div className="text-[length:var(--text-xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">{t.label}</div>
                <div className={cn("v4-num text-[length:var(--text-22)] font-extrabold leading-tight", t.tone)}>{t.value}</div>
                <div className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{t.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
              <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Отклонения от базового плана</span>
              <button type="button" onClick={() => setOnlyChanged((v) => !v)} className={cn("rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-0.5 text-[length:var(--text-xs)]", onlyChanged ? "bg-[var(--panel-strong)] text-[var(--text-strong)]" : "text-[var(--muted)]")}>Только изменённые</button>
            </div>
            <div className="overflow-auto">
              <table className="w-full border-collapse text-[length:var(--text-sm)]">
                <thead>
                  <tr className="border-b border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                    <th className="px-2 py-1.5 text-left font-semibold">WBS</th><th className="px-2 py-1.5 text-left font-semibold">Задача</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Финиш баз.</th><th className="px-2 py-1.5 text-right font-semibold">Финиш тек.</th><th className="px-2 py-1.5 text-right font-semibold">Δ дн.</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Труд баз.</th><th className="px-2 py-1.5 text-right font-semibold">Труд тек.</th><th className="px-2 py-1.5 text-right font-semibold">Δ ч</th>
                    <th className="w-[80px] px-2 py-1.5 text-left font-semibold">Сдвиг</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const task = model.taskById.get(t.taskId);
                    const deleted = t.currentFinish === null; // задача удалена после фиксации базового плана
                    const fd = t.finishDeltaDays ?? 0;
                    const wd = t.workDeltaMinutes ?? 0;
                    const bDay = t.baselineFinish ? isoToDay(t.baselineFinish) : null;
                    const cDay = t.currentFinish ? isoToDay(t.currentFinish) : null;
                    return (
                      <tr key={t.taskId} className="border-b border-[var(--border-subtle)] last:border-b-0">
                        <td className="mono px-2 py-1.5 text-[var(--muted)]">{task?.wbsCode ?? t.taskId}</td>
                        <td className="px-2 py-1.5"><span className="flex items-center gap-1.5"><span className="truncate text-[var(--text)]">{task?.title ?? t.taskId}</span>{model.critical.has(t.taskId) ? <span className="shrink-0 rounded-full bg-[var(--danger-soft)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--danger-text)]">кр.путь</span> : null}{deleted ? <span className="shrink-0 rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-soft)]">удалена</span> : null}</span></td>
                        <td className="mono px-2 py-1.5 text-right text-[var(--muted-strong)]">{ddmm(t.baselineFinish)}</td>
                        <td className="mono px-2 py-1.5 text-right text-[var(--text)]">{ddmm(t.currentFinish)}</td>
                        <td className={cn("mono px-2 py-1.5 text-right font-semibold", deleted ? "text-[var(--muted-soft)]" : deltaCls(fd))}>{deleted ? "—" : signDays(fd)}</td>
                        <td className="mono px-2 py-1.5 text-right text-[var(--muted-strong)]">{t.baselineWorkMinutes != null ? `${h(t.baselineWorkMinutes)} ч` : "—"}</td>
                        <td className="mono px-2 py-1.5 text-right text-[var(--text)]">{t.currentWorkMinutes != null ? `${h(t.currentWorkMinutes)} ч` : "—"}</td>
                        <td className={cn("mono px-2 py-1.5 text-right font-semibold", deleted ? "text-[var(--muted-soft)]" : deltaCls(wd))}>{deleted ? "—" : signH(wd)}</td>
                        <td className="px-2 py-1.5">
                          <span className="relative block h-2 w-[64px] overflow-hidden rounded-full bg-[var(--panel-strong)]" title={deleted ? "удалена после фиксации" : `базовый ${ddmm(t.baselineFinish)} → текущий ${ddmm(t.currentFinish)}`}>
                            {bDay != null ? <span className="absolute top-0 block h-1 rounded-full bg-[var(--muted-soft)]" style={{ width: `${Math.min(100, (bDay / spanDay) * 100)}%` }} /> : null}
                            {cDay != null ? <span className={cn("absolute bottom-0 block h-1 rounded-full", fd > 0 ? "bg-[var(--warning)]" : fd < 0 ? "bg-[var(--success)]" : "bg-[var(--accent)]")} style={{ width: `${Math.min(100, (cDay / spanDay) * 100)}%` }} /> : null}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 ? <tr><td colSpan={9} className="px-2 py-6 text-center text-[var(--muted)]">{onlyChanged ? "Нет изменённых задач — план совпадает с базовым." : "Нет данных сравнения."}</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-x-3 border-t border-[var(--border-subtle)] px-3 py-1.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--muted-soft)]" /> базовый финиш</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--warning)]" /> сдвиг вправо (отставание)</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--success)]" /> раньше базового</span>
            </div>
          </div>
        </div>
      </div>

    </DeliveryFrame>
  );
}
