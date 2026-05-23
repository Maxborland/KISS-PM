"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo } from "react";

import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { planningPermissionTitle } from "../hooks/usePlanningPermissions";

export function TaskInspector(props: {
  readModel: PlanningReadModel | undefined;
  selectedTaskId: string | null;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
  onClose: () => void;
}) {
  const task = useMemo(() => {
    if (!props.readModel || !props.selectedTaskId) return null;
    return props.readModel.authored.tasks.find(
      (candidate) => String(candidate.id) === props.selectedTaskId
    );
  }, [props.readModel, props.selectedTaskId]);

  if (!task) {
    return (
      <aside className="planning-inspector" data-testid="planning-inspector">
        <p>Выберите задачу в таблице WBS.</p>
      </aside>
    );
  }

  const readOnly = !props.permissions.canManageProjectPlan;
  const readOnlyTitle = planningPermissionTitle(props.permissions, "canManageProjectPlan");

  return (
    <aside className="planning-inspector" data-testid="planning-inspector" id="inspector">
      <header className="planning-inspector__header">
        <h2>Задача</h2>
        <button className="secondary-button" type="button" onClick={props.onClose}>
          Esc
        </button>
      </header>
      <div className="planning-inspector__tabs" role="tablist">
        <span className="is-active">Общие</span>
        <span>Зависимости</span>
        <span>Ресурсы</span>
      </div>
      <label className="planning-field">
        <span>Название</span>
        <input
          defaultValue={String(task.title ?? "")}
          readOnly={readOnly}
          title={readOnlyTitle}
          onBlur={(event) => {
            if (readOnly || event.target.value === task.title) return;
            void props.onPreviewCommand({
              type: "task.update_identity",
              payload: { taskId: String(task.id), title: event.target.value }
            });
          }}
        />
      </label>
      <label className="planning-field">
        <span>Прогресс, %</span>
        <input
          type="number"
          min={0}
          max={100}
          defaultValue={Number(task.percentComplete ?? 0)}
          readOnly={readOnly}
          title={readOnlyTitle}
          onBlur={(event) => {
            if (readOnly) return;
            void props.onPreviewCommand({
              type: "task.update_progress",
              payload: {
                taskId: String(task.id),
                percentComplete: Number(event.target.value)
              }
            });
          }}
        />
      </label>
    </aside>
  );
}
