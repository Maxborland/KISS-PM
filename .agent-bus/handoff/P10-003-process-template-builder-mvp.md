# Handoff: P10-003 Process Template Builder MVP

Timestamp: 2026-05-17T03:11:47.6740214+07:00
Agent: codex-agent
Status: accepted for block implementation; Phase 10 strict gate remains blocked until later E2E.

## Changed
- Added project-core process-template preview/publish helpers with non-mutating dry-run, stale-preview checks, active-stage safety validation, and audited publish output.
- Added Phase 10 process-template API routes for read, preview, and publish.
- Added governed runtime command execution with backend permission checks for `tenant.config.write` and `project.template.write`.
- Updated Phase 4 runtime active process-template replacement and Phase 3 future CRM intake template binding after publish.
- Added ProcessTemplateBuilderSurface UI and API client with Russian copy, dry-run preview, publish, audit/readback evidence, read-only state, and stale-preview recovery.
- Updated `docs/status/phase10-requirements-matrix.json`, `.agent-bus/state/CURRENT.md`, and queue metadata.

## Verification
- `node scripts/agent-bus-guard.mjs --task P10-003-process-template-builder-mvp --once` exit 0 at startup.
- `npm test -- packages/project-core/src/processTemplateBuilder.test.ts` exit 1 RED before implementation, then exit 0.
- `npm test -- apps/api/src/phase10ProcessTemplateApi.test.ts` exit 1 RED before routes, exit 1 RED after bug-hunt for stale future CRM draft version, then exit 0.
- `npm test -- apps/web/src/ProcessTemplateBuilderSurface.test.tsx` exit 1 RED before UI/client, then exit 0.
- `npm test -- packages/tenant-config packages/project-core apps/api/src/phase10TenantLabelsApi.test.ts apps/api/src/phase10ProcessTemplateApi.test.ts apps/web/src` exit 0.
- `npm run test:integration` exit 0.
- `npm test` exit 0.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.

## Review Findings
- Bug-hunt Important: publishing a new process template updated Phase 4 runtime but left Phase 3 CRM future draft binding on the old template version. Fixed by adding future intake replacement and regression coverage.
- Code-review Medium: publish audit details initially placed active-project version data outside the accepted audit details shape. Fixed by nesting it under `details.after`; typecheck passes.

## Remaining
- P10-003 matrix row remains blocked until P10-009 proves E2E-090/E2E-095 browser reload persistence, future-template effect, existing-runtime stability, backend denial, audit evidence, and cleanup/readback.
- Next runnable: `P10-004-custom-field-builder-control-surface-binding`.
