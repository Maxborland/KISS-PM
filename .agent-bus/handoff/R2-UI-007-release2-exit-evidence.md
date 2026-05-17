# R2-UI-007 Release 2 Exit Evidence Handoff

Task: `R2-UI-007-release2-exit-evidence`
Aliases: `R2-UI-007`, `R2-012`
Branch: `codex/r2-exit-evidence`
Status: completed
Completed: 2026-05-17T19:43:00+07:00

## Changed

- Added `release2` profile to `scripts/run-e2e.mjs`.
- Updated E2E metadata extraction to capture `E2E-R2-*` IDs.
- Added R2-aware verification path to `scripts/verify-requirements-matrix.mjs`.
- Added Release 2 E2E specs under `e2e/tests/release2/` for `E2E-R2-001..010`.
- Updated `docs/status/release2-ui-requirements-matrix.json` so `R2-001..R2-012` are `done` with exit evidence.
- Updated `docs/e2e/E2E_SCENARIOS.md` to point to real release2 specs and `passing` status.
- Updated `docs/product/UX_SALES_QUALITY_GATE.md` with the Release 2 exit command.

## Verification

- RED: `node scripts/run-e2e.mjs release2` failed during test hardening, first with 2 failures and then 1 selector failure; assertions were corrected to the actual UI contract.
- PASS: `node scripts/run-e2e.mjs release2` passed (10 tests, `E2E-R2-001..010`).
- PASS: `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json`
- PASS: `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `git diff --check`

## Decisions

- Kept this slice evidence-only: no production UI/API/domain code changes.
- Used one release2 E2E profile instead of renumbering existing phase E2E IDs.
- R2 verifier support is intentionally separate from P1-P12 phase-exit verifier logic because Release 2 uses `release: "R2"` and `done_evidence`.

## Next

- Merge the stacked PRs in order, then run the release2 E2E profile against the merged branch.
