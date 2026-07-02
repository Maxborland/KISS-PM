# Управленческие плоскости — аудит и план устранения (2026-07-02)

**Источник:** полный аудит 8 агентами (bug/formula/security/quality/tests/spec/architecture/UX) плоскостей PMO, планирование, Гантт, KPI/контроль, ёмкость/ресурсы, задачи/делегирование, intake.
**Ветка:** `codex/ui-storybook-polish`.
**Главный вывод:** бэкенд управленческого ядра силён; фронт — витрина. Гантт = статичная read-only таблица, обрезанная 30 днями. Roadmap `sb-vs-prod` выполнен на ~15%. Тесты управленческого слоя де-факто отключены с 01.07.2026.

**Исключено (в работе у второго Claude, НЕ трогаем):** migration-0042 drift; `task.update_progress` не персистит процент; tenant-wide изоляция «Ресурсы»/«KPI»; порт-закрытие ветки `ui-storybook-polish`.

Легенда статуса: ☐ не начато · ◐ в работе · ☑ готово (verify пройден).

---

## Спринт 1 — «Стоп-кран» (P0, чинить первым)

- ☑ **P0-7 · Мина в тестах `expiresAt`.** СДЕЛАНО: заменил хардкод-даты на `new Date(Date.now() + 60*60*1000)` в `app.test.ts` (replace_all), `occupancyRoutes.test.ts:53`, `planningAutoSolverRoutes.test.ts:420` (строку 187 `2000-01-01` не трогал — намеренный тест на протухший solver-run). Verify: было 39 падений → стало 1 (осталась лишь несвязанная регрессия storybook-контракта).
- ☑ **P0-4 · Admin-креды в форме логина.** СДЕЛАНО: `useState("")` в `runtime-screen-view.tsx:879-880`; убрал `defaultValue="admin@kiss-pm.local"` в `login-screen-view.tsx:28`. Примечание: `admin12345` — это стандартный dev-seed пароль (`scripts/seed-dev.ts`), опасность была в предзаполнении в бандл, не в самом пароле; на прод-стенде seed-dev не должен запускаться.
- ☑ **P0-1 · Гантт обрезан 30 днями.** СДЕЛАНО: `toGanttData` строит `days` по реальному диапазону `min…max` дат проекта и задач; `base` = самая ранняя дата (заодно закрыт BUG-003, `startDayOf` больше не клампит чужие задачи в 0); CSS `repeat(var(--gantt-days,35),…)`, виджет прокидывает `--gantt-days`; ключ `ChartHead2` → `iso` (номер дня повторяется на >1 месяца). Typecheck web чистый. **Визуальная проверка — pending (нужен поднятый стек, БД сейчас недоступна).**
- ◐ **P0-5 · Пересчёт ёмкости блокирует event loop.** СМЯГЧЕНО: `capacityService.ts` — снапшоты тянутся `Promise.all` (I/O параллельно), между тяжёлыми CPM-пересчётами добавлена уступка event loop (`setImmediate`), чтобы холодный промах не морозил API для со-тенантов. Typecheck api чистый. **Полное устранение CPU-стоимости — follow-up:** кэш read-model per-project по `planVersion` либо вынос CPM в worker (помечено `ponytail:` в коде). Нагрузочный verify — pending (нужен стек).
- ☐ **P0-6 · Нет пагинации/виртуализации задач.** НЕ НАЧАТО — сознательная остановка. Гантту нужны ВСЕ задачи (WBS-дерево + CPM), поэтому пагинация к нему неприменима — нужна именно виртуализация строк (react-virtual уже в deps `planning-gantt-ui`). Виртуализация CSS-grid таблицы — существенное изменение раскладки/скролла с реальным риском регрессии, которое НЕЛЬЗЯ проверить вслепую без поднятого стека. Делать в отдельной сессии с запущенным приложением. Пагинация плоского списка `GET …/tasks` (TaskTable) — безопасна и независима, можно сделать раньше.
- ☑ **P0-8 / KPI-001 · Двойной источник дневной ёмкости скрывает перегруз.** СДЕЛАНО: `employeeCapacity.ts:297` — `capacityMinutes = hasAbsence ? 0 : baseDayCapacity` (единый источник: произв.календарь + персональные исключения + отсутствия), больше не берём `merged.capacityMinutes`. Добавлен тест `employeeCapacity.test.ts` (частичная занятость 240 в день с нагрузкой 300 → capacity 240, overload 60, heat 3). 11/11 зелёных.

