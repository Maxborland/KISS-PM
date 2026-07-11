# QA navigation browser/evidence audit

**Verdict: APPROVE**

The two prior REJECT findings are closed in the current specs and fresh artifacts. Navigation screenshots are captured on the target route before history restoration. The role matrix now asserts exact expected state, reports the visible error surfaces as errors, and fails screenshot errors without dropping rows.

## Scope and method

- Read-only inspection of e2e/full-eval/projects-navigation.spec.ts, e2e/full-eval/projects-role-routes.spec.ts, both JSON reports, all 64 PNG artifacts, and the relevant current navigation/sentinel diff.
- Visual inspection of all nine navigation screenshots and representative ready, empty, error, and forbidden role screenshots.
- Independent in-app browser sentinel check on the live schedule surface.
- Focused sentinel unit run: pnpm vitest run apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx.
- Auditor edited only this report.

## Freshness

| Artifact | Evidence time (UTC) | Relevant source cutoff (UTC) | Result |
|---|---:|---:|---|
| projects-navigation.json | 2026-07-10T05:18:46.517Z | navigation spec 05:10:59.423Z; sentinel code 05:14:18.447Z | fresh |
| navigation screenshots, 9/9 | 05:18:24.835Z to 05:18:36.726Z | navigation spec 05:10:59.423Z | fresh, non-empty |
| projects-role-routes.json | 2026-07-10T05:25:08.354Z | role spec 05:21:08.330Z; sentinel code 05:14:18.447Z | fresh |
| role screenshots, 55/55 | 05:24:43.097Z to 05:25:08.044Z | role spec 05:21:08.330Z | fresh, non-empty |

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| Navigation current run | PASS | 23 total / 23 pass / 0 fail / 0 inconclusive; 9 route rows, 13 navigation checks, 5 signal checks. |
| Native list click/back | PASS | Exact native A/href assertions, click, target URL, and restored /projects history. |
| Nine delivery tabs | PASS | Every route asserts all nine hrefs and one active aria-current; all nine PNGs visually show their named target surface. |
| Five overview signals | PASS | Five individually named current rows, exact expected destinations, click and back. |
| Commits, baseline, conflict cleanup, settings | PASS | Exact CTAs and target URLs; generated conflict CTA is required; cleanup returns HTTP 200 and later calendar evidence has no active conflict. |
| ADMIN true empty | PASS | Live audit-event selection with no planning events and exact visible История пуста. |
| PR live 403 explicit | PASS | Live audit-events response must be 403 and exact forbidden copy must be visible. |
| Role x route current run | PASS | 55 total / 55 pass / 0 fail; states ready 33 / empty 2 / forbidden 11 / error 9; expected/actual mismatches 0. |
| Screenshot integrity | PASS | 64/64 files exist and are non-empty; every row has a screenshot path. Screenshot exceptions set row FAIL, append failure evidence, and rows are still pushed. |
| No skip/retry/inconclusive substitution | PASS | No focused skip/only/fixme or retry override; navigation hard-fails inconclusive; role rows require exact uiState === expectedUiState. |

## Prior findings

### Target screenshot binding: closed

projects-navigation.spec.ts:116-152 now writes the screenshot after target URL and active-tab assertions and before page.goBack(). Visual inspection confirms distinct overview, schedule, resources, assignments, calendars, scenarios, baseline, commits, and settings surfaces.

### Role state masking: closed

projects-role-routes.spec.ts:115-141 records expectedUiState and requires exact equality. detectUiState checks explicit error markers before generic not-found text. getExpectedUiState distinguishes the two beta empty routes from the nine beta delivery error routes. Current screenshots and JSON agree with empty 2 / error 9.

## Staged sentinel assessment

- Current E2E dismisses tab, Baseline CTA, workspace sidebar, and history-back navigation while keeping накоплено: 1, then accepts Leave to settings.
- It verifies the live read model has unchanged planVersion and no task with the staged title.
- Focused sentinel unit suite passed 9/9, covering sentinel consumption for confirmed links, apply, discard, cancel/confirm history traversal, native modified clicks, and beforeunload.
- Independent browser check staged an in-memory task, observed the confirm dialog, dismissed it and remained on schedule with the staged count intact, then accepted it and reached settings. Browser back returned to schedule with no dialog, no staged counter, and no staged task. No apply action was used.

## Change index

- Auditor-modified file: .superloopy/evidence/projects-2026-07-10/qa-navigation-browser-audit.md.
- Product, tests, docs, matrices, JSON, and screenshots modified by auditor: none.
- Markdown report adds no CodeGraph source symbols or dependency edges.

SUPERLOOPY_AUDIT: .superloopy/evidence/projects-2026-07-10/qa-navigation-browser-audit.md
