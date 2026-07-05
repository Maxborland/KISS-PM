"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useResourceDirectory } from "@/delivery/lib/use-resource-directory";

export const ROLES: Array<[string, string]> = [
  ["executor", "Исполнитель"],
  ["co_executor", "Соисполнитель"],
  ["controller", "Контролёр"],
  ["approver", "Согласующий"],
  ["observer", "Наблюдатель"]
];
export const roleLabel = (role: string) => ROLES.find(([id]) => id === role)?.[1] ?? role;

/** Раскладка трудозатрат по весам так, чтобы сумма ТОЧНО равнялась work (минуты).
 *  Метод наибольшего остатка (Hamilton): floor по каждому + раздача остатка по
 *  наибольшим дробным частям. Без отрицательных и без потери минут на любых n/весах. */
export function distribute(workMinutes: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  const work = Math.max(0, Math.round(workMinutes));
  if (total <= 0) { const out = new Array(n).fill(0); out[0] = work; return out; }
  const raw = weights.map((w) => (work * Math.max(0, w)) / total);
  const out = raw.map((x) => Math.floor(x));
  let rem = work - out.reduce((s, x) => s + x, 0); // 0..n, столько единиц раздать
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem; k++) { const idx = order[k % order.length]!.i; out[idx] = (out[idx] ?? 0) + 1; }
  return out;
}

/** Пресеты кривой по N рабочим дням: равномерно / фронт-загрузка / бэк-загрузка.
 *  Мягкий линейный наклон 1.4×…0.6× от среднего — реалистичная кривая без экстремумов. */
export function presetWeights(n: number, kind: "even" | "front" | "back"): number[] {
  if (n <= 0) return [];
  if (n === 1 || kind === "even") return Array.from({ length: n }, () => 1);
  const ramp = (i: number) => 1.4 - 0.8 * (i / (n - 1)); // 1.4 → 0.6
  if (kind === "front") return Array.from({ length: n }, (_, i) => ramp(i));
  return Array.from({ length: n }, (_, i) => ramp(n - 1 - i)); // back — зеркально
}

/** Диалог добавления исполнителя на задачу. */
export function AddAssigneeDialog({ taskTitle, excludeIds, onSubmit, children }: { taskTitle: string; excludeIds: string[]; onSubmit: (resourceId: string, role: string) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resources = useResourceDirectory().list; // live: /api/workspace/users; mock: статичный RESOURCES
  const avail = resources.filter((r) => !excludeIds.includes(r.id));
  const [resourceId, setResourceId] = useState<string>(avail[0]?.id ?? "");
  const [role, setRole] = useState<string>("co_executor");
  const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) { setResourceId(avail[0]?.id ?? ""); setRole("co_executor"); } }}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-pop)]">
          <Dialog.Title className="text-[length:var(--text-base)] font-bold text-[var(--text-strong)]">Добавить исполнителя</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">на задачу «{taskTitle}»</Dialog.Description>
          <div className="mt-3 space-y-2.5">
            <label className="block">
              <span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Ресурс</span>
              <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={selCls}>
                {avail.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.positionName}</option>)}
                {avail.length === 0 ? <option value="">— все уже назначены —</option> : null}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">Роль</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selCls}>
                {ROLES.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild><Button variant="ghost" size="sm">Отмена</Button></Dialog.Close>
            <Button variant="default" size="sm" disabled={!resourceId} onClick={() => { if (resourceId) { onSubmit(resourceId, role); setOpen(false); } }}>Добавить</Button>
          </div>
          <Dialog.Close asChild><button className={cn("absolute right-3 top-3 text-[var(--muted)] hover:text-[var(--text)]")} aria-label="Закрыть">✕</button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
