# ADR: Линейная история плана вместо ветвления

Дата: 2026-07-18.

## Статус

Принято.

## Контекст

План проекта меняется из нескольких источников: ручные правки в UI, батчи
planning-команд, применение сценариев разрешения перегрузок (в том числе предложенных
агентом), откаты. Нужна была модель истории: линейная цепочка версий с optimistic
concurrency или ветвящаяся (черновики/ветки плана, merge). Принципы честности требуют
preview→apply и fail-closed preconditions с явными версиями.

## Решение

История плана линейная (`apps/api/src/planning/*`):

- Единственный счётчик `planVersion` на проект. Каждое успешное изменение плана проходит
  в транзакции под tenant-lock (`lockTenantResourcePlanning`) и завершается
  `incrementPlanVersion`; «коммит» — это audit-событие planning с `afterState.planVersion`
  и `compensatingCommands`, видимое на вкладке «Коммиты».
- Optimistic concurrency, версии явные: каждый мутирующий вызов (apply-command-batch,
  scenario apply, revert) требует `clientPlanVersion` от клиента; несовпадение с текущей
  версией — 409 `plan_version_conflict` с `currentPlanVersion` в ответе и audit-событием
  `planning.command_conflict`. Серверная подстановка версии запрещена (см. ADR
  «user-delegated agent»).
- Preview→apply: сценарии сначала стейджатся как persisted scenario runs
  (`scenarios/preview` — план не мутирует, версия не растёт), у run'а есть TTL
  (`expiresAt`), привязка к `planVersion` и статусы. Применить можно только живой run:
  уже применённый, отклонённый (reject-flow: `rejectedAt`/`rejectedReason`,
  `planningScenarioRejectRoute.ts`) или истёкший — 409. Гонка apply↔reject одного run
  сериализуется тем же tenant-lock.
- Revert — новый коммит, а не переписывание истории (`planningRevertRoute.ts`,
  `POST .../planning/revert-last`): применяются `compensatingCommands` из audit-события
  целевого коммита, версия плана растёт (`incrementPlanVersion`), пишется новое событие
  `planning.commit.reverted`. Ограничения: откатить можно только коммит, чья
  `afterState.planVersion` равна текущей (409 `planning_commit_not_current`), повторный
  откат того же коммита — 409 `planning_commit_already_reverted`; права проверяются
  per-компенсирующая-команда, compensating-превью не должно давать blocking validation
  issues; запрос идемпотентен по `idempotencyKey` + `requestHash`.
- Изменение версии — наблюдаемое событие: `notifyPlanVersionChanged` уведомляет
  подписчиков (SSE), capacity-кэш тенанта инвалидируется.

## Рассмотренные альтернативы

- **Ветвление плана (черновые ветки, merge).** Даёт параллельные «что-если», но требует
  merge-семантики для ресурсных ограничений, двусмысленности «какая версия действующая»
  и заметно усложняет audit/RBAC. Роль «что-если» уже закрывают staged scenario runs:
  это временные (TTL) превью с объяснимостью, а не постоянные ветки.
- **Full event sourcing (план как проекция потока команд).** Строже теоретически, но
  вся необходимая наблюдаемость уже достигается связкой snapshot + audit-события с
  `compensatingCommands`; отдельный event store — инфраструктурная цена без новой
  пользовательской ценности на текущей фазе.
- **Undo-стек на клиенте.** Не переживает reload и других участников, не оставляет следа
  в audit; противоречит правилу «квитанции ссылаются только на реальные записи».

## Последствия

- У плана в каждый момент ровно одно действующее состояние и одна версия — read-model,
  capacity и коммиты не могут разъехаться между «ветками».
- Конкурентные правки разрешаются явным конфликтом (409 + `currentPlanVersion`), а не
  молчаливым last-write-wins; клиент обязан перечитать план и перепоказать превью.
- Откатывается только вершина цепочки (revert-last): откат «из середины» истории
  потребовал бы merge-семантики и в линейной модели намеренно невозможен. Глубокий откат —
  последовательность revert'ов, каждый из которых — новый коммит.
- Событие revert пишется с `compensatingCommands: []` — откат отката делается прямой
  правкой, а не рекурсивным revert.
- Staged scenario runs — единственная форма «параллельных вариантов», и они намеренно
  смертны (TTL) и привязаны к версии плана, против применения устаревших решений.
- Если появится потребность в долгоживущих сравнимых вариантах плана (портфельные
  «что-если»), это отдельный ADR — линейную историю действующего плана он не отменяет.

## Acceptance evidence

- Тесты revert-роута фиксируют: рост `planVersion`, событие `planning.commit.reverted`,
  409 для не-текущего/уже откаченного коммита, идемпотентный replay.
- Apply со стейл `clientPlanVersion` возвращает 409 `plan_version_conflict` +
  `currentPlanVersion`; конфликт виден в audit (`planning.command_conflict`).
- Reject-flow: план не мутирует, версия не растёт, apply отклонённого run — 409
  `scenario_rejected`; факт отклонения — аудит `planning.scenario.rejected`.
