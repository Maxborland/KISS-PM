# Handoff: R2-DOC-002-br2-control-surface-pattern-transfer

Status: completed
Branch: docs/release2-control-surface-patterns
Completed: 2026-05-17

## Summary

Integrated the supplied `docs/bitrixreports_surfaces_kisspm_transfer_package.zip` as clean-room Release 2 product/design input for KISS PM control surfaces. No BitrixReports2.0 code, proprietary snippets, credentials, real customer data, or Bitrix-specific core model changes were copied.

## Changed

- Added `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md` as the reusable Release 2 interaction contract.
- Added ADR `docs/decisions/0003-br2-control-surface-pattern-transfer.md`.
- Updated product UX, design system, screen catalog, role journeys, future scope, and `docs/status/p3-p12-ux-screen-matrix.json`.
- Added future-scope `UX-P6-FREE-CAPACITY-CALENDAR` matrix row with status `future_scope`.
- Corrected stale E2E references where they conflicted with the master phase plan: P9 uses E2E-080..083, P10 uses E2E-090..095, P12 uses E2E-110..115.

## Artifact Decision

The supplied HTML/PNG atlas was not committed to `docs/product/artifacts/` because it contains legacy-style sample labels. The Markdown contract captures the transferable generic patterns in KISS PM language.

## Verification

- `git diff --check` exited 0.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('screen matrix json ok')"` exited 0 and printed `screen matrix json ok`.
- `npm run verify:matrix -- docs/status/p3-p12-ux-screen-matrix.json` exited 1 because the repo verifier expects phase requirements matrix shape and reported `unsupported matrix phase: undefined` and `matrix.rows must be a non-empty array`.
- `node scripts/agent-bus-guard.mjs --task R2-DOC-002-br2-control-surface-pattern-transfer --once` exited 0. It required escalation because Node spawning `git status` fails with EPERM inside the sandbox.

## Risks / Follow-up

- The P3-P12 UX screen matrix is valid JSON but is not supported by `scripts/verify-requirements-matrix.mjs`.
- This task is docs/product-spec only; production UI/API/domain implementation still needs finite Release 2 implementation tasks, fixtures, matrix policy, and E2E proof.
- Pre-existing untracked `.superpowers/**` folders and the supplied ZIP remain in the working tree and were not edited.
