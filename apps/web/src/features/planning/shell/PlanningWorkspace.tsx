"use client";

import type { PlanningCommand } from "@kiss-pm/domain";
import { useMemo, useState, useCallback } from "react";

import type { PlanningProjectTab } from "../../../workspacePathIds";
import { getProjectPlanningPath } from "../../../workspacePathIds";
import { SectionFeedback } from "../../../components/workspace-ui";
import { AssignmentsMatrix } from "../assignments/AssignmentsMatrix";
import { ProjectAuditPane } from "../audit/ProjectAuditPane";
import { BaselinePane } from "../baseline/BaselinePane";
import { CalendarsPane } from "../calendars/CalendarsPane";
import { CustomFieldDefinitionsPane } from "../customFields/CustomFieldDefinitionsPane";
import { buildCommandsFromTsvPaste } from "../grid/clipboard/planningClipboard";
import { SchedulePane } from "../schedule/SchedulePane";
import { usePlan } from "../hooks/usePlan";
import { usePlanMutation } from "../hooks/usePlanMutation";
import { usePlanningPermissions } from "../hooks/usePlanningPermissions";
import { TaskInspector } from "../inspector/TaskInspector";
import "../planning.css";
import {
  ResourcesPane,
  type ResourcesPaneWorkspacePosition,
  type ResourcesPaneWorkspaceUser
} from "../resources/ResourcesPane";
import { ScenariosPane } from "../scenarios/ScenariosPane";
import { ProjectSettingsPane } from "../settings/ProjectSettingsPane";
import { NarrowFallback } from "./NarrowFallback";
import { PlanningRemoteBanner } from "./PlanningRemoteBanner";
import { PreviewApplyBar } from "./PreviewApplyBar";
import { ProjectPlanningHeader } from "./ProjectPlanningHeader";
import { useNarrowViewport } from "./useNarrowViewport";

