# Phase 5 — Server-side per-track recording: execution spec

> Status: ready to execute **with a live Postgres** (`docker compose up -d postgres`).
> This phase changes the DB schema, so the migration MUST be verified with
> `pnpm db:migrate && pnpm db:seed:dev && pnpm db:seed:dev && pnpm test:db` (the
> release-gate sequence — migrate + idempotent seed ×2 + DB tests). Do NOT merge an
> unverified migration. The infra (egress service + `infra/egress/egress.yaml`) is
> already landed; this spec is the API/DB half.

Locked decision: **per-track LiveKit Egress, no compositing in v1**; output to OUR
storage (S3/R2/local-not-supported); recording is a pointer to an `entityAttachment`,
never raw binary into the API. Gated on `KISS_PM_VIDEO_EGRESS_ENABLED=true` AND
`KISS_PM_STORAGE_PROVIDER=s3`.

## 1. Data model (the cascading change)

Current (`packages/persistence/src/schema.ts` ~3080): `call_recordings` has a **NOT NULL**
`attachment_id` and one row per recording. Per-track produces many files per session,
and the attachment does not exist until egress finishes. Chosen shape: a **parent
group + per-track child rows**.

### 1a. New table `call_recording_groups`
Mirror the `call_sessions` tenant-scoped pattern (composite `(tenant_id, id)` PK; FK
chain carrying `tenant_id`):
- columns: `id, tenantId, roomId, sessionId, status (active|stopping|completed|failed|cancelled), startedByUserId, composedAttachmentId (nullable), createdAt, startedAt, endedAt (nullable), archivedAt (nullable)`.
- FK `(tenantId, roomId, sessionId)` → `callSessions(tenantId, roomId, id)` ON DELETE CASCADE.
- FK `(tenantId, startedByUserId)` → `tenantUsers` ON DELETE RESTRICT.
- FK `(tenantId, composedAttachmentId)` → `entityAttachments(tenantId, id)` ON DELETE RESTRICT.
- partial unique `(tenantId, sessionId) WHERE status = 'active'` (one active group per session).
- check on status enum.

### 1b. `call_recordings` delta (per-track child)
- `attachment_id` → **NULLABLE** (set only on `egress_ended`).
- add: `groupId (NOT NULL after backfill)`, `egressId`, `participantId`, `trackId`,
  `kind (audio|video|composed)`, `status (starting|recording|ready|failed)`,
  `durationSeconds (int)`, `endedAt (timestamptz)`.
- FK `(tenantId, groupId)` → `callRecordingGroups(tenantId, id)` ON DELETE CASCADE.
- partial unique `(tenantId, egressId) WHERE egress_id IS NOT NULL`.
- checks: `kind in (...)`, `status in (...)`, and `((status='ready' and attachment_id is not null) or (status<>'ready'))`.

### 1c. `call_events` check extension
Extend `call_events_type_chk` (schema.ts ~3073) with:
`'recording_started','recording_track_completed','recording_completed','recording_failed'`.
(Optional, if implementing webhook reconcile of media state: `'screenshare_started','screenshare_stopped','turn_credentials_issued'` + `call_participant_states` bools — keep in 0041 or reserve 0042.)

### 1d. Migration `packages/persistence/migrations/0041_phase_g4_call_recordings_per_track.sql`
Hand-authored, **idempotent** (must survive the seed-twice gate). Order:
1. `CREATE TABLE IF NOT EXISTS call_recording_groups (...)` with the constraints above.
2. `ALTER TABLE call_recordings ALTER COLUMN attachment_id DROP NOT NULL;`
3. `ALTER TABLE call_recordings ADD COLUMN IF NOT EXISTS group_id text;` (+ egress_id/participant_id/track_id/kind/status/duration_seconds/ended_at).
4. **Backfill** legacy rows into synthetic groups so the new NOT NULLs can be added:
   `INSERT INTO call_recording_groups (...) SELECT ... FROM call_recordings r WHERE r.group_id IS NULL ...` then `UPDATE call_recordings SET kind=COALESCE(kind,'composed'), status=COALESCE(status,'ready'), group_id=COALESCE(group_id, <synthetic>) ...`.
