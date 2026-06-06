# 44. Phase G.3 / Phase 11.3: Communications upgrade backend

## Статус

Phase G.3 расширяет уже реализованные Collaboration/Communications foundation и Realtime backend до полноценного backend-слоя рабочих коммуникаций KISS PM.

Фаза остается **backend-only**: web/mobile chat UI, клиентский WebRTC SDK, визуальные экраны звонков, push/email delivery и модераторские панели не входят.

## Product intent

Коммуникации в KISS PM должны быть рабочим контекстом проекта, CRM и задач, а не отдельным мессенджером сбоку. Пользователь должен иметь:

- общий tenant/workspace чат для координации;
- scoped-чаты в проектах, задачах и CRM-сущностях;
- аудио/видео комнаты с безопасным join contract;
- сообщения, реакции, emoji, stickers, mentions, read/unread и notifications;
- связь обсуждений с файлами, встречами, решениями, action items и audit;
- одинаковые правила доступа для текста, вложений, stickers, recordings и call events.

## Scope

### Channel chats

- First-class `CommunicationChannel` для общих чатов.
- Типы каналов v1:
  - `workspace_general` — общий чат tenant/workspace;
  - `team` — чат команды/org unit;
  - `project_general` — общий чат проекта, если проекту нужен отдельный канал помимо task/project conversation;
  - `custom` — ручной канал, если tenant включит capability.
- `CommunicationChannelMember` с ролью `owner | moderator | member`.
- Один persisted conversation на канал.
- Channel messages используют тот же `DiscussionMessage`, mentions, reactions, attachments, read-state и notifications.

### Entity-scoped chats

- Сохраняется текущий conversation pattern для `project`, `task`, `opportunity`.
- Расширяется CRM scope:
  - `client`;
  - `contact`;
  - future-compatible `product`.
- Entity conversation остается default-коммуникацией рядом с карточкой сущности.
- General channel не заменяет entity conversation: пользователь должен видеть обсуждение в контексте сущности без поиска по общему чату.

### Messages and reactions

- `DiscussionMessage` остается source of truth для сообщений.
- Body v1: plain text или constrained rich-text JSON без HTML.
- Emoji в тексте разрешены как Unicode, но нормализуются и ограничиваются размером message body.
- `MessageReaction`:
  - `tenantId`, `messageId`, `userId`, `emoji`, `createdAt`;
  - unique `(tenantId, messageId, userId, emoji)`;
  - v1 разрешает только одиночные Unicode emoji/grapheme; tenant-approved custom emoji aliases остаются future scope;
  - реакции не создают уведомления, кроме future preference.
- Edit/delete/pin сохраняют текущую permission и audit модель.

### Stickers

- `StickerPack` — tenant-scoped набор stickers.
- `StickerAsset` — отдельный sticker внутри pack.
- Supported import v1:
  - admin/manual upload PNG/WebP files;
  - JSON manifest export с metadata;
  - Telegram-like pack import **без server-side Telegram API fetch**: backend принимает уже экспортированные PNG/WebP/WebP + manifest, но не ходит в Telegram сам.
- Supported mime v1: `image/png`, `image/webp`.
- Animated stickers, Lottie/TGS, video stickers и remote pack sync остаются future scope.
- Binary хранится через existing Storage `FileAsset`.
- Sticker metadata:
  - `emoji`;
  - `title`;
  - `tags`;
  - `width`, `height`;
  - `sizeBytes`;
  - `checksumSha256`;
  - `status`: `pending | ready | archived | failed`.
- `MessageSticker` связывает message со sticker asset. Sticker-message не хранит binary или storage key в body/metadata.

### Calls and meetings

- Call rooms расширяются с `project | task | opportunity` до:
  - channel room;
  - client/contact CRM room;
  - existing project/task/opportunity room.
- Provider boundary остается `disabled | manual | jitsi | livekit`.
- Join token contract из Phase G.2 сохраняется:
  - short-lived;
  - returned only in response;
  - never persisted/audited/logged.
- Meetings могут быть связаны с project/task/opportunity/client/contact/channel.
- Meeting notes, recordings and action items используют existing storage/attachments and audit contracts.
- Attachment contract расширяется на `communication_channel`, чтобы channel call recordings имели валидный same-entity `EntityAttachment` path.

## Domain model

### CommunicationChannel

Fields:

- `id`, `tenantId`;
- `channelType`: `workspace_general | team | project_general | custom`;
- `title`, `description`;
- `scopeEntityType`: optional `project | org_unit`;
- `scopeEntityId`;
- `createdByUserId`, `createdAt`, `updatedAt`, `archivedAt`.

