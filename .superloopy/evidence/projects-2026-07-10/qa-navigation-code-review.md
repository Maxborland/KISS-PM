# Final navigation code review

## Findings

No blocking or non-blocking findings in the reviewed navigation diff.

The previous finding about a persistent schedule history sentinel is resolved.

## Decision

**APPROVE.** The current implementation satisfies the requested native-link, audit-state, staged-navigation, history, and type-safety contracts.

## Evidence

- `apps/web/src/delivery/schedule/schedule-surface.tsx:366-379` defines `consumeNavigationSentinel`, verifies the project-scoped marker, traverses back once, and runs the continuation only after `popstate`.
- `apps/web/src/delivery/schedule/schedule-surface.tsx:442-462` guards ordinary same-tab anchors in document capture. Cancel blocks the original event and preserves staged state. Confirm restores the captured base, blocks the original event, consumes the sentinel, then replays the exact anchor click once.
- The anchor bypass is scoped to the exact replayed element. Modified primary clicks and non-primary clicks return before prompting, preserving native new-tab/window behavior.
- `apps/web/src/delivery/schedule/schedule-surface.tsx:388` consumes the sentinel after staged apply; `:415-420` consumes it on discard before clearing/reloading. The previous duplicate Back step is therefore not left current after apply/discard.
- `apps/web/src/delivery/schedule/schedule-surface.tsx:463-476` retains the two-step Back contract: Cancel restores the sentinel with `history.go(1)`; confirm resets staged state and continues to the preceding history entry.
- The staged-only effect still scopes `beforeunload`, document capture, and `popstate`; cleanup removes all three long-lived listeners.
- Tabs, the internal `Baseline` CTA, and `WorkspaceShell` links are covered by the document-level guard without replacing their native hrefs.
- Project-list titles remain native links to the existing `/projects/[id]` card route. Delivery links retain exact `/projects/[id]/<slug>` hrefs and selected-tab semantics.
- The live audit client preserves `DomainApiError` status/code/body for HTTP 403. Overview loading, successful-empty, forbidden, and generic-error history states remain distinct.
- Confirmed navigation resets the optimistic base without `apply`, `applyBatch`, `reload`, or an API write.

## Test evidence

- Fresh focused run: **9 test files, 35/35 tests passed**.
- Schedule guard file: **9/9 tests passed**, including exact anchor replay after sentinel consumption, apply consumption, discard consumption, tab/Baseline/sidebar Cancel, modified/middle clicks, Back Cancel/confirm, and staged-only `beforeunload`.
- Fresh web typecheck: `pnpm --filter @kiss-pm/web exec tsc -p tsconfig.json --noEmit --pretty false` passed.
- Scoped `git diff --check` passed; only existing CRLF conversion warnings were reported.
- Live evidence `.superloopy/evidence/projects-2026-07-10/projects-navigation.json` is newer than the reviewed schedule source and guard test: **23/23 PASS, 0 FAIL, 0 INCONCLUSIVE**.

## Commands run

- `codegraph sync` before review.
- Current focused product/test diff inspection and line-level sentinel lifecycle review.
- Focused Vitest command for the nine navigation/permission test files.
- Web `tsc --noEmit`.
- Scoped `git diff --check`.
- Live evidence mtime and summary inspection.
- `codegraph sync` after report update.

## Change index

- Product code, tests, docs, matrix, and lockfiles were reviewed read-only and were not edited.
- Updated only `.superloopy/evidence/projects-2026-07-10/qa-navigation-code-review.md`.
- Reviewed changed symbols: `ProjectSchedule`, `consumeNavigationSentinel`, `resetStagedReadModel`, `discardStaged`, `guardAnchorNavigation`, and `guardHistoryTraversal`.
- CodeGraph product nodes/edges before -> after: unchanged by this review. The Markdown report adds no code symbols or call/reference edges.

SUPERLOOPY_AUDIT
