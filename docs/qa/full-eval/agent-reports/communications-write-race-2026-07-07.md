# Communications Write Race / Idempotency Extra Check — 2026-07-07

## Scope

Atomic area: `RISK-WRITE-FLOW-RACE-IDEMPOTENCY` for communications write flows beyond already covered channel rename and notification read.

Touched production: no.
Touched e2e: no.
Touched reconciliation matrix: no.

## Behavior Spec

- AC1: Concurrent duplicate channel member add requests for the same channel/user/role do not create duplicate active membership rows.
- AC2: Concurrent duplicate notification preference writes for the same user/channel/type do not create duplicate preference rows and remain readable through the API.
- AC3: Both flows have API-level readback plus direct DB row-count evidence.
- Non-goals: message send idempotency contract, e2e coverage, reconciliation matrix edits, production changes without a confirmed bug.

## Tests Added

File: `apps/api/src/collaborationRoutes.db.test.ts`

- `keeps concurrent channel member adds idempotent at the active membership row`
  - Creates a custom communication channel.
  - Sends two concurrent identical `POST /api/workspace/communication-channels/:channelId/members` requests for `user-alpha-executor`.
  - Verifies both responses are `201`.
  - Reads back `GET /api/workspace/communication-channels/:channelId` and verifies one active member entry.
  - Queries `communication_channel_members` and verifies one active row.

- `keeps concurrent notification preference writes unique with readback`
  - Sends two concurrent identical `PUT /api/workspace/notification-preferences` requests for `digest` + `mention`.
  - Verifies both responses are `200`.
  - Reads back `GET /api/workspace/notification-preferences` and verifies one matching preference with `weekly` digest.
  - Queries `notification_preferences` and verifies one row for the composite key.

## Verification

- CodeGraph entry:
  - `codegraph_status` passed: 2164 indexed files, 23852 nodes, 51896 edges.
  - `codegraph_context` and `codegraph_explore` identified `apps/api/src/collaborationRoutes.ts`, `apps/api/src/collaborationRoutes.db.test.ts`, `packages/persistence/src/collaborationRepository.ts`, and communication domain symbols.
  - `communication-channels/*` route strings live in `apps/api/src/communicationUpgradeRoutes.ts`; CodeGraph did not surface that file for the route-string lookup, so I used literal `rg` / direct reads as fallback for that part.

- `pnpm vitest run apps/api/src/collaborationRoutes.db.test.ts -t "keeps concurrent channel member adds idempotent|keeps concurrent notification preference writes unique"`
  - Blocked before Vitest by pnpm install guard: `ERR_PNPM_IGNORED_BUILDS` for ignored build scripts.

- `cmd /c node_modules\.bin\vitest.CMD run --config vitest.db.config.ts apps/api/src/collaborationRoutes.db.test.ts -t "keeps concurrent channel member adds idempotent|keeps concurrent notification preference writes unique"`
  - Sandboxed run blocked by `spawn EPERM` while Vite/esbuild loaded config.
  - Escalated run executed Vitest, but both targeted tests failed during DB setup with `PostgresError: password authentication failed for user "kiss_pm"` at `truncateCollaborationState`.
  - This is an environment/DB credentials blocker before test bodies exercise the new assertions.

- `cmd /c node_modules\.bin\tsc.CMD -p apps/api/tsconfig.json --pretty false --noEmit`
  - Passed.

## Findings / Risks

No production bug was confirmed in this environment because DB auth blocked targeted DB execution.

Code review of the two selected flows suggests the expected idempotency mechanism is present at the persistence layer:

- Channel member add uses `upsertCommunicationChannelMember` with `onConflictDoUpdate` on `(tenantId, channelId, userId)`, restoring `archivedAt` to `null` and updating role/creator.
- Notification preferences use `upsertNotificationPreferences` with `onConflictDoUpdate` on `(tenantId, userId, channel, notificationType)`.

Residual risk: route-level audit side effects for duplicate identical writes were not asserted in this slice. The tests prove row-level idempotency/readback once DB runs, not audit de-duplication.

## Change Index

Files changed by this slice:

- `apps/api/src/collaborationRoutes.db.test.ts`
  - Added concurrent channel member add idempotency/readback DB test.
  - Added concurrent notification preference write uniqueness/readback DB test.

Files created:

- `docs/qa/full-eval/agent-reports/communications-write-race-2026-07-07.md`
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-write-flow-communications-extra-race-2026-07-07.json`

CodeGraph before/after:

- Before edits: CodeGraph status/context/explore were used as above.
- After edits: `codegraph sync` still required after this report/evidence is written; expected graph delta is test-only additions plus two docs/evidence files. No production route symbols changed.

## Orchestrator Verification

After the agent report, the orchestrator reran the targeted DB tests with the working local database URL (postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm). Result: passed; 1 file passed, 2 tests passed, 15 skipped. This upgrades the targeted row-level idempotency/readback evidence to done; audit side-effect de-duplication remains outside this atom.

