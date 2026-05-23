import { and, asc, eq, gte, lte } from "drizzle-orm";

import type { TenantId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import { resourceAbsences } from "./schema";

export const RESOURCE_ABSENCE_TYPES = [
  "vacation",
  "admin_leave",
  "sick_leave",
  "maternity_leave",
  "truancy"
] as const;

export type ResourceAbsenceType = (typeof RESOURCE_ABSENCE_TYPES)[number];

export type ResourceAbsenceRecord = {
  id: string;
  tenantId: TenantId;
  userId: string;
  type: ResourceAbsenceType;
  dateFrom: string;
  dateTo: string;
  status: string;
  reason: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateResourceAbsenceInput = {
  id: string;
  tenantId: TenantId;
  userId: string;
  type: ResourceAbsenceType;
  dateFrom: string;
  dateTo: string;
  reason?: string | null;
  createdBy?: string | null;
};

export type ResourceAbsencesRepository = {
  listAbsences(
    tenantId: TenantId,
    fromDate: string,
    toDate: string,
    userId?: string
  ): Promise<ResourceAbsenceRecord[]>;
  createAbsence(input: CreateResourceAbsenceInput): Promise<ResourceAbsenceRecord>;
  deleteAbsence(tenantId: TenantId, id: string): Promise<boolean>;
};

function mapRow(row: typeof resourceAbsences.$inferSelect): ResourceAbsenceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    type: row.type as ResourceAbsenceType,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    status: row.status,
    reason: row.reason,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function isAbsenceType(value: string): value is ResourceAbsenceType {
  return (RESOURCE_ABSENCE_TYPES as readonly string[]).includes(value);
}

export function expandAbsenceToCalendarExceptions(
  absence: ResourceAbsenceRecord
): Array<{
  id: string;
  date: string;
  workingMinutes: number;
  reason: string;
  resourceId: string;
}> {
  const items: Array<{
    id: string;
    date: string;
    workingMinutes: number;
    reason: string;
    resourceId: string;
  }> = [];
  iterateIsoDates(absence.dateFrom, absence.dateTo, (date) => {
    items.push({
      id: `absence-${absence.id}-${date}`,
      date,
      workingMinutes: 0,
      reason: `absence:${absence.type}`,
      resourceId: absence.userId
    });
  });
  return items;
}

export function iterateIsoDates(
  fromDate: string,
  toDate: string,
  onDate: (date: string) => void
): void {
  const start = parseIsoDate(fromDate);
  const end = parseIsoDate(toDate);
  if (!start || !end || end < start) return;
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    onDate(toIsoDate(cursor));
  }
}

function parseIsoDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const monthIndex = Number.parseInt(monthText ?? "", 10) - 1;
  const day = Number.parseInt(dayText ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  return Date.UTC(year, monthIndex, day);
}

function addUtcDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.getTime();
}

function toIsoDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createResourceAbsencesRepository(
  db: KissPmDatabase
): ResourceAbsencesRepository {
  return {
    async listAbsences(tenantId, fromDate, toDate, userId) {
      const filters = [
        eq(resourceAbsences.tenantId, tenantId),
        lte(resourceAbsences.dateFrom, toDate),
        gte(resourceAbsences.dateTo, fromDate)
      ];
      if (userId) {
        filters.push(eq(resourceAbsences.userId, userId));
      }
      const rows = await db
        .select()
        .from(resourceAbsences)
        .where(and(...filters))
        .orderBy(asc(resourceAbsences.dateFrom), asc(resourceAbsences.id));
      return rows.map(mapRow);
    },

    async createAbsence(input) {
      if (!isAbsenceType(input.type)) {
        throw new Error("resource_absence_invalid_type");
      }
      if (input.dateTo < input.dateFrom) {
        throw new Error("resource_absence_invalid_range");
      }
      const now = new Date();
      const [row] = await db
        .insert(resourceAbsences)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          status: "approved",
          reason: input.reason ?? null,
          createdBy: input.createdBy ?? null,
          approvedBy: input.createdBy ?? null,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      if (!row) {
        throw new Error("resource_absence_insert_failed");
      }
      return mapRow(row);
    },

    async deleteAbsence(tenantId, id) {
      const rows = await db
        .delete(resourceAbsences)
        .where(and(eq(resourceAbsences.tenantId, tenantId), eq(resourceAbsences.id, id)))
        .returning({ id: resourceAbsences.id });
      return rows.length > 0;
    }
  };
}
