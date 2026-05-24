"use client";

import type { ApplyBarState } from "../hooks/planMutationState";
import { planningPermissionTitle, type PlanningPermissions } from "../hooks/usePlanningPermissions";

export function PreviewApplyBar(props: {
  state: ApplyBarState;
  errorMessage: string | null;
  previewStale?: boolean;
  permissions: PlanningPermissions;
  onApply: () => void;
  onCancel: () => void;
  isApplying: boolean;
}) {
  if (props.state === "idle") return null;

  const manageTitle = planningPermissionTitle(props.permissions, "canManageProjectPlan");

  return (
    <div
      className={`planning-apply-bar planning-apply-bar--${props.state}`}
      data-testid="planning-apply-bar"
      role="region"
      aria-label="Превью изменений плана"
    >
      <div className="planning-apply-bar__message">
        {props.previewStale && props.state === "preview-ready" ? (
          <span className="planning-apply-bar__stale">
            План на сервере изменился — пересчитайте превью или отмените изменения.
          </span>
        ) : null}
        {props.state === "preview-pending" && "Считаем превью…"}
        {props.state === "preview-ready" &&
          (props.previewStale ? "Превью устарело" : "Есть несохранённые изменения плана")}
        {props.state === "applying" && "Применяем…"}
        {props.state === "applied" && "Изменения сохранены, аудит записан"}
        {props.state === "conflict" && (props.errorMessage ?? "Конфликт версии плана")}
        {props.state === "error" && (props.errorMessage ?? "Ошибка изменения плана")}
      </div>
      <div className="planning-apply-bar__actions">
        {(props.state === "preview-ready" || props.state === "preview-pending") && (
          <button className="secondary-button" type="button" onClick={props.onCancel}>
            Отмена
          </button>
        )}
        {props.state === "preview-ready" && (
          <button
            className="primary-button"
            type="button"
            title={
              props.previewStale
                ? "Сначала отмените или пересчитайте превью после изменения плана на сервере"
                : manageTitle
            }
            disabled={
              !props.permissions.canManageProjectPlan || props.isApplying || Boolean(props.previewStale)
            }
            onClick={props.onApply}
          >
            Применить
          </button>
        )}
      </div>
    </div>
  );
}
