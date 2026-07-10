# Независимый read-only диагноз C04/C05 Schedule Full Evaluation

Дата: 2026-07-10

## Резюме

Вердикт: C04 и C05 в текущем виде нельзя засчитать как доказательство заявленных сценариев.

- C04 имеет высоковероятный первый locator-сбой: `ganttTask()` возвращает всю строку таймлайна, а не тело Gantt-бара. Body/no-op/month drag поэтому либо не запускают pointer handler, либо зависят от случайного совпадения центра строки с баром.
- C04 одновременно содержит крупные oracle-пробелы: почти все заявленные boundary cases отсутствуют, а успешные pointer writes проверяются в основном только по росту версии и существованию задачи.
- C05 наиболее вероятно останавливается на проверке selected-only badge: тест ожидает исчезновение бейджа при выборе predecessor, тогда как продукт намеренно подсвечивает связь при выборе любого её конца. Формулировка inventory поддерживает текущее поведение продукта, поэтому это прежде всего конфликт oracle/требования, а не доказанный product bug.
- C05 не доказывает исключение self/summary/descendant/existing predecessor и вообще не исполняет transitive-cycle rejection, хотя bundle receipt декларирует оба результата.
- API lifecycle для цикла выглядит корректно: preview возвращает blocking `dependency_cycle_detected`, preview gate запрещает apply, а прямой apply должен вернуть 409 без изменения версии/read-model.

Текущий `.superloopy/evidence/schedule-closeout-2026-07-10/schedule-closeout-machine.json` оставляет все строки C04/C05 в `pending` без `blocker`. Существующий `c05-blocker.png` не содержит машиночитаемого stack trace. Поэтому ниже различены наблюдаемые факты кода и ранжированные exact failure hypotheses.

## C04 - PROJ-051..054

### H1. Первый body-drag зависнет на ожидании preview

Класс: **oracle/locator defect**, confidence high.

Тест присваивает `sourceBar = ganttTask(page, source.id)` и затем вызывает body drag в строках 496-500 и month drag в строке 518. Но helper `ganttTask()` в строках 1166-1168 выбирает `[data-task-id]`. Этот атрибут стоит на контейнере всей строки Gantt, а pointer handler `startDrag(..., "move")` стоит только на вложенном `.gantt-bar`.

Точный ожидаемый симптом: `pointerPlanningWrite()` на строке 498 ждёт POST `/planning/preview-command`, но drag, начатый из центра row-container, не обязан попасть в `.gantt-bar`; `waitForPlanningResponse()` истекает по timeout. Даже если на конкретной геометрии центр строки случайно попадёт в бар, тест остаётся flaky и не доказывает literal body gesture.

Код:

- `e2e/full-eval/projects-schedule-closeout.spec.ts:496-500,518,1166-1168,1292-1296,1387-1393`
- `apps/web/src/delivery/schedule/schedule-surface.tsx:1632-1661`

Минимальная рекомендация: дать телу бара стабильный `data-testid`/`data-gantt-bar-task-id` и вернуть его из отдельного helper. `[data-task-id]` оставить только для target-row hit testing.

Acceptance checks:

1. Нулевой drag именно тела бара даёт 0 planning POST и неизменный read-model/version.
2. Drag тела на `+1 dayW` даёт ровно один preview и один apply, меняет start/finish на ожидаемый календарный результат и переживает reload.
3. Month drag использует тот же bar locator и проверяет фактическую дельту, а не только существование задачи.

### H2. C04 receipt декларирует проверки, которых в тесте нет

Класс: **oracle coverage defect**, confirmed by source.

Фактические пробелы:

| Scenario | Заявлено | Что реально делает C04 |
| --- | --- | --- |
| PROJ-051 | clamp left, disabled summary/milestone, release outside | Только `dx=0`, `dx=+36`, затем непроверенный month `dx=8`; отрицательной границы и release outside нет |
| PROJ-052 | оба края, assignment sync, collapse `<1 day`, overlap with progress | Оба края тянутся только вправо; source создаётся без assignment; точные duration/work/assignment readbacks отсутствуют |
| PROJ-053 | clamp/no-op, 0->100, critical task | Проверяется только итоговый `percentComplete === 100`; no-op и critical отсутствуют |
| PROJ-054 | four types, miss/self/summary/duplicate/cycle | Реально проверены four types и self no-write; miss, summary, exact duplicate и cycle отсутствуют |

`pointerPlanningWrite()` проверяет только, что задача существует после write/reload. Он не утверждает точные даты, длительность, work, assignment id/work или delta на month zoom.

Код:

- `e2e/full-eval/projects-schedule-closeout.spec.ts:126-133,486-519,1292-1296`
- `docs/qa/full-eval/inventory/projects.md:109-113`

