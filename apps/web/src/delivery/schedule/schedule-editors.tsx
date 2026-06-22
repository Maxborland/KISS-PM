"use client";

import { type ReactNode, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Check, Diamond, GitBranch, IndentDecrease, IndentIncrease, Plus, Trash2, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { RESOURCES } from "@/delivery/lib/mock-planning-backend";

const POP = "z-50 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--panel)] p-2 shadow-[var(--shadow-pop)] text-[length:var(--text-sm)] text-[var(--text)]";
const MENU = "z-50 min-w-[200px] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--panel)] p-1 shadow-[var(--shadow-pop)] text-[length:var(--text-sm)]";
const ITEM = "flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--text)] outline-none data-[highlighted]:bg-[var(--accent-soft)] data-[highlighted]:text-[var(--accent)]";
const ITEM_DANGER = "flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--danger-text)] outline-none data-[highlighted]:bg-[var(--danger-soft)]";

export const DEP_RU: Record<string, string> = { FS: "ОН", SS: "НН", FF: "ОО", SF: "НО" };
const DEP_ORDER = ["FS", "SS", "FF", "SF"] as const;

/* ---- Date editor (popover + date input + быстрые сдвиги) ---- */
export function DateEditor({ valueIso, onPick, title = "Начало задачи", children }: { valueIso: string; onPick: (iso: string) => void; title?: string; children: ReactNode }) {
  const [draft, setDraft] = useState(valueIso);
  return (
    <Popover.Root onOpenChange={(o) => o && setDraft(valueIso)}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={POP} sideOffset={4} align="start">
          <div className="flex w-[210px] flex-col gap-2">
            <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">{title}</div>
            <input
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]"
            />
            <div className="flex items-center justify-end gap-1.5">
              <Popover.Close className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--muted)] hover:bg-[var(--panel-strong)]">Отмена</Popover.Close>
              <Popover.Close onClick={() => draft && onPick(draft)} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-2.5 py-1 font-medium text-white hover:bg-[var(--accent-hover)]">
                Применить
              </Popover.Close>
            </div>
            <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Ограничение «не раньше» · режим остаётся авто (длительность и труд пересчитаются).</p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---- Resource editor (выпадающий список сотрудников) ---- */
