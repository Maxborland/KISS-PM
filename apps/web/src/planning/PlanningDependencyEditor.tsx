import type {
  PlanningGanttDependencyRow,
  PlanningGanttDependencyType,
  PlanningGanttIntent,
  PlanningGanttTaskRow
} from "@kiss-pm/planning-gantt-ui";
import { useEffect, useMemo, useState } from "react";

import "./planningWorkspace.css";

export type DependencyDraft = {
  predecessorTaskId: string;
  dependencyType: PlanningGanttDependencyType;
  lagHours: string;
};

export function PlanningDependencyEditor(props: {
  task: PlanningGanttTaskRow | null;
  tasks: readonly PlanningGanttTaskRow[];
  dependencies: readonly PlanningGanttDependencyRow[];
  canManagePlan: boolean;
  isPreviewPending: boolean;
  makeDependencyId: (prefix: string) => string;
  onIntent: (intent: PlanningGanttIntent) => void;
}) {
  const [draft, setDraft] = useState<DependencyDraft | null>(
    props.task ? buildDependencyDraft(props.task, props.tasks, props.dependencies) : null
  );

  useEffect(() => {
    setDraft(props.task ? buildDependencyDraft(props.task, props.tasks, props.dependencies) : null);
  }, [props.task?.id, props.dependencies]);

  const candidates = useMemo(
    () => props.tasks.filter((task) => task.id !== props.task?.id),
    [props.task?.id, props.tasks]
  );

  if (!props.task || !draft) {
    return (
      <section className="planning-side-panel planning-dependency-editor">
        <h3>Связи задачи</h3>
        <p className="muted">Выберите задачу, чтобы управлять предшественниками и successors.</p>
      </section>
    );
  }

  const incoming = props.dependencies.filter((dependency) => dependency.successorTaskId === props.task?.id);
  const outgoing = props.dependencies.filter((dependency) => dependency.predecessorTaskId === props.task?.id);
  const upsertIntent = buildDependencyUpsertIntent(
    draft,
    props.task,
    props.dependencies,
    () => props.makeDependencyId("dep")
  );
  const disabledReason = props.canManagePlan
    ? "Нет изменений для preview"
    : "Нужно право tenant.project_plan.manage";

  return (
    <section className="planning-side-panel planning-dependency-editor">
      <div>
        <h3>Связи задачи</h3>
        <p className="muted">FS/SS/FF/SF редактируются только через backend preview.</p>
      </div>
      <DependencyList
        label="Предшественники"
        dependencies={incoming}
        tasks={props.tasks}
        canManagePlan={props.canManagePlan}
        isPreviewPending={props.isPreviewPending}
        onDelete={(dependencyId) => props.onIntent(buildDependencyDeleteIntent(dependencyId))}
      />
      <DependencyList
        label="Successors"
        dependencies={outgoing}
        tasks={props.tasks}
        canManagePlan={props.canManagePlan}
        isPreviewPending={props.isPreviewPending}
        onDelete={(dependencyId) => props.onIntent(buildDependencyDeleteIntent(dependencyId))}
      />
      <label>
        <span>Предшественник</span>
        <select
          disabled={!props.canManagePlan || candidates.length === 0}
          value={draft.predecessorTaskId}
          onChange={(event) => setDraft({ ...draft, predecessorTaskId: event.currentTarget.value })}
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.wbsCode} {candidate.title}
            </option>
          ))}
        </select>
      </label>
      <div className="planning-field-grid">
        <label>
          <span>Тип связи</span>
          <select
            disabled={!props.canManagePlan}
            value={draft.dependencyType}
            onChange={(event) => setDraft({
              ...draft,
              dependencyType: event.currentTarget.value as PlanningGanttDependencyType
            })}
          >
            {dependencyTypeOptions.map((option) => (
              <option key={option.type} value={option.type}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Lag/lead, ч</span>
          <input
            disabled={!props.canManagePlan}
            inputMode="decimal"
            type="number"
            value={draft.lagHours}
            onChange={(event) => setDraft({ ...draft, lagHours: event.currentTarget.value })}
          />
        </label>
      </div>
      <button
        className="secondary-button compact"
        disabled={!props.canManagePlan || !upsertIntent || props.isPreviewPending}
        title={upsertIntent && props.canManagePlan ? "Preview связи через planning engine" : disabledReason}
        type="button"
        onClick={() => {
          if (upsertIntent) props.onIntent(upsertIntent);
        }}
      >
        Preview связи
      </button>
    </section>
  );
}

export function buildDependencyDraft(
  task: PlanningGanttTaskRow,
  tasks: readonly PlanningGanttTaskRow[],
  dependencies: readonly PlanningGanttDependencyRow[]
): DependencyDraft {
  const incoming = dependencies.find((dependency) => dependency.successorTaskId === task.id);
  const fallbackPredecessor = tasks.find((candidate) => candidate.id !== task.id);
  return {
    predecessorTaskId: incoming?.predecessorTaskId ?? fallbackPredecessor?.id ?? "",
    dependencyType: incoming?.type ?? "FS",
    lagHours: minutesToHoursInput(incoming?.lagMinutes ?? 0)
  };
}

export function buildDependencyUpsertIntent(
  draft: DependencyDraft,
  task: PlanningGanttTaskRow,
  dependencies: readonly PlanningGanttDependencyRow[],
  makeDependencyId: () => string
): PlanningGanttIntent | null {
  if (!draft.predecessorTaskId || draft.predecessorTaskId === task.id) return null;
  const existing = dependencies.find(
    (dependency) =>
      dependency.predecessorTaskId === draft.predecessorTaskId &&
      dependency.successorTaskId === task.id
  );
  const lagMinutes = hoursInputToMinutes(draft.lagHours);
  if (existing && existing.type === draft.dependencyType && existing.lagMinutes === lagMinutes) {
    return null;
  }
  return {
    type: "dependency.upsert",
    id: existing?.id ?? makeDependencyId(),
    predecessorTaskId: draft.predecessorTaskId,
    successorTaskId: task.id,
    dependencyType: draft.dependencyType,
    lagMinutes
  };
}

export function buildDependencyDeleteIntent(dependencyId: string): PlanningGanttIntent {
  return { type: "dependency.delete", dependencyId };
}

function DependencyList(props: {
  label: string;
  dependencies: readonly PlanningGanttDependencyRow[];
  tasks: readonly PlanningGanttTaskRow[];
  canManagePlan: boolean;
  isPreviewPending: boolean;
  onDelete: (dependencyId: string) => void;
}) {
  return (
    <div className="planning-dependency-list">
      <strong>{props.label}</strong>
      {props.dependencies.length === 0 ? (
        <p className="muted">Нет связей.</p>
      ) : (
        <ul>
          {props.dependencies.map((dependency) => (
            <li key={dependency.id}>
              <span>{formatDependency(dependency, props.tasks)}</span>
              <button
                className="secondary-button compact"
                disabled={!props.canManagePlan || props.isPreviewPending}
                title={props.canManagePlan ? "Preview удаления связи" : "Нужно право tenant.project_plan.manage"}
                type="button"
                onClick={() => props.onDelete(dependency.id)}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDependency(
  dependency: PlanningGanttDependencyRow,
  tasks: readonly PlanningGanttTaskRow[]
): string {
  const predecessor = tasks.find((task) => task.id === dependency.predecessorTaskId);
  const successor = tasks.find((task) => task.id === dependency.successorTaskId);
  return [
    predecessor ? `${predecessor.wbsCode} ${predecessor.title}` : dependency.predecessorTaskId,
    dependencyTypeLabel(dependency.type),
    successor ? `${successor.wbsCode} ${successor.title}` : dependency.successorTaskId,
    dependency.lagMinutes === 0 ? "" : minutesToSignedHours(dependency.lagMinutes)
  ].filter(Boolean).join(" ");
}

function dependencyTypeLabel(type: PlanningGanttDependencyType): string {
  return dependencyTypeOptions.find((option) => option.type === type)?.label ?? type;
}

const dependencyTypeOptions: Array<{ type: PlanningGanttDependencyType; label: string }> = [
  { type: "FS", label: "ОН / Finish-to-Start" },
  { type: "SS", label: "НН / Start-to-Start" },
  { type: "FF", label: "ОО / Finish-to-Finish" },
  { type: "SF", label: "НО / Start-to-Finish" }
];

function minutesToHoursInput(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100);
}

function minutesToSignedHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return hours > 0 ? `+${hours}ч` : `${hours}ч`;
}

function hoursInputToMinutes(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 60);
}
