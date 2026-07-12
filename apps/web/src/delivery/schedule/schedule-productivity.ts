import { createPlanningCommand, type PlanAssignmentRole, type PlanningCommand, type TaskType } from "@kiss-pm/domain";

import {
  nextScheduleWorkingDate,
  resolveScheduleWorkingTime,
  scheduleFinishDateForDuration,
  scheduleWorkingDateOnOrAfter,
  scheduleWorkingDays,
  scheduleWorkingMinutesThroughDate,
  type ScheduleCalendarSource
} from "./schedule-working-time";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TaskTsvRow = {
  title: string;
  startIso: string | null;
  finishIso: string | null;
  durationDays: number;
  durationMinutes: number;
  workHours: number;
  percentComplete: number;
};

export type TaskTsvError = {
  row: number;
  column: "row" | "title" | "start" | "finish" | "duration" | "work" | "progress";
  message: string;
};

export type TaskTsvResult =
  | { ok: true; rows: TaskTsvRow[]; fingerprint: string }
  | { ok: false; errors: TaskTsvError[] };

export type FinishFillRow = {
  id: string;
  startIso: string;
  durationDays: number;
  workHours: number;
  calendarId?: string | null;
  durationMinutes?: number;
};

export type FinishFillAssignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role?: PlanAssignmentRole;
  unitsPermille?: number;
};

export type FinishFillResult =
  | {
      ok: true;
      preview: Array<{ taskId: string; finishIso: string; durationDays: number; workHours: number }>;
      commands: PlanningCommand[];
    }
  | { ok: false; errors: Array<{ taskId: string; message: string }> };

export function normalizeTaskTsv(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

export function parseTaskTsv(
  value: string,
  calendarSource: ScheduleCalendarSource = {}
): TaskTsvResult {
  const normalized = normalizeTaskTsv(value);
  if (!normalized.trim()) return { ok: false, errors: [{ row: 1, column: "row", message: "Вставьте хотя бы одну строку" }] };
  const workingTime = resolveScheduleWorkingTime(calendarSource, null);

  const lines = normalized.split("\n");
  if (lines.length > 200) return { ok: false, errors: [{ row: 201, column: "row", message: "За один раз можно импортировать не более 200 задач" }] };

  const width = lines[0]!.split("\t").length;
  const errors: TaskTsvError[] = [];
  if (width > 6) errors.push({ row: 1, column: "row", message: "Поддерживается не более 6 колонок" });

  const rows: TaskTsvRow[] = [];
  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    const cells = line.split("\t");
    if (cells.length !== width) {
      errors.push({ row: rowNumber, column: "row", message: `Ожидалось колонок: ${width}, получено: ${cells.length}` });
      return;
    }

    const title = (cells[0] ?? "").trim();
    const startValue = (cells[1] ?? "").trim();
    const finishValue = (cells[2] ?? "").trim();
    const durationValue = (cells[3] ?? "").trim();
    const workValue = (cells[4] ?? "").trim();
    const progressValue = (cells[5] ?? "").trim();

    if (title.length < 3 || title.length > 160) errors.push({ row: rowNumber, column: "title", message: "Название должно содержать от 3 до 160 символов" });
    const startIso = startValue && isIsoDate(startValue) ? startValue : null;
    const finishIsoInput = finishValue && isIsoDate(finishValue) ? finishValue : null;
    if (startValue && !startIso) errors.push({ row: rowNumber, column: "start", message: "Дата начала должна быть в формате ГГГГ-ММ-ДД" });
    if (finishValue && !finishIsoInput) errors.push({ row: rowNumber, column: "finish", message: "Дата окончания должна быть в формате ГГГГ-ММ-ДД" });
    if (finishIsoInput && !startIso) errors.push({ row: rowNumber, column: "finish", message: "Для окончания требуется дата начала" });

    const explicitDuration = durationValue ? Number(durationValue) : null;
    if (explicitDuration !== null && (!Number.isInteger(explicitDuration) || explicitDuration <= 0)) {
      errors.push({ row: rowNumber, column: "duration", message: "Длительность должна быть целым числом больше 0" });
    }
    const finishIso = startIso && finishIsoInput
      ? scheduleWorkingDateOnOrAfter(finishIsoInput, workingTime)
      : null;
    const dateDurationMinutes = startIso && finishIso
      ? scheduleWorkingMinutesThroughDate(startIso, finishIso, workingTime)
      : null;
    if (dateDurationMinutes !== null && dateDurationMinutes <= 0) {
      errors.push({ row: rowNumber, column: "finish", message: "Окончание должно быть позже начала" });
    }
    const explicitDurationMinutes = explicitDuration !== null
      ? explicitDuration * workingTime.workingMinutesPerDay
      : null;
    if (
      dateDurationMinutes !== null &&
      dateDurationMinutes > 0 &&
      explicitDurationMinutes !== null &&
      explicitDurationMinutes !== dateDurationMinutes
    ) {
      errors.push({ row: rowNumber, column: "duration", message: "Длительность не совпадает с диапазоном дат" });
    }
    const durationMinutes = dateDurationMinutes && dateDurationMinutes > 0
      ? dateDurationMinutes
      : explicitDurationMinutes && explicitDurationMinutes > 0
        ? explicitDurationMinutes
        : 5 * workingTime.workingMinutesPerDay;
    const durationDays = scheduleWorkingDays(durationMinutes, workingTime);
    const resolvedFinishIso = startIso
      ? finishIso ?? scheduleFinishDateForDuration(startIso, durationMinutes, workingTime)
      : null;

    const workHours = workValue ? Number(workValue) : durationMinutes / 60;
    if (!Number.isFinite(workHours) || workHours < 0) errors.push({ row: rowNumber, column: "work", message: "Трудозатраты должны быть числом не меньше 0" });
    const percentComplete = progressValue ? Number(progressValue) : 0;
    if (!Number.isFinite(percentComplete) || percentComplete < 0 || percentComplete > 100) {
      errors.push({ row: rowNumber, column: "progress", message: "Прогресс должен быть от 0 до 100" });
    }

    rows.push({
      title,
      startIso,
      finishIso: resolvedFinishIso,
      durationDays,
      durationMinutes,
      workHours,
      percentComplete
    });
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, rows, fingerprint: fingerprint(normalized) };
}

