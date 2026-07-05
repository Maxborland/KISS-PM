"use client";

import { type ReactNode, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, UserMinus, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { RESOURCES } from "@/delivery/lib/planning-demo-data";

const OVERLAY = "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]";
const CONTENT = "fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--panel)] p-4 shadow-[var(--shadow-pop)]";
const FIELD = "rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1.5 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]";
const LABEL = "text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]";

function ResourceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
      {RESOURCES.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.positionName}</option>)}
    </select>
  );
}

/* Резервирование ресурса (resource.reserve) */
export function ReserveDialog({ onSubmit, children }: { onSubmit: (resourceId: string, start: string, finish: string, hours: number) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [resourceId, setResourceId] = useState(RESOURCES[0]!.id);
  const [start, setStart] = useState("2026-04-06");
  const [finish, setFinish] = useState("2026-04-17");
  const [hours, setHours] = useState("40");
  const submit = () => { const h = Number(hours); if (resourceId && start && finish && h > 0) { onSubmit(resourceId, start, finish, h); setOpen(false); } };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <div className="mb-3 flex items-start justify-between">
            <Dialog.Title className="flex items-center gap-2 text-[length:var(--text-base)] font-bold text-[var(--text-strong)]"><ShieldCheck className="size-4 text-[var(--warning)]" aria-hidden />Резерв ресурса</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label="Закрыть"><X className="size-4" aria-hidden /></Dialog.Close>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1"><span className={LABEL}>Сотрудник</span><ResourceSelect value={resourceId} onChange={setResourceId} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1"><span className={LABEL}>С</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} /></label>
              <label className="flex flex-col gap-1"><span className={LABEL}>По</span><input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} className={FIELD} /></label>
            </div>
            <label className="flex flex-col gap-1"><span className={LABEL}>Часы (всего)</span><input type="number" value={hours} onChange={(e) => setHours(e.target.value)} className={cn(FIELD, "w-28 text-right tabular-nums")} /></label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Dialog.Close className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--text-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)]">Отмена</Dialog.Close>
            <button type="button" onClick={submit} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium text-white hover:bg-[var(--accent-hover)]">Зарезервировать</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* Отсутствие / отпуск (диапазон → батч calendar.exception.upsert) */
const ABSENCE_TYPES = [
  { id: "vacation", label: "Отпуск" },
  { id: "sick", label: "Больничный" },
  { id: "dayoff", label: "Отгул" }
];
export function AbsenceDialog({ onSubmit, children }: { onSubmit: (resourceId: string, type: string, start: string, finish: string) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [resourceId, setResourceId] = useState(RESOURCES[0]!.id);
  const [type, setType] = useState("vacation");
  const [start, setStart] = useState("2026-05-04");
  const [finish, setFinish] = useState("2026-05-08");
  const submit = () => { if (resourceId && start && finish && finish >= start) { onSubmit(resourceId, ABSENCE_TYPES.find((t) => t.id === type)?.label ?? "Отсутствие", start, finish); setOpen(false); } };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <div className="mb-3 flex items-start justify-between">
            <Dialog.Title className="flex items-center gap-2 text-[length:var(--text-base)] font-bold text-[var(--text-strong)]"><UserMinus className="size-4 text-[var(--violet)]" aria-hidden />Отсутствие сотрудника</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)]" aria-label="Закрыть"><X className="size-4" aria-hidden /></Dialog.Close>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1"><span className={LABEL}>Сотрудник</span><ResourceSelect value={resourceId} onChange={setResourceId} /></label>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Тип</span>
              <div className="flex gap-1.5">
                {ABSENCE_TYPES.map((t) => <button key={t.id} type="button" onClick={() => setType(t.id)} className={cn("rounded-[var(--radius-sm)] border px-2.5 py-1 text-[length:var(--text-sm)]", type === t.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--muted-strong)] hover:bg-[var(--panel-strong)]")}>{t.label}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1"><span className={LABEL}>С</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} /></label>
              <label className="flex flex-col gap-1"><span className={LABEL}>По</span><input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} className={FIELD} /></label>
            </div>
            <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Применится одним пакетом (исключения календаря по рабочим дням диапазона).</p>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Dialog.Close className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--text-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)]">Отмена</Dialog.Close>
            <button type="button" onClick={submit} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium text-white hover:bg-[var(--accent-hover)]">Добавить отсутствие</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
