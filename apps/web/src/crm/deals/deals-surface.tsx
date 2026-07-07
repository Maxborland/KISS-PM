"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FormDialog } from "@/components/domain/form-dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { StatTile } from "@/delivery/ui/bento";
import { cn } from "@/lib/cn";
import { makeRuError } from "@/lib/error-messages";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { money } from "@/crm/ui/crm-bits";
import { getCrmWriteCapability } from "@/crm/ui/permissions";
import { useCrm, useCrmUsers } from "@/crm/lib/use-crm";
import { useCrmRuntime } from "@/crm/lib/crm-runtime";
import type { DealStage, Opportunity, Pipeline, StageTransition } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useSessionUser } from "@/shell/use-session-user";

type Mode = "kanban" | "list" | "forecast";
const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const initials = (name: string) => { const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—"; };
// Дефолты дат формы «Новая сделка» (G4-15): старт = сегодня, финиш = +N месяцев (локальная дата).
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoToday = () => isoOf(new Date());
const isoPlusMonths = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return isoOf(d); };
const STATUS_LABEL: Record<Opportunity["status"], string> = { new: "Новая", feasibility: "Проверка", ready_to_activate: "Готова", won_closed: "Выиграна", lost_rejected: "Проиграна" };
const isFinal = (o: Opportunity) => o.status === "won_closed" || o.status === "lost_rejected";

const ERR_RU: Record<string, string> = {
  opportunity_stage_locked: "Сделка закрыта — стадию не изменить",
  deal_stage_not_found: "Стадия не найдена",
  invalid_opportunity_title: "Укажите название",
  invalid_planned_dates: "Неверные даты (финиш ≥ старт)",
  invalid_contract_value: "Сумма — положительное целое",
  invalid_planned_hourly_rate: "Ставка — положительное целое",
  invalid_probability: "Вероятность 0…100",
  client_not_found: "Клиент не найден или неактивен",
  contact_not_found: "Контакт не найден или не у этого клиента",
  project_type_not_found: "Тип проекта не найден",
  // мультиворонки: причины блокировки перехода (домен evaluateStageTransition/evaluatePipelineChange)
  transition_not_allowed: "Переход между этими стадиями не разрешён в воронке",
  condition_probability: "Условие не выполнено: недостаточная вероятность",
  condition_feasibility: "Условие не выполнено: реализуемость не подтверждена (feasibility ≠ ok)",
  cross_pipeline_move: "Это другая воронка — используйте «Перенести в воронку»",
  pipeline_archived: "Целевая воронка архивирована",
  deal_stage_inactive: "Целевая стадия архивирована",
  stage_not_in_pipeline: "Стадия не принадлежит выбранной воронке",
  opportunity_finalized: "Сделка завершена — перенос недоступен",
  pipeline_not_found: "Воронка не найдена"
};
const ruErr = makeRuError(ERR_RU);

