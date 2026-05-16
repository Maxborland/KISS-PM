# Handoff: P10-001 TenantConfiguration version foundation

- Agent: codex-agent-p10-001
- Completed: 2026-05-17T02:27:23.0476262+07:00
- Status: accepted
- Commit target: `Implement P10 tenant configuration foundation`

## Summary

Implemented the Phase 10 domain foundation for versioned tenant configuration. `TenantConfiguration` now tracks version refs for labels/process/access/KPI/control surfaces/actions/custom fields/saved views/feature flags. Publish preview is non-mutating; publish requires fresh preview, expected active/draft versions, tenant match, and audit evidence. Access-control now exposes tenant config read/write/export/import permission constants.

## Review fix

Bug-hunt found stale preview validation compared only active/draft version numbers. Added a regression test for a draft ref change after preview without a version bump and made publish compare affected refs before applying.

## Evidence

- `npm test -- packages/tenant-config/src/tenantConfigurationVersion.test.ts`: exit 1 RED before implementation.
- `npm test -- packages/access-control/src/accessProfile.test.ts`: exit 1 RED before implementation.
- `npm test -- packages/tenant-config/src/tenantConfigurationVersion.test.ts`: exit 0, 1 file and 4 tests passed.
- `npm test -- packages/access-control/src/accessProfile.test.ts`: exit 0, 1 file and 9 tests passed.
- `npm test -- packages/tenant-config packages/access-control`: exit 0, 8 files and 45 tests passed.
- `npm run test:integration`: exit 0, 12 files and 73 tests passed.
- `npm test`: exit 0, 70 files and 450 tests passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json`: exit 0.

## Matrix

`docs/status/phase10-requirements-matrix.json` keeps P10-001 blocked for phase verification because required E2E-090/E2E-095 and API/UI runtime readback are not implemented yet. The domain foundation evidence is recorded.

## Next

Claim `P10-002-label-stage-role-builder-runtime-projection`.