Минимальная рекомендация: разбить C04 на четыре `test.step`/малых теста по PROJ-051..054 и для каждого сравнивать полный релевантный before/after, включая zero-write cases.

Acceptance checks: каждая строка inventory получает собственный наблюдаемый assertion; bundle receipt не перечисляет assertion, для которого нет выполненного шага и readback.

### H3. Drop на summary является реальным product bug

Класс: **product bug**, confirmed statically; C04 его не ловит.

Summary не имеет source handles, но остаётся допустимой drop target: `data-task-id` стоит на каждой Gantt-строке, а `linkDrag.onUp()` проверяет только наличие `targetId` и self-link. Проверки `target.kind !== "summary"` нет. Domain preconditions для `dependency.upsert` также проверяют только существование задач, self-link и finite lag. Поэтому drag обычной задачи на summary сформирует `dependency.upsert` и может сохраниться.

Код:

- `apps/web/src/delivery/schedule/schedule-surface.tsx:517-535,1648-1653`
- `packages/domain/src/planning/commandReducer.ts:508-521`

Минимальная рекомендация: отклонять summary target до `applyCmd` и закрепить то же правило на domain/API boundary, чтобы direct API не обходил UI.

Acceptance checks: UI drop на summary даёт 0 planning POST; direct preview/apply с summary endpoint возвращает blocking validation/409; version и dependencies неизменны.

### H4. Exact duplicate dependency сейчас разрешён

Класс: **product contract gap / likely product bug**, confirmed statically; ожидаемая политика должна быть зафиксирована.

Четыре разных типа между одной парой явно поддерживаются и нужны C04. Но exact duplicate с новым `id` также разрешён: reducer upsert-ит только по id, DB primary key тоже только `(tenant, project, id)`, unique constraint на `(predecessor, successor, type)` отсутствует.

Код:

- `apps/web/src/delivery/schedule/schedule-surface.tsx:862-864`
- `packages/domain/src/planning/commandReducer.ts:264-280,508-521`
- `packages/persistence/src/schema/tasks.ts:148-183`

Минимальная рекомендация: разрешать параллельные FS/SS/FF/SF, но отклонять повтор той же тройки predecessor/successor/type с новым id.

Acceptance checks: четыре разных типа сохраняются; пятый exact duplicate получает blocking issue и zero-write readback.

## C05 - PROJ-044/055

### H1. Проверка selected-only badge конфликтует с продуктовой семантикой

Класс: **oracle/requirement ambiguity**, confidence high; вероятный текущий blocker на строке 573.

После финального update связь снова FS (`ОН`). Тест выбирает predecessor и ожидает 0 бейджей `ОН`. Реализация ставит `accent` при `succ.id === sel || pred.id === sel`, то есть показывает редактор для связи, инцидентной выбранной задаче с любой стороны. Это соответствует буквальному inventory: «Бейджи только на связях выделенной задачи».

Точный ожидаемый симптом: `toHaveCount(0)` в строке 573 получает 1.

Код:

- `e2e/full-eval/projects-schedule-closeout.spec.ts:554-574`
- `apps/web/src/delivery/schedule/schedule-surface.tsx:842-867,1694-1700`
- `docs/qa/full-eval/inventory/projects.md:113`

Минимальная рекомендация: сначала выбрать одно правило.

- Если редактор доступен для любой связи выбранной задачи, заменить assertion: unrelated third task -> 0, predecessor -> 1, successor -> 1.
- Если продукт требует только incoming predecessor links выбранного successor, менять `accent` на `succ.id === sel` и явно уточнить inventory.

Acceptance checks: тест использует три задачи и однозначно проверяет выбранное правило без regex по локализованному label.

### H2. Self-option assertion всегда может пройти ложно

Класс: **oracle defect**, confirmed.

UI option label имеет формат `${wbs} ${name}`, а тест проверяет `options.not.toContain(successor.title)`. `toContain` для массива требует полного равенства, поэтому option `2 C05 successor ...` не совпадёт с чистым title даже если self option ошибочно присутствует.

Код:

- `e2e/full-eval/projects-schedule-closeout.spec.ts:536-540`
- `apps/web/src/delivery/schedule/schedule-surface.tsx:1382-1386`
- `apps/web/src/delivery/schedule/schedule-editors.tsx:120-124`

Минимальная рекомендация: проверять `option[value="<taskId>"]` и отдельно assert-ить self, descendant, summary и already-predecessor exclusions.

Acceptance checks: каждый запрещённый id имеет count 0; допустимый leaf имеет count 1; после add тот же predecessor исчезает из options.

### H3. Hardcoded 480 делает lag oracle зависимым от первого проекта

