# R2-UI-007 Release 2 Exit Evidence

Status: done
Phase: R2
Aliases: R2-UI-007, R2-012

## Scope

Implement Release 2 exit evidence without adding product feature scope.

Owned files:

- `e2e/tests/release2/**`
- `scripts/run-e2e.mjs`
- `scripts/verify-requirements-matrix.mjs`
- `docs/status/release2-ui-requirements-matrix.json`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/**`
- `.agent-bus/events/events.jsonl`

## Acceptance

- Release 2 E2E profile/test folder exists and maps `E2E-R2-001..010`.
- Sales-demo first-five-minutes gate has runnable evidence.
- Release 2 matrix verifier support exists or the exact unsupported behavior is documented.
- `docs/status/release2-ui-requirements-matrix.json` records final exit evidence without pretending feature implementation was added in this slice.
- No production UI/API/domain code changes.

## Verification

- RED: `node scripts/run-e2e.mjs release2` initially failed with assertion mismatches in `E2E-R2-004` and `E2E-R2-010`; tests were corrected to the actual UI contract.
- PASS: `node scripts/run-e2e.mjs release2` passed (10 tests, `E2E-R2-001..010`).
- PASS: `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json`
- PASS: `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `git diff --check`
- `node scripts/run-e2e.mjs release2`
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `node scripts/agent-bus-guard.mjs --task R2-UI-007-release2-exit-evidence --once`

## Result

Completed 2026-05-17.

- Added Release 2 E2E profile and metadata extraction for `E2E-R2-*`.
- Added release2 E2E specs covering `E2E-R2-001..010`.
- Added R2-aware matrix verifier support.
- Updated Release 2 matrix, E2E catalog, and sales quality gate evidence.
- No production UI/API/domain changes.
