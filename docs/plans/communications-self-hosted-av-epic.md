# План эпика: собственная A/V-связь (self-hosted LiveKit) + полный блок коммуникаций

> Статус: план/контракт верхнего уровня. Реализация начинается только после утверждения этого baseline (AGENTS §5/§6, docs-first). Этот документ — оркестрация эпика; детальные фазовые контракты выносятся в `docs/46_*` (backend media plane) и `docs/47_*` (UI) на Фазе 0.

## 1. Контекст

Блок коммуникаций сейчас «куцый» и в UI, и в восприятии бэкенда. Реальная картина из аудита кодовой базы:

- **Control-plane коммуникаций уже реализован и покрыт тестами** (backend-only, без UI): чаты/каналы/сообщения/реакции/стикеры (`collaborationRoutes.ts`, `communicationUpgradeRoutes.ts`), встречи/заметки/action-items/уведомления, и **control-plane звонков** — `callRooms / callSessions / callParticipantStates / callEvents / callRecordings`, RBAC, audit (`communications/callWorkspace.ts`). Адаптер `videoProvider.ts` уже **подписывает LiveKit-JWT** (HS256, грант room/publish/subscribe, TTL 60..3600).
- **Чего нет** (отсюда ощущение куцести): своей **медиа-плоскости** (SFU), серверной **записи**, **сигнализации/presence fan-out** за пределами планнинга (есть только SSE для планнинга, WebSocket отсутствует), screen share / виртуальных фонов / оптимизации, и **всего UI** коммуникаций (greenfield). Доки `docs/43`/`docs/44` сознательно вынесли SFU, webhooks, запись, фоны в non-scope.

Этот эпик закрывает разрыв: поднимаем **собственную** (self-hosted, без SaaS) медиа-плоскость на LiveKit OSS, дописываем сигнализацию/запись/безопасность и строим **весь** UI блока коммуникаций — на уже готовом control-plane.

## 2. Зафиксированные решения (продакт-оунер)

1. **Медиа-сервер = self-hosted LiveKit** (Apache-2.0, в нашем docker-compose / инфраструктуре тенанта; не SaaS). Переиспользуем существующий control-plane и `videoProvider.ts` LiveKit-JWT. Это и есть «своё решение без внешних интеграций».
2. **Объём = весь блок коммуникаций**: UI чатов/каналов/упоминаний/реакций/стикеров + встречи + звонки со всеми фичами (video/audio, screen share, серверная запись, чат во время встречи, виртуальные фоны, оптимизация).
3. **Запись = серверная по трекам** (LiveKit Egress, Track Egress, без композитинга в v1; сведение в один файл — отложенный фоновый job).

## 3. Несущая архитектурная ось

**View-model контракт.** Чистые виджеты в `widgets/call/*` и `widgets/chat/*` принимают сериализуемые view-model (`CallStageView`, `ParticipantTileView`, `MessageView`, `ConversationView`) и **рендерятся одинаково** статичным Storybook-двойником и живым runtime-контейнером. `livekit-client` / `@livekit/track-processors` живут **только** в `apps/web/src/lib/call/*`; виджеты SDK не импортируют. Это гарантирует:
- Storybook остаётся контрактом хэндофа (двойник = тот же код, что и runtime);
- Next-сборка и Storybook-gate не тянут WASM;
- фаза «UI-контракт» и фаза «живой клиент» делаются разными исполнителями без рассинхрона.

**Жёсткая граница** (eslint `no-restricted-imports` на `widgets/**` и `components/**`): импорт `livekit-client`/`@livekit/track-processors` разрешён только под `lib/call/*`; движок грузится через `next/dynamic({ ssr:false })`.

**Реюз control-plane.** Ничего в `callWorkspace.ts` / таблицах звонков не переписываем — только расширяем. `videoProvider.ts` остаётся источником `url/apiKey/apiSecret`; те же значения 1:1 кормят `livekit.yaml keys`, `egress.yaml` и `WebhookReceiver`.

