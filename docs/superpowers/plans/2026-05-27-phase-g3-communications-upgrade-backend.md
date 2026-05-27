# Phase G.3 Communications Upgrade Backend — Implementation Plan

## Goal

Полностью реализовать backend slice для общих и entity-scoped коммуникаций: channels, CRM chats, reactions/emoji, sticker packs/imports, channel-scoped calls, notifications, audit, tests and docs.

## Non-goals

- Frontend chat/call/sticker UI.
- Server-side Telegram API fetch or remote sticker sync.
- Animated stickers, transcription, AI summaries.
- WebSocket/SSE delivery beyond persisted events/read models.

## Slice A — Contract and boundaries

- [x] Add Phase G.3 contract.
- [x] Update docs index and phase plan.
- [x] Align domain vocabulary with existing `CollaborationEntityType`, `CallRoom`, Storage and access-control contracts.
- [x] Add ADR/decision note if persistence maps channel scope through the existing conversation tables.

Acceptance:

- Contract names all scope types, permissions, audit actions and non-scope.
- Stickers are explicitly Storage-backed and no-fetch.

## Slice B — Domain model and validation

- [x] Add channel, reaction, sticker and conversation-scope domain types.
- [x] Add parsers/validators for channel commands, emoji/reactions, sticker manifests and sticker file metadata.
- [x] Expand collaboration entity scope to CRM client/contact while preserving old project/task/opportunity API behavior.
- [x] Add call-room scope validation for channel/client/contact.

Acceptance:

- Invalid emoji/sticker/channel/call scope inputs return stable validation errors.
- Domain package remains pure and imports no API, persistence, Hono or Drizzle code.

## Slice C — Persistence and migrations

- [x] Add migration for `communication_channels`.
- [x] Add migration for `communication_channel_members`.
- [x] Add migration for `message_reactions`.
- [x] Add migration for `sticker_packs`.
- [x] Add migration for `sticker_assets`.
- [x] Add migration for `message_stickers`.
- [x] Extend `entity_attachments` to `communication_channel` for channel call recordings.
- [x] Extend repository methods for channels, reactions, stickers and channel-scoped calls.
- [x] Keep tenant/project/entity isolation and index frequent read paths.

Acceptance:

- Unique workspace general channel per tenant.
- Unique active reaction per message/user/emoji.
- Sticker asset requires same-tenant ready FileAsset.
- Archived packs/assets are omitted from sendable read models.

## Slice D — API/application services

- [x] Add channel routes and application permission checks.
- [x] Add reaction add/remove routes.
- [x] Add sticker pack create/import/archive routes.
- [x] Add sticker-message send through existing message create route with `stickerAssetId`.
- [x] Expand conversation route scope support for client/contact/channel.
- [x] Expand call-room routes for channel/client/contact scopes.
- [x] Derive mentions/read-state/notifications for channel and expanded CRM scopes.
- [x] Write safe audit for all success and denial paths.

Acceptance:

- API never returns unreadable message, sticker, channel, call room or notification metadata.
- Sticker import writes FileAsset through Storage provider and cleans up/marks failed on errors.
- Join tokens still never persist or audit.

## Slice E — Tests and hardening

- [x] Unit tests for validators and permission helpers.
- [x] DB tests for channel/member/reaction/sticker isolation and uniqueness.
- [x] API tests for channel messages, reactions, sticker import/send and channel calls.
- [x] Regression tests for existing Collaboration, Realtime, Storage, Documents and Background Jobs.
- [x] Security review: no provider secrets, storage keys, path traversal, unsafe URLs or raw binary metadata leakage.
- [x] CodeGraph sync after changes.

Acceptance:

- Targeted tests pass.
- `pnpm typecheck` passes.
- `pnpm test` or documented repo-standard equivalent passes before PR.

## Slice F — Review and PR

- [ ] Run requesting-code-review / bug-hunt / lead-architect-review.
- [ ] Fix review findings.
- [ ] Commit, push, open PR.
- [ ] Process GitHub review comments until no actionable findings remain.

Acceptance:

- PR contains docs, migrations, domain, persistence, API and tests for the full backend slice.
- No unrelated frontend changes.
