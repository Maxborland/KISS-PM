"use client";

import { AlertCircle, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { CardPanel } from "@/components/domain/card-panel";
import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";

export type ScreenBlockFetchIssueKind = "error" | "forbidden";

export function ScreenBlockFetchIssue({
  kind,
  title,
  description,
  onRetry,
  mutedContent
}: {
  kind: ScreenBlockFetchIssueKind;
  title: string;
  description?: string;
  onRetry?: () => void;
  /** Приглушённый скелетон под баннером — сохраняет layout экрана. */
  mutedContent?: ReactNode;
}) {
  const isError = kind === "error";
  const desc =
    description ??
    (isError
      ? "Повторите попытку или обратитесь в поддержку, если ошибка повторяется."
      : "Недостаточно прав для просмотра этого раздела. Обратитесь к администратору.");

  return (
    <div className="screen-block-fetch" aria-live="polite">
      <CardPanel title={title} subtitle="Ошибка загрузки данных">
        <BannerInline variant={isError ? "danger" : "warn"}>
          <div className="screen-block-fetch__body">
            {isError ? (
              <AlertCircle className="screen-block-fetch__icon" aria-hidden />
            ) : (
              <ShieldAlert className="screen-block-fetch__icon" aria-hidden />
            )}
            <div className="screen-block-fetch__copy">
              <p className="screen-block-fetch__title">{title}</p>
              <p className="screen-block-fetch__desc">{desc}</p>
            </div>
          </div>
        </BannerInline>
        {isError && onRetry ? (
          <div className="screen-block-fetch__actions">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Повторить
            </Button>
          </div>
        ) : null}
      </CardPanel>
      {mutedContent ? <div className="screen-block-fetch__muted">{mutedContent}</div> : null}
    </div>
  );
}

/** Таблица / панели — скелетон для list-экранов. */
export function ScreenBlockPanelSkeleton({
  rows = 4,
  withToolbar = true
}: {
  rows?: number;
  withToolbar?: boolean;
}) {
  return (
    <div className="screen-block-skeleton" aria-busy="true" aria-label="Загрузка данных">
      {withToolbar ? (
        <div className="screen-block-skeleton__toolbar">
          <Skeleton variant="chip" />
          <Skeleton variant="text" width="lg" className="screen-block-skeleton__search" />
        </div>
      ) : null}
      <div className="screen-block-skeleton__panel">
        <Skeleton variant="title" width="md" className="screen-block-skeleton__head" />
        <Skeleton variant="row" className="screen-block-skeleton__table-head" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} variant="row" className="screen-block-skeleton__table-row" />
        ))}
      </div>
    </div>
  );
}

/** Канбан / воронка — N колонок как у виджета. */
export function ScreenBlockKanbanSkeleton({
  columns = 4,
  funnel = false
}: {
  columns?: number;
  funnel?: boolean;
}) {
  return (
    <div
      className={`screen-block-skeleton__board ${funnel ? "screen-block-skeleton__board--funnel" : ""}`}
      aria-busy="true"
      aria-label="Загрузка доски"
    >
      <div className={`kanban kanban--skeleton ${funnel ? "kanban--funnel" : ""}`}>
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="kanban-col kanban-col--skeleton">
            <div className="kanban-col__accent" aria-hidden />
            <div className="kanban-col__head">
              <Skeleton variant="text" width="md" />
              <Skeleton variant="circle" className="screen-block-skeleton__menu" />
            </div>
            <div className="kanban-col__body">
              <Skeleton variant="block" className="screen-block-skeleton__card" />
              <Skeleton variant="block" className="screen-block-skeleton__card screen-block-skeleton__card--short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ScreenBlockGateProps = {
  intro?: ReactNode;
  skeleton: ReactNode;
  errorTitle: string;
  forbiddenTitle: string;
  children: ReactNode;
};

/**
 * Phase 7: loading/error/forbidden в layout экрана (не L3 LoadingState по центру).
 */
export function ScreenBlockGate({
  intro,
  skeleton,
  errorTitle,
  forbiddenTitle,
  children
}: ScreenBlockGateProps) {
  const { state } = useScenarioFixtures();
  const [retryCount, setRetryCount] = useState(0);

  if (state.fetchPhase === "loading") {
    return (
      <>
        {intro}
        {skeleton}
      </>
    );
  }

  if (state.fetchPhase === "error") {
    return (
      <>
        {intro}
        <ScreenBlockFetchIssue
          kind="error"
          title={errorTitle}
          {...(state.errorMessage ? { description: state.errorMessage } : {})}
          onRetry={() => setRetryCount((n) => n + 1)}
          mutedContent={skeleton}
        />
        {retryCount > 0 ? (
          <p className="screen-block-fetch__retry-hint mono">Повтор {retryCount}</p>
        ) : null}
      </>
    );
  }

  if (state.fetchPhase === "forbidden") {
    return (
      <>
        {intro}
        <ScreenBlockFetchIssue kind="forbidden" title={forbiddenTitle} mutedContent={skeleton} />
      </>
    );
  }

  return (
    <>
      {intro}
      {children}
    </>
  );
}