5. `ALTER TABLE call_recordings ALTER COLUMN group_id SET NOT NULL; ... kind SET NOT NULL; ... status SET NOT NULL;`
6. Add FKs / partial-unique / checks guarded by catalog `IF NOT EXISTS` checks (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`; use a `DO $$ ... IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname=...) THEN ... END $$;` block).
7. `ALTER TABLE call_events DROP CONSTRAINT IF EXISTS call_events_type_chk; ALTER TABLE call_events ADD CONSTRAINT call_events_type_chk CHECK (event_type in (... existing + recording_*));`
8. Bump `serverReadiness.ts` `expectedDatabaseMigrationTag` to `0041_phase_g4_call_recordings_per_track.sql`.

## 2. Domain (`packages/domain/src/collaboration.ts`)
- Extend `callEventTypes` with the 4 recording event types.
- Add `callRecordingKinds = ['audio','video','composed']`, `callRecordingStatuses = ['starting','recording','ready','failed']`, `callRecordingGroupStatuses = ['active','stopping','completed','failed','cancelled']` + parsers.
- Change `CallRecording`: `attachmentId: string | null`, add `groupId, egressId: string|null, participantId: string|null, trackId: string|null, kind, status, durationSeconds: number|null, endedAt: Date|null`.
- Add `CallRecordingGroup` type.
- Update `mapCallRecording` in `packages/persistence/src/collaborationRepository.ts` + add `mapCallRecordingGroup`.

## 3. Persistence port + repo
- `apps/api/src/communications/callDataSource.ts`: add `createCallRecordingGroup`, `createCallRecordingChild`, `markCallRecordingReady`, `findCallRecordingByEgressId`, `listCallRecordingsByGroup`, `findActiveRecordingGroupForSession`.
- `packages/persistence/src/collaborationRepository.ts`: implement them.
- `apps/api/src/communications/callSerializers.ts`: extend `serializeCallRecording` (groupId/kind/status/participantId/durationSeconds; attachmentId nullable) + add `serializeCallRecordingGroup`. Never serialize egress provider secrets.
- Keep the legacy `attachRecording` path valid: it writes a synthetic single `composed`/`ready` group + child (so docs/43 behavior is preserved as a special case).

## 4. Egress provider (`apps/api/src/communications/recording/livekitEgressProvider.ts` — NEW)
- `EgressClient` (livekit-server-sdk) from `KISS_PM_VIDEO_LIVEKIT_*`. `startTrackEgress(roomName, DirectFileOutput{ S3Upload }, trackId)`; `stopEgress(egressId)`; `listPublishedTracks(roomName)` via `RoomServiceClient`.
- S3Upload from `KISS_PM_STORAGE_S3_*` (endpoint + forcePathStyle for R2/MinIO). File key: `recordings/{tenantId}/{roomId}/{sessionId}/{groupId}/{participantIdentity}/{trackId}-{time}.{ext}`.
- Audio → `.ogg` (opus), video → `.ivf`/`.h264`; read the actual container/mime from the `egress_ended` webhook result.

## 5. Recording workspace (`apps/api/src/communications/recording/recordingWorkspace.ts` — NEW)
- `startRecordingGroup`: gates `session.status==='active'`, `provider==='livekit'`, `storage==='s3'`, `canManageCommunications`; in a txn create the group + per-track children (`status='starting'`, egressId), append `recording_started` callEvent, audit `communications.call_recording_started`, notify joined participants («Идёт запись звонка»). 501 `recording_storage_unsupported` if storage≠s3.
- `stopRecordingGroup` + `callWorkspace.endSession` extension: stop active egresses, group → `stopping`, audit `communications.call_recording_stopped`.
- `egress_ended` reconciler (idempotent on egressId): create fileAsset + entityAttachment (relationType `call_recording`) on the room's entity, set child `attachmentId`/`status='ready'`/`endedAt`/`durationSeconds`; when all children terminal, group → `completed` + `recording_completed`.

## 6. Webhook (`apps/api/src/communicationRecordingWebhookRoute.ts` — NEW)
- `POST /api/internal/livekit/webhook` — **outside** `/api/workspace/*`, CSRF-exempt, **signature-verified** via `WebhookReceiver.receive(rawBody, Authorization)` BEFORE any DB write; fail-closed under `KISS_PM_VIDEO_LIVEKIT_WEBHOOK_VERIFY`. Raw body BEFORE JSON parsing.
- Resolve tenant/room from OUR `call_recordings.egressId` row, NOT the payload. Idempotent. Register in `app.ts`.
- Add an API test asserting **forged-signature rejection** (the P5 gate).

## 7. Config + deps + infra (infra already landed)
- dep: `livekit-server-sdk` in `apps/api` (mark external in esbuild bundle like `redis`).
- `serverConfig.ts`: `KISS_PM_VIDEO_EGRESS_ENABLED` (default false; require provider=livekit AND storage=s3 when true) + `KISS_PM_VIDEO_LIVEKIT_WEBHOOK_VERIFY`.
- `serverReadiness.ts`: optional egress reachability (monitored, not gating /health/ready — recording is async, non-critical to call setup).
- `infra/egress/egress.yaml` + the `egress` compose service (media profile) — **DONE** (this commit).
- background job kind `calls.recording_compose` (v1 ffmpeg-mux STUB) for later single-file output.

## 8. Verification (mandatory before merge)
1. `pnpm typecheck` (api + persistence clean).
2. `docker compose up -d postgres` then `pnpm db:migrate && pnpm db:seed:dev && pnpm db:seed:dev` (migration applies + idempotent).
3. `pnpm test:db` (new recording-group/per-track DB tests + existing call tests green).
4. API tests: start/stop recording gated by RBAC + storage; `egress_ended` reconcile happy path; **forged-signature webhook rejected**; no secrets in audit/logs.
5. Manual: `docker compose --profile media up` + a real call + start recording → per-track files land in the bucket → recordings listed + permissioned.

## 9. Security non-negotiables (production hard-fail if violated)
LiveKit api-secret / coturn secret / TURN cred / egress S3 keys / join token never in
readiness/audit/logs/OpenAPI examples. Webhook signature mandatory + fail-closed.
Recording attachment readable only by parent-entity/room readers. No call/egress/TURN
test hooks reachable in production. (See `docs/plans/KISS PM production plan.md` hard-fail list.)