## 4. Восстановленные слайсы (агенты упали — описано вручную)

### 4.1 Backend realtime: сигнализация, webhooks, presence

**Ключевая рамка:** WebRTC-сигнализацию ведёт сам LiveKit-сервер (клиенты подключаются к нему напрямую по его WS). **Мы НЕ пишем WebRTC-сигнализацию.** Нужны только: app-level realtime для событий вне звонка + reconcile через webhooks.

- **In-call roster** принадлежит LiveKit `Room` (события клиента) — новый транспорт не нужен.
- **Вне звонка** (входящий звонок/звонок «звонит», presence, fan-out новых сообщений чата, уведомления) транспорта нет. **Решение: расширяем существующий SSE-паттерн** (`planningEventsRoute.ts`) и обобщаем `planningRedisEventBus.ts` в общий comms-event-bus (каналы `kiss-pm:calls:<roomId>`, `kiss-pm:presence:<tenant>`, `kiss-pm:notifications:<userId>`). SSE рекомендуется над «первым WebSocket»: совпадает с текущим паттерном, минимум риска, работает multi-instance через Redis. Клиент→сервер остаётся REST + LiveKit data channels (для in-call чата).
- **LiveKit webhooks:** `livekit-server-sdk` `WebhookReceiver` принимает `room_started/finished`, `participant_joined/left`, `track_published/unpublished`, `egress_started/updated/ended`; reconcile в `callSessions/callParticipantStates/callEvents/callRecordings` через `callWorkspace.ts`. Маршрут `POST /api/internal/livekit/webhook` — **вне** `/api/workspace/*`, **подпись обязательна**, CSRF-exempt (machine-to-machine), raw-body до JSON-парсинга, идемпотентно; tenant/room резолвятся из **наших** строк (`providerRoomId`/`egressId`), не из payload.
- **Server SDK control actions:** `RoomServiceClient` — `removeParticipant` (kick), `mutePublishedTrack` (mute), `updateRoomMetadata`/`deleteRoom` (lock/end). Каждое действие → `canManageCommunications`.
- **Файлы:** `apps/api/src/communicationEventsRoute.ts` (SSE-подписка), `communicationEventBus.ts` + `communicationRedisEventBus.ts` (обобщение планнинг-шины), `communicationWebhookRoute.ts` (единый ресивер; запись reuse его же), `communications/callControlActions.ts` (`RoomServiceClient`).

### 4.2 Безопасность / RBAC / приватность

- **Секреты** (LiveKit api-secret, coturn shared secret, TURN ephemeral cred, Egress S3-ключи, join-JWT) — только серверные, **никогда** в readiness/audit/logs/OpenAPI-примерах. Редакция обязательна (существующий инвариант репо).
- **TURN-креды** (если standalone coturn): эфемерные HMAC — `username = <expiry>:<userId>`, `credential = base64(HMAC-SHA1(secret, username))`, TTL ограничен, выдаются вместе с join-token, только в ответе. При embedded LiveKit TURN отдельного эндпойнта нет.
- **Webhook:** `WebhookReceiver.receive(rawBody, Authorization)` — подпись проверяется до любой записи в БД; fail-closed под `KISS_PM_VIDEO_LIVEKIT_WEBHOOK_VERIFY`; тест на отклонение поддельной подписи (gate Фазы 5).
- **RBAC:** start session / start-stop recording / kick / mute / lock → `canManageCommunications` + per-entity manage (`communications/entityAccess.ts`); join-token → entity **read** + активная сессия; просмотр записей → entity read. Согласие на запись = notify-on-record (`UserNotification`). Tenant-изоляция через имя комнаты (`providerRoomId` unique per tenant + `metadata.tenantId`); webhook никогда не доверяет имени комнаты из payload.
- **SSE-аутентификация:** cookie `kiss_pm_session` + tenant-изоляция + trusted-origin posture; rate-limit подписок.
- **Readiness fail-closed:** `KISS_PM_VIDEO_PROVIDER` уже обязан быть `manual|jitsi|livekit` или падать на старте; добавляем `media`-проверку (livekit/coturn/egress); `serverConfig.ts` валидирует TTL/секреты и требование `storage=s3` при включённой записи.
- **Release-gate:** новые маршруты в `qa:route-smoke`; e2e happy-path звонка с гардами тест-окружения (никаких test-hooks в проде); axe на call-UI; `security:check` сканирует новые npm-депы; CI падает, если join-token/TURN-cred сериализован в cache/log/audit.

