# Lane 01 — Projects UI inventory

Дата инвентаризации: 2026-07-10
Репозиторий: `E:\KISS-PM`
Ветка: `codex/pre-prod-hardening-on-master`
Режим: read-only для `apps/web`; изменён только этот отчёт.

## Точный scope

В scope вошли все пользовательские маршруты под `apps/web/src/app/projects` и их поверхности:

1. `/projects`
2. `/projects/:id`
3. `/projects/:id/assignments`
4. `/projects/:id/baseline`
5. `/projects/:id/calendars`
6. `/projects/:id/commits`
7. `/projects/:id/overview`
8. `/projects/:id/resources`
9. `/projects/:id/scenarios`
10. `/projects/:id/schedule`
11. `/projects/:id/settings`

Также прочитаны общие для этих маршрутов `WorkspaceShell`, `DeliveryFrame`, глобальный поиск, меню пользователя, редакторы delivery-поверхностей, stories и относящиеся к Projects/delivery тесты. API не исследовались глубже вызовов, которые делает UI. CRM и Communications исключены, кроме ссылок из Projects UI и общих пунктов shell-навигации.

## Метод и команды

Сначала синхронизирован и опрошен CodeGraph, затем через него получены маршрутное дерево и структурный контекст. После входа через граф использовалось точечное чтение файлов и literal-search по UI-строкам/permission-маркерам.

```powershell
codegraph sync
git status --short --branch
# MCP: codegraph_status, codegraph_files(apps/web/src/app/projects),
# codegraph_files(apps/web/src/delivery), codegraph_context, codegraph_explore
rg -n '(permission|permissions|forbidden|can[A-Z]|доступ|прав)' `
  apps/web/src/delivery apps/web/src/workspace/projects `
  apps/web/src/workspace/project-detail apps/web/src/app/projects
rg -n '<DeliveryFrame' apps/web/src/delivery --glob '*-surface.tsx'
```

Исходный CodeGraph: 2176 файлов, 24 132 узла, 52 137 рёбер. Маршрутное дерево CodeGraph вернуло ровно 11 `page.tsx` под `apps/web/src/app/projects`; все 11 присутствуют в таблице ниже.

## Общий chrome всех Projects-маршрутов

### WorkspaceShell

Источник: `apps/web/src/delivery/ui/workspace-shell.tsx`.

- Desktop sidebar: группы «Работа», «Аналитика», «Коммуникации», «Администрирование»; активный пункт «Проекты».
- Mobile: кнопка «Открыть навигацию», modal-like sidebar, backdrop, кнопка «Закрыть меню», Escape, focus trap и возврат фокуса.
- Верхняя панель: глобальный поиск и меню пользователя.
- Глобальный поиск: combobox, минимум 2 символа, debounce 300 мс, spinner, список до 10 результатов, ArrowUp/ArrowDown/Enter/Escape, переход по `result.route`, состояния «Ищем…», «Ничего не найдено…», «Поиск сейчас недоступен».
- Меню пользователя: avatar toggle; имя/id; ссылки «Профиль», «Настройки»; «Выйти»/«Выходим…»; клик по backdrop закрывает меню.

### DeliveryFrame

Источник: `apps/web/src/delivery/ui/delivery-frame.tsx`.

- Шапка проекта: инициалы кода, имя, статус, версия плана, дедлайн, расчётный финиш, variance chip.
- Вкладки в фиксированном порядке: `Обзор`, `График`, `Ресурсы`, `Назначения`, `Календари`, `Сценарии`, `Baseline`, `Коммиты`, `Настройки`.
- При наличии `projectId` вкладки — ссылки `/projects/:id/<slug>`; без `projectId` — статические `span`.
- При включённых prototype notes постоянно показывается индикатор «Сохранено»; он не связан с mutation state.

## Ролевая модель, доказанная UI

В UI нет таблицы именованных ролей для Projects. Видимость определяется permission-ключом, поэтому ниже используются роли-capabilities:

