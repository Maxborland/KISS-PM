# 24. Phase 4: Project lifecycle, задачи и My Work

## Статус

Phase 4 начинает проектный контур после CRM/intake:

```txt
active project -> task -> participant role -> project view -> My Work -> audit
```

В starter-срезе не строим Gantt/WBS/dependencies/baseline. Но `Task` сразу моделируется как единая задача, которая позже будет отображаться в Gantt, Kanban, My Work, control surfaces и corrective actions.

## Цель starter-среза

- authorized user открывает активный проект;
- создает задачу внутри активного проекта;
- назначает участника с ролью `executor`;
- задача видна в деталях проекта;
- тот же участник видит задачу в `Моя работа`;
- руководитель проекта или назначенный исполнитель переводит задачу по статусам `todo -> in_progress -> done`;
- state-changing действие проверяется правами и попадает в audit;
- restricted user не видит project/task surfaces и получает API `403`.

## Non-scope starter-среза

- WBS hierarchy;
- dependencies;
- baseline;
- Gantt timeline;
- full Kanban board;
- project stage CRUD;
- time tracking;
- resource leveling;
- project closure.

## Task baseline

Минимальная сущность:

- `id`;
- `tenantId`;
- `projectId`;
- `stageId`: `null` в starter-срезе;
- `title`;
- `description`;
- `status`: `todo`, `in_progress`, `blocked`, `done`;
- `priority`: `low`, `normal`, `high`, `critical`;
- `plannedStart`;
- `plannedFinish`;
- `plannedWork`;
- `actualWork`;
- `progress`;
- `source`: `manual`;
- `createdAt`;
- `updatedAt`;
- `participants`.

## TaskParticipant baseline

Минимальная связь:

- `tenantId`;
- `taskId`;
- `userId`;
- `role`: `executor`, `co_executor`, `requester`, `controller`, `approver`, `observer`.

В starter-срезе создание задачи требует минимум одного `executor`.

## Права

Starter-срез использует уже существующие права:

- `tenant.projects.read` — чтение проектов, задач проекта и `Моя работа`;
- `tenant.projects.manage` — создание задачи в активном проекте.

Status transition дополнительно разрешен назначенному участнику задачи с ролью:

- `executor`;
- `co_executor`;
- `controller`.

Роли `requester`, `approver`, `observer` видят задачу в `Моя работа`, но не получают action-кнопку смены статуса.

API остается security boundary. UI может скрывать недоступные разделы, но не является единственной защитой.

## Status transition graph

Разрешенные переходы starter-среза:

```txt
todo -> in_progress
todo -> blocked
in_progress -> blocked
in_progress -> done
blocked -> in_progress
blocked -> done
done -> terminal
```

Сервер обязан валидировать граф переходов и не принимать произвольный enum status. Repository update проверяет ожидаемый текущий статус и active-project precondition, чтобы audit `beforeState` не расходился с фактически измененной строкой.

## API baseline

- `GET /api/workspace/projects/:projectId` — активный проект с задачами;
- `GET /api/workspace/projects/:projectId/tasks` — задачи активного проекта;
- `POST /api/workspace/projects/:projectId/tasks` — создание задачи;
- `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status` — governed transition статуса задачи;
- `GET /api/workspace/my-work` — задачи, где текущий пользователь является участником.

Все authenticated `/api/*` ответы остаются `Cache-Control: no-store, private`.

## UX/UI baseline

- Раздел `Проекты` должен вести в детали проекта по клику по строке или явной кнопке.
- Детали проекта показывают краткий контекст проекта, demand из intake и таблицу задач.
- Создание задачи выполняется через модалку с inline validation.
- `Моя работа` показывает компактную рабочую таблицу задач пользователя без fake bulk actions.
- Empty/loading/error states показываются на уровне секции.
- Пользовательский текст — русский.

## Acceptance criteria

- AC1: `Task` и `TaskParticipant` tenant-scoped, связаны с активным `Project` и `tenant_users`.
- AC2: Нельзя создать задачу в draft/paused/closed/cancelled проекте.
- AC3: Нельзя создать задачу без executor, с некорректными датами, work/progress или неизвестным участником.
- AC4: Authorized user создает задачу, получает `task.created` audit event, а задача видна в project detail.
- AC5: Assigned executor видит задачу в `Моя работа`.
- AC6: User без `tenant.projects.read` не читает project/task/my-work endpoints.
- AC7: User без `tenant.projects.manage` не создает задачу.
- AC8: Web shell имеет permission-aware route `Моя работа` и project detail route без fake controls.
- AC9: Project manager может менять статус любой задачи активного проекта, назначенный `executor`/`co_executor`/`controller` может менять статус своей задачи из `Моя работа`, non-participant reader получает `403`, а переход пишет audit `task.status_changed`.

## Test plan

- AC1 -> migration/schema tests и DB repository test.
- AC2, AC3 -> parser/service/API tests.
- AC4 -> API DB test: create task + audit + project detail.
- AC5 -> API DB test: my-work returns only participant tasks.
- AC6, AC7 -> API DB negative RBAC tests.
- AC8 -> web route/query/component tests и smoke update.
- AC9 -> parser/API DB tests, persistence repository test, web API helper test, smoke transition from `Моя работа`.

## Architecture notes

- Domain identifiers остаются английскими, UI labels — русскими.
- Новые API routes выносятся в отдельный `projectWorkRoutes`, а parsing/service logic — в focused modules.
- Persistence получает отдельный `projectWorkRepository`, чтобы не раздувать `projectIntakeRepository`.
- Web получает отдельные `ProjectDetailView` и `MyWorkView`, а TanStack Query получает отдельные query keys для project detail/tasks/my-work.