## 5. Фазовый план

| Фаза | Цель | Состав | Размер | Готовность |
|---|---|---|---|---|
| **0. Docs-контракт + фиксы gate** | Утвердить контракт эпика; снять дешёвые блокеры, валящие любую comms-сторю | `docs/46` (backend media plane), `docs/47` (UI-контракт), правки `docs/api/07/99/00`, `docs/12`, `README`, beta-матрицы (как `deferred`), hard-fail policy продакшна. Фикс `UI_ONLY_PREVIEW_BANNER_TEXT` → «Превью — бэкенд не подключён», добавить `chat/calls/meetings/notifications` в `UI_ONLY_PREVIEW_SURFACES`. **Разрешить коллизию миграции 0041** (два AV-слайса претендовали на 0041 → свёрнуто в один `0041_phase_g4_*`, CallEgress → `call_recording_groups`). ФАКТ: по репозиторию `0041` всё равно дублируется с CRM-эпиком (`0041_crm_pipeline_schema_contract.sql`); безопасно — раннер сортирует по полному имени, а не по номеру (см. §5 «Миграции»). | M | both |
| **1. TRACER BULLET: 1:1 видеозвонок end-to-end** | Доказать стек вертикально: двое заходят в одну LiveKit-комнату на нашей инфре, видят/слышат друг друга, кладут трубку | `infra/livekit/livekit.yaml` + `infra/coturn/turnserver.conf` + compose-сервисы livekit+coturn (dev = bridge-network); **единственная правка кода:** `normalizeBaseUrl` в `videoProvider.ts` принимает `ws:/wss:`; `lib/call/call-client.ts` (fetchJoinToken) + `lib/call/call-engine.ts` (connect/disconnect, adaptiveStream+dynacast, publish cam+mic, leave); `app/calls/[roomId]/page.tsx`; чистые `widgets/call/participant-tile.tsx` + `call-stage.tsx` + одна сторя; `media`-readiness | L | founder-beta |
| **2. Статичный Storybook-контракт всего блока** | 12 экранов-двойников + покомпонентные стори как чистые виджеты; заморозить view-model контракты | `widgets/chat/*` (channel-list, conversation-view, message-composer, mention-menu, sticker-picker, chat-widget) + `widgets/call/*` (lobby, grid, controls, screen-share, recording-indicator, in-call-chat, device-settings) + domain `message-bubble`/`reaction-bar`/`presence-dot`; `catalog.ts` (12 RU SCREEN_IDS+META), `screen-view`, `screens.stories.tsx`, sidebar-группа «Общение», `styles/widgets/chat.css`+`call.css`. Контролы media — `disabled` + tooltip + `BannerInline` за `isUiOnlyPreview` | L | both |
| **3. Живой web-клиент звонка** | Завести `livekit-client` за виджетами Фазы 2: лобби, выбор устройств, publish-тогглы, screen share, in-call чат, качество связи, reconnect | `lib/call/call-engine.ts` (FSM, RoomEvents→view-model, устройства, screen share), `lib/call/call-chat.ts` (data-channel + персист через `conversations/messages`, reconcile по `clientId`), `lib/call/use-lobby-preview.ts`, `call-runtime-view.tsx` (TanStack Query + CallEngineProvider ssr:false). Оптимизация: simulcast/VP9(+vp8 backup)/dtx/red | XL | founder-beta |
| **4. Виртуальные фоны + полировка оптимизации** | Размытие/замена фона через `@livekit/track-processors` с self-hosted MediaPipe и деградацией по CPU; финал кодек-тогглов | `lib/call/call-background.ts` (capability-gate → скрыть контрол если не поддержано, GPU→CPU fallback, perf-budget auto-degrade), `public/livekit/*` (wasm+`selfie_segmenter.tflite`+фоны, без внешнего CDN); AV1 за флагом, VP9 по умолчанию; device-settings на реальный `switchActiveDevice`/`setSinkId` | M | founder-beta |
| **5. Серверная запись по трекам (Egress) + webhook** | Запись по трекам в наш storage через LiveKit Egress + изменение модели данных + ресивер с проверкой подписи — секрет-несущая strict-prod поверхность | Миграция `0041` (`call_recording_groups`; `call_recordings.attachment_id` → nullable; +`group_id/egress_id/participant_id/track_id/kind/status/duration_seconds/ended_at`; backfill legacy в синтетические группы; идемпотентно); `domain/collaboration.ts` дельты; `livekitEgressProvider.ts` (`startTrackEgress`→`S3Upload`, gated `storage=s3`); `recordingWorkspace.ts` (start/stop + `egress_ended` reconciler, идемпотентно по `egressId`); webhook-маршрут; `callWorkspace.endSession` останавливает egress; `infra/egress/egress.yaml` + egress-сервис (cap_add SYS_ADMIN, Redis db:1); job-kind `calls.recording_compose` (v1 = ffmpeg-mux STUB) | XL | strict-prod |
| **6. Strict-prod hardening + закрытие пробелов** | Закрыть go/no-go и кросс-сквозные пробелы | Readiness fail-closed для livekit/coturn/egress в проде; standalone-coturn TLS + host-networking топология + firewall/порты в runbook; TURN ephemeral HMAC эндпойнт (если не embedded TURN); тест NAT/symmetric-firewall fallback; mobile/responsive call-UI на 390px; axe-clean call-route + клавиатурные mute/leave; матрица браузеров (Safari VP9/setSinkId/getDisplayMedia → hide); janitor «застрявших» egress; load/scale заметки; подтвердить отсутствие call/egress/TURN test-hooks в проде; реализовать ffmpeg-compose job | L | strict-prod |

