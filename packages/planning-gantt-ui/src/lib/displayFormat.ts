import type { PlanningGanttDependencyType } from "../types/viewModel";

export type ParsedPredecessor = {
  taskRef: string;
  type: PlanningGanttDependencyType;
  lagMinutes: number;
};

const minutesPerHour = 60;
const minutesPerDay = 8 * minutesPerHour;
const minutesPerWeek = 5 * minutesPerDay;
const dependencyLabels: Record<PlanningGanttDependencyType, string> = {
  FS: "ОН",
  SS: "НН",
  FF: "ОО",
  SF: "НО"
};
const dependencyTypesByRussianLabel: Record<string, PlanningGanttDependencyType> = {
  "ОН": "FS",
  "НН": "SS",
  "ОО": "FF",
  "НО": "SF"
};
const predecessorPattern = /^(.+?)(?:(ОН|НН|ОО|НО|FS|SS|FF|SF))?\s*([+-]\d+(?:\.\d+)?)?\s*([дчdh])?$/i;

export function dependencyTypeFromRussianLabel(label: string): PlanningGanttDependencyType | null {
  const normalized = label.trim().toUpperCase();
  if (normalized === "FS" || normalized === "SS" || normalized === "FF" || normalized === "SF") {
    return normalized;
  }
  return dependencyTypesByRussianLabel[normalized] ?? null;
}

export function parsePredecessors(text: string): ParsedPredecessor[] {
  if (!text.trim()) return [];

  return text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = predecessorPattern.exec(part);
      if (!match) return [];
      const type = dependencyTypeFromRussianLabel(match[2] ?? "ОН") ?? "FS";
      return [{
        taskRef: match[1] ?? "",
        type,
        lagMinutes: parseLagToMinutes(match[3] ?? "0", match[4] ?? "д")
      }];
    });
}

export function formatPredecessors(predecessors: readonly ParsedPredecessor[]): string {
  return predecessors
    .map((predecessor) => {
      const lag = lagMinutesToDisplay(predecessor.lagMinutes);
      if (predecessor.type === "FS" && predecessor.lagMinutes === 0) return predecessor.taskRef;
      if (predecessor.lagMinutes === 0) return `${predecessor.taskRef}${dependencyLabels[predecessor.type]}`;
      return `${predecessor.taskRef}${dependencyLabels[predecessor.type]}${lag}`;
    })
    .join(", ");
}

export function parseDurationToMinutes(text: string): number {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*([дчнdhw])?$/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1] ?? "0");
  const unit = (match[2] ?? "д").toLowerCase();

  if (unit === "ч" || unit === "h") return Math.round(value * minutesPerHour);
  if (unit === "н" || unit === "w") return Math.round(value * minutesPerWeek);
  return Math.round(value * minutesPerDay);
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return "0д";
  if (minutes % minutesPerDay === 0) return `${minutes / minutesPerDay}д`;
  if (minutes < minutesPerDay) return `${minutes / minutesPerHour}ч`;

  const days = minutes / minutesPerDay;
  return `${Math.round(days * 10) / 10}д`;
}

export function lagMinutesToDisplay(minutes: number): string {
  if (minutes === 0) return "";
  const sign = minutes > 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  if (absolute % minutesPerDay === 0) return `${sign}${absolute / minutesPerDay}д`;
  return `${sign}${absolute / minutesPerHour}ч`;
}

function parseLagToMinutes(value: string, unit: string): number {
  const numericValue = Number.parseFloat(value);
  const normalizedUnit = unit.toLowerCase();
  const multiplier = normalizedUnit === "ч" || normalizedUnit === "h" ? minutesPerHour : minutesPerDay;
  return Math.round(numericValue * multiplier);
}