| Capability/роль | Доказанное поведение UI |
|---|---|
| Сессия ещё не загружена | Shell временно показывает все nav items, чтобы избежать мигания. |
| Пользователь с `tenant.projects.read` | Видит пункт «Проекты» в shell. На всех Projects/delivery поверхностях UI не делает дополнительных permission-проверок. |
| Пользователь без `tenant.projects.read` | Пункт «Проекты» скрыт в shell. Прямой URL не блокируется page-компонентом; поверхность вызывает UI data hook и при HTTP 403 показывает `SurfaceState.forbidden`. |
| Пользователь с read, но без неизвестного write-permission | Все кнопки изменения плана всё равно видимы и активны; UI не читает permissions и узнаёт об отказе только из результата mutation/toast. Точный write permission не выводился из API, согласно non-goal. |
| Ограниченная роль без доступа к справочнику пользователей | Delivery-поверхности продолжают работать; имя ресурса заменяется на `Участник <последние 4 символа id>` (в карточке проекта аналогичный fallback). |
| Forbidden на data call | Общий экран: «Доступ ограничен» / «У вас нет прав на просмотр этого раздела». |

Все девять delivery-вкладок видимы одинаково; per-tab role visibility отсутствует.

## Route × surface × role × state

| Route | Surface | Ожидаемая/фактическая видимость роли | Loading | Empty / локально пусто | Error | Forbidden | Success / ready |
|---|---|---|---|---|---|---|---|
| `/projects` | `ProjectsListSurface` | Nav: `tenant.projects.read`; прямой route полагается на 403 | «Загрузка проектов…» | Surface empty «Нет проектов» + ссылка «К сделкам» | `projectsErr`, «Повторить» | общий forbidden | Таблица только активных проектов; row click/Enter → `/projects/:id/overview` |
| `/projects/:id` | `ProjectDetailSurface` | То же; users directory может дать fallback имени | «Загружаем карточку проекта…» | Surface empty «Проект не найден»; внутри ready: «У проекта пока нет задач», «Спрос… не задан» | `wsErr`, «Повторить» | общий forbidden | Карточка, задачи, сводка; selector меняет загруженный проект |
| `/projects/:id/assignments` | `ProjectAssignments` | Все read-users видят все write controls | «Загрузка назначений…» | Нет top-level empty; per-task «нет исполнителей»; curve «Нет рабочих дней…» | `planningErr`, retry; mutation/curve ошибки inline + toast | общий forbidden | Матрица, inspector, add/update/delete assignment; success toast с версией |
| `/projects/:id/baseline` | `ProjectBaseline` | Все read-users видят capture | «Загрузка…» | В ready: «Базовый план не зафиксирован»; «Нет изменённых задач…» / «Нет данных сравнения» | `planningErr`, retry; capture reject toast | общий forbidden | История, KPI, deviations table; capture success toast |
| `/projects/:id/calendars` | `ProjectCalendars` | Все read-users могут видеть day toggles/absence controls | «Загрузка календарей…» | В ready: «Нет исключений»; conflicts отсутствуют без отдельного state | `planningErr`, retry; mutation reject toast | общий forbidden | Calendar grid; add/remove holiday/absence success toast |
| `/projects/:id/commits` | `ProjectCommits` | Все read-users видят revert controls | Только planning read-model «Загрузка…»; отдельного loading commits нет | В ready: «История пуста»; «Выберите коммит…» | Planning `planningErr`; отдельная ошибка `loadCommits` не показана | общий forbidden | Feed/detail; revert success toast; no-op/reject toast |
| `/projects/:id/overview` | `ProjectOverview` | Read-only surface для всех read-users | «Загрузка…» | В ready: «Критичных сигналов нет»; «История пуста»; milestones/key tasks могут быть просто пустыми | `planningErr`, retry; commits subload error не показан | общий forbidden | KPI, signals, milestones, key tasks, latest commits |
| `/projects/:id/resources` | `ProjectResources` + `ResourceLoadMatrix` | Все read-users видят task/edit/absence/accept-overload controls | «Загрузка ресурсной загрузки…» | В ready: «Нет ресурсов под фильтры»; drilldown «Нерабочий день»/«Нет нагрузки» | `planningErr`, retry; mutation reject toast | общий forbidden | KPI + matrix + drilldown; task/assignment/absence/risk success toasts |
| `/projects/:id/scenarios` | `ProjectScenarios` | Все read-users видят preview/apply; UI лишь текстом упоминает permission | «Загрузка…»; nested «Расчёт сценариев…» | «Перегрузов не найдено…» | `planningErr`; inline `scenarioErr`; reason `role=alert`; apply reject toast | общий forbidden | 3 proposal profiles, compare, apply; success toast с plan version |
| `/projects/:id/schedule` | `ProjectSchedule` | Все read-users видят полный editing UI | «Загрузка плана…» | Нет top-level empty; пустой WBS остаётся с create row | `planningErr`; inline task issues; create validation; reject/conflict toasts | общий forbidden | WBS/Gantt, direct edits, drag/link, batch, undo; success toasts |
| `/projects/:id/settings` | `ProjectSettings` | Все read-users видят deadline edit; «Права» — только roadmap note | «Загрузка настроек…» | Нет empty state | `planningErr`, retry; deadline reject toast | общий forbidden | Read-only project fields + deadline mutation success toast |

