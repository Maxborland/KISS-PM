import { describe, expect, it } from "vitest";

import {
  buildFinishDateFillCommands,
  buildPasteCommands,
  createTaskTsvId,
  getScheduleNavigationTarget,
  parseTaskTsv,
  resolveFinishFillDrag,
  shouldRunScheduleUndo
} from "./schedule-productivity";

const calendarSource = {
  project: { calendarId: "calendar-default" },
  calendars: [{
    id: "calendar-default",
    workingWeekdays: [1, 2, 3, 4, 5],
    workingMinutesPerDay: 480
  }],
  calendarExceptions: []
};

const sixHourCalendarSource = {
  project: { calendarId: "calendar-six-hour" },
  calendars: [{
    id: "calendar-six-hour",
    workingWeekdays: [1, 2, 3, 4, 5],
    workingMinutesPerDay: 360
  }],
  calendarExceptions: []
};

describe("schedule productivity commands", () => {
  it("normalizes and parses a rectangular 10x6 TSV import", () => {
    const tsv = `\uFEFF${Array.from({ length: 10 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return `Imported task ${index + 1}\t2026-07-${day}\t\t5\t40\t${index}`;
    }).join("\r\n")}\r\n`;

    const parsed = parseTaskTsv(tsv, calendarSource);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(10);
    expect(parsed.rows[0]).toEqual({
      title: "Imported task 1",
      startIso: "2026-07-01",
      finishIso: "2026-07-07",
      durationDays: 5,
      durationMinutes: 2400,
      workHours: 40,
      percentComplete: 0
    });
    expect(parsed.fingerprint).toBe(parseTaskTsv(tsv.replace("\r\n", "\n"), calendarSource).ok
      ? (parseTaskTsv(tsv.replace("\r\n", "\n"), calendarSource) as { fingerprint: string }).fingerprint
      : "");
  });

  it("rejects the whole TSV before command generation when any cell is invalid", () => {
    const parsed = parseTaskTsv([
      "Valid task\t2026-07-01\t\t5\t40\t0",
      "Bad task\t2026-07-02\t2026-07-01\t5\t40\t101"
    ].join("\n"));

    expect(parsed).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ row: 2, column: "finish", message: expect.any(String) }),
        expect.objectContaining({ row: 2, column: "progress", message: expect.any(String) })
      ])
    });
  });

  it("derives stable project-scoped task ids for idempotent TSV retries", () => {
    expect(createTaskTsvId("project-a", "tsv-abc", 0)).toBe(
      createTaskTsvId("project-a", "tsv-abc", 0)
    );
    expect(createTaskTsvId("project-a", "tsv-abc", 0)).not.toBe(
      createTaskTsvId("project-a", "tsv-abc", 1)
    );
    expect(createTaskTsvId("project-a", "tsv-abc", 0)).not.toBe(
      createTaskTsvId("project-b", "tsv-abc", 0)
    );
  });
  it("builds one stable atomic create/progress command list", () => {
    const parsed = parseTaskTsv("Imported task\t2026-07-01\t\t5\t40\t25", calendarSource);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const commands = buildPasteCommands({
      projectId: "project-1",
      rows: parsed.rows,
      createId: () => "task-import-1"
    });

    expect(commands).toEqual([
      {
        type: "task.create",
        payload: {
          id: "task-import-1",
          projectId: "project-1",
          parentTaskId: null,
          title: "Imported task",
          statusId: "todo",
          plannedStart: "2026-07-01",
          plannedFinish: "2026-07-07",
          durationMinutes: 2400,
          workMinutes: 2400,
          assignments: []
        }
      },
      {
        type: "task.update_progress",
        payload: { taskId: "task-import-1", percentComplete: 25 }
      }
    ]);
  });

  it("uses the effective six-hour project calendar for TSV duration and default work", () => {
    const parsed = parseTaskTsv(
      "Six hour task\t2026-07-06\t\t2\t\t0",
      sixHourCalendarSource
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]).toMatchObject({
      finishIso: "2026-07-07",
      durationDays: 2,
      durationMinutes: 720,
      workHours: 12
    });

    const [createCommand] = buildPasteCommands({
      projectId: "project-1",
      rows: parsed.rows,
      createId: () => "task-six-hour"
    });
    expect(createCommand).toMatchObject({
      type: "task.create",
      payload: {
        durationMinutes: 720,
        workMinutes: 720
      }
    });
  });

  it("skips weekend days when deriving a TSV finish date", () => {
    const parsed = parseTaskTsv(
      "Weekend task\t2026-07-10\t\t2\t12\t0",
      sixHourCalendarSource
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]).toMatchObject({
      finishIso: "2026-07-13",
      durationMinutes: 720
    });
  });

  it("skips project calendar exceptions when deriving a TSV finish date", () => {
    const parsed = parseTaskTsv(
      "Holiday task\t2026-07-10\t\t2\t12\t0",
      {
        ...sixHourCalendarSource,
        calendarExceptions: [{
          id: "holiday",
          calendarId: "calendar-six-hour",
          resourceId: null,
          date: "2026-07-13",
          workingMinutes: 0,
          reason: "holiday"
        }]
      }
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]).toMatchObject({
      finishIso: "2026-07-14",
      durationMinutes: 720
    });
  });

  it("previews sequential finish dates across a weekend as one batch", () => {
    const result = buildFinishDateFillCommands({
      firstFinishIso: "2026-07-10",
      mode: "series",
      rows: [
        { id: "task-1", startIso: "2026-07-01", durationDays: 5, workHours: 40 },
        { id: "task-2", startIso: "2026-07-02", durationDays: 5, workHours: 20 },
        { id: "task-3", startIso: "2026-07-03", durationDays: 5, workHours: 40 }
      ],
      assignments: [],
      calendarSource
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.map((item) => item.finishIso)).toEqual([
      "2026-07-10",
      "2026-07-13",
      "2026-07-14"
    ]);
    expect(result.commands.filter((command) => command.type === "task.update_schedule")).toHaveLength(3);
    expect(result.commands.filter((command) => command.type === "task.update_work_model")).toHaveLength(3);
  });

  it("blocks the complete date-fill batch when a destination is not after task start", () => {
    const result = buildFinishDateFillCommands({
      firstFinishIso: "2026-07-01",
      mode: "same",
      rows: [
        { id: "task-1", startIso: "2026-07-01", durationDays: 5, workHours: 40 },
        { id: "task-2", startIso: "2026-06-20", durationDays: 5, workHours: 40 }
      ],
      assignments: [],
      calendarSource
    });

    expect(result).toEqual({
      ok: false,
      errors: [{ taskId: "task-1", message: "Окончание должно быть позже начала" }]
    });
  });
});

