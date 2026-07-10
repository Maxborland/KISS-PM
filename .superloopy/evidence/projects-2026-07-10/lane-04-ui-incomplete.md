# Lane 04 — skeptical audit of incomplete Projects UI

Дата: 2026-07-10
Репозиторий: `E:\KISS-PM`
Ветка: `codex/pre-prod-hardening-on-master`
Режим: product source read-only; записан только этот отчёт. DB-config tests, seed/reset/migrate и browser flows с мутациями не запускались.

## Вердикт

Projects UI нельзя считать production-complete. Маршруты и большая часть визуальных контролов существуют, но основная governance-гарантия планировщика нарушена: за исключением сценариев UI не вызывает `previewCommand` вообще и сразу отправляет `applyCommand`/`applyCommandBatch`. Это прямо противоречит действующему контракту `docs/31_PHASE_7_PLANNING_WORKSPACE_UI_CONTRACT.md:30-31,418` и UI-design `docs/31_PLANNING_WORKSPACE_UI_DESIGN.md:66,160-173,1178`.

Самые опасные проблемы не декоративны:

1. Клиент генерирует task/assignment/dependency/baseline/calendar-exception IDs модульными счётчиками. После reload, нового tab или второго клиента ID повторяются. `task.create` будет отклонён как duplicate, а `baseline.capture`/upsert-команды способны молча перезаписать существующую сущность.
2. Кнопка `Снять перегруз` отправляет `risk.accept_overload`, то есть принимает риск, а не снимает перегруз.
3. Диалог удаления говорит, что задача будет архивирована, но UI отправляет `mode: "delete"`; для summary ещё и удаляет всё поддерево.
4. Все write controls видимы пользователю с read-only доступом. UI не проверяет `tenant.project_plan.manage`, `tenant.project_resources.manage`, `tenant.project_baselines.manage` и scenario permissions; отказ обнаруживается только после клика.
5. Реализованные ранее Phase C/D функции (Preview/Apply bar, saved views, custom fields, drag-fill, Excel paste, calendar preview, reservation) исчезли из текущего UI, хотя требования и backend-контракты остались.

## Scope

Проверены все 11 product routes под `apps/web/src/app/projects`:

- `/projects`
- `/projects/:id`
- `/projects/:id/{overview,schedule,resources,assignments,calendars,scenarios,baseline,commits,settings}`

Также проверены общие `WorkspaceShell`, `DeliveryFrame`, `GlobalSearch`, `ShellUserMenu`, editor/popover/dialog components, `usePlanning`, planning/workspace clients, current unit/source tests, все 15 файлов `e2e/planning`, git-history удалённого planning UI и нормативные planning docs. Storybook-only `TaskInspector` включён отдельно как Projects-related surface, но помечен unreachable из product routes.

## Метод и команды

Сначала выполнен обязательный CodeGraph entry, затем точечное source/history чтение. Structural discovery через `codegraph_context/files/explore/search`; `rg` использован после этого для literal controls, test IDs, labels и config.

```powershell
codegraph sync
# MCP: codegraph_status, codegraph_context, codegraph_files,
#      codegraph_search, codegraph_explore
git status --short --branch
rg -n '<(button|Button|input|Input|select|Link)...' <Projects UI roots>
rg -n 'demoAction|SurfaceState|await apply|previewScenarios|loadCommits' <Projects UI roots>
rg -n '<all stale data-testid values>' apps/web/src
git log --all -S '<test-id>' -- apps/web/src e2e/planning
git show --stat 5b7cb3e1
node_modules\.bin\vitest.CMD run <six targeted non-DB test files>
```

Первый `pnpm vitest run ...` не дошёл до тестов: pnpm wrapper попытался bootstrap/install и остановился с `ERR_PNPM_IGNORED_BUILDS`. Повтор через существующий локальный `node_modules\.bin\vitest.CMD` прошёл: **6 files, 45 tests passed** (`projects-list`, project action links, schedule rows, overview status, date origin, mock planning backend).

## Severity findings

### CRITICAL-1 — почти все planning mutations обходят обязательный preview

Evidence:

- `usePlanning` реализует `preview()` (`apps/web/src/delivery/lib/use-planning.ts:76-82`), но ни одна delivery surface его не вызывает. Literal search `\bpreview\(` в delivery нашёл только scenario-specific `previewScenarios`.
- `apply()` и `applyBatch()` сразу вызывают apply endpoints (`use-planning.ts:84-134`).
- Schedule прямо вызывает apply после edit/drag/link/delete (`schedule-surface.tsx:371-403,480-640`); Assignments, Calendars, Resources, Baseline и Settings делают то же.
- Prototype note в Schedule утверждает `preview→apply` (`schedule-surface.tsx:770-774`), хотя фактически preview отсутствует.
- Действующий продуктовый контракт требует preview перед существенным изменением (`docs/31_PHASE_7_PLANNING_WORKSPACE_UI_CONTRACT.md:30-31,418`; `docs/31_PLANNING_WORKSPACE_UI_DESIGN.md:66,160-173,1178`).