export function PlanningWorkspace(props: {
  projectId: string;
  projectTitle: string;
  activeTab: PlanningProjectTab;
  permissions: readonly string[];
  canRead: boolean;
  defaultStatusId: string;
  workspaceUsers: ResourcesPaneWorkspaceUser[];
  workspacePositions: ResourcesPaneWorkspacePosition[];
  onBack: () => void;
  onNavigateTab: (tab: PlanningProjectTab) => void;
}) {
  const planningPermissions = usePlanningPermissions(props.permissions);
  const mutation = usePlanMutation(props.projectId);
  const [remoteBannerMessage, setRemoteBannerMessage] = useState<string | null>(null);
  const onRemotePlanChange = useCallback(() => {
    mutation.markPreviewStale();
    setRemoteBannerMessage("План обновлён на сервере. Пересчитайте превью или отмените локальные изменения.");
  }, [mutation.markPreviewStale]);
  const planQuery = usePlan(props.projectId, props.canRead && planningPermissions.canReadProjectPlan, {
    onRemotePlanChange
  });
  const isNarrow = useNarrowViewport();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [ganttZoom, setGanttZoom] = useState<"day" | "week" | "month">("day");
  const readModel = mutation.displayReadModel ?? planQuery.data;
  const wbsIndexToTaskId = useMemo(() => {
    const map = new Map<number, string>();
    (readModel?.authored.tasks ?? []).forEach((task, index) => {
      map.set(index + 1, String(task.id));
    });
    return map;
  }, [readModel]);

  if (!props.canRead || !planningPermissions.canReadProjectPlan) {
    return (
      <SectionFeedback
        state={{ canRead: false, isLoading: false, error: null }}
        emptyLabel="Нет права на чтение плана проекта."
      />
    );
  }

  if (planQuery.isLoading && !readModel) {
    return <SectionFeedback state={{ canRead: true, isLoading: true, error: null }} emptyLabel="" />;
  }

  if (planQuery.error) {
    return (
      <SectionFeedback
        state={{
          canRead: true,
          isLoading: false,
          error: planQuery.error instanceof Error ? planQuery.error.message : "Ошибка загрузки"
        }}
        emptyLabel=""
      />
    );
  }

  if (isNarrow && props.activeTab !== "audit") {
    return <NarrowFallback />;
  }

  const handlePaste = async (event: React.ClipboardEvent) => {
    if (props.activeTab !== "schedule") return;
    const tsv = event.clipboardData.getData("text/plain");
    if (!tsv.includes("\t")) return;
    event.preventDefault();
    const commands = buildCommandsFromTsvPaste(tsv, props.projectId, props.defaultStatusId, wbsIndexToTaskId);
    if (commands.length === 0) return;
    await mutation.applyBatch(commands);
  };

  const scheduleContent = (
    <>
      <SchedulePane
        readModel={readModel}
        projectId={props.projectId}
        defaultStatusId={props.defaultStatusId}
        permissions={planningPermissions}
        previewPending={mutation.store.applyBarState === "preview-pending"}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
        onPreviewCommand={mutation.preview}
        onApplyBatch={mutation.applyBatch}
        onUndoApplied={() => void mutation.undoApplied()}
        onRedoApplied={() => void mutation.redoApplied()}
        onDeleteRows={async (taskIds) => {
          await mutation.applyBatch(
            taskIds.map(
              (taskId): PlanningCommand => ({
                type: "task.delete_or_archive",
                payload: { taskId, mode: "delete" }
              })
            )
          );
        }}
        onUndoPending={mutation.undoPending}
        ganttZoom={ganttZoom}
        onGanttZoomChange={setGanttZoom}
      />
      <TaskInspector
        readModel={readModel}
        selectedTaskId={selectedTaskId}
        permissions={planningPermissions}
        onPreviewCommand={mutation.preview}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
  );

  return (
    <div
      className="planning-workspace"
      data-testid="planning-workspace"
      onPaste={(event) => void handlePaste(event)}
    >
      <ProjectPlanningHeader
        projectId={props.projectId}
        projectTitle={props.projectTitle}
        planVersion={readModel?.planVersion ?? null}
        conflict={mutation.store.applyBarState === "conflict"}
        activeTab={props.activeTab}
        onBack={props.onBack}
      />
      <PlanningRemoteBanner
        message={remoteBannerMessage}
        onDismiss={() => setRemoteBannerMessage(null)}
      />
      {props.activeTab === "schedule" ? scheduleContent : null}
      {props.activeTab === "resources" ? (
        <ResourcesPane
          readModel={readModel}
          projectId={props.projectId}
          permissions={planningPermissions}
          workspaceUsers={props.workspaceUsers}
          workspacePositions={props.workspacePositions}
          onOpenAssignments={() => props.onNavigateTab("assignments")}
        />
      ) : null}
      {props.activeTab === "assignments" ? (
        <AssignmentsMatrix
          readModel={readModel}
          permissions={planningPermissions}
          onPreviewCommand={mutation.preview}
        />
      ) : null}
      {props.activeTab === "calendars" ? (
        <CalendarsPane
          readModel={readModel}
          permissions={planningPermissions}
          onPreviewCommand={mutation.preview}
        />
      ) : null}
      {props.activeTab === "scenarios" ? (
        <ScenariosPane
          projectId={props.projectId}
          readModel={readModel}
          planVersion={readModel?.planVersion ?? 1}
          canPreview={planningPermissions.canPreviewPlanningScenarios}
          canApply={planningPermissions.canApplyPlanningScenarios}
          onScenarioApplied={mutation.handleConflict}
        />
      ) : null}
      {props.activeTab === "baseline" ? (
        <BaselinePane
          projectId={props.projectId}
          readModel={readModel}
          canCapture={planningPermissions.canManageProjectBaselines}
          onPreviewCommand={mutation.preview}
        />
      ) : null}
      {props.activeTab === "audit" ? (
        <ProjectAuditPane
          projectId={props.projectId}
          canRead={planningPermissions.canReadAuditEvents}
        />
      ) : null}
      {props.activeTab === "settings" ? (
        <>
          <ProjectSettingsPane
            projectId={props.projectId}
            readModel={readModel}
            permissions={planningPermissions}
            onPreviewCommand={mutation.preview}
          />
          <CustomFieldDefinitionsPane
            selectedTaskId={selectedTaskId}
            taskCustomFields={
              selectedTaskId
                ? ((readModel?.authored.tasks.find(
                    (candidate) => String(candidate.id) === selectedTaskId
                  ) as { customFields?: Record<string, unknown> } | undefined)?.customFields ?? {})
                : {}
            }
            canManage={planningPermissions.canManageProjectPlan}
            onPreviewCommand={mutation.preview}
          />
        </>
      ) : null}
      <PreviewApplyBar
        state={mutation.store.applyBarState}
        errorMessage={mutation.store.errorMessage}
        previewStale={mutation.previewStale}
        permissions={planningPermissions}
        onApply={() => void mutation.apply()}
        onCancel={mutation.cancelPreview}
        isApplying={mutation.isApplying}
      />
      <a className="visually-hidden" href={getProjectPlanningPath(props.projectId, "schedule")}>
        schedule
      </a>
    </div>
  );
}
