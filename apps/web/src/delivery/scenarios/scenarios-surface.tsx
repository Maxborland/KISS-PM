"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ScenarioProposal } from "@kiss-pm/domain";
import { Check, Loader2, RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { hasPermission } from "@/lib/permissions";
import { useSessionUser } from "@/shell/use-session-user";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr, useProjectBase } from "@/delivery/lib/project-chrome";
import { isoToDay, MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { usePlanning } from "@/delivery/lib/use-planning";
import { useResourceDirectory } from "@/delivery/lib/use-resource-directory";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";

type Profile = "aggressive" | "balanced" | "resilient";
type DiffRow = { wbs: string; title: string; detail: string; delta: string };
// Канонический wire-тип предложения — доменный ScenarioProposal (его же отдают
// previewScenarios боевого API и contract-mock); локального «почти такого же» типа больше нет.
type Proposal = ScenarioProposal;
type Overload = { resourceId: string; date: string; overloadMinutes: number; taskIds: string[] };

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к базовому плану B2", tone: "warning" } };
const SCENARIO_PREVIEW_PERMISSION = "tenant.planning_scenarios.preview";
const SCENARIO_APPLY_PERMISSION = "tenant.planning_scenarios.apply";
const UNAVAILABLE_REASON: Record<Exclude<Proposal["unavailableReason"], null>, string> = {
  target_bucket_not_found: "Целевой день перегруза больше не найден.",
  target_assignment_not_found: "Назначение, создающее перегруз, больше не найдено.",
  no_eligible_alternate_resource: "В команде нет ресурса подходящей позиции.",
  alternate_resource_has_insufficient_capacity: "У подходящих ресурсов недостаточно свободной ёмкости."
};
const PROFILE_META: Record<Profile, { label: string; desc: string }> = {
  aggressive: { label: "Агрессивный", desc: "Принять перегруз, сохранить дату финиша" },
  balanced: { label: "Балансированный", desc: "Снять половину перегруза на альт-исполнителя, минимальный сдвиг" },
  resilient: { label: "Устойчивый", desc: "Снять весь перегруз, заложить резерв; финиш сдвигается больше" }
};const h = (min: number) => Math.round(min / 60);
const ddmm = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const riskOf = (score: number) => score >= 67 ? { label: "высокий риск", cls: "bg-[var(--danger-soft)] text-[var(--danger-text)]" } : score >= 34 ? { label: "средний риск", cls: "bg-[var(--warning-soft)] text-[var(--warning-text)]" } : { label: "низкий риск", cls: "bg-[var(--success-soft)] text-[var(--success-text)]" };

export function ProjectScenarios({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { readModel, status, error, reload, previewScenarios, applyScenario } = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT);
  const resDir = useResourceDirectory();
  const sessionUser = useSessionUser();
  const permissions = sessionUser?.permissions ?? [];
  const canPreviewScenarios = hasPermission(permissions, SCENARIO_PREVIEW_PERMISSION);
  const canApplyScenarios = hasPermission(permissions, SCENARIO_APPLY_PERMISSION);
  // Фолбэк имени: под ограниченной ролью справочник людей может отдать 403 — резолвер вернёт сырой id.
  // Показываем «Участник xxxx» вместо user-/r-идентификатора (G8-08).
  const resName = (id: string) => { const n = resDir.name(id); return n === id ? `Участник ${id.slice(-4)}` : n; };
  const [targetKey, setTargetKey] = useState<string>("");
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [riskReason, setRiskReason] = useState("");
  // валидация причины принятия риска — у поля причины (G3-19), не в toast
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [scenarioErr, setScenarioErr] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!readModel) return null;
    // Уже принятые перегрузки исключаем из целей сценария (каноничный ключ `resourceId:dateIso`),
    // иначе после применения сценария только что принятый день остаётся целью по умолчанию и снова предлагается.
    // `acceptedOverloads` — мок-only поле бэкенда: в каноничном ResourceLoadMatrix его нет,
    // поэтому это узкий документированный каст (не `as unknown as`), а не доступ по контракту.
    const accepted = new Set(
      (readModel.resourceLoad as { acceptedOverloads?: string[] }).acceptedOverloads ?? []
    );
    const overloads = (readModel.resourceLoad.overloads ?? [])
      .filter((o) => o.granularity === "day")
      .filter((o) => !accepted.has(`${o.resourceId}:${o.date}`))
      .map((o) => ({ resourceId: o.resourceId, date: o.date, overloadMinutes: o.overloadMinutes, taskIds: o.taskIds }))
      .sort((a, b) => b.overloadMinutes - a.overloadMinutes) as Overload[];
    const deadline = readModel.project.deadline;
    const baseFinish = readModel.calculatedPlan.projectFinish;
    const baseCritical = (readModel.calculatedPlan.criticalPathTaskIds ?? []).length;
    const authored = readModel.authored;
    const taskById = new Map(authored.tasks.map((t) => [t.id, t]));
    const asgById = new Map(authored.assignments.map((a) => [a.id, a]));
    return { overloads, deadline, baseFinish, baseCritical, taskById, asgById };
  }, [readModel]);

  const target: Overload | null = model ? (model.overloads.find((o) => `${o.resourceId}|${o.date}` === targetKey) ?? model.overloads[0] ?? null) : null;

  async function runPreview(t: Overload) {
    if (!canPreviewScenarios) return;
    setPreviewBusy(true); setScenarioErr(null); setCompareId(null);
    const res = await previewScenarios({ type: "resource_overload", resourceId: t.resourceId, date: t.date, overloadMinutes: t.overloadMinutes, taskIds: t.taskIds });
    setPreviewBusy(false);
    if (res.ok) setProposals(res.proposals);
    else { setProposals([]); setScenarioErr(res.conflict ? "Конфликт версий — перезагружено, запросите сценарии заново" : "Не удалось получить сценарии"); }
  }

  // авто-превью для худшего перегруза при загрузке и после применения (planVersion сменился → proposals=null)
  useEffect(() => {
    if (!canPreviewScenarios || !readModel || !target || proposals !== null || previewBusy) return;
    void runPreview(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPreviewScenarios, readModel?.planVersion, targetKey, proposals, target?.resourceId, target?.date]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии model+readModel. Frame-обёртку сохраняем.
  // ВНИМАНИЕ: вложенный preview-спиннер «Расчёт сценариев…» (Loader2 ниже) НЕ трогаем.
  if (status !== "ready" || !model || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="Сценарии">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const projectMeta = deriveProjectMeta(readModel, projectBase);
  const list = proposals ?? [];
  const recommendedId = list.filter((p) => p.availability === "available" && p.conflictEffect !== "accepted").sort((a, b) => a.explainability.riskScore - b.explainability.riskScore)[0]?.id ?? null;
  const compareP = compareId ? list.find((p) => p.id === compareId) ?? null : null;

  // ВСЁ для сравнения/дельт считаем из КОНТРАКТНЫХ полей (live read-model + explainability + planDelta.commands),
  // чтобы поверхность работала и против боевого API (где мок-only полей нет).
  const baseOverloadMin = target?.overloadMinutes ?? 0;
  const dayN = (iso: string | null) => (iso ? isoToDay(iso) : 0);
  const finishDelta = (p: Proposal) => dayN(p.explainability.finishDate) - dayN(model.baseFinish);
  const overloadDelta = (p: Proposal) => p.explainability.overloadMinutes - baseOverloadMin;
  const deriveDiff = (p: Proposal): DiffRow[] => p.planDelta.commands.map((cmd): DiffRow => {
    // payload дискриминированного PlanningCommand читаем по строковым ключам (diff — деривация для UI)
    const pay = (cmd.payload ?? {}) as Record<string, unknown>;
    if (cmd.type === "risk.accept_overload") return { wbs: "—", title: target ? `${resName(target.resourceId)} · ${ddmm(target.date)}` : "—", detail: "Перегруз принят как осознанный риск", delta: "+0 дн" };
    const taskId = String(pay.taskId ?? ""); const rid = String(pay.resourceId ?? ""); const wm = Number(pay.workMinutes ?? 0);
    const task = model.taskById.get(taskId);
    const existing = model.asgById.get(String(pay.id ?? ""));
    if (existing) { const exWm = existing.workMinutes ?? 0; const d = wm - exWm; return { wbs: task?.wbsCode ?? taskId, title: task?.title ?? taskId, detail: `${resName(rid)}: труд ${h(exWm)} → ${h(wm)} ч`, delta: `${d < 0 ? "−" : "+"}${h(Math.abs(d))} ч` }; }
    return { wbs: task?.wbsCode ?? taskId, title: task?.title ?? taskId, detail: `+ ${resName(rid)} (${pay.role === "co_executor" ? "соисполнитель" : "исполнитель"})`, delta: `+${h(wm)} ч` };
  });

  const onApply = async (p: Proposal) => {
    if (!canApplyScenarios) return;
    const requiresReason = p.conflictEffect === "accepted";
    if (requiresReason && !riskReason.trim()) { setReasonError("Укажите причину принятия риска (требуется для агрессивного сценария)"); return; }
    setApplyBusy(true); setScenarioErr(null); setReasonError(null);
    const res = await applyScenario(p.id, requiresReason ? riskReason.trim() : undefined);
    setApplyBusy(false);
    if (res.ok) {
      toast.success(`Сценарий «${PROFILE_META[p.profile].label}» применён · коммит v${res.planVersion}${prototypeNotesEnabled ? ` · scenarioRunId ${res.scenarioRunId}` : ""}`);
      setRiskReason(""); setCompareId(null); setProposals(null); // авто-превью пересчитает по новому состоянию
    } else if (res.conflict) { setScenarioErr("Конфликт версий — перезагружено, запросите сценарии заново"); setProposals(null); }
    else if (res.code === "accepted_risk_reason_required") setReasonError("Требуется причина принятия риска");
    else if (res.code === "scenario_expired" || res.code === "scenario_not_found") { setScenarioErr("Предложения устарели — запросите заново"); setProposals(null); }
    else toast.error(`Отклонено: ${res.message}`);
  };

  const FinishChip = ({ d }: { d: number }) => <span className={cn("rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", d > 0 ? "bg-[var(--warning-soft)] text-[var(--warning-text)]" : "bg-[var(--panel-strong)] text-[var(--muted-soft)]")}>{d > 0 ? `+${d} дн` : "+0 дн"}</span>;
  const OverChip = ({ m }: { m: number }) => <span className={cn("rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", m < 0 ? "bg-[var(--success-soft)] text-[var(--success-text)]" : "bg-[var(--panel-strong)] text-[var(--muted-soft)]")}>{m < 0 ? `−${h(-m)} ч` : "0 ч"}</span>;

  return (
    <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="Сценарии">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Сценарии планирования</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Бэкенд предлагает три профиля разрешения перегруза ресурса; выбранный применяется как пакет команд (коммит плана).</p>
        </div>
        {canPreviewScenarios ? <Button variant="ghost" size="sm" className="ml-auto" disabled={previewBusy || !target} onClick={() => { if (target) { setProposals(null); void runPreview(target); } }}><RefreshCw className={cn("size-3.5", previewBusy && "animate-spin")} aria-hidden />Запросить заново</Button> : null}
      </div>

      {prototypeNotesEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Реальный контракт: previewScenarios(target) → 3 профиля (наборы PlanningCommand с пересчётом метрик) → applyScenario (permission + audit «planning.scenario.applied», bump версии). Агрессивный принимает перегруз — нужна причина риска. Данные in-memory.
        </div>
      )}

      {model.overloads.length === 0 ? (
        <div data-testid="scenario-empty-state" className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-10 text-center text-[length:var(--text-sm)] text-[var(--muted)] shadow-[var(--shadow-card)]">
          Перегрузов не найдено — ресурсный план сбалансирован. Сценарии разрешения не требуются.
        </div>
      ) : (
        <>
          {/* параметры запроса */}
          <div className="mb-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Параметры запроса</span>
              {prototypeNotesEnabled ? <span className="mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">canPreviewPlanningScenarios</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[length:var(--text-xs)]">
              <span className="inline-flex items-center rounded-full bg-[var(--info-soft)] px-2 py-0.5 font-medium text-[var(--info)]">Цель: снять перегруз</span>
              {canPreviewScenarios && model.overloads.length > 1 ? (
                <select value={target ? `${target.resourceId}|${target.date}` : ""} onChange={(e) => { setTargetKey(e.target.value); setProposals(null); setCompareId(null); setScenarioErr(null); }} className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]" aria-label="Перегруз">
                  {model.overloads.map((o) => <option key={`${o.resourceId}|${o.date}`} value={`${o.resourceId}|${o.date}`}>{resName(o.resourceId)} · {ddmm(o.date)} · {h(o.overloadMinutes)} ч</option>)}
                </select>
              ) : target ? <span className="inline-flex items-center rounded-full bg-[var(--info-soft)] px-2 py-0.5 font-medium text-[var(--info)]">{resName(target.resourceId)} · {ddmm(target.date)} · {h(target.overloadMinutes)} ч</span> : null}
              <span className="inline-flex items-center rounded-full bg-[var(--info-soft)] px-2 py-0.5 font-medium text-[var(--info)]">Защитить критпуть: да</span>
              <span className="inline-flex items-center rounded-full bg-[var(--info-soft)] px-2 py-0.5 font-medium text-[var(--info)]">Ресурсы: текущая команда</span>
            </div>
          </div>

          {/* список профилей */}
          {!canPreviewScenarios ? (
            <div className="flex h-[120px] items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[length:var(--text-sm)] text-[var(--muted)]">Недостаточно прав для расчёта сценариев.</div>
          ) : previewBusy && list.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]"><Loader2 className="size-4 animate-spin" aria-hidden /> Расчёт сценариев…</div>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((p) => {
                const meta = PROFILE_META[p.profile];
                const risk = riskOf(p.explainability.riskScore);
                const available = p.availability === "available";
                const recommended = available && p.id === recommendedId;
                return (
                  <div key={p.id} data-testid={`scenario-card-${p.profile}`} data-availability={p.availability} className={cn("rounded-[var(--radius-card)] border bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]", recommended ? "border-[var(--info)] shadow-[0_0_0_1px_var(--info)]" : "border-[var(--border)]")}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="min-w-[200px] flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">{meta.label}</span>
                          {recommended ? <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--info-soft)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold text-[var(--info)]"><Sparkles className="size-3" aria-hidden />рекомендуется</span> : null}
                        </div>
                        <div className="mt-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">{meta.desc}</div>
                        {!available && p.unavailableReason ? <div data-testid={`scenario-unavailable-${p.profile}`} className="mt-1 text-[length:var(--text-xs)] font-medium text-[var(--warning-text)]">Недоступен: {UNAVAILABLE_REASON[p.unavailableReason]}</div> : null}
                      </div>
                      <div className="w-[120px]">
                        <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">Финиш</div>
                        <div className="mt-0.5 flex items-center gap-1"><span className="mono text-[length:var(--text-sm)] text-[var(--text)]">{ddmm(p.explainability.finishDate)}</span><FinishChip d={finishDelta(p)} /></div>
                      </div>
                      <div className="w-[110px]">
                        <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">Перегруз</div>
                        <div className="mt-0.5 flex items-center gap-1"><span className="mono text-[length:var(--text-sm)] text-[var(--text)]">{h(p.explainability.overloadMinutes)} ч</span>{p.conflictEffect === "accepted" ? <span className="rounded-full bg-[var(--warning-soft)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold text-[var(--warning-text)]">принят</span> : <OverChip m={overloadDelta(p)} />}</div>
                      </div>
                      <div className="w-[120px]">
                        <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">Изм. задач</div>
                        <div className="mt-0.5 flex items-center gap-1"><span className="mono text-[length:var(--text-sm)] text-[var(--text)]">{p.explainability.changedTaskIds.length}</span><span className={cn("rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", risk.cls)}>{risk.label}</span></div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button variant="secondary" size="sm" disabled={!available} onClick={() => setCompareId(compareId === p.id ? null : p.id)}>{compareId === p.id ? "Скрыть" : "Сравнить"}</Button>
                        {canApplyScenarios ? <Button variant="default" size="sm" disabled={applyBusy || !available} onClick={() => void onApply(p)}><Check className="size-3.5" aria-hidden />Применить</Button> : null}
                      </div>
                    </div>

                    {/* поле причины риска для агрессивного */}
                    {canApplyScenarios && p.conflictEffect === "accepted" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] px-2.5 py-1.5">
                        <span className="text-[length:var(--text-xs)] font-medium text-[var(--warning-text)]">Причина принятия риска (обязательна):</span>
                        <input value={riskReason} aria-invalid={reasonError ? true : undefined} onChange={(e) => { setReasonError(null); setRiskReason(e.target.value); }} placeholder="напр. согласовано с РП, срок критичнее" className="h-7 min-w-[240px] flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)] aria-[invalid]:border-[var(--danger)]" />
                        {reasonError ? <span role="alert" className="w-full text-[length:var(--text-xs)] font-medium text-[var(--danger-text)]">{reasonError}</span> : null}
                      </div>
                    ) : null}

                    {/* сравнение (07b) — inline */}
                    {compareP && compareP.id === p.id ? (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Сравнение · предпросмотр (ничего не сохранено)</span>
                          <button type="button" onClick={() => setCompareId(null)} className="grid size-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label="Закрыть"><X className="size-3.5" aria-hidden /></button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {([
                            { title: `Сейчас · план v${readModel.planVersion}`, ring: false, kpi: [["Финиш", ddmm(model.baseFinish), null], ["Дедлайн", ddmm(model.deadline), null], ["Перегруз", `${h(baseOverloadMin)} ч`, null], ["Изм. задач", "0", null]] as Array<[string, string, ReactNode]> },
                            { title: `${meta.label} · предпросмотр`, ring: true, kpi: [["Финиш", ddmm(p.explainability.finishDate), <FinishChip key="f" d={finishDelta(p)} />], ["Дедлайн", ddmm(model.deadline), null], ["Перегруз", `${h(p.explainability.overloadMinutes)} ч`, p.conflictEffect === "accepted" ? null : <OverChip key="o" m={overloadDelta(p)} />], ["Изм. задач", `${p.explainability.changedTaskIds.length}`, null]] as Array<[string, string, ReactNode]> }
                          ]).map((col) => (
                            <div key={col.title} className={cn("rounded-[var(--radius-md)] border bg-[var(--panel-subtle)] p-2.5", col.ring ? "border-[var(--info)] shadow-[0_0_0_1px_var(--info)]" : "border-[var(--border)]")}>
                              <div className="mb-2 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{col.title}</div>
                              <div className="grid grid-cols-2 gap-2">
                                {col.kpi.map(([label, value, chip]) => (
                                  <div key={label} className="rounded-[var(--radius-sm)] bg-[var(--panel)] px-2 py-1.5">
                                    <div className="text-[length:var(--text-2xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">{label}</div>
                                    <div className="mt-0.5 flex items-center gap-1"><span className="mono text-[length:var(--text-sm)] tabular-nums text-[var(--text-strong)]">{value}</span>{chip}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* diff-list изменений (из planDelta.commands — контрактные данные) */}
                        {(() => { const diff = deriveDiff(p); return (
                        <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)]">
                          <div className="border-b border-[var(--border-subtle)] px-2.5 py-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Изменения ({diff.length})</div>
                          {diff.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-2.5 py-1.5 last:border-b-0 text-[length:var(--text-xs)]">
                              <span className="mono w-[42px] shrink-0 text-[var(--muted)]">{d.wbs}</span>
                              <span className="min-w-0 flex-1 truncate text-[var(--text)]"><span className="font-medium">{d.title}</span> · {d.detail}</span>
                              <span className="mono shrink-0 text-[var(--muted-strong)]">{d.delta}</span>
                            </div>
                          ))}
                        </div>
                        ); })()}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* конфликт-баннер: рекомендованный сценарий не устраняет (если все accepted) — опускаем; банер про коммит */}
          <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted)]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--muted-soft)]" aria-hidden />
            <span>Применение сценария вносит все изменения одной операцией: она проверяется по правам, записывается в историю изменений, и план получает новую версию. Откат доступен на вкладке «Коммиты».</span>
          </div>
        </>
      )}

      {scenarioErr ? <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text)]">{scenarioErr}</div> : null}
    </DeliveryFrame>
  );
}
