# Schedule browser QA lane

Дата: `2026-07-10`
Рабочая копия: `E:\KISS-PM`
Поверхность: `/projects/:id/schedule`
Режим: browser QA, без product/test/matrix edits и без planning mutation-запросов.

## Findings

### MEDIUM — not-found Schedule оставляет убедительный, но ложный project shell

Свежий live traversal под `admin` открыл
`/projects/project-vektor-portal/schedule` после того, как fixture исчез. Оба source API
вернули `404 project_not_found`, однако UI сохранил:

- заголовок `Проект` с fallback-полями `план`, `Дедлайн —`, `ФИНИШ —`;
- активную вкладку `График`;
- все девять delivery tabs, ведущие на тот же отсутствующий project id.

Error card корректно говорит `Не удалось загрузить` / `Проект не найден`, но окружающий
shell выглядит как существующий проект и предлагает дальнейшую навигацию по мёртвым
маршрутам. Это реальный UI defect, а не только проблема теста.

Fresh screenshot:
`.superloopy/evidence/schedule-closeout-2026-07-10/admin-schedule-initial.png`.

### LOW — Schedule содержит два одинаковых accessible link `Baseline`

На ready Schedule в первом свежем admin traversal строгий locator
`getByRole('link', { name: 'Baseline', exact: true })` получил два совпадения:

1. delivery tab `Baseline`;
2. toolbar button-link `Baseline` внутри Schedule workspace.

Оба ведут на `/projects/project-vektor-portal/baseline`. Дублирование не ломает переход,
но создаёт лишнюю остановку в link navigation/screen reader и неоднозначный accessible
contract. Fresh runner остановился именно на strict-mode violation; это не исторический
вывод.

### HIGH QA blocker — live fixture/auth drift сделал полный свежий role pass невозможным

Сервисы оставались доступны (`web 200`, `API health 200`), но данные менялись во время
lane:

- первый admin browser traversal достиг ready Schedule и успел пройти Home/End, три zoom,
  inspector, открыть/закрыть create dialog и открыть row menu до duplicate-Baseline stop;
- позднее `admin` login остался `200`, но `/api/workspace/projects` стал `200 {projects:[]}`;
- тот же admin получил `404 project_not_found` на project detail и planning read-model;
- `planReader`, `resourceReader`, `beta` стали получать `401 invalid_credentials` на
  `POST /api/auth/login`;
- admin `accessProfileId` изменился с исторического
  `access-profile-alpha-admin` на свежий `access-profile-admin`.

Seed/reset не запускался: это было бы irreversible/out-of-scope вмешательство в общую
среду. Поэтому ниже нет свежих PASS для четырёх ролей. Есть только фактически
выполненные наблюдения и явные `UNVERIFIED`.

## Fresh live evidence

### Service and identity status

| Check | Actual result |
|---|---|
| `GET http://127.0.0.1:3180/login` | `200` |
| `GET http://127.0.0.1:4191/health` | `200`, `{"status":"ok","product":"KISS PM"}` |
| admin login | `200`, `user-alpha-admin`, `tenant-alpha`, `access-profile-admin` |
| admin projects | `200`, `0` projects |
| admin canonical project detail | `404 {"error":"project_not_found"}` |
| admin canonical planning read-model | `404 {"error":"project_not_found"}` |
| planReader login | `401 {"error":"invalid_credentials"}` |
| resourceReader login | `401 {"error":"invalid_credentials"}` |
| beta login | `401 {"error":"invalid_credentials"}` |

### Role traversal verdicts

| Role | Fresh browser traversal | Reload | Back/forward | Current verdict |
|---|---|---|---|---|
| `admin` | Partial ready traversal first; later canonical Schedule rendered 404 error shell | 404 route was reloaded during runner, but final receipt was interrupted by subsequent role login failure | attempted in runner; no complete persisted receipt | `PARTIAL / NOT PASS` |
| `planReader` | Browser login returned `401`, later attempt timed out waiting for auth response | not reached | not reached | `UNVERIFIED_LOGIN_FAILED` |
| `resourceReader` | Browser phase not reachable; direct fresh login probe returned `401` | not reached | not reached | `UNVERIFIED_LOGIN_FAILED` |
| `beta` | Browser phase not reachable; direct fresh login probe returned `401` | not reached | not reached | `UNVERIFIED_LOGIN_FAILED` |

No fresh request with method `POST`/`PATCH`/`DELETE` was sent to a planning/project
mutation endpoint. Auth login was the only POST made by this lane.

### Fresh state coverage