Impact: пользователь не видит server-authoritative after-state, plan delta, blocking validation, permission verdict и последствия до persistence. Особенно опасны delete subtree, calendar exceptions, assignment reallocation, baseline capture и deadline move.

Classification: **broken**, не «изменённый UX». Старый Preview/Apply UI был удалён в `5b7cb3e1`, но requirement не удалён из docs.

### HIGH-1 — повторяющиеся client IDs ломают create/readback и могут перезаписывать данные

Evidence:

- `schedule-surface.tsx:27-28`: `t-new-1`, `a-new-2`, `dep-new-3`.
- `assignments-surface.tsx:49-50`: `a-n1`.
- `baseline-surface.tsx:26-27`: `baseline-n1`.
- `calendars-surface.tsx:28-29`: `hol-n1`/`ex-n1`.
- `resources-surface.tsx:25-26`: `t-n1`/`a-n2`/`ex-n3`.
- `task.create` rejects an existing id (`packages/domain/src/planning/commandReducer.ts:415-418`).
- `baseline.capture` only checks non-empty id and then `upsertById` (`commandReducer.ts:336-354,587-591`), so a repeated `baseline-n1` replaces the prior snapshot instead of creating history.

Impact: first create may work, next browser lifecycle can fail; concurrent users share the same ID sequence. Baseline history and exception/assignment entities are at risk of silent replacement.

Classification: **broken**.

### HIGH-2 — `Снять перегруз` на деле принимает риск

Evidence:

- UI label: `resource-load-matrix.tsx:484`.
- Callback named `acceptOverload` sends `risk.accept_overload` with reason `Подтверждено на ресурсной матрице` (`resources-surface.tsx:93-96`).
- Command semantics are accepted risk, not reassignment/reschedule (`planningCommands.ts:126-129`).

Expected: either label `Принять перегруз как риск` with explicit confirmation/reason, or a real solver/reassignment action that removes overload. Actual copy promises the opposite result.

Classification: **broken** and materially misleading.

### HIGH-3 — delete confirmation promises archive but executes hard delete

Evidence:

- Dialog copy: `Задача будет архивирована` (`schedule-surface.tsx:1056-1060`).
- Leaf sends `mode: "delete"`; summary sends a batch deleting every descendant (`schedule-surface.tsx:530-549`).
- The same dialog says rollback is unavailable; toolbar undo is enabled after commits even when inverse commands cannot be built.

Impact: user consents to a reversible-sounding archive and receives hard removal, potentially of a whole subtree.

Classification: **broken**.

### HIGH-4 — write controls ignore exposed permission model

Evidence:

- Shell visibility only checks broad nav permissions (`workspace-shell.tsx:18-30,73-83`).
- Delivery surfaces do not read session permissions and enable writes whenever local `busy` is false.
- Backend maps baseline, assignment/resource and plan commands to distinct policies (`apps/api/src/planning/planningCommandPermissions.ts:10-30`); permission strings are `tenant.project_plan.manage`, `tenant.project_baselines.manage`, `tenant.project_resources.manage` (`packages/access-control/src/index.ts:35-39,147-151`). Scenarios have separate preview/apply permissions in the product contract.

Impact: read-only users see authoritative-looking edit/delete/apply actions and learn about denial only after input and submission. This is a fake affordance for that role and loses drafts in several modals.

Classification: **incomplete** across every planning write family.

### HIGH-5 — no plan realtime/readback subscription and weak conflict UX

Evidence:

- `@kiss-pm/planning-client` exports `subscribeToPlanEvents`, but no web delivery code imports it.
- `usePlanning` loads once on mount and reloads only on explicit retry or version conflict (`use-planning.ts:53-74,93-105,119-133`).
- Conflict feedback is a transient toast; current `planning-conflict-banner` does not exist.
- Phase C explicitly requires `SSE realtime planVersionChanged` (`docs/12_ФАЗОВЫЙ_ПЛАН.md:91`).

Impact: one user keeps stale tasks/load/commits after another user writes. The stale state becomes visible only on the next mutation, when the current edit can be discarded by reload.

