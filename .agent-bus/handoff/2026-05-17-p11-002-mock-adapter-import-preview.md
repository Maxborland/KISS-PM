# P11-002 Mock Adapter Import Preview Handoff

Task: `P11-002-mock-adapter-canonical-import-preview`
Agent: `codex-p11-002`
Completed: 2026-05-17T06:28:18.5585015+07:00

Status: implementation complete; phase row remains blocked until executable E2E-100 evidence exists.

Changed:
- `packages/integrations/src/index.ts` now exposes `createMockAdapterImportPreview` and P11 import preview DTOs.
- Preview returns `mutatesState: false`, validation issues, create/update/skip/error report counts, affected canonical entity refs, mapping previews, and canonical preview DTOs.
- Canonical IDs are deterministic hash-based IDs derived from tenant/source/entity/external id and do not expose readable external ids.
- `packages/integrations/src/mockAdapterImportPreview.test.ts` proves canonical compatibility with `crm-core` and `project-core`, non-mutation, update/skip detection from existing mappings, validation report behavior, malformed-date recovery without throws, and no external-id leakage.
- `docs/status/phase11-requirements-matrix.json`, `.agent-bus/queue.json`, and `.agent-bus/state/CURRENT.md` were updated truthfully.

Verification:
- `npm test -- packages/integrations/src/mockAdapterImportPreview.test.ts` exit 1 RED: `createMockAdapterImportPreview` was missing before implementation.
- `npm test -- packages/integrations/src/mockAdapterImportPreview.test.ts` exit 1 RED during bug-hunt: malformed dates threw `IntegrationDomainError` instead of returning validation report.
- `npm test -- packages/integrations/src/mockAdapterImportPreview.test.ts` exit 0: 1 file, 4 tests passed.
- `npm test -- packages/integrations packages/crm-core packages/project-core` exit 0: 16 files, 86 tests passed.
- `npm test` exit 0: 95 files, 544 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase11-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

Review:
- `$bug-hunt`: fixed malformed-date throw and external-id canonical id leakage.
- `$requesting-code-review`: external subagent spawn was unavailable due agent thread limit; self-review found no remaining Critical/Important/Medium findings in this scope.
- `$receiving-code-review`: valid findings were fixed with RED/GREEN evidence.

Risks / blockers:
- P11-002 is not strict-gate verified because E2E-100 is not implemented yet.
- No apply persistence, API routes, UI, or E2E behavior was added in this block by design.

Next runnable task:
- `P11-003-idempotent-import-apply-mapping-persistence`
