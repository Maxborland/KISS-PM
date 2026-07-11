# Media Provider Behavior Agent Report - 2026-07-07

Status: DONE - integrated by orchestrator

## Scope

Investigated the Full Product Evaluation gap around meeting/media provider behavior, specifically call room provider selection/readback, Jitsi/LiveKit join-token contract behavior, config validation surface, and API docs contract drift.

Explicitly avoided CRM files, communication-channel rename work, and shared reconciliation matrix updates.

## CodeGraph Entry/Exit

Before code changes:
- `codegraph_status`: index healthy, 2163 files, 23849 nodes, 51866 edges.
- `codegraph_context`: `meeting media provider LiveKit Jitsi selection config API behavior provider validation readback tests`.
- `codegraph_search`: `Jitsi`, `LiveKit`, `meeting`.
- `codegraph_explore`: `callRoomProviders callRoomProviderSchema CallRoom callWorkspace callSerializers callDataSource LiveKitEgressProvider createLiveKitEgressProviderFromEnv recordingWorkspace`.
- `codegraph_impact`: `issueJoinToken`, depth 2.

After code changes:
- Ran `codegraph sync`.
- `codegraph_context`: `post-change media provider issueJoinToken Jitsi join contract schema primitives communication realtime tests`.

Change index:
- `apps/api/src/communications/callWorkspace.ts`
  - Changed `createCommunicationCallWorkspace(...).issueJoinToken` behavior.
  - `VideoProvider.issueJoinToken` is now called only after the transactional `findActiveCallSessionForUpdate` active-session check succeeds.
  - This prevents issuing a provider token/URL for a session that ended after the route pre-check.
- `apps/api/src/communicationRealtimeRoutes.db.test.ts`
  - Added a DB contract test for Jitsi room creation/readback/session start/join contract.
  - Updated the session-ended race test to require zero provider token calls after the late active-session check fails.
- `apps/api/src/apiDocs/schemas/schemaPrimitives.ts`
  - Aligned call-room provider enum with domain: `manual | jitsi | livekit`.
  - Added missing `open` call-room status.
  - Aligned participant states with domain: `invited | joining | joined | left | removed`.
  - Aligned call event enum with emitted provider/recording events.
- `docs/qa/full-eval/agent-reports/media-provider-behavior-2026-07-07.md`
  - This report.

## Findings / Fixed

1. Late session race could still call the video provider.
   - Existing API path checked `session.status`, then called `videoProvider.issueJoinToken`, then rechecked active session under transaction.
   - If the session ended between route pre-check and workspace transaction, API returned `409 call_session_not_active`, but provider issuance still happened.
   - Fixed by moving provider issuance after the transactional active-session check.

2. Jitsi behavior had unit-level coverage in `videoProvider.test.ts`, but lacked API readback coverage.
   - Added a route-level contract test proving a `jitsi` room reads back as `jitsi`, becomes active, exposes `activeSession`, and returns a URL-only join contract with `token: null` and `expiresAt: null`.

3. API docs primitives drifted from domain/runtime values.
   - Docs listed stale providers (`internal`, `external`), omitted `manual`, omitted `open`, and listed participant/event values not emitted by runtime.
   - Fixed primitives to match current domain/runtime provider behavior.

## Verification

Passed:
- `./node_modules/.bin/vitest.cmd run apps/api/src/videoProvider.test.ts`
  - 14 tests passed.
- `./node_modules/.bin/tsc.cmd -b --pretty false`
  - passed.
- `codegraph sync`
  - completed.

Attempted but blocked by local infra:
- `pnpm vitest run apps/api/src/videoProvider.test.ts`
- `pnpm vitest run --config vitest.db.config.ts apps/api/src/communicationRealtimeRoutes.db.test.ts`
  - Both failed before tests because pnpm tried an install/preflight and hit `ERR_PNPM_IGNORED_BUILDS`.
- `./node_modules/.bin/vitest.cmd run --config vitest.db.config.ts apps/api/src/communicationRealtimeRoutes.db.test.ts`
  - Test runner started, but all DB tests failed during setup with `PostgresError: password authentication failed for user "kiss_pm"`.
  - The new Jitsi DB contract test was therefore not executed to assertion completion in this workspace.

## Still Unverified

- Real LiveKit server compatibility: not verified. Requires live LiveKit URL/API key/API secret and real room/media tracks.
- Real LiveKit egress behavior: not verified against external LiveKit/S3; only existing injected-provider/local contract paths are available here.
- Real Jitsi meeting join in browser: not verified. Local code only constructs/returns the Jitsi room URL; no external Jitsi instance/browser join flow was exercised.
- DB route behavior for the newly added Jitsi contract test was verified by the orchestrator with the working project `DATABASE_URL`.

## Notes

This is a bounded local fix, not a claim that live media infrastructure is production-verified. The remaining Full Evaluation item should keep live-provider verification open until a configured LiveKit/Jitsi environment is available.
## Orchestrator verification after integration

- `cmd /c "node_modules\\.bin\\vitest.cmd run apps/api/src/videoProvider.test.ts"`
  - Result: passed; 1 file passed; 14 tests passed.
- `cmd /c "set DATABASE_URL=postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm&& node_modules\\.bin\\vitest.cmd run --config vitest.db.config.ts apps/api/src/communicationRealtimeRoutes.db.test.ts -t \"Jitsi|session ends\""`
  - Result: passed; 1 file passed; 4 tests passed, 20 skipped.
  - Covered Jitsi API readback/join URL contract and late session-end race with zero provider token calls.
- `corepack pnpm --filter @kiss-pm/api typecheck`
  - Result: passed.

Updated final status: local API/DB contract verification is complete for this bounded slice. Live media traversal remains explicitly unverified without real LiveKit/Jitsi infrastructure and browser media permissions flow.