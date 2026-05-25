# 26. Phase 4.2: Storage and connector foundation

## Статус

Это плановый cross-cutting slice после Phase 4 starter и до Phase 5 Gantt/WBS.

Текущий `CrmActivity.type = file` хранит только metadata/link: `fileUrl`, `fileSizeBytes`, `mimeType`. Это осознанный временный контракт, а не полноценный storage layer.

## Почему здесь

Storage/connector слой не должен быть частью только сделки или CRM. Он понадобится сразу нескольким контурам:

- CRM-карточки: сделка, клиент, контакт, товар/услуга;
- project tasks и `Моя работа`;
- будущие документы проекта;
- imports/exports и intake connectors;
- control surfaces, которые показывают evidence и запускают governed actions;
- self-hosted deployment, где файл может храниться локально или во внешнем S3-compatible storage.

Поэтому слой планируется после появления общей activity/task модели, но до тяжелого Gantt/WBS, где вложения, baseline evidence и внешние источники начнут становиться частью рабочего контура.

## Цель

Добавить tenant-scoped контракт для файловых объектов и внешних источников:

```txt
FileAsset
  -> tenantId
  -> id
  -> storageProvider
  -> storageKey
  -> originalName
  -> mimeType
  -> sizeBytes
  -> checksum
  -> createdByUserId
  -> createdAt

ExternalReference
  -> tenantId
  -> id
  -> connectorType
  -> url
  -> title
  -> metadata
  -> createdByUserId
  -> createdAt

EntityAttachment
  -> tenantId
  -> entityType
  -> entityId
  -> assetId | externalReferenceId
  -> relationType
  -> createdByUserId
  -> createdAt
```

`CrmActivity.type = file` после этого slice должен ссылаться на `EntityAttachment`, `FileAsset` или `ExternalReference`, а не быть единственным местом хранения файловой информации.

## Scope

- tenant-scoped schema и migrations для `FileAsset`, `ExternalReference`, `EntityAttachment`;
- безопасная валидация URL, mime type, размера и имени файла;
- application commands для привязки файла/ссылки к сущности;
- permission checks по целевой сущности и отдельный audit event;
- read model для activity workspace: файл/ссылка видны в ленте сущности;
- adapter boundary для storage provider без привязки core domain к конкретному облаку;
- self-hosted baseline: local filesystem или S3-compatible provider как настройка окружения;
- E2E smoke: прикрепить ссылку к CRM-сущности и увидеть ее после reload.

## Non-scope

- полноценный document editor;
- rich preview всех типов файлов;
- email/Telegram/Bitrix/AmoCRM connector runtime;
- antivirus/DLP enterprise pipeline;
- versioned document approval workflow;
- массовый импорт файлов.

## Права и аудит

Минимальные права:

- чтение вложений наследуется от read-права целевой сущности;
- создание/удаление вложений требует manage-права целевой сущности;
- future admin settings для storage provider требуют отдельного `tenant.storage.manage`.

Минимальные audit actions:

- `attachment.file_attached`;
- `attachment.external_reference_attached`;
- `attachment.removed`;
- `attachment.denied`.

Audit event обязан содержать `sourceEntity`, `targetEntity` и безопасный metadata summary без секретов storage provider.

## Connector boundary

Connector не является доменным ядром. Core domain хранит только `ExternalReference` и normalized metadata. Интеграции с email, Bitrix, AmoCRM, Telegram, S3, local filesystem и другими источниками подключаются через adapters:

```txt
connector adapter
  -> validates external input
  -> maps to ExternalReference или FileAsset
  -> calls application command
  -> command writes attachment + audit
```

Нельзя позволять connector-у напрямую менять CRM/project state без application command, permission check и audit.

## Acceptance criteria

- AC1: `FileAsset`, `ExternalReference` и `EntityAttachment` tenant-scoped и не пересекаются между tenant.
- AC2: API отклоняет небезопасные URL-схемы, пустые имена, отрицательный размер, неизвестную целевую сущность и cross-tenant references.
- AC3: Authorized user прикрепляет external reference к сделке, клиенту, контакту, товару или задаче и видит запись в activity workspace после reload.
- AC4: Restricted user не может прикрепить файл/ссылку и получает `403`; denied attempt пишет audit.
- AC5: `CrmActivity.type = file` больше не является единственным storage contract и отображает attachment read model.
- AC6: Storage provider details не протекают в UI/API response, кроме безопасных display metadata.
- AC7: Self-hosted runtime имеет документированную настройку provider-а и smoke-проверку базового сценария.

## Test plan

- schema/migration tests для таблиц, tenant keys, constraints и indexes;
- parser tests для URL, mime type, filename, size;
- repository DB tests для tenant isolation и attachment links;
- API DB tests для permissions, audit, invalid inputs и cross-tenant rejection;
- web unit/query tests для activity attachment read model;
- Playwright smoke: attach external reference to CRM entity, reload, verify visible file row;
- позже отдельный smoke для task attachment после расширения project task UI.

## Связанные фазы

- Phase 3.1 и `25_CRM_ENTITY_WORKSPACE_TEMPLATE.md` используют metadata-only ссылки до этого slice.
- Phase 4 starter создает `Task`; attachment support для задач добавляется здесь или сразу после него.
- Phase 5 Gantt/WBS не должен проектировать собственные вложения: он использует этот общий contract.
- Phase 8 KPI/signals/control actions используют attachments as evidence, но не владеют storage.
- Phase 11 production hardening расширит provider security, backup, retention и monitoring.
