# 22. Phase 3: CRM intake, ресурсная проверка и активный проект

## Статус

Phase 3 строит первый продуктовый контур после admin foundation:

```txt
manual opportunity -> intake readiness -> demand by position -> feasibility by available hours -> active project -> audit
```

В этой фазе мы работаем в single-workspace модели. SaaS/operator admin остается вне scope.

## Цель

Сделать проверяемый путь:

- пользователь вручную создает opportunity внутри KISS PM;
- в карточке opportunity задает стоимость контракта и плановую норму часа;
- система считает общий часовой бюджет входящего проекта как `contractValue / plannedHourlyRate`;
- пользователь задает demand строками `должность + часы`;
- система проверяет доступные часы должностей между датой старта и плановым финишем;
- пользователь видит blockers и feasibility result;
- authorized user активирует проект;
- проект появляется в рабочей зоне активных проектов;
- все state-changing действия проходят permission check и audit;
- restricted user не видит разделы и получает API `403`.

## Выбранный подход

- Opportunity создается вручную в KISS PM.
- Внешние CRM/intake-коннекторы не входят в runtime Phase 3.
- TODO для будущих intake-коннекторов фиксируется как backlog, а не как кодовая зависимость.
- `Project` является единой сущностью с `status`. Не вводим отдельный runtime `ProjectDraft`, если отличие только в статусе и видимости.
- В Phase 3 проект активируется сразу из opportunity после успешной проверки или принятого риска.
- Activation является single-use: одна opportunity может породить не более одного проекта.
- Перед activation система повторно пересчитывает текущую ресурсную доступность, чтобы не доверять устаревшему feasibility result.
- Финальный пересчет capacity выполняется внутри транзакции под tenant resource lock, чтобы параллельные activation не обходили ресурсный конфликт.
- Gantt/WBS/tasks пока не реализуются. Активный проект показывает только lifecycle shell и исходные intake/demand данные.
- Ресурсная проверка строится по BR2-capability: доступные часы должностей в периоде, без полной дневной ресурсной матрицы.

## Opportunity baseline

Минимальная сущность:

- `id`;
- `tenantId`;
- `clientName`;
- `contactName`;
- `title`;
- `projectType`;
- `description`;
- `plannedStart`;
- `plannedFinish`;
- `contractValue`;
- `plannedHourlyRate`;
- `plannedHours`;
- `probability`;
- `status`: `new`, `intake`, `feasibility`, `ready_to_activate`, `rejected`, `converted`;
- `templateId`;
- `createdAt`;
- `updatedAt`.

`plannedHours` вычисляется как:

```txt
plannedHours = floor(contractValue / plannedHourlyRate)
```

Если стоимость или норма часа некорректны, opportunity не готова к feasibility.

## Demand baseline

Demand вводится вручную строками:

- `positionId`;
- `requiredHours`.

Правила:

- в одной opportunity одна должность не должна повторяться;
- `requiredHours` должен быть положительным целым числом;
- сумма demand должна быть больше нуля;
- если сумма demand превышает `plannedHours`, readiness получает blocker;
- если сумма demand меньше `plannedHours`, readiness получает warning о нераспределенных часах.
- runtime API ограничивает размер входных строк, количество demand-строк, целочисленные значения и planning horizon, чтобы Phase 3 не превращалась в источник DB overflow или тяжелых расчетов.

## Feasibility baseline

Проверка доступности должностей считает:

```txt
availableHours(position, start, finish)
  = activeUsersWithPosition * workingDays(start, finish) * hoursPerDay
    - reservedHours(position, start, finish)
```

Где:

- `hoursPerDay = 8` в Phase 3;
- `workingDays` считает понедельник-пятницу включительно;
- `activeUsersWithPosition` берется из текущих пользователей рабочего пространства;
- `reservedHours` берется из уже активных проектов по demand с пересечением периода.

Результат по каждой должности:

- `requiredHours`;
- `availableHours`;
- `reservedHours`;
- `shortageHours`;
- `status`: `ok`, `conflict`.

Итоговый status:

- `ok`, если все строки покрыты;
- `warning`, если есть нераспределенные часы или недостаточно данных без дефицита;
- `conflict`, если хотя бы по одной должности есть дефицит;
- `blocked`, если базовые данные opportunity невалидны.

## Project baseline

`Project` создается при активации opportunity.

