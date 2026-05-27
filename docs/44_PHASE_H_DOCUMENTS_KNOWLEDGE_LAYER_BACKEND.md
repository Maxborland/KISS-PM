# 44. Phase H: Documents / Knowledge Layer backend

## Статус

Phase H является backend-only продолжением storage/search и collaboration/communications. UI, rich document editor, approvals runtime, full-text extraction, external document sync и AI summaries не входят.

## Product intent

KISS PM должен хранить проектное знание рядом с планом, встречами и управленческими действиями:

- проектные документы и их версии;
- протоколы встреч как linked knowledge source;
- журнал решений;
- action items;
- вложения через общий Storage layer;
- будущую границу approvals без реализации workflow.

Ценность для пользователя: PM и команда видят не только задачи и график, но и почему было принято решение, какие договоренности появились после встречи, какие документы актуальны и какие follow-up действия открыты.

## Scope

### Project documents

`KnowledgeDocument` является tenant/project-scoped документом:

- `id`, `tenantId`, `projectId`;
- `title`, `summary`, `documentType`;
- `status`: `draft | active | archived`;
- `currentVersionId`;
- optional links: `sourceMeetingId`, `approvalStatus`, `approvalRequestedByUserId`;
- `createdByUserId`, `createdAt`, `updatedAt`, `archivedAt`.

`KnowledgeDocumentVersion` хранит immutable snapshot:

- `id`, `tenantId`, `documentId`;
- `versionNumber`;
- `title`, `body`, `summary`;
- `createdByUserId`, `createdAt`;
- `changeReason`.

Вложения документа создаются через существующий `EntityAttachment` с `entityType = document`.

### Meeting minutes

Существующие `MeetingNote` остаются source-of-truth для notes в collaboration layer. Phase H добавляет возможность связать проектный документ с `sourceMeetingId`, чтобы протокол встречи стал версионируемым knowledge artifact без дублирования meeting API.

### Decision log

`DecisionLogEntry` хранит project-scoped решение:

- `id`, `tenantId`, `projectId`;
- `title`, `decision`, `rationale`;
- `status`: `proposed | accepted | superseded | rejected`;
- optional links: `sourceMeetingId`, `documentId`, `supersedesDecisionId`;
- `createdByUserId`, `createdAt`, `updatedAt`, `archivedAt`.

### Action items

`KnowledgeActionItem` хранит follow-up действие, не мутирующее planning/control state напрямую:

- `id`, `tenantId`, `projectId`;
- `title`, `description`, `ownerUserId`, `dueDate`;
- `status`: `open | done | cancelled`;
- optional links: `sourceMeetingId`, `documentId`, `decisionId`, `targetEntityType`, `targetEntityId`;
- `createdByUserId`, `createdAt`, `updatedAt`, `archivedAt`.

Action item может позже стать governed task/corrective-action candidate, но в этой фазе остается knowledge record.

## API surface

- `GET /api/workspace/projects/:projectId/knowledge/documents`
- `POST /api/workspace/projects/:projectId/knowledge/documents`
- `GET /api/workspace/projects/:projectId/knowledge/documents/:documentId`
- `POST /api/workspace/projects/:projectId/knowledge/documents/:documentId/versions`
- `DELETE /api/workspace/projects/:projectId/knowledge/documents/:documentId`
- `GET /api/workspace/projects/:projectId/knowledge/decisions`
- `POST /api/workspace/projects/:projectId/knowledge/decisions`
- `PATCH /api/workspace/projects/:projectId/knowledge/decisions/:decisionId`
- `GET /api/workspace/projects/:projectId/knowledge/action-items`
- `POST /api/workspace/projects/:projectId/knowledge/action-items`
- `PATCH /api/workspace/projects/:projectId/knowledge/action-items/:actionItemId`

Stable errors:

- `knowledge_not_configured`;
- `knowledge_project_not_found`;
- `knowledge_document_not_found`;
- `knowledge_decision_not_found`;
- `knowledge_action_item_not_found`;
- `knowledge_invalid_input`.

## Permissions

- Read requires `tenant.projects.read`.
- Mutations require `tenant.projects.manage`.
- Attachments inherit the document read/manage decision through `EntityAttachment`.
- Meeting links are accepted only when the meeting belongs to the same tenant and project.
- Linked document/decision/action item IDs must belong to the same tenant/project.

## Audit

Required actions:

- `knowledge.document_created`;
- `knowledge.document_version_created`;
- `knowledge.document_archived`;
- `knowledge.decision_recorded`;
- `knowledge.decision_updated`;
- `knowledge.action_item_created`;
- `knowledge.action_item_updated`;
- `knowledge.denied`.

Audit stores safe metadata only: ids, projectId, title/status/type and linked entity ids. It never stores raw document body, file storage keys, provider internals or secrets.

## Search integration

Unified search v1 adds metadata-only sources:

- documents by title/summary/type;
- decisions by title/decision/rationale;
- action items by title/description/status.

Permission filtering happens before response. Unreadable project knowledge is omitted, not masked.

## Non-scope

- Rich text editor UI.
- Collaborative live editing.
- Approval workflow execution.
- Full-text extraction from binary files.
- External Google/Microsoft/Confluence sync.
- AI meeting summaries.

## Acceptance criteria

1. User with project read can list/read documents, versions, decisions and action items.
2. User with project manage can create a document, add immutable versions and archive it.
3. User with project manage can record/update decisions and project action items.
4. Document attachments use existing attachment APIs with `entityType=document`.
5. Cross-project/cross-tenant links to meetings, documents, decisions and action items are rejected.
6. Search returns knowledge metadata only for readable projects.
7. All mutations write audit and denied manage attempts write `knowledge.denied`.
8. Tenant isolation is enforced in schema, repository and API tests.

## Test plan

- Unit:
  - parsers for titles/body/status/type/date/link ids;
  - search scoring stays bounded and metadata-only.
- DB/integration:
  - document version immutability and version ordering;
  - tenant/project isolation;
  - attachment entity type `document`;
  - cross-project link rejection.
- API:
  - document create/list/detail/version/archive;
  - decision create/update;
  - action item create/update;
  - permission denied and audit writes;
  - search returns only readable knowledge metadata.
- Regression:
  - storage/search, collaboration/meetings, communication realtime, planning, KPI/control, closure and audit tests keep passing.
