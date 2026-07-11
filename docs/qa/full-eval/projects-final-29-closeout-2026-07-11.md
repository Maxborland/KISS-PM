# Projects Full Evaluation: final 29 closeout

Date: 2026-07-11

## Result

- Coverage matrix: **223 pass / 0 non-pass**.
- This atomic block closed the final **29** rows across Calendars, Scenarios, Commits, Settings, and Project Creation.
- Every closed row is bound to a fresh browser/API/data-state receipt under `.superloopy/evidence/project-final-29-2026-07-11/`.

## Product changes proved by the traversal

- Calendar resource rules are scoped to the selected project calendar; exceptions from another calendar no longer leak into badges or the grid.
- Plan Reader receives explicit scenario-preview permission in the dev/evaluation role while apply remains denied.
- Scenario preview always returns the stable aggressive/balanced/resilient contract, with unavailable profiles represented explicitly.
- Commits history has a project-scoped read endpoint for `project_plan.read`; it returns a minimal DTO without commands, before-state, permission payloads, absence reasons, or accepted-risk text. The general tenant audit endpoint remains protected.
- Project settings expose persisted custom WBS field definitions with preview/apply, readback, reload, role denial, server-side project-only filtering, and race-safe delete (`200/404`).
- Project creation is reachable from the project list and is covered through CRM creation, feasibility, activation, duplicate/race behavior, readback, reload, and cleanup.

## Fresh live traversal

| Lane | Matrix rows | Browser result | Evidence |
|---|---:|---:|---|
| Calendars | 5 | 2/2 Playwright tests passed | `.superloopy/evidence/project-final-29-2026-07-11/calendars/` |
| Scenarios | 7 | 4/4 Playwright tests passed | `.superloopy/evidence/project-final-29-2026-07-11/scenarios/` |
| Commits | 6 | 2/2 Playwright tests passed | `.superloopy/evidence/project-final-29-2026-07-11/commits/` |
| Settings | 10 | 1/1 Playwright test passed | `.superloopy/evidence/project-final-29-2026-07-11/settings/` |
| Project creation | 1 | 1/1 Playwright test passed | `.superloopy/evidence/project-final-29-2026-07-11/creation/` |

All write lanes used `KISS_PM_E2E_DISPOSABLE_DATABASE=1`. Scenario apply ran last on a freshly migrated and seeded database because the accepted-overload marker is intentionally immutable.

## Evidence checks

- All JSON receipts and run manifests in the final evidence root have `status: pass` and no blocker.
- Stale diagnostic `BLOCKER` screenshots were removed after successful reruns.
- All 29 updated matrix references resolve to existing artifacts.
- Screenshot paths inside nested Calendars and Commits receipts are explicitly marked `screenshotPathBase: lane_root`; identical screenshots are allowed when two assertions intentionally capture the same stable page state.
- The authoritative matrix is `docs/qa/full-eval/projects-coverage-matrix-2026-07-10.json`.

## Residual scope

No matrix rows remain unverified, partial, blocked, failed, or historical-only. This closes the Projects Full Evaluation matrix; further work is regression hardening rather than unfinished evaluation coverage.
