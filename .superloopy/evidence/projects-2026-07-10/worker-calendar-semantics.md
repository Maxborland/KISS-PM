# Calendar semantics hardening

Status: PASS

## Fixed

- Project calendar resolution now uses only `project.calendarId`.
- Unknown or missing calendar IDs no longer fall back to the first tenant calendar or fabricated `cal-5x8`.
- Calendars shows an explicit non-writable missing-calendar state.
- Assignments uses the selected calendar's weekdays, daily minutes and exact calendar exceptions for allocation curves.
- Resources creates absences only on the selected calendar's working dates and skips project holidays.
- Resource absence controls are absent when the project calendar is not configured.
- Calendar labels and cell hours are derived from the live calendar instead of fixed Monday-Friday / 8 hours.

## Evidence

- Focused Vitest: 4 files, 5 tests passed.
- Non-5x8 fixture: Tuesday-Saturday, 6 hours/day; Saturday enabled, Monday disabled.
- Web TypeScript: passed.
- Live Chromium regression on web 3180 / API 4191: 6 passed across Assignments, Calendars and Resources for ADMIN and PLAN.
- In-app browser readback: project calendar rendered Monday-Friday / 8 hours from the actual seeded calendar, not constants.
- Responsive browser checks:
  - 390x844: viewport 390, document 375, main 375, no horizontal overflow.
  - 768x1024: viewport 768, document 753, main 521, no horizontal overflow.
  - 1280x900: viewport 1280, document 1280, main 1048, no horizontal overflow.
- Screenshots: `calendar-semantics-viewport-390.png`, `calendar-semantics-viewport-768.png`, `calendar-semantics-viewport-1280.png`.
- `git diff --check`: passed for owned files.

## Notes

The repository has no DESIGN.md token contract. This patch introduces no new raw colors, font sizes, radii or shadows and reuses the existing CSS-variable component language. The anti-slop review found no new visual pattern; the work changes product states and dynamic labels only.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-calendar-semantics.md
