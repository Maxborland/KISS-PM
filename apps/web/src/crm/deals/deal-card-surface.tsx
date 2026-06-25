"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, FlaskConical, Loader2, Lock, Rocket, Save, Send, Square, Trophy, XCircle } from "lucide-react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceState } from "@/components/domain/surface-state";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { money } from "@/crm/ui/crm-bits";
import { useCrm } from "@/crm/lib/use-crm";
import { CRM_USERS } from "@/crm/lib/mock-crm-backend";
import type { CrmActivity, FeasibilityAssessment, Opportunity } from "@/crm/lib/crm-client";

const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const userById = new Map(CRM_USERS.map((u) => [u.id, u]));
const ownerColor = (id: string | null): BemAvatarColor => { const i = CRM_USERS.findIndex((u) => u.id === id); return i < 0 ? "c5" : AV[i % AV.length]!; };
const initials = (name: string) => { const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—"; };
const ownerName = (id: string | null) => (id ? userById.get(id)?.name ?? id : "—");

const STATUS_LABEL: Record<Opportunity["status"], string> = { new: "Новая", feasibility: "Проверка", ready_to_activate: "Готова к запуску", won_closed: "Выиграна", lost_rejected: "Проиграна" };
const isFinal = (o: Opportunity) => o.status === "won_closed" || o.status === "lost_rejected";
const FEAS_TONE: Record<string, "success" | "warning" | "danger"> = { ok: "success", warning: "warning", conflict: "danger", blocked: "danger" };
const FEAS_LABEL: Record<string, string> = { ok: "Реализуема", warning: "С оговорками", conflict: "Конфликт ресурсов", blocked: "Заблокирована" };
const BLOCKER_RU: Record<string, string> = {
  invalid_dates: "Некорректные даты планирования",
  invalid_contract_terms: "Некорректные условия (сумма/ставка)",
  demand_required: "Не задан спрос на ресурсы",
  demand_exceeds_planned_hours: "Спрос превышает плановые часы",
  missing_position_capacity: "Нет активной ёмкости по позиции"
};
const WARNING_RU: Record<string, string> = { unallocated_planned_hours: "Есть нераспределённые плановые часы" };

const ERR_RU: Record<string, string> = {
  opportunity_update_locked: "Сделка завершена — правки недоступны",
  opportunity_not_feasible: "Сделка завершена — проверка недоступна",
  opportunity_not_activatable: "Сделку нельзя активировать (завершена или непроходима)",
  feasibility_required: "Сначала запустите проверку осуществимости",
  risk_acceptance_required: "Конфликт ресурсов — укажите обоснование риска",
  crm_activity_locked: "Сделка завершена — лента закрыта для записи",
  crm_task_not_found: "Задача не найдена",
  comment_body_required: "Комментарий не может быть пустым",
  invalid_opportunity_title: "Укажите название",
  invalid_planned_dates: "Неверные даты (финиш ≥ старт, ≤ 730 дней)",
  invalid_contract_value: "Сумма — положительное целое",
  invalid_planned_hourly_rate: "Ставка — положительное целое",
  invalid_probability: "Вероятность 0…100",
  owner_user_not_found: "Владелец не найден"
};
const ruErr = (code?: string, fallback?: string) => (code && ERR_RU[code]) || fallback || code || "Ошибка";

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

type FormState = { title: string; description: string; stageId: string; ownerUserId: string; probability: string; contractValue: string; plannedHourlyRate: string; plannedStart: string; plannedFinish: string };
const formOf = (o: Opportunity): FormState => ({
  title: o.title, description: o.description ?? "", stageId: o.stageId ?? "", ownerUserId: o.ownerUserId ?? "",
  probability: String(o.probability), contractValue: String(o.contractValue), plannedHourlyRate: String(o.plannedHourlyRate),
  plannedStart: o.plannedStart, plannedFinish: o.plannedFinish
});

export function DealCard() {
  const crm = useCrm();
  const { data, status, error, reload } = crm;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo<Opportunity | null>(() => {
    if (!data) return null;
    return data.opportunities.find((o) => o.id === selectedId) ?? data.opportunities.find((o) => o.id === "opp-2207") ?? data.opportunities[0] ?? null;
  }, [data, selectedId]);

  // Верхнеуровневые loading/error/forbidden — через SurfaceState (внутри CrmFrame).
  // Тело ниже дереференсит data/selected, поэтому сохраняем early-return для не-ready состояний.
  // НЕ трогаем вложенные состояния (лента активностей, виджет осуществимости) — это ready-контент.
  // selected===null при наличии data = «нет сделок» — показываем как ошибку (как было раньше).
  if ((status === "loading" && !data) || status === "error" || status === "forbidden" || !data || !selected) {
    const stateStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <CrmFrame activeTab="Сделки">
        <SurfaceState
          status={stateStatus}
          error={error ?? "нет сделок"}
          onRetry={() => void reload()}
          errorFormat={ruErr}
          loadingLabel="Загрузка сделки…"
          forbidden={{ title: "Доступ к сделке ограничен", description: "У вас нет прав на просмотр карточки сделки." }}
        >
          <span />
        </SurfaceState>
      </CrmFrame>
    );
  }

  return (
    <CrmFrame
      activeTab="Сделки"
      subtitle="Карточка сделки"
      actions={
        <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="h-9 max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]" title="Выбрать сделку">
          {data.opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      }
    >
      <DealCardBody key={selected.id} crm={crm} data={data} opp={selected} />
    </CrmFrame>
  );
}

function DealCardBody({ crm, data, opp }: { crm: ReturnType<typeof useCrm>; data: NonNullable<ReturnType<typeof useCrm>["data"]>; opp: Opportunity }) {
  const [form, setForm] = useState<FormState>(() => formOf(opp));
  const [feasibility, setFeasibility] = useState<FeasibilityAssessment | null>(() => (opp.feasibilityResult as FeasibilityAssessment | null) ?? null);
  const [activities, setActivities] = useState<CrmActivity[] | null>(null);
  const [comment, setComment] = useState("");
  const [riskReason, setRiskReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const locked = isFinal(opp);
  const stages = useMemo(() => [...data.dealStages].filter((s) => s.pipelineId === opp.pipelineId).sort((a, b) => a.sortOrder - b.sortOrder), [data.dealStages, opp.pipelineId]);
  const pipelineName = data.pipelines.find((p) => p.id === opp.pipelineId)?.name ?? "—";
  const stageName = (id: string | null) => data.dealStages.find((s) => s.id === id)?.name ?? "— без стадии —";
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(formOf(opp)), [form, opp]);
  const projects = data.projects.filter((p) => p.sourceOpportunityId === opp.id);

  // лента активностей сделки — грузим при монтаже/смене сделки
  useEffect(() => {
    let alive = true;
    void crm.loadActivities("opportunity", opp.id).then((r) => { if (alive) setActivities(r.ok ? r.data : []); });
    return () => { alive = false; };
  }, [crm, opp.id]);

  const plannedHours = (() => { const v = Number(form.contractValue), r = Number(form.plannedHourlyRate); return r > 0 && v > 0 ? Math.floor(v / r) : 0; })();

  async function save() {
    setBusy(true); setNotice(null);
    const res = await crm.updateOpportunity(opp.id, {
      clientId: opp.clientId ?? "", primaryContactId: opp.primaryContactId ?? "", projectTypeId: opp.projectTypeId ?? "",
      stageId: form.stageId, title: form.title.trim(), description: form.description.trim() || null,
      plannedStart: form.plannedStart, plannedFinish: form.plannedFinish,
      contractValue: Math.round(Number(form.contractValue)), plannedHourlyRate: Math.round(Number(form.plannedHourlyRate)),
      probability: Math.round(Number(form.probability)), demand: opp.demand, ownerUserId: form.ownerUserId || null
    });
    setBusy(false);
    setNotice(res.ok ? "Сделка сохранена" : `Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function check() {
    setBusy(true); setNotice(null);
    const res = await crm.checkFeasibility(opp.id);
    setBusy(false);
    if (res.ok) { setFeasibility(res.data); setNotice(`Осуществимость: ${FEAS_LABEL[res.data.status] ?? res.data.status}`); }
    else setNotice(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function activate() {
    setBusy(true); setNotice(null);
    const res = await crm.activate(opp.id, riskReason.trim() ? { acceptedRiskReason: riskReason.trim() } : undefined);
    setBusy(false);
    if (res.ok) { setRiskReason(""); setNotice(`Создан проект ${res.data.id} — сделка выиграна`); }
    else setNotice(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function finalize(stt: "won_closed" | "lost_rejected") {
    setBusy(true); setNotice(null);
    const res = await crm.finalize(opp.id, stt, stt === "won_closed" ? "Закрыта вручную" : "Отказ клиента");
    setBusy(false);
    setNotice(res.ok ? (stt === "won_closed" ? "Сделка выиграна" : "Сделка проиграна") : `Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function sendComment() {
    if (!comment.trim()) return;
    setBusy(true); setNotice(null);
    const res = await crm.createComment("opportunity", opp.id, comment.trim());
    setBusy(false);
    if (res.ok) { setActivities((a) => [res.data, ...(a ?? [])]); setComment(""); }
    else setNotice(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function toggleTask(a: CrmActivity) {
    setBusy(true); setNotice(null);
    const res = await crm.updateTaskStatus("opportunity", opp.id, a.id, a.status === "done" ? "todo" : "done");
    setBusy(false);
    if (res.ok) setActivities((list) => (list ?? []).map((x) => (x.id === a.id ? res.data : x)));
    else setNotice(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>Реальный контракт CRM: PATCH /opportunities/:id (правка, full-replace), POST /:id/feasibility (осуществимость), POST /:id/activate (создаёт проект, сделка → won_closed), /crm/opportunity/:id/activity (лента). Спрос/связи редактируются на отдельном экране — здесь шлются как есть. Данные in-memory.</span>
      </div>

      {/* шапка */}
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-[var(--shadow-card)]">
        <BemAvatar initials={initials(ownerName(opp.ownerUserId))} color={ownerColor(opp.ownerUserId)} title={ownerName(opp.ownerUserId)} />
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">{opp.title}</h2>
          <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]"><span className="v4-mono">{opp.id}</span> · {opp.clientName} · {opp.contactName}</p>
        </div>
        <Chip variant="info">{pipelineName}</Chip>
        <Chip variant="violet">{stageName(opp.stageId)}</Chip>
        <Chip variant={opp.status === "won_closed" ? "success" : opp.status === "lost_rejected" ? "danger" : opp.status === "ready_to_activate" ? "success" : "info"}>{STATUS_LABEL[opp.status]}</Chip>
        {locked ? <span className="inline-flex items-center gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]"><Lock className="size-3" aria-hidden />закрыта</span> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* левая колонка */}
        <div className="flex flex-col gap-3">
          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Параметры сделки</h3>
              <Button variant="default" size="sm" disabled={busy || locked || !dirty} onClick={() => void save()}><Save className="size-3.5" aria-hidden />Сохранить</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={`col-span-2 ${labelCls}`}>Название<Input value={form.title} onChange={(e) => set("title", e.target.value)} disabled={locked} /></label>
              <label className={`col-span-2 ${labelCls}`}>Описание<Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={locked} placeholder="Контекст для команды…" /></label>
              <label className={labelCls}>Стадия
                <select value={form.stageId} onChange={(e) => set("stageId", e.target.value)} disabled={locked} className={selCls}>
                  {stages.some((s) => s.id === form.stageId) ? null : <option value={form.stageId}>— без стадии —</option>}
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className={labelCls}>Владелец
                <select value={form.ownerUserId} onChange={(e) => set("ownerUserId", e.target.value)} disabled={locked} className={selCls}>
                  {CRM_USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label className={labelCls}>Старт<Input type="date" value={form.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} disabled={locked} /></label>
              <label className={labelCls}>Финиш<Input type="date" value={form.plannedFinish} onChange={(e) => set("plannedFinish", e.target.value)} disabled={locked} aria-invalid={form.plannedFinish < form.plannedStart} /></label>
              <label className={labelCls}>Сумма, ₽<Input type="number" min={1} value={form.contractValue} onChange={(e) => set("contractValue", e.target.value)} disabled={locked} className="text-right" /></label>
              <label className={labelCls}>Ставка, ₽/ч<Input type="number" min={1} value={form.plannedHourlyRate} onChange={(e) => set("plannedHourlyRate", e.target.value)} disabled={locked} className="text-right" /></label>
              <label className={labelCls}>Вероятность, %<Input type="number" min={0} max={100} value={form.probability} onChange={(e) => set("probability", e.target.value)} disabled={locked} className="text-right" /></label>
              <div className={labelCls}>Плановые часы<div className="flex h-9 items-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] px-2.5 v4-num text-[var(--muted-strong)]" title="Считается сервером: сумма / ставка">{plannedHours.toLocaleString("ru-RU")} ч</div></div>
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-2.5">
              <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Спрос на ресурсы (read-only)</div>
              <div className="flex flex-wrap gap-1.5">
                {opp.demand.map((d) => <span key={d.positionId} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{d.positionId} · <span className="v4-num">{d.requiredHours} ч</span></span>)}
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
            <h3 className="mb-3 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Лента активности</h3>
            {!locked ? (
              <div className="mb-3 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
                <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Написать комментарий…" />
                <div className="flex justify-end"><Button variant="default" size="sm" disabled={busy || !comment.trim()} onClick={() => void sendComment()}><Send className="size-3.5" aria-hidden />Отправить</Button></div>
              </div>
            ) : <p className="mb-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Сделка завершена — новые записи в ленту недоступны.</p>}
            {activities === null ? (
              <div className="flex items-center gap-2 py-4 text-[length:var(--text-xs)] text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Загрузка ленты…</div>
            ) : activities.length === 0 ? (
              <p className="py-4 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Пока нет активностей.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {activities.map((a) => <ActivityItem key={a.id} a={a} busy={busy} onToggle={() => void toggleTask(a)} />)}
              </ul>
            )}
          </section>
        </div>

        {/* правая колонка */}
        <div className="flex flex-col gap-3">
          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Осуществимость</h3>
              <Button variant="secondary" size="sm" disabled={busy || locked} onClick={() => void check()}><FlaskConical className="size-3.5" aria-hidden />Проверить</Button>
            </div>
            {feasibility ? <FeasibilityWidget a={feasibility} checkedAt={opp.feasibilityCheckedAt} /> : (
              <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Проверка осуществимости ещё не запускалась. Нажмите «Проверить» — сервер оценит ресурсы по плановым часам, спросу и активным проектам.</p>
            )}
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
            <h3 className="mb-3 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Действия</h3>
            {locked ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                {opp.status === "won_closed" ? <Trophy className="size-4 text-[var(--success-text)]" aria-hidden /> : <XCircle className="size-4 text-[var(--danger-text)]" aria-hidden />}
                Сделка {opp.status === "won_closed" ? "выиграна" : "проиграна"} — действия закрыты.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {feasibility?.status === "conflict" ? (
                  <label className={labelCls}>Обоснование риска (для активации при конфликте)<Input value={riskReason} onChange={(e) => setRiskReason(e.target.value)} placeholder="Почему запускаем несмотря на конфликт…" /></label>
                ) : null}
                <Button variant="default" disabled={busy || opp.feasibilityStatus == null} onClick={() => void activate()} title={opp.feasibilityStatus == null ? "Сначала проверьте осуществимость" : undefined}><Rocket className="size-3.5" aria-hidden />Активировать в проект</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" disabled={busy} onClick={() => void finalize("won_closed")}><Trophy className="size-3.5" aria-hidden />Выиграна</Button>
                  <Button variant="ghost" size="sm" className="flex-1" disabled={busy} onClick={() => void finalize("lost_rejected")}><XCircle className="size-3.5" aria-hidden />Проиграна</Button>
                </div>
                {opp.feasibilityStatus == null ? <p className="text-[10px] text-[var(--muted-soft)]">Активация требует пройденной проверки осуществимости (400 feasibility_required).</p> : null}
              </div>
            )}
            {projects.length ? (
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-2.5">
                <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Проекты из сделки</div>
                <ul className="flex flex-col gap-1">{projects.map((p) => <li key={p.id} className="flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--text)]"><Rocket className="size-3 text-[var(--success-text)]" aria-hidden /><span className="v4-mono">{p.id}</span> · {money(p.contractValue)}</li>)}</ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {notice ? <div key={notice} className="anim-rise-in-fast text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </div>
  );
}

function FeasibilityWidget({ a, checkedAt }: { a: FeasibilityAssessment; checkedAt: string | null }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant={FEAS_TONE[a.status] ?? "info"}>{FEAS_LABEL[a.status] ?? a.status}</Chip>
        <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">{a.totalRequiredHours.toLocaleString("ru-RU")} ч спроса / {a.plannedHours.toLocaleString("ru-RU")} ч плана · {a.workingDays} раб. дн.</span>
      </div>
      {a.blockers.length ? <ul className="flex flex-col gap-1">{a.blockers.map((b) => <li key={b} className="flex items-start gap-1.5 text-[length:var(--text-xs)] text-[var(--danger-text)]"><XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />{BLOCKER_RU[b] ?? b}</li>)}</ul> : null}
      {a.warnings.length ? <ul className="flex flex-col gap-1">{a.warnings.map((w) => <li key={w} className="flex items-start gap-1.5 text-[length:var(--text-xs)] text-[var(--warning-text)]"><Circle className="mt-0.5 size-3 shrink-0" aria-hidden />{WARNING_RU[w] ?? w}</li>)}</ul> : null}
      {a.rows.length ? (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
          <table className="w-full border-collapse text-[length:var(--text-xs)]">
            <thead><tr className="bg-[var(--panel-subtle)] text-left text-[var(--muted-soft)]"><th className="px-2 py-1 font-semibold">Позиция</th><th className="px-2 py-1 text-right font-semibold">Нужно</th><th className="px-2 py-1 text-right font-semibold">Доступно</th><th className="px-2 py-1 text-right font-semibold">Нехватка</th></tr></thead>
            <tbody>
              {a.rows.map((r) => (
                <tr key={r.positionId} className="border-t border-[var(--border-subtle)]">
                  <td className="px-2 py-1 text-[var(--muted-strong)]">{r.positionName}</td>
                  <td className="px-2 py-1 text-right v4-num">{r.requiredHours}</td>
                  <td className="px-2 py-1 text-right v4-num">{r.availableHours}</td>
                  <td className={`px-2 py-1 text-right v4-num ${r.shortageHours > 0 ? "font-semibold text-[var(--danger-text)]" : "text-[var(--muted-soft)]"}`}>{r.shortageHours > 0 ? r.shortageHours : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {checkedAt ? <p className="text-[10px] text-[var(--muted-soft)]">Проверено: {new Date(checkedAt).toLocaleString("ru-RU")}</p> : null}
    </div>
  );
}

function ActivityItem({ a, busy, onToggle }: { a: CrmActivity; busy: boolean; onToggle: () => void }) {
  const author = ownerName(a.authorUserId);
  const when = new Date(a.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <li className="flex gap-2.5">
      <BemAvatar initials={initials(author)} color={ownerColor(a.authorUserId)} size="sm" title={author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{author}</strong>
          <span className="text-[10px] text-[var(--muted-soft)]">{when}</span>
          {a.type === "task" ? <Chip variant={a.status === "done" ? "success" : "info"}>{a.status === "done" ? "Выполнена" : "Задача"}</Chip> : null}
          {a.type === "file" ? <Chip variant="violet">Файл</Chip> : null}
        </div>
        {a.type === "task" ? (
          <div className="mt-0.5 flex items-start gap-1.5">
            <button type="button" disabled={busy} onClick={onToggle} title={a.status === "done" ? "Вернуть в работу" : "Отметить выполненной"} className="mt-0.5 shrink-0 text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-50">
              {a.status === "done" ? <CheckCircle2 className="size-4 text-[var(--success-text)]" aria-hidden /> : <Square className="size-4" aria-hidden />}
            </button>
            <div className="min-w-0">
              <p className={`text-[length:var(--text-sm)] ${a.status === "done" ? "text-[var(--muted-soft)] line-through" : "text-[var(--text)]"}`}>{a.title}</p>
              {a.body ? <p className="text-[length:var(--text-xs)] text-[var(--muted)]">{a.body}</p> : null}
              {a.dueDate ? <p className="text-[10px] text-[var(--muted-soft)]">Срок: {a.dueDate}{a.assigneeUserId ? ` · ${ownerName(a.assigneeUserId)}` : ""}</p> : null}
            </div>
          </div>
        ) : a.type === "file" ? (
          <a href={a.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[length:var(--text-sm)] text-[var(--accent-text)] underline-offset-2 hover:underline">{a.title}</a>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--text)]">{a.body}</p>
        )}
      </div>
    </li>
  );
}
