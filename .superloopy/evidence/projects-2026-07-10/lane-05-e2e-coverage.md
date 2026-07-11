# Lane 05 - Projects E2E coverage and fixture audit

Дата: 2026-07-10
Репозиторий: `E:\KISS-PM`
Ветка: `codex/pre-prod-hardening-on-master`
Режим: product files read-only; изменён только этот отчёт; DB/e2e tests не запускались.

## Итог

Route-state coverage для Projects теперь существует и свежее: `projects-role-routes.spec.ts` прошёл **55/55** строк для пяти авторизованных акторов на всех 11 маршрутах, а `auth-route-guards.spec.ts` ранее прошёл anonymous guard на всех 11 маршрутах. Это доказывает только загрузку `ready/forbidden/empty` и отсутствие alpha-title leak, но не действия.

Action coverage фактически неработоспособно:

- baseline `e2e/planning` от 2026-07-10: **18 tests, 0 passed, 18 unexpected**;
- 13 тестов завершились на login helper из-за strict-mode collision `getByLabel("Пароль")` с кнопкой `Показать пароль`;
- ещё 5 тестов открыли отсутствующий `project-alpha` и затем искали testid, которых нет в текущем product source;
- helper уже изменён параллельной lane (`exact: true`, API lookup первого проекта), но suite после этого не перезапускался, поэтому fix остаётся непроверенным;
- planning suite тестирует только ADMIN, выбирает первый проект общей БД, имеет persistent mutations и не содержит cleanup.

Главный риск не в одном flaky selector, а в harness: `playwright.config.ts` по умолчанию использует dev DB `...@127.0.0.1:55432/kiss_pm`, `reuseExistingServer: true`, а `test:e2e:smoke` выполняет `db:migrate` и `db:seed:dev` до Playwright. Для Projects это нельзя считать безопасной тестовой средой.

## Scope

Проверены:

- все 11 `apps/web/src/app/projects/**/page.tsx`;
- текущие действия поверхностей list/detail и девяти delivery tabs;
- `e2e/planning/*.spec.ts`, `planningHelpers.ts`, `playwright.config.ts`, root scripts;
- свежие артефакты `planning-baseline.json`, `projects-navigation*.json`, `projects-role-routes*.json`, `auth-route-guards.md`;
- dev seed personas и permission model;
- существующий `@kiss-pm/test-fixtures`;
- API permission evidence из lane 02 и race/idempotency evidence из lane 03.

Не выполнялись:

- Playwright, Vitest DB suites, migrations, seed, reset, truncate или любые shared-DB mutations;
- browser actions или HTTP mutations;
- изменения product/test files;
- проверка визуального качества скриншотов другой lane.

## Статусная легенда

- **F✓** - fresh artifact после текущего запуска достиг цели и проверка прошла.
- **F!** - fresh artifact достиг цели и зафиксировал failure/denial; это свежая диагностическая информация, не pass продукта.
- **S** - stale: spec/evidence есть, но не дошёл до цели, использует отсутствующий fixture/selector либо relevant source уже изменён после исходной проверки.
- **M** - missing: автоматической проверки действия нет.

В action-строках `F✓ barrier` означает, что свежая автоматизация доказала недоступность действия раньше UI control: redirect, forbidden или empty/not-found. Это не доказательство server-side mutation endpoint для данной персоны.

## Реальные персоны

| Запрошенная персона | Текущий actor/fixture | Реальные permissions | Важное ограничение fixture |
|---|---|---|---|
| ADMIN | `admin@kiss-pm.local` | alpha admin, полный profile | Нормальный full-access actor. |
| ENGINEER/PM | `engineer@kiss-pm.local` | тот же `access-profile-alpha-admin`, что ADMIN | Это не ограниченный PM/engineer. Любой pass дублирует admin capability. |
| PLAN | `plan-reader-no-resources@kiss-pm.local` | `tenant.projects.read`, `tenant.project_plan.read` | Может читать все delivery routes; scenario preview получает 403; writes должны получать 403. |
| RESOURCE | `resource-reader@kiss-pm.local` | только `tenant.project_resources.read` | Не имеет `tenant.projects.read`/`tenant.project_plan.read`; все 11 Projects routes свежо показывают forbidden. Даже `/resources` недоступен, потому что общий read-model требует plan read. |
| BETA/GUEST | `beta@kiss-pm.local` | beta admin, полный profile, но пустой tenant | Это cross-tenant/empty ADMIN, не guest. Guest capability в dev seed отсутствует. |
| ANON | без cookie | нет actor | Middleware redirect до protected API. |