Classification: **incomplete/regression risk**.

### HIGH-6 — calendar and assignment views invent 5×8 behavior

Evidence:

- Calendar fallback fabricates `cal-5x8` if the read model has no calendar (`calendars-surface.tsx:41-45`) and leaves mutation controls active. A live server can reject this unknown ID.
- Calendar badges/cells/legend hardcode `Пн–Пт`, `8 ч/день`, `8 ч` (`calendars-surface.tsx:221-245`) even though `PlanCalendar.workingWeekdays` and `workingMinutesPerDay` are dynamic.
- Assignments uses `calendars[0]`, not `project.calendarId`, and hardcoded Monday-Friday (`assignments-surface.tsx:90-102`). Presets can therefore allocate on a non-working project day or ignore a valid working weekend.
- Resource absence calculation always skips Saturday/Sunday instead of consulting the selected calendar's `workingWeekdays` (`resources-surface.tsx:134-142`).

Classification: **broken** for non-5×8 or missing-calendar plans.

### HIGH-7 — Phase C/D capabilities were deleted without requirement removal

Commit `5b7cb3e1` removed the old planning workspace, including `PreviewApplyBar`, `SavedViewsDropdown`, custom field definitions, calendar preview, drag-fill/clipboard/grid hooks and day drawer. Current backend/domain still exposes `project.settings.update`, `resource.reserve`, `task.update_custom_field`, saved-view routes and command preview. Current docs still list these as Phase C/D scope (`docs/12_ФАЗОВЫЙ_ПЛАН.md:91,99`).

Missing today:

- Preview/Apply bar.
- Saved WBS views (backend repository/routes remain).
- Project custom field definitions surface.
- Calendar selection + impact preview (`project.settings.update` exists at `planningCommands.ts:130-134`).
- Resource reservation (`resource.reserve` exists at `planningCommands.ts:115-125`; `ReserveDialog` exists but is never mounted).
- Excel TSV paste, drag-fill, multi-select and documented keyboard undo.

Classification: **regression risk**. No ADR/product decision was found that removes these requirements.

### HIGH-8 — `Сделать вехой` changes presentation, not scheduling semantics

Evidence:

- Context menu sends only `task.update_custom_field(kind="milestone")` (`schedule-surface.tsx:527-529`).
- It does not zero work/duration or introduce a milestone command; scheduler still sees the prior duration/work.
- UI then renders the row as a milestone and excludes it from some overview/settings aggregates (`schedule-rows.ts`, `overview-surface.tsx:58-61`, `settings-surface.tsx:63-70`).

Impact: visual milestone and server schedule/critical path can disagree.

Classification: **broken** until domain semantics are explicit and atomic.

### MEDIUM-1 — secondary fetch failures masquerade as empty data

- Commits route: `loadCommits().then(...)` has no loading/error/catch; `data === null` renders `История пуста` and enables top-level revert (`commits-surface.tsx:38-41,61-64,96,132`).
- Overview repeats the same uncaught subload and renders no commits (`overview-surface.tsx:48-51,219-230`).
- Resource directory catches every live error and returns `[]`; hook exposes no status/error/retry (`planning-client.ts:108-124`; `use-resource-directory.ts:19-51`). Resource pickers then look like legitimately empty directories.
- Project title fetch swallows failure and leaves generic `Проект` (`project-chrome.ts:40-59`).
- Project-detail project-list failure is not surfaced separately; selector can show only raw current ID.

Classification: **broken loading/error/empty distinction**.

### MEDIUM-2 — task/resource forms validate too little and close before server verdict

- `TaskModal` checks only non-empty title, while inline creation knows the domain minimum is 3; no max-length feedback (`schedule-editors.tsx:241-245,258-277`). Parent closes modal before `runBatch` returns (`schedule-surface.tsx:593-614`; same pattern in `resources-surface.tsx:105-132`).
- Assignment number fields accept NaN/unbounded units and apply on blur (`assignments-surface.tsx:334-339`).
- Resource assignment-hours editor applies on both Enter and blur, has no finite/non-negative check (`resource-load-matrix.tsx:511-513`).
- Absence dialog silently does nothing for invalid ranges and shows no field error (`resources-editors.tsx:72-105`).
- Deadline reason only checks non-empty; no server-rule preview or retained draft on reject (`settings-surface.tsx:97-113,164-181`).

Classification: **incomplete**.

### MEDIUM-3 — scenario edge states are inconsistent with live contract