Invariant: one active `workspace_general` channel per tenant.

### CommunicationChannelMember

Fields:

- `tenantId`, `channelId`, `userId`;
- `role`: `owner | moderator | member`;
- `createdByUserId`, `createdAt`, `archivedAt`.

Invariant: channel member must belong to the same tenant and active workspace user set.

### ConversationScope

Application-level union:

- `{ type: "entity", entityType, entityId }`;
- `{ type: "channel", channelId }`.

Persistence may map channel conversations into the existing conversation/message tables, but domain/API must expose scope explicitly so channel semantics do not leak as fake CRM/project entities.

### MessageReaction

Fields:

- `id`, `tenantId`, `messageId`, `userId`;
- `emoji`;
- `createdAt`, `archivedAt`.

Invariant: only one active reaction per `(tenantId, messageId, userId, emoji)`.

### StickerPack

Fields:

- `id`, `tenantId`;
- `title`, `description`;
- `source`: `manual_upload | telegram_export | other_import`;
- `status`: `ready | archived`;
- `createdByUserId`, `createdAt`, `archivedAt`.

### StickerAsset

Fields:

- `id`, `tenantId`, `packId`;
- `fileAssetId`;
- `emoji`, `title`, `tags`;
- `mimeType`, `width`, `height`, `sizeBytes`, `checksumSha256`;
- `status`: `pending | ready | archived | failed`;
- `createdByUserId`, `createdAt`, `archivedAt`.

Invariant: `fileAssetId` must point to ready tenant-scoped `FileAsset` with allowed image mime and safe size.

### MessageSticker

Fields:

- `tenantId`, `messageId`, `stickerAssetId`;
- `createdByUserId`, `createdAt`.

Invariant: sticker message visibility is inherited from the parent conversation.

## API surface

### Channels

- `GET /api/workspace/communication-channels?type=`
- `POST /api/workspace/communication-channels`
- `GET /api/workspace/communication-channels/:channelId`
- `PATCH /api/workspace/communication-channels/:channelId`
- `POST /api/workspace/communication-channels/:channelId/members`
- `DELETE /api/workspace/communication-channels/:channelId/members/:userId`
- `GET /api/workspace/communication-channels/:channelId/conversation`

### Conversations and messages

Existing endpoints remain stable:

- `GET /api/workspace/conversations?entityType=&entityId=`
- `GET /api/workspace/conversations/:conversationId/messages?cursor=&limit=`
- `POST /api/workspace/conversations/:conversationId/messages`
- `PATCH /api/workspace/conversations/:conversationId/messages/:messageId`
- `POST /api/workspace/conversations/:conversationId/messages/:messageId/pin`
- `DELETE /api/workspace/conversations/:conversationId/messages/:messageId`
- `POST /api/workspace/conversations/:conversationId/read-state`

New message endpoints:

- `POST /api/workspace/conversations/:conversationId/messages/:messageId/reactions`
- `DELETE /api/workspace/conversations/:conversationId/messages/:messageId/reactions/:reactionId`

Sticker message send uses the existing message create endpoint with optional `stickerAssetId`. If `body` is omitted, backend stores the sticker emoji/title-safe fallback as message body and creates `MessageSticker` atomically with the message.

### Stickers

- `GET /api/workspace/sticker-packs`
- `POST /api/workspace/sticker-packs`
- `POST /api/workspace/sticker-packs/:packId/import`
- `DELETE /api/workspace/sticker-packs/:packId`
- `GET /api/workspace/sticker-packs/:packId/stickers`
- `DELETE /api/workspace/stickers/:stickerId`

### Calls

Existing call room endpoints preserve old entity fields and additionally accept `entityType: "communication_channel"` with a channel id as `entityId`:

- `GET /api/workspace/call-rooms?entityType=&entityId=&channelId=`
- `POST /api/workspace/call-rooms`
- `POST /api/workspace/call-rooms/:roomId/sessions/start`
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/join-token`
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/participant-state`
- `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/end`
- `POST /api/workspace/call-rooms/:roomId/recordings`
- `GET /api/workspace/call-rooms/:roomId/events?limit=`

## Permissions

### Read

- Workspace general channel: active tenant user.
- Team channel: channel member or tenant communication manager.
- Project general channel: project read.
- Custom channel: channel member or communication manager.
- Entity conversation:
  - project: project read;
  - task: project read or task owner/requester/participant;
  - opportunity/client/contact/product: CRM entity read.

