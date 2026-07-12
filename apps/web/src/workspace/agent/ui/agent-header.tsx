"use client";

import { Bot, SlidersHorizontal } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import type { AgentToolAvailability } from "@/workspace/agent/agent-client";

export type AgentProviderInfo = { model: string; live: boolean; configured?: boolean };

/**
 * Шапка агента: имя, статус провайдера и РЕАЛЬНЫЕ сведения (инструменты и права
 * текущего пользователя из GET /agent/tools) вместо демо-копии «примерных проектов».
 */
export function AgentHeader({
  provider,
  tools,
  reviewVisible,
  onOpenMobileReview,
  reviewButtonRef
}: {
  provider: AgentProviderInfo | null;
  tools: AgentToolAvailability[];
  reviewVisible: boolean;
  onOpenMobileReview: () => void;
  /** Ref кнопки «Сверка» — сюда возвращается фокус после закрытия мобильного Sheet. */
  reviewButtonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 md:px-6">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]" aria-hidden>
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold leading-[var(--lh-lg)] text-[var(--text-strong)]">
          Генри Гантт
        </h1>
        <span className="block text-[length:var(--text-xs)] text-[var(--muted)]">Агент аккаунта</span>
      </div>
      {reviewVisible ? (
        <button
          ref={reviewButtonRef}
          type="button"
          aria-haspopup="dialog"
          className="rounded-[var(--radius-full)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1 text-[length:var(--text-sm)] font-medium text-[var(--accent)] md:hidden"
          onClick={onOpenMobileReview}
        >
          Сверка
        </button>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <IconButton type="button" label="Сведения об агенте">
            <SlidersHorizontal aria-hidden />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <strong className="block text-[length:var(--text-md)] text-[var(--text-strong)]">Генри Гантт</strong>
            <span className="text-[length:var(--text-xs)] text-[var(--muted)]">
              {provider ? `Модель: ${provider.model}` : "Модель неизвестна"}
              {provider && !provider.live ? " · демо-режим" : ""}
            </span>
          </div>
          <dl className="flex flex-col gap-3 px-4 py-3 text-[length:var(--text-sm)]">
            <div>
              <dt className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.05em] text-[var(--muted-soft)]">
                Поведение
              </dt>
              <dd className="mt-0.5 text-[var(--text)]">
                Ничего не меняет без сверки: сначала предложение, затем подтверждение и применение с аудитом.
              </dd>
            </div>
            <div>
              <dt className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.05em] text-[var(--muted-soft)]">
                Доступные действия
              </dt>
              {tools.length === 0 ? (
                <dd className="mt-0.5 text-[var(--muted)]">Список действий недоступен.</dd>
              ) : (
                tools.map((tool) => (
                  <dd key={tool.name} className="mt-1 flex items-baseline gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 translate-y-[-1px] rounded-full",
                        tool.allowed ? "bg-[var(--success)]" : "bg-[var(--border-strong)]"
                      )}
                    />
                    <span className={cn("min-w-0", tool.allowed ? "text-[var(--text)]" : "text-[var(--muted)]")}>
                      {tool.title}
                      {!tool.allowed ? <span className="text-[var(--muted-soft)]"> (нет прав)</span> : null}
                    </span>
                  </dd>
                ))
              )}
            </div>
          </dl>
        </PopoverContent>
      </Popover>
    </header>
  );
}