- Accepted overload filtering depends on mock-only `resourceLoad.acceptedOverloads`; canonical live `ResourceLoadMatrix` does not guarantee it (`scenarios-surface.tsx:55-68`). A just-accepted overload may be offered again.
- A successful preview returning zero proposals renders a blank list with no empty explanation (`scenarios-surface.tsx:80-86,189-279`).
- `finishDelta` maps null dates to day zero, producing nonsensical deltas when base/proposal finish is absent (`scenarios-surface.tsx:114-120`).

Classification: **broken/incomplete**.

### MEDIUM-4 — hardcoded `Baseline B2` becomes false after capture

Schedule bar tooltip and legend always say `Baseline B2` (`schedule-surface.tsx:941,1044`) while Baseline surface can capture B3/B4/custom labels and comparison uses latest baseline.

Classification: **broken label**.

### MEDIUM-5 — logout redirects even when logout failed

`useAuth.logout()` resolves an `AuthMutationResult`, including `{ok:false}`; `ShellUserMenu.doLogout` ignores the result and always redirects to `/login` (`shell-user-menu.tsx:36-42`; `use-auth.ts:127-133`). The session can remain valid, producing confusing redirect/bounce behavior with no error.

Classification: **broken** shared Projects chrome control.

### LOW/MEDIUM — additional incomplete affordances and state gaps

- `DeliveryFrame` can show static `Сохранено` solely from prototype flag, unrelated to dirty/busy/error (`delivery-frame.tsx:127-132`).
- Overview control-points and key-tasks cards can be blank without empty copy; Assignments has no top-level empty state for zero tasks.
- Settings says project access is managed in `Доступ`, but provides no link (`settings-surface.tsx:197-203`).
- Settings says scheduling mode changes in Graph/Inspector, but current UI only displays mode; no command/control changes it (`settings-surface.tsx:188-195`; schedule `ModeChip` is read-only).
- Integrations buttons are disabled via `demoAction` and therefore honest, but remain incomplete. MSPDI simultaneously says `не планируется` and displays an `Импорт MSPDI` button (`settings-surface.tsx:205-220`).
- Storybook-only `TaskInspector` has four clickable tabs, but `Файлы`, `Встречи`, `Аудит` only switch to roadmap text. Back/open/delete and attachment/mention/emoji buttons are disabled `demoAction`. No product route imports this surface; it is not a production task inspector (`task-inspector-surface.tsx:51-52,76-171,268-327,602-637`).

## Interactive control ledger

Legend:

- **real/pass** — source-level route/handler is wired and behavior matches label; not a claim of live DB execution.
- **broken** — action/state contradicts label/contract or fails for a supported state.
- **incomplete** — partial/honestly disabled, missing preview/permission/error/readback, or required capability absent.
- **unverified** — source trace exists, but runtime behavior cannot be established without prohibited live mutation/browser/DB tests.

Every interactive control family found in scoped source is classified below. Repeated dynamic instances (one per project/task/day/resource/commit) are one family.