---

## Спринт 2 — «Гантт как инструмент MS Project» (P0-2 + связанные P1)

Стратегическое решение: **подключить существующий `packages/planning-gantt-ui`** (есть zoom/scale `timelineScale.ts`, WBS-дерево `treeRows.ts`, стрелки `GanttDependencyArrows.tsx`, легенда — но 0 импортов в web) ВМЕСТО дописывания слабого `apps/web/src/widgets/gantt`. Иначе — портировать эти части. Решить до старта спринта.

- ☐ **P0-2 · Гантт — статичная таблица.** `gantt.tsx:21-40` — бар без pointer/drag/resize; стрелок зависимостей нет (`gantt.css:315-352` `.gdep` не рендерится); % complete не в баре (`gantt.css:252-258` `.gbar__progress` не применяется); slack посчитан (`schedulingEngine.ts:472-494`), но не показан. **Fix:** drag-move + resize-handle (preview→apply поверх `preview-command`/`apply-command`); подключить `GanttDependencyArrows`; рендерить `.gbar__progress` пропорционально `row.progress`; колонка/tooltip «Резерв, дн.».
- ☐ **P0-3 / UX-003 · Сворачивание WBS/групп нерабочее.** `gantt.tsx:47-51` (toggle без onClick), `resource-matrix.tsx:30-38`, `runtime-screen-view.tsx:1503-1535,1344-1361` (`collapsed` никогда true). **Fix:** `collapsedIds` state + onClick + фильтрация потомков в обоих виджетах; добавить поле `collapsed` в `MatrixRow`.
- ☐ **UX-004 / CQ-007 · zoom-переключатель декоративен.** `runtime-screen-view.tsx:443,531`, `gantt.tsx:9` (`DAY_W=28`). **Fix:** реальная гранулярность день/неделя/месяц (из `timelineScale.ts` пакета) ЛИБО скрыть/дизейбл до готовности.
- ☐ **BUG-002 / CQ-012 · Undo молча no-op для половины команд.** `packages/planning-client/src/undo/buildCompensatingCommands.ts:126` — 7 из 21 типа, остальные `default: return []`; подсистема к тому же 0 callers. **Fix:** дополнить switch (create→delete, delete→recreate из snapshot, move_wbs→прежний parent/sortOrder, assignment.*→upsert прежних) ИЛИ бросать `unsupported_undo`; подключить к UI (кнопка «Отменить последнее»).
- ☐ **UX-001 · e2e-тесты бьют мимо приложения.** `e2e/planning/{drag-fill,excel-paste,keyboard-only,compensating-undo}.spec.ts` ищут `data-testid="planning-workspace/-wbs-grid/-drag-fill-handle"` и роут `/schedule` — их нет (реальный `/timeline`). **Fix:** по мере реализации drag/keyboard/undo — проставить testid и починить URL; что не реализуем в этом спринте — пометить `test.fixme` с причиной (не оставлять ложно-зелёными).
- ☐ **CQ-002 · Канбан «Моей работы» теряет `waiting`.** `runtime-screen-view.tsx:940`. **Fix:** добавить колонку «Заблокировано» (`waiting`).

---

## Спринт 3 — «Правильные цифры» (P1 расчёты и целостность)

