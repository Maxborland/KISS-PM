# 47. Phase G.5 / Phase 11.5: Communications product UI contract

## Статус

Этот документ фиксирует продуктовый и архитектурный контракт **frontend** блока коммуникаций KISS PM поверх backend-контрактов `docs/42` (collaboration foundation), `docs/43` (realtime control-plane), `docs/44` (channels/stickers upgrade) и `docs/46` (self-hosted A/V media plane). Phase G.5 не строит отдельный backend; UI является управляемой рабочей поверхностью над уже готовым control-plane и media plane.

Контракт **design-v3 lockdown**:

- дизайн-система — shadcn + Tailwind + bento; UI собирается **только** из `components/ui` | `components/domain` | `widgets/*` | `shell/*`;
- **никакого** inline `style`, никаких hex/rgba в TSX (только токены); весь видимый copy — **русский**, stable code identifiers (CallRoom, LiveKit, Egress, TURN и т.д.) остаются английскими;
- **Storybook handoff contract**: каждый comms/call экран рендерится статичным двойником и живым runtime-контейнером из одного и того же чистого виджета; пока поверхность не подключена — `uiOnlyPreview` + `BannerInline` с текстом «Превью — бэкенд не подключён» + disabled media-контролы с tooltip, без fake/enabled-noop кнопок.

**Несущий шов — view-model контракт.** Чистые виджеты `widgets/call/*` и `widgets/chat/*` принимают сериализуемые view-model (`CallStageView`, `ParticipantTileView`, `MessageView`, `ConversationView`) и рендерятся одинаково Storybook-двойником и runtime. `livekit-client` / `@livekit/track-processors` живут **только** под `apps/web/src/lib/call/*`; виджеты SDK не импортируют (eslint `no-restricted-imports` на `widgets/**` + `components/**`; движок грузится через `next/dynamic({ ssr:false })`). Это удерживает Storybook-сборку и Next-bundle от WASM и позволяет делать UI-контракт и живой клиент разными исполнителями без рассинхрона.

## Product intent

Коммуникации в KISS PM — это **единый коммуникационный контур внутри проекта/задачи/CRM**, а не отдельный мессенджер сбоку. Пользователь ведет обсуждение, упоминания, реакции, стикеры, встречи и звонки рядом с карточкой сущности; in-context чат-панель и call surface открываются из проекта/сделки/задачи, а не из отдельного приложения.

## Surfaces / routes

Runtime-маршруты:

- `/comms` — список каналов (channels);
- `/comms/:channelId` — тред канала + composer;
- in-context chat panels на `/projects/:id`, `/deals/:id`, `/my-work` — entity-scoped чат рядом с карточкой;
- `/calls/:roomId` — call surface (лобби → активный звонок);
- meetings list — список встреч и деталь встречи.

Storybook SCREEN_IDS (12 экранов-двойников, RU-заголовки в группе «Общение»):

| SCREEN_ID | RU-заголовок |
|---|---|
| `comms-channels` | 20 Чаты |
| `comms-thread` | 21 Тред канала |
| `comms-composer` | 22 Композер сообщения |
| `comms-notifications` | 23 Уведомления |
| `comms-meetings` | 24 Встречи |
| `comms-meeting-detail` | 25 Карточка встречи |
| `call-lobby` | 26 Лобби звонка |
| `call-active` | 27 Активный звонок |
| `call-screen-share` | 28 Демонстрация экрана |
| `call-in-chat` | 29 Чат во время звонка |
| `call-device-settings` | 30 Настройки устройств |
| `call-reconnecting` | 31 Переподключение |

## Component inventory

- **Reuse (approved/needs-adaptation):** `CardPanel`, `BemAvatar`, `dialog`, `sheet`, `tabs`, `textarea`, `badge`, `banner-inline`, `tooltip`, `*-state` (loading/empty/error/forbidden).
- **New domain:** `message-bubble`, `reaction-bar`, `presence-dot`.
- **New widgets:** `widgets/chat/*` (channel-list, conversation-view, message-composer, mention-menu, sticker-picker, chat-widget) и `widgets/call/*` (lobby, grid/stage, controls, screen-share, recording-indicator, in-call-chat, device-settings).
- **Визуальные референсы (только как reference, не импорт):** `entity-detail-block`, `landing-agent-demo`.

Стили — `styles/widgets/chat.css` + `styles/widgets/call.css`; `app/globals.css` импортирует их **после** `@import "tailwindcss"` и остальных widget-стилей (Tailwind v4 `@plugin`/import-порядок).

## Client request ordering

Порядок запросов для chat-панели, meetings и call client зафиксирован в рецепте `docs/api/07_FRONTEND_SCREEN_RECIPES.md` (разделы «Collaboration / meetings / calls» и «Self-hosted A/V call client (LiveKit)»). UI не должен изобретать собственный порядок: канал → conversation → messages → send; для звонка — create room → start session → join-token → turn-credentials → connect → participant-state → recordings → end.