| Surface | Control family | Class | Evidence / note |
|---|---|---:|---|
| Shared shell | Desktop nav links | real/pass | Real routes; permission-filtered (`workspace-shell.tsx:18-30,48-58`). |
| Shared shell | Mobile open/close/backdrop/Escape/focus trap | real/pass | `workspace-shell.tsx:84-133,137-177`. |
| Shared shell | Global search input, arrows, Enter, result buttons | real/pass | GET search + `router.push`; explicit loading/empty/error (`global-search.tsx:39-160`). Runtime results unverified. |
| Shared shell | Avatar toggle/backdrop/Profile/Settings | real/pass | Real links and local menu state (`shell-user-menu.tsx:44-80`). |
| Shared shell | Logout | broken | Ignores `{ok:false}` and redirects (`shell-user-menu.tsx:36-42,81-89`). |
| DeliveryFrame | Nine project tabs | real/pass | All product routes pass `projectId`; links map to existing pages (`delivery-frame.tsx:20-35,103-126`). |
| DeliveryFrame | Static `Сохранено` prototype indicator | incomplete | Feature flag, not mutation state (`delivery-frame.tsx:127-132`). |
| `/projects` | Project row click/Enter | real/pass | Navigates to `/overview` (`projects-list-surface.tsx:170-180`). |
| `/projects` | Empty CTA `К сделкам` | real/pass | Real `/crm/deals` link (`projects-list-surface.tsx:119-126`). |
| `/projects` | Retry in error state | real/pass | `SurfaceState` → `reload` (`projects-list-surface.tsx:113-130`). |
| `/projects/:id` | Project selector | real/pass | Reloads selected project and updates URL when route-backed (`project-detail-surface.tsx:82-108,166-193`). Project-list suberror remains hidden. |
| `/projects/:id` | Summary segmented `Объём/Спрос` | real/pass | Pure local view switch (`project-detail-surface.tsx:335-404`). |
| `/projects/:id` | Retry | real/pass | Main detail error reload (`project-detail-surface.tsx:132-144`). |
| Overview | Signal action links and `Все` commits | real/pass | All target existing delivery routes (`overview-surface.tsx:107-113,157-173,216-232`). |
| Overview | Latest commits subload | broken | Failure becomes empty/unhandled rejection (`overview-surface.tsx:48-51,219-230`). |
| Schedule | Create task/subtask modal | incomplete | Real batch apply, but no preview, permission gating, robust IDs, or 3..160 inline validation; draft closes before verdict. |
| Schedule | Indent/outdent toolbar + row menu | incomplete | Real `task.move_wbs`; direct apply without preview/permission. |
| Schedule | Batch mode toggle, discard, apply | incomplete | Real batching, but direct apply; can toggle mode with staged edits; failed batch clears staged commands before result (`schedule-surface.tsx:320-350,758,1027-1035`). |
| Schedule | Undo toolbar | incomplete | In-session only; enabled after non-reversible commits and then errors; no documented keyboard shortcut (`schedule-surface.tsx:351-369,759`). |
| Schedule | Baseline link | real/pass | Existing route (`schedule-surface.tsx:760`). |
| Schedule | Day/week/month zoom | real/pass | Pure view state (`schedule-surface.tsx:761-767`). |
| Schedule | Column resize handles | real/pass | Local view-only gesture; persistence not implied (`schedule-surface.tsx:279-286,799-813`). |
| Schedule | Row select/side inspector + close | real/pass | Local view (`schedule-surface.tsx:478,831,988-1024`). |
| Schedule | Summary expand/collapse | real/pass | Local view (`schedule-surface.tsx:436-447,837-840`). |
| Schedule | Inline name/duration/work/progress edits | incomplete | Real commands, local validation partial, no preview/permission; invalid values often silently cancel (`schedule-surface.tsx:672-714,844-856`). |
| Schedule | Start/finish date popovers | incomplete | Real commands; no preview; copy claims recalculation before server verdict (`schedule-editors.tsx:20-47`). |
| Schedule | Resource picker | incomplete | Real assignment upsert; directory error looks empty; no preview/permission (`schedule-editors.tsx:50-77`). |
| Schedule | Dependency add/remove/type/lag editors | incomplete | Real commands; weak numeric validation, no preview/permission (`schedule-editors.tsx:79-170`). |
| Schedule | Gantt move/resize/progress/link gestures | incomplete | Real commands; direct persistence on pointer-up, no accessible keyboard equivalent/preview (`schedule-surface.tsx:220-308,730-746,942-954`). |
| Schedule | Inline quick-create Enter/Tab/Esc | incomplete | Real command and min-3 validation, but deterministic IDs and no preview (`schedule-surface.tsx:616-670,872-912`). |
| Schedule | Row-menu open/edit/create/indent/outdent | incomplete | Handlers real; write actions share governance gaps (`schedule-editors.tsx:174-224`). |
| Schedule | `Сделать вехой` | broken | Visual custom field only; schedule semantics remain task-like. |
| Schedule | Delete + confirmation | broken | Copy says archive, command hard-deletes subtree (`schedule-surface.tsx:530-549,1051-1067`). |
| Schedule | Baseline overlay/legend | broken | Static `B2` regardless active baseline (`schedule-surface.tsx:941,1044`). |
| Resources | Create/edit task modal | incomplete | Real applyBatch, but ID/validation/preview/permission gaps (`resources-surface.tsx:84-132`). |
| Resources | Matrix collapse rows, cell select, drawer close | real/pass | Pure view/drilldown (`resource-load-matrix.tsx:308-363,478`). |
| Resources | Filters, sort, overload-only, hide-idle | real/pass | Local view state (`resource-load-matrix.tsx:385-405`). |
| Resources | Month and day/week/month controls | real/pass | Local view state (`resource-load-matrix.tsx:408-415`). |
| Resources | Team/role/project selects | real/pass | Local filters; cross-project navigation itself is not provided. |
| Resources | Absence dialog + type/date/submit | incomplete | Real calendar batch; silent validation, wrong calendar assumptions, duplicate IDs, no preview/permission. |
| Resources | `Снять перегруз` | broken | Actually `risk.accept_overload`. |
| Resources | Edit task from drawer | incomplete | Opens real modal; inherits form/governance gaps. |
| Resources | Inline assignment-hours edit | incomplete | Real upsert; no finite/min validation and Enter+blur can submit twice. |
| Resources | `ReserveDialog` | incomplete | Implemented but unreachable; no trigger on product Resources surface. |
| Assignments | Month prev/next and day/week | real/pass | Local view state (`assignments-surface.tsx:220-227`). |
| Assignments | Task `+` / AddAssignee dialog | incomplete | Real upsert, but duplicate IDs, hidden directory errors, no preview/permission (`assignments-surface.tsx:255-256`; `assignments-editors.tsx:47-81`). |
| Assignments | Assignment row select + inspector close | real/pass | Local view (`assignments-surface.tsx:266,319`). |
| Assignments | Resource/role/unit/work editors | incomplete | Immediate apply/onBlur, weak numbers, no preview/permission, calendar mismatch (`assignments-surface.tsx:323-340`). |
| Assignments | Curve presets/reset/manual inputs/apply/cancel | incomplete | Real allocation command and inline sum error; no preview/permission; hardcoded workweek (`assignments-surface.tsx:343-372`). |
| Assignments | Remove assignee + confirmation | incomplete | Real delete, no preview/permission; deterministic IDs affect add/readback. |
| Calendars | Project/resource selector | real/pass | Local view (`calendars-surface.tsx:187-210`). |
| Calendars | Month prev/next | real/pass | Local view (`calendars-surface.tsx:213-240`). |
| Calendars | Day toggle | broken | Real command, but fabricated calendar fallback, fixed 5×8 labels, duplicate IDs, no preview/permission. |
| Calendars | Exception/absence dialog | incomplete | Real batch, weak/silent validation, no preview/permission (`calendars-surface.tsx:144-158,173-176`). |
| Calendars | Remove exception | incomplete | Real upsert-to-full; no preview/permission (`calendars-surface.tsx:142,254-260`). |
| Calendars | `Открыть График` | real/pass | Existing route (`calendars-surface.tsx:264-269`). |
| Scenarios | Target select and refresh preview | real/pass | Uses scenario preview endpoint (`scenarios-surface.tsx:78-93,155,177-186`). Empty-proposal state broken. |
| Scenarios | Compare/show/hide/close | real/pass | Local preview view (`scenarios-surface.tsx:221,235-274`). |
| Scenarios | Risk reason input | real/pass | Required inline error for accepted-risk profile (`scenarios-surface.tsx:130-143,226-233`). |
| Scenarios | Apply scenario | incomplete | Correct preview/apply family, but permission visibility absent and live accepted-overload readback depends on mock-only field. |
| Baseline | Schedule link | real/pass | Existing route (`baseline-surface.tsx:101`). |
| Baseline | Capture open/input/cancel/confirm | broken | Real apply, but repeatable ID can overwrite history; no preview/permission (`baseline-surface.tsx:79-85,102-108`). |
| Baseline | `Только изменённые` | real/pass | Local filter (`baseline-surface.tsx:155-159`). |
| Commits | Commit row selection | real/pass | Local detail selection (`commits-surface.tsx:110-131`). |
| Commits | Initial commits load/empty | broken | No subloading/error/catch; failure shown as empty (`commits-surface.tsx:38-41,61-64,132`). |
| Commits | `Откатить последний` | incomplete | Real server call, but visible without permission, no confirmation/preview, enabled before commits subload (`commits-surface.tsx:78-96`). Runtime persistence unverified. |
| Commits | Inline row `Откатить` span | broken | Click-only nested `span`, no keyboard semantics; same governance gap (`commits-surface.tsx:123-126`). |
| Commits | Detail `Откатить коммит` | incomplete | Only latest client-held inverse; no preview/permission (`commits-surface.tsx:159-161`). |
| Settings | Calendar link | real/pass | Existing calendars route (`settings-surface.tsx:137-147`). |
| Settings | Deadline edit/date/reason/apply/cancel | incomplete | Real command with basic reason gate; no preview/permission, draft closes only on success but no rich validation (`settings-surface.tsx:97-113,164-181`). |
| Settings | Calendar change/preview | incomplete | No control although command/backend and stale e2e exist; field explicitly read-only. |
| Settings | Project access | incomplete | Informational text only; missing `Доступ` link/action (`settings-surface.tsx:197-203`). |
| Settings | Bitrix24/MSPDI buttons | incomplete | Truthfully disabled `demoAction`; MSPDI copy/button conflict (`settings-surface.tsx:205-220`). |
| Story TaskInspector | Entire surface | unverified | Storybook-only, fixed `MOCK_PROJECT_ID`, no product route/import (`task-inspector-surface.tsx:76-77`). |
| Story TaskInspector | Back/open/delete | incomplete | Truthfully disabled `demoAction` (`task-inspector-surface.tsx:150-172`). |
| Story TaskInspector | Chat tab/send/edit/pin/delete/reactions | unverified | Source-wired to communications mock/live seam, but not reachable in Projects product routes. |
| Story TaskInspector | Files/Meetings/Audit tabs | incomplete | Clickable placeholder-only tabs (`task-inspector-surface.tsx:268-327`). |
| Story TaskInspector | Attachment/mention/composer emoji | incomplete | Truthfully disabled `demoAction` (`task-inspector-surface.tsx:602-637`). |

