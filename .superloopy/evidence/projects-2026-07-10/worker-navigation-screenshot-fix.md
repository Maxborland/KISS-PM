# Evidence: navigation route screenshots

- Date: 2026-07-10
- Status: PASS
- Scope: `e2e/full-eval/projects-navigation.spec.ts` only; no product code, other tests, matrix, or server processes touched.

## Change

- Each delivery-route screenshot is captured after the target route settles and before `page.goBack()`.
- `screenshotWritten` becomes `true` immediately after a successful `page.screenshot()`.
- The `finally` branch captures only when `screenshotWritten` is still `false`; it remains a failure-path fallback.

## Verification

1. `pnpm exec playwright test e2e/full-eval/projects-navigation.spec.ts --list`
   - Exit code: 0
   - Result: 1 Chromium test listed from 1 file.
2. Static route-loop order check
   - Exit code: 0
   - Result: `PASS screenshot-before-goBack; fallback-only-in-finally; screenshotCalls=2`
   - Asserted order: main screenshot -> written flag -> `goBack` -> `finally` -> fallback guard -> fallback screenshot.
3. `git diff --check -- e2e/full-eval/projects-navigation.spec.ts`
   - Exit code: 0

## Change Index

- Files changed by this slice:
  - `e2e/full-eval/projects-navigation.spec.ts`
  - `.superloopy/evidence/projects-2026-07-10/worker-navigation-screenshot-fix.md`
- Symbols:
  - Changed anonymous Playwright test body for Projects navigation.
  - Added local route-loop state `screenshotPath` and `screenshotWritten`.
  - Added/removed top-level symbols: 0/0.
- CodeGraph:
  - Pre-change `codegraph sync`: already up to date.
  - Post-change `codegraph sync`: already up to date.
  - Indexed structural delta for this local control-flow change: nodes 0 -> 0 added/removed; edges 0 -> 0 added/removed.
  - Repository snapshot: 24,772 nodes; 53,116 edges.

## Constraints

- Live server was not started, stopped, or reused.
- Full live execution was intentionally not run; assignment required `--list` plus static ordering proof.
- Existing concurrent edits in the spec were preserved.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-screenshot-fix.md
