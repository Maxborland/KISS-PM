# Schedule Full Evaluation: matrix closeout audit

Дата аудита: 2026-07-10.

## Scope и критерий отбора

Проверены только разрешённые источники:

- `docs/qa/full-eval/projects-coverage-matrix-2026-07-10.json`;
- `docs/qa/full-eval/inventory/projects.md`;
- `docs/qa/full-eval/bugs/projects.md`;
- существующие артефакты под `.superloopy/evidence/`.

Отбор выполнен как:

```text
((surface == "`/schedule`" OR surface == "/schedule") AND status != "pass")
OR scenarioId IN (PROJ-119, PROJ-127, PROJ-129, PROJ-130)
```

Итог: **40 role-строк / 32 scenarioId**. Распределение: `fail=5`,
`historical_evidence_only=3`, `partial=2`, `unverified=30`. Из четырёх явно
добавленных ID только `PROJ-119` расширяет точный surface-фильтр, потому что у
него surface равен `` `/baseline`+`/schedule` ``. Прошедшие schedule-строки
`PROJ-031`, `PROJ-032`, `PROJ-046`, `PROJ-123`-`PROJ-126` не входят в scope.

Роли: `A` = admin; `PR` = plan-reader-no-resources.

## Итоговый вердикт

**Рекомендаций PASS: 0 из 40.** У каждой целевой строки остаётся либо
непокрытый свежим артефактом acceptance/edge-контракт, либо подтверждённый
product/spec blocker. Route-ready screenshots, source review и тесты соседнего
контракта не повышают строку действия до pass.

Сильные уже существующие доказательства сужают, но не закрывают scope:

- `projects-schedule-write.json` + Playwright JSON доказывают базовое создание и
  удаление задачи A, reload-readback, скрытые write-контролы PR, прямой 403 и
  неизменность версии. Они не доказывают subtask, полный TaskModal или редакторы.
- `worker-09-schedule-permission.md` доказывает unit-level capability gating:
  PR сохраняет zoom/selection/inspector/column sizing/Baseline navigation, но не
  получает write controls. Это не browser evidence поведения самих контролов.
- `schedule-productivity-*` закрывает `PROJ-046`, `PROJ-123`-`PROJ-126`, но не
  заменяет toolbar undo `PROJ-037`, полный CRUD/workflow `PROJ-117` или текущий
  conflict UX `PROJ-130`.
- fresh baseline evidence доказывает label/readback и нулевые delta сразу после
  capture. Для `PROJ-119` всё ещё нет shift -> table/header/Gantt cross-surface
  проверки и повторного capture.
- `projects-legacy-contract-reconciliation.json` свежо подтверждает отсутствие
  Saved Views, устаревшие axe-target selectors и только backend/partial coverage
  conflict-сценария. Ретраить старые specs недостаточно.
- проверки 2026-07-04 для `PROJ-035`-`PROJ-037` исторические по правилу самой
  матрицы и не могут быть перенесены в pass.

## Минимальный набор свежих проверок

Ниже **11 evidence bundles**. Это минимальный переиспользуемый набор: внутри
bundle сценарии делят actor, disposable fixture и readback, но между bundles
различаются mutation oracle, cross-surface oracle, feature availability или
a11y engine. Сведение всего в один длинный тест не уменьшит требуемые oracle и
сделает результат неатрибутируемым.

Общий порог для каждого browser bundle: изолированная disposable DB; явно
зафиксированные permissions actor; реальный UI gesture; точный request/command;
HTTP result; API readback; reload UI readback; planVersion/commit/audit для
мутаций; zero-write для denied/no-op/reject; `unexpected=0`, `flaky=0`,
`skipped=0`; trace/screenshot/JSON под evidence root. Пропуск из-за отсутствия
fixture считается FAIL.

### C01 - Admin authoring и editors

Один rich-project flow под A: subtask disabled без selection и создаётся с
`parentTaskId`; TaskModal create/edit проверяет title, live assignee, start,
duration, work, progress, Enter-submit, invalid dates и `duration>=1`; edit
переиспользует assignment id. Тем же fixture проверить inline title/duration/
work/progress с Enter/Esc/Tab/Shift+Tab и без double commit; DateEditor start
сохраняет duration, finish пересчитывает duration/work/assignment; ResourceEditor
использует live user и не плодит assignment; все девять row-menu actions и их
disabled states; bottom/positioned quick-create для Enter/Tab/Esc, min-3,
placeholder и rollback после reject.

