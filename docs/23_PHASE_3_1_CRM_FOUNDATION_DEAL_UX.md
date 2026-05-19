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
- сделку можно открыть в детали по deep link;
- список и kanban показывают одну и ту же persisted модель;
- `Quick Create` либо работает как контекстное действие текущего экрана, либо убран;
- UI не содержит фейковых чекбоксов, сортировок, bulk/export/actions.

## Compact behavior spec

### AC1. Client

Tenant admin с правом `tenant.clients.manage` может создать клиента. Клиент имеет:

- `id`;
- `tenantId`;
- `name`;
- `status`: `active`, `archived`;
- `description`;
- `createdAt`;
- `updatedAt`.

Чтение требует `tenant.clients.read`. Все операции tenant-scoped.

### AC2. Contact

Tenant admin с правом `tenant.contacts.manage` может создать контакт, привязанный к клиенту. Контакт имеет:

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

Нельзя создать контакт для клиента другого tenant или несуществующего клиента.

### AC3. ProjectType

Tenant admin с правом `tenant.project_types.manage` может создать тип проекта. Тип проекта имеет:

- `id`;
- `tenantId`;
- `name`;
- `description`;
- `status`: `active`, `archived`;
- `createdAt`;
- `updatedAt`.

Сделка хранит `projectTypeId`, а UI показывает название типа.

### AC4. DealStage

Tenant admin с правом `tenant.deal_stages.manage` может управлять этапами сделок. Этап имеет:

- `id`;
- `tenantId`;
- `name`;
- `sortOrder`;
- `status`: `active`, `archived`;
- `createdAt`;
- `updatedAt`.

Kanban строится по активным этапам, отсортированным по `sortOrder`. Этапы не hardcoded в React.

### AC5. Deal / Opportunity create

Создание сделки требует:

- `clientId`;
- `primaryContactId`;
- `projectTypeId`;
- `stageId`;
- название;
- плановые даты;
- стоимость контракта;
- плановую норму часа;
- demand `должность + часы`.

`clientName`, `contactName` и `projectType` в response допускаются как read-model labels, но source of truth — ID связанной сущности.

### AC6. Deal detail

Клик по строке сделки открывает отдельную страницу деталей сделки:

```txt
/opportunities/:id
```

Страница показывает клиент, контакт, тип проекта, этап, коммерческие параметры, расчет часов, demand, feasibility result, доступные действия и связанный audit context.

### AC7. Deal views

Раздел `Сделки` поддерживает:

- list view;
- kanban view.

Переключатель вида не должен терять данные. Kanban показывает сделки в колонках по `DealStage`. Изменение этапа выполняется реальным API action и пишет audit.

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

## Non-goals

- drag-and-drop kanban;
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
- AC5 -> DB/API tests: create deal with linked entities, reject missing linked entities, response includes labels.
- AC6 -> Web/component and E2E: row click opens `/opportunities/:id`, detail loads persisted data.
- AC7 -> Web/component and E2E: list/kanban switch, stage update persists and audit exists.
- AC8 -> Web/component/E2E: quick create only appears where real context actions exist.
- AC9 -> DB/API negative tests: direct API calls fail without permission and write denied audit.
- AC10 -> Browser smoke: desktop and narrow viewport have no broken navigation/table/detail layout.

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
