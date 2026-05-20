# 28. Phase 4.2: Task workspace, статусы задач и карточка задачи

## Статус

Этот slice расширяет Phase 4 starter после появления базовых `Task`, участников и `Моя работа`.

Цель не в отдельном таск-трекере, а в единой задаче KISS PM, которая позже будет использоваться в Gantt, Kanban, resource matrix, KPI/control signals и governed actions.

## Product intent

Пользователь должен работать с задачами как с операционной очередью:

```txt
Моя работа / Проект
  -> список или канбан
  -> фильтры по сроку, роли, статусу и проекту
  -> поиск по содержимому задачи
  -> создание или редактирование задачи
  -> карточка задачи
  -> комментарии / история / файлы / аудит
  -> governed status action
  -> audit trail
```

## Scope

- режимы `Список` и `Канбан` в `Моя работа`;
- CRUD задач через плотную модалку;
- bulk mode с реальными массовыми действиями и disabled-state reasons;
- tenant-scoped CRUD статусов задач в настройках;
- отдельная карточка задачи `/tasks/:taskId`;
- права на редактирование полей задачи;
- activity workspace задачи: комментарии, история, файлы, связи и аудит;
- контекстный поиск задач из верхней строки и локальный поиск в `Моя работа`;
- фильтры `Все`, `Сегодня`, `Завтра`, `2 недели`, `Просрочено`, роль участия, статус, проект.

## Non-scope

- полноценный Gantt/WBS timeline;
- редактирование predecessor links вне Gantt;
- расчет критического пути;
- resource leveling;
- binary storage provider;
- real-time websocket chat;
- recurring tasks.

## Task model

`Task` остается единой сущностью для списка, канбана, будущего Gantt и control surfaces.

Поля:

- `id`: системный идентификатор, в UI показывается как короткий код, но не редактируется в обычном режиме;
- `tenantId`;
- `projectId`;
- `stageId`: future project stage/WBS bucket;
- `title`;
- `description`;
- `statusId`;
- `statusCategory`: вычисляется из tenant status;
- `priority`;
- `requesterUserId`;
- `ownerUserId`;
- `plannedStart`;
- `plannedFinish`;
- `durationWorkingDays`;
- `plannedWork`;
- `actualWork`;
- `progress`;
- `requiresAcceptance`;
- `source`;
- `createdAt`;
- `updatedAt`;
- `participants`;
- `attachments`;
- `predecessors`.

`durationWorkingDays` в этом slice хранится явно и валидируется с датами. Позже scheduling engine сможет пересчитывать его по календарю.

## Task statuses

Статусы двухуровневые:

- системная категория: `new`, `waiting`, `in_progress`, `review`, `done`;
- tenant status: `id`, `name`, `category`, `sortOrder`, `status`.

Обязательные системные статусы:

- `Новая` -> `new`;
- `Выполнено` -> `done`.

Дефолтные промежуточные статусы:

- `Ожидает` -> `waiting`;
- `В работе` -> `in_progress`;
- `На контроле` -> `review`.

Tenant admin может создавать, редактировать, архивировать и менять порядок промежуточных статусов. Нельзя архивировать последний активный статус категории `new` или `done`.

## Status workflow

Базовый граф:

```txt
new -> waiting
new -> in_progress
waiting -> in_progress
in_progress -> waiting
in_progress -> review
in_progress -> done
review -> in_progress
review -> done
done -> terminal
```

Если `requiresAcceptance = true`, исполнитель не может перевести задачу напрямую в `done`; он отправляет ее в `review`. Постановщик или пользователь с правом управления задачами принимает результат и переводит в `done`, либо возвращает в `in_progress`.

## Participants and roles

Роли участия:

- `requester` — постановщик;
- `executor` — ответственный исполнитель;
- `co_executor` — соисполнитель;
- `controller` — контролер;
- `approver` — принимающий;
- `observer` — наблюдатель.

В задаче должен быть один `requester` и один `executor`. Соисполнителей и наблюдателей может быть несколько.

## Permissions

Минимальные права:

- `tenant.projects.read` — читать проекты и задачи;
- `tenant.tasks.create` — создавать задачи;
- `tenant.tasks.edit` — редактировать поля задач;
- `tenant.tasks.delete` — архивировать задачи;
- `tenant.task_statuses.manage` — управлять статусами задач;
- `tenant.projects.manage` — сохраняет broad project-management capability для совместимости Phase 4 starter.

Правила редактирования:

- все поля задачи в карточке по умолчанию read-only;
- постановщик задачи может редактировать свою задачу, если проект активен;
- пользователь с `tenant.tasks.edit` или `tenant.projects.manage` может редактировать задачу;
- исполнитель может менять только допустимые рабочие статусы;
- наблюдатель не редактирует задачу и не видит fake action buttons.

API остается security boundary. UI только объясняет недоступность.

## Task activity

Task activity не является CRM activity. Это отдельный контракт:

- `task_comment`;
- `task_system_event`;
- `task_file_link`;
- future `task_checklist_item`;
- future `task_relation`.

В этом slice комментарии и файловые ссылки хранятся как metadata. Полноценный `FileAsset`/`ExternalReference` storage layer остается в следующем cross-cutting slice.

## UX baseline

### Моя работа

- первый экран ведет в работу;
- справа сверху основной CTA `Создать задачу`;
- переключатель `Таблица / Канбан`;
- фильтры по сроку, роли, статусу, проекту;
- counters: просрочено, в работе, выполнено, всего часов;
- bulk panel показывает состояние и реальные действия;
- list rows плотные, но кликабельные;
- kanban columns соответствуют активным статусам задач.

### Карточка задачи

Карточка задачи использует двухколоночный рабочий шаблон:

- левая колонка: поля задачи, связи, вложения, custom fields;
- правая колонка: activity workspace;
- верхняя стадийная лента статусов;
- primary action зависит от текущего статуса и роли пользователя;
- disabled actions объясняют причину.

Предшественники отображаются read-only с пояснением: `Задаются в Gantt`.

## API baseline

- `GET /api/workspace/task-statuses`;
- `POST /api/workspace/task-statuses`;
- `PATCH /api/workspace/task-statuses/:statusId`;
- `DELETE /api/workspace/task-statuses/:statusId`;
- `GET /api/workspace/tasks`;
- `GET /api/workspace/tasks/:taskId`;
- `POST /api/workspace/projects/:projectId/tasks`;
- `PATCH /api/workspace/tasks/:taskId`;
- `DELETE /api/workspace/tasks/:taskId`;
- `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`;
- `GET /api/workspace/tasks/:taskId/activity`;
- `POST /api/workspace/tasks/:taskId/comments`;
- `POST /api/workspace/tasks/:taskId/files`.

## Acceptance criteria

- AC1: Tenant admin управляет статусами задач; `Новая` и `Выполнено` остаются обязательными.
- AC2: Пользователь создает задачу из `Моя работа` или проекта через модалку и может открыть созданную карточку.
- AC3: Поля задачи read-only для пользователя без роли постановщика и без edit/manage права.
- AC4: Постановщик или пользователь с edit/manage правом редактирует задачу; изменение пишет audit.
- AC5: Исполнитель видит задачу в `Моя работа`, меняет допустимый статус и не видит запрещенных действий.
- AC6: `requiresAcceptance` заставляет исполнителя отправлять задачу `На контроль`, а не закрывать напрямую.
- AC7: `Моя работа` фильтрует задачи по сроку, роли, статусу, проекту и ищет по названию, описанию, участникам и проекту.
- AC8: List/Kanban modes показывают одни и те же persisted задачи без fake DnD/controls.
- AC9: Bulk mode применяет только разрешенные массовые действия и объясняет disabled state.
- AC10: Task detail показывает activity workspace; комментарий сохраняется, виден после reload и пишет audit/system event.
- AC11: Restricted user получает `403` на edit/delete/status/activity mutations.

## Test plan

- parser unit tests: task input, status input, filters, activity input;
- access-control tests: task edit/status/status-admin decisions;
- repository DB tests: task statuses, extended task fields, activity, tenant isolation;
- API DB tests: CRUD, permissions, acceptance workflow, audit;
- web unit tests: filters/search/view-mode/bulk/task form;
- E2E smoke: create task, switch list/kanban, open detail, comment, status action, restricted edit denial.
