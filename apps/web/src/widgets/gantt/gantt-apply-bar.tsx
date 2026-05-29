"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { GanttPreviewState } from "./types";

const LABELS: Record<GanttPreviewState, string> = {
  idle: "Локальные изменения не отправляются на сервер",
  "editing-local": "Редактирование локально · только frontend",
  "preview-pending": "Подготовка предпросмотра… (mock)",
  "preview-ready": "Предпросмотр готов · серверный пересчёт сроков ещё не подключён",
  applying: "Применение… (mock)",
  applied: "Изменения применены локально (mock)",
  error: "Ошибка валидации",
  conflict: "Конфликт версии плана (mock)"
};

export function GanttApplyBar({
  state,
  message,
  schedulingHint,
  onApply,
  onCancel
}: {
  state: GanttPreviewState;
  message?: string;
  schedulingHint?: string;
  onApply?: () => void;
  onCancel?: () => void;
}) {
  const showActions = state === "preview-ready" || state === "preview-pending";

  const isQuiet = state === "idle" || state === "editing-local" || state === "applied";

  return (
    <div
      className={cn("gantt2__apply-bar", `gantt2__apply-bar--${state}`, isQuiet && "gantt2__apply-bar--quiet")}
      role="status"
      aria-live="polite"
    >
      <div className="gantt2__apply-bar-text">
        {isQuiet ? <span>{LABELS[state]}</span> : <strong>{LABELS[state]}</strong>}
        {message ? <span className="gantt2__apply-bar-detail"> · {message}</span> : null}
        {schedulingHint ? <span className="gantt2__apply-bar-hint"> · {schedulingHint}</span> : null}
      </div>
      {showActions ? (
        <div className="gantt2__apply-bar-actions">
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            Отменить предпросмотр
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={onApply} disabled={state === "preview-pending"}>
            Применить (mock)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