## States

Обязательные состояния каждой поверхности:

- `loading`;
- `empty`;
- `error`;
- `forbidden` / read-only (нет права на канал/комнату).

Call-specific состояния:

- `connecting` — подключение к LiveKit;
- `reconnecting` — обрыв соединения, переживаем звонок (экран `call-reconnecting`);
- `permission-denied` — браузер не дал mic/cam;
- `provider-disabled` — `provider=disabled` или media не сконфигурирован (контрол скрыт/disabled с реальной причиной, не fake).

## Realtime

- Сегодня realtime есть только **SSE для планнинга**.
- Коммуникациям нужны **два канала**: client-side **LiveKit room events** для медиа (roster/track/quality, через `lib/call/*`) **и** серверный **SSE-канал** для chat/notifications/ring вне звонка (обобщение планнинг-SSE).
- Выбор транспорта вне звонка (**SSE vs первый WebSocket**) — **открытое backend-решение**; рекомендация — **SSE** (совпадает с текущим паттерном, multi-instance через Redis, минимум риска). Это решение блокирует reconcile in-call чата и ring-UI.

## Virtual backgrounds / optimization

- Виртуальные фоны — **client-side** через `@livekit/track-processors` (self-hosted MediaPipe wasm/model под `public/livekit`, без внешнего CDN). Серверных виртуальных фонов нет.
- `supportsBackgroundProcessors()` → если не поддержано, контрол **скрыт**, не fake; GPU→CPU fallback; perf-budget auto-degrade.
- Оптимизация связи: `adaptiveStream`, `dynacast`, `simulcast` (codec-тогглы — в web-фазе оптимизации эпика).

## Accessibility

- Call UI должен проходить **axe без critical** нарушений на call-route.
- Клавиатурные mute / leave обязательны.
- Captions — placeholder-слот (субтитры/транскрипция — non-scope, см. ниже), но layout не должен ломаться при его наличии.

## Acceptance criteria

1. Все 12 Storybook SCREEN_IDS рендерятся как чистые виджеты; весь видимый текст — кириллица, ноль EN dev-labels в заголовках/превью.
2. Пока поверхность не подключена — `uiOnlyPreview` + `BannerInline` «Превью — бэкенд не подключён» + disabled media-контролы; ноль fake/enabled-noop affordances.
3. View-model типы (`CallStageView`, `ParticipantTileView`, `MessageView`, `ConversationView`) заморожены как контракт хэндофа; `livekit-client` импортируется только под `lib/call/*`.
4. Route smoke проходит для `/comms`, `/comms/:channelId`, `/calls/:roomId` и in-context chat panel.
5. axe без critical на call-route; mute/leave доступны с клавиатуры.
6. Состояния loading/empty/error/forbidden + call-specific connecting/reconnecting/permission-denied/provider-disabled покрыты.
7. Скриншоты desktop + 390px для call surface и channels.

## Test plan

- Storybook contract: 12 экранов + покомпонентные стори; кириллица, ноль EN dev-labels; fake-affordances clean (media-контролы disabled за `isUiOnlyPreview`).
- Route smoke: comms/call маршруты загружаются без `pageerror` / `console.error`.
- axe: call-route без critical нарушений; keyboard mute/leave.
- Visual: скриншоты desktop + 390px (call surface, channels).
- View-model: типобезопасность пропсов виджетов; eslint-граница импорта SDK.

## Non-scope

Те же media-plane non-scopes, что и `docs/46`:

- транскрипция / субтитры / AI-резюме;
- серверные виртуальные фоны;
- room-composite single-file output (сведение в один MP4 — отложенный фоновый job);
- federation / multi-region SFU;
- mobile push.

Плюс:

- **mobile-native client** (только web; responsive call-UI на 390px входит, нативное приложение — нет).

## Founder-beta vs strict-production split

**Founder-beta (за per-tenant флагом, deferred вне beta route scope):**

- text chat / каналы / упоминания / реакции / стикеры UI на уже готовом backend (`docs/42`/`docs/43`/`docs/44`);
- встречи (meetings list + деталь);
- self-hosted LiveKit аудио/видео **без серверной записи** за per-tenant флагом.

**Strict-production gates (обязательны до публичного прод-релиза):**

- Egress per-track recording включена и доказана;
- TURN-креды + coturn readiness fail-closed;
- webhook signature verification mandatory, fail-closed;
- полный RBAC/audit на egress/TURN + recording-attachment isolation по parent entity;
- axe-clean + 390px call UI;
- никаких test/mock call-хуков в проде.

Коммуникации остаются **вне founder-beta route scope** (deferred/hidden) и должны достичь статуса «wired» прежде, чем войти в beta-маршруты (см. `docs/beta/screen-readiness-matrix.md`).
