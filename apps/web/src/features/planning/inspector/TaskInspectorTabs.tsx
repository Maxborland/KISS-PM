"use client";

import type { PlanningCommand, TaskType } from "@kiss-pm/domain";
import type { PlanningReadModel } from "@kiss-pm/planning-client";
import { useState } from "react";

import type { PlanningPermissions } from "../hooks/usePlanningPermissions";
import { TaskInspectorDependenciesPanel } from "./TaskInspectorDependenciesPanel";
import { TaskInspectorGeneralPanel } from "./TaskInspectorGeneralPanel";
import { TaskInspectorResourcesPanel } from "./TaskInspectorResourcesPanel";

type InspectorTab = "general" | "dependencies" | "resources";

export function TaskInspectorTabs(props: {
  readModel: PlanningReadModel;
  task: Record<string, unknown>;
  permissions: PlanningPermissions;
  onPreviewCommand: (command: PlanningCommand) => Promise<unknown>;
}) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("general");
  const taskId = String(props.task.id ?? "");
  const taskType = (props.task.taskType as TaskType | undefined) ?? "fixed_units";

  const tabs: Array<{ id: InspectorTab; label: string }> = [
    { id: "general", label: "Общие" },
    { id: "dependencies", label: "Зависимости" },
    { id: "resources", label: "Ресурсы" }
  ];

  return (
    <>
      <div className="planning-inspector__tabs" role="tablist" aria-label="Разделы задачи">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`inspector-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`inspector-panel-${tab.id}`}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" ? (
        <TaskInspectorGeneralPanel
          task={props.task}
          taskId={taskId}
          taskType={taskType}
          permissions={props.permissions}
          onPreviewCommand={props.onPreviewCommand}
        />
      ) : null}
      {activeTab === "dependencies" ? (
        <TaskInspectorDependenciesPanel
          readModel={props.readModel}
          taskId={taskId}
          permissions={props.permissions}
          onPreviewCommand={props.onPreviewCommand}
        />
      ) : null}
      {activeTab === "resources" ? (
        <TaskInspectorResourcesPanel
          readModel={props.readModel}
          taskId={taskId}
          permissions={props.permissions}
          onPreviewCommand={props.onPreviewCommand}
        />
      ) : null}
    </>
  );
}