export function createTaskTsvId(
  projectId: string,
  fingerprintValue: string,
  rowIndex: number
): string {
  return "task-tsv-" + fingerprint(projectId + ":" + fingerprintValue + ":" + rowIndex).slice(4);
}
export function buildPasteCommands({
  projectId,
  rows,
  createId
}: {
  projectId: string;
  rows: readonly TaskTsvRow[];
  createId: (index: number) => string;
}): PlanningCommand[] {
  return rows.flatMap((row, index) => {
    const taskId = createId(index);
    const commands: PlanningCommand[] = [
      createPlanningCommand({
        type: "task.create",
        payload: {
          id: taskId,
          projectId,
          parentTaskId: null,
          title: row.title,
          statusId: "todo",
          plannedStart: row.startIso,
          plannedFinish: row.finishIso,
          durationMinutes: row.durationMinutes,
          workMinutes: Math.round(row.workHours * 60),
          assignments: []
        }
      })
    ];
    if (row.percentComplete > 0) {
      commands.push(createPlanningCommand({ type: "task.update_progress", payload: { taskId, percentComplete: row.percentComplete } }));
    }
    return commands;
  });
}

export function buildFinishDateFillCommands({
  firstFinishIso,
  mode,
  rows,
  assignments,
  calendarSource,
  resolveWorkModel
}: {
  firstFinishIso: string;
  mode: "same" | "series";
  rows: readonly FinishFillRow[];
  assignments: readonly FinishFillAssignment[];
  calendarSource?: ScheduleCalendarSource;
  /** Семантика задачи + Σ units назначений; без резолвера — legacy fixed_duration. */
  resolveWorkModel?: (taskId: string) => { taskType: TaskType; effortDriven: boolean; unitsPermille: number };
}): FinishFillResult {
  if (!isIsoDate(firstFinishIso)) return { ok: false, errors: rows.map((row) => ({ taskId: row.id, message: "Укажите корректную дату окончания" })) };
  if (!calendarSource) {
    return {
      ok: false,
      errors: rows.map((row) => ({
        taskId: row.id,
        message: "Для расчета окончания нужен календарь задачи"
      }))
    };
  }

  let previousFinishIso: string | null = null;
  const preview = rows.map((row, index) => {
    const workingTime = resolveScheduleWorkingTime(calendarSource, row.calendarId);
    const finishIso = mode === "series" && index > 0 && previousFinishIso
      ? nextScheduleWorkingDate(previousFinishIso, workingTime)
      : scheduleWorkingDateOnOrAfter(firstFinishIso, workingTime);
    previousFinishIso = finishIso;
    const durationMinutes = isIsoDate(row.startIso)
      ? scheduleWorkingMinutesThroughDate(row.startIso, finishIso, workingTime)
      : 0;
    const durationDays = durationMinutes / workingTime.workingMinutesPerDay;
    const previousDurationMinutes = row.durationMinutes ??
      row.durationDays * workingTime.workingMinutesPerDay;
    const workMinutesPerDurationMinute = previousDurationMinutes > 0
      ? row.workHours * 60 / previousDurationMinutes
      : 1;
    // Труд согласован с семантикой типа (та же логика, что engineConsistentWorkMinutes):
    // fixed_units / fixed_work+effortDriven — из длительности×юнитов (движок выведет
    // обратно эту длительность); fixed_work — труд не меняется; иначе — пропорция.
    const model = resolveWorkModel?.(row.id) ?? { taskType: "fixed_duration" as TaskType, effortDriven: false, unitsPermille: 0 };
    const engineRecalculates = model.unitsPermille > 0 && row.workHours > 0;
    const workHours = !engineRecalculates || model.taskType === "fixed_duration"
      ? Math.max(0, Math.round(durationMinutes * workMinutesPerDurationMinute) / 60)
      : model.taskType === "fixed_work" && !model.effortDriven
        ? row.workHours
        : Math.max(0, Math.round((durationMinutes * model.unitsPermille) / 1000) / 60);
    return { taskId: row.id, finishIso, durationDays, workHours, durationMinutes, model };
  });
  const errors = preview
    .filter((item) => {
      const row = rows.find((candidate) => candidate.id === item.taskId);
      return !row || item.finishIso <= row.startIso || item.durationMinutes <= 0;
    })
    .map((item) => ({ taskId: item.taskId, message: "Окончание должно быть позже начала" }));
  if (errors.length) return { ok: false, errors };

  const commands = preview.flatMap((item) => {
    const row = rows.find((candidate) => candidate.id === item.taskId)!;
    const result: PlanningCommand[] = [
      createPlanningCommand({ type: "task.update_schedule", payload: { taskId: item.taskId, plannedStart: row.startIso, plannedFinish: item.finishIso } }),
      createPlanningCommand({
        type: "task.update_work_model",
        payload: {
          taskId: item.taskId,
          // Семантика задачи сохраняется (fixed_units не превращается в fixed_duration).
          taskType: item.model.taskType,
          effortDriven: item.model.effortDriven,
          durationMinutes: item.durationMinutes,
          workMinutes: Math.round(item.workHours * 60)
        }
      })
    ];
    const assignment = assignments.find((candidate) => candidate.taskId === item.taskId);
    if (assignment) {
      result.push(createPlanningCommand({
        type: "assignment.upsert",
        payload: {
          id: assignment.id,
          taskId: item.taskId,
          resourceId: assignment.resourceId,
          role: assignment.role ?? "executor",
          unitsPermille: assignment.unitsPermille ?? 1000,
          workMinutes: Math.round(item.workHours * 60)
        }
      }));
    }
    return result;
  });

  return {
    ok: true,
    preview: preview.map((item) => ({
      taskId: item.taskId,
      finishIso: item.finishIso,
      durationDays: item.durationDays,
      workHours: item.workHours
    })),
    commands
  };
}

