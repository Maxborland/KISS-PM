"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useMemo } from "react";

import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { TaskInspectorTabs } from "./TaskInspectorTabs";

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

  if (!task || !props.readModel) {
    return (
      <aside className="planning-inspector" data-testid="planning-inspector">
        <p>Выберите задачу в таблице WBS.</p>
      </aside>
    );
  }

  return (
    <aside className="planning-inspector" data-testid="planning-inspector" id="inspector">
      <header className="planning-inspector__header">
        <h2>Задача</h2>
        <button className="secondary-button" type="button" onClick={props.onClose}>
          Esc
        </button>
      </header>
      <TaskInspectorTabs
        readModel={props.readModel}
        task={task as Record<string, unknown>}
        permissions={props.permissions}
        onPreviewCommand={props.onPreviewCommand}
      />
    </aside>
  );
}