| State | Evidence | Verdict |
|---|---|---|
| ready | reached only in the first partial admin traversal; command later failed on duplicate `Baseline` | observed, not PASS |
| error/404 | fresh admin screenshot plus API `404/404` | observed |
| forbidden | role credentials unavailable before route | unverified fresh |
| empty projects | admin API returned `200/0`; browser screenshot is deep-link 404, not `/projects` empty | API-only fresh |
| loading | synthetic delayed-read-model phase intentionally skipped after fixture vanished | unverified |
| 5xx + Retry recovery | synthetic phase intentionally skipped after fixture vanished | unverified |

## Historical evidence (not fresh lane PASS)

These artifacts were inspected, not rerun. They remain useful historical evidence only.

| Artifact | Timestamp / result | Schedule claim supported |
|---|---|---|
| `projects-role-routes.json` | `2026-07-10T05:25:08.353Z`, 55/55 | admin/planReader ready `200`; resourceReader forbidden `403`; beta foreign project `404` |
| `projects-schedule-write-playwright.json` | start `2026-07-09T23:12:52.052Z`, 2/2 | admin modal create/delete + API readback/reload; planReader controls hidden + direct preview `403` unchanged |
| `schedule-productivity-playwright.json` | start `2026-07-10T04:09:47.558Z`, 4/4 | keyboard create/edit/undo, TSV, date fill, milestone, responsive 390/768/1280, PLAN denial |
| `projects-navigation.json` | `2026-07-10T05:18:46.517Z` | active Schedule tab, 9 tab links, overview/baseline/calendar links, staged navigation guard |
| `qa-schedule-productivity-qa-gate.md` | historical APPROVE | 197 focused tests, 4/4 Playwright, focused DB audit and typechecks |

Historical role-row details for Schedule:

- `admin`: projects `200/3`, project `200`, read-model `200`, UI `ready`;
- `planReader`: projects `200/3`, project/read-model `200`, UI `ready`;
- `resourceReader`: projects `403`, project/read-model `403`, UI `forbidden`;
- `beta`: projects `200/0`, foreign project/read-model `404`, UI detector `error`.

Historical screenshots are under
`.superloopy/evidence/projects-2026-07-10/role-routes/screenshots/*-projects-project-vektor-portal-schedule.png`.

## Current E2E gaps

This is the residual browser gap list after crediting the historical full-eval specs.

### Route and state gaps

1. Fresh role traversal for admin, planReader, resourceReader and beta on the same stable
   fixture is missing.
2. Per-role `reload -> back -> forward` on Schedule is missing. Historical navigation
   proves admin back navigation, not forward and not all roles.
3. Schedule initial loading is never asserted by current E2E.
4. Deterministic read-model `500`, Retry request, and recovery to ready are untested.
5. Timeout/offline/malformed-response UX is untested.
6. Existing project with an empty plan (zero rows) is untested; beta foreign-project 404
   is not an empty-plan scenario.
7. Mixed failures are untested: project metadata succeeds/read-model fails and vice versa.
8. resourceReader forbidden state has historical shell evidence but no reload/history
   evidence and no fresh run.
9. beta has historical empty project list and foreign-project 404, but no own-project
   Schedule fixture.
10. Mobile/tablet behavior is historical only for admin; read-only and denied roles at
    390/768 are untested.
11. Current Schedule a11y has no valid E2E. `e2e/planning/planning-a11y.spec.ts` targets
    removed `planning-*` testids and its last baseline failed before target assertions.
12. Console errors, page errors and failed nested resource-directory requests are not
    asserted by the green Schedule specs.

### Read interaction gaps

1. Zoom buttons exist, but current green evidence does not assert day/week/month geometry
   changes. The old zoom spec targets removed testids.
2. Summary collapse/expand and focus restoration are untested.
3. Inspector open/close and displayed facts are not asserted; inspector `Единицы` editing
   is also untested.
4. Column resizing and persistence/reset behavior are untested.
5. Internal horizontal/vertical grid scrolling and sticky WBS/Gantt alignment are untested.
6. Dependency connector rendering/labels are not current E2E evidence; the old test can
   skip when seed dependencies are absent.
7. planReader read affordances (zoom, selection, inspector, collapse, Baseline navigation)
   are not explicitly exercised, only write-control absence is.
8. Resource-id fallback masking for planReader without resource directory access is not
   asserted in browser evidence.

### Write/action gaps

1. `Подзадача` toolbar modal and parent/WBS readback are untested.
2. Row-menu `Создать подзадачу` and `Создать задачу рядом` are untested.
3. Toolbar and row-menu indent/outdent, disabled boundaries, WBS/summary rollup and reload
   are untested.
4. Task modal fields other than title (assignee, start, duration, work, progress), edit
   mode, validation and cancel are untested.
5. Bottom/inline quick-create `Tab` child creation, `Esc`, too-short title and focus loop
   are untested. Historical keyboard E2E covers Enter/F2/Home/End/ArrowDown, not these.
6. Cell editors for duration, work and percent, including Tab traversal and invalid
   values, are untested; only name edit through F2 is covered.