export function ResourceEditor({ onPick, children }: { onPick: (resourceId: string) => void; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={POP} sideOffset={4} align="start">
          <div className="flex max-h-[260px] w-[220px] flex-col gap-0.5 overflow-auto">
            <div className="px-1 pb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Назначить сотрудника</div>
            {RESOURCES.map((r) => (
              <Popover.Close
                key={r.id}
                onClick={() => onPick(r.id)}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[10px] font-semibold text-[var(--muted-strong)]">
                  {r.name.slice(0, 1)}
                </span>
                {r.name}
              </Popover.Close>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---- Dependency editor (добавить/убрать предшественников, RU-типы + лаг) ---- */
type PredRow = { depId: string; predId: string; predLabel: string; type: string; lagDays: number };
export function DependencyEditor({
  preds,
  options,
  onAdd,
  onRemove,
  children
}: {
  preds: PredRow[];
  options: Array<{ id: string; label: string }>;
  onAdd: (predId: string, type: string, lagDays: number) => void;
  onRemove: (depId: string) => void;
  children: ReactNode;
}) {
  const [predId, setPredId] = useState("");
  const [type, setType] = useState("FS");
  const [lag, setLag] = useState("0");
  return (
    <Popover.Root onOpenChange={(o) => { if (o) { setPredId(""); setType("FS"); setLag("0"); } }}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={POP} sideOffset={4} align="start">
          <div className="flex w-[300px] flex-col gap-2">
            <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Зависимости (предшественники)</div>
            {preds.length ? (
              <ul className="flex flex-col gap-1">
                {preds.map((p) => (
                  <li key={p.depId} className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--panel-subtle)] px-2 py-1">
                    <span className="mono text-[var(--muted)]">{p.predLabel}</span>
                    <span className="rounded bg-[var(--panel-strong)] px-1 text-[10px] font-semibold text-[var(--muted-strong)]">{DEP_RU[p.type] ?? p.type}{p.lagDays ? ` +${p.lagDays}д` : ""}</span>
                    <button type="button" onClick={() => onRemove(p.depId)} className="ml-auto grid size-5 place-items-center rounded text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger-text)]" aria-label="Убрать зависимость"><X className="size-3.5" aria-hidden /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Пока нет зависимостей.</p>
            )}
            <div className="mt-1 flex flex-col gap-1.5 border-t border-[var(--border)] pt-2">
              <select value={predId} onChange={(e) => setPredId(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
                <option value="">Выберите предшественника…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <div className="flex items-center gap-1.5">
                <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
                  {DEP_ORDER.map((t) => <option key={t} value={t}>{DEP_RU[t]} ({t})</option>)}
                </select>
                <input type="number" value={lag} onChange={(e) => setLag(e.target.value)} className="w-16 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 text-right text-[length:var(--text-sm)] tabular-nums outline-none focus:border-[var(--accent)]" aria-label="Лаг, дней" />
                <span className="text-[length:var(--text-xs)] text-[var(--muted)]">дн</span>
                <button
                  type="button"
                  disabled={!predId}
                  onClick={() => { if (predId) onAdd(predId, type, Number(lag) || 0); }}
                  className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent)] px-2 py-1 font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  <Plus className="size-3.5" aria-hidden />Связь
                </button>
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---- Редактор связи прямо на линии Ганта (тип/лаг/удалить) ---- */
export function LinkLagEditor({ type, lagDays, onSave, onDelete, children }: { type: string; lagDays: number; onSave: (type: string, lagDays: number) => void; onDelete: () => void; children: ReactNode }) {
  const [t, setT] = useState(type);
  const [lag, setLag] = useState(String(lagDays));
  return (
    <Popover.Root onOpenChange={(o) => { if (o) { setT(type); setLag(String(lagDays)); } }}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={POP} sideOffset={6} align="center">
          <div className="flex w-[230px] flex-col gap-2">
            <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Связь — тип и лаг</div>
            <div className="flex items-center gap-1.5">
              <select value={t} onChange={(e) => setT(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
                {DEP_ORDER.map((x) => <option key={x} value={x}>{DEP_RU[x]} ({x})</option>)}
              </select>
              <input type="number" value={lag} onChange={(e) => setLag(e.target.value)} className="w-16 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 text-right text-[length:var(--text-sm)] tabular-nums outline-none focus:border-[var(--accent)]" aria-label="Лаг, дней" />
              <span className="text-[length:var(--text-xs)] text-[var(--muted)]">дн</span>
            </div>
            <div className="flex items-center justify-between">
              <Popover.Close onClick={onDelete} className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[var(--danger-text)] hover:bg-[var(--danger-soft)]"><Trash2 className="size-3.5" aria-hidden />Удалить</Popover.Close>
              <Popover.Close onClick={() => onSave(t, Number(lag) || 0)} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-2.5 py-1 font-medium text-white hover:bg-[var(--accent-hover)]">Сохранить</Popover.Close>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---- Контекстное меню строки (ПКМ) ---- */
export function RowMenu({
  isLeaf,
  canIndent,
  canOutdent,
  onOpen,
  onAddSub,
  onAddBelow,
  onIndent,
  onOutdent,
  onMakeMilestone,
  onDelete,
  children
}: {
  isLeaf: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  onOpen: () => void;
  onAddSub: () => void;
  onAddBelow: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMakeMilestone: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const itemDisabled = "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--muted-soft)] outline-none";
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={MENU}>
          <ContextMenu.Item className={ITEM} onSelect={onOpen}>Открыть инспектор</ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <ContextMenu.Item className={ITEM} onSelect={onAddSub}><Plus className="size-3.5" aria-hidden />Создать подзадачу</ContextMenu.Item>
          <ContextMenu.Item className={ITEM} onSelect={onAddBelow}><Plus className="size-3.5" aria-hidden />Создать задачу рядом</ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <ContextMenu.Item className={canIndent ? ITEM : itemDisabled} disabled={!canIndent} onSelect={onIndent}><IndentIncrease className="size-3.5" aria-hidden />На уровень глубже</ContextMenu.Item>
          <ContextMenu.Item className={canOutdent ? ITEM : itemDisabled} disabled={!canOutdent} onSelect={onOutdent}><IndentDecrease className="size-3.5" aria-hidden />На уровень выше</ContextMenu.Item>
          {isLeaf ? <ContextMenu.Item className={ITEM} onSelect={onMakeMilestone}><Diamond className="size-3.5" aria-hidden />Сделать вехой</ContextMenu.Item> : null}
          <ContextMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <ContextMenu.Item className={ITEM_DANGER} onSelect={onDelete}><Trash2 className="size-3.5" aria-hidden />Удалить</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export { Check, GitBranch, UserPlus };