Класс: **oracle/environment defect**, confirmed risk.

Продукт переводит дни в минуты через `successor.workingMinutesPerDay`. Тест выбирает первый проект и ожидает `lagDays * 480`. На проекте с шестичасовым календарём корректный результат будет 360 минут на день, а C05 упадёт как будто это product bug.

Код:

- `e2e/full-eval/projects-schedule-closeout.spec.ts:528,548,567,1135-1139`
- `apps/web/src/delivery/schedule/schedule-surface.tsx:115-130,936-955`

Минимальная рекомендация: использовать детерминированный seeded project/calendar или вычислять expected lag из read-model effective calendar.

Acceptance checks: `-2` и `+3` дня проверяются на проекте с известным календарём; reload сохраняет точные signed minutes.

### H4. Transitive-cycle rejection не исполняется тестом, но lifecycle его поддерживает

Класс: **oracle coverage defect**; API product path выглядит корректным.

C05 создаёт только одну связь и затем меняет её тип/лаг. Трёх задач и обратного ребра нет. При этом API preview вычисляет новые engine issues; scheduling engine выдаёт `dependency_cycle_detected`; preview gate показывает issue и disables apply; apply endpoint повторно валидирует и возвращает 409.

Код:

- `e2e/full-eval/projects-schedule-closeout.spec.ts:526-582`
- `apps/api/src/planning/planningCommandCore.ts:12-29`
- `packages/domain/src/planning/schedulingEngine.ts:57-76`
- `apps/api/src/planning/registerPlanningRoutes.ts:124-187,296-314`
- `apps/web/src/delivery/lib/planning-preview-gate.tsx:67-68,96-125`

Минимальная рекомендация: создать A->B и B->C, затем через UI попытаться C->A. Проверить blocking issue в preview, disabled apply, отсутствие apply POST и неизменный read-model/version. Дополнительно direct apply тем же envelope должен дать 409 с `dependency_cycle_detected`.

Acceptance checks: preview status 200 с blocking issue; UI не отправляет apply; direct apply status 409; dependencies и planVersion равны before; после reload состояние неизменно.

### H5. Отрицательный lag отображается как `+-N`

Класс: **product display bug**, confirmed statically; persistence не затронут.

Оба display path безусловно добавляют `+` перед любым ненулевым lag: `+-2д` в DependencyEditor и `ОН+-2` на badge.

Код:

- `apps/web/src/delivery/schedule/schedule-editors.tsx:107-113`
- `apps/web/src/delivery/schedule/schedule-surface.tsx:1694-1699`

Минимальная рекомендация: добавлять `+` только для положительного lag, отрицательное число выводить как есть.

Acceptance checks: `+2`, `0`, `-2` отображаются соответственно как `+2`, без suffix, `-2`; API minutes и dependency id не меняются от форматирования.

## Lifecycle preview -> apply

Для валидной команды UI делает preview, ждёт явного подтверждения, генерирует/переиспользует idempotency key, делает apply и заменяет optimistic state авторитетным read-model. Для blocking preview apply button disabled. Apply endpoint повторяет validation внутри write transaction, затем пишет command, увеличивает version и перечитывает snapshot; ошибка readback бросается и должна откатить transaction.

Код:

- `apps/web/src/delivery/lib/use-planning.ts:95-145,148-197`
- `apps/web/src/delivery/schedule/schedule-surface.tsx:739-790`
- `apps/api/src/planning/registerPlanningRoutes.ts:227-374`
- `apps/api/src/governedPlanningApply.ts:98-154`
- `packages/persistence/src/planningRepository.ts:885-950`

## Verification

E2E не запускался. Общая БД не использовалась.

Запущен только чистый unit/component scope:

```text
pnpm vitest run packages/domain/src/planning/schedulingEngine.test.ts apps/web/src/delivery/lib/planning-preview-gate.test.tsx apps/web/src/delivery/schedule/schedule-batch-integrity.test.tsx apps/web/src/delivery/schedule/schedule-editors.test.tsx
```

Результат: 4 files passed, 30 tests passed. Эти проверки подтверждают cycle engine, blocking preview gate и command builders, но pointer gestures и C04/C05 browser oracle ими не покрываются.

## Scope и change index

- Product/test files: не изменялись.
- Создан только этот отчёт.
- CodeGraph использован первым для structural navigation; untracked closeout spec отсутствовал в первичном context result, поэтому для него применён точечный read/literal-search fallback.
- CodeGraph before: 2238 indexed files, 25083 nodes, 53307 edges.
- CodeGraph after: 2238 indexed files, 25083 nodes, 53307 edges (no change).
- Symbols added/changed/removed: none; Markdown evidence не содержит индексируемых code symbols.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/diagnosis-c04-c05.md
