# Кластеры M + H — сложнейшие доменные баги планировщика: разбор и план

> **СТАТУС 2026-07-05: все эпики реализованы.** BUG-PROJ-23/03/18 (первый заход) + BUG-PROJ-22
> (baseline морозит calculated-даты), BUG-PROJ-19 (таблица `plan_accepted_overloads` + миграция 0048
> + 7 слоёв), BUG-PROJ-25 (фильтр кандидатов по позиции), preview-scoping (issue-diff),
> BUG-PROJ-24 (серверный revert-last: домен `buildCompensatingCommands` + хранение в аудите +
> эндпоинт + клиент). Все — с регресс-тестами; итог/детали в `phase5-outcome.md`. Ниже —
> исходный разбор (оставлен как справочник по первопричинам).


Это самые дорогие в починке дефекты прогона: они лежат в ядре домена/персистенции планирования (PM-as-code: команда → preview → apply → версия/аудит). Ниже — корневой разбор каждого и точный план правки. Два уже исправлены в этом заходе (отмечено ✅ с регрессом и live-проверкой), остальные требуют многослойных изменений (домен + persistence + миграция + read-model) и вынесены с готовым дизайном.

Общий контур для справки:
- Домен: `packages/domain/src/planning/{schedulingEngine,commandReducer,planningCommands,types}.ts`
- API: `apps/api/src/planning/{applyPlanningCommandHandler,registerPlanningRoutes,planningRouteHelpers,planningReadModel}.ts`
- Persistence: `packages/persistence/src/planningRepository.ts` (switch `applyPlanningCommand`)

---

## ✅ BUG-PROJ-23 (CRITICAL) — исправлено + live
**Симптом:** одна seed-веха (`task-vektor-milestone-launch`, work=0, dur=0) с ошибкой `invalid_work_model` блокировала ЛЮБУЮ команду планирования на `project-vektor-portal` и `project-gorset-migration`.
**Корень:** `schedulingEngine.ts` флагил `durationMinutes <= 0` как невалидную модель, включая легитимную нулевую веху; а `previewPlanningCommand`/`previewPlanningCommands` блокируют команду при ЛЮБОЙ error-issue во всём плане.
**Фикс (сделан):** нулевая веха (`work===0 && duration===0`) больше не `invalid_work_model`; невалидно только отрицательное или `duration===0` при `work>0`. Регресс: `schedulingEngine.test.ts` (2 теста). Live: apply на vektor-portal → 200 (был 409).
**Осталось (робастность, отдельно):** заскоупить preview-валидацию на затронутые командой сущности, чтобы предошибки в НЕ связанной части плана не блокировали правку (см. «Preview scoping» ниже).

## ✅ BUG-PROJ-03 (CRITICAL) — исправлено + live
**Симптом:** `task.update_progress` возвращал 200 + рост версии + аудит, но percentComplete не сохранялся.
**Корень:** в `planningRepository.applyPlanningCommand` switch ОТСУТСТВОВАЛ `case "task.update_progress"` → команда падала в default (no-op). Домен-редьюсер менял только in-memory снапшот, которого нет на пути персистенции.
**Фикс (сделан):** добавлен `case "task.update_progress"` → `UPDATE tasks SET progress=clamp(0..100)`. Регресс: `planningRoutes.db.test.ts` (create→update→read=42). Live: update=37 → read-model percentComplete=37.

---