- ☑ **KPI-002 · Feasibility игнорирует произв.календарь.** СДЕЛАНО: `projectIntake.ts` — `countWorkingDays` и часы/день принимают опциональный `FeasibilityCalendar` (рабочие дни ISO + праздники + minutes/day), дефолт = Пн-Пт·8ч (обратная совместимость). API `feasibilityAssessment.ts` грузит календарь года начала сделки (если есть `db`) и передаёт его. +2 теста (праздники ok→conflict, кастомная неделя). 6/6.
- ☑ **KPI-003 · Прогресс проекта без веса.** СДЕЛАНО: `kpiEngine.ts` — `progress_percent` = Σ(pct·work)/Σ(work), фолбэк на среднее percentComplete при нулевой трудоёмкости. +3 теста (89% вместо 0%, фолбэк, пустой проект). controlEngine не сломан.
- ☑ **SEC-001 · Cross-tenant SSE.** СДЕЛАНО: `planningEventsRoute.ts` — новый обязательный dep `projectExistsInTenant`; 404, если проект не в тенанте актора. Wiring в `registerPlanningRoutes.ts` через `getPlanSnapshot(tenantId, projectId)` (secure-by-default: нет persistence → отказ). +2 юнит-теста (404 + вызов с тенантом актора).
- ☐ **BUG-004 · Рассинхрон статус-переходов фронт↔бэк.** `runtime-screen-view.tsx:1406` (next по sortOrder) vs `taskCommandGuards.ts:56` (`isTaskStatusTransitionAllowed`). **Fix:** фильтровать кандидатов по матрице переходов (дублировать на фронт или отдавать allowed из API). Фронт — проверяемо только запущенным стеком.
- ☐ **Тест-долг · Деньги не ассертятся.** `contractValue`/`plannedHourlyRate`/`plannedHours` сидятся в 4 наборах, 0 `expect()`. **Fix:** добавить ассерты на read-path хотя бы в один набор.
- ☑ **P0-2-тест · storybook-контракт регрессия.** СДЕЛАНО: Phase 1 (c6efd9bf) намеренно заменил disabled-заглушки «Экспорт/Создать» реальным `UserMenu` — тест устарел. Обновил контракт: проверяет наличие `UserMenu`/`BemAvatarStack` и отсутствие фейковых демо-кнопок. 12/12.
- ☐ **CQ-005/006, SPEC-004/005/006 · Фейковые данные из Storybook в проде.** Аватар «ИИ» у всех задач/сделок (`runtime-screen-view.tsx:943,1123`), `acceptedRiskReason` зашит (`:347`), `id="Задача N"` по индексу (`:943`), номер сделки=имя стадии (`:1123`). **Fix:** резолвить участников через `useWorkspaceUsers()`; Textarea для причины; реальные id.
- ☐ **ARC-005 · Дрейф дублей apply-команды.** `governedPlanningApply.ts:53` (0 callers) vs инлайн в `registerPlanningRoutes.ts:149-351` и `:353-529`; batch не пишет audit при конфликте версии. **Fix:** перевести оба роута на `applyGovernedPlanningDelta` (или удалить хелпер и добавить audit в batch-ветку).

---

## Спринт 4 — «Долг и масштаб» (P2)

