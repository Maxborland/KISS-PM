"use client";

import type { ReactNode } from "react";
import { AlertCircle, HelpCircle, LifeBuoy, LogIn, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ERROR_DICTIONARY,
  formatErrorCorrelationId,
  type ErrorDictionaryKey,
  type ErrorDictionaryCtaKind
} from "@/components/ui/error-dictionary";
import type { StateLevel } from "@/components/ui/state-level";
import { stateLevelModifier } from "@/components/ui/state-level";
import { cn } from "@/lib/cn";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  hint?: string;
  /** Ключ словаря 4xx/5xx/network — подставляет RU-копирайт и CTA. */
  errorKey?: ErrorDictionaryKey;
  correlationId?: string;
  level?: StateLevel;
  onRetry?: () => void;
  onBack?: () => void;
  onSupport?: () => void;
  onLogin?: () => void;
  action?: ReactNode;
  className?: string;
};

function ErrorCtaIcon({ kind }: { kind: ErrorDictionaryCtaKind }) {
  if (kind === "login") return <LogIn className="size-4" aria-hidden />;
  if (kind === "support") return <LifeBuoy className="size-4" aria-hidden />;
  return <RotateCw className="size-4" aria-hidden />;
}

export function ErrorState({
  title,
  description,
  hint,
  errorKey,
  correlationId,
  level = "L3",
  onRetry,
  onBack,
  onSupport,
  onLogin,
  action,
  className
}: ErrorStateProps) {
  const entry = errorKey ? ERROR_DICTIONARY[errorKey] : undefined;
  const resolvedTitle = title ?? entry?.title ?? "Ошибка";
  const resolvedDescription = description ?? entry?.description;
  const resolvedHint = hint ?? entry?.hint;
  const correlationLabel = correlationId ? formatErrorCorrelationId(correlationId) : "";

  const defaultAction =
    action ??
    (entry ? (
      <DictionaryCta
        kind={entry.ctaKind}
        label={entry.ctaLabel}
        {...(onRetry ? { onRetry } : {})}
        {...(onBack ? { onBack } : {})}
        {...(onSupport ? { onSupport } : {})}
        {...(onLogin ? { onLogin } : {})}
      />
    ) : onRetry ? (
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
    ) : null);

  return (
    <TooltipProvider>
      <div
        className={cn(stateLevelModifier("state-illu", level), "state-illu--error", className)}
        role="alert"
        aria-live="polite"
      >
        <div className="state-illu__art" aria-hidden>
          <AlertCircle className="size-8 text-[var(--danger)]" strokeWidth={1.75} />
        </div>
        <div className="u-flex u-items-center u-gap-2 u-justify-center">
          <h2 className="state-illu__title u-margin-0">{resolvedTitle}</h2>
          {resolvedHint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="icon-btn cursor-help" aria-label="Подробнее">
                  <HelpCircle className="size-4 text-[var(--muted)]" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-left">
                {resolvedHint}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {resolvedDescription ? <p className="state-illu__text">{resolvedDescription}</p> : null}
        {correlationLabel ? (
          <p className="state-illu__correlation mono">{correlationLabel}</p>
        ) : null}
        {defaultAction ? <div className="state-illu__actions">{defaultAction}</div> : null}
      </div>
    </TooltipProvider>
  );
}

function DictionaryCta({
  kind,
  label,
  onRetry,
  onBack,
  onSupport,
  onLogin
}: {
  kind: ErrorDictionaryCtaKind;
  label: string;
  onRetry?: () => void;
  onBack?: () => void;
  onSupport?: () => void;
  onLogin?: () => void;
}) {
  const handler =
    kind === "retry"
      ? onRetry
      : kind === "back"
        ? onBack
        : kind === "support"
          ? onSupport
          : onLogin;
  const variant = kind === "support" ? "outline" : "secondary";

  return (
    <Button variant={variant} onClick={handler} disabled={!handler}>
      <ErrorCtaIcon kind={kind} />
      {label}
    </Button>
  );
}