7. Direct start/finish date pickers are untested.
8. Schedule resource assignment picker is untested. Milestone setup assigns through API,
   not this UI.
9. Dependency add/remove, type/lag editing and connector-click editor are untested.
10. Gantt bar move, left/right resize, progress drag and dependency-link drag are untested.
11. Manual batch `Применить пакетом` and `Сбросить` are untested. Navigation evidence only
    stages a task and accepts/discards navigation confirmation.
12. Preview dialog cancel and close are untested; apply success is covered.
13. Apply failure after successful preview, 500/timeout retry and double-submit/busy UX are
    untested. Stale preview `409` is covered.
14. TSV malformed rows, invalid dates/numbers, >6 columns, >200 rows, empty clipboard and
    toolbar clipboard-permission failure are unit-covered at best, not E2E.
15. Date fill `Одинаковая дата`, select-all, cancel and validation-error paths are untested;
    sequential drag/checkbox success and stale conflict are covered.
16. Delete cascade for summary/parent tasks and cancel deletion are untested; single task
    create/delete is covered.
17. Milestone disabled states and any conversion back to task are untested; one-way task
    -> milestone is covered.
18. Browser reload/close with staged batch changes is untested. Tab/sidebar/back guard is
    covered historically.
19. Direct server-side mutation denial is historical only for planReader. resourceReader
    and beta are stopped at route/fixture barriers; their planning endpoints are not
    independently probed unchanged.

## Exact commands

```powershell
codegraph sync

$web = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3180/login' -TimeoutSec 5; $api = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4191/health' -TimeoutSec 5; [pscustomobject]@{ webStatus=$web.StatusCode; webUrl=$web.BaseResponse.ResponseUri.AbsoluteUri; apiStatus=$api.StatusCode; apiBody=$api.Content } | ConvertTo-Json -Compress

Get-Command npx | Select-Object -ExpandProperty Source

node .superloopy/evidence/schedule-closeout-2026-07-10/.lane-browser-run.mjs
```

The last command was repeated after bounded runner diagnostics. Inside the sandbox it
failed with `browserType.launch: spawn EPERM`; the same exact command was then run with
approved local Chromium execution. The temporary runner was deleted before closeout.

Fresh four-role auth probe:

```powershell
$roles = @(@{role='admin';email='admin@kiss-pm.local';password='admin12345'},@{role='planReader';email='plan-reader-no-resources@kiss-pm.local';password='reader12345'},@{role='resourceReader';email='resource-reader@kiss-pm.local';password='resource12345'},@{role='beta';email='beta@kiss-pm.local';password='beta12345'}); $out = foreach ($role in $roles) { $body = @{email=$role.email;password=$role.password} | ConvertTo-Json -Compress; $response = Invoke-WebRequest -UseBasicParsing -SkipHttpErrorCheck -Method Post -Uri 'http://127.0.0.1:4191/api/auth/login' -ContentType 'application/json' -Body $body -TimeoutSec 10; [pscustomobject]@{role=$role.role;status=$response.StatusCode;body=$response.Content} }; $out | ConvertTo-Json -Depth 5
```

Fresh admin source-status probe used one `WebRequestSession`, then issued:

```text
POST http://127.0.0.1:4191/api/auth/login
GET  http://127.0.0.1:4191/api/workspace/projects
GET  http://127.0.0.1:4191/api/workspace/projects/project-vektor-portal
GET  http://127.0.0.1:4191/api/workspace/projects/project-vektor-portal/planning/read-model
```

## Unverified reasons

- Shared runtime fixture changed during the lane; no seed/reset was performed.
- Three requested credentials became invalid while services stayed healthy.
- Admin tenant had no project, so ready/loading/500-recovery checks could no longer be
  repeated against a real Schedule.
- Browser runner failures are not converted into PASS: strict duplicate link, auth 401,
  auth-response timeout and missing fixture remain explicit evidence gaps.
- Historical Playwright artifacts were not rerun and are labelled historical throughout.

## Change index

- Product/test/matrix files changed by this lane: none.
- Added report: `.superloopy/evidence/schedule-closeout-2026-07-10/lane-browser.md`.
- Added fresh screenshot: `.superloopy/evidence/schedule-closeout-2026-07-10/admin-schedule-initial.png`.
- Symbols added/changed/removed by this lane: none; Markdown/PNG only.
- CodeGraph before report: 2,230 files / 24,880 nodes / 53,270 edges.
- CodeGraph after mandatory closeout sync: 2,229 files / 24,844 nodes / 53,207 edges.
- Delta: -1 file / -36 nodes / -63 edges from concurrent source/test cleanup; this lane
  changed no indexed source symbol, so none of that delta is attributed to this report.

SUPERLOOPY_AUDIT: .superloopy/evidence/schedule-closeout-2026-07-10/lane-browser.md
