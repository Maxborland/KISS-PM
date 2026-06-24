# 46. Phase G.4 / Phase 11.4: Communications self-hosted A/V backend (media plane)

## Статус

Phase G.4 поднимает собственную (self-hosted, без SaaS) медиа-плоскость для аудио/видео KISS PM на LiveKit OSS. Это фаза **backend/media-plane**: frontend chat/call UI и web-движок звонка не входят (они в `docs/47` и в web-фазах эпика).

**Supersede note.** Эта фаза **отменяет** следующие non-scope строки `docs/43` и `docs/44`:

- `docs/43` non-scope «Native SFU/media server implementation inside KISS PM»;
- `docs/43` non-scope «Provider webhooks and server-side provider API calls»;
- `docs/43` non-scope «Screen recording» (часть строки «Screen recording, transcription, AI summaries»);
- `docs/43` Architecture boundaries инвариант «Backend не поднимает SFU/media server и не делает provider network calls в v1»;
- `docs/44` non-scope «Native SFU/media server implementation».

Начиная с Phase G.4, KISS PM **владеет** self-hosted LiveKit media plane, принимает provider webhooks и делает server-side per-track recording через LiveKit Egress. При этом:

- control-plane `docs/43` (call rooms / call sessions / join-token / participant state / call events / recordings) **сохраняется и расширяется**, ничего не переписывается;
- контракт join-token **не меняется** (room/publish/subscribe grants, TTL 60..3600 — берется из `docs/43` как есть);
- транскрипция, AI-резюме, серверные виртуальные фоны и сведение записи в один файл остаются non-scope (см. ниже).

Транскрипция, субтитры и AI-резюме остаются вне scope. Сведение записи в один MP4 остается отложенным фоновым job (не v1).

## Product intent

KISS PM должен дать проектной команде рабочую аудио/видео-связь **на собственной инфраструктуре tenant**, без передачи бизнес-состояния во внешний SaaS, поверх уже готового control-plane звонков.

Пользовательская ценность:

- участники заходят в одну комнату на нашей LiveKit-инфре, видят/слышат друг друга, делятся экраном и чатятся во время звонка;
- менеджер может включить серверную запись звонка, и записи живут через существующий Storage layer и остаются permissioned по parent entity;
- backend остается единственным источником истины о сессии/участниках/записях: in-call события сверяются через webhooks LiveKit, а не доверяются клиенту;
- секреты media plane (LiveKit api-secret, TURN-креды, Egress storage key) никогда не покидают сервер и не попадают в readiness/audit/log.

## Scope

### Media server (self-hosted LiveKit)

- Медиа-сервер = **self-hosted LiveKit** (Apache-2.0), поднимается в нашем `docker-compose` / инфраструктуре tenant как сервисы `livekit` + `coturn` + `egress`. Внешний SaaS не используется.
- Backend **подписывает LiveKit-JWT через существующий `videoProvider.ts`** (HS256, гранты room/publish/subscribe, TTL 60..3600). Контракт join-token из `docs/43` остается без изменений; адаптер остается источником `url/apiKey/apiSecret`, и те же значения 1:1 кормят `livekit.yaml keys`, `egress.yaml` и `WebhookReceiver`.
- `livekit` — self-hosted SFU + WebRTC signaling: клиент подключается к LiveKit напрямую по его WS-эндпойнту. **Мы не пишем собственную WebRTC-сигнализацию.**
- `coturn` — standalone TURN/STUN для NAT/firewall traversal (альтернатива — embedded LiveKit TURN, см. TURN credentials).
- `egress` — серверная запись по трекам (Track Egress), только при `KISS_PM_STORAGE_PROVIDER=s3`.

### Signaling and webhooks

- WebRTC-сигнализацию и in-call roster ведет сам LiveKit (`Room`-события клиента). Новый транспорт для звонка не нужен.
- **LiveKit webhooks являются авторитетным источником для БД.** `livekit-server-sdk` `WebhookReceiver` принимает и reconcile-ит события в `CallSession` / `CallParticipantState` / `CallEvent` / `CallRecording` через `callWorkspace.ts`:
  - `room_started` / `room_finished` → статус сессии;
  - `participant_joined` / `participant_left` → `CallParticipantState`;
  - `track_published` / `track_unpublished` → published audio/video/screenshare флаги участника;
  - `egress_started` / `egress_updated` / `egress_ended` → `CallRecording` / `call_recording_groups` и события записи.
