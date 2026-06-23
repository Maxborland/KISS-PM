"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/delivery/ui/bento";
import { cn } from "@/lib/cn";
import { CrmFrame } from "@/crm/ui/crm-frame";
import { useCrm } from "@/crm/lib/use-crm";
import { CRM_USERS } from "@/crm/lib/mock-crm-backend";
import type { DealStage, Opportunity } from "@/crm/lib/crm-client";

type Mode = "kanban" | "list" | "forecast";
const AV: BemAvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];
const userById = new Map(CRM_USERS.map((u) => [u.id, u]));
const ownerColor = (id: string | null): BemAvatarColor => { const i = CRM_USERS.findIndex((u) => u.id === id); return i < 0 ? "c5" : AV[i % AV.length]!; };
const initials = (name: string) => { const p = name.replace(/[«»"]/g, "").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—"; };
const ownerName = (id: string | null) => (id ? userById.get(id)?.name ?? id : "—");
const money = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽` : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₽`);
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
  deal_stage_not_found_create: "Стадия не найдена"
};
const ruErr = (code?: string, fallback?: string) => (code && ERR_RU[code]) || fallback || code || "Ошибка";

export function ProjectDeals() {
  const { data, status, error, reload, moveStage, createOpportunity } = useCrm();
  const [mode, setMode] = useState<Mode>("kanban");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!data) return null;
    const stages = [...data.dealStages].sort((a, b) => a.sortOrder - b.sortOrder);
    const byStage = new Map<string, Opportunity[]>();
    for (const s of stages) byStage.set(s.id, []);
    // сделки без стадии / с неизвестной стадией НЕ сваливаем в первую колонку (иначе счётчики врут) —
    // собираем отдельно и показываем в колонке «Без стадии».
    const unstaged: Opportunity[] = [];
    for (const o of data.opportunities) { const arr = o.stageId ? byStage.get(o.stageId) : undefined; if (arr) arr.push(o); else unstaged.push(o); }
    return { stages, byStage, unstaged, opps: data.opportunities };
  }, [data]);

  if (status === "loading" && !data) {
    return <CrmFrame activeTab="Сделки"><div className="flex h-[420px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]"><Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка сделок…</div></CrmFrame>;
  }
  if (status === "error" || !model || !data) {
    return <CrmFrame activeTab="Сделки"><div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]"><span>Не удалось загрузить: {error ?? "unknown"}</span><Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button></div></CrmFrame>;
  }

  const stageName = (id: string | null) => model.stages.find((s) => s.id === id)?.name ?? "—";

  async function doMove(id: string, stageId: string) {
    setBusy(true); setNotice(null);
    const res = await moveStage(id, stageId);
    setBusy(false);
    setNotice(res.ok ? `Сделка перемещена в «${stageName(stageId)}»` : `Отклонено: ${ruErr(res.ok ? undefined : res.code, res.ok ? undefined : res.message)}`);
  }

  const dropOn = (stageId: string) => {
    const id = dragId; setDragId(null); setOverStage(null);
    if (!id) return;
    const opp = model.opps.find((o) => o.id === id);
    if (opp && !isFinal(opp) && opp.stageId !== stageId) void doMove(id, stageId);
  };

  return (
    <CrmFrame activeTab="Сделки" subtitle="Воронка продаж и активные сделки" actions={<CreateDealDialog stages={model.stages} data={data} busy={busy} setBusy={setBusy} setNotice={setNotice} create={createOpportunity} />}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented name="deals-mode" value={mode} onChange={setMode} options={[{ value: "kanban", label: "Канбан" }, { value: "list", label: "Список" }, { value: "forecast", label: "Прогноз" }]} />
        {mode === "kanban" ? <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Перетащите карточку между стадиями</span> : null}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        Реальный контракт CRM: /api/workspace/opportunities + deal-stages (createCrmClient). Перенос стадии — PATCH /opportunities/:id/stage; создание — POST. Без planVersion (плоский REST). Данные in-memory.
      </div>

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
                  <span className="flex items-center gap-1.5"><span className="v4-num text-[10px] text-[var(--muted-soft)]">{money(sum)}</span><span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]">{items.length}</span></span>
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
                        className={cn("rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-2.5 shadow-[var(--shadow-card)]", !final && !busy ? "cursor-grab active:cursor-grabbing" : "opacity-90", dragId === o.id && "opacity-50")}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="v4-mono text-[10px] text-[var(--muted-soft)]">{o.id}</span>
                          <BemAvatar initials={initials(ownerName(o.ownerUserId))} color={ownerColor(o.ownerUserId)} size="sm" title={ownerName(o.ownerUserId)} />
                        </div>
                        <h3 className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--text-strong)]">{o.title}</h3>
                        <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">{o.clientName}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="v4-num text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{money(o.contractValue)}</span>
                          {final ? <Chip variant={o.status === "won_closed" ? "success" : "danger"}>{STATUS_LABEL[o.status]}</Chip> : <span className="v4-num text-[10px] text-[var(--muted-soft)]">{o.probability}%</span>}
                        </div>
                      </article>
                    );
                  })}
                  {items.length === 0 ? <div className="grid flex-1 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] py-4 text-[10px] text-[var(--muted-soft)]">перетащите сюда</div> : null}
                </div>
              </div>
            );
          })}
          {model.unstaged.length ? (
            <div className="flex w-[260px] shrink-0 flex-col rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2"><span className="text-[length:var(--text-sm)] font-semibold text-[var(--muted-strong)]">Без стадии</span><span className="rounded-full bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]">{model.unstaged.length}</span></div>
              <div className="flex flex-col gap-2 p-2">
                {model.unstaged.map((o) => (
                  <article key={o.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-2.5 shadow-[var(--shadow-card)]">
                    <div className="mb-1 flex items-center justify-between gap-2"><span className="v4-mono text-[10px] text-[var(--muted-soft)]">{o.id}</span><BemAvatar initials={initials(ownerName(o.ownerUserId))} color={ownerColor(o.ownerUserId)} size="sm" /></div>
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
              <th className="px-3 py-2 font-semibold">Сделка</th><th className="px-3 py-2 font-semibold">Клиент</th><th className="px-3 py-2 font-semibold">Стадия</th><th className="px-3 py-2 text-right font-semibold">Сумма</th><th className="px-3 py-2 text-right font-semibold">Вероятн.</th><th className="px-3 py-2 font-semibold">Владелец</th>
            </tr></thead>
            <tbody>
              {model.opps.map((o) => (
                <tr key={o.id} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-2"><div className="font-medium text-[var(--text-strong)]">{o.title}</div><div className="v4-mono text-[10px] text-[var(--muted-soft)]">{o.id}</div></td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Forecast stages={model.stages} byStage={model.byStage} />
      )}

      {notice ? <div className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </CrmFrame>
  );
}

function Forecast({ stages, byStage }: { stages: DealStage[]; byStage: Map<string, Opportunity[]> }) {
  const all = stages.flatMap((s) => byStage.get(s.id) ?? []);
  const open = all.filter((o) => o.status !== "lost_rejected");
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
              const items = (byStage.get(s.id) ?? []).filter((o) => o.status !== "lost_rejected");
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

function CreateDealDialog({ stages, data, busy, setBusy, setNotice, create }: {
  stages: DealStage[];
  data: ReturnType<typeof useCrm>["data"];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNotice: (v: string | null) => void;
  create: ReturnType<typeof useCrm>["createOpportunity"];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [contractValue, setContractValue] = useState("1000000");
  const [rate, setRate] = useState("3500");
  const [probability, setProbability] = useState("40");
  const [start, setStart] = useState("2026-05-01");
  const [finish, setFinish] = useState("2026-08-01");

  if (!data) return null;
  const clients = data.clients.filter((c) => c.status === "active");
  const contacts = data.contacts.filter((c) => c.clientId === clientId && c.status === "active");
  const projectTypeId = data.projectTypes[0]?.id ?? "";
  const valid = title.trim() && clientId && contactId && stageId && Number(contractValue) > 0 && Number(rate) > 0 && finish >= start;

  const submit = async () => {
    if (!valid) return;
    setBusy(true); setNotice(null);
    const res = await create({ clientId, primaryContactId: contactId, projectTypeId, stageId, title: title.trim(), plannedStart: start, plannedFinish: finish, contractValue: Math.round(Number(contractValue)), plannedHourlyRate: Math.round(Number(rate)), probability: Math.round(Number(probability)), demand: [{ positionId: "backend", requiredHours: Math.min(100000, Math.max(1, Math.floor(Number(contractValue) / Number(rate)))) }] });
    setBusy(false);
    if (res.ok) { setNotice("Сделка создана"); setOpen(false); setTitle(""); setClientId(""); setContactId(""); setStageId(""); }
    else setNotice(`Отклонено: ${ruErr(res.code, res.message)}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Сделка</Button></DialogTrigger>
      <DialogContent className="max-w-[560px]">
        <DialogHeader><DialogTitle>Новая сделка</DialogTitle></DialogHeader>
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
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Сумма, ₽<Input type="number" min={1} value={contractValue} onChange={(e) => setContractValue(e.target.value)} className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Ставка, ₽/ч<Input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} className="text-right" /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Старт<Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Финиш<Input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} aria-invalid={finish < start} /></label>
        </div>
        <p className="text-[10px] text-[var(--muted-soft)]">Трудоёмкость = сумма / ставка (POST /opportunities, статус «Новая»); строка спроса в прототипе фиксирована (позиция backend). Контакт валидируется как активный у выбранного клиента.</p>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
