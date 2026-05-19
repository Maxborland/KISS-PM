# 23. Phase 3.1: CRM foundation, сделки и аккуратный intake UX

## Статус

Phase 3.1 закрывает продуктовый долг после первого manual intake:

```txt
client -> contact -> deal -> deal stage -> project type -> demand -> feasibility -> active project
```

В пользовательском интерфейсе используем термин **Сделка**. В коде и API допустимо сохранять стабильный идентификатор `Opportunity`, если это уменьшает риск миграции. Это не означает, что продукт становится sales-only CRM: сделка остается входом в проектный контур.

## Цель

Сделать CRM/intake слой пригодным для дальнейшего проектного контура:

- клиент и контакт являются сущностями, а не свободным текстом;
- сделка связана с клиентом, основным контактом, типом проекта и этапом;
- тип проекта является tenant-настройкой;
- этапы сделок являются tenant-настройкой и строят kanban;
- клиенты и контакты имеют отдельные CRM-страницы со списками, поиском и созданием;
- типы проектов и этапы сделок имеют отдельные страницы в группе настроек, а не живут внутри страницы сделок;
- сделку можно открыть в детали по deep link;
- сделку можно создать и редактировать без обхода через API;
- поля сделки как tenant-настройка доступны через `CustomFieldDefinition.targetEntity = opportunity`;
- список и kanban показывают одну и ту же persisted модель;
- `Quick Create` либо работает как контекстное действие текущего экрана, либо убран;
- UI не содержит фейковых чекбоксов, сортировок, bulk/export/actions.

## Compact behavior spec

### AC1. Client

Tenant admin с правом `tenant.clients.manage` может создать, редактировать и архивировать клиента. Клиент имеет:

- `id`;
- `tenantId`;
- `name`;
- `status`: `active`, `archived`;
- `description`;
- `createdAt`;
- `updatedAt`.

Чтение требует `tenant.clients.read`. Все операции tenant-scoped.

UI-владелец сущности: отдельная страница `Клиенты` (`/clients`). Страница `Сделки` не содержит CRUD клиента и только использует клиента как prerequisite/reference.

### AC2. Contact

Tenant admin с правом `tenant.contacts.manage` может создать, редактировать и архивировать контакт, привязанный к клиенту. Контакт имеет:

- `id`;
- `tenantId`;
- `clientId`;
- `name`;
- `email`;
- `phone`;
- `telegram`;
- `role`;
- `status`: `active`, `archived`;
- `createdAt`;
- `updatedAt`.

Нельзя создать или перепривязать контакт к клиенту другого tenant, архивному клиенту или несуществующему клиенту.

UI-владелец сущности: отдельная страница `Контакты` (`/contacts`). Страница `Сделки` не содержит CRUD контакта и только выбирает контакт при создании сделки.

### AC3. ProjectType

Tenant admin с правом `tenant.project_types.manage` может создать, редактировать и архивировать тип проекта. Тип проекта имеет:

- `id`;
- `tenantId`;
- `name`;
- `description`;
- `status`: `active`, `archived`;
- `createdAt`;
- `updatedAt`.

Сделка хранит `projectTypeId`, а UI показывает название типа.

UI-владелец сущности: раздел настроек `Типы проектов` (`/settings/project-types`). Это tenant-справочник, а не часть страницы сделок.

### AC4. DealStage

Tenant admin с правом `tenant.deal_stages.manage` может создавать, редактировать и архивировать этапы сделок. Этап имеет:

- `id`;
- `tenantId`;
- `name`;
- `sortOrder`;
- `status`: `active`, `archived`;
- `createdAt`;
- `updatedAt`.

Kanban строится по активным этапам, отсортированным по `sortOrder`. Если этап архивирован, но на нем уже есть сделка, kanban продолжает показывать этот архивный столбец, чтобы существующая работа не исчезала из операционного экрана. Архивный этап не предлагается для новых сделок и не становится доступным вариантом для чужих сделок. Этапы не hardcoded в React.

UI-владелец сущности: раздел настроек `Этапы сделок` (`/settings/deal-stages`). Страница `Сделки` строит kanban по этим persisted этапам, но не управляет справочником этапов.

### AC5. Deal / Opportunity create and update

Создание и редактирование сделки работает через UI и API. Сделка требует:

- `clientId`;
- `primaryContactId`;
- `projectTypeId`;
- `stageId`;
- название;
- плановые даты;
- стоимость контракта;
- плановую норму часа;
- demand `должность + часы`.

`plannedHours` не вводится руками и не склеивается с экономикой в одну строку. Он считается как `contractValue / plannedHourlyRate` и показывается отдельно от:

- `contractValue` — стоимость;
- `plannedHourlyRate` — плановая норма часа;
- `demand` — потребность по должностям.

`clientName`, `contactName` и `projectType` в response допускаются как read-model snapshot labels, но source of truth — ID связанной сущности. UI обязан резолвить актуальные labels из текущих справочников, если запись справочника доступна.

### AC6. Deal detail

Клик по строке сделки открывает отдельную страницу деталей сделки:

```txt
/opportunities/:id
```

Страница показывает клиент, контакт, тип проекта, этап, коммерческие параметры, расчет часов, demand, feasibility result и доступные действия. Клиент и контакт открываются по клику на свои карточки/ссылки.

Карточка сделки является рабочим CRM/intake окном, а не только паспортом сделки. В ней должна быть правая activity-панель:

- `Лента` — единая хронология комментариев, CRM follow-up задач и системных событий сделки;
- `Чат` — внутренние persisted комментарии по сделке как первый срез коммуникаций;
- `Задачи` — CRM follow-up задачи сделки до активации проекта;
- `Аудит` — отфильтрованные audit events конкретной сделки для пользователей с `tenant.audit_events.read`.

