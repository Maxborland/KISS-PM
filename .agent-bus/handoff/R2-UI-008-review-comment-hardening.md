# R2-UI-008 Review Comment Hardening Handoff

Completed: 2026-05-17T21:01:25+07:00
Branch: `codex/r2-exit-evidence`
Task: `R2-UI-008-review-comment-hardening`

## Status

Completed. Remaining useful/relevant Codex PR comments across PR #3..#9 were processed after the existing Release 2 fixes.

## Changed

- Shared operational grid row actions no longer bubble Enter/Space keydown to row selection.
- Project Gantt clears stale command failure/readback state on successful reopen and derives the default today marker from the local clock.
- Resource Load clears stale overload detail before fetching another cell detail and disables preview until the selected detail matches the selected overload.
- Closed Portfolio retrospective summary now requests all trend pages before computing highest severity.
- Tenant Admin saved-view runtime removals are warnings, not publish blockers.
- E2E-R2-006 now exercises the KPI Deviation UI before proving accepted-risk action/audit via P8 APIs.
- Release 2 matrix verifier now rejects stale E2E metadata relative to matrix `updated_at` and required Release 2 E2E spec files.

## Verification

- `npm test -- apps/web/src/operationalSurfacePrimitives.test.tsx apps/web/src/GanttControlSurface.test.tsx apps/web/src/ResourceLoadControlSurface.test.tsx apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx apps/web/src/SavedViewLayoutBuilderSurface.test.tsx scripts/verify-requirements-matrix.test.ts` -> passed, 6 files / 122 tests.
- `node scripts/run-e2e.mjs release2` -> passed, 10/10 tests.
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` -> passed.
- `npm run typecheck` -> passed.
- `git diff --check` -> passed; only warning was `.agent-bus/queue.json` CRLF normalization.
- `node scripts/agent-bus-guard.mjs --task R2-UI-008-review-comment-hardening --once` -> passed after write_scope was corrected.

## Risks / Follow-up

- Current changes are on top of `codex/r2-exit-evidence`. For clean stacked PR hygiene, split or cherry-pick the touched files back into the originating PR branches before merging, or keep them as a final top-stack hardening commit if that is acceptable.
- Untracked scratch artifacts remain intentionally untouched:
  - `.superpowers/brainstorm/951-1778994612/`
  - `.superpowers/brainstorm/visual-r2-20260517121053/state/`
  - `docs/bitrixreports_surfaces_kisspm_transfer_package.zip`