### Tracer bullet (первая отгрузка)
Токен из существующего `/join-token` → `livekit-client` коннектится к self-hosted `livekit-server` (+coturn) в нашем docker-compose → двое видят/слышат друг друга → hang up. Единственная строка backend-риска (`normalizeBaseUrl ws:/wss:`), на вебе только `lib/call/{call-client,call-engine}.ts` + один Next-роут + два чистых виджета + одна сторя + media-readiness; всё остальное застаблено.

## 6. Сводные списки (консолидировано по слайсам)

**Инфра-сервисы (docker-compose):**
- `livekit-server` (`livekit/livekit-server:v1.8`) — self-hosted SFU+signaling; dev=bridge-network / prod=host-networking; Redis db:1.
- `coturn` (`coturn/coturn:4.6`) — standalone TURN/STUN; prod 5349/443 TLS. *(Альтернатива для беты: embedded LiveKit TURN — см. открытые решения.)*
- `egress` (`livekit/egress:v1.9`) — запись по трекам, `cap_add: SYS_ADMIN`, Redis db:1, пишет в наш S3/R2 (только Фаза 5).
- reuse существующего Redis — логическая изоляция: планнинг db:0, media/egress db:1 (выделенный `redis-media` рекомендуется к GA).
- reuse существующего `StorageProvider` S3/R2 как sink Egress (**local-провайдер не может быть sink → запись gated на `storage=s3`**).