Глобальный `/audit` остается отдельным административным evidence layer. Это не отменяет необходимость показывать operator-facing историю конкретной сделки внутри `/opportunities/:id`: пользователи с `tenant.opportunities.read` видят безопасную ленту системных событий без raw audit payload, а пользователи с `tenant.audit_events.read` получают полную вкладку `Аудит`.

### AC7. Deal views

Раздел `Сделки` поддерживает:

- list view;
- kanban view.

Переключатель вида не должен терять данные. Kanban показывает сделки в колонках по `DealStage`. Изменение этапа выполняется реальным API action и пишет audit. Для desktop baseline этап меняется через drag-and-drop; для keyboard/accessibility baseline сохраняется явное действие смены этапа без fake affordance.

### AC8. Quick Create

`Quick Create` не может быть декоративной кнопкой. В Phase 3.1 допускаются только два варианта:

- context-aware меню с реальными действиями текущего экрана;
- удаление кнопки до появления устойчивого action model.

Выбранный вариант для Phase 3.1: context-aware меню на экране сделок, иначе кнопка скрыта.

### AC9. RBAC and audit

Все state-changing операции проверяют backend permissions и пишут audit. UI hiding не является защитой. Для denied privileged mutation attempts пишется denied audit event.

### AC10. UI/UX

Интерфейс должен быть плотным, аккуратным и рабочим:

- без fake controls;
- с видимыми hover/focus states;
- с loading/error/empty states;
- с inline validation;
- с понятными disabled reasons;
- с responsive layout для desktop и узкого viewport.

### AC11. Deal fields settings and runtime values

Tenant admin с правом `tenant.workspace_config.manage` может создавать и редактировать определения кастомных полей сделки через раздел `Поля и шаблоны`, выбрав сущность `Сделка`.

Форма создания/редактирования сделки runtime-рендерит активные поля `CustomFieldDefinition.targetEntity = opportunity`, валидирует обязательность и базовые типы, сохраняет значения в сделке и показывает их на странице деталей. Неизвестные custom field keys отклоняются backend-валидацией.

### AC12. Governed final action

Пользователь с правом `tenant.opportunities.manage` может закрыть сделку как выигранную (`won_closed`) или отклонить (`lost_rejected`) через явное governed action с обязательной причиной. Финальное действие:

- пишет audit action `opportunity.won_closed` или `opportunity.lost_rejected`;
- блокирует дальнейшее редактирование сделки и повторную activation;
- не заменяет activation проекта: activation проекта переводит source opportunity в `won_closed`;
- скрыто или недоступно для restricted пользователя, а backend остается security boundary.

## Non-goals

- external CRM connector runtime;
- Gantt/WBS/tasks;
- полноценная дневная resource matrix;
- project lifecycle beyond active project shell;
- mass actions/export, если они не реализованы end-to-end.

## Traceable test plan

- AC1 -> DB/API tests: create/list client, restricted `403`, cross-tenant isolation, audit.
- AC2 -> DB/API tests: create/list contact, missing/cross-tenant client rejection, restricted `403`, audit.
- AC3 -> DB/API tests: create/list project type, restricted `403`, audit.
- AC4 -> DB/API tests: create/list deal stages, stage sort order, restricted `403`, audit.
- AC1/AC2/AC3/AC4 update -> DB/API tests: patch client/contact/project type/deal stage, before/after audit, denied update audit, invalid contact client rejection.
- AC5 -> DB/API tests: create and patch deal with linked entities, reject missing linked entities, reset feasibility after economics/demand changes, response includes labels.
- AC1/AC2 UI -> E2E: клиент создается на `/clients`, контакт создается на `/contacts`, страница сделок не показывает кнопки `+ Клиент`/`+ Контакт`.
- AC3/AC4 UI -> E2E: тип проекта создается на `/settings/project-types`, этап сделки создается на `/settings/deal-stages`, страница сделок не показывает кнопки `+ Тип проекта`/`+ Этап`.
- AC1/AC2/AC3/AC4 UI update -> E2E: владелец справочника открывает `Редактировать`, сохраняет изменения после создания сделки, а list/detail/kanban используют обновленные labels.
- AC6 -> Web/component and E2E: row click opens `/opportunities/:id`, detail loads persisted data, client/contact links open `/clients/:id` and `/contacts/:id`, deal card contains a right-side activity panel with no fake tabs.
- AC6 activity -> API/Web/E2E: deal detail has activity panel with persisted comment creation, deal follow-up task creation/completion, same-opportunity system events and raw audit tab gated by `tenant.audit_events.read`.
- AC7 -> Web/component and E2E: list/kanban switch, archived stage with existing deal remains visible, drag-and-drop stage update persists and audit exists.
- AC8 -> Web/component/E2E: quick create only appears where real context actions exist.
- AC9 -> DB/API negative tests: direct API calls fail without permission and write denied audit.
- AC10 -> Browser smoke: desktop and narrow viewport have no broken navigation/table/detail layout.
- AC11 -> Web/component/API/E2E: custom field definition can be created for `Сделка`; DealForm renders active fields, validates required/number/date values, API rejects unknown keys, detail shows saved values.
- AC12 -> API/DB/E2E: close/reject deal with required reason, audit action is written, final deal cannot be edited or activated again, restricted direct API call receives `403`.

## Verification gate

Минимум:

- `pnpm typecheck`;
- `pnpm test`;
- `pnpm --filter @kiss-pm/web build`;
- `pnpm test:db`;
- `pnpm test:e2e:smoke`;
- `git diff --check`;
- `docker compose ps`.

Phase 3.1 не считается закрытой, если сделка не открывается в детали, kanban построен на hardcoded React-этапах или UI содержит видимые fake actions.
