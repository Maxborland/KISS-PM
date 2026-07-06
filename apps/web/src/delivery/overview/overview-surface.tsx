"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Flag, GitCommit, TrendingUp, Zap } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { Bento, BentoCard, StatTile } from "@/delivery/ui/bento";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { isoToDay, MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { usePlanning, type CommitMetaView } from "@/delivery/lib/use-planning";
import { useResourceDirectory } from "@/delivery/lib/use-resource-directory";
import { demoAction } from "@/views/lib/demo";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import type { PlanTask } from "@kiss-pm/domain";

// customFields — типизированный открытый мешок (Record<string,unknown>) в домене; на этой поверхности
// читаем два конкретных ключа, поэтому узкий локальный каст ключей (это не `as unknown as`, а сужение).
const cfOf = (t: PlanTask) => (t.customFields ?? {}) as { kind?: string; resLabel?: string };

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к базовому плану B2", tone: "warning" } };
const TODAY = "2026-06-23"; // фиксированная «сегодня» прототипа (для просрочек/резерва — детерминированно)
const AV: Array<"c1" | "c2" | "c3" | "c4" | "c5"> = ["c1", "c2", "c3", "c4", "c5"];
const initials = (label: string) => { const parts = label.replace(/·.*/, "").trim().split(/\s+/).filter(Boolean); return parts.length ? (parts[0]![0] ?? "") + (parts[1]?.[0] ?? "") : "—"; };
const ddmm = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const ddmmyyyy = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

function toneIcon(tone: "danger" | "warning" | "info") { return { danger: "bg-[var(--danger)] text-white", warning: "bg-[var(--warning)] text-white", info: "bg-[var(--accent)] text-white" }[tone]; }
function toneBorder(tone: "danger" | "warning" | "info") { return { danger: "border-[var(--danger)]", warning: "border-[var(--warning)]", info: "border-[var(--accent)]" }[tone]; }
function ProgressBar({ value, critical }: { value: number; critical?: boolean }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]"><div className={cn("h-full rounded-full", critical ? "bg-[var(--critical-stripe)]" : "bg-[var(--success)]")} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

