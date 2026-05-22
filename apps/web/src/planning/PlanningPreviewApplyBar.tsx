import type { PlanningCommand, ValidationIssue } from "@kiss-pm/domain";

import type { PlanningCommandPreviewResponse } from "./planningApi";
import "./planningWorkspace.css";

export type PlanningPreviewState = {
  command: PlanningCommand;
  preview: PlanningCommandPreviewResponse;
};

export function PlanningPreviewApplyBar(props: {
  previewState: PlanningPreviewState | null;
  previewError: string;
  applyError: string;
  isPreviewPending: boolean;
  isApplyPending: boolean;
  canApply: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  if (props.isPreviewPending) {
    return (
      <div className="planning-preview-bar" aria-live="polite">
        <strong>Готовим preview команды...</strong>
        <span>Backend planning engine считает последствия изменения.</span>
      </div>
    );
  }

  if (props.previewError) {
    return (
      <div className="planning-preview-bar danger" role="alert">
        <strong>Preview недоступен</strong>
        <span>{props.previewError}</span>
      </div>
    );
  }

  if (!props.previewState) return null;

  const blockingIssues = props.previewState.preview.validationIssues.filter(
    (issue) => issue.severity === "error"
  );
  const canApply = props.canApply && blockingIssues.length === 0;

  return (
    <div className={canApply ? "planning-preview-bar" : "planning-preview-bar warning"} aria-live="polite">
      <div>
        <strong>{commandLabel(props.previewState.command.type)}</strong>
        <span>
          Версия {props.previewState.preview.auditPreview.planVersionBefore}
          {" -> "}
          {props.previewState.preview.auditPreview.planVersionAfter}
          {blockingIssues.length > 0 ? `, блокирующих замечаний: ${blockingIssues.length}` : ""}
        </span>
      </div>
      {props.applyError ? <p className="error">{props.applyError}</p> : null}
      <div className="planning-preview-actions">
        <button className="secondary-button compact" disabled={props.isApplyPending} type="button" onClick={props.onCancel}>
          Отменить
        </button>
        <button
          className="primary-button compact"
          disabled={!canApply || props.isApplyPending}
          title={canApply ? "Применить команду через planning engine" : "Нельзя применить: нет права или есть blocking validation"}
          type="button"
          onClick={props.onApply}
        >
          {props.isApplyPending ? "Применяем..." : "Применить"}
        </button>
      </div>
    </div>
  );
}

export function commandLabel(commandType: PlanningCommand["type"]): string {
  const labels: Record<PlanningCommand["type"], string> = {
    "task.create": "Создание задачи",
    "task.update_identity": "Переименование задачи",
    "task.update_schedule": "Изменение дат задачи",
    "task.update_work_model": "Изменение трудоемкости",
    "task.update_status": "Изменение статуса",
    "task.move_wbs": "Изменение WBS",
    "task.delete_or_archive": "Удаление или архивирование задачи",
    "dependency.upsert": "Изменение зависимости",
    "dependency.delete": "Удаление зависимости",
    "assignment.upsert": "Назначение ресурса",
    "assignment.delete": "Снятие назначения",
    "baseline.capture": "Фиксация baseline",
    "calendar.exception.upsert": "Исключение календаря",
    "constraint.update": "Изменение constraint",
    "resource.reserve": "Резерв ресурса",
    "risk.accept_overload": "Принятие перегруза",
    "project.deadline.move": "Перенос deadline"
  };
  return labels[commandType];
}

export function issueSummary(issues: readonly ValidationIssue[]): string {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  if (errors > 0) return `${errors} blocking`;
  if (warnings > 0) return `${warnings} предупреждений`;
  return "без замечаний";
}
