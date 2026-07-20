import { and, asc, eq, gte, lte } from "drizzle-orm";

import type { TenantId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  DEFAULT_WORKING_MINUTES_PER_DAY,
  DEFAULT_WORKING_WEEKDAYS,
  TENANT_DEFAULT_CALENDAR_ID
} from "./tenantProductionCalendarConstants";
import {
  tenantProductionCalendarExceptions,
  tenantProductionCalendars
} from "./schema";

export type TenantProductionCalendarExceptionRecord = {
  id: string;
  date: string;
  workingMinutes: number;
  reason: string | null;
  resourceId: string | null;
};

export type TenantProductionCalendarBulkItem = {
  id: string;
  date: string;
  workingMinutes: number;
  reason: string | null;
  resourceId?: string | null;
};

export type TenantProductionCalendarBaseMode = {
  calendarId: string;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
};

export type TenantProductionCalendarBaseModeInput = {
  workingWeekdays: number[];
  workingMinutesPerDay: number;
};

export type TenantProductionCalendarRepository = {
  getProductionCalendar(
    tenantId: TenantId,
    year: number
  ): Promise<{
    calendarId: string;
    year: number;
    workingWeekdays: number[];
    workingMinutesPerDay: number;
    exceptions: TenantProductionCalendarExceptionRecord[];
  }>;
  getBaseMode(tenantId: TenantId): Promise<TenantProductionCalendarBaseMode>;
  updateBaseMode(
    tenantId: TenantId,
    input: TenantProductionCalendarBaseModeInput
  ): Promise<TenantProductionCalendarBaseMode>;
  bulkUpsertExceptions(
    tenantId: TenantId,
    items: TenantProductionCalendarBulkItem[]
  ): Promise<void>;
  deleteException(
    tenantId: TenantId,
    exceptionId: string
  ): Promise<TenantProductionCalendarExceptionRecord | null>;
  listExceptionsForYear(
    tenantId: TenantId,
    year: number
  ): Promise<TenantProductionCalendarExceptionRecord[]>;
};

function yearDateRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function createTenantProductionCalendarRepository(
  db: KissPmDatabase
): TenantProductionCalendarRepository {
  return {
    async getProductionCalendar(tenantId, year) {
      const [calendar] = await db
        .select()
        .from(tenantProductionCalendars)
        .where(eq(tenantProductionCalendars.tenantId, tenantId))
        .limit(1);
      const exceptions = await this.listExceptionsForYear(tenantId, year);
      return {
        calendarId: calendar?.calendarId ?? TENANT_DEFAULT_CALENDAR_ID,
        year,
        workingWeekdays: calendar?.workingWeekdays ?? [...DEFAULT_WORKING_WEEKDAYS],
        workingMinutesPerDay:
          calendar?.workingMinutesPerDay ?? DEFAULT_WORKING_MINUTES_PER_DAY,
        exceptions
      };
    },

    async getBaseMode(tenantId) {
      const [calendar] = await db
        .select()
        .from(tenantProductionCalendars)
        .where(eq(tenantProductionCalendars.tenantId, tenantId))
        .limit(1);
      return {
        calendarId: calendar?.calendarId ?? TENANT_DEFAULT_CALENDAR_ID,
        workingWeekdays: calendar?.workingWeekdays ?? [...DEFAULT_WORKING_WEEKDAYS],
        workingMinutesPerDay:
          calendar?.workingMinutesPerDay ?? DEFAULT_WORKING_MINUTES_PER_DAY
      };
    },

    async updateBaseMode(tenantId, input) {
      const now = new Date();
      const workingWeekdays = [...input.workingWeekdays];
      await db
        .insert(tenantProductionCalendars)
        .values({
          tenantId,
          calendarId: TENANT_DEFAULT_CALENDAR_ID,
          workingWeekdays,
          workingMinutesPerDay: input.workingMinutesPerDay,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: tenantProductionCalendars.tenantId,
          set: {
            workingWeekdays,
            workingMinutesPerDay: input.workingMinutesPerDay,
            updatedAt: now
          }
        });
      return {
        calendarId: TENANT_DEFAULT_CALENDAR_ID,
        workingWeekdays,
        workingMinutesPerDay: input.workingMinutesPerDay
      };
    },

    async deleteException(tenantId, exceptionId) {
      const [row] = await db
        .delete(tenantProductionCalendarExceptions)
        .where(
          and(
            eq(tenantProductionCalendarExceptions.tenantId, tenantId),
            eq(tenantProductionCalendarExceptions.id, exceptionId)
          )
        )
        .returning();
      if (!row) return null;
      return {
        id: row.id,
        date: row.date,
        workingMinutes: row.workingMinutes,
        reason: row.reason,
        resourceId: row.resourceId
      };
    },

    async listExceptionsForYear(tenantId, year) {
      const range = yearDateRange(year);
      const rows = await db
        .select()
        .from(tenantProductionCalendarExceptions)
        .where(
          and(
            eq(tenantProductionCalendarExceptions.tenantId, tenantId),
            gte(tenantProductionCalendarExceptions.date, range.from),
            lte(tenantProductionCalendarExceptions.date, range.to)
          )
        )
        .orderBy(
          asc(tenantProductionCalendarExceptions.date),
          asc(tenantProductionCalendarExceptions.id)
        );

      return rows.map((row) => ({
        id: row.id,
        date: row.date,
        workingMinutes: row.workingMinutes,
        reason: row.reason,
        resourceId: row.resourceId
      }));
    },

    async bulkUpsertExceptions(tenantId, items) {
      const now = new Date();
      await db
        .insert(tenantProductionCalendars)
        .values({
          tenantId,
          calendarId: TENANT_DEFAULT_CALENDAR_ID,
          workingWeekdays: [...DEFAULT_WORKING_WEEKDAYS],
          workingMinutesPerDay: DEFAULT_WORKING_MINUTES_PER_DAY,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: tenantProductionCalendars.tenantId,
          set: { updatedAt: now }
        });

      for (const item of items) {
        await db
          .insert(tenantProductionCalendarExceptions)
          .values({
            id: item.id,
            tenantId,
            calendarId: TENANT_DEFAULT_CALENDAR_ID,
            resourceId: item.resourceId ?? null,
            date: item.date,
            workingMinutes: item.workingMinutes,
            reason: item.reason,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [
              tenantProductionCalendarExceptions.tenantId,
              tenantProductionCalendarExceptions.id
            ],
            set: {
              date: item.date,
              workingMinutes: item.workingMinutes,
              reason: item.reason,
              resourceId: item.resourceId ?? null,
              updatedAt: now
            }
          });
      }
    }
  };
}