Sources: `scripts/seed-dev.ts:45-68,223-260`; `packages/access-control/src/index.ts:18-65,143-151`; `planningRouteAuth.ts:10-19`; `planningCommandPermissions.ts:10-32`.

## Fresh route-state matrix

Все 11 маршрутов присутствуют. Строки ADMIN/ENGINEER/PLAN/RESOURCE/BETA взяты из `projects-role-routes.json` (**55/55 passed**, generated `2026-07-09T22:13:49.010Z`), ANON - из `auth-route-guards.md` (**58/58 full report rows passed**, включая anonymous traversal всех Projects routes).

| Route | ADMIN | ENGINEER/PM | PLAN | RESOURCE | BETA/GUEST | ANON |
|---|---|---|---|---|---|---|
| `/projects` | **F✓** ready, list 200, 3 | **F✓** ready, 200, 3 | **F✓** ready, 200, 3 | **F✓** forbidden, 403 | **F✓ BETA** empty, 200, 0; **M GUEST** | **F✓** 307 -> login, no API leak |
| `/projects/:id` | **F✓** ready, detail 200 | **F✓** ready, 200 | **F✓** ready, 200 | **F✓** forbidden, detail 403 | **F✓ BETA** empty, detail 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/overview` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/schedule` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/resources` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/assignments` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/calendars` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/scenarios` | **F✓** ready; preview transport 200 | **F✓** ready | **F✓** shell ready, preview transport **403** | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/baseline` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/commits` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |
| `/projects/:id/settings` | **F✓** ready, read-model 200 | **F✓** ready | **F✓** ready | **F✓** forbidden, 403 | **F✓ BETA** empty, 404; **M GUEST** | **F✓** redirect |

Ограничения этой матрицы:

- `ready` определяется только текстовым detector, не наличием обязательного content contract.
- PLAN `/scenarios` считается `ready`, хотя route capture зафиксировал `POST .../planning/scenarios/preview -> 403`; error UX не проверяется.
- listener route responses может поймать поздний response предыдущего route: в ADMIN baseline row записан scenario preview. Поэтому transport attribution не полностью изолирован.
- RESOURCE/BETA/ANON проходят action rows только как route barrier; direct write endpoints этими actors не вызваны.

## Role x route x action ledger

Таблица покрывает все текущие действия из UI inventory. Где несколько control представляют один mutation contract, они объединены в одну строку и перечислены явно.

