# Documents / Knowledge Layer backend implementation plan

## Goal

Реализовать backend-only Phase H поверх текущего `master`: project documents, meeting minutes link, decision log, action items, document attachments, versioning и future approvals boundary.

## Slices

### Slice A — Domain contract

- Добавить `packages/domain/src/knowledge.ts`.
- Типы: `KnowledgeDocument`, `KnowledgeDocumentVersion`, `DecisionLogEntry`, `KnowledgeActionItem`.
- Парсеры: title, summary, body, status, document type, optional date/id/link.
- Экспортировать из `packages/domain/src/index.ts`.

Acceptance:

- Валидация режет control characters, пустые значения, слишком длинные поля и неверные enum.

### Slice B — Persistence

- Добавить tables в `packages/persistence/src/schema.ts`.
- Добавить migration `0037_phase_h_documents_knowledge_layer.sql`.
- Добавить `knowledgeRepository.ts` и подключить в `repositories.ts`.
- Расширить `AttachmentEntityType` значением `document`.

Acceptance:

- Tables tenant-scoped, FK composite, version rows append-only, active rows filter archived.

### Slice C — API

- Добавить `knowledgeRoutes.ts`.
- Подключить в `app.ts`.
- Расширить `ApiTenantDataSource`.
- Права: read=`tenant.projects.read`, manage=`tenant.projects.manage`.
- Audit: success/denied без raw document body.

Acceptance:

- Все endpoints возвращают stable errors и не раскрывают cross-tenant/project state.

### Slice D — Storage/Search integration

- `attachmentEntityAccess.ts` умеет `document`.
- `searchFilterConfig`, `searchRouting`, `workspaceSearchSources` добавляют `document`, `decision`, `knowledge_action_item`.

Acceptance:

- Attachments к документу используют общий storage.
- Search metadata-only и permission-filtered.

### Slice E — Tests and verification

- Domain unit tests.
- Persistence DB tests.
- API route tests.
- Search tests.
- Verification: targeted vitest, `pnpm typecheck`, `pnpm test` where feasible, CodeGraph sync/status.

## Architecture constraints

- Domain не импортирует API/persistence/Drizzle.
- API не пишет storage internals в audit.
- Meeting minutes не дублируют `meeting_notes`; documents link to `sourceMeetingId`.
- Approval workflow остается boundary fields, без runtime engine.
- No frontend changes.