export function ProjectDeals() {
  const { live } = useCrmRuntime();
  const sessionUser = useSessionUser();
  const createDealCapability = getCrmWriteCapability({ live, permissions: sessionUser?.permissions ?? [], permission: "tenant.opportunities.manage" });
  const createPipelineCapability = getCrmWriteCapability({ live, permissions: sessionUser?.permissions ?? [], permission: "tenant.crm_pipelines.manage" });
  const createStageCapability = getCrmWriteCapability({ live, permissions: sessionUser?.permissions ?? [], permission: "tenant.deal_stages.manage" });
  const createPipelineDisabledReason = createPipelineCapability.disabledReason ?? createStageCapability.disabledReason;
  const crm = useCrm();
  const { data, status, error, reload, moveStage, movePipeline, createOpportunity } = crm;
  const users = useCrmUsers();
  const [mode, setMode] = useState<Mode>("kanban");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Opportunity | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!data) return null;
    const pipelines = [...data.pipelines].sort((a, b) => a.sortOrder - b.sortOrder);
    const selected = pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0] ?? null;
    // Стадии и сделки — ТОЛЬКО выбранной воронки (стадия сделки определяет её воронку).
    // Сделки без стадии показываем отдельной колонкой «Без стадии» (они вне воронок);
    // сделки чужих воронок в этом виде скрыты (видны при выборе их воронки).
    const stages = data.dealStages.filter((s) => selected && s.pipelineId === selected.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const byStage = new Map<string, Opportunity[]>();
    for (const s of stages) byStage.set(s.id, []);
    const inPipeline: Opportunity[] = [];
    const unstaged: Opportunity[] = [];
    for (const o of data.opportunities) {
      if (!o.stageId) { unstaged.push(o); continue; }
      const arr = byStage.get(o.stageId);
      if (arr) { arr.push(o); inPipeline.push(o); }
    }
    const transitions = data.stageTransitions.filter((t) => selected && t.pipelineId === selected.id);
    return { pipelines, selected, stages, byStage, unstaged, opps: inPipeline, transitions, allStages: data.dealStages };
  }, [data, pipelineId]);

  // Верхнеуровневые loading/error/forbidden — через SurfaceState (внутри CrmFrame).
  // Лестница статусов — общий surfaceStatusOf; reload-с-данными по-прежнему рендерит ready (поведение не меняем).
  // Доп. проверки !model/!data в if дублируют hasData только ради TS-narrowing: тело ниже дереференсит model/data.
  // НЕ трогаем вложенные состояния (per-column «перетащите сюда», панель переходов) — это ready-контент.
  const surfaceStatus = surfaceStatusOf(status, Boolean(model && data));
  if (surfaceStatus !== "ready" || !model || !data) {
    return (
      <CrmFrame activeTab="Сделки">
        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={ruErr}
          loadingLabel="Загрузка сделок…"
          forbidden={{ title: "Доступ к сделкам ограничен", description: "У вас нет прав на просмотр воронки продаж." }}
        >
          <span />
        </SurfaceState>
      </CrmFrame>
    );
  }

  // Имя владельца: если справочник пользователей недоступен/неполон (например, 403 под
  // ограниченной ролью), НЕ показываем сырой id — даём читабельный фолбэк «Участник xxxx».
  const ownerName = (id: string | null) => { if (!id) return "—"; return users.byId.get(id)?.name ?? `Участник ${id.slice(-4)}`; };
  const ownerColor = (id: string | null): BemAvatarColor => { const i = users.indexOf(id); return i < 0 ? "c5" : AV[i % AV.length]!; };
  const stageName = (id: string | null) => model.allStages.find((s) => s.id === id)?.name ?? "—";
  const pipelineName = (id: string | null) => model.pipelines.find((p) => p.id === id)?.name ?? "—";
  const pipelineOfStage = (stageId: string | null) => model.allStages.find((s) => s.id === stageId)?.pipelineId ?? null;

  async function doMove(id: string, stageId: string) {
    setBusy(true);
    const res = await moveStage(id, stageId);
    setBusy(false);
    if (res.ok) toast.success(`Сделка перемещена в «${stageName(stageId)}»`);
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  // Возвращает текст ошибки (для показа ВНУТРИ модалки) или null при успехе.
  async function doMovePipeline(id: string, targetPipelineId: string, targetStageId: string): Promise<string | null> {
    setBusy(true);
    const res = await movePipeline(id, targetPipelineId, targetStageId);
    setBusy(false);
    if (res.ok) {
      setMoveTarget(null);
      toast.success(`Сделка перенесена в воронку «${pipelineName(targetPipelineId)}» → «${stageName(targetStageId)}»`);
      return null;
    }
    return ruErr(res.code, res.message);
  }

  const dropOn = (stageId: string) => {
    const id = dragId; setDragId(null); setOverStage(null);
    if (!id) return;
    const opp = model.opps.find((o) => o.id === id);
    if (opp && !isFinal(opp) && opp.stageId !== stageId) void doMove(id, stageId);
  };

  // Онбординг пустого тенанта (G4-09): воронок ещё нет — вместо пустого канбана
  // предлагаем создать первую воронку прямо отсюда.
  // Вместе со стадиями: воронка без стадий — те же пустые колонки и тупиковая
  // модалка сделки (ревью PR #224).
  async function createDefaultPipeline() {
    setBusy(true);
    try {
      const { pipeline } = await crm.client.createPipeline({ name: "Основная воронка", sortOrder: 1, isDefault: true });
      const defaultStages = ["Новая", "Переговоры", "Договор"];
      for (const [i, name] of defaultStages.entries()) {
        await crm.client.createDealStage({ name, sortOrder: i + 1, pipelineId: pipeline.id });
      }
      toast.success(`Воронка «${pipeline.name}» создана: стадии ${defaultStages.join(" → ")}`);
      void reload();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error(`Отклонено: ${ruErr(err.code, err.message)}`);
    } finally {
      setBusy(false);
    }
  }

  if (model.pipelines.length === 0) {
    return (
      <CrmFrame activeTab="Сделки" subtitle="Воронка продаж и активные сделки">
        <SurfaceState
          status="empty"
          empty={{
            title: "Воронка продаж ещё не настроена",
            description: "Создайте первую воронку — в ней появятся стадии, и сделки можно будет вести по канбану.",
            action: (
              <Button variant="default" disabled={busy || Boolean(createPipelineDisabledReason)} title={createPipelineDisabledReason ?? "Создать воронку"} onClick={() => void createDefaultPipeline()}>
                <Plus className="size-3.5" aria-hidden />Создать воронку
              </Button>
            )
          }}
        >
          <span />
        </SurfaceState>
      </CrmFrame>
    );
  }

  const createDealDialog = <CreateDealDialog stages={model.stages} data={data} busy={busy} setBusy={setBusy} create={createOpportunity} disabledReason={createDealCapability.disabledReason} />;

  return (
    <CrmFrame activeTab="Сделки" subtitle="Воронка продаж и активные сделки" actions={createDealDialog}>
      {/* мультиворонки: выбор воронки — фильтрует стадии/сделки/переходы */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Воронка:</span>
        {model.pipelines.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPipelineId(p.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--text-xs)] font-medium transition-colors",
              model.selected?.id === p.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted-strong)] hover:border-[var(--accent-muted)]"
            )}
          >
            {p.name}
            {p.isDefault ? <span className="rounded-full bg-[var(--panel-strong)] px-1 text-[length:var(--text-2xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">по умолч.</span> : null}
            {p.status === "archived" ? <span className="text-[length:var(--text-2xs)] uppercase text-[var(--danger-text)]">архив</span> : null}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented name="deals-mode" value={mode} onChange={setMode} options={[{ value: "kanban", label: "Канбан" }, { value: "list", label: "Список" }, { value: "forecast", label: "Прогноз" }]} />
        {mode === "kanban" ? <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Перетащите карточку между стадиями (переход проверяется условиями воронки)</span> : null}
        {mode === "list" ? <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Кнопка «⇄ Воронка» — перенос сделки в другую воронку</span> : null}
      </div>

      {/* Плашка-прототип: только вне live (раньше пряталась display:none и оставалась в DOM). */}
      {!live ? (
      <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>Реальный контракт CRM: /api/workspace/{"{pipelines, deal-stages, opportunities}"}. Перенос стадии — PATCH /opportunities/:id/stage (условия переходов воронки: 422 — условие не выполнено, 409 — переход запрещён); перенос между воронками — PATCH /opportunities/:id/pipeline. Без planVersion (плоский REST). Данные in-memory.</span>
      </div>
      ) : null}

      <MovePipelineDialog target={moveTarget} pipelines={model.pipelines} allStages={model.allStages} currentPipelineId={pipelineOfStage(moveTarget?.stageId ?? null)} busy={busy} onClose={() => setMoveTarget(null)} onMove={doMovePipeline} />

      <div key={mode} className="anim-fade-in">
      {mode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {model.stages.map((s) => {
            const items = model.byStage.get(s.id) ?? [];
            const sum = items.reduce((a, o) => a + o.contractValue, 0);
            return (
              <div
                key={s.id}
                onDragOver={(e) => { e.preventDefault(); if (overStage !== s.id) setOverStage(s.id); }}
                onDrop={() => dropOn(s.id)}
                className={cn("flex w-[260px] shrink-0 flex-col rounded-[var(--radius-card)] border bg-[var(--panel-subtle)]", overStage === s.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]")}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                  <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{s.name}</span>
                  <span className="flex items-center gap-1.5"><span className="v4-num text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{money(sum)}</span><span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{items.length}</span></span>
                </div>
                <div className="flex min-h-[120px] flex-col gap-2 p-2">
                  {items.map((o) => {
                    const final = isFinal(o);
                    return (
                      <article
                        key={o.id}
                        draggable={!final && !busy}
                        onDragStart={() => setDragId(o.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null); }}
                        className={cn("hover-lift rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-2.5 shadow-[var(--shadow-card)]", !final && !busy ? "cursor-grab active:cursor-grabbing" : "opacity-90", dragId === o.id && "opacity-50")}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          {prototypeNotesEnabled ? <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{o.id}</span> : <span />}
                          <BemAvatar initials={initials(ownerName(o.ownerUserId))} color={ownerColor(o.ownerUserId)} size="sm" title={ownerName(o.ownerUserId)} />
                        </div>
                        <h3 className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--text-strong)]">{o.title}</h3>
                        <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">{o.clientName}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="v4-num text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{money(o.contractValue)}</span>
                          {final ? <Chip variant={o.status === "won_closed" ? "success" : "danger"}>{STATUS_LABEL[o.status]}</Chip> : <span className="v4-num text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{o.probability}%</span>}
                        </div>
                      </article>
                    );
                  })}
                  {items.length === 0 ? <div className="grid flex-1 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] py-4 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">перетащите сюда</div> : null}
                </div>
              </div>
            );
          })}
          {model.unstaged.length ? (
            <div className="flex w-[260px] shrink-0 flex-col rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2"><span className="text-[length:var(--text-sm)] font-semibold text-[var(--muted-strong)]">Без стадии</span><span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]">{model.unstaged.length}</span></div>
              <div className="flex flex-col gap-2 p-2">
                {model.unstaged.map((o) => (
                  <article key={o.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-2.5 shadow-[var(--shadow-card)]">
                    <div className="mb-1 flex items-center justify-between gap-2">{prototypeNotesEnabled ? <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{o.id}</span> : <span />}<BemAvatar initials={initials(ownerName(o.ownerUserId))} color={ownerColor(o.ownerUserId)} size="sm" /></div>
                    <h3 className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--text-strong)]">{o.title}</h3>
                    <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">{o.clientName}</p>
                    <div className="v4-num mt-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{money(o.contractValue)}</div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : mode === "list" ? (
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
              <th className="px-3 py-2 font-semibold">Сделка</th><th className="px-3 py-2 font-semibold">Клиент</th><th className="px-3 py-2 font-semibold">Стадия</th><th className="px-3 py-2 text-right font-semibold">Сумма</th><th className="px-3 py-2 text-right font-semibold">Вероятн.</th><th className="px-3 py-2 font-semibold">Владелец</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {model.opps.map((o) => (
                <tr key={o.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{o.title}</div>{prototypeNotesEnabled ? <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{o.id}</div> : null}</td>
                  <td className="px-3 py-2 text-[var(--muted-strong)]">{o.clientName}</td>
                  <td className="px-3 py-2">
                    <select value={o.stageId ?? ""} disabled={busy || isFinal(o)} onChange={(e) => void doMove(o.id, e.target.value)} className="h-7 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-1.5 text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60">
                      {model.stages.some((s) => s.id === o.stageId) ? null : <option value={o.stageId ?? ""}>— без стадии —</option>}
                      {model.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {isFinal(o) ? <Chip variant={o.status === "won_closed" ? "success" : "danger"} className="ml-1.5">{STATUS_LABEL[o.status]}</Chip> : null}
                  </td>
                  <td className="px-3 py-2 text-right"><span className="v4-num font-semibold text-[var(--text-strong)]">{money(o.contractValue)}</span></td>
                  <td className="px-3 py-2 text-right"><span className="v4-num text-[var(--muted-strong)]">{o.probability}%</span></td>
                  <td className="px-3 py-2"><span className="flex items-center gap-1.5"><BemAvatar initials={initials(ownerName(o.ownerUserId))} color={ownerColor(o.ownerUserId)} size="sm" /><span className="text-[length:var(--text-xs)] text-[var(--muted)]">{ownerName(o.ownerUserId)}</span></span></td>
                  <td className="px-3 py-2 text-right"><Button variant="ghost" size="sm" disabled={busy || isFinal(o)} onClick={() => setMoveTarget(o)} title="Перенести в другую воронку"><ArrowLeftRight className="size-3.5" aria-hidden />Воронка</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Forecast stages={model.stages} byStage={model.byStage} />
      )}
      </div>

      <TransitionsPanel transitions={model.transitions} pipelineName={model.selected?.name ?? "—"} stageName={stageName} />
    </CrmFrame>
  );
}

function Forecast({ stages, byStage }: { stages: DealStage[]; byStage: Map<string, Opportunity[]> }) {
  const all = stages.flatMap((s) => byStage.get(s.id) ?? []);
  // В воронке/прогнозе — только незакрытые: исключаем ОБА финала (lost_rejected и won_closed),
  // иначе won-сделка считается и в открытой воронке, и отдельно в «Выиграно» (двойной счёт).
  const open = all.filter((o) => o.status !== "lost_rejected" && o.status !== "won_closed");
  const weighted = open.reduce((a, o) => a + (o.contractValue * o.probability) / 100, 0);
  const total = open.reduce((a, o) => a + o.contractValue, 0);
  const won = all.filter((o) => o.status === "won_closed").reduce((a, o) => a + o.contractValue, 0);
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="В воронке" value={money(total)} delta={`${open.length} сделок`} />
        <StatTile label="Взвешенный прогноз" value={money(weighted)} delta="Σ сумма × вероятность" tone="success" />
        <StatTile label="Выиграно" value={money(won)} delta="закрытые сделки" tone="success" />
        <StatTile label="Стадий" value={`${stages.length}`} delta="в воронке" />
      </div>
      <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
        <table className="w-full border-collapse text-[length:var(--text-sm)]">
          <thead><tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
            <th className="px-3 py-2 font-semibold">Стадия</th><th className="px-3 py-2 text-right font-semibold">Сделок</th><th className="px-3 py-2 text-right font-semibold">Сумма</th><th className="px-3 py-2 text-right font-semibold">Взвешенно</th>
          </tr></thead>
          <tbody>
            {stages.map((s) => {
              const items = (byStage.get(s.id) ?? []).filter((o) => o.status !== "lost_rejected" && o.status !== "won_closed");
              const sum = items.reduce((a, o) => a + o.contractValue, 0);
              const w = items.reduce((a, o) => a + (o.contractValue * o.probability) / 100, 0);
              return (
                <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-2 font-medium text-[var(--text-strong)]">{s.name}</td>
                  <td className="px-3 py-2 text-right v4-num text-[var(--muted-strong)]">{items.length}</td>
                  <td className="px-3 py-2 text-right v4-num text-[var(--text)]">{money(sum)}</td>
                  <td className="px-3 py-2 text-right v4-num font-semibold text-[var(--success-text)]">{money(w)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";

// Мультиворонки: правила переходов выбранной воронки (read) — документируют «условия переходов» для хендоффа.
function TransitionsPanel({ transitions, pipelineName, stageName }: { transitions: StageTransition[]; pipelineName: string; stageName: (id: string | null) => string }) {
  return (
    <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Условия переходов</h3>
        <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">воронка «{pipelineName}»{prototypeNotesEnabled ? " · GET /pipelines/:id/stage-transitions" : ""}</span>
      </div>
      {transitions.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Переходы не настроены — переносы между стадиями этой воронки не ограничены.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {transitions.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)]">
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[var(--muted-strong)]">
                {stageName(t.fromStageId)} <span className="text-[var(--muted-soft)]">→</span> {stageName(t.toStageId)}
              </span>
              {t.requireFeasibilityOk ? <Chip variant="warning">осуществимость: ок</Chip> : null}
              {t.minProbability !== null ? <Chip variant="warning">вероятность ≥ {t.minProbability}%</Chip> : null}
              {!t.requireFeasibilityOk && t.minProbability === null ? <span className="text-[var(--muted-soft)]">без условий</span> : null}
              {t.guardNote ? <span className="truncate text-[var(--muted-soft)]">· {t.guardNote}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Мультиворонки: перенос сделки в другую воронку (PATCH /opportunities/:id/pipeline).
function MovePipelineDialog({ target, pipelines, allStages, currentPipelineId, busy, onClose, onMove }: {
  target: Opportunity | null;
  pipelines: Pipeline[];
  allStages: DealStage[];
  currentPipelineId: string | null;
  busy: boolean;
  onClose: () => void;
  onMove: (id: string, pipelineId: string, stageId: string) => Promise<string | null>;
}) {
  const [targetPipelineId, setTargetPipelineId] = useState("");
  const [targetStageId, setTargetStageId] = useState("");
  const options = pipelines.filter((p) => p.status === "active" && p.id !== currentPipelineId);
  const stages = allStages.filter((s) => s.pipelineId === targetPipelineId && s.status === "active").sort((a, b) => a.sortOrder - b.sortOrder);
  const valid = Boolean(targetPipelineId && targetStageId);
  const reset = () => { setTargetPipelineId(""); setTargetStageId(""); };
  return (
    <FormDialog
      title="Перенести сделку в другую воронку"
      open={target !== null}
      onClose={() => { onClose(); reset(); }}
      submitLabel={<><ArrowLeftRight className="size-3.5" aria-hidden />Перенести</>}
      submitDisabled={!valid || busy}
      contentClassName="max-w-[460px]"
      // Успех — toast в родителе; ошибка остаётся В модалке (G4-05).
      onSubmit={async () => {
        if (!target || !valid) return null;
        return onMove(target.id, targetPipelineId, targetStageId);
      }}
      onSuccess={reset}
    >
      {target ? <p className="text-[length:var(--text-xs)] text-[var(--muted)]">«{target.title}» · текущая воронка: {pipelines.find((p) => p.id === currentPipelineId)?.name ?? "—"}</p> : null}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Целевая воронка
          <select value={targetPipelineId} onChange={(e) => { setTargetPipelineId(e.target.value); setTargetStageId(""); }} className={selCls}>
            <option value="" disabled>Выберите воронку…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Стадия в целевой воронке
          <select value={targetStageId} onChange={(e) => setTargetStageId(e.target.value)} disabled={!targetPipelineId} className={selCls}>
            <option value="" disabled>{targetPipelineId ? "Выберите стадию…" : "Сначала воронка"}</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Сделка перейдёт в выбранную воронку на выбранную стадию. Завершённые сделки, архивные воронки и стадии перенести нельзя.</p>
    </FormDialog>
  );
}

function CreateDealDialog({ stages, data, busy, setBusy, create, disabledReason }: {
  stages: DealStage[];
  data: ReturnType<typeof useCrm>["data"];
  busy: boolean;
  setBusy: (v: boolean) => void;
  create: ReturnType<typeof useCrm>["createOpportunity"];
  disabledReason?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  // Суммы не предзаполняем фиктивными значениями — пользователь вводит реальные (G4-15).
  const [contractValue, setContractValue] = useState("");
  const [rate, setRate] = useState("");
  const [probability, setProbability] = useState("40");
  // Разумные дефолты дат: старт = сегодня, финиш = +3 месяца (G4-15).
  const [start, setStart] = useState(() => isoToday());
  const [finish, setFinish] = useState(() => isoPlusMonths(3));

  if (!data) return null;
  const clients = data.clients.filter((c) => c.status === "active");
  const contacts = data.contacts.filter((c) => c.clientId === clientId && c.status === "active");
  const projectTypeId = data.projectTypes[0]?.id ?? "";
  const valid = title.trim() && clientId && contactId && stageId && Number(contractValue) > 0 && Number(rate) > 0 && finish >= start;

  // Онбординг пустого тенанта (G8-12): честно объясняем, чего не хватает для создания
  // сделки и где это создать, — вместо вечно неактивной кнопки «Создать» без причины.
  const missing: ReactNode[] = [];
  const hintLink = "text-[var(--accent-text)] underline-offset-2 hover:underline";
  if (clients.length === 0) missing.push(<>Нет активных клиентов — сначала создайте клиента в разделе <Link href="/crm/clients" className={hintLink}>«Клиенты»</Link>.</>);
  if (clientId && contacts.length === 0) missing.push(<>У выбранного клиента нет активных контактов — добавьте контакт в разделе <Link href="/crm/contacts" className={hintLink}>«Контакты»</Link>.</>);
  if (stages.length === 0) missing.push(<>Воронка продаж не настроена — создайте воронку на вкладке «Сделки», тогда появятся стадии.</>);
  if (data.projectTypes.length === 0) missing.push(<>Не настроены типы проектов — обратитесь к администратору рабочей области.</>);

  return (
    <FormDialog
      title="Новая сделка"
      trigger={<Button variant="default" size="sm" disabled={busy || Boolean(disabledReason)} title={disabledReason ?? "Создать сделку"}><Plus className="size-3.5" aria-hidden />Сделка</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      successToast="Сделка создана"
      // Ошибка остаётся В модалке — раньше уходила строкой под оверлеем (G4-05).
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const res = await create({ clientId, primaryContactId: contactId, projectTypeId, stageId, title: title.trim(), plannedStart: start, plannedFinish: finish, contractValue: Math.round(Number(contractValue)), plannedHourlyRate: Math.round(Number(rate)), probability: Math.round(Number(probability)), demand: [{ positionId: "backend", requiredHours: Math.min(100000, Math.max(1, Math.floor(Number(contractValue) / Number(rate)))) }] });
        setBusy(false);
        return res.ok ? null : ruErr(res.code, res.message);
      }}
      onSuccess={() => { setTitle(""); setClientId(""); setContactId(""); setStageId(""); setContractValue(""); setRate(""); }}
    >
      {missing.length ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <p className="mb-1 font-medium">Для создания сделки не хватает данных:</p>
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {missing.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Внедрение портала" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Клиент
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setContactId(""); }} className={selCls}><option value="" disabled>Выберите…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Контакт
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!clientId} className={selCls}><option value="" disabled>{clientId ? "Выберите…" : "Сначала клиент"}</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Стадия
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={selCls}><option value="" disabled>Выберите…</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Вероятность, %<Input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Сумма, ₽<Input type="number" min={1} value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="1 000 000" className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Ставка, ₽/ч<Input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="3 500" className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Старт<Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Финиш<Input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} aria-invalid={finish < start} /></label>
        </div>
        <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Плановая трудоёмкость рассчитывается автоматически: сумма ÷ ставка. Спрос на ресурсы предзаполняется по трудоёмкости — уточнить его можно после создания сделки. Сделка создаётся со статусом «Новая».</p>
    </FormDialog>
  );
}