| Route | Current action(s) | ADMIN | ENGINEER/PM | PLAN | RESOURCE | BETA/GUEST | ANON |
|---|---|---|---|---|---|---|---|
| `/projects` | Load active list; ready/empty/forbidden | **F✓** | **F✓** | **F✓** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects` | Open project row by click/Enter -> overview | **F✓** click | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects` | Empty CTA `К сделкам`; retry error | **M** | **M** | **M** | **M** | **M** | **F✓ barrier** |
| `/projects/:id` | Load card; not-found/forbidden | **F✓** | **F✓** | **F✓** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id` | Project selector changes URL; reload/back persistence | **F✓** | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id` | Segmented `Объём` / `Спрос` | **M** | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/overview` | Direct ready/empty/forbidden state | **F✓** | **F✓** | **F✓** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/overview` | Delivery tabs | **S** captured fail; source changed | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/overview` | Signal links to Schedule/Scenarios/Baseline; `Все` commits | **M** | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/schedule` | Direct ready/empty/forbidden state | **F✓** | **F✓** | **F✓** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/schedule` | Delivery tabs/Baseline link | **S** captured fail; source changed | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/schedule` | Grid/Gantt render, zoom, dependency connectors, a11y | **S** 7 target tests blocked at login | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/schedule` | Create/inline edit; keyboard 10 tasks; TSV paste; date drag-fill; batch apply/discard | **S** specs exist but never reached target | **M** | **M**, expected 403 on apply | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/schedule` | Indent/outdent, milestone, delete, date/resource/dependency editors, Gantt move/resize/progress/link | **M** | **M** | **M**, expected 403 | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/schedule` | Apply then compensating undo | **S** test blocked at login; no cleanup proof | **M** | **M**, expected 403 | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/resources` | Direct state + Delivery tabs | **F✓** | **F✓ route / M tabs** | **F✓ route / M tabs** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/resources` | Matrix filters/sort/month/granularity; cell drilldown | **S** 2 specs use `project-alpha`/missing testids | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/resources` | Create/edit task, assignment hours, accept overload, add absence | **M** | **M** | **M**, expected permission denial | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/assignments` | Direct state + Delivery tabs | **F✓** | **F✓ route / M tabs** | **F✓ route / M tabs** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/assignments` | Month, day/week, select/close inspector | **M** | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/assignments` | Inline units/work edit -> preview/apply bar | **S** test blocked at login | **M** | **M**, expected 403 resource-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/assignments` | Add/update/remove assignee | **M** | **M** | **M**, expected 403 resource-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/assignments` | Curve presets, per-day edit, apply/reset/cancel | **M** | **M** | **M**, expected 403 resource-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/calendars` | Direct state + Delivery tabs | **F✓** | **F✓ route / M tabs** | **F✓ route / M tabs** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/calendars` | Select project/resource; previous/next month | **M** | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/calendars` | Open exception/absence and preview | **S** test blocked at login and names obsolete control | **M** | **M**, expected 403 plan-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/calendars` | Add/remove holiday/absence; batch absence; conflict link to Schedule | **M** | **M** | **M**, expected 403 plan-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/scenarios` | Direct state + Delivery tabs | **F✓** | **F✓ route / M tabs** | **F✓ shell; F! preview 403** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/scenarios` | Auto/re-request preview; target select; compare/hide | **S** incidental transport only, no content assertion | **M** | **F!** preview transport denied; UX assertion missing | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/scenarios` | Required aggressive reason; apply proposal | **M** | **M** | **M**, expected scenario apply 403 | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/baseline` | Direct state; tabs; Schedule link; history/filter | **F✓ route / S tabs / M controls** | **F✓ route / M controls** | **F✓ route / M controls** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/baseline` | Capture baseline; name/cancel | **M** | **M** | **M**, expected 403 baseline-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/commits` | Direct state + Delivery tabs; feed select/raw disclosure | **F✓ route+tabs / M feed controls** | **F✓ route / M controls** | **F✓ route / M controls** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/commits` | Revert last/selected commit | **M** | **M** | **M**, permission depends on inverse commands | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/settings` | Direct state; tabs; Calendar link; read-only fields | **F✓ route / S tabs / M controls** | **F✓ route / M controls** | **F✓ route / M controls** | **F✓ barrier** | **F✓ BETA 404 / M GUEST** | **F✓ barrier** |
| `/projects/:id/settings` | Deadline edit, reason, apply/cancel | **M** | **M** | **M**, expected 403 plan-manage | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |
| `/projects/:id/settings` | Calendar change preview from old spec | **S** obsolete: field is read-only; testids absent | **M** | **M** | **F✓ barrier** | **F✓ BETA empty / M GUEST** | **F✓ barrier** |

## Existing automated coverage outside E2E

Useful, но не заменяет ledger выше:

- `projects-list-surface.test.ts`: active-only list filtering.
- `project-action-links.test.ts`: source-level links между Baseline/Schedule, Calendar/Schedule, Settings/Calendars, Schedule/Baseline.
- `overview-status.test.ts`, `schedule-rows.test.ts`, `date-origin.test.ts`: mapping/date/row pure logic.
- `mock-planning-backend.test.ts`: большой command-contract набор на in-memory mock.
- API/DB tests из lane 02: 42 focused tests passed для project intake/work permissions/readback/tenant isolation.
- unit/race evidence lane 03: 7 files, 64 tests passed для planning mutation boundaries.

Но ни один из этих уровней не проверяет role-aware UI affordance, browser mutation -> network -> API readback -> reload -> cleanup для Projects delivery actions.

## Разбор `e2e/planning` failures

Fresh baseline artifact: `.superloopy/evidence/projects-2026-07-10/planning-baseline.json`, start `2026-07-09T21:40:58.638Z`, duration 86.64 s, `expected=0`, `unexpected=18`, `skipped=0`, `flaky=0`.

### Failure cluster A - login helper, 13/18

Affected:

- `assignments.spec.ts`;
- `calendars.spec.ts`;
- `compensating-undo.spec.ts`;
- `drag-fill-dates.spec.ts`;
- `excel-paste-10x6.spec.ts`;
- `keyboard-only-10-tasks.spec.ts`;
- оба tests в `planning-a11y.spec.ts`;
- все четыре tests в `planning-grid.spec.ts`;
- `resources.spec.ts`.

Все упали примерно за 0.5-0.6 s на `getByLabel('Пароль')`: locator нашёл password input и icon button `aria-label="Показать пароль"`. Ни один target route/action не был достигнут.

Текущий dirty helper уже содержит `{ exact: true }` и ждёт heading dashboard. Это правдоподобный fix, но evidence после изменения отсутствует, поэтому 13 target checks остаются **stale**, а не pass.

### Failure cluster B - отсутствующий fixture и мёртвые selectors, 5/18

Affected:

| Spec | Fresh failure | Причина |
|---|---|---|
| `cross-project-drilldown.spec.ts` | `resource-matrix-cell-*` not found, 15 s | Hardcoded `/projects/project-alpha/resources`; current list: `project-vektor-portal`, `project-gorset-migration`, `project-demo-crm-intake`. Selector отсутствует в current product source. |
| `resource-matrix.spec.ts` | `planning-resource-matrix` not found | Тот же hardcoded id; testid отсутствует. |
| `custom-fields.spec.ts` | `custom-field-definitions OR custom-fields-empty` not found | Hardcoded missing project; оба testid отсутствуют. |
| `saved-views.spec.ts` | `saved-views-dropdown` not found | Hardcoded missing project; testid отсутствует. |
| `settings.spec.ts` | `planning-settings-pane` not found | Hardcoded missing project; testids `planning-settings-pane` и `calendar-preview-summary` отсутствуют; calendar field сейчас read-only, так что сценарий obsolete. |

Это не flaky failures. Specs проверяют предыдущую форму UI/fixture и должны быть переписаны, не ретраены.

### Hidden mutation/cleanup risk

- `compensating-undo.spec.ts` делает реальный apply, затем compensating apply. Даже при восстановленном title остаются две версии/аудиты.
- `planning-grid` conflict test вызывает test hook `bump-plan-version` и не восстанавливает plan version.
- Suite не имеет `afterEach`/`afterAll` cleanup.
- `openFirstProjectSchedule` теперь использует `projects[0]`; порядок и содержимое общей БД не принадлежат тесту.
- `assignments` и dependency checks превращают отсутствие fixture в `test.skip`, поэтому зелёный run может не проверить требуемое поведение.
- `workers: 1` уменьшает race внутри run, но не защищает от параллельных lanes/processes или повторного запуска на уже изменённой БД.

## Разбор свежего navigation failure

`projects-navigation-playwright.json` завершился **1 unexpected**. В embedded report: 6 pass, 4 fail (`overview`, `schedule`, `baseline`, `settings`). На runtime этих страниц DeliveryFrame tab links не были доказаны; errors показывали неожиданные counts route href.

Одновременно в worktree появились uncommitted changes, добавляющие `projectId={projectId}` в `overview/schedule/baseline/settings` и ещё две поверхности, а detail selector теперь вызывает `router.push`. Поэтому navigation failure является свежим для запущенного runtime, но **stale для текущего source snapshot**. Нужен безопасный rerun на disposable environment. Нельзя ни закрывать finding, ни объявлять текущий source broken только по этому artifact.

Отдельная проблема самого spec: он проверяет count route href внутри найденного navigation, но не маркирует DeliveryFrame nav стабильным testid/accessible name. При наличии других project links count diagnostics становятся шумными.

## Findings

### HIGH-1 - default Playwright harness может мутировать shared dev DB

Evidence:

- `playwright.config.ts:7-10` fallback на `127.0.0.1:55432/kiss_pm`;
- `playwright.config.ts:32-48` запускает API с этим URL и `reuseExistingServer: !CI`;
- `package.json:21` выполняет `db:migrate && db:seed:dev && playwright test`;
- `scripts/seed-dev.ts` пишет полный tenant/project dataset;
- planning specs содержат apply и bump-version без cleanup.

Impact: тест может изменить общий проект, audit/commit history и plan version; reused server может вообще указывать на DB, не соответствующую command environment. Это блокирует безопасный rerun текущего planning suite.

### HIGH-2 - текущий planning suite даёт нулевой action signal

18/18 failures, из них 13 setup failures и 5 obsolete fixture/selectors. Ни один target assertion не прошёл. Изменённый helper пока без свежего доказательства.

### HIGH-3 - role-action authorization/UX не покрыты

Route matrix полна, action matrix почти полностью missing. PLAN видит write controls, потому что UI не делает permission-aware gating; свежо подтверждён только scenario preview 403 transport. Не проверены:

- hidden/disabled/explicit-denial affordance;
- mutation request status/body;
- unchanged readback после 403;
- reload persistence после allowed action;
- audit/commit evidence;
- cleanup.

### MEDIUM-1 - named personas дают ложную семантику

ENGINEER имеет admin profile; BETA тоже admin другого пустого tenant; GUEST отсутствует. Поэтому текущий `engineer` pass не доказывает PM least privilege, а `beta` empty pass не доказывает guest policy.

### MEDIUM-2 - fixtures не владеют данными

First row/`projects[0]`, hardcoded stale id, seed-dependent skips и отсутствие fixture manifest делают tests order-dependent. Existing `@kiss-pm/test-fixtures` создаёт только два domain tenant/user object и не предоставляет DB lifecycle, project factory, roles или cleanup.

### MEDIUM-3 - route-state detector маскирует degraded nested state

PLAN `/scenarios` получает 403 preview, но row проходит как `ready`. Commits/scenario subrequests и late responses не имеют изолированной attribution. Route matrix полезна как shell smoke, но не как content/action contract.

### LOW-1 - action selectors привязаны к исчезнувшим testid/copy

Пять specs используют элементы, которых нет в source; calendars spec ожидает старое имя control. Нужны role/name selectors для user-visible controls и небольшое число стабильных testid только для composite widgets.

## Deterministic disposable fixture proposal

### 1. Fail-closed harness

Добавить один runner `e2e/projects/run-projects-e2e.mts`, который владеет полным lifecycle:

1. Генерирует `runId` и Compose project `kiss-pm-projects-e2e-<runId>`.
2. Поднимает PostgreSQL без shared volume на случайном host port.
3. Создаёт DB с именем `kiss_pm_e2e_projects_<runId>`.
4. Перед любым migrate/seed проверяет:
   - DB name начинается с `kiss_pm_e2e_projects_`;
   - URL не равен `DATABASE_URL`/`TEST_DATABASE_URL` caller environment;
   - host/port не `127.0.0.1:55432/kiss_pm`;
   - Compose project label совпадает с runId.
5. Выполняет migrate и dedicated seed только с локально собранным URL.
6. Запускает API/web на уникальных ports с `reuseExistingServer: false`.
7. Запускает только `e2e/projects/**/*.spec.ts`.
8. В `finally` и handlers `SIGINT/SIGTERM` выполняет `docker compose ... down -v --remove-orphans`.
9. Пишет receipt JSON: runId, DB name, container id, seed hash, Playwright stats, cleanup exit code.

Playwright config для этой suite не должен иметь DB fallback. Отсутствие `E2E_PROJECTS_DATABASE_URL` должно завершать command до старта server/tests.

### 2. Canonical seed manifest

`e2e/projects/fixtures/project-template.ts` должен описывать один детерминированный rich project:

- active project, fixed dates/timezone and at least two projects for selector;
- 12 tasks: summary/child/milestone, manual/auto, complete/in-progress, stable WBS;
- at least 2 dependencies and 3 assignments;
- one overload day and one non-overloaded resource;
- project holiday plus resource absence;
- one baseline with changed and unchanged tasks;
- at least 2 commits, latest one reversible;
- scenario target that produces proposals;
- empty beta tenant and a foreign alpha project id for isolation;
- explicit expected IDs in a generated manifest, never `projects[0]`.

Seed time must be fixed, e.g. `2026-07-10T00:00:00.000Z`. Tests read `fixture-manifest.json`; they do not discover arbitrary shared records.

### 3. Per-test mutation ownership

- Read-only route matrix shares canonical project.
- Every mutating test gets `projectId = e2e-<runId>-<worker>-<testId>-r<retry>` cloned from the canonical recipe before the test.
- Retry receives a new project id, so it never inherits the failed attempt's planVersion/audit state.
- No application-level project delete is required or pretended: project/audit/commit records are disposed with the whole DB.
- A test that claims restore must still assert domain readback; DB disposal is cleanup, not proof that undo worked.
- `test.skip` for missing seeded assignments/dependencies is forbidden. Missing manifest data is fixture failure.

### 4. Persona fixtures

Создать storage states/API clients для:

- `adminAlpha` - full admin;
- `pmAlpha` - explicit least-privilege PM profile, не admin alias;
- `planReaderAlpha` - current PLAN;
- `resourceReaderAlpha` - current RESOURCE;
- `betaAdmin` - full admin другого tenant для empty/isolation;
- `guestAlpha` - настоящий restricted guest, если GUEST является product persona;
- `anonymous` - no state.

Для requested six-column report BETA/GUEST может оставаться одним presentation column, но tests должны хранить двух разных actors. То же относится к ENGINEER/PM: либо переименовать текущего actor в `engineerAdmin`, либо создать настоящий PM profile.

### 5. Mutation oracle

Каждый allowed action test обязан проверять:

1. видимость/enablement control;
2. точный request method/path и `x-kiss-pm-action`;
3. HTTP success и planVersion/audit id;
4. API readback;
5. reload UI readback;
6. audit/commit row, если contract обещает;
7. отсутствие console/page errors.

Каждый denied action test проверяет hidden/disabled либо explicit denial, HTTP 403 body и unchanged API readback. Нельзя считать toast без readback доказательством.

## Exact new spec layout

```text
e2e/projects/
  playwright.projects.config.ts
  run-projects-e2e.mts
  fixtures/
    test.ts                       # test.extend: persona, api, projectFactory, manifest
    personas.ts                   # actors, storage states, expected capabilities
    project-template.ts           # canonical rich/empty/conflict recipes
    seed-projects.ts              # guarded disposable-DB seeder
    assertions.ts                 # settleSurface, request/readback, no-runtime-errors
  routes/
    persona-route-matrix.spec.ts  # 6 columns x 11 routes; ready/403/404/redirect
    projects-list.spec.ts         # list row, keyboard open, empty CTA, retry/error
    project-detail.spec.ts        # selector URL/reload/back, volume/demand
    delivery-navigation.spec.ts   # all 9 tab links, aria-current, direct/reload
  actions/
    overview.spec.ts              # signal links and latest-commits navigation
    schedule.spec.ts              # grid/Gantt/editors/create/edit/delete/batch/undo/conflict
    resources.spec.ts             # matrix/filter/drilldown/task/assignment/overload/absence
    assignments.spec.ts           # add/update/remove, inline work, curve presets/reset
    calendars.spec.ts             # project/resource selection, holiday/absence add/remove
    scenarios.spec.ts             # preview/compare/reason/apply/stale/PLAN denial
    baseline.spec.ts              # capture/history/filter/Schedule link
    commits.spec.ts               # feed/detail/raw/revert-last/revert-selected
    settings.spec.ts              # deadline reason/apply/cancel/Calendar link
    persona-action-matrix.spec.ts # ADMIN/PM allow; PLAN deny; barriers for others
  states/
    projects-states.spec.ts       # loading/empty/403/404/5xx/retry for every surface family
  a11y/
    projects-a11y.spec.ts         # list/detail + each ready delivery composite