- DB — **webhook-authoritative**: клиентский `participant-state` остается optimistic, окончательное состояние выставляет webhook.
- Realtime fan-out **вне** звонка (входящий звонок, presence, fan-out чата/уведомлений) использует **обобщение существующего SSE-паттерна** (`planningEventsRoute.ts` / `planningRedisEventBus.ts` → общий comms-event-bus), а **не новый WebSocket**. Клиент→сервер остается REST + LiveKit data channels.
- Маршрут webhook — `POST /api/internal/livekit/webhook`, **вне** `/api/workspace/*` (см. API surface delta и Security).

### TURN credentials

- TURN нужен для участников за symmetric NAT / строгим firewall. Два варианта (**открытое решение**, см. эпик `docs/plans/communications-self-hosted-av-epic.md` §7):
  - **standalone coturn** с короткоживущими эфемерными HMAC-кредами: `username = <expiry>:<userId>`, `credential = base64(HMAC-SHA1(secret, username))`, TTL ограничен, выдаются вместе с join-token;
  - **embedded LiveKit TURN** — отдельного эндпойнта кредов нет.
- Рекомендация: embedded на бете → standalone к GA.
- TURN-креды — **response-only**: возвращаются только в ответе на запрос, **никогда** не персистятся, не логируются и не пишутся в audit. `KISS_PM_TURN_SHARED_SECRET` — серверный секрет.

### Per-track recording

- Серверная запись = **LiveKit Track Egress → наш `StorageProvider` (S3/R2)**. Запись делается **по трекам**: каждый завершенный egress (`egress_ended`) становится отдельным `FileAsset` + `EntityAttachment` + per-track `CallRecording`.
- Pointer-модель `docs/43` сохраняется: `CallRecording` ссылается на `EntityAttachment`, который привязан к тому же tenant и parent entity, что и комната. Backend не принимает raw binary.
- **В v1 записи — это per-track файлы.** Сведение всех треков в один MP4 (room-composite) — **отложенный фоновый job** (`calls.recording_compose`, в v1 STUB), **не v1**.
- Запись gated на `KISS_PM_STORAGE_PROVIDER=s3` (Egress не пишет в local-провайдер) и `KISS_PM_VIDEO_EGRESS_ENABLED=true`. При `storage!=s3` start-эндпойнт записи отвечает стабильной ошибкой, а не делает вид, что записывает.

### Screen share + in-call chat

- Screen share = **track kind LiveKit** (`screen_share` / `screen_share_audio`), а не новый control-plane объект. Backend только отражает факт публикации screenshare-трека в `CallParticipantState` и `CallEvent` (через webhook). Отдельная сущность не создается.
- In-call chat **переиспользует conversation parent entity** комнаты (`conversations` / `messages` из `docs/43`/`docs/44`) и LiveKit **data channels** для realtime-доставки. Отдельная таблица сообщений звонка не создается; source of truth — существующие сообщения, реконсиляция по `clientId`.

## Domain delta

Расширяется доменная модель `docs/43` (ничего не переписывается).

### Per-track recording model

- Новый родитель **`call_recording_groups`** (tenant-scoped, FK на `CallSession` с `tenant_id`): одна группа на запуск записи сессии; partial-unique «одна активная группа на сессию»; `status`-check.
- `CallRecording` становится per-track ребенком группы:
  - `attachmentId` → **nullable** (заполняется по `egress_ended`, до того запись «pending/recording»);
  - добавлены `group_id`, `egress_id`, `participant_id`, `track_id`, `kind` (`audio | video | screen_share`), `status` (`pending | recording | ready | failed`), `duration_seconds`, `ended_at`;
  - partial-unique по `egress_id` для идемпотентного reconcile webhook.
- Backfill: существующие legacy-записи сворачиваются в синтетические `composed`-группы (строго идемпотентно для двойного прогона CI).

### CallEvent.eventType — новые значения

Расширяется `call_events_type_chk` (в дополнение к значениям `docs/43`):

- `recording_started`;
- `recording_track_completed`;
- `recording_completed`;
- `recording_failed`;
- `screenshare_started`;
- `screenshare_stopped`;
- `turn_credentials_issued`.