### C02 - Hierarchy, batch и toolbar undo

Под A: indent/outdent с disabled boundaries, milestone-parent и domain rejection
цикла; batch counter, две правки -> один commit, reset -> authoritative reload,
reject -> issues+reload, stale-version conflict, same-task conflicting edits и
явно зафиксированное поведение при уходе со staged batch. Toolbar `Откат`:
before-snapshot compensation, unavailable notice для create/move/assignment,
double undo, stale conflict и невозможность undo чужого commit. Существующий
`PROJ-126` evidence позволяет не повторять общий shortcut/compensation happy path,
но не эти toolbar-specific branches.

### C03 - View-state parity A/PR

Параметризованный browser check для A и PR: Baseline ведёт на реальный route;
Filters/Columns либо отсутствуют, либо честно disabled согласно утверждённому
контракту; zoom даёт 36/20/8 px и пересчитывает bars/links/markers; nested summary
collapse скрывает subtree и connectors; selected hidden child/inspector state
определён; resize имеет минимум 36 px, выдерживает double drag и сбрасывается при
remount; inspector открывается/закрывается и показывает facts/dependencies. Для A
units edit имеет command+readback; для PR inspector строго read-only.

### C04 - Gantt gestures

Под A буквальными pointer gestures: move body с authoritative recalculation,
zero-delta no-write, left clamp, disabled summary/milestone и release outside;
left/right resize с `duration>=1` и assignment-work sync; progress drag с clamp
0..100/no-write при неизменности; start/finish link handles дают НН/НО/ОН/ОО,
ignore self/miss, reject summary/duplicate/transitive cycle. Отдельно выполнить
bar drag при zoom Month.

### C05 - Dependency editors

Под A через DependencyEditor и LinkLagEditor: список исключает self, descendants,
already-linked и summary; add/update/delete по стабильному dependency id; все
типы и lag day<->minute conversion, включая negative lag; badge только для
selected task; backend reject транзитивного цикла без изменения readback.

### C06 - Delete, validation и optimistic state

Под A: leaf и summary subtree delete leaves-first без orphan tasks/dependencies/
assignments; удаление последней задачи даёт честный empty plan; undo недоступен.
Отдельные reject cases с одним/multiple/no-entity validationIssue доказывают
rollback, error block, row highlight и очистку после success. Happy mutation
доказывает immediate optimistic patch, authoritative replacement, exact notice,
row flash; reject возвращает полный prev-state; быстрый double input даёт один
write.

### C07 - Commit workflow и concurrent conflict

Один A workflow из 10+ изменений: create -> schedule/work -> dependency ->
milestone -> delete; после каждого шага monotonic `vN` и соответствующая запись
на `/commits`; validation reject не меняет state/version. Второе окно делает
remote bump: single edit и staged batch получают 409, показывают явный conflict,
автоматически загружают authoritative state, не отправляют лишний retry; отдельно
зафиксировать судьбу dirty draft/staged batch и повторный retry. Этот bundle
является общим oracle для `PROJ-059`, `PROJ-117`, `PROJ-130`.

### C08 - Live data и date origin

Параметризованный A/PR check на проектах со стартом в 2027 и задачей до
2026-03-02 при фиксированном clock: timeline origin/week labels следуют данным,
today marker следует clock, header показывает реальный project, baseline legend
не hardcoded. Под A resource picker/optimistic patch использует live workspace
user IDs; под PR write controls отсутствуют. Ни один mock ID/name/date не должен
попасть в request или видимый state.

### C09 - Baseline cross-surface

Под A, опираясь на уже доказанный zero-delta capture: capture -> shift task ->
одинаковая delta в header, deviations table и Gantt baseline overlay; reload
сохраняет результат; повторный capture атомарно обнуляет все три представления.
Нужны task/baseline IDs и API comparison readback, а не только screenshots.