### Write/manage

- Send message/reaction/sticker: conversation read plus active workspace user.
- Edit/delete own message: author or conversation manager.
- Pin/unpin: conversation manager.
- Channel create/update/member manage: `tenant.communications.manage`.
- Sticker pack import/archive: `tenant.communications.manage`.
- Call room create/start/end/recording attach: parent entity manage, channel owner/moderator or `tenant.communications.manage`.
- Channel attachment create/delete for recordings: channel owner/moderator or `tenant.communications.manage`; read follows channel visibility.
- Join token: readable room plus active workspace user.

## Audit

New audit actions:

- `communications.channel_created`;
- `communications.channel_updated`;
- `communications.channel_member_added`;
- `communications.channel_member_removed`;
- `communications.message_reaction_added`;
- `communications.message_reaction_removed`;
- `communications.sticker_pack_created`;
- `communications.sticker_pack_imported`;
- `communications.sticker_pack_archived`;
- `communications.sticker_archived`;
- `communications.denied`.

Sticker send is captured by `collaboration.message_created` with safe `stickerAssetId` in `afterState`.

Audit stores only safe metadata: ids, entity/channel scope, emoji, sticker pack id, sticker asset id and file mime/size. It never stores storage keys, local paths, provider secrets, call join tokens, checksums or raw binary content.

## Security and privacy

- Tenant isolation in every table, repository method and API handler.
- No server-side fetch for Telegram, sticker source URLs or external meeting URLs in v1.
- Sticker import accepts bounded multipart payloads only.
- Max sticker file size v1: 2 MiB per sticker.
- Sticker import endpoint accepts one PNG/WebP file per request in v1; bulk manifest import remains future scope.
- Allowed sticker image dimensions v1: 64..512 px per side.
- File names are sanitized through Storage safe display name.
- Message body has strict size limit and no arbitrary HTML.
- Reactions validate a single Unicode emoji/grapheme and reject aliases or arbitrary script-like strings.
- Call token and provider secrets never persist.
- Notification and search read models must permission-filter before response.

## Architecture boundaries

- Domain owns channel/scope/sticker/reaction types and validation.
- API/application owns auth, permissions, upload orchestration, mention expansion, notification derivation and audit.
- Persistence owns tenant-scoped tables and repository methods.
- Storage remains the only binary layer for stickers, recordings and attachments.
- Video provider adapter remains call-token/join-contract only.
- Background jobs can later handle stale failed sticker assets and notification fan-out, but synchronous v1 must stay correct without workers.

## Non-scope

- Frontend chat/call/sticker UI.
- Mobile push/email/websocket delivery.
- Native SFU/media server implementation.
- Server-side Telegram API integration or remote pack sync.
- Animated stickers (`.tgs`, Lottie, video).
- Full-text search over message bodies.
- Moderation workflows, retention/legal hold, eDiscovery.
- AI summaries/transcription.

## Acceptance criteria

1. Active tenant user can access workspace general channel, send/read messages, reactions and stickers.
2. Project/task/opportunity/client/contact conversations enforce parent entity read permissions.
3. Channel membership gates private/team/custom channels.
4. Sticker packs import only safe PNG/WebP files through Storage and never expose storage internals.
5. Sticker messages are visible only through the parent conversation permission.
6. Emoji reactions are idempotent per user/message/emoji and tenant-isolated.
7. Call rooms can be scoped to channel or entity without leaking provider secrets.
8. Mentions/read-state/notifications remain permission-filtered for channel and CRM scopes.
9. All write/manage flows write audit; denied attempts write safe denial audit.
10. Existing Phase G/G.2 endpoints stay backward compatible.

## Test plan

- Unit:
  - conversation scope parser;
  - channel permission rules;
  - emoji/reaction validation;
  - sticker manifest/file validation;
  - audit sanitization for stickers/calls.
- DB/integration:
  - channel/member/conversation uniqueness;
  - reaction idempotency;
  - sticker pack/import tenant isolation;
  - sticker asset/FileAsset consistency;
  - channel and CRM scoped call rooms.
- API:
  - workspace general channel bootstrap/read/write;
  - project/task/opportunity/client/contact conversation permissions;
  - reaction add/remove;
  - sticker pack create/import/archive;
  - send sticker message;
  - channel-scoped call room lifecycle and join token safety;
  - denied paths and audit.
- Regression:
  - existing collaboration, realtime calls, storage/search, documents, background jobs, planning, KPI/control, capacity, closure and audit tests keep passing.