`payload` по-прежнему хранит только safe metadata (ids, statuses, kind, egress id), **никогда** токены/секреты/storage keys.

### CallParticipantState

Добавлены webhook-реконсилируемые булевы:

- `screen_sharing`;
- `published_audio`;
- `published_video`.

Эти поля выставляет webhook (`track_published` / `track_unpublished`), а не клиент.

## API surface delta

Сохраняются все эндпойнты `docs/43`/`docs/44`. Добавляются (под `/api/workspace/*`, кроме webhook):

Новые control actions:

- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/turn-credentials` — короткоживущие TURN-креды (только в ответе);
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/egress/track-start` — старт серверной записи трека;
- `POST /api/workspace/call-rooms/:roomId/egress/:egressId/stop` — остановка egress;
- `GET /api/workspace/call-rooms/:roomId/egress` — список активных/завершенных egress;
- `GET /api/workspace/call-rooms/:roomId/recordings` — расширен полями `trackKind` и `participant` (per-track listing).

Internal webhook (**вне** `/api/workspace`):

- `POST /api/internal/livekit/webhook` — **signature-verified, CSRF-exempt**, raw-body до JSON-парсинга, идемпотентный reconcile. Подробности безопасности — в разделе Security and privacy.

Новые стабильные error codes (в дополнение к кодам `docs/43`):

- `video_egress_unavailable` — egress не сконфигурирован/недоступен или `storage!=s3`;
- `video_egress_invalid_kind` — неподдерживаемый track kind для записи;
- `turn_credentials_unavailable` — TURN не сконфигурирован (или embedded TURN, отдельных кредов нет);
- `call_webhook_signature_invalid` — подпись webhook не прошла (fail-closed);
- `call_egress_not_found` — egress по `egressId` не найден в наших строках.

## Permissions

- `turn-credentials`, `egress/track-start`, `egress/:id/stop` и прочие control actions записи/TURN → `tenant.communications.manage` (`canManageCommunications`) **плюс** per-entity manage (`communications/entityAccess.ts`), как и start/end session в `docs/43`/`docs/44`.
- Листинг записей (`GET .../recordings`, `GET .../egress`) следует room read (entity read), как и просмотр записей в `docs/43`.
- Join-token и participant-state остаются с правами `docs/43` (entity read + активная сессия).
- **Webhook обходит RBAC**, но **gated подписью**: он мутирует только те комнаты, которые резолвятся из **наших** строк (`providerRoomId` / `egressId`) по verified payload, а не по имени комнаты из payload. Tenant/room никогда не доверяются из тела запроса.

## Audit

Новые audit actions (в дополнение к `docs/43`/`docs/44`):

- `communications.call_egress_started`;
- `communications.call_egress_ended`;
- `communications.call_turn_credentials_issued`;
- `communications.call_webhook_reconciled` (actor = system);
- `communications.denied`.

Audit **никогда** не хранит:

- TURN shared secret и выданные TURN-креды;
- LiveKit api-secret;
- Egress storage key / bucket / local path;
- raw `Authorization`-заголовок webhook;
- join token и provider internals.

Хранится только safe metadata: ids, statuses, kind, egress id, participant id, track id.

## Security and privacy

- **Секреты только серверные.** LiveKit api-secret, coturn shared secret, TURN ephemeral cred, Egress S3-ключи, join-JWT — никогда в readiness/audit/log/OpenAPI-примерах. Редакция обязательна (существующий инвариант репо).
- **Подпись webhook обязательна, fail-closed.** `WebhookReceiver.receive(rawBody, Authorization)` проверяет подпись **до любой записи в БД**. При невалидной подписи → `call_webhook_signature_invalid`, никакой мутации. Проверка обязательна под `KISS_PM_VIDEO_LIVEKIT_WEBHOOK_VERIFY`; в проде unsigned-запросы недопустимы. Тест на отклонение поддельной подписи — обязательный gate (см. `docs/47` P5 и `docs/plans/KISS PM production plan.md`). Webhook — единственный CSRF-exempt мутирующий эндпойнт; без обязательной подписи это неаутентифицированная кросс-тенантная запись.
- **Egress output paths** проходят через Storage safe-name; per-track файлы **наследуют permission parent entity комнаты** (как recordings `docs/43`).
- **Provider network calls теперь РАЗРЕШЕНЫ.** Это **supersede** инварианта `docs/43` «Backend не делает provider network calls / Backend makes NO provider network calls»: backend делает server-side вызовы к LiveKit (Egress control, RoomService) и принимает webhooks. Эти вызовы обязаны быть **timeout-bounded** и **failure-audited**; happy-path не должен зависеть от недоступного провайдера без явной ошибки.
- TURN-креды response-only, никогда не персистятся/логируются.
- Tenant-изоляция через имя комнаты (`providerRoomId` unique per tenant + `metadata.tenantId`); webhook никогда не доверяет имени комнаты из payload.

