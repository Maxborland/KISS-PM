# LiveKit transport reconnect: final read-only audit

## Verdict

**PASS**

Проверенный финальный snapshot доказывает оба transport-сценария end-to-end, regression test воспроизводит именно дефект `SignalReconnecting -> idle`, API/session invariants выдержаны, сервер подтверждает media publication обоих участников, matrix не закрывает больше доказанного, sensitive scan чист.

Аудит был read-only: изменён только этот отчёт. Во время аудита параллельный исполнитель повторно прогнал harness и обновил evidence/harness/matrix; verdict ниже привязан к последнему стабильному snapshot и его SHA-256.

## Audited snapshot

- `apps/web/src/lib/call/call-engine.ts`: `F08ADCA8738CEA8C6926CCB0CF77F1ECA94ADA885110B78757ABE49849C59842`
- `apps/web/src/lib/call/call-engine.test.tsx`: `5677E38C74201ED22382C4B1209CEB9D596D571BBC0DC6C9DA6B8D705ED3196B`
- `docs/qa/full-eval/tools/livekit-reconnect-e2e.mjs`: `8A7F257F176521C160F99342C82E560F50B3A9AC2E6DBA2BA9C31D262629062B`
- `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json`: `7C9882BDAD2FCF6EF06980E82EF9C5A3AF0E99D43ECE0CDF86E6B8D9CF3B0726`
- `docs/qa/full-eval/evidence/browser-media-livekit-reconnect-2026-07-10/risk-media-livekit-reconnect-2026-07-10.json`: `D546AE9BEE172B249AF3578BA616683F433BBF2AE3336E87B09D64BD1673D365`

Final JSON: `status=passed`, `failure=null`, phases `setup, baseline, client-offline, client-recovered, server-paused, server-recovered, api-readback`, 8 manifest screenshots, LiveKit log exit code 0 and 40 allowlisted entries.

## Criteria audit

### 1. SignalReconnecting regression

PASS. `apps/web/src/lib/call/call-engine.ts:59-71` maps both `ConnectionState.Reconnecting` and `ConnectionState.SignalReconnecting` to `reconnecting`; `buildStage` consumes that mapping at line 135.

The regression at `apps/web/src/lib/call/call-engine.test.tsx:294-310` sets the mock room to `SignalReconnecting`, emits `RoomEvent.ConnectionStateChanged`, and asserts `stage.phase === "reconnecting"`. Without the production case at line 66 this path falls through to `idle`, matching the observed visible `Ожидание` defect rather than a synthetic adjacent failure.

Fresh verification:

- `pnpm vitest run apps/web/src/lib/call/call-engine.test.tsx`: PASS, 1 file / 7 tests.
- `.\apps\web\node_modules\.bin\tsc.CMD -p apps/web/tsconfig.json --pretty false`: PASS.

### 2. Client offline/online

PASS. Harness lines `100-120` set only the engineer context offline, require visible `Переподключение...`, restore online, require visible `В эфире`, then require reciprocal remote-participant tiles for admin and engineer.

Exact final evidence:

- JSON line 114 (`client-offline`): admin remains `В эфире`; engineer is `Переподключение...`; both snapshots retain the reciprocal participant names and two unpaused, readyState 4 videos.
- `client-offline-reconnecting.png`: visible engineer reconnecting; SHA-256 `C9BF33F7FE4FF0B952A516C9E5DCA044A3CB9AC2904A645DBFF409AEBBFF2FBE`.
- JSON line 215 (`client-recovered`): both roles are `В эфире`, reciprocal participants present, two unpaused readyState 4 videos per role.
- `client-recovered.png`: visible engineer recovery and admin tile; SHA-256 `E8D48A837CA627841E057DEACD5AA647ADA55800B3A161E93140093526BAA329`.

The admin correctly does not enter reconnecting when only the engineer browser is offline; its side proves continuity and recovered remote presence.

### 3. LiveKit pause/unpause

PASS. Harness lines `122-152` execute `docker compose pause livekit`, require both pages to show `Переподключение...`, unpause, require both pages to show `В эфире`, and re-check reciprocal participant tiles.

Exact final evidence:

- JSON line 316 (`server-paused`): admin and engineer both `Переподключение...`, reciprocal participants retained, videos unpaused/readyState 4.
- `server-paused-admin-reconnecting.png`: SHA-256 `920A440097C4ACF79D117E73FD72493A741CA70A53697CF0AB16C2938157D0D3`.
- `server-paused-engineer-reconnecting.png`: SHA-256 `AC60F15FE0ABA047D5FE31650F04FC10690BD0F596C1501124D3D8A204D8CA60`.
- JSON line 417 (`server-recovered`): both roles `В эфире`, reciprocal participants present, two unpaused readyState 4 videos per role.
- `server-recovered-admin.png`: SHA-256 `622F99BE35734C76A1B3D70E0D9802F161F71958D15D5E43C5F2034EB74CAF74`.
- `server-recovered-engineer.png`: SHA-256 `BDC684B58D6679E812C28064954570023FA87D12364C8DE155B987CB9A7C7754`.

