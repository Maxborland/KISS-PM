"use client";

import { PlanningSelect } from "../../components/ui/select";

import { ABSENCE_TYPES, ABSENCE_TYPE_LABELS, type AbsenceType } from "./absenceTypes";

export function AbsenceTypeSelect(props: {
  value: AbsenceType;
  onChange: (value: AbsenceType) => void;
}) {
  return (
    <PlanningSelect<AbsenceType>
      aria-label="Тип отсутствия"
      value={props.value}
      onChange={props.onChange}
      options={ABSENCE_TYPES.map((type) => ({
        value: type,
        label: ABSENCE_TYPE_LABELS[type]
      }))}
    />
  );
}