## Architecture boundaries

- `videoProvider.ts` адаптер **растет**: token (существующий) + **egress control client** (`EgressClient` / `RoomServiceClient`) + **webhook verifier** (`WebhookReceiver`).
- Адаптер по-прежнему **не импортирует** persistence/domain repositories: он владеет только созданием join URL/token, провайдер-вызовами и проверкой подписи; reconcile в БД делает application слой (`callWorkspace.ts` / `recordingWorkspace.ts`).
- Domain владеет типами/статусами/валидацией звонков и записей.
- Persistence владеет tenant-scoped таблицами и repository-методами.
- Storage остается единственным binary layer для записей; communications хранит только metadata записи.

## Non-scope

- Транскрипция, субтитры, AI-резюме.
- Серверные виртуальные фоны (только client-side, в web-фазе).
- Room-composite single-file output (сведение в один MP4) — отложенный фоновый job, не v1.
- Federation / multi-region SFU.
- Mobile push.
- Frontend chat/call UI (в `docs/47`).

## Acceptance criteria

1. С `provider=livekit` backend подписывает join-token (контракт `docs/43` не изменился) и участники подключаются к self-hosted LiveKit на нашей инфре.
2. Менеджер с `tenant.communications.manage` + entity manage стартует TURN-креды и track egress; пользователь без этих прав получает стабильную ошибку и не получает кредов/egress.
3. TURN-креды и join-token возвращаются только в ответе и не попадают в БД/audit/log.
4. Webhook с валидной подписью reconcile-ит `room_*` / `participant_*` / `track_*` / `egress_*` в `CallSession` / `CallParticipantState` / `CallEvent` / `CallRecording`; webhook с поддельной подписью отклоняется (`call_webhook_signature_invalid`) без мутаций.
5. Каждый `egress_ended` создает per-track `FileAsset` + `EntityAttachment` + `ready` `CallRecording` в правильной `call_recording_group`; per-track записи листаются и доступны только читателям parent entity.
6. Запись жестко выключена при `storage!=s3` (`video_egress_unavailable`), без фейкового «успешного» старта.
7. `CallParticipantState` (`screen_sharing` / published audio/video) и события `screenshare_*` выставляются webhook-ом, а не доверяются клиенту.
8. Provider network calls (Egress/RoomService/webhook) timeout-bounded и failure-audited; ни один секрет не сериализуется в readiness/audit/log.
9. Backfill миграции per-track записей идемпотентен при двойном прогоне CI.

## Test plan

- Unit:
  - per-track recording domain parsers (group/track/kind/status);
  - TURN ephemeral HMAC cred helper (формат username/credential, TTL);
  - webhook signature verification helper (валидная/поддельная подпись);
  - audit/log sanitization омит TURN-cred, api-secret, storage key, raw Authorization.
- DB/integration:
  - `call_recording_groups` + per-track `call_recordings` persistence, partial-unique по `egress_id`, nullable `attachment_id`;
  - tenant isolation новых таблиц/полей;
  - идемпотентный backfill legacy записей в синтетические группы (двойной прогон);
  - migration/schema registry включает новые таблицы/поля/event-types.
- API:
  - turn-credentials / egress track-start / egress stop / egress list / recordings (per-track);
  - webhook reconcile `room_*` / `participant_*` / `track_*` / `egress_*` идемпотентно;
  - поддельная подпись webhook отклонена без мутаций;
  - denied user получает стабильные ошибки и не получает кредов/egress;
  - запись gated при `storage!=s3`;
  - audit содержит только safe metadata.
- Regression:
  - `docs/43`/`docs/44` collaboration/realtime/calls/stickers, storage/search, planning, KPI/control, capacity, closure и Phase 10 hardening тесты остаются зелеными; контракт join-token не изменился.
