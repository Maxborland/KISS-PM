"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, FlaskConical, Loader2, Lock, Rocket, Save, Send, Square, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceState } from "@/components/domain/surface-state";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { money } from "@/crm/ui/crm-bits";
import { getCrmWriteCapability } from "@/crm/ui/permissions";
import { makeRuError } from "@/lib/error-messages";
import { useCrm, useCrmUsers, type CrmUsersIndex } from "@/crm/lib/use-crm";
import { useCrmRuntime } from "@/crm/lib/crm-runtime";
import type { CrmActivity, DealStage, FeasibilityAssessment, Opportunity } from "@/crm/lib/crm-client";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { useSessionUser } from "@/shell/use-session-user";

const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const initials = (name: string) => { const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—"; };
// Имя/цвет аватара владельца/автора/исполнителя — резолв из справочника пользователей (useCrmUsers),
// переданного пропом из родителя (ActivityItem — many-instance, поэтому данные приходят пропом).
// Если справочник пользователей недоступен/неполон (например, 403 под ограниченной ролью),
// НЕ показываем сырой id — даём читабельный фолбэк «Участник xxxx» (G8-08, G5-12).
const ownerName = (users: CrmUsersIndex, id: string | null) => { if (!id) return "—"; return users.byId.get(id)?.name ?? `Участник ${id.slice(-4)}`; };
const ownerColor = (users: CrmUsersIndex, id: string | null): BemAvatarColor => { const i = users.indexOf(id); return i < 0 ? "c5" : AV[i % AV.length]!; };

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
const ruErr = makeRuError(ERR_RU);

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

type FormState = { title: string; description: string; stageId: string; ownerUserId: string; probability: string; contractValue: string; plannedHourlyRate: string; plannedStart: string; plannedFinish: string };
// Живой API отдаёт даты как ISO-datetime («2026-05-01T00:00:00.000Z»), а <input type="date">
// принимает строго yyyy-MM-dd — без нормализации поля пустели и ЛЮБОЕ сохранение падало 400 (G4-01).
const dateOnly = (s: string): string => (s.length > 10 ? s.slice(0, 10) : s);
const formOf = (o: Opportunity): FormState => ({
  title: o.title, description: o.description ?? "", stageId: o.stageId ?? "", ownerUserId: o.ownerUserId ?? "",
  probability: String(o.probability), contractValue: String(o.contractValue), plannedHourlyRate: String(o.plannedHourlyRate),
  plannedStart: dateOnly(o.plannedStart), plannedFinish: dateOnly(o.plannedFinish)
});

export function resolveOpportunityPipelineId(
  opportunity: Pick<Opportunity, "pipelineId" | "stageId">,
  dealStages: Array<Pick<DealStage, "id" | "pipelineId">>
): string | null {
  return opportunity.pipelineId ?? dealStages.find((stage) => stage.id === opportunity.stageId)?.pipelineId ?? null;
}

export function stagesForOpportunity(
  opportunity: Pick<Opportunity, "pipelineId" | "stageId">,
  dealStages: DealStage[]
): DealStage[] {
  const pipelineId = resolveOpportunityPipelineId(opportunity, dealStages);
  return [...dealStages].filter((stage) => stage.pipelineId === pipelineId).sort((a, b) => a.sortOrder - b.sortOrder);
}

// initialId — стартовая сделка из URL (route app/crm/deals/[id]); по умолчанию пусто → fallback ниже
// на opp-2207 (mock-сид), затем первая (live). Stories рендерят без initialId → прежнее поведение.
export function DealCard({ initialId }: { initialId?: string } = {}) {
  const crm = useCrm();
  const users = useCrmUsers();
  const { data, status, error, reload } = crm;
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);

  // Запрошенный по URL id обязан существовать: молчаливая подмена чужой сделкой (G4-02)
  // выглядела как запрошенная и провоцировала правку не той записи. Fallback на первую
  // сделку остаётся только для встраивания без initialId (stories).
  const requestedMissing = Boolean(
    initialId && selectedId === initialId && data && !data.opportunities.some((o) => o.id === initialId)
  );
  const selected = useMemo<Opportunity | null>(() => {
    if (!data || requestedMissing) return null;
    return data.opportunities.find((o) => o.id === selectedId) ?? data.opportunities.find((o) => o.id === "opp-2207") ?? data.opportunities[0] ?? null;
  }, [data, selectedId, requestedMissing]);

  // Верхнеуровневые loading/error/forbidden — через SurfaceState (внутри CrmFrame).
  // Тело ниже дереференсит data/selected, поэтому сохраняем early-return для не-ready состояний.
  // НЕ трогаем вложенные состояния (лента активностей, виджет осуществимости) — это ready-контент.
  // selected===null при наличии data = «нет сделок» — показываем как ошибку (как было раньше).
  if ((status === "loading" && !data) || status === "error" || status === "forbidden" || !data || !selected) {
    const stateStatus = requestedMissing && data ? "empty" : status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <CrmFrame activeTab="Сделки">
        <SurfaceState
          status={stateStatus}
          error={error ?? "нет сделок"}
          onRetry={() => void reload()}
          errorFormat={ruErr}
          loadingLabel="Загрузка сделки…"
          forbidden={{ title: "Доступ к сделке ограничен", description: "У вас нет прав на просмотр карточки сделки." }}
          empty={{
            title: "Сделка не найдена",
            description: "Сделки с таким адресом нет: возможно, она удалена или ссылка устарела.",
            action: <Button asChild variant="default"><Link href="/crm/deals">К списку сделок</Link></Button>
          }}
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
      <DealCardBody key={selected.id} crm={crm} data={data} opp={selected} users={users} />
    </CrmFrame>
  );
}