export function ProjectOverview({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { readModel, status, error, reload, loadCommits } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const resDir = useResourceDirectory();
  // Фолбэк имени: под ограниченной ролью справочник людей может отдать 403 — резолвер вернёт сырой id.
  // Показываем «Участник xxxx» вместо user-/r-идентификатора (G8-08).
  const resName = (id: string) => { const n = resDir.name(id); return n === id ? `Участник ${id.slice(-4)}` : n; };
  const [commits, setCommits] = useState<CommitMetaView[]>([]);

  useEffect(() => {
    if (!readModel) return;
    void loadCommits().then((c) => setCommits(c.commits.slice(0, 4)));
  }, [readModel, loadCommits]);

  const model = useMemo(() => {
    if (!readModel) return null;
    const authored = readModel.authored.tasks;
    const cp = readModel.calculatedPlan;
    const calcById = new Map(cp.tasks.map((c) => [c.id, c]));
    const milestones = authored.filter((t) => cfOf(t).kind === "milestone");
    // листья = задачи с длительностью, но БЕЗ вех (у вехи durationMinutes == 0, не null) —
    // иначе веха попадает в прогресс/doneCount/«ключевые» с бессмысленным 100%-баром.
    const leaves = authored.filter((t) => t.durationMinutes != null && cfOf(t).kind !== "milestone");
    // granularity в домене — обязательный BucketGranularity, поэтому оставляем только дневные overloads
    // (прежняя ветка `=== undefined` в рантайме никогда не срабатывала — форма всегда её заполняет).
    const overloads = (readModel.resourceLoad.overloads ?? []).filter((o) => o.granularity === "day");
    const bc = readModel.baselineComparison.tasks ?? [];
    const issues = readModel.validationIssues ?? [];
    const deadline = readModel.project.deadline;
    return { authored, leaves, milestones, calcById, projectFinish: cp.projectFinish, criticalIds: new Set(cp.criticalPathTaskIds), overloads, bc, issues, deadline };
  }, [readModel]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error),
  // готовый контент рендерим только при наличии model+readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !model || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} activeTab="Обзор">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  // ===== KPI и сигналы из РЕАЛЬНОГО read-model =====
  const totalWork = model.leaves.reduce((s, t) => s + t.workMinutes, 0);
  const progress = totalWork > 0 ? Math.round(model.leaves.reduce((s, t) => s + t.workMinutes * t.percentComplete, 0) / totalWork) : 0;
  const doneCount = model.leaves.filter((t) => t.statusId === "done").length;
  const inProgress = model.leaves.filter((t) => t.statusId === "in_progress").length;
  // projectFinish/plannedFinish/calculatedFinish в домене nullable (live: проект/задачи без расчётной даты) —
  // guard'им, иначе isoToDay(null)=NaN каскадит в резерв/сорт/сетку.
  const finishDay = model.projectFinish ? isoToDay(model.projectFinish) : null;
  // дедлайн в домене nullable — без него считать резерв/«за дедлайном» нельзя (иначе NaN в шапке/сигналах)
  const deadlineDay = model.deadline ? isoToDay(model.deadline) : null;
  const reserveDays = deadlineDay != null && finishDay != null ? deadlineDay - finishDay : null;
  const baseFinishDay = model.bc.filter((t) => t.baselineFinish).length ? Math.max(...model.bc.filter((t) => t.baselineFinish).map((t) => isoToDay(t.baselineFinish!))) : 0;
  const projDelta = baseFinishDay && finishDay != null ? finishDay - baseFinishDay : 0;
  const overloadResources = [...new Set(model.overloads.map((o) => o.resourceId))];
  const overdue = model.leaves.filter((t) => {
    if (t.statusId === "done") return false;
    // effective finish: расчётная дата (auto-задачи) или авторская (manual); обе nullable — guard от NaN.
    const fin = model.calcById.get(t.id)?.calculatedFinish ?? t.plannedFinish;
    return fin != null && isoToDay(fin) < isoToDay(TODAY);
  });
  const critNoSlack = model.leaves.filter((t) => { const c = model.calcById.get(t.id); return c?.isCritical && (c.totalSlackMinutes ?? 0) <= 0; });

  const signals: Array<{ tone: "danger" | "warning" | "info"; icon: typeof Zap; title: string; detail: string; action: string }> = [];
  // срыв дедлайна — самый критичный выводимый из плана факт, ведёт список
  if (reserveDays != null && reserveDays < 0) signals.push({ tone: "danger", icon: AlertTriangle, title: `Финиш за дедлайном: +${-reserveDays} дн.`, detail: `расчётный ${ddmmyyyy(model.projectFinish)} · дедлайн ${ddmmyyyy(model.deadline ?? "")}`, action: "Открыть График" });
  if (overloadResources.length > 0) signals.push({ tone: "danger", icon: Zap, title: `Перегруз ресурсов: ${overloadResources.length}`, detail: `${overloadResources.map(resName).join(", ")} · ${model.overloads.length} дн с превышением`, action: "Открыть Сценарии" });
  if (projDelta > 0) signals.push({ tone: "warning", icon: AlertTriangle, title: `Финиш сдвинут +${projDelta} дн от базового плана`, detail: `текущий ${ddmm(model.projectFinish)} · базовый ${ddmm(baseFinishDay ? model.bc.find((t) => t.baselineFinish && isoToDay(t.baselineFinish) === baseFinishDay)?.baselineFinish ?? null : null)}`, action: "Открыть Baseline" });
  if (overdue.length > 0) signals.push({ tone: "warning", icon: AlertTriangle, title: `Просрочено задач: ${overdue.length}`, detail: `срок раньше ${ddmmyyyy(TODAY)}, не закрыты`, action: "Открыть График" });
  if (critNoSlack.length > 0) signals.push({ tone: "info", icon: TrendingUp, title: `На критическом пути: ${critNoSlack.length} задач`, detail: "резерв 0 дн — сдвиг тянет дедлайн", action: "Показать путь" });

  // вехи: milestone-задачи + внешний дедлайн, по дате
  const milestoneRows = [
    ...model.milestones.map((m) => { const c = model.calcById.get(m.id); const iso = c?.calculatedFinish ?? m.plannedFinish; return { key: m.id, day: iso ? isoToDay(iso) : Number.MAX_SAFE_INTEGER, date: ddmmyyyy(iso), name: m.title, wbs: m.wbsCode, done: m.percentComplete >= 100 }; }),
    ...(model.deadline ? [{ key: "deadline", day: deadlineDay ?? Infinity, date: ddmmyyyy(model.deadline), name: "Дедлайн релиза", wbs: "—", done: false }] : [])
  ].sort((a, b) => a.day - b.day);

  // ключевые задачи: критпуть и ближайшие сроки (критические вперёд, затем по финишу), top-5;
  // закрытые исключаем — иначе наверх всплывают рано завершённые критические задачи
  const keyTasks = model.leaves
    .filter((t) => t.statusId !== "done")
    .map((t) => { const c = model.calcById.get(t.id); const iso = c?.calculatedFinish ?? t.plannedFinish; return { t, c, crit: model.criticalIds.has(t.id), fin: iso ? isoToDay(iso) : Number.MAX_SAFE_INTEGER }; })
    .sort((a, b) => (a.crit === b.crit ? a.fin - b.fin : a.crit ? -1 : 1))
    .slice(0, 5);

  // шапка из РЕАЛЬНЫХ данных (финиш/variance), не из статической заглушки — чтобы не противоречить KPI
  const projectMeta: ProjectMeta = {
    name: projectBase.name, code: projectBase.code, status: projectBase.status, statusTone: projectBase.statusTone ?? "info",
    planVersion: `v${readModel.planVersion}`, deadline: model.deadline ? ddmmyyyy(model.deadline) : "—", finish: ddmmyyyy(model.projectFinish),
    ...(projDelta > 0 ? { variance: { label: `+${projDelta} дн. к базовому плану`, tone: "warning" as const } } : reserveDays != null && reserveDays < 0 ? { variance: { label: `+${-reserveDays} дн. к дедлайну`, tone: "danger" as const } } : {})
  };

  return (
    <DeliveryFrame project={projectMeta} activeTab="Обзор">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Обзор проекта</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Что горит, что готовится и какие действия доступны — сводка по реальному плану.</p>
        </div>
        {prototypeNotesEnabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-[var(--accent)]">Прототип · in-memory</span>
        ) : null}
      </div>

      {/* KPI-полоса — всё из read-model */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Прогресс" value={`${progress}%`} delta={`${doneCount} закрыто · ${inProgress} в работе`} tone="success" />
        <StatTile label="Финиш (расчёт)" value={ddmm(model.projectFinish)} delta={reserveDays == null ? "дедлайн не задан" : reserveDays >= 0 ? `резерв ${reserveDays} дн до дедлайна` : `${-reserveDays} дн за дедлайном`} {...(reserveDays != null && reserveDays < 0 ? { tone: "danger" as const } : {})} />
        <StatTile label="К базовому плану" value={projDelta === 0 ? "0 дн" : `${projDelta > 0 ? "+" : "−"}${Math.abs(projDelta)} дн`} delta={projDelta > 0 ? "отставание" : projDelta < 0 ? "опережение" : "в графике"} {...(projDelta > 0 ? { tone: "warning" as const } : projDelta < 0 ? { tone: "success" as const } : {})} />
        <StatTile label="Перегрузы" value={`${overloadResources.length}`} delta="ресурсов с превышением" {...(overloadResources.length > 0 ? { tone: "danger" as const } : {})} />
        <StatTile label="Риски плана" value={`${model.issues.length}`} delta="ручной режим / валидация" {...(model.issues.length > 0 ? { tone: "warning" as const } : {})} />
      </div>

      <Bento>
        {/* Сигналы */}
        <BentoCard span={8} title="Внимание · сигналы планирования" subtitle="Производные от плана и загрузки ресурсов" flush>
          {signals.length === 0 ? <div className="px-4 py-8 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Критичных сигналов нет — план в норме.</div> : (
            <ul className="py-1">
              {signals.map((s) => (
                <li key={s.title} className={cn("v4-row group flex items-center gap-3 border-l-[3px] py-3 pl-3.5 pr-3", toneBorder(s.tone))}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] shadow-[var(--shadow-card)]", toneIcon(s.tone))}><s.icon className="size-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[length:var(--text-md)] font-semibold text-[var(--text-strong)]">{s.title}</div>
                    <div className="truncate text-[length:var(--text-sm)] text-[var(--muted)]">{s.detail}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 font-semibold text-[var(--accent)]" {...demoAction(s.action.toLowerCase())}>{s.action}<ArrowUpRight className="v4-arrow size-3.5" aria-hidden /></Button>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        {/* Контрольные точки */}
        <BentoCard span={4} title="Контрольные точки" subtitle="Вехи и дедлайн проекта" flush>
          <ul className="py-1">
            {milestoneRows.map((m) => (
              <li key={m.key} className="v4-row flex items-center gap-3 px-4 py-2.5">
                <Flag className={cn("size-4 shrink-0", m.done ? "text-[var(--success)]" : "text-[var(--muted-soft)]")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--text-md)] text-[var(--text-strong)]">{m.name}</div>
                  <div className="v4-mono text-[length:var(--text-xs)] text-[var(--muted)]">{m.wbs}{m.done ? " · готово" : ""}</div>
                </div>
                <span className="v4-num shrink-0 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{m.date}</span>
              </li>
            ))}
          </ul>
        </BentoCard>

        {/* Ключевые задачи */}
        <BentoCard span={7} title="Ключевые задачи" subtitle="Критический путь и ближайшие сроки" flush>
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <tbody>
              {keyTasks.map((row, i) => (
                <tr key={row.t.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="v4-mono py-2.5 pl-4 pr-2 align-middle text-[length:var(--text-xs)] text-[var(--muted)]">{row.t.wbsCode}</td>
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      {row.crit ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--critical-stripe)]" title="На критическом пути" /> : null}
                      <span className="truncate font-medium text-[var(--text-strong)]">{row.t.title}</span>
                    </div>
                  </td>
                  <td className="w-32 py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2"><ProgressBar value={row.t.percentComplete} critical={row.crit} /><span className="v4-num w-8 shrink-0 text-right text-[length:var(--text-xs)] text-[var(--muted)]">{row.t.percentComplete}%</span></div>
                  </td>
                  <td className="py-2.5 pr-2 align-middle"><BemAvatar initials={initials(cfOf(row.t).resLabel ?? "—")} color={AV[i % AV.length]!} size="sm" /></td>
                  <td className="v4-num py-2.5 pr-4 align-middle text-right text-[length:var(--text-sm)] text-[var(--muted-strong)]">{ddmm(row.c?.calculatedFinish ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BentoCard>

        {/* Последние коммиты — из реального журнала */}
        <BentoCard span={5} title="Последние коммиты" subtitle="История изменений плана (PM-as-code)" actions={<GitCommit className="size-4 text-[var(--muted)]" aria-hidden />} flush
          footer={<span className="flex items-center justify-between"><span>Полная история и откат — на вкладке «Коммиты»</span><Button variant="link" size="sm" className="h-auto p-0 text-[var(--accent)]" {...demoAction("открыть коммиты")}>Все</Button></span>}>
          <ul className="py-1">
            {commits.map((c) => (
              <li key={c.auditEventId} className="v4-row group flex items-start gap-2.5 px-4 py-2.5">
                <span className="mt-[5px] size-2 shrink-0 rounded-full bg-[var(--accent)] ring-2 ring-[var(--accent-soft)]" />
                <span className="v4-num mt-0.5 w-[78px] shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]">{hhmm(c.at)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[length:var(--text-sm)] text-[var(--text)]"><b className="font-semibold text-[var(--text-strong)]">v{c.version}</b> {c.summary}</div>
                  <div className="v4-mono text-[length:var(--text-xs)] text-[var(--muted-soft)]">{prototypeNotesEnabled ? <>{c.auditEventId}{c.changedTaskIds.length ? " · " : ""}</> : null}{c.changedTaskIds.length ? `задач: ${c.changedTaskIds.length}` : null}</div>
                </div>
              </li>
            ))}
            {commits.length === 0 ? <li className="px-4 py-3 text-[length:var(--text-sm)] text-[var(--muted)]">История пуста.</li> : null}
          </ul>
        </BentoCard>
      </Bento>
    </DeliveryFrame>
  );
}
