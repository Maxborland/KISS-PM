export function formatPlanningHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} ч`;
}
