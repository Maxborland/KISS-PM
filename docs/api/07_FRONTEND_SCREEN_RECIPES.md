# Frontend Screen Recipes

Этот документ описывает не отдельные endpoints, а порядок запросов для экранов.
Он нужен фронту как рабочая карта интеграции поверх Scalar/OpenAPI.

## Общий authenticated shell

1. `GET /api/auth/me`
2. Если `401 session_required` — показать login flow.
3. После login инвалидировать все workspace queries.
4. Для mutations всегда добавлять `x-kiss-pm-action: same-origin`.

Основные shared справочники shell:

- `GET /api/workspace/users`
- `GET /api/workspace/positions`
- `GET /api/workspace/access-roles`
- `GET /api/workspace/config/custom-fields`

## CRM opportunities

Экран списка/канбана сделок:

1. `GET /api/workspace/opportunities`
2. `GET /api/workspace/crm/pipelines`
3. `GET /api/workspace/crm/pipelines/:pipelineId/stages`
4. `GET /api/workspace/clients`
5. `GET /api/workspace/project-types`

`GET /api/workspace/deal-stages` остается compatibility-справочником для старых клиентов. Для текущего движения opportunity по intake pipeline использовать CRM pipeline stages и `POST /api/workspace/opportunities/:opportunityId/pipeline-transition`.

Карточка сделки:

1. `GET /api/workspace/opportunities/:opportunityId`
2. `GET /api/workspace/crm/opportunity/:opportunityId/activity`
3. `GET /api/workspace/attachments?entityType=opportunity&entityId=:opportunityId`
4. Для проверки ресурсной реализуемости: `POST /api/workspace/opportunities/:opportunityId/feasibility`
5. Для создания проекта: `POST /api/workspace/opportunities/:opportunityId/activate`

Conflict handling: после stage/finalize/activate обновлять opportunity detail, project list и audit/activity.

## Project workspace

Базовая карточка проекта:

1. `GET /api/workspace/projects/:projectId`
2. `GET /api/workspace/projects/:projectId/tasks`
3. `GET /api/workspace/projects/:projectId/planning/read-model`
4. `GET /api/workspace/attachments?entityType=project&entityId=:projectId`

Для task detail:

1. `GET /api/workspace/tasks/:taskId`
2. `GET /api/workspace/tasks/:taskId/activity`
3. `GET /api/workspace/attachments?entityType=task&entityId=:taskId`

## Planning / Gantt

Главный источник состояния:

```txt
GET /api/workspace/projects/:projectId/planning/read-model
```

Правило mutation:

1. Взять `planVersion` из read model.
2. Отправить command в `POST /planning/preview-command`.
3. Показать before/after/validation.
4. Применить через `POST /planning/apply-command` или batch apply.
5. Если `409` или stale planVersion — перечитать read model и показать conflict state.

Auto-solver:

1. `POST /planning/auto-solver-runs`
2. `GET /planning/auto-solver-runs/:runId`
3. Пользователь выбирает persisted proposal.
4. `POST /planning/auto-solver-runs/:runId/proposals/:proposalId/apply`

Apply никогда не должен пересчитывать proposal на фронте.

## Capacity / resource load

Tenant-wide загрузка:

1. `GET /api/workspace/capacity/summary?monthIso=YYYY-MM`
2. `GET /api/workspace/capacity/tree?monthIso=YYYY-MM`
3. Drilldown employee-day: `GET /api/workspace/capacity/drilldown?monthIso=YYYY-MM&resourceId=:userId&date=YYYY-MM-DD`

Если проектные данные скрыты правами, backend маскирует contribution metadata, но totals остаются полными.

## Attachments and search

Entity attachments:

1. `GET /api/workspace/attachments?entityType=&entityId=`
2. `POST /api/workspace/attachments/files` для upload.
3. `POST /api/workspace/attachments/external-references` для ссылки.
4. `GET /api/workspace/attachments/:attachmentId/download` для download.
5. `DELETE /api/workspace/attachments/:attachmentId` для archive-first удаления.

Global search:

```txt
GET /api/workspace/search?q=&limit=&types=
```

Search v1 ищет metadata only. Нечитаемые entities не возвращаются.

## Collaboration / meetings / calls

Project/task/CRM chat panel:

1. Найти или создать `communication-channel`.
2. `GET /api/workspace/communication-channels/:channelId/conversation`
3. `GET /api/workspace/conversations/:conversationId/messages`
4. `POST /api/workspace/conversations/:conversationId/messages`
5. Reactions/stickers идут отдельными message child actions.

Meetings:

1. `GET /api/workspace/meetings`
2. `POST /api/workspace/meetings`
3. `POST /api/workspace/meetings/:meetingId/external-links`
4. `POST /api/workspace/meetings/:meetingId/notes`
5. `POST /api/workspace/meetings/:meetingId/action-items`

Calls:

1. `GET /api/workspace/call-rooms`
2. `POST /api/workspace/call-rooms/:roomId/sessions/start`
3. `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/join-token`
4. `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/participant-state`
5. `POST /api/workspace/call-rooms/:roomId/sessions/:sessionId/end`

Join token является backend control-plane объектом. Медиа-трафик идет через provider,
а не через KISS PM API.

## Documents / knowledge

Project knowledge tab:

1. `GET /api/workspace/projects/:projectId/knowledge/documents`
2. `GET /api/workspace/projects/:projectId/knowledge/decisions`
3. `GET /api/workspace/projects/:projectId/knowledge/action-items`

Document detail:

1. `GET /api/workspace/projects/:projectId/knowledge/documents/:documentId`
2. `POST /api/workspace/projects/:projectId/knowledge/documents/:documentId/versions`
3. Attachments use common attachment endpoints with `entityType=document`.

## Background jobs

Admin/operations surface:

1. `GET /api/workspace/background-jobs/runs`
2. `GET /api/workspace/background-jobs/runs/:runId/events`
3. `POST /api/workspace/background-jobs/runs`

Background jobs are operational API. Product UI should expose only jobs that have
clear tenant value and safe permissions.