Fresh `docker compose ps livekit` returned `Up` after traversal.

### 4. API idempotency and session invariants

PASS. Harness lines `154-186` read the room after both reconnect scenarios and fail the run on any false invariant. Final JSON lines `566-572` record all invariants true:

- active session ID unchanged and status still `active`;
- no `session_ended`;
- no `participant_left`;
- exactly one `join_token_issued` for admin and one for engineer;
- exactly one `participant_joined` for admin and one for engineer.

The event summary contains only one room creation, one session start, two token issues, and two participant joins. No reconnect created a second logical join or ended/replaced the session.

### 5. Server media evidence

PASS. Final JSON line 649 contains 40 sanitized LiveKit entries with log command exit code 0. Four `media_track` entries at lines `690`, `702`, `750`, and `762` prove:

- admin audio `audio/red` and video `video/VP9`;
- engineer audio `audio/red` and video `video/VP9`.

The remaining allowlisted classifications include transport connections, participant connections/states, room selection/activity, and ICE-pair-change classifications without raw ICE data.

### 6. Secret sanitation

PASS. Harness lines `421-464` parse only marker-matching JSON logs, copy a fixed scalar allowlist through `safeLogScalar`, and discard unparsed raw server lines. `safeError` lines `483-488` redact token-bearing query values and JWT-shaped strings.

Fresh scans of the final JSON and harness returned zero matches for JWTs, raw SDP, ICE candidates, ICE credentials, secret-bearing query strings, authorization/cookie values, suspicious secret property names, and URLs with query strings. All eight PNGs contain only `IHDR`, `IDAT`, and `IEND` chunks, with zero text/metadata chunks; visual inspection found no tokens or transport secrets.

### 7. Matrix claim check

PASS. The item at matrix lines `1404-1422` matches the retained evidence: two roles, client and server interruption, visible reconnect/recovery, active-session/idempotency invariants, 8 screenshots, sanitized server entries, and explicit partial-risk-zone status. The summary count is internally consistent: `fixedByCurrentBranchItems=76` and the array has 76 entries, including exactly one reconnect item.

The linked risk-zone updates at lines `1519-1539` remove only the now-proven self-hosted LiveKit reconnect gap. They continue to leave Jitsi external media, successful physical/OBS camera publication, responsive/provider variants, and remaining role/action traversal open. This does not over-close the broader media or full-browser zones.

## Discrepancies and residual risk

- Non-blocking: `runtimeIssueSummary` contains 9 categorized console/request failures, and several screenshots show the development `1 Issue`/`2 Issues` badge. Network/WebSocket/LiveKit failures are expected during forced interruption, but two `other_error` categories cannot be independently classified because the sanitized artifact intentionally omits raw console text. The matrix claims scenario pass, not runtime-clean pass; this does not contradict the required phase, participant, API, or media evidence.
- Non-blocking: baseline captures occur as remote video attachment settles (one ready video per role), while later snapshots show two ready videos per role. Reciprocal participant tiles are already present at baseline, and server logs prove both users published audio and video.

## CodeGraph change assessment

CodeGraph was consulted before source inspection. `codegraph sync` was intentionally not run because the assignment permits no writes except this report; the configured watcher updated the graph during the parallel harness hardening.

- Audit-start graph: 2169 files, 23,973 nodes, 51,773 edges.
- Final graph: 2169 files, 23,974 nodes, 51,774 edges.
- The +1 function node is `safeLogScalar` at `docs/qa/full-eval/tools/livekit-reconnect-e2e.mjs:460`; the additional structural edge arrived with that function. CodeGraph did not resolve its call edges, so source inspection is authoritative for the calls at harness lines 432-439.
- `phaseFromConnectionState` retains the same function node and signature `(state: ConnectionState): CallPhase`; its body changed only by adding the `SignalReconnecting` case. Impact remains local through `buildStage` and `useCallEngine`; no exported API or type signature changed.
- Test structural delta adds the stateful mock listener registry and `MockRoom.emit`, enabling the exact room event path. JSON, matrix, and PNG artifacts do not add executable symbol nodes.
- CodeGraph contains a duplicate `.claude/worktrees/full-eval-uiux` symbol for `phaseFromConnectionState`, so unqualified node lookup can display that stale worktree body. The audited main-worktree hash, direct diff, fresh Vitest, and TypeScript checks above disambiguate the production result.

## Final gate

All user-specified PASS conditions are met on the stable snapshot. No product, test, harness, matrix, or pre-existing evidence file was modified by this auditor.

SUPERLOOPY_AUDIT: .superloopy/evidence/lane-livekit-reconnect-final-audit.md
