# Schedule calendar semantics H4

## Status

PASS for the bounded non-surface slice. schedule-surface.tsx was not edited.

## Changes

- schedule-working-time.ts mirrors the scheduling engine calendar order:
  task calendar, project calendar, first calendar, engine fallback.
- Effective calendar exceptions are global entries with resourceId null, matching the
  domain scheduler.
- Date/minute calculations use shared @kiss-pm/domain helpers: addDays,
  startOfWorkingDate, endOfWorkingDate, and diffWorkingMinutes.
- mapRows converts authored duration, successor lag, and calculated slack with the
  effective task calendar workingMinutesPerDay.
- dayStart, dayDur, baseline geometry, and summary spans remain calendar-day geometry.
- Row exposes durationMinutes, effectiveCalendarId, and workingMinutesPerDay for surface
  command builders.
- Finish fill normalizes weekends and holidays to working dates, advances series through
  working dates, calculates inclusive working duration with exceptions, and preserves the
  prior work/duration ratio without multiplying by 480.
- Missing calendarSource returns an explicit error instead of applying a hidden fallback.

## Verified scenarios

- 6-hour task calendar: 720 minutes displays as 2 days.
- Per-task override wins over the 8-hour project calendar.
- Friday to Monday is 2 working days while Gantt geometry remains 3 calendar days.
- Sequential fill after Friday produces Friday, Monday, Tuesday.
- A Monday holiday exception normalizes finish to Tuesday.
- Holiday-fill commands contain 720 duration/work minutes and pass reducePlanningCommand
  followed by calculatePlan.
- Preview finish, calculatedFinish, and visible mapRows finishIso agree.
- Successor lag 360 and slack 360 display as 1 day on a 6-hour calendar.

## Fresh verification

    pnpm vitest run apps/web/src/delivery/schedule/schedule-calendar-semantics.test.ts apps/web/src/delivery/schedule/schedule-productivity.test.ts apps/web/src/delivery/schedule/schedule-rows.test.ts
    PASS: 3 files, 12 tests

    pnpm vitest run packages/domain/src/planning/workingTime.test.ts packages/domain/src/planning/schedulingEngine.test.ts
    PASS: 2 files, 16 tests

    pnpm --filter @kiss-pm/web typecheck
    PASS

    pnpm --filter @kiss-pm/domain typecheck
    PASS

    git diff --check -- OWNED_TRACKED_FILES
    PASS, with only existing CRLF-to-LF warnings

## Required schedule-surface.tsx integration

The current fillPreview call must pass the calendar source and exact row minutes:

    buildFinishDateFillCommands({
      firstFinishIso: fillDate,
      mode: fillMode,
      rows: selectedFillRows.map((row) => ({
        id: row.id,
        startIso: row.startIso,
        durationDays: row.durDays,
        durationMinutes: row.durationMinutes ?? undefined,
        workHours: row.workH,
        calendarId: row.effectiveCalendarId
      })),
      assignments: authoredAsgs,
      calendarSource: readModel
    });

Other H4 surface conversions should use the same API:

    const workingTime = resolveScheduleWorkingTime(
      readModel,
      row.effectiveCalendarId
    );
    const durationMinutes = days * workingTime.workingMinutesPerDay;
    const normalizedFinish = scheduleWorkingDateOnOrAfter(
      requestedFinish,
      workingTime
    );
    const resizedDurationMinutes = scheduleWorkingMinutesThroughDate(
      startIso,
      normalizedFinish,
      workingTime
    );

These calls are still required in workCmd and duration/work/units editing, editFinish,
left/right bar resize, dependency add/upsert using the successor calendar, TaskModal
create/edit, and the optimistic schedule patch. Pixel calculations for dayStart/dayDur,
drag delta, and bar width must remain calendar-day based. Current HPD, MIN_PER_DAY, and
calendar-span multiplication in schedule-surface.tsx remain owned by the other worker.

## Scope

Changed:

- apps/web/src/delivery/schedule/schedule-rows.ts
- apps/web/src/delivery/schedule/schedule-productivity.ts
- apps/web/src/delivery/schedule/schedule-working-time.ts
- apps/web/src/delivery/schedule/schedule-productivity.test.ts
- apps/web/src/delivery/schedule/schedule-calendar-semantics.test.ts
- this evidence artifact

