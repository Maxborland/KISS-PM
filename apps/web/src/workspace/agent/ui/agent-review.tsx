"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import {
  TERMINAL_STATUSES,
  UNRESOLVED_STATUSES,
  type AgentChange,
  type AgentChangeStatus
} from "@/workspace/agent/agent-model";

export type ReviewHandlers = {
  onSelectChange: (id: string) => void;
  onFocusChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onEditChange: (id: string) => void;
  onUpdateChange: (id: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

type ReviewState = {
  changes: AgentChange[];
  busy: boolean;
  activeChangeId: string;
  editingChangeId?: string | undefined;
};

/** md-брейкпоинт Tailwind: desktop-колонка ↔ мобильный Sheet. */
function useIsDesktop(): boolean {
  // SSR/первый рендер — desktop-ветка (совпадает с md:flex поведением до гидрации).
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

/**
 * Панель сверки: desktop-колонка ИЛИ мобильный Sheet (focus-trap/Escape — от Radix).
 * В DOM всегда ровно один экземпляр контента — иначе e2e-локаторы ловят
 * strict mode violation на дублях текста (скрытая колонка + открытый Sheet).
 */
export function ChangeReviewPanel({
  visible,
  mobileOpen,
  onCloseMobile,
  returnFocusRef,
  state,
  handlers
}: {
  visible: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Куда вернуть фокус при закрытии Sheet: без Trigger Radix уронил бы его на body. */
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
  state: ReviewState;
  handlers: ReviewHandlers;
}) {
  const isDesktop = useIsDesktop();
  if (!visible) return null;
  if (isDesktop) {
    return (
      <aside
        aria-label="Сверка изменений"
        className="flex w-[var(--side-panel-width)] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--panel-subtle)]"
      >
        <ReviewContent state={state} handlers={handlers} />
      </aside>
    );
  }
  return (
    <Sheet open={mobileOpen} onOpenChange={(open) => { if (!open) onCloseMobile(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-[var(--modal-sm)] p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-[var(--border)] px-4 py-3">
          <SheetTitle>Сверка изменений</SheetTitle>
          <SheetDescription className="sr-only">
            Предложенные агентом изменения: проверьте, отредактируйте и примените выбранные.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <ReviewContent state={state} handlers={handlers} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReviewContent({ state, handlers }: { state: ReviewState; handlers: ReviewHandlers }) {
  const { changes, busy } = state;
  const selectedCount = changes.filter((change) => change.selected).length;
  const appliedCount = changes.filter((change) => change.status === "применено").length;
  const unresolvedCount = changes.filter((change) => UNRESOLVED_STATUSES.includes(change.status)).length;
  const hasExecutionOutcome = changes.some((change) =>
    ["применено", "отказано", "конфликт", "ошибка", "неизвестно"].includes(change.status)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">
          Сверка
        </span>
        <strong className="text-[length:var(--text-sm)] text-[var(--text-strong)]">Всего: {changes.length}</strong>
      </header>
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2 text-[length:var(--text-sm)]">
        <span className="font-semibold text-[var(--accent)]">{selectedCount} выбрано</span>
        <span className="text-[var(--muted)]">
          {appliedCount > 0 && unresolvedCount > 0
            ? "Частично применено"
            : unresolvedCount > 0
              ? "Требуют внимания"
              : "Готово к проверке"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {changes.map((change) => (
          <ChangeHunkCard
            key={change.id}
            change={change}
            busy={busy}
            active={change.id === state.activeChangeId}
            editing={change.id === state.editingChangeId}
            onSelect={() => handlers.onSelectChange(change.id)}
            onFocus={() => handlers.onFocusChange(change.id)}
            onReject={() => handlers.onRejectChange(change.id)}
            onEdit={() => handlers.onEditChange(change.id)}
            onUpdate={(value) => handlers.onUpdateChange(change.id, value)}
          />
        ))}
      </div>
      {hasExecutionOutcome ? (
        <div
          role="status"
          className="mx-4 mb-2 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--success)]" aria-hidden />
          <div className="text-[length:var(--text-sm)]">
            <strong className="block text-[var(--text-strong)]">
              Применено {appliedCount} из {changes.length}
            </strong>
            <span className="text-[var(--muted)]">
              {unresolvedCount > 0 ? `Требуют внимания: ${unresolvedCount}` : "Все выбранные изменения обработаны"}
            </span>
          </div>
        </div>
      ) : null}
      <div className="flex shrink-0 gap-2 border-t border-[var(--border)] px-4 py-3">
        {/* Во время busy кнопка остаётся фокусируемой (aria-disabled + guard):
            нативный disabled сбросил бы фокус на body посреди клавиатурного apply. */}
        <Button
          type="button"
          size="sm"
          onClick={() => { if (!busy) handlers.onApply(); }}
          disabled={selectedCount === 0}
          aria-disabled={busy || selectedCount === 0}
        >
          <Check aria-hidden />
          {busy ? "Применяем…" : hasExecutionOutcome ? "Применить оставшиеся" : "Применить выбранное"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handlers.onReset} disabled={busy}>
          <RotateCcw aria-hidden />
          Сбросить
        </Button>
      </div>
    </div>
  );
}

const STATUS_CHIP: Record<AgentChangeStatus, string> = {
  "выбрано": "border-[var(--accent-muted)] bg-[var(--accent-soft)] text-[var(--accent)]",
  "изменено": "border-[var(--accent-muted)] bg-[var(--accent-soft)] text-[var(--accent)]",
  "отклонено": "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
  "требует прав": "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)]",
  "применено": "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success-text)]",
  "отказано": "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)]",
  "конфликт": "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]",
  "ошибка": "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]",
  "неизвестно": "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]"
};

function ChangeHunkCard({
  change,
  busy,
  active,
  editing,
  onSelect,
  onFocus,
  onReject,
  onEdit,
  onUpdate
}: {
  change: AgentChange;
  busy: boolean;
  active: boolean;
  editing: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onReject: () => void;
  onEdit: () => void;
  onUpdate: (value: string) => void;
}) {
  const terminal = TERMINAL_STATUSES.includes(change.status);
  return (
    // Карточка не интерактивна сама по себе (article с Enter/Space — ложная семантика
    // для SR); клавиатурный путь — внутренние кнопки: чип статуса (toggle выбора),
    // «Изменить», «Отклонить». onFocus поднимает active-подсветку при табе внутрь.
    <article
      data-testid="agent-change-card"
      aria-label={`Изменение ${change.number}: ${change.title}`}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-3",
        active && "border-[var(--accent)]"
      )}
      onClick={onFocus}
      onFocus={onFocus}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]" aria-hidden>
          {change.number}
        </span>
        <strong id={`agent-change-title-${change.id}`} className="min-w-0 flex-1 text-[length:var(--text-sm)] leading-[var(--lh-sm)] text-[var(--text-strong)]">
          {change.title}
        </strong>
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-[var(--radius-full)] border px-2 py-0.5 text-[length:var(--text-xs)] font-medium disabled:opacity-70",
            STATUS_CHIP[change.status]
          )}
          // Имя кнопки = статус (контракт e2e); контекст «какого изменения» — через describedby.
          aria-describedby={`agent-change-title-${change.id}`}
          disabled={busy || terminal}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          {change.status}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-[length:var(--text-sm)]">
        <div className="min-w-0">
          <span className="block text-[length:var(--text-xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">Было</span>
          <p className="break-words text-[var(--muted-strong)]">{change.before}</p>
        </div>
        <span className="mt-4 text-[var(--muted-soft)]" aria-hidden>→</span>
        <div className="min-w-0">
          <span className="block text-[length:var(--text-xs)] uppercase tracking-[0.04em] text-[var(--muted-soft)]">Стало</span>
          {editing && !busy && !terminal ? (
            <Textarea
              value={change.after}
              onChange={(event) => onUpdate(event.target.value)}
              aria-label={`Новое значение: ${change.title}`}
              className="mt-1"
            />
          ) : (
            <p className="break-words font-medium text-[var(--text)]">{change.after}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-[length:var(--text-sm)]">
        <button
          type="button"
          className="font-medium text-[var(--accent)] hover:underline disabled:text-[var(--muted-soft)] disabled:no-underline"
          onClick={(event) => { event.stopPropagation(); onEdit(); }}
          disabled={busy || terminal}
        >
          Изменить
        </button>
        <button
          type="button"
          className="font-medium text-[var(--muted-strong)] hover:underline disabled:text-[var(--muted-soft)] disabled:no-underline"
          onClick={(event) => { event.stopPropagation(); onReject(); }}
          disabled={busy || terminal}
        >
          Отклонить
        </button>
      </div>
    </article>
  );
}
