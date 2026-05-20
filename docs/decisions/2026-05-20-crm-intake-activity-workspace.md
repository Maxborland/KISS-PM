# 2026-05-20. CRM intake как рабочее окно сделки

## Статус

Accepted.

## Контекст

Phase 3.1 закрыла базовый CRM/intake слой: клиенты, контакты, типы проектов, этапы сделок, список/kanban, карточка сделки, custom fields, governed close/reject и activation проекта.

После пользовательской проверки выявлен продуктовый разрыв: текущая карточка сделки работает как паспорт входящего проекта, но не как CRM workspace. В ней нет persisted чата/комментариев, deal follow-up задач и entity-scoped ленты событий. Kanban использует нативный HTML5 drag/drop и ощущается нестабильно. Документ Phase 3.1 отдельно зафиксировал, что аудит не является частью карточки сделки; для CRM-оператора это решение оказалось неверным.

Референсные паттерны amoCRM/Kommo и Bitrix24 трактуем не как UI для копирования, а как capabilities:

- pipeline/kanban нужен для движения сделок по этапам;
- карточка сделки должна быть рабочим окном, где рядом с полями сделки видны коммуникации, задачи, история и управленческие действия;
- административный аудит может оставаться отдельным разделом, но оператору нужна отфильтрованная лента событий конкретной сделки.

## Решение

CRM intake строится как две связанные поверхности:

1. `/opportunities` - pipeline/list surface.
   - Список и kanban используют одну persisted модель `Opportunity`.
   - Kanban обязан поддерживать рабочее перемещение сделки между `DealStage`.
   - Drag-and-drop не является единственным способом сменить этап: остается явное действие смены этапа для клавиатуры и accessibility baseline.

2. `/opportunities/:id` - deal workspace.
   - Левая зона: факты сделки, клиент, контакт, тип проекта, этап, экономика, demand, resource feasibility, custom fields, governed actions.
   - Правая зона: activity panel с разделами `Лента`, `Чат`, `Задачи`, `Аудит`.
   - `Лента` объединяет комментарии, deal tasks и audit/system events в хронологическом порядке.
   - `Чат` в первом срезе означает internal persisted comments по сделке. Внешние мессенджеры и CRM-коннекторы остаются future connector scope.
   - `Задачи` в сделке - это CRM follow-up tasks до активации проекта. Они не заменяют project `Task` из Phase 4 и не смешиваются с проектным WBS/task contour.
   - `Аудит` показывает отфильтрованные audit events по текущей сделке. Глобальный `/audit` остается administrative evidence layer.

## Архитектурные границы

### Domain / persistence

Добавляется tenant-scoped CRM activity model:

- `OpportunityActivity`
  - `tenantId`;
  - `opportunityId`;
  - `id`;
  - `type`: `comment` | `task`;
  - `title`;
  - `body`;
  - `status` для задач: `todo` | `done`;
  - `dueDate`;
  - `assigneeUserId`;
  - `authorUserId`;
  - `createdAt`;
  - `updatedAt`.

Audit events не дублируются в activity table. Activity feed собирается application/API слоем из:

- persisted `OpportunityActivity`;
- redacted system-event projection по filtered `AuditEvent` с `sourceEntity.type = "Opportunity"` и `sourceEntity.id = opportunityId`.

Raw audit record не становится доступным через activity endpoint автоматически. Операторская лента получает безопасную проекцию: тип события, короткий заголовок, actor, время, source entity и минимальный before/after summary без `commandInput`, `permissionResult`, `executionResult` и диагностических деталей. Полная вкладка `Аудит` с raw audit details доступна только пользователю с `tenant.audit_events.read`; без этого права пользователь видит системные события в `Ленте`, но не raw audit tab.

### API / application service

Новые endpoints:

- `GET /api/workspace/opportunities/:opportunityId/activity`
- `POST /api/workspace/opportunities/:opportunityId/comments`
- `POST /api/workspace/opportunities/:opportunityId/tasks`
- `PATCH /api/workspace/opportunities/:opportunityId/tasks/:activityId`

Права:

- чтение activity требует `tenant.opportunities.read`;
- создание комментариев и задач требует `tenant.opportunities.manage` в первом срезе;
- закрытие задачи требует `tenant.opportunities.manage`;
- чтение raw audit tab требует `tenant.audit_events.read`;
- redacted system events в `Ленте` доступны по `tenant.opportunities.read`, потому что не раскрывают диагностический audit payload;
- backend остается security boundary, UI hiding не считается защитой.

Audit:

- создание комментария пишет `opportunity.comment.created`;
- создание задачи пишет `opportunity.task.created`;
- закрытие задачи пишет `opportunity.task.completed`;
- denied mutation attempts пишут denied audit по существующему паттерну, если route проходит через authenticated actor.

### UI / query layer

Новые focused modules вместо раздувания `OpportunityDetailView.tsx`:

- `apps/web/src/opportunityActivity.ts` - display helpers и sorting для feed;
- `apps/web/src/OpportunityActivityPanel.tsx` - right-side panel;
- `apps/web/src/OpportunityCommentForm.tsx` - compact comment/chat form;
- `apps/web/src/OpportunityTaskForm.tsx` - compact deal follow-up task form;
- `apps/web/src/DealsKanban.tsx` или выделенный kanban module - чтобы убрать DnD из `OpportunitiesView.tsx`;
- `apps/web/src/workspaceQueries.ts` - query/mutation hooks для opportunity activity.

UI не показывает fake actions. Если chat/task/audit section виден, он работает с persisted API или показывает честное empty/error/loading состояние.

## Принятые ограничения

- Не строим внешний чат с Telegram/email/Bitrix/AmoCRM connector runtime в этом срезе.
- Не переносим project tasks в сделку и не смешиваем deal follow-up tasks с WBS/task model активного проекта.
- Не делаем массовые действия, экспорт, сложные activity filters и SLA automation.
- Не копируем визуальный дизайн amoCRM/Bitrix24; извлекаем workflow, плотность, right activity pattern и context actions.

## Проверка

Feature считается принятым только если:

- kanban stage movement работает в browser smoke и сохраняется через API;
- сделка открывается в `/opportunities/:id`;
- в карточке сделки можно создать комментарий и увидеть его после refetch;
- в карточке сделки можно создать и закрыть follow-up задачу;
- activity feed показывает комментарии, задачи и audit события сделки;
- restricted user не видит/не может выполнить manage mutations, прямой API получает `403`;
- audit events пишутся для state-changing действий;
- UI не содержит видимых fake buttons/checkboxes/menus.
