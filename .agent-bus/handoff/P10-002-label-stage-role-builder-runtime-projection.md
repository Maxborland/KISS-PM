# P10-002 handoff — label/stage/role builder runtime projection

Status: accepted for implementation block on 2026-05-17T02:46:54.2390705+07:00.

Implemented:

- Tenant label-set preview/publish domain helpers in `packages/tenant-config`.
- P10 tenant labels runtime/API routes:
  - `GET /api/tenant/labels`
  - `POST /api/tenant/labels/preview`
  - `POST /api/tenant/labels/publish`
  - `GET /api/tenant/configuration/audit`
- Runtime projection for role/stage/control-surface labels through stable keys.
- Tenant label admin UI and API client in `apps/web/src/TenantLabelsAdminSurface.tsx` and `apps/web/src/tenantLabelsApiClient.ts`.
- App shell wiring for the P10 labels surface.

Verification:

- `npm test -- packages/tenant-config/src/tenantLabelBuilder.test.ts` exit 1 RED: preview/publish helpers missing before implementation.
- `npm test -- packages/tenant-config/src/tenantLabelBuilder.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/api/src/phase10TenantLabelsApi.test.ts` exit 1 RED: P10 tenant labels API routes missing before implementation.
- `npm test -- apps/api/src/phase10TenantLabelsApi.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/web/src/TenantLabelsAdminSurface.test.tsx` exit 1 RED: UI surface/client missing before implementation.
- `npm test -- apps/web/src/TenantLabelsAdminSurface.test.tsx` exit 1 RED after bug-hunt: editor used defaults instead of API readback labels.
- `npm test -- apps/web/src/TenantLabelsAdminSurface.test.tsx` exit 0: 1 file, 6 tests passed.
- `npm test -- packages/tenant-config apps/api/src/phase10TenantLabelsApi.test.ts apps/web/src` exit 0: 19 files, 125 tests passed.
- `npm run test:integration` exit 0: 13 files, 76 tests passed.
- `npm test` exit 0: 73 files, 462 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase10-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase10-requirements-matrix.json` exit 1 expected: P10 rows remain blocked until E2E-090..095 and phase exit evidence exist.
- `node scripts/agent-bus-guard.mjs --task P10-002-label-stage-role-builder-runtime-projection --once` exit 0 after releasing own locks.
- `git diff --check` exit 0.

Review findings:

- Medium bug-hunt finding fixed: TenantLabelsAdminSurface initialized editor draft from hardcoded defaults instead of the API read model, which could publish accidental changes immediately after opening the builder. Added failing component regression and fixed draft synchronization from API readback.
- Code-review self-check: no unresolved Critical/Important/Medium findings in P10-002 scope after reruns.

Matrix:

- `docs/status/phase10-requirements-matrix.json` has fresh P10-002 domain/API/UI evidence.
- P10-002 remains blocked for strict phase verification until P10-009 E2E-090 proves browser reload persistence and fixture cleanup/readback.

Next:

- Claim `P10-003-process-template-builder-mvp`.