**npm-зависимости:**
- `livekit-server-sdk` (`apps/api`) — `EgressClient`, `RoomServiceClient`, `WebhookReceiver`, `DirectFileOutput`, `S3Upload`; external в esbuild-бандле как `redis` (Фаза 5/4.1).
- `livekit-client` (`apps/web`) — движок звонка, только в `lib/call/*` (Фаза 1).
- `@livekit/track-processors` (`apps/web`) — виртуальные фоны (Фаза 4).
- `@mediapipe/tasks-vision` (транзитивный peer; self-host wasm+model под `public/livekit`, без CDN) (Фаза 4).
- `ffmpeg` в образе API/worker — отложено до compose-job (не нужен для v1 записи по трекам).

**Env (новые/задействованные):**
`KISS_PM_VIDEO_PROVIDER=livekit`, `KISS_PM_VIDEO_LIVEKIT_URL` (ws://dev, wss://prod), `KISS_PM_VIDEO_LIVEKIT_API_KEY/_SECRET`, `KISS_PM_LIVEKIT_API_KEY/_SECRET` (== VIDEO_* значения, кормят `livekit.yaml keys`), `KISS_PM_VIDEO_TOKEN_TTL_SECONDS` (60..3600), `KISS_PM_VIDEO_ALLOW_INSECURE_HTTP` (dev only, off в проде), `KISS_PM_MEDIA_READINESS_URL`, `KISS_PM_TURN_SHARED_SECRET` (+ `KISS_PM_TURN_URL`/`_CREDENTIAL_TTL_SECONDS` если свои TURN-креды), `KISS_PM_VIDEO_EGRESS_ENABLED` (Фаза 5, default false; требует provider=livekit И storage=s3), `KISS_PM_VIDEO_LIVEKIT_WEBHOOK_VERIFY` (Фаза 5, fail-closed), `KISS_PM_STORAGE_S3_*` (reuse как sink Egress, `endpoint`+`force_path_style` для R2/MinIO).

**Миграции:**
- `0041_phase_g4_call_recordings_per_track.sql` (**ФАКТ на 2026-07-19: локальная коллизия AV-слайсов разрешена — концепт `call_egress` свёрнут сюда, файл один. Но «единый 0041» по репозиторию НЕ достигнут:** параллельно существует `0041_crm_pipeline_schema_contract.sql` (CRM-эпик), т.е. номер `0041` дублируется; так же дублируется `0042`. Это безопасно — раннер `migrate.mjs` сортирует по полному имени файла и не парсит числовой префикс, дубли номеров применяются как разные `tag`, пока имена уникальны; guard `migrationNumbering.test.ts` ловит новые дубли): создать `call_recording_groups` (tenant-scoped composite PK, FK на `callSessions` с `tenant_id`, partial unique «одна активная группа на сессию», status-check); `call_recordings.attachment_id` → NULLABLE; +`group_id/egress_id/participant_id/track_id/kind/status/duration_seconds/ended_at` + FK + partial-unique(`egress_id`) + check'и; backfill legacy в синтетические `composed`-группы (строго идемпотентно для двойного прогона CI); расширить `call_events_type_chk` (`recording_started/recording_track_completed/recording_completed/recording_failed`). Поля `call_participant_states` (`screen_sharing`, published audio/video bools, webhook-reconciled) и события `screenshare_*`/`turn_credentials_issued` — в 0041 или зарезервированный `0042`.

## 7. Открытые решения (нужны до Фазы 1/5)

1. **TURN: embedded LiveKit TURN (проще для беты) vs standalone coturn (изоляция, бинд 443, переживает рестарт SFU — для GA).** Влияет на firewall-конфиг Фазы 1 и эндпойнт TURN-кредов Фазы 6. Рекомендация: embedded на бете → standalone к GA.
2. **Realtime-транспорт вне звонка: расширить SSE (рекомендую) vs первый WebSocket.** Блокирует reconcile in-call чата и ring-UI (Фаза 3).
3. **Хранилище для записи: нужен S3/R2** — Egress не пишет в local-провайдер. Подтвердить наличие S3/R2, иначе запись = только strict-prod с этим требованием.
4. **Dev-compose сеть: bridge (проще DNS) vs host-networking + `host.docker.internal` (ближе к проду).**
5. **conversationId для in-call чата:** возвращать на payload комнаты/сессии vs резолвить через `GET /conversations?entityType=call_room&entityId=…` (определить в Фазе 3).

## 8. Кросс-сквозные риски и топ-риски

- **View-model — несущий шов.** Утечка типов `livekit-client` в пропсы виджетов свяжет статичный двойник с SDK и сломает Storybook-сборку (потянет WASM). Защита: eslint `no-restricted-imports` на `widgets/**`+`components/**`, `next/dynamic ssr:false`, SDK только в `lib/call/*`.
- **`normalizeBaseUrl` в `videoProvider.ts` отвергает `ws://`/`wss://`** (сегодня только http/https) — join-URL для `livekit-client` непригоден. Митигация: первая правка tracer-bullet + unit-тест, что http/https всё ещё валидны И ws/wss теперь проходят; валидаторы секрет/TTL/insecure-http не трогать.
- **Запись gated на S3/R2, а дефолт беты — local storage** → наивный UI покажет «живую» кнопку «Запись», которая ничего не делает (провал fake-affordances + обман пользователя). Митигация: start-эндпойнт → `501 recording_storage_unsupported` при `storage!=s3`; контрол записи управляется capability-состоянием `CallStageView` (скрыт/disabled с реальной причиной); запись — строго strict-prod (Фаза 5).
- **Webhook — CSRF-exempt мутирующий эндпойнт.** Без обязательной проверки подписи это неаутентифицированная кросс-тенантная запись (hard-fail продакшна). Митигация: `WebhookReceiver.receive` до любой записи; раздельный raw-body; tenant/room из наших строк; fail-closed; тест отклонения поддельной подписи.
- **UDP 50000-60000 + TURN relay range — большая firewall-поверхность**; ошибка конфигурации — причина №1 «соединились, но нет медиа», и ни один слайс не тестирует relay-fallback. Митигация: явная таблица портов в runbook; выбрать один TURN-паттерн до Фазы 1; NAT-fallback тест из «враждебной» сети (Фаза 6).
- **MediaPipe-фоны тяжёлые** — молча роняют FPS на слабых машинах; неверные self-hosted asset-пути → полурабочий эффект. Митигация: `supportsBackgroundProcessors()` → **скрыть** контрол если не поддержано; GPU→CPU fallback; `onFrameProcessed` perf-budget (~33ms) auto-degrade + разовый RU-тост; проверка `assetPaths` на старте.
- **Двойной путь чата** — data-channel доставил, но `POST` в `conversations/messages` упал → расходящиеся транскрипты. Митигация: единый source-of-truth `Map` по `clientId`; optimistic `sending→sent` + ack-пакет; на сбое — статус `failed` с реальным retry; на reconnect авторитет — GET-транскрипт.

## 9. Пробелы (вне всех слайсов — отнести к Фазе 6 / будущим эпикам)

Транскрипция/субтитры/AI-резюме (отдельный эпик); mobile/responsive call-UI на 390px; тестирование NAT/symmetric-firewall fallback; матрица браузеров; a11y живого видео (не только статичной стори); load/scale/ёмкость (участников на комнату/хост); janitor застрявших egress; **противоречие модели TURN-кредов** между слайсами (resolve до Фазы 1); схема LiveKit participant identity (`sub == userId`, подтвердить до Фазы 3 чата); сведение в один MP4 — STUB в v1 (продакт принимает per-track файлы до реализации ffmpeg-job).

## 10. Карта ключевых файлов

**Инфра:** `docker-compose.yml` (+3 сервиса, env), `infra/livekit/livekit.yaml`, `infra/coturn/turnserver.conf`, `infra/egress/egress.yaml`, `.env.example`, `docs/runbooks/self-hosted-deployment.md`.
**Backend:** `apps/api/src/videoProvider.ts` (ws/wss), `serverReadiness.ts`+`healthRoutes.ts`+`server.ts` (media-check), `communicationEventsRoute.ts`+`communicationEventBus.ts`+`communicationRedisEventBus.ts` (SSE/шина), `communicationWebhookRoute.ts` (ресивер), `communications/callControlActions.ts`, `communications/recording/livekitEgressProvider.ts`+`recordingWorkspace.ts`, `communications/callWorkspace.ts` (endSession), `communicationRealtimeRoutes.ts` (recordings start/stop), `callDataSource.ts`+`collaborationRepository.ts`+`callSerializers.ts`, `serverConfig.ts`.
**Данные/домен:** `packages/persistence/src/schema.ts`, `packages/persistence/migrations/0041_*.sql`, `packages/domain/src/collaboration.ts`, `packages/domain/src/backgroundJobs.ts`.
**Web-движок:** `apps/web/src/lib/call/{call-client,call-engine,call-background,call-chat,use-lobby-preview,types}.ts`, `views/screens/call-runtime-view.tsx`, `app/calls/[roomId]/page.tsx`, `public/livekit/*`.
**Web-UI/Storybook:** `widgets/call/*`, `widgets/chat/*`, `components/domain/{message-bubble,reaction-bar,presence-dot}.tsx`, `styles/widgets/{call,chat}.css`, `app/globals.css` (импорты после остальных widget-стилей), `views/catalog.ts`, `views/screens/{screen-view,screens.stories}.tsx`, `views/config/sidebar-nav.ts`, `lib/featureFlags.ts`.
**Docs/контракт:** `docs/46_PHASE_G_4_*`, `docs/47_PHASE_G_5_*`, `docs/api/{07,99,00}_*`, `docs/12_ФАЗОВЫЙ_ПЛАН.md`, `docs/README.md`, `docs/beta/*`, `docs/plans/KISS PM production plan.md`.

## 11. Верификация

- **Фаза 1 (tracer):** `docker compose up livekit coturn`; открыть `/calls/:roomId` в двух браузерах; токен из существующего пути; двусторонние audio+video; `/health/ready` показывает `media:up`; одна зелёная Storybook-сторя tile/stage; unit-тест движка с мок-`Room`.
- **Фаза 2:** `pnpm verify:storybook-contract` зелёный со всеми 12 экранами + покомпонентными стори; весь видимый текст — кириллица, ноль EN dev-labels, ноль fake/enabled-noop контролов; view-model типы заморожены как контракт хэндофа.
- **Фаза 3:** `/calls/:roomId` — реальный многоучастниковый звонок: лобби с выбором устройств, mic/cam тогглы, screen share, живой roster с барами качества, in-call чат, переживающий звонок, reconnect; те же виджеты, что в Storybook (флаг off → enabled).
- **Фаза 5:** менеджер стартует запись; per-track файлы в S3/R2; `egress_ended` создаёт fileAsset+entityAttachment+`ready` CallRecording; записи листаются и пермишены к читателям parent-entity; поддельная подпись webhook отклонена; полный audit без секретов; запись жёстко выключена при `storage!=s3` (без фейковой кнопки).
- **Сквозное:** release-gate (`typecheck→build→test→db(migrate+seed×2)+test:db→security:check→qa:route-smoke→test:e2e:smoke→qa:visual→qa:a11y→verify:storybook-contract`) зелёный; новые маршруты в route-smoke; e2e happy-path звонка с гардами тест-окружения; никаких секретов в readiness/audit/logs.
