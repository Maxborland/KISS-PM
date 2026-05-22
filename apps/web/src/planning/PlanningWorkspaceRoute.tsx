import { PlanningGanttSurface, type PlanningGanttIntent } from "@kiss-pm/planning-gantt-ui";
import { Baseline, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { ApiError } from "../api";
import type { TaskStatusDefinition } from "../api";
import { SectionFeedback } from "../components/workspace-ui";
import type { SectionState } from "../workspaceShellState";
import { mapPlanningGanttIntentToCommand } from "./planningCommandIntentMapper";
import type { PlanningCommandPreviewResponse } from "./planningApi";
import { usePlanningCommandMutations, usePlanningReadModelQuery } from "./planningQueries";
import { mapPlanningReadModelToGanttViewModel } from "./planningReadModelMapper";
import {
  canApplyPlanningCommand,
  canReadPlanningWorkspace,
  planningCapabilitiesFromPermissions,
  planningReadDisabledReason
} from "./planningPermissions";
import { PlanningPreviewApplyBar, type PlanningPreviewState } from "./PlanningPreviewApplyBar";
import { PlanningValidationPanel } from "./PlanningValidationPanel";
import { ResourceLoadSummary } from "./ResourceLoadSummary";
import "./planningWorkspace.css";

export function PlanningWorkspaceRoute(props: {
  projectId: string;
  permissions: readonly string[];
  taskStatuses: readonly TaskStatusDefinition[];
  sectionState: SectionState;
  onChanged: (message: string) => void;
}) {
  const canRead = props.sectionState.canRead && canReadPlanningWorkspace(props.permissions);
  const readDisabledReason = planningReadDisabledReason(props.permissions);
  const readModelQuery = usePlanningReadModelQuery(props.projectId, canRead);
  const commandMutations = usePlanningCommandMutations(props.projectId);
  const [previewState, setPreviewState] = useState<PlanningPreviewState | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [applyError, setApplyError] = useState("");
  const readModel = canRead ? readModelQuery.data : undefined;
  const capabilities = useMemo(
    () => planningCapabilitiesFromPermissions(props.permissions),
    [props.permissions]
  );
  const viewModel = useMemo(
    () => readModel ? mapPlanningReadModelToGanttViewModel(readModel) : null,
    [readModel]
  );
  const defaultStatusId = props.taskStatuses.find((status) => status.status === "active")?.id;
  const canPreviewTaskCreate =
    capabilities.canManagePlan &&
    Boolean(readModel) &&
    Boolean(defaultStatusId) &&
    !commandMutations.previewCommand.isPending;
  const canPreviewBaseline =
    capabilities.canManageBaseline &&
    Boolean(readModel) &&
    !commandMutations.previewCommand.isPending;
  const taskCreateDisabledReason = !capabilities.canManagePlan
    ? "Нужно право tenant.project_plan.manage"
    : !defaultStatusId
      ? "Нет активного task status для новой задачи"
      : "Создать задачу через preview/apply";

  async function previewIntent(intent: PlanningGanttIntent) {
    if (!readModel || !defaultStatusId) return;

    setPreviewError("");
    setApplyError("");
    const command = mapPlanningGanttIntentToCommand(intent, {
      projectId: props.projectId,
      defaultStatusId,
      defaultStart: readModel.project.plannedStart,
      defaultFinish: readModel.project.plannedStart,
      defaultWorkMinutes: 480,
      makeId: (prefix) => `${prefix}-${crypto.randomUUID()}`
    });

    try {
      const preview = await commandMutations.previewCommand.mutateAsync({
        command,
        clientPlanVersion: readModel.planVersion
      });
      setPreviewState({ command, preview });
    } catch (error) {
      setPreviewState(null);
      setPreviewError(errorMessage(error));
    }
  }

  async function applyPreview() {
    if (!readModel || !previewState) return;

    setApplyError("");
    try {
      await commandMutations.applyCommand.mutateAsync({
        command: previewState.command,
        clientPlanVersion: readModel.planVersion
      });
      setPreviewState(null);
      props.onChanged("Команда планирования применена и read model обновлена.");
    } catch (error) {
      setApplyError(errorMessage(error));
    }
  }

  const issues = previewState?.preview.validationIssues ?? readModel?.validationIssues ?? [];
  const afterPreview = previewState?.preview.after;
  const displayedViewModel = afterPreview
    ? mapPlanningReadModelToGanttViewModel(afterPreview)
    : viewModel;

  return (
    <section className="planning-workspace" aria-label="Планирование проекта">
      <header className="planning-workspace-header">
        <div>
          <p className="eyebrow">Planning engine</p>
          <h3>График проекта</h3>
          <p>
            Единый read model для WBS, Gantt, baseline и ресурсной загрузки.
          </p>
        </div>
        <div className="planning-toolbar">
          <button
            className="secondary-button compact"
            disabled={!canRead || readModelQuery.isFetching}
            title={canRead ? "Обновить planning read model" : readDisabledReason ?? "Planning read model недоступен"}
            type="button"
            onClick={() => void readModelQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" size={14} />
            Обновить
          </button>
          <button
            className="primary-button compact"
            disabled={!canPreviewTaskCreate}
            title={taskCreateDisabledReason}
            type="button"
            onClick={() => void previewIntent({ type: "task.create", parentTaskId: null, insertAfterTaskId: null })}
          >
            <Plus aria-hidden="true" size={14} />
            Задача
          </button>
          <button
            className="secondary-button compact"
            disabled={!canPreviewBaseline}
            title={capabilities.canManageBaseline ? "Зафиксировать baseline через preview/apply" : "Нужно право tenant.project_baselines.manage"}
            type="button"
            onClick={() => void previewIntent({ type: "baseline.capture", label: "Baseline" })}
          >
            <Baseline aria-hidden="true" size={14} />
            Baseline
          </button>
        </div>
      </header>
      {readDisabledReason ? (
        <p className="empty-state">{readDisabledReason}</p>
      ) : (
        <SectionFeedback
          state={{
            ...props.sectionState,
            canRead,
            isLoading: readModelQuery.isFetching && !readModel,
            error: readModelQuery.error ? "Не удалось загрузить planning read model." : props.sectionState.error
          }}
          emptyLabel="Планирование проекта недоступно."
        />
      )}
      <PlanningPreviewApplyBar
        previewState={previewState}
        previewError={previewError}
        applyError={applyError}
        isPreviewPending={commandMutations.previewCommand.isPending}
        isApplyPending={commandMutations.applyCommand.isPending}
        canApply={previewState ? canApplyPlanningCommand(previewState.command, props.permissions) : false}
        onApply={() => void applyPreview()}
        onCancel={() => {
          setPreviewState(null);
          setPreviewError("");
          setApplyError("");
        }}
      />
      {displayedViewModel && readModel ? (
        <div className="planning-workspace-grid">
          <div className="planning-main-surface">
            <div className="planning-version-row">
              <span className="toolbar-chip">planVersion {displayedViewModel.planVersion}</span>
              <span className="toolbar-chip">{displayedViewModel.engineVersion}</span>
              {previewState ? <span className="toolbar-chip">preview after-state</span> : null}
            </div>
            <PlanningGanttSurface
              viewModel={displayedViewModel}
              capabilities={capabilities}
              onIntent={(intent) => void previewIntent(intent)}
            />
          </div>
          <aside className="planning-side-column">
            <PlanningValidationPanel issues={issues} />
            <ResourceLoadSummary readModel={afterPreview ?? readModel} />
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "plan_version_conflict") {
      return "Версия плана устарела. Обновите read model перед повторной попыткой.";
    }
    if (error.code === "permission_missing") return "Недостаточно прав для этой команды.";
    if (error.code === "planning_precondition_failed") return "Команда не прошла precondition проверки.";
    return `Backend вернул ${error.code}.`;
  }
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить planning команду.";
}
