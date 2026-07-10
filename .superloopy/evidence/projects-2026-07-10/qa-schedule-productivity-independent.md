# Независимый аудит Schedule productivity

## Вердикт

**REJECT**

Основные сценарии реализованы настоящими командами и свежий Playwright run подтверждает 4/4 happy/race/permission сценария. Однако обязательный порог приёмки не выполнен: TSV duplicate handling не является end-to-end идемпотентным, а Schedule undo допускает частичную компенсацию смешанного batch с сообщением об успешном откате. Дополнительно milestone zero-load invariant не проверен на задаче с реальным назначением.

## Scope

Проверены текущие uncommitted изменения и связанные контракты:

- `apps/web/src/delivery/schedule/schedule-surface.tsx`
- `apps/web/src/delivery/schedule/schedule-editors.tsx`
- `apps/web/src/delivery/schedule/schedule-productivity.ts`
- `apps/web/src/delivery/schedule/schedule-productivity*.test.*`
- `apps/web/src/delivery/schedule/schedule-milestone.ts` и `.test.ts`
- `apps/web/src/delivery/lib/use-planning.ts`
- `packages/domain/src/planning/commandReducer.ts` и тесты
- `packages/domain/src/planning/compensatingCommands.ts` и тесты
- `packages/planning-client/src/undo/buildCompensatingCommands.ts`
- `packages/planning-client/src/api/planningApiClient.ts`
- `apps/api/src/planning/registerPlanningRoutes.ts`
- `apps/api/src/planningRoutes.db.test.ts`
- `e2e/full-eval/projects-schedule-productivity.spec.ts`
- `.superloopy/evidence/projects-2026-07-10/schedule-productivity-playwright.json`

Live E2E и DB tests не запускались по прямому запрету задачи.

## Findings

### F1. TSV duplicate protection не использует серверную идемпотентность

- **Severity:** High
- **Confidence:** Confirmed
- **Requirement:** PROJ-123, duplicate/race handling

`schedule-surface.tsx:866-895` хранит только fingerprint последнего успешного TSV в `lastAppliedPasteRef`. Защита действует после получения успешного ответа и только в текущем mounted экземпляре страницы. После reload/новой вкладки fingerprint исчезает; при сценарии "сервер применил batch, ответ потерян" ref также не устанавливается.

`use-planning.ts:123-138` вызывает `previewCommandBatch` и `applyCommandBatch` без `idempotencyKey`. `planningApiClient.ts:93-97` просто отправляет переданный input. При этом backend уже имеет нужный durable contract: `registerPlanningRoutes.ts:420-451` выполняет lookup/hash conflict для idempotency key, а `registerPlanningRoutes.ts:547-556` сохраняет результат в той же транзакции.

E2E проверяет только повтор той же строки после уже полученного success в том же UI (`projects-schedule-productivity.spec.ts:118-122`). Stale-version 10x6 race проверен хорошо (`:123-152`), но lost-response/reload replay не проверен. Поэтому duplicate claim шире фактической гарантии.

**Impact:** повтор после неопределённого сетевого результата или reload создаст ещё 10 задач с новыми client IDs. Это прямое нарушение обязательного duplicate handling.

**Required fix:** создавать стабильные commands/IDs и idempotency key на preview, повторно использовать их до однозначного результата и передавать key в `applyCommandBatch`; добавить тест response-loss/reload retry с одной версией и ровно 10 итоговыми задачами.

### F2. Ctrl+Shift+Z может выполнить частичный откат смешанного batch

- **Severity:** High
- **Confidence:** Confirmed
- **Requirement:** PROJ-126, guarded compensating undo

Schedule включает undo, если обратима **хотя бы одна** команда batch (`schedule-surface.tsx:371-374`, аналогично `:631-633`). Затем он строит inverses через `flatMap` и молча отбрасывает необратимые команды (`:394-415`).

PROJ-123 batch содержит `task.create` и, при progress > 0, `task.update_progress` (`schedule-productivity.ts:121-143`). После такого импорта Undo становится доступен: компенсация вернёт progress к исходному значению, но не удалит созданные задачи, после чего UI покажет `Откат применён`.

Доменный слой уже задаёт правильное all-or-nothing правило: `compensatingCommands.ts:166-170` возвращает пустой batch, если хотя бы одна команда необратима; это отдельно проверено в `compensatingCommands.test.ts:114-139`. Schedule этот helper не использует. E2E undo покрывает только одиночный `task.update_identity` (`projects-schedule-productivity.spec.ts:75-98`), поэтому дефект не ловит.

**Impact:** пользователь получает ложное подтверждение полного отката, хотя часть коммита остаётся в плане.

**Required fix:** использовать `buildCompensatingCommandBatch` и включать Undo только при полной обратимости всего batch; добавить regression test для `task.create + task.update_progress`.

### F3. Milestone zero-load claim не проверен на задаче с назначением

- **Severity:** Medium
- **Confidence:** High confidence
- **Requirement:** milestone batch cannot leave load/assignments inconsistent; tests must exercise each claim

Продуктовый путь выглядит корректно: `schedule-milestone.ts:9-33` сначала удаляет все assignments, затем ставит duration/work в ноль и `kind=milestone`; `schedule-surface.tsx:581-585` передаёт все authored assignments; API применяет команды внутри одной transaction (`registerPlanningRoutes.ts:410-415,486-530`). Compensation batch также сохраняется в audit (`:521-527`).

