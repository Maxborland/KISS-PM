# Projects Shell, List, Detail and Overview Closeout - 2026-07-11

## Scope

Literal traversal covers all 68 discovered `role x scenario` rows for `PROJ-001..PROJ-030`: shared workspace shell, `/projects`, `/projects/:id`, project chrome and `/projects/:id/overview`. Roles: admin, planReader and resourceReader. No historical row was promoted without fresh row-specific evidence.

## Result

- Final run: `project-shell-overview-20260711-literal-final3`.
- Browser: 7/7 serial Playwright bundles passed; 68/68 receipt rows are `pass`.
- Receipt: 68 unique keys, 170 executed assertions, 249 path-unique and SHA-256-content-unique scenario-state screenshots, 0 pending, 0 missing files. Each image carries a visible test-only scenario/role/state evidence stamp.
- Source hashes stayed stable for guarded product files during the run.
- Global project matrix: 169 pass and 54 non-pass across 223 rows.

## What Was Exercised

- Role-aware shell links and redirects, ACL-filtered global search, user menu/logout and all nine project tabs.
- Projects loading, exact live row fields/formats, active-only scope, native navigation, empty, HTTP 500, network, malformed JSON, retry and forbidden states.
- Project detail canonical selection, URL/reload/back/forward readback, exact live fields/tasks/order, nullable/unknown/clamped edges, 404, error/retry/403 and a real newly activated zero-task project.
- Overview exact KPIs, signal order and five CTA destinations, milestones, key tasks, commit loading/ready/empty/403/error, timezone-bound overdue behavior and loading/error/retry/404/403 state separation.
- API and data readback for relevant roles. The zero-task write flow used the disposable database through opportunity feasibility and activation.

## Findings And Fixes

- `FE-PROJ-001` high: malformed successful JSON was treated as valid empty data. `createRequestJson` now throws `DomainApiError("invalid_json_response")`; regression test added.
- `FE-PROJ-002` medium: empty milestones and open key tasks had no explicit copy. Both now render dedicated empty states.
- `FE-PROJ-003` medium: projects list exposed raw network exception text. Error copy now uses an allowlist of localized API codes and a safe Russian fallback.
- `FE-PROJ-004` medium: project detail exposed raw network exception text and had no malformed-JSON localization. Both paths now use safe localized copy.
- `FE-PROJ-005` medium: completed critical tasks could leak into no-slack planning signals. Done tasks are excluded.
- `FE-PROJ-006` low: Overview task count used an incorrect fixed noun form. Russian singular/paucal/plural forms are now selected correctly.
- `FE-PROJ-007` medium: key-task finish could disappear when the derived critical record had no finish. It now falls back to the task planned finish.
- `FE-PROJ-008` low: project-detail text progress could disagree with its clamped progress bar. Both now clamp to `0..100`.
- Oracle reconciliation: the current UI calls the project-detail demand mode `Спрос`; matrix and tests now use that term.

## Evidence And Verification

- Receipt: `.superloopy/evidence/project-shell-overview-2026-07-11/project-shell-overview-machine.json`.
- Screenshots: `.superloopy/evidence/project-shell-overview-2026-07-11/proj-*.png`.
- Final browser command: `pnpm exec playwright test e2e/full-eval/projects-shell-overview-closeout.spec.ts --workers=1 --reporter=line` - 7 passed in 1.6 minutes.
- Disposable DB planning route suite - 31/31 passed immediately before the final browser cycle; seed refreshed.
- Focused domain, list, detail and Overview tests plus typecheck/build are recorded in the final commit report.
- Independent final audits: `agent-spec-review-final3.md` and `agent-matrix-review-final3.md` in the evidence directory.

## Remaining

Nothing inside this 68-row target set remains unverified after the final audits pass. Outside this closeout the global project matrix has 54 non-pass rows: 40 historical-evidence-only, 10 fail, 2 blocked, 1 partial and 1 unverified. They require their own fresh role/browser/API/data evidence before promotion.
