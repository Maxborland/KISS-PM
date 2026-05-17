# Handoff: R2-CONTRACT-001-release2-ui-control-surfaces-contract

Status: completed
Branch: `docs/release2-ui-control-surfaces-contract`
Date: 2026-05-17

## Changed

- Created `docs/phases/RELEASE_2_UI_CONTROL_SURFACES.md` as the closed Release 2 UI/product release contract.
- Created `docs/status/release2-ui-requirements-matrix.json` with finite planned rows `R2-001..R2-012`.
- Added `E2E-R2-001..010` to `docs/e2e/E2E_SCENARIOS.md` without renumbering existing phase E2E ids.
- Added Release 2 gate criteria to `docs/product/UX_SALES_QUALITY_GATE.md`.
- Added Release 2 implementation annotations to `docs/product/SCREEN_INTERACTION_CATALOG.md`.
- Added implementation-ready Release 2 component contracts to `docs/product/DESIGN_SYSTEM.md`.
- Added Release 2 non-scope exclusions to `docs/backlog/FUTURE_SCOPE.md`.

## Verification

- `node scripts/agent-bus-guard.mjs --task R2-CONTRACT-001-release2-ui-control-surfaces-contract --once` passed before edits.
- `git diff --check` exited 0.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` exited 0 and printed `release2 matrix json ok`.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('p3-p12 ux matrix json ok')"` exited 0 and printed `p3-p12 ux matrix json ok`.
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` exited 1 because `scripts/verify-requirements-matrix.mjs` expects phase matrices with verified/blocked rows and reported `unsupported matrix phase: undefined` plus `status must be verified or blocked, got planned` for `R2-001..R2-012`.
- `node scripts/agent-bus-guard.mjs --task R2-CONTRACT-001-release2-ui-control-surfaces-contract --once` passed before final handoff.

## Decisions / Assumptions

- The PR is stacked on the open BR2 clean-room pattern-transfer PR because the Release 2 contract depends on `CONTROL_SURFACE_INTERACTION_PATTERNS.md` and the BR2 decision record.
- Release 2 uses `E2E-R2-*` ids because it is a cross-phase hardening release. Existing numeric phase ids are unchanged.
- The new matrix intentionally uses `planned` rows because it is a release backlog contract, not completed implementation evidence.

## Risks / Follow-Up

- Merge the BR2 clean-room pattern-transfer PR before this stacked PR.
- Add or extend matrix verifier support for `docs/status/release2-ui-requirements-matrix.json` during `R2-012`.
- Implementation should start with `R2-001/R2-002/R2-003`, not a broad UI rewrite.
