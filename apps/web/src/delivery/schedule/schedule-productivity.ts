import { createPlanningCommand, type PlanAssignmentRole, type PlanningCommand } from "@kiss-pm/domain";

const MINUTES_PER_DAY = 8 * 60;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TaskTsvRow = {
  title: string;
  startIso: string | null;
  finishIso: string | null;
  durationDays: number;
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

export function parseTaskTsv(value: string): TaskTsvResult {
  const normalized = normalizeTaskTsv(value);
  if (!normalized.trim()) return { ok: false, errors: [{ row: 1, column: "row", message: "Вставьте хотя бы одну строку" }] };

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
    const dateDuration = startIso && finishIsoInput ? daysBetween(startIso, finishIsoInput) : null;
    if (dateDuration !== null && dateDuration <= 0) errors.push({ row: rowNumber, column: "finish", message: "Окончание должно быть позже начала" });
    if (dateDuration !== null && dateDuration > 0 && explicitDuration !== null && explicitDuration !== dateDuration) {
      errors.push({ row: rowNumber, column: "duration", message: "Длительность не совпадает с диапазоном дат" });
    }
    const durationDays = dateDuration && dateDuration > 0 ? dateDuration : explicitDuration && explicitDuration > 0 ? explicitDuration : 5;
    const finishIso = startIso ? finishIsoInput ?? addIsoDays(startIso, durationDays) : null;

    const workHours = workValue ? Number(workValue) : durationDays * 8;
    if (!Number.isFinite(workHours) || workHours < 0) errors.push({ row: rowNumber, column: "work", message: "Трудозатраты должны быть числом не меньше 0" });
    const percentComplete = progressValue ? Number(progressValue) : 0;
    if (!Number.isFinite(percentComplete) || percentComplete < 0 || percentComplete > 100) {
      errors.push({ row: rowNumber, column: "progress", message: "Прогресс должен быть от 0 до 100" });
    }

    rows.push({ title, startIso, finishIso, durationDays, workHours, percentComplete });
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
          durationMinutes: row.durationDays * MINUTES_PER_DAY,
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
  assignments
}: {
  firstFinishIso: string;
  mode: "same" | "series";
  rows: readonly FinishFillRow[];
  assignments: readonly FinishFillAssignment[];
}): FinishFillResult {
  if (!isIsoDate(firstFinishIso)) return { ok: false, errors: rows.map((row) => ({ taskId: row.id, message: "Укажите корректную дату окончания" })) };

  const preview = rows.map((row, index) => {
    const finishIso = mode === "series" ? addIsoDays(firstFinishIso, index) : firstFinishIso;
    const durationDays = isIsoDate(row.startIso) ? daysBetween(row.startIso, finishIso) : 0;
    const unitHours = row.durationDays > 0 ? row.workHours / row.durationDays : 8;
    return { taskId: row.id, finishIso, durationDays, workHours: Math.max(0, Math.round(durationDays * unitHours)) };
  });
  const errors = preview
    .filter((item) => item.durationDays <= 0)
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
          taskType: "fixed_duration",
          effortDriven: false,
          durationMinutes: item.durationDays * MINUTES_PER_DAY,
          workMinutes: item.workHours * 60
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
          workMinutes: item.workHours * 60
        }
      }));
    }
    return result;
  });

  return { ok: true, preview, commands };
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

function daysBetween(startIso: string, finishIso: string): number {
  return Math.round((Date.parse(`${finishIso}T00:00:00.000Z`) - Date.parse(`${startIso}T00:00:00.000Z`)) / 86_400_000);
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `tsv-${(hash >>> 0).toString(16)}`;
}
