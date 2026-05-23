export const ABSENCE_TYPES = [
  "vacation",
  "admin_leave",
  "sick_leave",
  "maternity_leave",
  "truancy"
] as const;

export type AbsenceType = (typeof ABSENCE_TYPES)[number];

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "Отпуск",
  admin_leave: "Административный отпуск",
  sick_leave: "Больничный",
  maternity_leave: "Декрет",
  truancy: "Прогул"
};