## Stale e2e reconciliation

Literal search confirmed: **none of the 20 `data-testid` values referenced by `e2e/planning` exists anywhere in current `apps/web/src`**. The tests were added with the old PlanningWorkspace and left behind when `5b7cb3e1` deleted that implementation. Classification below is per obsolete assertion/interaction, not merely per file.

Definitions:

- **invalid test** — equivalent current behavior exists, but selector/fixture/control shape is obsolete.
- **regression risk** — asserted capability is absent or materially weaker, while docs/backend/history still require/support it.
- **removed requirement** — current source/docs explicitly reject the behavior as no longer required. **No assertion met this bar.** Deferral text is not requirement removal.

| Spec:line/assertion | Classification | Reconciliation |
|---|---|---|
| `assignments.spec.ts:11-12` `planning-assignments-pane` + first input | invalid test | Assignments matrix exists, but no pane testid and inputs appear only after selecting an assignment. |
| `assignments.spec.ts:13-15` edit → `planning-apply-bar` | regression risk | Editing exists but immediately applies; Preview/Apply bar is missing against active contract. |
| `calendars.spec.ts:11-13` `Добавить исключение`, named date input, `Превью` | invalid test | Current flow uses project day toggle or resource `Исключение` dialog; old labels/form shape are gone. |
| `calendars.spec.ts:14` `planning-apply-bar` visible | regression risk | Calendar writes now apply directly; required preview was not restored. |
| `compensating-undo.spec.ts:12-18` WBS/F2/`Применить`/saved text | invalid test | Current WBS edits use double-click/inline inputs and direct commits; old selectors/copy invalid. |
| `compensating-undo.spec.ts:19-20` `Ctrl+Shift+Z` undo | regression risk | Current undo is toolbar-only and session-limited; shortcut handler absent. Phase C still calls for compensating undo. |
| `cross-project-drilldown.spec.ts:13` hardcoded `project-alpha` | invalid test | Fixture should discover an active project (as updated helper now does). |
| `cross-project-drilldown.spec.ts:14-17` resource cell + day drawer testids | invalid test | Current matrix cell opens an inline right drawer, but both testids were removed. Cross-project routing itself remains incomplete. |
| `custom-fields.spec.ts:13-16` definitions-or-empty | regression risk | Project settings exposes no custom-field definitions despite Phase D/backend support. |
| `drag-fill-dates.spec.ts:12-24` grid/handle interaction | regression risk | No drag-fill handle or keyboard fill implementation exists now. |
| `drag-fill-dates.spec.ts:25-26` filled date readback | regression risk | Capability absent, not just selector drift. |
| `excel-paste-10x6.spec.ts:15-20` clipboard paste + 10 rows | regression risk | Current schedule has no clipboard paste handler; Phase C/design still specifies TSV paste. |
| `keyboard-only-10-tasks.spec.ts:12-21` Insert/F2 flow + 10 rows | invalid test | Exact shortcuts/row-count assumption are obsolete; current bottom inline row supports keyboard Enter/Tab creation. A replacement test is still required. |
| `planning-a11y.spec.ts:13-17` axe include `planning-workspace` | invalid test | Selector deleted; a11y requirement remains, test executes against no current target. |
| `planning-a11y.spec.ts:21-26` axe include `planning-gantt-pane` | invalid test | Same: current Gantt exists without selector. |
| `planning-grid.spec.ts:12-14` schedule/WBS/Gantt pane testids | invalid test | All three visible regions exist under new DOM. |
| `planning-grid.spec.ts:19-28` bar + combobox zoom + left changes | invalid test | Current bars and zoom exist, but zoom is segmented buttons and bars have no testid. |
| `planning-grid.spec.ts:33-40` dependency path testid + `d` | invalid test | Current dependencies are SVG `polyline`, not old path/testid. Capability exists. |
| `planning-grid.spec.ts:48-56` test version bump hook | invalid test | Hook/client still exists, but test fixture/control sequence targets old workspace. |
| `planning-grid.spec.ts:58-62` persistent conflict banner | regression risk | Current UI only emits a toast/reloads on write conflict; no banner exists. |
| `resource-matrix.spec.ts:13` hardcoded `project-alpha` | invalid test | Must discover current project. |
| `resource-matrix.spec.ts:14-15` matrix + nav testids | invalid test | Matrix/month navigation exist; selectors were removed. |
| `resources.spec.ts:11` `planning-resources-pane` | invalid test | Resources surface exists without this testid. |
| `saved-views.spec.ts:13-14` dropdown | regression risk | Saved-view UI absent while persistence/API and Phase D requirement remain. |
| `settings.spec.ts:13` hardcoded `project-alpha` | invalid test | Must discover active project. |
| `settings.spec.ts:14` `planning-settings-pane` | invalid test | Settings surface exists without this testid. |
| `settings.spec.ts:15-17` calendar select/option/preview summary | regression risk | Current calendar is read-only; `project.settings.update` and old requirement remain. |

