import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";

import type { WbsGridRow } from "./wbsRows";

const columnHelper = createColumnHelper<WbsGridRow>();

export const wbsColumnIds = [
  "wbsIndex",
  "title",
  "durationLabel",
  "finish",
  "percentComplete",
  "assignmentsLabel",
  "validation"
] as const;

export type WbsColumnId = (typeof wbsColumnIds)[number];

export type WbsCustomFieldColumn = {
  id: string;
  header: string;
  systemKey: string;
  size?: number;
};

export const wbsBaseColumns: ColumnDef<WbsGridRow, unknown>[] = [
  columnHelper.accessor("wbsIndex", {
    id: "wbsIndex",
    header: "#",
    size: 48,
    meta: { editable: false }
  }),
  columnHelper.accessor("title", {
    id: "title",
    header: "Название",
    size: 220,
    meta: { editable: true }
  }),
  columnHelper.accessor("durationLabel", {
    id: "durationLabel",
    header: "Длит",
    size: 72,
    meta: { editable: true }
  }),
  columnHelper.accessor("finish", {
    id: "finish",
    header: "Финиш",
    size: 96,
    meta: { editable: true }
  }),
  columnHelper.accessor("percentComplete", {
    id: "percentComplete",
    header: "Прогресс",
    size: 72,
    meta: { editable: true }
  }),
  columnHelper.accessor("assignmentsLabel", {
    id: "assignmentsLabel",
    header: "Назначения",
    size: 96,
    meta: { editable: false }
  }),
  columnHelper.accessor("hasValidation", {
    id: "validation",
    header: "!",
    size: 32,
    meta: { editable: false }
  })
] as unknown as ColumnDef<WbsGridRow, unknown>[];

export const wbsColumns = wbsBaseColumns;

export function buildWbsColumns(input?: {
  visibleColumnIds?: readonly string[] | undefined;
  customFieldColumns?: readonly WbsCustomFieldColumn[] | undefined;
}): ColumnDef<WbsGridRow, unknown>[] {
  const visibleSet = input?.visibleColumnIds ? new Set(input.visibleColumnIds) : null;
  const baseFiltered = visibleSet
    ? wbsBaseColumns.filter((column) => visibleSet.has(String(column.id ?? "")))
    : wbsBaseColumns;
  const customColumnDefs = (input?.customFieldColumns ?? []).map((custom) =>
    columnHelper.display({
      id: custom.id,
      header: custom.header,
      size: custom.size ?? 120,
      meta: { editable: false, customFieldSystemKey: custom.systemKey },
      cell: (info) => {
        const row = info.row.original;
        const taskCustomFields = (row.task as { customFields?: Record<string, unknown> }).customFields ?? {};
        const value = taskCustomFields[custom.systemKey];
        if (value === undefined || value === null) return "";
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }
        return JSON.stringify(value);
      }
    })
  ) as ColumnDef<WbsGridRow, unknown>[];
  return [...baseFiltered, ...customColumnDefs];
}
