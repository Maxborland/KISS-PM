# P9-005 retrospective insight model handoff

Updated: 2026-05-17T00:52:54.1130250+07:00

Status: accepted

Implemented:
- `RetrospectiveInsight` domain read model.
- `RetrospectiveInsightSourceLesson` source trace model.
- `createRetrospectiveInsights({ tenantId, generatedAt, trends, snapshots })`.
- `readRetrospectiveInsight(insight)` cloned readback.
- `markRetrospectiveInsightHandled(insight, actionEvidence)`.
- Tenant-scoped validation for trend and snapshot sources.
- Governed handled-state requirement using `template_improvement.apply`, `actionExecutionId`, `auditEventId`, actor, timestamp, and matching tenant.
- Review fix rejecting weak insights with no actionable severity or no source snapshot/metric trace.

Changed files:
- `packages/retrospectives/src/index.ts`
- `packages/retrospectives/src/retrospectiveInsight.test.ts`
- `docs/status/phase9-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

Verification:
- `node scripts/agent-bus-guard.mjs --task P9-005-retrospective-insight-model --once` exit 0 at startup.
- `npm test -- packages/retrospectives/src/retrospectiveInsight.test.ts` exit 1 RED: P9-005 functions missing.
- `npm test -- packages/retrospectives/src/retrospectiveInsight.test.ts` exit 1 RED during review: weak insights without actionable severity/source trace were accepted.
- `npm test -- packages/retrospectives/src/retrospectiveInsight.test.ts` exit 0: 1 file, 5 tests passed.
- `npm test -- packages/retrospectives packages/action-engine` exit 0: 5 files, 21 tests passed.
- `npm run test:integration` exit 0: 12 files, 68 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 66 files, 423 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.

Matrix:
- P9-005 has fresh domain/unit evidence and remains blocked only because API/UI/E2E-082/E2E-083 reload/readback/cleanup evidence is not in this block.

Review:
- Bug-hunt/code-review found that weak/no-source insights could be created. Fixed and covered by regression assertions.
- Subagent review could not run because the active thread had reached the agent thread limit; local review gate was completed.

Next:
- Claim `P9-006-closed-portfolio-trends-api-read-models`.
- Expose closed portfolio/trends read models through API with permission states, tenant isolation, trend/insight readback, pagination/filter basics, and no mutation URLs for read-only users.
