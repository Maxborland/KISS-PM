import { describe, expect, it } from "vitest";

import { createAdminClient } from "./admin-client";
import { createMockAdminFetch } from "./mock-admin-backend";

/* ============================================================
   Contract-mock операционных ручек админки (Н3/Н4): отсутствия,
   производственный календарь, фоновые задачи. Коды и порядок
   валидаций зеркалят absencesRoutes / productionCalendarRoutes /
   backgroundJobRoutes.
   ============================================================ */

function client() {
  return createAdminClient({ apiOrigin: "", fetchImpl: createMockAdminFetch() });
}

const year = new Date().getUTCFullYear();
const YEAR_FROM = `${year}-01-01`;
const YEAR_TO = `${year}-12-31`;

describe("contract-mock admin ops backend: absences", () => {
  it("lists seeded absences for a period sorted by dateFrom", async () => {
    const { absences } = await client().listAbsences(YEAR_FROM, YEAR_TO);
    expect(absences.length).toBeGreaterThanOrEqual(1);
    const dates = absences.map((a) => a.dateFrom);
    expect(dates).toEqual([...dates].sort());
    expect(absences.every((a) => a.tenantId === "tenant-alpha")).toBe(true);
  });

  it("requires a valid mandatory period (400 resource_absence_invalid_range)", async () => {
    // Конец раньше начала.
    await expect(client().listAbsences(YEAR_TO, YEAR_FROM))
      .rejects.toMatchObject({ status: 400, code: "resource_absence_invalid_range" });
    // Длиннее 370 дней.
    await expect(client().listAbsences(`${year}-01-01`, `${year + 2}-01-01`))
      .rejects.toMatchObject({ status: 400, code: "resource_absence_invalid_range" });
  });

  it("creates an absence and returns it in the period list", async () => {
    const c = client();
    const { absence } = await c.createAbsence({
      userId: "user-maria", type: "sick_leave",
      dateFrom: `${year}-06-01`, dateTo: `${year}-06-03`, reason: "Простуда"
    });
    expect(absence.userId).toBe("user-maria");
    expect(absence.type).toBe("sick_leave");
    // id — UUID (боевой формат: randomUUID, его же требует DELETE-парсер).
    expect(absence.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const { absences } = await c.listAbsences(`${year}-06-01`, `${year}-06-30`, "user-maria");
    expect(absences.some((a) => a.id === absence.id)).toBe(true);
  });

  it("rejects invalid create bodies with the production error codes", async () => {
    const c = client();
    await expect(c.createAbsence({ userId: "!", type: "vacation", dateFrom: YEAR_FROM, dateTo: YEAR_FROM }))
      .rejects.toMatchObject({ status: 400, code: "invalid_user_id" });
    await expect(c.createAbsence({ userId: "user-ivan", type: "nap" as never, dateFrom: YEAR_FROM, dateTo: YEAR_FROM }))
      .rejects.toMatchObject({ status: 400, code: "resource_absence_invalid" });
    await expect(c.createAbsence({ userId: "user-ivan", type: "vacation", dateFrom: `${year}-02-30`, dateTo: `${year}-03-01` }))
      .rejects.toMatchObject({ status: 400, code: "resource_absence_invalid" });
    await expect(c.createAbsence({ userId: "user-ivan", type: "vacation", dateFrom: `${year}-03-02`, dateTo: `${year}-03-01` }))
      .rejects.toMatchObject({ status: 400, code: "resource_absence_invalid_range" });
  });

  it("deletes an absence; invalid id → 400, missing → 404", async () => {
    const c = client();
    const { absence } = await c.createAbsence({
      userId: "user-ivan", type: "vacation", dateFrom: `${year}-09-01`, dateTo: `${year}-09-05`
    });
    await expect(c.deleteAbsence("not-a-uuid"))
      .rejects.toMatchObject({ status: 400, code: "invalid_absence_id" });
    await expect(c.deleteAbsence("00000000-0000-4000-8000-000000000000"))
      .rejects.toMatchObject({ status: 404, code: "resource_absence_not_found" });
    await expect(c.deleteAbsence(absence.id)).resolves.toEqual({ ok: true });
    const { absences } = await c.listAbsences(`${year}-09-01`, `${year}-09-30`);
    expect(absences.some((a) => a.id === absence.id)).toBe(false);
  });
});

describe("contract-mock admin ops backend: production calendar", () => {
  it("returns tenant defaults with the current-year exceptions (date asc)", async () => {
    const calendar = await client().getProductionCalendar();
    expect(calendar.year).toBe(year);
    expect(calendar.workingWeekdays).toEqual([1, 2, 3, 4, 5]);
    expect(calendar.workingMinutesPerDay).toBe(480);
    const dates = calendar.exceptions.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("rejects an out-of-range year (400 production_calendar_invalid)", async () => {
    await expect(client().getProductionCalendar(1999))
      .rejects.toMatchObject({ status: 400, code: "production_calendar_invalid" });
  });

  it("bulk-upserts exceptions: insert by new id, replace by existing id", async () => {
    const c = client();
    await c.bulkUpsertProductionCalendarExceptions([
      { id: "pc-test-day", date: `${year}-05-01`, workingMinutes: 0, reason: "Праздник" }
    ]);
    let calendar = await c.getProductionCalendar(year);
    const inserted = calendar.exceptions.find((e) => e.id === "pc-test-day");
    expect(inserted).toMatchObject({ date: `${year}-05-01`, workingMinutes: 0, reason: "Праздник", resourceId: null });
    // Upsert по id: те же id — обновление, не дубль.
    await c.bulkUpsertProductionCalendarExceptions([
      { id: "pc-test-day", date: `${year}-05-02`, workingMinutes: 420, reason: null }
    ]);
    calendar = await c.getProductionCalendar(year);
    expect(calendar.exceptions.filter((e) => e.id === "pc-test-day")).toHaveLength(1);
    expect(calendar.exceptions.find((e) => e.id === "pc-test-day")).toMatchObject({ date: `${year}-05-02`, workingMinutes: 420 });
  });

  it("rejects invalid bulk items (minutes out of range) with production_calendar_invalid", async () => {
    await expect(client().bulkUpsertProductionCalendarExceptions([
      { date: `${year}-05-01`, workingMinutes: 2000 }
    ])).rejects.toMatchObject({ status: 400, code: "production_calendar_invalid" });
  });
});

describe("contract-mock admin ops backend: background jobs (read-only)", () => {
  it("lists seeded runs newest-first and filters by status", async () => {
    const c = client();
    const { runs } = await c.listBackgroundJobRuns();
    expect(runs.length).toBeGreaterThanOrEqual(3);
    const createdAt = runs.map((r) => r.createdAt);
    expect(createdAt).toEqual([...createdAt].sort().reverse());
    const { runs: dead } = await c.listBackgroundJobRuns({ status: "dead" });
    expect(dead.length).toBeGreaterThanOrEqual(1);
    expect(dead.every((r) => r.status === "dead")).toBe(true);
    expect(dead[0]?.lastError).toBe("background_job_failed");
  });

  it("rejects an unknown status filter (400 background_job_status_invalid)", async () => {
    await expect(client().listBackgroundJobRuns({ status: "exploded" as never }))
      .rejects.toMatchObject({ status: 400, code: "background_job_status_invalid" });
  });

  it("returns run events oldest-first; invalid run id → 400", async () => {
    const c = client();
    const { runs } = await c.listBackgroundJobRuns({ status: "succeeded" });
    const { events } = await c.listBackgroundJobEvents(runs[0]!.id);
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.every((e) => e.jobId === runs[0]!.id)).toBe(true);
    expect(events.map((e) => e.eventType)).toEqual(["enqueued", "claimed", "succeeded"]);
    await expect(c.listBackgroundJobEvents("оркестратор"))
      .rejects.toMatchObject({ status: 400, code: "background_job_id_invalid" });
  });
});