## 🔴 BUG-PROJ-19 (MAJOR) — accept_overload no-op: негде хранить принятие
**Симптом:** «Снять перегруз» (`risk.accept_overload`) даёт коммит+аудит, но перегруз остаётся; `acceptedOverloads` не заполняется.
**Корень (глубокий):**
- `planningRepository.ts:1117` — `case "risk.accept_overload": return;` (пустой).
- Домен-редьюсер (`commandReducer.ts:132`) кладёт `acceptedRiskIds` только в **planDelta** (транзиентный ответ), НЕ в снапшот: `withSnapshot(snapshot, command, {}/*snapshot patch пуст*/, { acceptedRiskIds:[...] })`.
- В `PlanSnapshot` нет поля принятых перегрузов, в read-model — нет источника флага «accepted». Принятие негде сохранить → всегда теряется.
**План (multi-layer):**
1. **Persistence:** новая таблица `plan_accepted_overloads` (PK `tenantId, projectId, resourceId, bucketDate`; поля `reason`, `acceptedByUserId`, `acceptedAt`). Миграция + drizzle-схема.
2. **Repo apply:** `case "risk.accept_overload"` → `INSERT ... ON CONFLICT DO UPDATE` (overloadId разбирается в resourceId+date, как в autoSolver). Плюс обратная команда снятия принятия, если нужна.
3. **getPlanSnapshot:** грузить принятия в `snapshot.acceptedOverloads: Array<{resourceId,date,reason}>` (расширить `PlanSnapshot`).
4. **Домен:** редьюсер кладёт принятие в snapshot-патч (а не только delta); `resourcePlanning`/read-model помечает bucket `accepted: true` и НЕ считает его нарушением (или считает «принятым риском»).
5. **Read-model:** `resourceLoad.overloads[].accepted` из снапшота; UI подпись «Снять перегруз» → «Принять перегруз» (семантика обратна действию — отдельный мелкий UX-фикс).
6. **Регресс:** db-тест apply accept_overload → read-model overload.accepted=true после перезагрузки снапшота.
**Оценка:** ~5 слоёв, 1 миграция. Средне-высокий риск (трогает расчёт нагрузки). Делать отдельным PR с изоляцией.

## 🔴 BUG-PROJ-18 (MAJOR) — фантомное снятие исполнителя-плейсхолдера
**Симптом:** «Снять исполнителя» на executor/co_executor-плейсхолдере (`workMin=null`) → 200 + audit + рост версии, но назначение остаётся; реальные назначения удаляются корректно.
**Корень:** плейсхолдер-строки исполнителей в read-model синтезируются из **спроса позиции** (demand), а не являются строками `task_assignments`. `assignment.delete` ищет строку по `id` (`planningRepository.ts:987`): для синтетического id `existing` = undefined → delete затрагивает 0 строк, но API возвращает 200 (нет ошибки на 0-строк delete) → «фантомный успех».
**План:**
1. **Валидация:** в `validateCommandDataSourcePreconditions` для `assignment.delete`/`assignment.upsert` проверять, что `assignmentId` существует как реальная строка; иначе `planning_command_invalid` («Назначение не найдено») → 409, а не молчаливый 200. (Точечно, низкий риск — зеркало проверки статуса/ресурса.)
2. **UI (чистле):** не показывать «Снять» на плейсхолдер-строках (которые из demand, не из назначений) — различать по наличию реального `assignmentId`. Убирает бессмысленное действие в корне.
**Оценка:** низко-средний риск. П.1 — быстрый серверный гард с регрессом; п.2 — UI-различение источника строки.

## 🔴 BUG-PROJ-24 (MAJOR) — откат из истории недостижим
**Симптом:** «Откат» на `/commits` недоступен для любого коммита; `lastApplyRef` в `usePlanning()` — per-component, у `/commits` своя пустая инстанция; `applyScenario` его вообще не ставит.
**Корень (глубокий):** откат строит компенсирующие команды через `buildCompensatingCommands`, которому нужен ПОЛНЫЙ before-state. Аудит-событие в live хранит только счётчики (`summarizeSnapshot`), не полный read-model (см. коммент `use-planning.ts:34`). Значит клиентский откат из истории невозможен — данных нет. `lastApplyRef` работает только для правки, сделанной в текущей инстанции surface (т.е. на /schedule сразу после apply), но не переживает переход на /commits.
**План (архитектурный, серверный revert):**
1. **Persistence аудита:** сохранять в audit-событии команды полный `commandInput.command(s)` (payload) — уже частично есть в `commandInput`; убедиться, что достаточно для инверсии (для create → delete, для update_* → предыдущее значение). Для инверсии update-команд нужен `beforeState` затронутых полей — добавить в audit `beforeTaskState` (только затронутые поля), а не полный снапшот.
2. **API endpoint:** `POST …/planning/revert/:auditEventId` — сервер читает сохранённую команду+before, строит компенсирующие команды (`buildCompensatingCommands` перенести/переиспользовать на сервере), применяет как обычный apply-batch (новая версия + аудит `planning.reverted`). Идемпотентность + проверка «откат только последнего/обратимого».
3. **Read-model /commits:** `revertible` из наличия сохранённого before + типа команды; кнопка «Откатить» дергает серверный endpoint, не клиентский `lastApplyRef`.
4. **Регресс:** db-тест apply → revert(auditEventId) → read-model вернулся к прежнему значению; необратимые (create-then-referenced) → 409.
**Оценка:** высокий. Отдельный PR; это по сути фича «version revert», а не багфикс.

