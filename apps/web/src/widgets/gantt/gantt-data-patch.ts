import type { GanttData } from "./types";

export type GanttDataPatch = Partial<Omit<GanttData, "selectedRowId" | "selectedDependencyId">> & {
  selectedRowId?: string | null;
  selectedDependencyId?: string | null;
};

/** exactOptionalPropertyTypes: явно снимаем optional-поля вместо `undefined`. */
export function patchGanttData(data: GanttData, patch: GanttDataPatch): GanttData {
  const { selectedRowId, selectedDependencyId, ...rest } = patch;
  const next: GanttData = { ...data, ...rest };
  if (selectedRowId !== undefined) {
    if (selectedRowId === null) delete next.selectedRowId;
    else next.selectedRowId = selectedRowId;
  }
  if (selectedDependencyId !== undefined) {
    if (selectedDependencyId === null) delete next.selectedDependencyId;
    else next.selectedDependencyId = selectedDependencyId;
  }
  return next;
}