## Подробный inventory поверхностей

### `/projects`

Источники: `app/projects/page.tsx`, `workspace/projects/projects-list-surface.tsx`.

- Controls: кликабельная строка проекта (`role="link"`, click/Enter), empty action «К сделкам».
- Table: `Проект`, `Клиент`, `Статус`, `Срок`, `Сумма`, `План.часы`, `Спрос`.
- Row content: title/id (id только prototype), client avatar/name, translated status chip, date range, contract value, planned hours, demand chips или `—`.
- Фильтров в UI нет; экспортированный `PROJECTS_LIST_AVAILABLE_FILTERS` содержит только «Активные».
- Modal/form: нет.

### `/projects/:id`

Источники: `app/projects/[id]/page.tsx`, `workspace/project-detail/project-detail-surface.tsx`.

- Controls: project `<select>`; segmented «Объём»/«Спрос».
- Header fields: старт, срок, сумма контракта, плановые часы, число задач; project status chip.
- Tasks table: `Задача`, `Статус`, `Исполнитель`, `Срок`, `Прогресс`; незакрытые впереди, далее по финишу.
- Summary «Объём»: прогресс, открыто задач, плановая и фактическая трудоёмкость.
- Summary «Спрос»: список позиций, часы, доля и bars.
- Modal/form: нет; project selector не синхронизирует URL.

### `/projects/:id/assignments`

Источники: `delivery/assignments/assignments-surface.tsx`, `assignments-editors.tsx`.

- Toolbar: предыдущий/следующий месяц; granularity `День`/`Неделя`.
- Matrix/list: строки задач и назначений; WBS/title; сумма назначений/труд задачи; роль, units, труд; периодные часы; weekend/curve/crosshair indicators.
- Add assignee dialog: resource select, role select (`Исполнитель`, `Соисполнитель`, `Контролёр`, `Согласующий`, `Наблюдатель`), «Отмена», «Добавить», close; disabled submit when no resource.
- Assignment inspector: close; resource select; role select; units number; work-hours number.
- Curve editor: presets «Равномерно», «К началу», «К концу», conditional «Сбросить»; per-day numeric hours; sum indicator; «Применить кривую», conditional «Отмена»; inline balance error.
- Remove confirmation: «Снять исполнителя» → confirm dialog с «Снять» и отменой.
- Success: add/update/remove/curve/reset toast `… · коммит vN`.

### `/projects/:id/baseline`

Источник: `delivery/baseline/baseline-surface.tsx`.

