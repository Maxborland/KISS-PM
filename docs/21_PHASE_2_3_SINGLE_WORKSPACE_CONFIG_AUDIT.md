# 21. Phase 2.3: Single workspace config, audit viewer и RBAC hardening

## Статус

Phase 2.3 закрыта в текущей single-workspace реализации. Мы по-прежнему работаем как один tenant и не строим отдельную SaaS/operator admin surface. Фаза закрепила рабочий admin foundation: видимый аудит, проверяемые отказы по RBAC и первый tenant-config baseline для custom fields и шаблонов.

## Цель

Сделать проверяемый контур:

- отдельный раздел `Аудит` для последних административных действий;
- browser/API negative RBAC сценарии: пользователь без прав не видит разделы и получает отказ от API;
- базовая настройка custom fields без кода;
- базовая настройка project templates без кода;
- все state-changing настройки проходят через permission check и audit;
- UI остается плотным русским рабочим интерфейсом, без fake controls и без обещаний несуществующих Gantt/KPI/project features.

## Выбранный подход

- Single workspace остается текущей пользовательской моделью.
- Runtime остается Node + pnpm + Docker Compose PostgreSQL.
- Web runtime остается Next.js App Router, authenticated workspace shell остается client-side UI поверх cookie session.
- TanStack Query остается server-state слоем.
- Custom fields/templates в этой фазе являются `workspace config`, а не полноценным builder engine.
- Custom fields/templates должны соблюдать canonical правило `systemKey` + `tenantLabel`.
- Настройки сохраняются в PostgreSQL, а не в моках или статических массивах.
- Изменения настроек пишут `AuditEvent`.
- UI скрывает недоступные разделы, но API остается security boundary.

## Модель прав

Добавить минимальные права:

- `tenant.workspace_config.read` — читать custom fields/templates baseline;
- `tenant.workspace_config.manage` — создавать и изменять custom fields/templates baseline.

Обычный ограниченный пользователь не должен видеть раздел `Настройки`, не должен получать данные config endpoints и не должен иметь возможность изменить config через прямой API вызов.

## Custom field baseline

Минимальная сущность:

- `id`;
- `tenantId`;
- `systemKey`;
- `tenantLabel`;
- `targetEntity`: `opportunity` или `project`;
- `fieldType`: `text`, `number`, `date`, `select`;
- `required`;
- `status`: `draft` или `active`;
- `createdAt`;
- `updatedAt`.

Минимальные действия:

- список custom fields;
- создать custom field;
- изменить `tenantLabel`/type/required/status;
- validation `systemKey`;
- audit на create;
- audit на update.

Не делаем в Phase 2.3:

- удаление custom fields;
- version history;
- field usage в project/deal forms;
- formula fields;
- complex validation rules.

## Project template baseline

Минимальная сущность:

- `id`;
- `tenantId`;
- `systemKey`;
- `tenantLabel`;
- `description`;
- `status`: `draft` или `active`;
- `createdAt`;
- `updatedAt`.

Минимальные действия:

- список project templates;
- создать template;
- изменить `tenantLabel`/description/status;
- validation `systemKey`;
- audit на create;
- audit на update.

Не делаем в Phase 2.3:

- полноценный process template builder;
- stages/gates/tasks внутри template;
- publish/version history;
- применение template к project draft.

## Audit viewer baseline

Раздел `Аудит` должен показывать:

- время события;
- actor;
- action type в человекочитаемой форме;
- source entity;
- correlation id;
- before/after summary для administrative/config actions;
- empty/loading/error states.

Audit viewer не должен быть главным доменным объектом продукта. Это trace surface для управленческих и административных действий.

## UX/UI требования

- Разделы `Аудит` и `Настройки` видны только по permission set.
- Первый экран после входа остается рабочим dashboard, но audit preview ведет в полный audit viewer.
- Config UI должен быть плотным: таблицы, inline status chips, модалки создания/редактирования, понятные ошибки validation.
- Не использовать fake Gantt/KPI/project controls.
- Не показывать пользователю внутренние технические поля без пользы. `systemKey` допустим в admin settings как системный ключ.

## Acceptance criteria

- `pnpm typecheck` проходит.
- `pnpm --filter @kiss-pm/web typecheck` проходит.
- `pnpm --filter @kiss-pm/web build` проходит.
- `pnpm test` проходит.
- `pnpm test:db` проходит против Docker PostgreSQL.
- `pnpm test:e2e:smoke` проходит и доказывает:
  - admin видит `Аудит` и `Настройки`;
  - admin создает custom field через UI;
  - admin изменяет custom field через UI;
  - admin получает inline validation при невалидном `systemKey` custom field;
  - admin создает project template через UI;
  - admin изменяет project template через UI;
  - admin получает inline validation при невалидном `systemKey` project template;
  - audit viewer показывает отдельные события create/update для custom fields и project templates;
  - restricted user не видит `Аудит`/`Настройки`;
  - restricted user получает API `403` на `GET` audit/config read endpoints;
  - restricted user получает API `403` на `POST/PATCH` config mutation endpoints.

## Реализованный backlog

- DB-backed tenant-scoped custom fields и project templates добавлены в PostgreSQL schema, migrations и persistence repository.
- Workspace config API добавлен с session auth, permission checks, validation, same-origin mutation header и audit write внутри transaction.
- Permission model расширена правами `tenant.workspace_config.read` и `tenant.workspace_config.manage`.
- Web shell получил permission-aware routes `/settings` и `/audit`.
- `Настройки` показывает плотные таблицы, summary counters, search, create/edit modals и inline validation для `systemKey`.
- `Аудит` показывает action label, actor, workflow, source entity, before/after summary, correlation id и время события.
- Restricted user shell скрывает `Аудит` и `Настройки`, а прямые API вызовы получают `403`.
- Browser smoke доказывает create/update custom field, create/update project template, validation, audit evidence и negative RBAC read/mutation endpoints.
- CRUD ролей доступа дополнительно закреплен transaction boundary: изменение роли и audit write проходят атомарно.
- ID ролей доступа закреплены как tenant-scoped на уровне PostgreSQL primary key: одинаковый локальный id роли допустим в разных tenant и не создает cross-tenant collision.

## Последняя проверка закрытия

Свежая проверка от 2026-05-19 зафиксирована в `docs/status/phase2-3-single-workspace-config-audit-ledger.md`.

## Следующий шаг после Phase 2.3

После Phase 2.3 можно выбирать:

- Phase 2.4: вернуть multi-tenant separation и operator admin;
- или Phase 3: начать CRM intake -> project draft на single-workspace foundation.

Решение зависит от того, нужен ли сначала SaaS/self-hosted tenant boundary в UI, или важнее быстрее получить первый project lifecycle contour.
