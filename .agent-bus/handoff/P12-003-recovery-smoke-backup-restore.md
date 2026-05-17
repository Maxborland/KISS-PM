# Handoff — P12-003 Recovery smoke and backup policy

Timestamp: 2026-05-17T09:03:00.0000000+07:00

Status: accepted for the P12-003 implementation block. Phase 12 and Release 2 remain blocked.

Changed:
- Added `apps/api/src/phase12Recovery.ts`.
- Added `apps/api/src/phase12RecoveryApi.test.ts`.
- Added `GET /api/ops/recovery-smoke` and `POST /api/ops/recovery-smoke/run`.
- Added `ops.execute` runtime permission for tenant admins.
- Reset now clears Phase 12 recovery smoke runtime state.
- Added `docs/operations/PHASE_12_RECOVERY_BACKUP_POLICY.md`.
- Updated `docs/status/phase12-requirements-matrix.json` truthfully: P12-003 has API/runtime/policy evidence but remains blocked for E2E-114.
- Updated queue/current state; next runnable is `P12-004-security-privacy-audit-review-fixes`.

Verification:
- `node scripts/agent-bus-guard.mjs --task P12-003-recovery-smoke-backup-restore --once` exit 0 at startup.
- `npm test -- apps/api/src/phase12RecoveryApi.test.ts` exit 1 RED: `/api/ops/recovery-smoke` returned 404 before implementation.
- `npm test -- apps/api/src/phase12RecoveryApi.test.ts` exit 0: 1 file, 4 tests passed.
- `npm run test:integration` exit 0: 24 files, 123 tests passed.
- `npm test` exit 0: 104 files, 595 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase12-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase12-requirements-matrix.json` exit 1 expected: P12 rows remain blocked until E2E-110..115.
- `git diff --check` exit 0.

Review:
- Bug-hunt/code-review finding: malformed recovery scenario needed explicit no-partial-mutation proof.
- Fix: added validation regression; invalid scenario returns 400 and latestRun remains null.

Next:
- Claim `P12-004-security-privacy-audit-review-fixes`.
- Keep P12 strict matrix blocked until E2E-110..115 and P12-010 pass.