- Controls: ссылка «Слой в „Графике“»; «Зафиксировать базовый план».
- Inline capture form: title input, «Зафиксировать», icon-button «Отмена».
- History list: snapshot label, active/archive chip, captured timestamp, task count.
- KPI tiles: project finish/delta, changed tasks, work delta.
- Filter toggle: «Только изменённые».
- Deviations table: WBS, task, baseline/current finish, day delta, baseline/current work, hour delta, shift visualization; critical-path/deleted badges.
- Empty-in-ready: no baselines; no changed rows/data comparison.
- Success: «Базовый план зафиксирован · коммит vN».

### `/projects/:id/calendars`

Источник: `delivery/calendars/calendars-surface.tsx`; absence form in `resources-editors.tsx`.

- Left list: project calendar and every resource; absence-rule count/inherits chips; selection buttons.
- Month controls: previous/next; month label; read-only `Пн–Пт`, `8 ч/день` badges.
- Calendar grid: 6×7 buttons; working/weekend/holiday/absence tones; project view toggles holidays; resource view toggles absences; weekends and shared holidays disabled where appropriate.
- Resource action: «Исключение» opens Absence dialog.
- Absence dialog: employee select, type segmented buttons (`Отпуск`, `Больничный`, `Отгул`), date from/to, «Отмена», «Добавить отсутствие», close.
- Exceptions list: type, date, optional resource, remove icon.
- Conflict card: first affected task, count of additional conflicts, link «Открыть График».
- Success: add/remove holiday/absence and batch absence toast with commit version.

### `/projects/:id/commits`

Источник: `delivery/commits/commits-surface.tsx`.

- Controls: «Откатить последний»; selectable feed rows; inline «Откатить» for latest reversible; detail-panel «Откатить коммит»; disclosure «Показать raw payload» (prototype only).
- Feed: time, version, summary, changed task count, reversible marker, action-type chip.
- Detail: summary/action type, version transition, timestamp, audit event id, source, up to 8 affected tasks, revert availability note, raw JSON.
- Success: compensating commit toast; errors for nothing-to-revert, non-reversible operation, conflict/reject.
- No separate state for the asynchronous commits request after planning read-model is ready.

### `/projects/:id/overview`

Источник: `delivery/overview/overview-surface.tsx`.

- No mutation controls/forms/modals.
- KPI: progress, calculated finish/reserve, baseline delta, overloaded resources, plan risks.
- Signals list: deadline breach, overload, baseline delay, overdue tasks, critical path; each has a real link to Schedule/Scenarios/Baseline.
- Milestones list: milestones plus project deadline.
- Key tasks table: WBS, title, critical marker, progress bar, avatar, finish.
- Latest commits list: up to 4; link «Все» to commits.
- Local empty: normal-plan message and empty commit history; milestones/key tasks silently render empty lists.

### `/projects/:id/resources`

Источники: `delivery/resources/resources-surface.tsx`, `resource-load-matrix.tsx`, `resources-editors.tsx`, shared `TaskModal`.

- Toolbar: «Задача»; toggles «Только перегруженные», «Скрыть незанятых»; «Отсутствие»; optional team filter; role filter; optional project filter; sort `по загрузке`/`по имени`; month previous/next; granularity `День`/`Неделя`/`Месяц`.
- KPI: capacity, assigned, load %, free, overload people/hours.
- Hierarchical matrix: team → role → person; expand/collapse; per-row committed/capacity bar; per-period aggregate bars and person heatmap; total row; crosshair.
- Cell drilldown: employee/date/load; overload card; «Снять перегруз» only for day granularity; task contributions; edit-task button; project filter shortcut where applicable; inline total assignment hours edit; absence rows; close.
- Task modal (create/edit): title, assignee, start, duration days, work hours, progress; computed units; «Отмена», «Создать»/«Сохранить», close.
- Absence dialog: employee, type, date range, cancel/submit.
- `ReserveDialog` exists in shared editor file but is not mounted by the project-level `ProjectResources` callbacks and therefore is not a surface control for this route.
- Success: task save, assignment update, accepted overload, absence batch; all via toast.

### `/projects/:id/scenarios`

Источник: `delivery/scenarios/scenarios-surface.tsx`.

