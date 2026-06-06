# 43. Phase G.2 / Phase 11.2: Communications realtime backend

## Статус

Phase G.2 восстанавливает и закрепляет контракт для полноценных чатов, аудио и видеоконференций. Документ уточняет Phase G / Phase 11: persisted discussions, notifications и meetings уже являются foundation, а аудио/видео больше не остаются только внешними ссылками.

Фаза остается **backend-only**: frontend, mobile clients, нативный media server, desktop capture UI и визуальный meeting surface не входят.

## Product intent

KISS PM должен дать проектной команде рабочий communications control-plane: обсуждения, звонки, участники, события, записи, решения и audit находятся в контексте проекта, задачи или CRM opportunity.

Пользовательская ценность:

- PM создает комнату звонка рядом с проектом/задачей/opportunity и видит историю сессий;
- участник получает безопасный join contract без доступа к provider secret;
- tenant может использовать self-hosted LiveKit/Jitsi или manual provider без утечки бизнес-состояния;
- записи звонков живут через существующий Storage layer и остаются permissioned;
- audit фиксирует управленческие действия без токенов, credentials, storage keys и внутренних provider данных.

## Scope

### Realtime control-plane

- `CallRoom` как tenant-scoped комната связи для `project | task | opportunity`.
- `CallSession` как конкретный запуск звонка/конференции.
- `CallParticipantState` для присутствия и статусов участия.
- `CallEvent` как persisted event log для future SSE/WebSocket fan-out.
- `CallRecording` как связь call room/session с существующим `EntityAttachment`.

### Audio/video providers

- Provider boundary: `disabled | manual | jitsi | livekit`.
- Default production target: LiveKit-compatible self-hosted provider + coturn/TURN в инфраструктуре tenant.
- Jitsi-compatible provider поддерживается как self-hosted/external fallback.
- Manual provider поддерживает migration path для внешней ссылки без server-side fetch.
- Backend не поднимает SFU/media server и не делает provider network calls в v1.

### Join token contract

- Join token выдается только через API после permission check.
- Token short-lived, одноразово возвращается в response и **никогда не пишется** в DB/audit/log.
- LiveKit token строится как provider JWT с минимальными room/publish/subscribe grants.
- Jitsi/manual могут возвращать только safe join URL без token.

### Recordings

- Binary recording хранится через existing Storage/Attachment layer.
- `CallRecording` ссылается на существующий attachment, который уже привязан к тому же `project | task | opportunity`.
- Backend не принимает raw binary recording в этой фазе.

## Domain model

### CallRoom

Fields:

- `id`, `tenantId`;
- `entityType`: `project | task | opportunity`;
- `entityId`;
- `meetingId`: optional link to `Meeting`;
- `title`;
- `mediaKind`: `audio | video`;
- `provider`: `manual | jitsi | livekit`;
- `providerRoomId`;
- `status`: `scheduled | open | active | ended | cancelled`;
- `createdByUserId`, `createdAt`, `updatedAt`, `archivedAt`.

Invariant: `providerRoomId` is an opaque safe identifier, not a provider credential.

### CallSession

Fields:

- `id`, `tenantId`, `roomId`;
- `providerSessionId`;
- `status`: `active | ended | failed`;
- `startedByUserId`, `startedAt`;
- `endedByUserId`, `endedAt`;
- `failureReason`.

Invariant: only one active session per active room is expected by application flow; persistence keeps history.

### CallParticipantState

Fields:

- `tenantId`, `roomId`, `sessionId`, `userId`;
- `state`: `invited | joining | joined | left | removed`;
- `joinedAt`, `leftAt`, `lastSeenAt`.

### CallEvent

Fields:

- `id`, `tenantId`, `roomId`, `sessionId`;
- `eventType`: `room_created | session_started | join_token_issued | participant_joined | participant_left | session_ended | recording_attached`;
- `actorUserId`;
- `payload`;
- `createdAt`.