### C10 - Saved WBS Views A/PR

Сначала нужен product control + persistence: текущий fresh evidence подтверждает
их отсутствие, поэтому один rerun не поможет. После реализации один
параметризованный check: A create/rename/select/delete, duplicate-name policy и
reload persistence; empty state; PR может select/read, но shared-view mutation
скрыта/disabled и direct mutation даёт 403 с неизменным readback.

### C11 - Current-surface axe A/PR

Мигрированный axe check по текущему DOM, без удалённых testid: WBS+Gantt default,
dialog, selected row/inspector, preview/error state и mobile viewport под A;
read-only controls, keyboard navigation и forbidden/denied state под PR. Gate:
ноль critical violations, без исключения целевого subtree и без skipped scans.

## Полный role x scenario x expected-state ledger

`Expected state` ниже скопирован дословно из поля `expectedBehavior` матрицы.
Ссылка `Cxx` в `Required evidence` означает весь actor-specific oracle bundle
выше, включая перечисленные matrix edges. `BLOCKER_EVIDENCE` не утверждает, что
продукт обязательно сломан: он означает, что pass сейчас недоказуем.

| scenarioId | Role | Scenario | Expected state | Current status | Required evidence | Pass/blocker recommendation |
|---|---|---|---|---|---|---|
| PROJ-033 | A | Кнопка «Подзадача» (родитель = выделенная строка) | Disabled без выделения; создаёт с parentTaskId=selected | fail | C01: selection reset после delete, milestone parent и persisted parentTaskId | **BLOCKER_EVIDENCE** - base create уже доказан, subtask contract нет |
| PROJ-034 | A | Модалка TaskModal (create/edit): название, исполнитель, начало, длит, труд, % | Edit переиспользует id существующего назначения (`asgId`) — без дублирования нагрузки; длительность ≥1 принудительно | fail | C01: полный modal create/edit с live user, invalid dates, Enter и assignment-id/readback | **BLOCKER_EVIDENCE** - старые BUG-PROJ-01/02 не заменяют fresh full-modal result |
| PROJ-035 | A | Кнопки Indent/Outdent («На уровень глубже/выше») | Disabled когда нет prev-sibling / родителя; outdent встаёт сразу после бывшего родителя | historical_evidence_only | C02: fresh literal controls, WBS readback/reload, milestone/cycle rejection | **BLOCKER_EVIDENCE** - evidence только 2026-07-04 |
| PROJ-036 | A | Режим «Пакет» + панель «Применить пакетом»/«Сбросить» | Правки копятся (счётчик), применяются одним коммитом; reject → подсветка ошибок + reload; сброс → reload | historical_evidence_only | C02: one-commit batch, reset/reject/conflict, same-task edits и unload behavior | **BLOCKER_EVIDENCE** - evidence только 2026-07-04 |
| PROJ-037 | A | Кнопка «Откат» (undo последнего коммита) | `buildCompensatingCommands` из before-снимка; недоступен для create/move/assignment (notice) | historical_evidence_only | C02: toolbar-specific unsupported/double/stale/foreign-commit cases | **BLOCKER_EVIDENCE** - `PROJ-126` shortcut pass не закрывает эту строку |
| PROJ-038 | A | Кнопки «Baseline», «Фильтры», «Колонки» | **Фейковые контролы**: `demoAction` disabled на прод-роуте; baseline-снимок при этом реально доступен на вкладке Baseline | unverified | C03 плюс решение: допустимы отсутствующие Filters/Columns или обязательно disabled controls | **BLOCKER_SPEC+EVIDENCE** - current source evidence говорит «controls absent», матрица требует `disabled` |
| PROJ-038 | PR | Кнопки «Baseline», «Фильтры», «Колонки» | **Фейковые контролы**: `demoAction` disabled на прод-роуте; baseline-снимок при этом реально доступен на вкладке Baseline | unverified | C03 под PR плюс то же решение absent-vs-disabled | **BLOCKER_SPEC+EVIDENCE** |
| PROJ-039 | A | Переключатель зума День/Неделя/Месяц | Меняет ширину дня (36/20/8 px); бары/связи/маркеры пересчитываются | unverified | C03 reflow + C04 Month drag edge | **BLOCKER_EVIDENCE** |
| PROJ-039 | PR | Переключатель зума День/Неделя/Месяц | Меняет ширину дня (36/20/8 px); бары/связи/маркеры пересчитываются | unverified | C03 под PR; drag write handle должен отсутствовать | **BLOCKER_EVIDENCE** |
| PROJ-040 | A | Инлайн-правка ячеек Название/Длит/Труд/% (2×клик; Enter/Esc/Tab-навигация) | Excel-навигация Tab/Shift+Tab с переносом строк; правка длительности синхронизирует труд назначения; dur/work/pct недоступны у summary/вех | unverified | C01: exact keyboard navigation, sync/no-double-write, invalid/NaN/clamp edges | **BLOCKER_EVIDENCE** |
| PROJ-041 | A | DateEditor «Начало» (popover + date input) | Сдвигает старт+финиш на ту же длительность; PR → 403 | unverified | C01 A readback для invalid/empty/weekend/manual; existing PR direct-403 нужно связать с date command | **BLOCKER_EVIDENCE** |
| PROJ-042 | A | DateEditor «Окончание» (изменение длительности) | Новая длительность ≥1, труд пересчитан по units, труд назначения синхронизирован | unverified | C01: assigned/unassigned task, finish-before-start, duration/work/assignment readback | **BLOCKER_EVIDENCE** |
| PROJ-043 | A | Ячейка «Ресурсы» — ResourceEditor (назначение исполнителя) | Переиспользует id текущего назначения — не плодит второе | unverified | C01: live directory, stable assignment id, second-resource conflict/reject/readback | **BLOCKER_EVIDENCE** |
| PROJ-044 | A | Ячейка «Предш.» — DependencyEditor (список связей, добавить: предшественник+тип ОН/НН/ОО/НО+лаг, удалить) | Опции исключают себя, потомков и уже-предшественников; лаг в днях → минуты | unverified | C05: option filtering, all types, negative lag, summary exclusion, transitive-cycle rejection | **BLOCKER_EVIDENCE** |
| PROJ-045 | A | ПКМ-меню строки (Открыть инспектор, Редактировать, Создать подзадачу/рядом, Уровни, Сделать вехой, Удалить) | Все 9 пунктов работают; disabled-состояния indent/outdent соблюдены | unverified | C01: all nine literal menu actions, summary variant и focus restoration | **BLOCKER_EVIDENCE** |
| PROJ-047 | A | Удаление задачи / поддерева summary | Summary удаляется пакетом снизу-вверх (листья первыми) — без сирот | unverified | C06: subtree order + dependency/assignment cleanup + last-task empty + undo unavailable | **BLOCKER_EVIDENCE** |
| PROJ-048 | A | Инлайн-строки создания: нижняя Excel-строка + позиционированная из ПКМ (Enter создать / Tab подзадачей / Esc) | Мин. 3 символа (notice); wbs-плейсхолдер «…» до ответа бэка; строка очищается для следующей | unverified | C01: empty/short, Enter/Tab/Esc, last-visible parent, placeholder, reject rollback | **BLOCKER_EVIDENCE** |
| PROJ-049 | A | Свернуть/развернуть summary (шеврон) | Скрывает поддерево по wbs-префиксу; связи к скрытым строкам не рисуются | unverified | C03: nested subtree/connectors/selected-child inspector | **BLOCKER_EVIDENCE** |
| PROJ-049 | PR | Свернуть/развернуть summary (шеврон) | Скрывает поддерево по wbs-префиксу; связи к скрытым строкам не рисуются | unverified | C03, тот же browser oracle под PR | **BLOCKER_EVIDENCE** |
| PROJ-050 | A | Resize колонок WBS-грида (перетаскивание границ) | Мин. ширина 36px; сохраняется в state (не персистится — гэп) | unverified | C03: literal/double drag, 36 px clamp, remount reset | **BLOCKER_EVIDENCE** |
| PROJ-050 | PR | Resize колонок WBS-грида (перетаскивание границ) | Мин. ширина 36px; сохраняется в state (не персистится — гэп) | unverified | C03, тот же browser oracle под PR | **BLOCKER_EVIDENCE** |
| PROJ-051 | A | Gantt: drag тела бара (сдвиг задачи) | Оптимистично + авторитетный пересчёт бэком; deltaDays=0 → без команды | unverified | C04: pointer move/no-op/clamp/disabled/outside with request and reload readback | **BLOCKER_EVIDENCE** |
| PROJ-052 | A | Gantt: resize краёв бара (левый — старт, правый — длительность) | Правый край: труд пересчитан по units + синхронизация назначения; мин. длительность 1 дн | unverified | C04: both handles, assigned work sync, collapse<1 and overlapping progress drag | **BLOCKER_EVIDENCE** |
| PROJ-053 | A | Gantt: drag ползунка % выполнения | Кламп 0..100; коммит только при изменении | unverified | C04: 0->100 literal drag, no-op, critical task, persisted progress | **BLOCKER_EVIDENCE** |
| PROJ-054 | A | Gantt: создание связи перетягиванием точек (start/finish → тип НН/НО/ОН/ОО по краям) | Тип связи выводится из краёв; на себя — игнор | unverified | C04: four edge combinations, miss/self/summary/duplicate/cycle and zero-write rejects | **BLOCKER_EVIDENCE** |
| PROJ-055 | A | Бейдж связи (LinkLagEditor): смена типа/лага, удаление | Бейджи только на связях выделенной задачи; сохранение по id связи | unverified | C05: selected-only badge, stable-id update/delete, negative lag/cycle | **BLOCKER_EVIDENCE** |
| PROJ-056 | A | Side-peek инспектор задачи (прогресс, факты, редакт. «Единицы», зависимости) | «Единицы» редактируются кликом (только task); закрытие крестиком | unverified | C03: real selection, facts/null slack, A units mutation/readback, close | **BLOCKER_EVIDENCE** |
| PROJ-056 | PR | Side-peek инспектор задачи (прогресс, факты, редакт. «Единицы», зависимости) | «Единицы» редактируются кликом (только task); закрытие крестиком | unverified | C03 под PR после исправления expected state на read-only/no units mutation | **BLOCKER_SPEC+EVIDENCE** - exact expectation противоречит свежему permission contract |
| PROJ-057 | A | Блок ошибок валидации + подсветка строк | Reject → откат оптимистики, красный блок «WBS имя — сообщение», строки подсвечены | unverified | C06: no-entity/multiple issues, row highlight, rollback и clear-after-success | **BLOCKER_EVIDENCE** |
| PROJ-058 | A | Оптимистичное применение + notice коммита | Мгновенный локальный патч → авторитетный read-model бэка; notice «Коммит vN · затронуто задач: K»; flash изменённых строк | unverified | C06: immediate state, exact notice/flash, full reject rollback, busy double-input | **BLOCKER_EVIDENCE** |
| PROJ-059 | A | Конфликт версий плана (конкурентное редактирование) | Авто-reload read-model + notice «Конфликт версий — перезагружено»; несохранённый пакет при этом теряется? (проверить) | unverified | C07: two windows, single+batch 409, authoritative reload, staged-draft outcome | **BLOCKER_EVIDENCE** |
| PROJ-060 | A | Хардкоды мок-эпохи на live | **Баг-кандидаты**: `BASE_MS=2026-03-02` (isoToDay/dayToIso из planning-demo-data), «Сегодня»=2026-04-28, недельные подписи от 2026-03-02, PROJECT-заглушка, RESOURCES в optimisticPatch | unverified | C08 после формулировки положительного контракта: dynamic origin/today/labels/project/live users | **BLOCKER_SPEC+EVIDENCE** - поле описывает кандидаты багов, а не pass-state |
| PROJ-060 | PR | Хардкоды мок-эпохи на live | **Баг-кандидаты**: `BASE_MS=2026-03-02` (isoToDay/dayToIso из planning-demo-data), «Сегодня»=2026-04-28, недельные подписи от 2026-03-02, PROJECT-заглушка, RESOURCES в optimisticPatch | unverified | C08 под PR: dynamic visible state + отсутствие write path; нужен role-aware positive contract | **BLOCKER_SPEC+EVIDENCE** |
| PROJ-117 | A | Воркфлоу «Редактирование плана»: создать задачу → срок/труд → связь → веха → удалить → каждая правка = коммит vN | Версия растёт монотонно; каждый шаг виден на `/commits`; отказ валидации не ломает состояние | partial | C07: одна связная 10+ sequence с commit/audit/readback и parallel conflict | **BLOCKER_EVIDENCE** - существующие разрозненные passes не доказывают workflow |
| PROJ-119 | A | Воркфлоу «Baseline»: зафиксировать → сдвинуть задачи → дельты в таблице/шапке/Gantt-подложке | Δ согласована во всех трёх местах | fail | C09: shift cross-surface equality + reload + recapture zero | **BLOCKER_EVIDENCE** - BUG-PROJ-21/22 fixes закрывают только initial capture |
| PROJ-127 | A | Saved WBS views | Manage and select persisted WBS views. | fail | C10 после реализации: CRUD/select/duplicate policy/reload/empty state | **BLOCKER_PRODUCT** - fresh reconciliation подтверждает отсутствие control/persistence UI |
| PROJ-127 | PR | Saved WBS views | Select saved views without unauthorized shared-view writes. | fail | C10 после реализации: select/read + hidden/disabled mutation + direct 403/unchanged | **BLOCKER_PRODUCT** |
| PROJ-129 | A | Current-surface axe audit | No critical axe violations on current WBS and Gantt. | unverified | C11: current DOM across dialog/selection/preview/mobile under A | **BLOCKER_EVIDENCE** - старые selectors удалены, migrated run отсутствует |
| PROJ-129 | PR | Current-surface axe audit | No critical axe violations in read-only current WBS and Gantt. | unverified | C11: PR read-only/keyboard/forbidden states on current DOM | **BLOCKER_EVIDENCE** |
| PROJ-130 | A | Visible concurrent-version conflict | Remote plan-version bump shows explicit conflict and reloads authoritative state. | partial | C07: visible conflict + authoritative reload for dirty draft/batch/retry | **BLOCKER_EVIDENCE** - backend race есть, current UI contract свежо не пройден |

