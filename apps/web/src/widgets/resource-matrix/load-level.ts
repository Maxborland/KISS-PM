/** Пороги дневной нагрузки (часы), согласованы с легендой матрицы. */
export const LOAD_HOURS_NORMAL_MAX = 8;
export const LOAD_HOURS_HIGH_MIN = 10;
export const LOAD_HOURS_OVER_MIN = 15;

export type DayLoadLevel = "normal" | "high" | "over";

/** Уровень загрузки по часам в день (один ресурс). */
export function resolvePersonDayLoadLevel(hours: number): DayLoadLevel {
  if (hours > LOAD_HOURS_OVER_MIN) return "over";
  if (hours > LOAD_HOURS_HIGH_MIN) return "high";
  return "normal";
}
