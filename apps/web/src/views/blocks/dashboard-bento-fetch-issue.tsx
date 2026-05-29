"use client";

import { AlertCircle, ShieldAlert } from "lucide-react";

import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/domain/card-panel";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardFetchIssueKind = "error" | "forbidden";

export function DashboardBentoFetchIssue({
  kind,
  message,
  onRetry
}: {
  kind: DashboardFetchIssueKind;
  message?: string;
  onRetry?: () => void;
}) {
  const isError = kind === "error";
  const title = isError ? "Не удалось загрузить дашборд" : "Нет доступа к дашборду";
  const description =
    message ??
    (isError
      ? "Повторите попытку или обратитесь в поддержку, если ошибка повторяется."
      : "Недостаточно прав для просмотра этого раздела. Обратитесь к администратору.");

  return (
    <div className="bento bento--fetch-issue" aria-live="polite">
      {[0, 1].map((key) => (
        <div key={key} className="bento__cell">
          <div
            className={`kpi-accent-tile kpi-accent-tile--${key === 0 ? "warm" : "cool"} kpi-accent-tile--skeleton bento-skeleton__kpi--muted`}
            aria-hidden
          >
            <div className="kpi-accent-tile__bar" />
            <div className="kpi-accent-tile__body">
              <Skeleton variant="text" width="md" />
              <Skeleton variant="title" width="sm" />
            </div>
          </div>
        </div>
      ))}
      {[2, 3].map((key) => (
        <div key={key} className="bento__cell tile tile--metric bento-skeleton__kpi bento-skeleton__kpi--muted">
          <Skeleton variant="text" width="md" />
          <Skeleton variant="title" width="sm" />
        </div>
      ))}

      <div className="bento__cell bento__cell--8">
        <CardPanel title={title} subtitle={isError ? "Ошибка загрузки данных" : "Права доступа"}>
          <BannerInline variant={isError ? "danger" : "warn"} className="dashboard-fetch-issue__banner">
            <div className="dashboard-fetch-issue__banner-body">
              {isError ? (
                <AlertCircle className="dashboard-fetch-issue__icon" aria-hidden />
              ) : (
                <ShieldAlert className="dashboard-fetch-issue__icon" aria-hidden />
              )}
              <div className="dashboard-fetch-issue__copy">
                <p className="dashboard-fetch-issue__title">{title}</p>
                <p className="dashboard-fetch-issue__desc">{description}</p>
              </div>
            </div>
          </BannerInline>
          {isError && onRetry ? (
            <div className="dashboard-fetch-issue__actions">
              <Button variant="secondary" onClick={onRetry}>
                Повторить
              </Button>
            </div>
          ) : null}
        </CardPanel>
      </div>

      <div className="bento__cell bento__cell--4 tile bento-skeleton__panel bento-skeleton__panel--muted">
        <Skeleton variant="title" width="md" />
        <Skeleton variant="row" className="bento-skeleton__row" />
        <Skeleton variant="row" className="bento-skeleton__row" />
      </div>

      <div className="bento__cell bento__cell--8 tile bento-skeleton__panel bento-skeleton__panel--muted">
        <Skeleton variant="title" width="md" />
        <Skeleton variant="row" className="bento-skeleton__table-head" />
        <Skeleton variant="row" className="bento-skeleton__table-row" />
        <Skeleton variant="row" className="bento-skeleton__table-row" />
      </div>

      <div className="bento__cell bento__cell--4 tile bento-skeleton__panel bento-skeleton__panel--muted">
        <Skeleton variant="title" width="md" />
        <Skeleton variant="row" className="bento-skeleton__row" />
      </div>
    </div>
  );
}