## Duplicate audit

Точных дублей полного ключа `(role, scenarioId)` нет. Есть **6 semantic duplicate
pairs**, где все matrix fields, кроме `role`, побайтно одинаковы:

| scenarioId | Duplicate roles | Решение для fresh evidence |
|---|---|---|
| PROJ-038 | A, PR | Один параметризованный C03, но сначала решить absent-vs-disabled contract. |
| PROJ-039 | A, PR | Общий zoom oracle; A дополнительно делает Month drag, PR доказывает отсутствие write gesture. |
| PROJ-049 | A, PR | Один параметризованный C03 без дублирования fixture. |
| PROJ-050 | A, PR | Один параметризованный C03 без дублирования fixture. |
| PROJ-056 | A, PR | **Нельзя принимать как честный дубль:** A units editable, PR read-only; ожидание PR надо специализировать. |
| PROJ-060 | A, PR | Общий visible-date/project oracle, но resource-write assertion только A; PR доказывает отсутствие write path. |

`PROJ-127` и `PROJ-129` имеют по две role-строки, но не являются дублями:
их `expectedBehavior` и edge-state формулировки различаются для A и PR.

## Закрывающий вывод

Самый короткий честный путь к pass: сначала разрешить три spec ambiguity
(`PROJ-038`, `PROJ-056/PR`, `PROJ-060`), реализовать Saved Views, затем выполнить
C01-C11. Existing route, permission, productivity и baseline evidence следует
переиспользовать как setup/negative oracle, но не переносить его на соседние
rows. До появления actor-bound machine artifacts рекомендация для каждой из 40
строк остаётся blocker.

## Change index

- Product, tests, matrix, inventory и bugs: не изменялись.
- Добавлен только этот report.
- Source symbols/nodes/edges: не менялись; CodeGraph sync намеренно не запускался,
  потому что он записал бы `.codegraph/` вопреки ограничению задачи.

SUPERLOOPY_AUDIT: .superloopy/evidence/schedule-closeout-2026-07-10/lane-matrix.md