`payload` stores safe metadata only: ids, statuses, provider kind, not tokens/credentials.

### CallRecording

Fields:

- `id`, `tenantId`, `roomId`, `sessionId`;
- `attachmentId`;
- `title`;
- `createdByUserId`, `createdAt`, `archivedAt`.

Invariant: attachment must belong to the same tenant and same parent entity as the room.

## API surface

- `GET /api/workspace/call-rooms?entityType=&entityId=`
- `POST /api/workspace/call-rooms`
- `GET /api/workspace/call-rooms/:roomId`
- `POST /api/workspace/call-rooms/:roomId/sessions/start`
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/join-token`
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/participant-state`
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/end`
- `POST /api/workspace/call-rooms/:roomId/recordings`
- `GET /api/workspace/call-rooms/:roomId/events?limit=`

Stable errors:

- `communications_not_configured`;
- `communications_entity_not_found`;
- `call_room_not_found`;
- `call_session_not_found`;
- `video_provider_disabled`;
- `video_provider_misconfigured`;
- `call_recording_attachment_invalid`;
- validation errors with `call_*_invalid` codes.

## Permissions

Read permission is inherited from the scoped entity:

- project: project read;
- task: project read or task owner/requester/participant;
- opportunity: opportunity read.

Manage:

- create room, start/end session, attach recording: entity manage;
- issue join token: entity read, active workspace user, room/session readable;
- participant state self-update: same user only, unless entity manager.

All denied write/manage attempts write audit with safe command input.

## Audit

Required audit actions:

- `communications.call_room_created`;
- `communications.call_session_started`;
- `communications.call_join_token_issued`;
- `communications.call_participant_state_updated`;
- `communications.call_session_ended`;
- `communications.call_recording_attached`;
- `communications.denied`.

Audit must never store:

- provider secrets;
- join token;
- raw authorization headers/cookies;
- storage key, bucket, local path;
- private provider internals.

## Architecture boundaries

- Domain owns call types, statuses and validation.
- API/application owns auth, permissions, provider orchestration and audit.
- Persistence owns tenant-scoped tables and repository methods.
- Video provider adapter owns join URL/token creation only; it does not import persistence/domain repositories.
- Storage layer remains source of binary files; communications stores recording metadata only.
- Realtime fan-out is future adapter over persisted `CallEvent`.

## Non-scope

- Frontend chat/call UI.
- Native SFU/media server implementation inside KISS PM.
- Provider webhooks and server-side provider API calls.
- Screen recording, transcription, AI summaries.
- Mobile push/email delivery.
- Full-text search in message/call content.

## Acceptance criteria

1. User with project/task/opportunity read can list/read call rooms for that entity.
2. User with manage permission can create room, start/end session and attach recording.
3. User with read permission can request a join contract; token/secret is returned only in response and not persisted/audited.
4. User without parent entity access cannot list rooms, start sessions, issue tokens or read events.
5. Participant state changes are persisted as call events and tenant-isolated.
6. Recording attachment is accepted only when attachment belongs to the same tenant and same parent entity as the room.
7. LiveKit/Jitsi/manual providers use a common backend provider interface and can be configured without changing API contract.
8. DB schema, repository and API tests prove tenant isolation, lifecycle, permissions, audit safety and recording validation.

## Test plan

- Unit:
  - call domain parsers;
  - provider config validation;
  - LiveKit token has required grants and short expiry;
  - token/audit sanitization helpers omit secrets.
- DB/integration:
  - call room/session/event/participant/recording persistence;
  - tenant isolation;
  - migration/schema registry includes all new tables.
- API:
  - create/list/read call room;
  - start session, issue join token, update participant state, end session;
  - attach recording via same-entity attachment;
  - denied user gets stable errors and no token;
  - audit contains safe metadata only.
- Regression:
  - collaboration, storage/search, planning, KPI/control, capacity, closure and Phase 10 hardening tests keep passing.
