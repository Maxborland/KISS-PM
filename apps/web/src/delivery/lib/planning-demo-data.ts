const BASE = Date.UTC(2026, 2, 2);

export const MIN_PER_DAY = 480;
export const PROJECT_START_ISO = "2026-03-02";
export const MOCK_PROJECT_ID = "proj-prod-portal-r2";

export type Resource = {
  id: string;
  name: string;
  positionId: string;
  positionName: string;
  teamId: string;
  teamName: string;
  capacityMinPerDay: number;
};

export const RESOURCES: Resource[] = [
  { id: "u-petrov", name: "Петров А.", positionId: "pm", positionName: "Менеджер проекта", teamId: "team-core", teamName: "Управление", capacityMinPerDay: 480 },
  { id: "u-ivanova", name: "Иванова М.", positionId: "design", positionName: "Дизайнер", teamId: "team-product", teamName: "Продукт", capacityMinPerDay: 480 },
  { id: "u-orlova", name: "Орлова Д.", positionId: "design", positionName: "Дизайнер", teamId: "team-product", teamName: "Продукт", capacityMinPerDay: 480 },
  { id: "u-lebedeva", name: "Лебедева Е.", positionId: "analyst", positionName: "Аналитик", teamId: "team-product", teamName: "Продукт", capacityMinPerDay: 480 },
  { id: "u-sergeev", name: "Сергеев П.", positionId: "backend", positionName: "Backend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-dmitriev", name: "Дмитриев К.", positionId: "backend", positionName: "Backend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-fedorov", name: "Фёдоров И.", positionId: "backend", positionName: "Backend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-mikhail", name: "Михаил К.", positionId: "frontend", positionName: "Frontend-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 },
  { id: "u-kuznetsov", name: "Кузнецов Н.", positionId: "qa", positionName: "QA-инженер", teamId: "team-eng", teamName: "Инженерия", capacityMinPerDay: 480 }
];

export function dayToIso(day: number): string {
  return new Date(BASE + day * 86_400_000).toISOString().slice(0, 10);
}

export function isoToDay(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((t - BASE) / 86_400_000);
}