Но browser test создаёт задачу через quick-create без назначения и проверяет только duration/work/kind (`projects-schedule-productivity.spec.ts:224-270`). Unit test `schedule-milestone.test.ts:6-39` проверяет массив команд, а не прогон reducer/API/read-model/resource-load. API DB assertion (`planningRoutes.db.test.ts:1853-1926`) проверяет compensating audit на двух rename-командах, не milestone batch с assignment.

**Impact:** реализация, вероятно, сохраняет инвариант, но текущие тесты не доказывают заявленную assigned-task/load часть. Это не позволяет принять milestone claim по заданному evidence bar.

**Required fix:** интеграционный тест должен создать assignment с ненулевым work, применить milestone batch, затем проверить authored assignments, task work/duration и resource load; желательно также выполнить compensating revert и проверить полное восстановление.

## Матрица требований

| Проверка | Оценка | Основание |
|---|---|---|
| PROJ-123: 10x6 TSV parse/preview/atomic apply | PASS с оговоркой | 10 строк/6 колонок парсятся; UI и server preview присутствуют; API apply идёт в transaction; live readback покрыт. |
| PROJ-123: invalid cells | PASS | Весь command generation блокируется при любой ошибке (`schedule-productivity.test.ts:37-49`). |
| PROJ-123: duplicate handling | **FAIL** | Только session fingerprint после success; API idempotency key не используется. |
| PROJ-123: version race | PASS | Dedicated stale 10x6 preview получает 409, apply не отправляется, строк не появляется (`e2e:123-152`). |
| PROJ-124: actual pointer drag-fill downward | PASS | Реальный pointer handle и `pointermove/pointerup` (`schedule-surface.tsx:803-864`); E2E использует mouse down/hover/up (`e2e:154-178`), checkbox не подменяет жест. |
| PROJ-124: invalid destination/version race | PASS | Invalid destination блокирует весь helper batch; stale preview 409 оставляет target без изменения. |
| PROJ-125: 10 tasks keyboard-only | PASS | Insert/typing/Enter создают 10 задач; Home/End/Arrow navigation и F2 edit/readback проверены (`e2e:47-98`). |
| PROJ-126: shortcut/guards | PARTIAL | Shortcut, permission, editable/busy/version guards присутствуют; stale version не отправляет write. Полная компенсируемость batch нарушена F2. |
| PLAN: no writes + direct 403 | PASS | Controls отсутствуют, shortcut не пишет, direct batch preview получает 403, read-model/version не меняются (`e2e:296-331`). |
| Responsive 390/768/1280 | PASS для заявленного smoke | Playwright JSON содержит три screenshot attachment; test проверяет controls и отсутствие document overflow (`e2e:275-294`). |
| Milestone atomic zero-load consistency | PARTIAL | Кодовый путь атомарен, но assigned-task/resource-load интеграция не упражняется (F3). |
| Fake controls | PASS | Paste, pointer fill, keyboard create/edit и undo подключены к реальным planning preview/apply путям. |

## Evidence assessment

`.superloopy/evidence/projects-2026-07-10/schedule-productivity-playwright.json` является свежим валидным Playwright JSON: `expected=4`, `unexpected=0`, `flaky=0`, duration около 36.2 s. Все четыре spec имеют `passed`; responsive spec содержит embedded screenshots для 390/768/1280.

Сильные стороны E2E:

- настоящий pointer drag, а не checkbox substitution;
- 10 реальных keyboard creates с server preview/apply и readback;
- dedicated stale-version 10x6 race с доказательством zero apply/zero rows;
- PLAN UI absence, zero shortcut requests, direct 403 и before/after equality;
- milestone проходит reviewed batch и reload.

Ограничения evidence:

- duplicate test не моделирует lost response/reload и не замечает отсутствие API idempotency key;
- undo test использует полностью обратимую одиночную edit-команду и не покрывает mixed batch;
- milestone E2E не создаёт assignment;
- responsive run проверяет toolbar/no-overflow, но не dialog layout или touch/coarse-pointer drag;
- clipboard helper синтетически dispatch-ит `ClipboardEvent` (`e2e:360-365`), а не выполняет реальный `Ctrl+V` из browser clipboard.

Родитель сообщил fresh broad unit suite `196/196`; отдельного command transcript/artifact с этим числом в указанном evidence root не найдено. По запрету задачи suite не перезапускался. DB assertion исходно проверен чтением, DB test не запускался.

## Residual risks

- PROJ-124 matrix называет holidays, но helper использует календарное `addIsoDays` и не получает project/task calendar (`schedule-productivity.ts:160-164,257-264`). Weekend поведение покрыто как календарные даты; holiday semantics не определены и не протестированы.
- Reducer теперь разрешает любой `durationMinutes=0/workMinutes=0` update независимо от `customFields.kind` (`commandReducer.ts:637-650`). Атомарный milestone batch это использует намеренно, но отдельная команда может создать zero-duration non-milestone task.
- Responsive screenshots доказывают отсутствие общего horizontal overflow, но не полную мобильную эргономику таблицы и modal states.

## Change index

Review был read-only для product/test files. Создан только этот Markdown artifact. CodeGraph синхронизирован до ревью; product symbols/edges не изменялись.