export function resolveFinishFillDrag(input: {
  rowIds: readonly string[];
  sourceId: string;
  targetId: string;
  sourceFinishIso: string;
}): { targetIds: string[]; firstFinishIso: string } | null {
  const sourceIndex = input.rowIds.indexOf(input.sourceId);
  const targetIndex = input.rowIds.indexOf(input.targetId);
  if (
    sourceIndex < 0 ||
    targetIndex <= sourceIndex ||
    !isIsoDate(input.sourceFinishIso)
  ) {
    return null;
  }

  return {
    targetIds: input.rowIds.slice(sourceIndex + 1, targetIndex + 1),
    firstFinishIso: addIsoDays(input.sourceFinishIso, 1)
  };
}
export function getScheduleNavigationTarget(
  rowIds: readonly string[],
  currentId: string | null,
  key: "ArrowUp" | "ArrowDown" | "Home" | "End"
): string | null {
  if (!rowIds.length) return null;
  if (key === "Home") return rowIds[0]!;
  if (key === "End") return rowIds[rowIds.length - 1]!;
  const index = Math.max(0, rowIds.indexOf(currentId ?? rowIds[0]!));
  const nextIndex = key === "ArrowDown" ? Math.min(rowIds.length - 1, index + 1) : Math.max(0, index - 1);
  return rowIds[nextIndex]!;
}

export function shouldRunScheduleUndo(input: {
  canManage: boolean;
  busy: boolean;
  canUndo: boolean;
  currentVersion: number;
  afterVersion: number | null;
  editableTarget: boolean;
}): boolean {
  return input.canManage && !input.busy && input.canUndo && !input.editableTarget && input.afterVersion !== null && input.currentVersion === input.afterVersion;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `tsv-${(hash >>> 0).toString(16)}`;
}
