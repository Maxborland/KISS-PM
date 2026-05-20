# 2026-05-20. Общий CRM activity contract

## Контекст

Первый CRM activity slice был построен вокруг сделки и `OpportunityActivity`. После появления самостоятельных страниц клиента, контакта и товара это стало архитектурным ограничением: правый activity workspace на этих страницах не должен быть placeholder и не должен зависеть от deal-only модели.

## Решение

Текущий runtime переводится на общий tenant-scoped `CrmActivity`:

- `entityType`: `opportunity | client | contact | product`;
- `entityId`: идентификатор CRM-сущности внутри tenant;
- `type`: `comment | task | file`;
- `file` хранит metadata/link (`fileUrl`, `fileSizeBytes`, `mimeType`), а не binary storage;
- `fileUrl` допускает только абсолютные `http://` и `https://` ссылки;
- API использует общий route shape `/api/workspace/crm/:entityType/:entityId/...`;
- permission check выбирается по `entityType`;
- audit action пишет `crm_activity.<entityType>.<action>`.

## Не делаем

- Не держим runtime fallback на старые `/api/workspace/opportunities/:id/comments|tasks|activity`.
- Не сохраняем `opportunity_activities` как текущую таблицу.
- Не добавляем binary file storage в этом slice.

## Последствия

Карточки сделки, клиента, контакта и товара используют один activity workspace: лента, follow-up задачи и файловые ссылки persisted одинаково. Исторические планы/решения про `OpportunityActivity` остаются как история этапов, но не являются текущим контрактом.