## 🔴 BUG-PROJ-22 (MAJOR) — baseline: ложные Δ у свежего снимка
**Симптом:** свежезафиксированный baseline сразу показывает Δ дней (задача +4/−1 дн при Δ работы 0).
**Корень:** `baseline.capture` морозит **authored**-даты задач, а `baselineComparison` сравнивает их с **calculated**-финишем движка (расписанный по календарю/зависимостям). Authored ≠ calculated даже в момент фиксации → мнимая дельта.
**План:**
- Вариант A (корректный): baseline.capture должен морозить **calculated**-даты (снимок расписанного плана), тогда сразу после фиксации Δ=0. Требует прокинуть в capture расчётный план (calculatePlan) и хранить calculated-финиши.
- Вариант B (сравнение): `baselineComparison` сравнивать authored-с-authored ИЛИ calculated-с-calculated консистентно (сейчас смешивает). Определить единицу сравнения и выровнять обе стороны.
- **Регресс:** db/domain-тест: capture → сразу comparison → все `finishDeltaDays===0`.
**Оценка:** средний. Домен + persistence baseline; определить семантику (что есть baseline — authored или calculated).

## 🔴 BUG-PROJ-25 (MAJOR) — сценарии: наивная переназначение
**Симптом:** reassignment берёт «первый другой ресурс тенанта» без фильтра capacity/role/team — может назначить постороннего; «Устойчивый» профиль почти всегда не проходит свой success-check; из 3 профилей часто рендерится 2.
**Корень:** `scenarioPlanning.ts`/autoSolver выбирает альтернативный ресурс без учёта позиции/ёмкости/команды.
**План:** фильтровать кандидатов по совпадению позиции (и/или команды) и наличию свободной ёмкости в окне; если валидного кандидата нет — профиль честно помечается «нет решения», а не назначает постороннего. Регресс: сценарий с единственной подходящей позицией не предлагает чужую.
**Оценка:** средний, изолирован в scenario/autoSolver.

---

## Preview scoping (робастность для BUG-PROJ-23, вынесено)
`previewPlanningCommand(s)` собирает `validationIssues` по ВСЕМУ пересчитанному плану. Даже после фикса нулевой вехи любая ДРУГАЯ предошибка в несвязанной части плана заблокирует правку. План: считать блокирующими только issue, чьи `entity` пересекаются с `changedTaskIds/changedAssignmentIds/...` команды (или помечать предсуществующие issue как «унаследованные» и не блокировать ими новую команду). Риск: можно пропустить реальную новую ошибку — нужен аккуратный дизайн «issue, внесённые ЭТОЙ командой» (diff issue-set до/после).

## Порядок выполнения (рекомендация)
1. ✅ BUG-PROJ-23, ✅ BUG-PROJ-03 — сделано.
2. BUG-PROJ-18 п.1 (серверный гард) — быстрый, низкий риск.
3. BUG-PROJ-22 — определить семантику baseline, выровнять сравнение.
4. BUG-PROJ-19 — таблица принятых перегрузов (миграция) + слои.
5. BUG-PROJ-25 — фильтр кандидатов сценария.
6. BUG-PROJ-24 — серверный revert (фича, отдельный эпик).
7. Preview scoping — после стабилизации, с diff-дизайном.
