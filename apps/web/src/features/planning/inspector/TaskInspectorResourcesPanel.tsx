"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo } from "react";

import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { planningPermissionTitle } from "../hooks/usePlanningPermissions";

export function TaskInspectorResourcesPanel(props: {
  readModel: PlanningReadModel;
  taskId: string;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const readOnly = !props.permissions.canManageProjectPlan;
  const readOnlyTitle = planningPermissionTitle(props.permissions, "canManageProjectPlan");

  const assignments = useMemo(() => {
    return props.readModel.authored.assignments.filter(
      (assignment) => String(assignment.taskId) === props.taskId
    );
  }, [props.readModel.authored.assignments, props.taskId]);

  return (
    <div
      id="inspector-panel-resources"
      role="tabpanel"
      aria-labelledby="inspector-tab-resources"
      className="planning-inspector__panel"
    >
      {assignments.length === 0 ? (
        <p className="planning-pane__muted">
          Нет назначений. Добавьте ресурсы на вкладке «Назначения».
        </p>
      ) : (
        <ul className="planning-inspector-list">
          {assignments.map((assignment) => (
            <li key={String(assignment.id)}>
              <span>
                {String(assignment.resourceId)} · {String(assignment.role ?? "executor")} ·{" "}
                {Number(assignment.unitsPermille ?? 1000) / 10}%
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={readOnly}
                title={readOnly ? readOnlyTitle : "Снять назначение"}
                onClick={() => {
                  void props.onPreviewCommand({
                    type: "assignment.delete",
                    payload: { assignmentId: String(assignment.id) }
                  });
                }}
              >
                Снять
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
