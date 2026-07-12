"use client";

import { Check, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

/** Панель сверки: desktop-колонка + мобильный Sheet (focus-trap/Escape — от Radix). */
export function ChangeReviewPanel({
  visible,
  mobileOpen,
  onCloseMobile,
  state,
  handlers
}: {
  visible: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  state: ReviewState;
  handlers: ReviewHandlers;
}) {
  if (!visible) return null;
  return (
    <>
      <aside
        aria-label="Сверка изменений"
        className="hidden w-[var(--inspector-width)] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--panel-subtle)] md:flex"
      >
        <ReviewContent state={state} handlers={handlers} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={(open) => { if (!open) onCloseMobile(); }}>
        <SheetContent side="right" className="w-full max-w-[420px] p-0 md:hidden">
          <SheetHeader className="border-b border-[var(--border)] px-4 py-3">
            <SheetTitle>Сверка изменений</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <ReviewContent state={state} handlers={handlers} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ReviewContent({ state, handlers }: { state: ReviewState; handlers: ReviewHandlers }) {
  const { changes, busy } = state;
  const selectedCount = changes.filter((change) => change.selected).length;
  const appliedCount = changes.filter((change) => change.status === "применено").length;
  const unresolvedCount = changes.filter((change) => UNRESOLVED_STATUSES.includes(change.status)).length;
  const hasExecutionOutcome = changes.some((change) =>
    ["применено", "пропущено", "отказано", "конфликт", "ошибка", "неизвестно"].includes(change.status)
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
        <Button type="button" size="sm" onClick={handlers.onApply} disabled={busy || selectedCount === 0}>
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
  "пропущено": "border-[var(--border-strong)] bg-[var(--panel-strong)] text-[var(--muted-strong)]",
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
    <article
      data-testid="agent-change-card"
      tabIndex={0}
      aria-label={`Изменение ${change.number}: ${change.title}`}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-3 outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)]",
        active && "border-[var(--accent)]"
      )}
      onClick={onFocus}
      onFocus={onFocus}
      onKeyDown={(event) => {
        // Клавиатурный выбор карточки: Enter/Space = переключить участие в применении.
        if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
          event.preventDefault();
          if (!busy && !terminal) onSelect();
        }
      }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[length:var(--text-2xs)] font-semibold text-[var(--muted-strong)]" aria-hidden>
          {change.number}
        </span>
        <strong className="min-w-0 flex-1 text-[length:var(--text-sm)] leading-[var(--lh-sm)] text-[var(--text-strong)]">
          {change.title}
        </strong>
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-[var(--radius-full)] border px-2 py-0.5 text-[length:var(--text-xs)] font-medium disabled:opacity-70",
            STATUS_CHIP[change.status]
          )}
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
