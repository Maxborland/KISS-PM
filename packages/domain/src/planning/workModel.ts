import type { TaskType } from "./types";

export type WorkModelInput = {
  taskType: TaskType;
  effortDriven: boolean;
  workMinutes: number;
  durationMinutes: number;
  unitsPermille: number;
  changedField: "workMinutes" | "durationMinutes" | "unitsPermille";
};

export type WorkModelResult = {
  workMinutes: number;
  durationMinutes: number;
  unitsPermille: number;
};

export function recalculateWorkModel(input: WorkModelInput): WorkModelResult {
  assertPositive(input.durationMinutes, "durationMinutes");
  assertPositive(input.unitsPermille, "unitsPermille");
  assertNonNegative(input.workMinutes, "workMinutes");

  if (input.taskType === "fixed_units") {
    return {
      workMinutes: input.workMinutes,
      durationMinutes: Math.max(1, Math.round((input.workMinutes * 1000) / input.unitsPermille)),
      unitsPermille: input.unitsPermille
    };
  }

  if (input.taskType === "fixed_work") {
    if (input.effortDriven || input.changedField === "unitsPermille") {
      return {
        workMinutes: input.workMinutes,
        durationMinutes: Math.max(1, Math.round((input.workMinutes * 1000) / input.unitsPermille)),
        unitsPermille: input.unitsPermille
      };
    }
    return {
      workMinutes: input.workMinutes,
      durationMinutes: input.durationMinutes,
      unitsPermille: Math.max(1, Math.round((input.workMinutes * 1000) / input.durationMinutes))
    };
  }

  return {
    workMinutes: input.workMinutes,
    durationMinutes: input.durationMinutes,
    unitsPermille: Math.max(1, Math.round((input.workMinutes * 1000) / input.durationMinutes))
  };
}

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`invalid_${field}`);
  }
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid_${field}`);
  }
}