- ☐ **ARC-006 · React Query инвалидация.** Правка задачи инвалидирует только `["planning",id]` (`runtime-screen-view.tsx:476`); `AssignResourceDialog` (`:781`) — глобальный `invalidateQueries()`. **Fix:** точечная инвалидация набора ключей (`planning`,`capacity-tree`,`capacity-summary`).
- ☐ **ARC-008 · capacityCache process-local.** `capacity/capacityCache.ts` — `Map`, не шарится между инстансами. **Fix:** вынести в Redis (уже есть для event bus), ключ `tenantId:raw:monthIso:projectFilterId`.
- ☐ **SEC-002 · Нет throttling на `/control/evaluate` и `/planning/scenarios/preview`.** **Fix:** per-user/tenant rate limit или debounce/cache.
- ☑ **KPI-004 · Дрейф округления дневного распределения.** СДЕЛАНО: новый `allocateProportionalMinutes` (метод наибольшего остатка) — Σ по дням == total. Применён к ассигнованиям (`resourcePlanning.ts:263`) и резервам (`:381`). occupancy (`:90`) — иной путь (реальный overlap, KPI-009), вне scope. +3 теста. 75/75 planning-тестов зелёные. **db-верификация — в phase (в).**
- ⊘ **KPI-007 · Разные функции дельты дат — НЕ БАГ.** Проверено: `dateDeltaDays` (`Math.ceil`) и `diffCalendarDays` (`Math.round`) получают только date-only `YYYY-MM-DD` (UTC-полночь), разница всегда кратна 86400000 → ceil==round==точное целое. Расхождения на реальных входах нет. Кода не трогаю (косметический DRY не стоит риска смены error-семантики).
- ☐ **Money-ассерты (тест-долг).** contractValue/plannedHourlyRate/plannedHours не проверяются на read-path — сделать в phase (в) с поднятым стеком (это db-тесты).
- ☐ **KPI-005 · Нет отсутствия на полдня.** `employeeCapacity.ts:294-297`. **Fix:** поддержать долю дня / half-day тип.
- ☐ **KPI-006 · `unavailable` добавляется в нагрузку, а не режет ёмкость.** `resourcePlanning.ts:406`. **Fix:** вычитать из capacityMinutes.
- ☐ **UX-015 · Канбан без drag&drop** между колонками; кнопка «Действия колонки» без onClick (`kanban-board.tsx:22-24`).
- ☐ **UX-011/012 · Хардкод hex-цветов** мимо токенов (`gantt.css`, `resource-matrix.css`); критичность только цветом (WCAG 1.4.1), легенда не подключена.
- ☐ **UX-013 · Слабые loading-состояния** Гантта и Ресурсов (нет skeleton, `runtime-screen-view.tsx:511,741`).
- ☐ **SEC-003 · Saved-view create/delete без audit.** `planningSavedViewRoutes.ts:41-112`.
- ☐ **UX-007 · Клавиатура в гриде Гантта.** `gantt.tsx:113-116` — `role="row"` + tabIndex без `onKeyDown`; нет roving-tabindex.

---

## Спринт тестов (параллельно, закрывает дыры покрытия)

1. ☐ `employeeCapacity` — частичная занятость/исключение произв.календаря в день С нагрузкой (ловит KPI-001).
2. ☐ `calculatePlannedHours`/`countWorkingDays` — невалидный вход (−100, 0, NaN, finish<start) → 0 (деньги).
3. ☐ `monthRangeIso("2026-12")` → `{from:"2026-12-01",to:"2026-12-31"}` (off-by-one конца года).
4. ☐ `parseScenarioTargetRecord` — отклоняет битый payload (права+даты).
5. ☐ `ChartBar` — grid-column позиционирование (`startDay:0,duration:3`→`"1 / span 3"`; `duration:0`→`span 1`; milestone).
6. ☐ Каскадный сдвиг дат — двинуть задачу, ассертить дату зависимой (сейчас 1 проверка на весь бэк).

---

## P3 / бэклог (не блокеры, зафиксировано)

Рекурсия WBS без visited-set (`runtime-screen-view.tsx:1493,1504`); хардкод версии движка (`scenarioPlanning.ts:152`); выбор альт-ресурса без проверки ёмкости (`scenarioPlanning.ts:88`); веха по эвристике «лист без часов»; мёртвый `planning-gantt-ui`/`planning-client` (решить: доделать или удалить — см. Спринт 2); ~170 тёмных роутов (control-surfaces 17 шт — крупнейший backend-долг); UTC-границы occupancy; неиспользуемые deps в `planning-gantt-ui/package.json`.

**Roadmap `sb-vs-prod`:** done — Гантт (ядро), Resources (ядро); missing/partial — KPI/контроль, scenarios, baselines, calendars, project tab-shell, deal-detail, projects-list, entities, admin, settings, search, chat/notifications/meetings, calls (orphaned). Wave 0 фундамент (user-map, CrmActivityPanel, attachment-helpers, PERMISSIONS) не построен → вся проводка в монолите `runtime-screen-view.tsx` (1542 строки).
