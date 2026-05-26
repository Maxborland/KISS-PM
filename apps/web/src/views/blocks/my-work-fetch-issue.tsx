"use client";

import { AlertCircle, ShieldAlert } from "lucide-react";

import { CardPanel } from "@/components/domain/card-panel";
import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { MyWorkKanbanSkeleton } from "./my-work-kanban-skeleton";

export type MyWorkFetchIssueKind = "error" | "forbidden";

export function MyWorkFetchIssue({
  kind,
  message,
  onRetry
}: {
  kind: MyWorkFetchIssueKind;
  message?: string;
  onRetry?: () => void;
}) {
  const isError = kind === "error";
  const title = isError ? "Не удалось загрузить задачи" : "Нет доступа к разделу";
  const description =
    message ??
    (isError
      ? "Повторите попытку или обратитесь в поддержку."
      : "Недостаточно прав для просмотра «Моя работа».");

  return (
    <div className="my-work__board my-work__board--issue">
      <CardPanel title={title} subtitle="Моя работа" className="my-work__issue-banner u-mb-4">
        <BannerInline variant={isError ? "danger" : "warn"}>
          <div className="my-work__issue-body">
            {isError ? (
              <AlertCircle className="my-work__issue-icon" aria-hidden />
            ) : (
              <ShieldAlert className="my-work__issue-icon" aria-hidden />
            )}
            <div className="my-work__issue-copy">
              <p className="my-work__issue-title">{title}</p>
              <p className="my-work__issue-desc">{description}</p>
            </div>
          </div>
        </BannerInline>
        {isError && onRetry ? (
          <div className="my-work__issue-actions">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Повторить
            </Button>
          </div>
        ) : null}
      </CardPanel>
      <div className="kanban kanban--skeleton kanban--muted" aria-hidden>
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="kanban-col kanban-col--skeleton">
            <Skeleton variant="text" width="md" />
            <Skeleton variant="block" className="my-work-skeleton__card" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Скелетон списка (режим «Список»). */
export function MyWorkListSkeleton() {
  return (
    <div className="my-work__list-skeleton" aria-busy="true" aria-label="Загрузка списка">
      <Skeleton variant="row" className="my-work-skeleton__table-head" />
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} variant="row" className="my-work-skeleton__table-row" />
      ))}
    </div>
  );
}