```

Ownership rules:

- `persona-route-matrix` read-only, serial only if evidence writer is shared.
- Each file under `actions/` uses its own project factory instance; may run in parallel.
- `persona-action-matrix` uses one disposable project per actor/action and direct unchanged readback.
- JSON/trace output goes under `test-results/projects/<runId>/`, not a shared checked-in filename.
- The old `e2e/planning` files are removed or reduced only after their scenarios are mapped one-for-one to the new files; no silent loss of keyboard/paste/a11y coverage.

## Safe verification plan

No verification command was executed in this lane because the current config is not disposable. После implementation безопасная последовательность должна быть только такой:

```powershell
node e2e/projects/run-projects-e2e.mts --list
node e2e/projects/run-projects-e2e.mts --project chromium --workers 1
node e2e/projects/run-projects-e2e.mts --project chromium --workers 4
```

Runner, а не человек, добавляет isolated DB URL. Прямой `playwright test e2e/planning`, `pnpm test:e2e:smoke`, `db:seed:dev` и DB-config Vitest остаются запрещёнными для shared environment.

## Commands and evidence

Read-only commands used:

```text
codegraph sync
git status --short --branch
CodeGraph: status, context, files, search, explore, node
rg/Get-Content for exact known test/config/surface/evidence paths
git diff -- e2e/planning/planningHelpers.ts
git diff -- relevant Projects surfaces
node -e (read/parse existing JSON artifacts only)
```

Primary artifacts:

- `.superloopy/evidence/projects-2026-07-10/planning-baseline.json`
- `.superloopy/evidence/projects-2026-07-10/projects-role-routes.json`
- `.superloopy/evidence/projects-2026-07-10/projects-role-routes-playwright.json`
- `.superloopy/evidence/projects-2026-07-10/projects-navigation.json`
- `.superloopy/evidence/projects-2026-07-10/projects-navigation-playwright.json`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards.md`
- lane 01 UI inventory; lane 02 API permissions; lane 03 race/idempotency.