function DealCardBody({ crm, data, opp, users }: { crm: ReturnType<typeof useCrm>; data: NonNullable<ReturnType<typeof useCrm>["data"]>; opp: Opportunity; users: CrmUsersIndex }) {
  const { live } = useCrmRuntime();
  const sessionUser = useSessionUser();
  const permissions = sessionUser?.permissions ?? [];
  const manageCapability = getCrmWriteCapability({
    live,
    permissions,
    permission: "tenant.opportunities.manage"
  });
  const feasibilityCapability = getCrmWriteCapability({
    live,
    permissions,
    permission: "tenant.resource_feasibility.read"
  });
  const activationCapability = getCrmWriteCapability({
    live,
    permissions,
    permission: "tenant.project_activation.manage"
  });
  const projectCapability = getCrmWriteCapability({
    live,
    permissions,
    permission: "tenant.projects.manage"
  });
  const canManage = manageCapability.allowed;
  const canCheckFeasibility = canManage && feasibilityCapability.allowed;
  const canActivate = activationCapability.allowed && projectCapability.allowed;
  const readOnlyReason = manageCapability.disabledReason ?? "Недостаточно прав для изменения сделки";
  const feasibilityDisabledReason =
    manageCapability.disabledReason ??
    feasibilityCapability.disabledReason ??
    "Недостаточно прав для проверки осуществимости";
  const activationDisabledReason =
    activationCapability.disabledReason ??
    projectCapability.disabledReason ??
    "Недостаточно прав для активации проекта";
  const [form, setForm] = useState<FormState>(() => formOf(opp));
  const [feasibility, setFeasibility] = useState<FeasibilityAssessment | null>(() => (opp.feasibilityResult as FeasibilityAssessment | null) ?? null);
  const [activities, setActivities] = useState<CrmActivity[] | null>(null);
  const [comment, setComment] = useState("");
  const [riskReason, setRiskReason] = useState("");
  const [busy, setBusy] = useState(false);

  const locked = isFinal(opp);
  const effectivePipelineId = useMemo(() => resolveOpportunityPipelineId(opp, data.dealStages), [data.dealStages, opp]);
  const stages = useMemo(() => stagesForOpportunity(opp, data.dealStages), [data.dealStages, opp]);
  const requiresStageAssignment = !opp.stageId || !effectivePipelineId;
  const canEditParameters = canManage && !requiresStageAssignment;
  const editDisabledReason = requiresStageAssignment
    ? "Сначала назначьте сделке стадию в списке"
    : readOnlyReason;
  const pipelineName = data.pipelines.find((p) => p.id === effectivePipelineId)?.name ?? "—";
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
    setBusy(true);
    const res = await crm.updateOpportunity(opp.id, {
      clientId: opp.clientId ?? "", primaryContactId: opp.primaryContactId ?? "", projectTypeId: opp.projectTypeId ?? "",
      stageId: form.stageId, title: form.title.trim(), description: form.description.trim() || null,
      plannedStart: form.plannedStart, plannedFinish: form.plannedFinish,
      contractValue: Math.round(Number(form.contractValue)), plannedHourlyRate: Math.round(Number(form.plannedHourlyRate)),
      probability: Math.round(Number(form.probability)), demand: opp.demand, ownerUserId: form.ownerUserId || null
    });
    setBusy(false);
    if (res.ok) toast.success("Сделка сохранена");
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function check() {
    setBusy(true);
    const res = await crm.checkFeasibility(opp.id);
    setBusy(false);
    if (res.ok) { setFeasibility(res.data); toast.success(`Осуществимость: ${FEAS_LABEL[res.data.status] ?? res.data.status}`); }
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function activate() {
    setBusy(true);
    const res = await crm.activate(opp.id, riskReason.trim() ? { acceptedRiskReason: riskReason.trim() } : undefined);
    setBusy(false);
    if (res.ok) { setRiskReason(""); toast.success(`Создан проект «${res.data.title}» — сделка выиграна`); }
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function finalize(stt: "won_closed" | "lost_rejected") {
    setBusy(true);
    const res = await crm.finalize(opp.id, stt, stt === "won_closed" ? "Закрыта вручную" : "Отказ клиента");
    setBusy(false);
    if (res.ok) toast.success(stt === "won_closed" ? "Сделка выиграна" : "Сделка проиграна");
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function sendComment() {
    if (!comment.trim()) return;
    setBusy(true);
    const res = await crm.createComment("opportunity", opp.id, comment.trim());
    setBusy(false);
    if (res.ok) { setActivities((a) => [res.data, ...(a ?? [])]); setComment(""); }
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  async function toggleTask(a: CrmActivity) {
    setBusy(true);
    const res = await crm.updateTaskStatus("opportunity", opp.id, a.id, a.status === "done" ? "todo" : "done");
    setBusy(false);
    if (res.ok) setActivities((list) => (list ?? []).map((x) => (x.id === a.id ? res.data : x)));
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {prototypeNotesEnabled && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт CRM: PATCH /opportunities/:id (правка, full-replace), POST /:id/feasibility (осуществимость), POST /:id/activate (создаёт проект, сделка → won_closed), /crm/opportunity/:id/activity (лента). Спрос/связи редактируются на отдельном экране — здесь шлются как есть. Данные in-memory.</span>
        </div>
      )}

      {/* шапка */}
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-[var(--shadow-card)]">
        <BemAvatar initials={initials(ownerName(users, opp.ownerUserId))} color={ownerColor(users, opp.ownerUserId)} title={ownerName(users, opp.ownerUserId)} />
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">{opp.title}</h2>
          <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">{prototypeNotesEnabled ? <><span className="v4-mono">{opp.id}</span> · </> : null}{opp.clientName} · {opp.contactName}</p>
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
              <Button variant="default" size="sm" disabled={busy || locked || !canEditParameters || !dirty} onClick={() => void save()} title={canEditParameters ? undefined : editDisabledReason}><Save className="size-3.5" aria-hidden />Сохранить</Button>
            </div>
            {requiresStageAssignment ? (
              <p className="mb-3 rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--warning-text)]">
                Сначала назначьте сделке стадию.{" "}
                <Link href="/crm/deals" className="font-semibold underline underline-offset-2">Назначить стадию в списке</Link>
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className={`col-span-2 ${labelCls}`}>Название<Input value={form.title} onChange={(e) => set("title", e.target.value)} disabled={locked || !canEditParameters} /></label>
              <label className={`col-span-2 ${labelCls}`}>Описание<Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={locked || !canEditParameters} placeholder="Контекст для команды…" /></label>
              <label className={labelCls}>Стадия
                <select value={form.stageId} onChange={(e) => set("stageId", e.target.value)} disabled={locked || !canEditParameters} className={selCls}>
                  {stages.some((s) => s.id === form.stageId) ? null : <option value={form.stageId}>— без стадии —</option>}
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className={labelCls}>Владелец
                <select value={form.ownerUserId} onChange={(e) => set("ownerUserId", e.target.value)} disabled={locked || !canEditParameters} className={selCls}>
                  {users.list.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label className={labelCls}>Старт<Input type="date" value={form.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} disabled={locked || !canEditParameters} /></label>
              <label className={labelCls}>Финиш<Input type="date" value={form.plannedFinish} onChange={(e) => set("plannedFinish", e.target.value)} disabled={locked || !canEditParameters} aria-invalid={form.plannedFinish < form.plannedStart} /></label>
              <label className={labelCls}>Сумма, ₽<Input type="number" min={1} value={form.contractValue} onChange={(e) => set("contractValue", e.target.value)} disabled={locked || !canEditParameters} className="text-right" /></label>
              <label className={labelCls}>Ставка, ₽/ч<Input type="number" min={1} value={form.plannedHourlyRate} onChange={(e) => set("plannedHourlyRate", e.target.value)} disabled={locked || !canEditParameters} className="text-right" /></label>
              <label className={labelCls}>Вероятность, %<Input type="number" min={0} max={100} value={form.probability} onChange={(e) => set("probability", e.target.value)} disabled={locked || !canEditParameters} className="text-right" /></label>
              <div className={labelCls}>Плановые часы<div className="flex h-9 items-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] px-2.5 v4-num text-[var(--muted-strong)]" title="Считается сервером: сумма / ставка">{plannedHours.toLocaleString("ru-RU")} ч</div></div>
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-2.5">
              <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Спрос на ресурсы (только чтение)</div>
              <div className="flex flex-wrap gap-1.5">
                {opp.demand.map((d) => <span key={d.positionId} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{d.positionId} · <span className="v4-num">{d.requiredHours} ч</span></span>)}
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
            <h3 className="mb-3 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Лента активности</h3>
            {!locked && canManage ? (
              <div className="mb-3 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
                <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Написать комментарий…" />
                <div className="flex justify-end"><Button variant="default" size="sm" disabled={busy || !comment.trim()} onClick={() => void sendComment()}><Send className="size-3.5" aria-hidden />Отправить</Button></div>
              </div>
            ) : <p className="mb-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">{locked ? "Сделка завершена — новые записи в ленту недоступны." : "Лента доступна только для чтения."}</p>}
            {activities === null ? (
              <div className="flex items-center gap-2 py-4 text-[length:var(--text-xs)] text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Загрузка ленты…</div>
            ) : activities.length === 0 ? (
              <p className="py-4 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Пока нет активностей.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {activities.map((a) => <ActivityItem key={a.id} a={a} users={users} busy={busy} canToggle={canManage && !locked} onToggle={() => void toggleTask(a)} />)}
              </ul>
            )}
          </section>
        </div>

        {/* правая колонка */}
        <div className="flex flex-col gap-3">
          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Осуществимость</h3>
              <Button variant="secondary" size="sm" disabled={busy || locked || !canCheckFeasibility} onClick={() => void check()} title={canCheckFeasibility ? undefined : feasibilityDisabledReason}><FlaskConical className="size-3.5" aria-hidden />Проверить</Button>
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
                  <label className={labelCls}>Обоснование риска (для активации при конфликте)<Input value={riskReason} onChange={(e) => setRiskReason(e.target.value)} disabled={!canActivate} placeholder="Почему запускаем несмотря на конфликт…" /></label>
                ) : null}
                <Button variant="default" disabled={busy || !canActivate || opp.feasibilityStatus == null} onClick={() => void activate()} title={!canActivate ? activationDisabledReason : opp.feasibilityStatus == null ? "Сначала проверьте осуществимость" : undefined}><Rocket className="size-3.5" aria-hidden />Активировать в проект</Button>
                <div className="flex gap-2">
                  {/* Необратимое закрытие сделки — только через подтверждение (G4-06). */}
                  <ConfirmDialog
                    title="Закрыть сделку как выигранную?"
                    description="Сделка будет закрыта, переоткрыть её нельзя."
                    confirmLabel="Выиграна"
                    onConfirm={() => finalize("won_closed")}
                  >
                    <Button variant="secondary" size="sm" className="flex-1" disabled={busy || !canManage} title={canManage ? undefined : readOnlyReason}><Trophy className="size-3.5" aria-hidden />Выиграна</Button>
                  </ConfirmDialog>
                  <ConfirmDialog
                    title="Закрыть сделку как проигранную?"
                    description="Сделка будет закрыта, переоткрыть её нельзя."
                    confirmLabel="Проиграна"
                    onConfirm={() => finalize("lost_rejected")}
                  >
                    <Button variant="ghost" size="sm" className="flex-1" disabled={busy || !canManage} title={canManage ? undefined : readOnlyReason}><XCircle className="size-3.5" aria-hidden />Проиграна</Button>
                  </ConfirmDialog>
                </div>
                {opp.feasibilityStatus == null ? <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Активация станет доступна после проверки осуществимости.</p> : null}
              </div>
            )}
            {projects.length ? (
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-2.5">
                <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--muted-strong)]">Проекты из сделки</div>
                <ul className="flex flex-col gap-1">{projects.map((p) => <li key={p.id} className="flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--text)]"><Rocket className="size-3 shrink-0 text-[var(--success-text)]" aria-hidden /><span className="truncate font-medium">{p.title}</span>{prototypeNotesEnabled ? <span className="v4-mono text-[var(--muted-soft)]">{p.id}</span> : null}<span className="shrink-0 text-[var(--muted-strong)]">· {money(p.contractValue)}</span></li>)}</ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
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
      {checkedAt ? <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Проверено: {new Date(checkedAt).toLocaleString("ru-RU")}</p> : null}
    </div>
  );
}

function ActivityItem({ a, users, busy, canToggle, onToggle }: { a: CrmActivity; users: CrmUsersIndex; busy: boolean; canToggle: boolean; onToggle: () => void }) {
  const author = ownerName(users, a.authorUserId);
  const when = new Date(a.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <li className="flex gap-2.5">
      <BemAvatar initials={initials(author)} color={ownerColor(users, a.authorUserId)} size="sm" title={author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{author}</strong>
          <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{when}</span>
          {a.type === "task" ? <Chip variant={a.status === "done" ? "success" : "info"}>{a.status === "done" ? "Выполнена" : "Задача"}</Chip> : null}
          {a.type === "file" ? <Chip variant="violet">Файл</Chip> : null}
        </div>
        {a.type === "task" ? (
          <div className="mt-0.5 flex items-start gap-1.5">
            <button type="button" disabled={busy || !canToggle} onClick={onToggle} title={canToggle ? a.status === "done" ? "Вернуть в работу" : "Отметить выполненной" : "Недостаточно прав для изменения"} className="mt-0.5 shrink-0 text-[var(--muted)] hover:text-[var(--accent)] disabled:opacity-50">
              {a.status === "done" ? <CheckCircle2 className="size-4 text-[var(--success-text)]" aria-hidden /> : <Square className="size-4" aria-hidden />}
            </button>
            <div className="min-w-0">
              <p className={`text-[length:var(--text-sm)] ${a.status === "done" ? "text-[var(--muted-soft)] line-through" : "text-[var(--text)]"}`}>{a.title}</p>
              {a.body ? <p className="text-[length:var(--text-xs)] text-[var(--muted)]">{a.body}</p> : null}
              {a.dueDate ? <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Срок: {a.dueDate}{a.assigneeUserId ? ` · ${ownerName(users, a.assigneeUserId)}` : ""}</p> : null}
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