- Controls: «Запросить заново»; overload target select when multiple; per-proposal «Сравнить»/«Скрыть», «Применить»; compare close.
- Proposal cards: aggressive/balanced/resilient, recommended badge, finish/delta, overload/effect, changed task count, risk score.
- Aggressive-only required reason input; inline `role="alert"` validation.
- Inline comparison: current vs preview KPI and plan-command diff list.
- Nested states: preview spinner; balanced no-overload empty; scenario stale/conflict/error banner; apply rejection toast.
- Success: toast names profile and new plan version; prototype also shows `scenarioRunId`.

### `/projects/:id/schedule`

Источники: `delivery/schedule/schedule-surface.tsx`, `schedule-editors.tsx`, `schedule-rows.ts`.

- Toolbar: «Задача», «Подзадача», outdent/indent icon buttons, batch toggle/count, «Откат», Baseline link, zoom `День`/`Неделя`/`Месяц`.
- WBS table columns: row number, mode, WBS, task, duration, work, progress, start, finish, resource, predecessors. Column dividers are draggable.
- Row controls: expand/collapse summary; row selection/inspector; double-click inline edit name/duration/work/progress; date popovers; resource popover; dependency popover.
- Bottom and contextual create rows: title input; Enter creates; Tab creates as child; Escape cancels; inline minimum-3-character error.
- Context menu: open inspector, edit, create subtask, create sibling, indent/outdent, make milestone, delete.
- Date popover: date input, cancel/apply.
- Resource popover: employee list.
- Dependency popover: current predecessors/remove; predecessor, type (`ОН/НН/ОО/НО`), lag, add link.
- Gantt: task/summary/milestone/baseline bars; today/deadline lines; body drag; left/right resize; progress handle; start/finish link handles; dependency SVG.
- Link badge popover: type, lag, delete/save.
- Side inspector: progress, mode, duration, work, editable units, dates, slack, resources, dependencies; close.
- Task modal: title, assignee, start, duration, work, progress; create/save/cancel/close.
- Batch bar: «Сбросить», «Применить пакетом».
- Delete confirmation: title/description including subtree warning; «Отмена», destructive «Удалить».
- Errors: surface state; task validation banner; inline create error; conflict/reject/non-reversible undo toasts.
- Success: single/batch commit, undo, discard batch toasts.

### `/projects/:id/settings`

Источник: `delivery/settings/settings-surface.tsx`.

- Calendar section: read-only current calendar; link «Открыть Календарь».
- Project fields: read-only start, calculated finish/reserve, source, id/version; editable deadline.
- Deadline edit form: new date, mandatory reason, «Применить перенос», «Отмена»; unchanged-date hint; submit disabled until reason and changed date.
- Planning mode summary: auto/manual chips and task count.
- Project rights section: informational note only, no roles/users/control.
- Integrations: Bitrix24 and MSPDI cards; buttons use `demoAction`, not real integration calls.
- Success: deadline moved toast with new commit version.

## Модальные и всплывающие поверхности

| Surface | Type | Route(s) | Inputs/actions |
|---|---|---|---|
| Global search panel | Combobox dropdown | Все | query, keyboard navigation, result buttons |
| User menu | Menu/popover | Все | profile, settings, logout |
| Mobile workspace nav | Sheet-like aside | Все | nav links, close/backdrop/Escape |
| AddAssigneeDialog | Dialog | assignments | resource, role, add/cancel/close |
| Remove assignee | ConfirmDialog | assignments | confirm/cancel |
| AbsenceDialog | Dialog | calendars, resources | employee, type, from/to, submit/cancel |
| TaskModal | Dialog | schedule, resources | title, assignee, start, duration, work, progress |
| DateEditor | Popover | schedule | date, apply/cancel |
| ResourceEditor | Popover | schedule | employee choice |
| DependencyEditor | Popover | schedule | predecessor, type, lag, add/remove |
| LinkLagEditor | Popover | schedule | type, lag, save/delete |
| RowMenu | Context menu | schedule | inspector/edit/create/move/milestone/delete |
| Delete task | Controlled dialog | schedule | destructive confirm/cancel |
| Assignment inspector | Side panel | assignments | assignment fields, curve, remove |
| Resource drilldown | Side panel | resources | overload, task/assignment edits |
| Schedule inspector | Side panel | schedule | facts, editable units, dependencies |

