import { dateLabelToDayIndex } from "./gantt-dates";
import { parsePredecessorTextError } from "./gantt-predecessor-text";
import { parseWorkHoursInput } from "./gantt-effort";
import type { GanttCellField, GanttRow } from "./types";

export function validateDuration(value: string, row: GanttRow): string | undefined {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return "Введите число дней";
  if (row.kind === "milestone" && n !== 0) return "У вехи длительность 0";
  if (n < 0) return "Длительность не может быть отрицательной";
  return undefined;
}

export function validateProgress(value: string): string | undefined {
  const n = Number(value.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return "Введите процент 0–100";
  if (n < 0 || n > 100) return "Процент должен быть от 0 до 100";
  return undefined;
}

export function validateDate(value: string): string | undefined {
  if (!value.trim()) return "Укажите дату ДД.ММ.ГГГГ";
  if (dateLabelToDayIndex(value) === null) return "Неверный формат даты";
  return undefined;
}

export function validateName(value: string): string | undefined {
  if (!value.trim()) return "Название не может быть пустым";
  return undefined;
}

export function validateResource(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (value.trim().length > 8) return "До 8 символов";
  return undefined;
}

export function validateCell(field: GanttCellField, value: string, row: GanttRow): string | undefined {
  switch (field) {
    case "name":
      return validateName(value);
    case "duration":
      return validateDuration(value, row);
    case "progress":
      return validateProgress(value);
    case "start":
    case "finish":
      return validateDate(value);
    case "predecessors":
      return parsePredecessorTextError(value);
    case "resource":
      return validateResource(value);
    case "work": {
      if (row.kind !== "task") return undefined;
      if (parseWorkHoursInput(value) === null) return "Введите трудозатраты в часах";
      return undefined;
    }
    case "notes":
      return undefined;
    default:
      return undefined;
  }
}

export function parseProgressPercent(value: string): number {
  const n = Number(value.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n)) / 100;
}

export function parseDurationDays(value: string, row: GanttRow): number {
  if (row.kind === "milestone") return 0;
  const n = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}
