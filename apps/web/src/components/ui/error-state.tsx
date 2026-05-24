"use client";

import type { ReactNode } from "react";
import { AlertCircle, HelpCircle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export type ErrorStateProps = {
  title: string;
  description?: string;
  /** Подсказка с пояснением (показывается рядом с заголовком как tooltip-trigger). */
  hint?: string;
  /** Колбэк "повторить" — добавляет вторичную кнопку и tooltip "Повторить запрос". */
  onRetry?: () => void;
  /** Кастомный action (если нужен полный контроль). Имеет приоритет над `onRetry`. */
  action?: ReactNode;
  className?: string;
};

export function ErrorState({ title, description, hint, onRetry, action, className }: ErrorStateProps) {
  return (
    <TooltipProvider>
      <div className={cn("state-illu", className)} role="alert" aria-live="polite">
        <div className="state-illu__art" aria-hidden>
          <AlertCircle className="size-8 text-[var(--danger)]" strokeWidth={1.75} />
        </div>
        <div className="u-flex u-items-center u-gap-2 u-justify-center">
          <p className="state-illu__title u-margin-0">{title}</p>
          {hint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="icon-btn cursor-help" aria-label="Подробнее">
                  <HelpCircle className="size-4 text-[var(--muted)]" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-left">
                {hint}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {description ? <p className="state-illu__text">{description}</p> : null}
        <div className="state-illu__actions">
          {action ??
            (onRetry ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" onClick={onRetry}>
                    <RotateCw className="size-4" aria-hidden />
                    Повторить
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  Повторить запрос к API
                </TooltipContent>
              </Tooltip>
            ) : null)}
        </div>
      </div>
    </TooltipProvider>
  );
}