Summary: **0 removed requirement**, **17 invalid-test rows**, **10 regression-risk rows**. Some spec flows contain both because their surface still exists but a substantive capability (usually preview) disappeared.

## Persistence/readback assessment

Source-level positive evidence:

- Production route pages wrap workspace/planning surfaces with `live` providers.
- `apply`/`applyBatch` replace local state with the authoritative `res.readModel` and carry `clientPlanVersion` (`use-planning.ts:84-134`).
- Version conflict triggers reload.
- Successful scenario apply returns and installs server read model.
- Targeted non-DB mock tests passed, including command/read-model behavior.

Gaps:

- No command-preview stage outside Scenarios.
- No SSE subscription/reload on another user's write.
- No fresh GET after successful apply; UI trusts response read model. This is acceptable only if API transaction/response is authoritative, but restart/tab readback was not browser-verified here.
- Generated IDs are not durable/global.
- Secondary commits/resource/title requests lack proper state/readback handling.
- Existing e2e tests do not prove current persistence because their selectors all miss current DOM.

## Doubts and concurrent-work note

- The worktree was already dirty and changed by other agents. In particular, Projects/delivery files and `e2e/planning/planningHelpers.ts` were modified before/during this lane. Findings refer to the file contents read immediately before report assembly; no foreign change was reverted.
- The current project-selector URL sync and delivery `projectId` tab wiring appear to be recent parallel fixes; older lane evidence in the same directory may describe the pre-fix state. This report intentionally follows current source.
- `task.delete_or_archive` has two modes, but current reducer behavior and UI copy do not establish a recoverable archive surface. The skeptical conclusion is based on the actual `mode:"delete"` sent by UI.
- A source-wired control is not automatically runtime-pass. DB-backed persistence, RBAC role matrix and browser geometry need a safe isolated environment.
- No evidence was found that product owners formally removed any stale e2e requirement. Therefore disappearance in `5b7cb3e1` is classified as regression risk, not accepted scope reduction.