Минимальная сущность:

- `id`;
- `tenantId`;
- `sourceOpportunityId`;
- `title`;
- `clientName`;
- `status`: `active`, в будущих фазах также `draft`, `paused`, `closed`, `cancelled`;
- `plannedStart`;
- `plannedFinish`;
- `contractValue`;
- `plannedHours`;
- `templateId`;
- `createdAt`;
- `activatedAt`.

Проект виден в разделе `Проекты`, если статус `active`.

## Governed activation

Команда:

```txt
ActivateProjectFromOpportunity
```

Preconditions:

- actor имеет право `tenant.project_activation.manage`;
- actor имеет право `tenant.projects.manage`;
- opportunity принадлежит tenant actor;
- opportunity не `rejected` и не `converted`;
- даты валидны;
- `contractValue` и `plannedHourlyRate` валидны;
- demand заполнен;
- feasibility check выполнен;
- текущая capacity пересчитана непосредственно перед activation;
- финальный capacity recheck выполнен под tenant resource lock;
- critical blockers отсутствуют или явно принят риск с причиной.

В Phase 3 допускается активация при `conflict`, только если передан `acceptedRiskReason`.

Audit action types:

- `opportunity.created`;
- `opportunity.feasibility_checked`;
- `project.activated`.

Редактирование opportunity не входит в Phase 3.

Denied privileged Phase 3 mutation attempts also write audit with `executionResult.status = denied`:

- `opportunity.create_denied`;
- `opportunity.feasibility_denied`;
- `project.activation_denied`.

## Права

Минимальные права Phase 3:

- `tenant.opportunities.read`;
- `tenant.opportunities.manage`;
- `tenant.projects.read`;
- `tenant.projects.manage`;
- `tenant.project_activation.manage`;
- `tenant.resource_feasibility.read`.

UI скрывает недоступные разделы, но API остается security boundary.

Authenticated `/api/*` responses должны отдавать `Cache-Control: no-store, private`, потому что opportunity, project, permissions и audit являются tenant-sensitive данными.

## UX/UI требования

- Новый раздел `Возможности` показывает плотную таблицу opportunity, readiness/status, плановые даты, контракт, часы и действия.
- Карточка opportunity показывает секции: `Данные сделки`, `Потребность`, `Проверка ресурсов`, `Решение`.
- Новый раздел `Проекты` показывает активные проекты без fake Gantt/KPI controls.
- Feasibility table показывает должность, требуемые часы, доступные часы, резерв, дефицит и статус.
- Ошибки validation показываются рядом с формой.
- Loading/error/empty states должны быть на уровне разделов.
- Пользовательский текст — русский.

## Acceptance criteria

- `pnpm typecheck` проходит.
- `pnpm --filter @kiss-pm/web typecheck` проходит.
- `pnpm --filter @kiss-pm/web build` проходит.
- `pnpm test` проходит.
- `pnpm test:db` проходит против Docker PostgreSQL.
- `pnpm test:e2e:smoke` проходит и доказывает:
  - admin видит `Возможности` и `Проекты`;
  - admin создает opportunity вручную;
  - admin задает стоимость контракта, плановую норму часа и demand `должность + часы`;
  - система показывает рассчитанные плановые часы;
  - admin запускает feasibility и видит доступные/требуемые часы;
  - проект появляется в `Проекты`;
  - audit показывает `opportunity.created`, `opportunity.feasibility_checked`, `project.activated`;
  - restricted user не видит `Возможности`/`Проекты`;
  - restricted user получает API `403` на read и mutation endpoints Phase 3.

DB/API phase tests дополнительно доказывают conflict/stale-capacity сценарии: при изменившейся емкости activation требует `acceptedRiskReason`, а параллельные activation по одному tenant/resource window сериализуются.

## Non-scope

- Внешние CRM-коннекторы.
- Автоматический импорт opportunity.
- Полная ресурсная матрица по дням.
- Gantt/WBS/tasks.
- Project closure.
- KPI/control signals.
- Billing/licensing.

## Backlog TODO для intake-коннекторов

- `TODO intake connector: CRM adapter input contract`;
- `TODO intake connector: form/webhook intake adapter`;
- `TODO intake connector: email/import adapter`;
- `TODO intake connector: external mapping versioning`.

Эти TODO являются будущим integration scope. В Phase 3 core domain не зависит от внешних CRM.