describe("schedule keyboard guards", () => {
  it("navigates rows without wrapping", () => {
    const ids = ["task-1", "task-2", "task-3"];

    expect(getScheduleNavigationTarget(ids, "task-2", "ArrowDown")).toBe("task-3");
    expect(getScheduleNavigationTarget(ids, "task-3", "ArrowDown")).toBe("task-3");
    expect(getScheduleNavigationTarget(ids, "task-2", "ArrowUp")).toBe("task-1");
    expect(getScheduleNavigationTarget(ids, "task-2", "Home")).toBe("task-1");
    expect(getScheduleNavigationTarget(ids, "task-2", "End")).toBe("task-3");
  });

  it("resolves a literal downward finish-date drag into sequential target rows", () => {
    expect(
      resolveFinishFillDrag({
        rowIds: ["task-a", "task-b", "task-c", "task-d"],
        sourceId: "task-a",
        targetId: "task-c",
        sourceFinishIso: "2026-07-06"
      })
    ).toEqual({
      targetIds: ["task-b", "task-c"],
      firstFinishIso: "2026-07-07"
    });
    expect(
      resolveFinishFillDrag({
        rowIds: ["task-a", "task-b"],
        sourceId: "task-b",
        targetId: "task-a",
        sourceFinishIso: "2026-07-06"
      })
    ).toBeNull();
  });
  it("runs compensating undo only for the latest editable commit", () => {
    expect(shouldRunScheduleUndo({ canManage: true, busy: false, canUndo: true, currentVersion: 8, afterVersion: 8, editableTarget: false })).toBe(true);
    expect(shouldRunScheduleUndo({ canManage: false, busy: false, canUndo: true, currentVersion: 8, afterVersion: 8, editableTarget: false })).toBe(false);
    expect(shouldRunScheduleUndo({ canManage: true, busy: true, canUndo: true, currentVersion: 8, afterVersion: 8, editableTarget: false })).toBe(false);
    expect(shouldRunScheduleUndo({ canManage: true, busy: false, canUndo: true, currentVersion: 9, afterVersion: 8, editableTarget: false })).toBe(false);
    expect(shouldRunScheduleUndo({ canManage: true, busy: false, canUndo: true, currentVersion: 8, afterVersion: 8, editableTarget: true })).toBe(false);
  });
});
