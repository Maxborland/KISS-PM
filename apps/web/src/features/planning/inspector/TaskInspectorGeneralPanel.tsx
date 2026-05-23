"use client";

import type { PlanningCommand, TaskType } from "@kiss-pm/domain";

import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { planningPermissionTitle } from "../hooks/usePlanningPermissions";

export function TaskInspectorGeneralPanel(props: {
  task: Record<string, unknown>;
  taskId: string;
  taskType: TaskType;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const readOnly = !props.permissions.canManageProjectPlan;
  const readOnlyTitle = planningPermissionTitle(props.permissions, "canManageProjectPlan");

  return (
    <div
      id="inspector-panel-general"
      role="tabpanel"
      aria-labelledby="inspector-tab-general"
      className="planning-inspector__panel"
    >
      <label className="planning-field">
        <span>Название</span>
        <input
          defaultValue={String(props.task.title ?? "")}
          readOnly={readOnly}
          title={readOnlyTitle}
          onBlur={(event) => {
            if (readOnly || event.target.value === props.task.title) return;
            void props.onPreviewCommand({
              type: "task.update_identity",
              payload: { taskId: props.taskId, title: event.target.value }
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
          defaultValue={Number(props.task.percentComplete ?? 0)}
          readOnly={readOnly}
          title={readOnlyTitle}
          onBlur={(event) => {
            if (readOnly) return;
            void props.onPreviewCommand({
              type: "task.update_progress",
              payload: {
                taskId: props.taskId,
                percentComplete: Number(event.target.value)
              }
            });
          }}
        />
      </label>
      <label className="planning-field">
        <span>Трудозатраты, мин</span>
        <input
          type="number"
          min={0}
          defaultValue={Number(props.task.workMinutes ?? 0)}
          readOnly={readOnly}
          title={readOnlyTitle}
          onBlur={(event) => {
            if (readOnly) return;
            void props.onPreviewCommand({
              type: "task.update_work_model",
              payload: {
                taskId: props.taskId,
                taskType: props.taskType,
                effortDriven: Boolean(props.task.effortDriven ?? false),
                durationMinutes:
                  props.task.durationMinutes === null || props.task.durationMinutes === undefined
                    ? null
                    : Number(props.task.durationMinutes),
                workMinutes: Number(event.target.value)
              }
            });
          }}
        />
      </label>
      <label className="planning-field">
        <span>Длительность, мин</span>
        <input
          type="number"
          min={0}
          defaultValue={Number(props.task.durationMinutes ?? 0)}
          readOnly={readOnly}
          title={readOnlyTitle}
          onBlur={(event) => {
            if (readOnly) return;
            void props.onPreviewCommand({
              type: "task.update_work_model",
              payload: {
                taskId: props.taskId,
                taskType: props.taskType,
                effortDriven: Boolean(props.task.effortDriven ?? false),
                durationMinutes: Number(event.target.value),
                workMinutes: Number(props.task.workMinutes ?? 0)
              }
            });
          }}
        />
      </label>
    </div>
  );
}