## Doubts

1. `BETA/GUEST` и `ENGINEER/PM` в task формулировке могут означать intentional grouped personas. Current seed, однако, не даёт guest или least-privilege PM, поэтому я не переносил admin evidence на эти capability names.
2. Fresh role-route run использовал shared runtime и read-only navigation. Его rows свежие, но DB ownership всё равно отсутствует; данные могли быть изменены другой lane до/во время run.
3. Navigation failure был снят рядом с concurrent source fixes. Без disposable rerun нельзя установить, видел ли Next server последнюю версию каждого surface.
4. Некоторые local UI actions не делают network mutation до Apply. Ledger оценивает target behavior: staged UI и последующий apply должны иметь отдельные assertions.

## Unverified

- Current `planningHelpers.ts` fix не перезапущен.
- Current tab-link source fixes не перезапущены в изолированной среде.
- Ни один Projects mutation не выполнялся этой lane.
- Нет fresh browser evidence allowed/denied actions для PM, PLAN, RESOURCE, GUEST.
- Нет доказательства cleanup shared DB после предыдущих planning/full-eval runs.
- Нет отдельного guest profile или PM profile в dev seed.
- Loading/5xx/retry/commits-subrequest errors на Projects routes не имеют E2E evidence.

## Change index

- Product/test files touched by this lane: **none**.
- Report added: `E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-05-e2e-coverage.md`.
- Symbols added/changed/removed by this lane: **none** (Markdown only).
- Baseline CodeGraph: **2,177 files / 24,140 nodes / 52,020 edges**.
- Final CodeGraph after `codegraph sync`: **2,180 files / 24,189 nodes / 52,080 edges**.
- Delta: **+3 files / +49 nodes / +60 edges**. Этот Markdown не индексируется как source; delta появился из concurrent test/source work других lanes и не приписывается lane 05.

SUPERLOOPY_EVIDENCE: E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-05-e2e-coverage.md
