import type { GanttRow } from "./types";

export type GanttResource = {
  id: string;
  name: string;
  initials: string;
  color: NonNullable<GanttRow["assignee"]>["color"];
};

export const GANTT_MOCK_RESOURCES: GanttResource[] = [
  { id: "r1", name: "Алексей Волков", initials: "АВ", color: "c1" },
  { id: "r2", name: "Мария Козлова", initials: "МК", color: "c2" },
  { id: "r3", name: "Игорь Смирнов", initials: "ИС", color: "c3" },
  { id: "r4", name: "Елена Орлова", initials: "ЕО", color: "c4" },
  { id: "r5", name: "Дмитрий Панов", initials: "ДП", color: "c5" },
  { id: "r6", name: "Ольга Нестерова", initials: "ОН", color: "c6" }
];

export function findResourceByInitials(initials: string): GanttResource | undefined {
  const key = initials.trim().toUpperCase();
  return GANTT_MOCK_RESOURCES.find((r) => r.initials.toUpperCase() === key);
}
