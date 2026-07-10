# Projects Schedule Closeout - 2026-07-10

## Scope

Literal browser/API/data closeout for the project Schedule surface. Coverage is the full discovered Schedule target set: 40 `role x scenario` rows grouped into 11 executable bundles (C01-C11), with no sampling and no reuse of stale evidence.

Roles:

- `admin` - all read and write flows.
- `planReader` - read-only UI plus direct API denial checks.

## Result

- Machine receipt: `.superloopy/evidence/schedule-closeout-2026-07-10/schedule-closeout-machine.json`
- Fresh run: `schedule-closeout-20260710-final4`
- Browser bundles: `11/11 pass`
- Matrix rows: `40/40 pass`
- Duplicate row keys: `0`
- Rows without assertions or screenshots: `0`
- Source hash changes during run: `0` across 32 guarded files
- Unique screenshots referenced by rows: `31`

The project matrix moved from 80 to 120 pass rows. The remaining non-pass rows belong to other project surfaces and are not claimed by this closeout: 41 fail, 56 historical-evidence-only, 4 blocked, 1 partial, and 1 unverified.

## Closed Findings

### SCH-01 - Incomplete task authoring and hierarchy

Severity: high. Affected role: admin. Scenarios: task/subtask create, modal edit, inline edit, quick-create, indent/outdent, hierarchy readback.

Result: fixed and verified through persisted API readback, reload, keyboard navigation, parent-child-grandchild creation, and exact command envelopes.

### SCH-02 - Batch, validation, optimistic, and conflict integrity

Severity: high. Affected role: admin. Scenarios: staged batch apply/reset, validation rollback, simultaneous operation guard, optimistic commit, single-edit conflict, batch conflict, explicit retry.

Result: fixed and verified. Failed writes leave the authoritative plan unchanged; multi-row and global validation errors remain visible; concurrent writes return explicit conflicts; no silent retry occurs.

### SCH-03 - Dependency, Gantt, calendar, and baseline semantics

Severity: high. Affected roles: admin and planReader. Scenarios: dependency create/edit/delete, lag/type, Gantt move/resize/progress/link, working-time calculations, timeline geometry, baseline capture/recapture.

Result: fixed and verified against API dates, exact geometry, version increments, reload, and cross-surface baseline equality.

### SCH-04 - Saved WBS view races and permissions

Severity: high. Affected roles: admin and planReader. Scenarios: create/rename/delete, same-key replay, divergent payload, case-insensitive duplicate, private/shared visibility, corrupt payload, read-only selection.

Result: fixed and verified. Database uniqueness and idempotency cover true concurrent writes; reader mutations are denied without data changes; invalid saved payloads fail honestly.

### SCH-05 - Read-only and accessibility gaps

Severity: medium. Affected role: planReader. Scenarios: all Schedule mutation controls, keyboard mutation attempts, direct preview/apply, desktop/mobile surface states, inspector and dialogs.

Result: fixed and verified. Mutation controls are absent, API writes return 403 with stable readback, and the current-surface axe sweep reports no critical violations in tested states.

## Fresh Evidence

- Browser: `pnpm exec playwright test e2e/full-eval/projects-schedule-closeout.spec.ts --workers=1 --reporter=line` - 11 passed in 3.1 minutes.
- Database: disposable `/kiss_pm_projects_test`; migrations current; `apps/api/src/planningRoutes.db.test.ts` - 31 passed.
- Receipt validation: 40 rows, 40 pass, 0 duplicate keys, 0 invalid rows, 0 source hash differences.
- Screenshots and lane reports: `.superloopy/evidence/schedule-closeout-2026-07-10/`.

## Residual Risks

- A fresh independent subagent review could not be started because the host returned `agent thread limit reached` on every retry. The orchestrator performed the receipt and source-hash audit directly; this is not represented as independent evidence.
- The global project matrix still contains 103 non-pass rows outside Schedule. Their old statuses must be reconciled only against fresh evidence for their own surfaces.
- LiveKit/Jitsi/media behavior is outside this Schedule closeout and remains governed by its separate media evidence and global matrix status.

## Next Fix Batches

1. Project shell, list, detail, and Overview: 41 current fail rows are concentrated here and in shared project chrome.
2. Resources, Assignments, and Calendars: replace historical-only evidence with fresh role/write/readback coverage.
3. Scenarios, Commits, and Settings: close the blocked/partial rows and custom WBS fields.
4. Project creation workflow: the single remaining unverified row.
