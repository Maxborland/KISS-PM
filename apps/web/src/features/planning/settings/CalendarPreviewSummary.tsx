"use client";

import type { PlanningPreviewResponse } from "@kiss-pm/planning-client";

export function CalendarPreviewSummary(props: { preview: PlanningPreviewResponse | null }) {
  if (!props.preview) return null;

  const summary = summarizeFinishDeltas(props.preview);

  return (
    <div className="calendar-preview-summary" data-testid="calendar-preview-summary">
      <strong>Превью смены календаря</strong>
      <span className="planning-pane__muted">
        Изменено задач: {summary.changedTaskCount} из {summary.totalTaskCount}
      </span>
      {summary.maxFinishShiftDays !== null ? (
        <span className="planning-pane__muted">
          Максимальный сдвиг финиша: {summary.maxFinishShiftDays} дн
        </span>
      ) : null}
      {summary.changedTaskCount === 0 ? (
        <span className="planning-pane__muted">Финиш задач не изменился.</span>
      ) : null}
    </div>
  );
}

function summarizeFinishDeltas(preview: PlanningPreviewResponse): {
  changedTaskCount: number;
  totalTaskCount: number;
  maxFinishShiftDays: number | null;
} {
  const beforeTasks = ((preview.before.calculatedPlan.tasks as Array<Record<string, unknown>>) ?? []).reduce<
    Map<string, string | null>
  >((acc, task) => {
    acc.set(String(task.id), normalizeIsoDate(task.calculatedFinish ?? task.plannedFinish));
    return acc;
  }, new Map());
  const afterTasks = ((preview.after.calculatedPlan.tasks as Array<Record<string, unknown>>) ?? []) as Array<
    Record<string, unknown>
  >;
  let changedTaskCount = 0;
  let maxFinishShiftDays: number | null = null;
  for (const task of afterTasks) {
    const id = String(task.id);
    const beforeFinish = beforeTasks.get(id) ?? null;
    const afterFinish = normalizeIsoDate(task.calculatedFinish ?? task.plannedFinish);
    if (beforeFinish === afterFinish) continue;
    changedTaskCount += 1;
    const delta = diffDays(beforeFinish, afterFinish);
    if (delta !== null) {
      const absDelta = Math.abs(delta);
      if (maxFinishShiftDays === null || absDelta > maxFinishShiftDays) {
        maxFinishShiftDays = absDelta;
      }
    }
  }
  return {
    changedTaskCount,
    totalTaskCount: afterTasks.length,
    maxFinishShiftDays
  };
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10) return null;
  return value.slice(0, 10);
}

function diffDays(beforeIso: string | null, afterIso: string | null): number | null {
  if (!beforeIso || !afterIso) return null;
  const beforeMs = Date.parse(`${beforeIso}T00:00:00Z`);
  const afterMs = Date.parse(`${afterIso}T00:00:00Z`);
  if (!Number.isFinite(beforeMs) || !Number.isFinite(afterMs)) return null;
  return Math.round((afterMs - beforeMs) / (24 * 60 * 60 * 1000));
}