## Evidence from tests and stories

- `projects-list-surface.test.ts`: proves only active filter/scope and removal of closed projects.
- `project-action-links.test.ts`: source-level assertions for Baseline→Schedule, Calendar→Schedule, Settings→Calendars and Schedule→Baseline; explicitly rejects fake filter/column buttons.
- `overview-status.test.ts`: mock/live done and in-progress status mapping.
- `schedule-rows.test.ts`: live-style parent/child mapping to summary rows and aggregates.
- `date-origin.test.ts`: project-relative timeline, calendar month range, overdue date behavior.
- All 11 surfaces have exactly one `Default` Storybook story (resources additionally has Portfolio, outside route scope). Stories document happy/default content only.
- `mock-planning-backend.test.ts` validates planning commands/data behavior but does not mount user-facing surfaces.

No inspected test mounts loading, error, forbidden, empty, modal, role visibility, tab navigation, mutation success/error, keyboard flow or URL synchronization states.
## Verification results

Targeted tests were executed through the already-installed local Vitest binary:

```powershell
& '.\node_modules\.bin\vitest.cmd' run `
  apps/web/src/workspace/projects/projects-list-surface.test.ts `
  apps/web/src/delivery/project-action-links.test.ts `
  apps/web/src/delivery/overview/overview-status.test.ts `
  apps/web/src/delivery/schedule/schedule-rows.test.ts `
  apps/web/src/delivery/lib/date-origin.test.ts