## Unverified

- Live browser render, responsive/visual overlap, focus behavior and screen-reader output.
- Any DB-backed mutation, reload-after-write, cross-tab/session persistence or multi-user concurrency.
- Role-by-role runtime behavior against real access profiles.
- Search result routes returned by the live database.
- Scenario apply/readback and server-side accepted-risk projection.
- Revert-last behavior against persisted audit history.
- Storybook-only TaskInspector communications actions.

These remain unverified because the assignment explicitly prohibited DB-config tests and any command/browser flow that could mutate the shared database. No E2E was run.

## Verification results

```text
CodeGraph initial: 2177 files, 24140 nodes, 52020 edges
CodeGraph final:   2180 files, 24189 nodes, 52080 edges
Literal stale test IDs: 20/20 missing from apps/web/src
Targeted non-DB Vitest: 6 files passed, 45 tests passed
Product files edited by this lane: 0
DB tests/migrations/seeds/resets: 0
Browser mutation flows: 0
```

## Change index

Only this report was added:

- `.superloopy/evidence/projects-2026-07-10/lane-04-ui-incomplete.md`

No source symbol was added/changed/removed by this lane. Final CodeGraph sync completed successfully. The graph changed `2177→2180 files`, `24140→24189 nodes`, `52020→52080 edges` while the lane was running; this reflects concurrent external source edits (the Markdown report itself is not indexed as a source-symbol node), not product edits by this lane.

SUPERLOOPY_EVIDENCE: E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-04-ui-incomplete.md