Not changed: API, Saved Views, matrix, product docs, or schedule-surface.tsx.
The fixed TSV import conversion in buildPasteCommands was outside the explicitly assigned
duration/lag/slack/finish-fill slice and remains unchanged.

## CodeGraph change index

Before work, after mandatory initial sync:

- files: 2231
- nodes: 24865
- edges: 52911

After source sync:

- files: 2237
- nodes: 25041
- edges: 53334

The global delta includes parallel workers and is not attributed wholly to this slice.
Owned index:

- Added types/constants: ScheduleCalendarSource, ScheduleWorkingTime, DEFAULT_CALENDAR.
- Added functions: resolveScheduleWorkingTime, scheduleWorkingDays,
  scheduleWorkingDateOnOrAfter, nextScheduleWorkingDate,
  scheduleWorkingMinutesThroughDate.
- Changed symbols: Row, mapRows, FinishFillRow, buildFinishDateFillCommands.
- Removed symbols: none.
- Removed edge: schedule-rows.ts to mock MIN_PER_DAY.
- Added edges: rows/productivity to the working-time helper; helper to domain addDays,
  startOfWorkingDate, endOfWorkingDate, and diffWorkingMinutes.
- Added test edges: calendar regression to buildFinishDateFillCommands,
  reducePlanningCommand, calculatePlan, and mapRows.

CodeGraph search after sync resolves all new helper symbols and both owned callers.

## Integration

Terminal verdict: PASS.

schedule-surface.tsx now uses effective task/project calendar semantics at every assigned
conversion site:

- work command and duration/work/units editing use Row.workingMinutesPerDay and exact
  durationMinutes;
- finish editing and both bar resize directions use working date ranges plus exceptions;
- bar move preserves exact working duration while pixel drag remains calendar-day based;
- dependency lag uses the successor task working day;
- TaskModal create/edit derives duration and finish from the effective calendar;
- inline create uses the effective project working day instead of an 8-hour default;
- fillPreview passes calendarSource, effectiveCalendarId, and exact durationMinutes;
- optimistic work-model patch derives finish through working time and schedule patch no
  longer mutates duration/work from a calendar span;
- units display uses the selected row calendar rather than HPD.

The helper now accepts partial read-model fixtures safely: missing calendars,
calendarExceptions, project, or calendarId use empty collections and the same
default-calendar fallback as the scheduling engine. Real configured calendars and global
exceptions retain precedence.

No HPD or MIN_PER_DAY reference remains in schedule-surface.tsx. The existing literal 480
in the planning-resource directory projection was preserved because it belongs to the
parallel resource UI integration, not Schedule task calendar conversion.

Fresh integration verification:

    pnpm --filter @kiss-pm/web exec vitest run src/delivery/schedule
    PASS: 9 files, 38 tests

    pnpm --filter @kiss-pm/web typecheck
    PASS

Navigation-guard tests still print localhost ECONNREFUSED/ECONNRESET diagnostics while
passing; the suite exit code is 0.

Integration-focused coverage now verifies:

- 6-hour TaskModal create produces 720 minutes and Friday-to-Monday finish;
- work and dependency commands use 360-minute days;
- weekend plus Monday holiday normalizes resize finish to Tuesday;
- move preserves one working day across weekend/holiday;
- optimistic schedule update preserves duration/work;
- optimistic work update recalculates finish through working time;
- partial read models fall back without crashing permission/navigation surfaces.

Integration CodeGraph index after sync:

- files: 2237
- nodes: 25054
- edges: 53355

Added/changed integration symbols:

- added: resolveScheduleTiming, buildScheduleWorkCommand,
  buildScheduleDependencyCommand, buildScheduleRangeCommands,
  buildScheduleMoveCommand, scheduleUnitsPercent;
- changed: optimisticPatch, ProjectSchedule, ScheduleCalendarSource,
  resolveScheduleWorkingTime;
- added helper: scheduleFinishDateForDuration;
- added edges: schedule-surface to all Schedule working-time helpers and focused tests to
  the surface command builders;
- removed surface conversion edges: HPD and mock MIN_PER_DAY.

Pixel geometry remains based on dayStart, dayDur, isoToDay, dayToIso, and day width.
No API, E2E, matrix/docs, Saved Views component, resource hook, or editors were edited.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-calendar-semantics.md
