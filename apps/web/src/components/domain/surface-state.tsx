"use client";

import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/lib/cn";

export type SurfaceStatus = "loading" | "error" | "forbidden" | "empty" | "ready";

/**
 * Статус SurfaceState из LoadStatus доменного хука + готовности данных.
 * Семантика прежних рукописных лестниц: loading-с-данными остаётся ready
 * (reload не гасит контент), отсутствие данных вне loading — error.
 */
export function surfaceStatusOf(
  status: "loading" | "ready" | "error" | "forbidden",
  hasData: boolean
): SurfaceStatus {
  if (status === "forbidden") return "forbidden";
  if (status === "error") return "error";
  if (!hasData) return status === "loading" ? "loading" : "error";
  return "ready";
}

export type SurfaceStateProps = {
  /** Текущий статус поверхности. "ready" рендерит children. */
  status: SurfaceStatus;
  /** Готовый контент (показывается при status === "ready"). */
  children: ReactNode;
  /** Сырой код/текст ошибки (для status === "error"). */
  error?: string | null;
  /** Повтор запроса (кнопка в ErrorState). */
  onRetry?: () => void;
  /** Форматтер кода ошибки в человекочитаемый текст (напр. authErr/crmErr/commsErr). */
  errorFormat?: (code?: string) => string;
  /** Мин-высота контейнера состояния (как у инлайн-дублей). */
  height?: string;
  /** Компактный вертикальный fallback (узкий экран): меньше высота, без иллюстрации. */
  narrow?: boolean;
  loadingLabel?: string;
  /** Заголовок/описание для error (по умолчанию «Не удалось загрузить»). */
  errorTitle?: string;
  empty?: { title: string; description?: string; action?: ReactNode };
  forbidden?: { title?: string; description?: string; action?: ReactNode };
  className?: string;
};

/**
 * SurfaceState — единый переключатель состояний поверхности (loading/error/forbidden/empty/ready)
 * поверх примитивов components/ui/*. Заменяет инлайн-дубли loading/error в delivery/crm/comms-
 * поверхностях: даёт role="alert" (через ErrorState), человекочитаемые коды (errorFormat) и единый
 * скелетон вместо разнобоя спиннеров. `narrow` включает компактный fallback для узких экранов.
 */
export function SurfaceState({
  status,
  children,
  error,
  onRetry,
  errorFormat,
  height = "420px",
  narrow = false,
  loadingLabel,
  errorTitle = "Не удалось загрузить",
  empty,
  forbidden,
  className
}: SurfaceStateProps) {
  // ready-контент мягко проявляется (один раз на переход в ready), вместо резкого снапа.
  // Обёртка-блок безопасна: SurfaceState всегда стоит в блочном потоке контента фрейма.
  if (status === "ready") return <div className="anim-fade-in">{children}</div>;

  const wrap = (node: ReactNode) => (
    <div
      className={cn(
        "anim-fade-in grid place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4",
        narrow && "state-narrow",
        className
      )}
      style={{ minHeight: narrow ? "240px" : height }}
    >
      <div className="w-full max-w-[480px]">{node}</div>
    </div>
  );

  if (status === "loading") return wrap(<LoadingState {...(loadingLabel ? { label: loadingLabel } : {})} />);
  if (status === "forbidden") {
    return wrap(
      <ForbiddenState
        title={forbidden?.title ?? "Доступ ограничен"}
        description={forbidden?.description ?? "У вас нет прав на просмотр этого раздела."}
        {...(forbidden?.action ? { action: forbidden.action } : {})}
      />
    );
  }
  if (status === "empty") {
    return wrap(
      <EmptyState
        title={empty?.title ?? "Пока пусто"}
        {...(empty?.description ? { description: empty.description } : {})}
        {...(empty?.action ? { action: empty.action } : {})}
      />
    );
  }
  // error
  const description = errorFormat ? errorFormat(error ?? undefined) : error ?? "Неизвестная ошибка";
  return wrap(<ErrorState title={errorTitle} description={description} {...(onRetry ? { onRetry } : {})} />);
}
