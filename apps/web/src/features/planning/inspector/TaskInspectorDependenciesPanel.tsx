"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo, useState } from "react";

import { PlanningSelect } from "../../../components/ui/select";
import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { planningPermissionTitle } from "../hooks/usePlanningPermissions";

export function TaskInspectorDependenciesPanel(props: {
  readModel: PlanningReadModel;
  taskId: string;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const [newSuccessorId, setNewSuccessorId] = useState("");
  const readOnly = !props.permissions.canManageProjectPlan;
  const readOnlyTitle = planningPermissionTitle(props.permissions, "canManageProjectPlan");

  const dependencies = useMemo(() => {
    return props.readModel.authored.dependencies.filter(
      (dependency) =>
        String(dependency.predecessorTaskId) === props.taskId ||
        String(dependency.successorTaskId) === props.taskId
    );
  }, [props.readModel.authored.dependencies, props.taskId]);

  const successorOptions = useMemo(() => {
    const tasks = props.readModel.authored.tasks.filter(
      (candidate) => String(candidate.id) !== props.taskId
    );
    return [
      { value: "", label: "Выберите задачу…" },
      ...tasks.map((candidate) => ({
        value: String(candidate.id),
        label: String(candidate.title ?? candidate.id)
      }))
    ];
  }, [props.readModel.authored.tasks, props.taskId]);

  return (
    <div
      id="inspector-panel-dependencies"
      role="tabpanel"
      aria-labelledby="inspector-tab-dependencies"
      className="planning-inspector__panel"
    >
      {!readOnly ? (
        <div className="planning-inspector__add-row">
          <label className="planning-field">
            <span>Добавить связь FS (преемник)</span>
            <PlanningSelect
              value={newSuccessorId}
              options={successorOptions}
              aria-label="Задача-преемник"
              onChange={setNewSuccessorId}
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!newSuccessorId}
            onClick={() => {
              void props.onPreviewCommand({
                type: "dependency.upsert",
                payload: {
                  id: `dep-${Date.now()}`,
                  predecessorTaskId: props.taskId,
                  successorTaskId: newSuccessorId,
                  dependencyType: "FS",
                  lagMinutes: 0
                }
              });
              setNewSuccessorId("");
            }}
          >
            Добавить FS
          </button>
        </div>
      ) : null}
      {dependencies.length === 0 ? (
        <p className="planning-pane__muted">Нет связей с другими задачами.</p>
      ) : (
        <ul className="planning-inspector-list">
          {dependencies.map((dependency) => {
            const isPredecessor = String(dependency.predecessorTaskId) === props.taskId;
            const otherTaskId = isPredecessor
              ? String(dependency.successorTaskId)
              : String(dependency.predecessorTaskId);
            const otherTask = props.readModel.authored.tasks.find(
              (candidate) => String(candidate.id) === otherTaskId
            );
            return (
              <li key={String(dependency.id)}>
                <span>
                  {isPredecessor ? "→" : "←"} {String(otherTask?.title ?? otherTaskId)} (
                  {String(
                    (dependency as { dependencyType?: string }).dependencyType ??
                      (dependency as { type?: string }).type ??
                      "FS"
                  )}
                  )
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={readOnly}
                  title={readOnly ? readOnlyTitle : "Удалить связь"}
                  onClick={() => {
                    void props.onPreviewCommand({
                      type: "dependency.delete",
                      payload: { dependencyId: String(dependency.id) }
                    });
                  }}
                >
                  Удалить
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
