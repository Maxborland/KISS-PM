# ADR: Storage lifecycle и граница unified metadata search

## Контекст

Phase F добавляет общий слой `FileAsset`, `ExternalReference` и `EntityAttachment`.
Этот слой нужен CRM, задачам, проектам, будущим документам, control signals и connector adapters.

## Решение

- `FileAsset` имеет lifecycle `pending -> ready | failed -> archived`.
- Upload сначала создает `pending` asset, затем пишет object в provider, после чего application service переводит asset в `ready` и создает `EntityAttachment`.
- Delete в v1 является archive-first: attachment и asset/reference архивируются, physical object cleanup остается отдельным future job.
- Поддерживаются provider-ы `local` и `s3`; provider details не попадают в публичные API и audit payload.
- `ExternalReference` в v1 никогда не fetch-ится сервером. Backend только валидирует и хранит display URL.
- Connector adapters в будущем создают `ExternalReference`/`FileAsset` только через application command path с permission check и audit.
- Unified search v1 ищет только metadata и возвращает API shape, совместимый с будущей persisted projection `global_search_documents`.

## Следствия

- Partial failures не создают публично downloadable asset без статуса `ready`.
- Legacy `crm_activities.type=file` и `task_activities.type=file` остаются readable, но новые вложения идут через attachment read model.
- Full-text file indexing, antivirus/DLP, presigned URLs, connector sync jobs и cleanup worker остаются будущими slices.