```

Result: 5/5 test files passed, 14/14 tests passed, duration 1.58 s.

The first attempt through `pnpm vitest run ...` did not start tests because the repository's pnpm wrapper invoked install and stopped on `ERR_PNPM_IGNORED_BUILDS`. No dependency/build-script approval was performed; the direct installed binary then passed.

Artifact completeness check derived routes from all `apps/web/src/app/projects/**/page.tsx` and required an exact route row in this report:

```text
ROUTE_FILES=11
TABLE_MISSING=0
REQUIRED_MISSING=0
```

Final `codegraph sync`: already up to date. Final status: 2176 indexed files, 24 132 nodes, 52 149 edges.

## Bugs / risks

### HIGH — шесть delivery-поверхностей рендерят статические вкладки вместо ссылок

Affected: `assignments`, `baseline`, `calendars`, `overview`, `schedule`, `settings` in both loading/error and ready branches.
Evidence: these surfaces call `<DeliveryFrame ... activeTab="…">` without `projectId`; `DeliveryFrame` renders `span` when `projectId` is absent. `commits`, `resources`, `scenarios` pass it correctly.

Steps:
1. Open `/projects/<valid-id>/overview` (same for the other five routes).
2. Click any project tab in the DeliveryFrame.

Expected: tab is a link to `/projects/<id>/<slug>` and navigates.
Actual: tab is a non-interactive `span`; navigation is impossible from that surface.

### HIGH — write controls are not permission-aware

Affected: assignments, baseline, calendars, commits revert, resources, scenarios, schedule, settings deadline.
Evidence: shell exposes Projects using only `tenant.projects.read`; delivery surfaces do not read session permissions and render mutation controls whenever planning status is `ready`.

Steps:
1. Sign in with a role that has `tenant.projects.read` but lacks the server-required planning mutation permission.
2. Open `/projects/<id>/schedule` or another editable delivery tab.
3. Observe and use «Задача», «Применить», «Зафиксировать», day toggles, etc.

Expected: write controls are hidden or disabled with an explicit reason according to capability.
Actual: controls look enabled; the user only gets a generic rejection toast after submitting. Exact backend permission name intentionally not inspected.

### MEDIUM — project selector changes content without changing `/projects/:id`

Affected: `/projects/:id`.
Evidence: `ProjectSwitcher.onSelect` only calls `setSelectedId`; no router navigation/replace.

Steps:
1. Open `/projects/A`.
2. Select project B.
3. Copy/reload the URL.

Expected: URL becomes `/projects/B`, preserving selected project on reload/share.
Actual: URL remains `/projects/A`; reload/share restores A.

### MEDIUM — commits subrequest failures are displayed as an empty history

Affected: `/projects/:id/commits`; overview has the same silent catch gap for its latest-commits subrequest.
Evidence: `loadCommits().then(...)` has no loading/error state and no rejection handler; ready UI derives `commits = data?.commits ?? []`.

Steps:
1. Let planning read-model load successfully.
2. Make only the UI call used by `loadCommits` fail.

Expected: commits-specific error with retry, or at least explicit degraded-state copy.
Actual: commits route shows «История пуста» (and may produce an unhandled rejection); overview shows no commits.

### MEDIUM — global «Сохранено» is a static prototype flag, not a success state

Affected: every delivery route when `prototypeNotesEnabled` is true.
Evidence: `DeliveryFrame` renders «Сохранено» solely from the feature flag; it does not receive busy/error/dirty state.

Steps:
1. Enable prototype notes.
2. Open a delivery route during loading or after a rejected mutation.

Expected: saved indicator reflects confirmed persistence or is absent.
Actual: «Сохранено» remains visible regardless of loading, dirty or failed state.

## Doubts

- UI encodes only `tenant.projects.read`; it does not reveal the exact permission(s) required by every planning mutation. Naming those permissions would require evaluating API/backend authorization and is outside scope.
- No named business-role matrix (Administrator/PM/Member/etc.) exists in inspected Projects UI. The role table therefore uses permission-capabilities, not guessed role names.
- `/projects/:id` is a separate Workspace project card, while delivery tabs start at `/projects/:id/overview`; there is no tab/backlink to the card in `DeliveryFrame`.
- `ReserveDialog` is implemented beside resource editors but not wired into `ProjectResources`; it is excluded from route controls.

## Unverified zones

- No browser/E2E execution, screenshots or live role sessions were used; this lane is source/test inventory only.
- No backend routes, persistence, authorization implementation or API response correctness were evaluated beyond visible UI calls and their UI-handled status codes.
- CRM and Communications surfaces were not inventoried.
- Storybook stories provide only default/mock happy states; they are not evidence for loading/error/forbidden/empty/role behavior.
- Route middleware or deployment-level auth outside the scoped Projects/delivery UI was not used to infer role visibility.

## Route completeness verification

CodeGraph found these 11 files, and the route table contains the matching 11 route rows:

```text
apps/web/src/app/projects/page.tsx
apps/web/src/app/projects/[id]/page.tsx
apps/web/src/app/projects/[id]/assignments/page.tsx
apps/web/src/app/projects/[id]/baseline/page.tsx
apps/web/src/app/projects/[id]/calendars/page.tsx
apps/web/src/app/projects/[id]/commits/page.tsx
apps/web/src/app/projects/[id]/overview/page.tsx
apps/web/src/app/projects/[id]/resources/page.tsx
apps/web/src/app/projects/[id]/scenarios/page.tsx
apps/web/src/app/projects/[id]/schedule/page.tsx
apps/web/src/app/projects/[id]/settings/page.tsx
```

Result: no discovered Projects route omitted.

## Change index

- Product files touched: none.
- Added report: `E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-01-ui-inventory.md`.
- Symbols added/changed/removed: none (Markdown evidence only).
- CodeGraph files/nodes before → after: 2176 → 2176 files; 24 132 → 24 132 nodes.
- CodeGraph edges before → after: 52 137 → 52 149. This lane changed no indexed source; the +12 edge delta appeared during final sync in a shared dirty worktree and is recorded as concurrent/index drift, not attributed to this report.

SUPERLOOPY_EVIDENCE: E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-01-ui-inventory.md
