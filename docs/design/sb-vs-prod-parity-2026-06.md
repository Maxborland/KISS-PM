# Storybook ↔ прод: сверка фиделити (2026-06-28)

> Переориентирует план `zippy-beaming-rossum.md`: цель = **прод = Storybook (вид + фичи) на реальных данных**.
> Источник: многоагентный source-level аудит 9 поверхностей (workflow `sb-vs-prod-parity`). Не заменяет визуальную сверку скринами — она поверх, после починки Storybook.

# KISS-PM: Storybook → Prod Fidelity Remediation Plan

## 1. Ranked surfaces (worst → best)

| # | Surface | Overall | Blockers | Majors | Minors | Headline |
|---|---------|---------|:--------:|:------:|:------:|----------|
| 1 | `12-project-gantt` | **blocker** | 3 | 9 | 3 | Same grid widget, but no toolbar, EV stats, or WBS hierarchy — flattened to level-0 tasks |
| 2 | `13-project-resources` | **blocker** | 1 | 6 | 3 | The daily capacity heatmap (the whole point) is missing — **though its data is already fetched and discarded** |
| 3 | `09-admin` | major | 1 | 6 | 3 | Security-policies card + invite + per-row actions gone; admin fragmented into 3 routes |
| 4 | `10-settings` | major | 0 | 6 | 4 | Full tabbed settings workspace reduced to a read-only profile/session readout |
| 5 | `06-deal-card` | major | 0 | 5 | 2 | Feed, composer, relations missing; editable Параметры downgraded to read-only FactList |
| 6 | `07b-project-detail` | major | 0 | 5 | 2 | Same as deal-card: no feed/composer/relations/editable params/stage-team header |
| 7 | `07-projects-list` | major | 0 | 5 | 7 | Table works on real data but loses toolbar, create CTA, Ответственный col, semantic status |
| 8 | `05-deals` | major | 0 | 5 | 3 | Funnel data-binding bug (stage name in id slot) + fake owner avatar; no search/create |
| 9 | `02-my-work` | major | 0 | 2 | 4 | Near parity — but every kanban card has a hardcoded fake "ИИ" avatar and synthetic id |

---

## 2. What to build per surface (blocker/major gaps)

### 1. `12-project-gantt` — worst surface (start here)

The shared Gantt grid widget already supports everything SB shows (summaries, milestones, indentation, collapse, critical bars, today line). The defect is in `toGanttData` (flattens all rows) and the missing toolbar/stats scaffold in `ProjectGanttRuntime`. Split into **shippable-now** vs **needs-backend**.

**Shippable now (data already in `PlanningReadModel.authored`):**
- **Rebuild the WBS tree in `toGanttData`** [partial→ready]: parse the dotted `wbsCode` (1, 1.1, 1.1.1) into parent/child levels instead of hard-coding `level:0, kind:"task"`. Set `level` from dot-depth; mark rows with children as summary (bold + group bar). This kills the biggest blocker (flat list) using data already present.
- **Fix the today line** [ready]: replace the hard-coded `today: index 0` with the real current date mapped onto the day axis.
- **Project Прогресс% stat** [partial]: derive by averaging `tasks.percentComplete` for the Прогресс tile.
- **Реж (mode) column** [ready]: bind `schedulingMode` instead of leaving it derived from nothing.
- **Zoom Segmented (Час/День/Нед/Мес)** [ready/presentational]: add the control to match SB. Note the widget renders a fixed day grid (DAY_W=28, 30 days) and does not react to zoom — SB's zoom is also presentational, so this is a visual-parity add only; flag it as decorative until the grid honors granularity.
- **Client-side Filter button** [partial]: filter the loaded task list in-memory; no backend needed.
- **Toolbar shell** [ready]: render the `role=toolbar` bar above the grid so the structure matches, even if some buttons are disabled pending data (below).

**Needs read-model/API first (see §3):** SPI/CPI stats, add/delete-task command, indent/reparent (outline mutation), link/unlink dependencies, critical-path toggle + red bars, baseline toggle, milestone diamonds.

### 2. `13-project-resources` — highest ROI blocker (the data is already in hand)

Prod already calls `useCapacityTree(monthIso, projectId)` and throws the per-day grid away into a 5-line risk list. **Nearly everything is shippable now.**

- **Build the `ResourceMatrix` heatmap** [ready]: render the 240px name col + % col + 31 day cells from the `CapacityDayCell` records already fetched (`workMinutes`, `capacityMinutes`, `freeMinutes`, `overloadMinutes`, `heat`, `isAbsence`, `isFreeDay`). This single component closes the blocker.
- **3-level collapsible hierarchy** [ready]: `CapacityTreeNode.type` already returns `direction/unit/team/position/employee` + `children` — richer than SB's workshop→role→person. Render with indent levels + collapse toggles.
- **Day-cell states** [partial]: map `heat`→normal/high/over, `isAbsence`→vacation, `isFreeDay`→weekend; **weekend-vs-holiday split** is the only piece that may need the production calendar.
- **5-metric stats strip + load bar** [ready]: `CapacitySummary` exposes `totalCapacityMinutes / totalWorkMinutes / totalFreeMinutes / totalOverloadMinutes / overloadedEmployeeCount` — derive Ёмкость / Назначено / Загрузка% / Свободно / Сотрудников + progress-bar fill.
- **Per-row load %** [ready]: `workMinutes / capacityMinutes`.
- **7-swatch legend** [ready] and **collapse/expand toggles** [ready].
- **3-action toolbar**: Роли filter [partial — roles in `assignment.role`/position nodes], month picker [partial — API already accepts `?monthIso=`; prod hardcodes `currentMonthIso()`], "Назначить" [needs write flow].
- **Avatars** [partial]: initials derivable from `resource.name`; avatar **color** is not modeled (pick deterministic by id).
- Keep the prod `CapacityRiskPanel` as a bonus aside, but it does **not** substitute for the matrix.

### 3. `09-admin`

- **Unify into one grid-2 page** [ready]: stop fragmenting users/roles/audit into 3 routes; render side-by-side (or add an on-page segmented switcher). Currently the breadcrumb hardcodes "Пользователи".
- **Users "Имя" CellStack** [ready]: BemAvatar (initials+color) + name title + email subtitle, instead of plain text + separate email column.
- **Live count subtitle** [ready]: "{N} активных" from the users array.
- **Semantic Активен/Заблокирован badge** [ready]: success/secondary tone instead of flat secondary.
- **Роль badge column** [partial]: role/access-profile data exists but lives in a separate `RolesPanel` route — join it onto the user row.
- **Per-row actions column** (MoreHorizontal) [needs backend — user mutations].
- **Security-policies card + 4 SwitchRows + "Пригласить" + "Аудит" button** [needs backend — no policy/invite endpoints]. The "Аудит" button itself can link to the existing audit route [ready].

### 4. `10-settings`

- **4-tab Segmented toolbar** (Профиль/Уведомления/Интеграции/Оплата) [ready — pure UI scaffold].
- **Editable Profile form** (Имя, Email inputs) [partial — name/email exist in AuthMe; needs an update endpoint to actually save].
- Everything else **needs backend**: "Сохранить" mutation, Локаль/Таймзона selects, Notifications switches, Integrations & Billing tabs — none of these fields exist in the AuthMe read-model. Scaffold the tabs now as disabled/empty states so structure matches; wire when contracts land.

### 5. `06-deal-card` & 6. `07b-project-detail` (shared `EntityDetailBlock` shape — do together)

- **Editable Параметры form** [ready]: both have backing data — Opportunity (`stageId`, `plannedStart/Finish`, `contractValue`) and Project (`status`, `plannedStart/Finish`, `contractValue`). Replace the read-only FactList with FormSection + Select/DatePicker/Input + Save. **This is the biggest shippable win on both.**
- **Stage chip + team avatar header row** [partial]: stage value exists (`stageId`/`status`); team/participant avatars need a participants→names join.
- **Activity feed "Лента"** [needs backend]: no per-entity event/comment stream in deal-detail or project-detail queries (the `AuditPanel`/`useAuditEvents` feed exists only on Admin — could be generalized).
- **Comment composer** (textarea + Paperclip + Send) [needs backend — no comment endpoint at entity level; project-detail has per-task comments only].
- **Relations "Связи" card** [needs backend — no linked-projects/products data].
- **Toolbar**: restore primary Сохранить (pairs with editable params) + overflow Действия menu [ready once params are editable].

### 7. `07-projects-list`

- **Semantic status badge tone map** [ready]: secondary/info/success/danger by status, replacing the always-secondary badge.
- **Status-breakdown lead** [ready]: "N активных, M на ревью, K на финале".
- **Search-by-name** [partial — client-side over loaded list].
- **Segmented filter (Активные/Архив/Шаблоны)** [partial — needs archive/template concept].
- **Styled panel wrapper** [ready — pure CSS chrome].
- **Create-project CTA** [unknown — needs create flow].
- **Ответственный column + project-code subtitle** [needs backend — no manager/responsible field, no project code on `ProjectRecord` or web `Project`].
- Lifecycle action menu (Дублировать/В архив/Удалить) [needs backend].

### 8. `05-deals`

- **Fix the funnel data-binding bug** [ready — pure bug]: `DealsFunnel` binds `stage.name` into the `deal-card__id` slot, so the id never shows and the stage name appears twice. Bind the real deal id.
- **SearchPill text search** [ready — client-side].
- **"+ Сделка" create button** [unknown — needs create flow].
- **Стадия badge** info-tone + Сделка subtitle = deal id [ready].
- **Команда avatar-stack column + per-card owner avatar** [needs backend — Opportunity read-model has no owner/assignee field; prod currently hardcodes fake "ИИ"/c1 avatar — remove the fake until data exists].

### 9. `02-my-work` (closest to parity)

- **Remove the hardcoded fake "ИИ"/c1 avatar** [partial]: this is an honesty/real-data violation on every card. Real assignee names need a user lookup (`Task.participants` has only `userId`+`role`, no name/initials) — see §3.
- **Real task key** instead of synthetic `Задача ${index+1}` [needs backend — no task code in read-model].
- **Comment count indicator** [needs backend — no count in read-model, though comments exist via `/comments`].
- Minor parity: revert 4→3 columns to match SB (or get the 4-col Проверка variant re-approved), use contextual meta instead of duplicating the due date, fix empty-column copy [ready].

---

## 3. Data not yet available (backend / read-model work required first)

These gaps **cannot reach parity by wiring alone** — the field/endpoint does not exist:

| Surface | Missing field / endpoint | Blocks |
|---|---|---|
| Gantt | Earned-value inputs (BCWS/BCWP/ACWP) | SPI/CPI stats |
| Gantt | `dependencies[]` on `PlanningReadModel.authored` | Link/unlink, Предш. column, critical path |
| Gantt | Critical-path / slack computation | "крит. путь" toggle + red bars |
| Gantt | Milestone flag/type on tasks | Milestone diamonds |
| Gantt | Baseline snapshot fields | "Базовый план" toggle |
| Gantt | add/delete-task + reparent/outline commands | Toolbar task ops, indent up/down |
| My Work / Deal / Project | Participant→name/initials join (`participants` has only `userId`+`role`) | Real assignee avatars, team stacks |
| My Work | Task code/key + comment count | Real card id, comment indicator |
| Deals | Owner/assignee on `Opportunity` | Owner avatar, Команда column |
| Projects-list | Manager/responsible field + project code on `ProjectRecord` | Ответственный column, code subtitle/search |
| Projects-list | Archive/template concept | Архив/Шаблоны filter, lifecycle actions |
| Deal-card / Project-detail | Per-entity activity feed + comment endpoint | Лента + composer |
| Deal-card / Project-detail | Relations (linked projects/products) | Связи card |
| Admin | Security-policy settings + invite + user-mutation endpoints | Security card, Пригласить, per-row actions |
| Settings | locale, timezone, notification prefs, integrations, billing, profile-update endpoint, real workspace name | Almost the entire SB block |

**Avatar color** is unmodeled everywhere — derive deterministically from id rather than treating it as a data gap.

---

## 4. Recommended implementation order

**Phase 0 — Bug fixes & honesty violations (hours, no new data):**
1. `05-deals` funnel data-binding fix (stage name in id slot) + remove fake "ИИ" avatar.
2. `02-my-work` remove hardcoded fake avatar (show real or none — stop shipping fake data on a "real data" surface).
3. `12-project-gantt` today-line fix (day-0 → real date).

**Phase 1 — Pure-wiring wins on data already fetched (highest ROI, no backend):**
4. **`13-project-resources` — do this first and big.** The entire blocker (capacity heatmap, hierarchy, stats strip, legend, per-day states, load %) is buildable from `useCapacityTree`/`CapacitySummary` data already in the runtime. One surface flips from blocker→near-parity with zero backend.
5. `12-project-gantt` WBS-tree rebuild in `toGanttData` (parse `wbsCode`) + mode column + progress% stat + toolbar shell + zoom/filter controls. Clears 2 of 3 blockers using existing data.
6. `07-projects-list` semantic status tones + status-breakdown lead + client-side search + panel wrapper.
7. `09-admin` unify routes + CellStack avatar/email + count subtitle + semantic status + join Роль onto row.

**Phase 2 — Editable forms on existing data:**
8. `06-deal-card` + `07b-project-detail` together: convert read-only Параметры → editable FormSection (Select/DatePicker/Input) + Save, using existing stage/date/value fields. Restore overflow actions. (Shared `EntityDetailBlock` — one effort serves both.)
9. `10-settings` editable Profile (name/email) once a profile-update endpoint exists; scaffold the 4 tabs now as empty/disabled states.

**Phase 3 — Backend contracts, then wire (parallelize backend work early):**
10. Open read-model tickets from the §3 table at the **start** of Phase 1 so they land by Phase 3. Priority order by user value:
    - Participant→name join (unblocks avatars on My Work, Deals, Deal/Project detail — 4 surfaces at once).
    - Gantt dependencies + critical path + milestones + baseline + EV (the remaining Gantt blockers; largest backend lift).
    - Per-entity activity feed + comment endpoint (Deal-card + Project-detail feed/composer; consider generalizing the existing `useAuditEvents` feed).
    - Admin security policies + invite/user-mutation; Projects manager/code; Settings locale/tz/notifications/integrations/billing.

**Dependencies:** Phase 0/1 have none — start immediately. Phase 2 editable-params depends only on existing data. Phase 3 UI is gated on the §3 endpoints, so file those read-model tickets on day one and run them in parallel with Phases 1–2. The single highest-leverage backend item is the **participant→name join** (unblocks 4 surfaces); the single highest-leverage frontend item is the **Resources heatmap** (a blocker that needs no backend at all).

---

*Method note: this is a synthesis of the nine provided per-surface gap reports; no source files were re-read (the reports already carry the structural facts — `toGanttData`, `useCapacityTree`, `CapacityTreeNode`/`CapacityDayCell`, `PlanningReadModel.authored`, `EntityDetailBlock`). No CodeGraph queries were run since no code was inspected or changed.*

---

## Приложение: пер-поверхностные отчёты (raw)

```json
[
  {
    "surface": "12-project-gantt",
    "sbSections": [
      "PageIntro (title + lead) with actions: \"Май 2026\" calendar/month button + \"Сохранить\" (Save, primary)",
      "gantt-toolbar (role=toolbar): add/delete task, indent up/down (outline level), link/unlink dependency, \"крит. путь\" toggle, \"Базовый план\" (baseline) toggle, Filter, zoom Segmented Час/День/Нед/Мес",
      "Stats bar (gantt-stats): SPI 0.94 / CPI 1.02 / Прогресс 62% / Задач 15",
      "Gantt grid (shared widget) with 12 columns: # / Реж(mode) / WBS / Название задачи / Длит. / % зав. / Начало / Окончание / Предш. / Ресурсы / Труд. / timeline chart",
      "Two-row timeline header (month label row + day-number row, weekend shading, today line)",
      "WBS hierarchy in the grid: summary/group rows (bold, group bars), nested child tasks with indentation, collapse/expand toggles, milestone rows (diamonds), critical-path bars (red) + selected-row highlight, varied assignee avatars (c1–c5)"
    ],
    "prodSections": [
      "PageIntro (title `Гант · {project.title}` + lead) with actions: \"Подготовить сверку\" (preview) + \"Применить\" (apply) — a demo plan-shift command, not Save/calendar",
      "DisabledReason permission gate banner",
      "Stats bar (gantt-stats): Версия (planVersion) / Задач / Предпросмотр (changed-count)",
      "Conditional \"Сверка изменения\" preview CardPanel (prod-only)",
      "Gantt grid (same shared widget, same 12 columns + two-row header) but fed a FLAT task list via toGanttData — every task forced to level 0, kind \"task\", no summaries/milestones/critical/indentation/collapse"
    ],
    "gaps": [
      {
        "kind": "toolbar",
        "detail": "The entire gantt-toolbar is absent in prod. SB renders a full toolbar bar (role=toolbar) above the grid; ProjectGanttRuntime renders no toolbar element whatsoever — it jumps straight from PageIntro/DisabledReason to the stats bar and grid.",
        "severity": "blocker",
        "dataAvailable": "partial"
      },
      {
        "kind": "toolbar",
        "detail": "SB has Add (Plus) + Delete (Trash2) task buttons in the first toolbar group; prod has no way to add or remove a task from the Gantt. Read-model exposes a planning command channel (task.update_schedule used by preview/apply) but no add/delete task command is surfaced.",
        "severity": "major",
        "dataAvailable": "unknown"
      },
      {
        "kind": "toolbar",
        "detail": "SB has Indent-up / Indent-down buttons (ChevronUp \"Уровень выше\" / ChevronDown \"Уровень глубже\") to change a row's WBS outline level; prod has none. There is no reparent/outline mutation in the read-model.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB has Link (Link2) / Unlink dependency buttons; prod has none. PlanningReadModel.authored exposes only tasks + assignments — no dependencies array — so dependency editing has no data backing (preview mentions changedDependencyIds but read-model never returns dependencies).",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB has a \"крит. путь\" (critical path) toggle button; prod has no critical-path control. No critical-path / dependency / slack data is present in the read-model to compute it.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB has a \"Базовый план\" (baseline) toggle button; prod has no baseline concept or control. Read-model carries only the current authored plan (planVersion) — no baseline snapshot fields.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB has a Filter (Filter icon) button; prod has none. Filtering could be done client-side over the loaded task list, so data is available even though no backend filter exists.",
        "severity": "minor",
        "dataAvailable": "partial"
      },
      {
        "kind": "controls",
        "detail": "SB has a zoom Segmented control with Час/День/Нед/Мес (hour/day/week/month) options driving timeline granularity; prod has no zoom control. Note: the shared Gantt widget itself only renders a fixed day grid (DAY_W=28, 30 days) and does not actually react to zoom, so even SB's zoom is presentational — but prod is missing the control entirely.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "controls",
        "detail": "PageIntro actions differ. SB shows \"Май 2026\" (month/calendar picker) + \"Сохранить\" (Save). Prod shows \"Подготовить сверку\" + \"Применить\" — a narrow demo command (nextScheduleCommand shifts the first schedulable task's finish by one day). No month navigation and no save-the-plan affordance matching SB.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "stats",
        "detail": "Stats bar content is different. SB shows SPI / CPI / Прогресс / Задач (earned-value + progress). Prod shows Версия (planVersion) / Задач / Предпросмотр (preview changed-count). SPI, CPI and Прогресс% are all missing. No earned-value inputs (BCWS/BCWP/ACWP) exist in the read-model for SPI/CPI; project-level Прогресс% could be derived by averaging tasks.percentComplete (partial).",
        "severity": "blocker",
        "dataAvailable": "partial"
      },
      {
        "kind": "hierarchy",
        "detail": "WBS hierarchy is missing in prod. The shared widget fully supports summary/group rows (level 0 bold + group bars), nested child tasks (level 1+ indentation via wbs-indent), and collapse/expand toggles (wbs-toggle) — SB exercises all of these via GANTT_MOCK. But prod's toGanttData maps EVERY task to `level: 0, kind: \"task\"`, producing a flat ungrouped list with no indentation, no group bars, and no collapse toggles. wbsCode dotted codes are in the read-model and could be parsed into a tree, but there is no explicit parent/summary marker or children relation.",
        "severity": "blocker",
        "dataAvailable": "partial"
      },
      {
        "kind": "hierarchy",
        "detail": "Milestones are missing in prod. The widget renders kind:\"milestone\" rows as diamonds (gmile); SB's mock includes \"Scope зафиксирован\" / \"MVP demo\" milestones. Prod's toGanttData never emits kind:\"milestone\" (everything is \"task\"). Read-model tasks have no milestone flag/type to drive this.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "Critical-path styling is missing in prod. The widget paints critical tasks as red \"gbar--blocker\" bars and adds a selected-row highlight when row.critical is set; SB's mock sets critical:true on the architecture phase + its tasks. Prod's toGanttData never sets `critical`, so no task is ever rendered as critical. No dependency/critical-path data exists in the read-model.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "The \"today\" marker is placed differently. SB mock sets today on day 7 (mid-window, a believable line through the chart). Prod's toGanttData hard-codes today to index 0 (the project's plannedStart), so the today line is always pinned to the very first day regardless of the real current date — usually wrong. Real current date is trivially available.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "WBS column is effectively empty in prod for real data: toGanttData passes `wbs: task.wbsCode ?? \"\"`, so when wbsCode is unset the column shows blank, whereas SB shows a full hierarchical WBS (1, 1.1, M1, 2.1...). The Предш. (Predecessor) column is a non-functional stub in BOTH (the widget hard-codes \"—\" in cell 9), so it is not a prod-only gap but remains unpopulated because the read-model carries no dependencies.",
        "severity": "minor",
        "dataAvailable": "partial"
      }
    ],
    "severity": "blocker",
    "summary": "This is the worst-fidelity surface and earns a blocker rating. SB's GanttSliceBlock presents a full project-scheduling tool: a PageIntro with month-picker + Save, a rich gantt-toolbar (add/delete, indent up/down, link/unlink, critical-path toggle, baseline toggle, filter, and an Hour/Day/Week/Month zoom segmented), an earned-value stats bar (SPI/CPI/Прогресс/Задач), and a WBS-structured grid that shows summary/group rows, indented child tasks, collapse toggles, milestone diamonds, a critical chain in red, and a mid-window today line. Prod's ProjectGanttRuntime reuses the SAME grid widget but strips almost everything around and feeding it: there is NO toolbar at all; the PageIntro actions are a narrow demo plan-shift (\\\"Подготовить сверку\\\"/\\\"Применить\\\") instead of Save/calendar; the stats bar shows Версия/Задач/Предпросмотр instead of SPI/CPI/Progress; and toGanttData flattens every task to level-0 kind-\\\"task\\\", so the grid loses all hierarchy, summaries, milestones, indentation, collapse toggles, and critical-path styling — and pins \\\"today\\\" to day 0. Data-wise, the real read-model already supports a lot (dates, work minutes, percentComplete, schedulingMode, resource names, wbsCode), so progress%, a parsed WBS tree, mode, and a correct today line are achievable now; but earned-value (SPI/CPI), dependencies/links, critical path, milestones, and baseline have no backing fields in PlanningReadModel and would need new read-model data before those toolbar/stats features can be made real rather than decorative."
  },
  {
    "surface": "13-project-resources",
    "sbSections": [
      "PageIntro with title + lead + 3-action toolbar: \"Роли\" (Filter, ghost), \"Май 2026\" (Calendar month-picker, ghost), \"Назначить\" (Plus, primary)",
      "ResourceMatrixStats — horizontal stats strip with 5 metrics (Ёмкость ч, Назначено ч [accent], Загрузка % [warning≥90/danger≥100], Свободно ч [danger<500], Сотрудников) + a load progress bar (fill = loadPct)",
      "ResourceMatrixLegend — 7 load-level swatches (Свободно, Норма ≤8ч, Высокая >10ч, Перегруз >15ч, Выходной, Отпуск, Праздник)",
      "ResourceMatrix — full-width daily capacity heatmap: grid of 240px name col + 56px % col + 31 day columns",
      "Matrix header row: \"Сотрудник\", \"%\", then day numbers 1..31 with weekday tooltip and weekend/holiday/today styling",
      "Hierarchical collapsible rows: workshop (Мастерская Alpha) → role (Архитектор/Визуализатор) → person rows, with indent levels 0/1/2 and WBS indent guides",
      "Collapse/expand toggle buttons (ChevronRight) on workshop and role group rows",
      "Person rows with colored avatar initials (c1..c6) and a per-row load % cell with tone (low/mid/norm/high/over)",
      "Day value cells with 5 states: weekend, holiday, vacation, zero (no-load \"·\"), load (hours number colored normal/high/over) + today-column highlight"
    ],
    "prodSections": [
      "PageIntro with title (Ресурсы · {project.title}) + lead — NO action toolbar (no Роли/month-picker/Назначить)",
      "bento grid of 4 vertical MetricTile cards: Назначено (ч), Участники (uniq resources), Перегрузка (count), Перегруз ч (overload hours)",
      "entity-grid main: CardPanel \"Назначения проекта\" → flat AssignmentsTable with columns Задача / Роль / Ресурс / План(ч)",
      "entity-grid aside: CapacityRiskPanel \"Риски загрузки\" — top-5 overloaded employees as a text list (name · перегруз X ч)"
    ],
    "gaps": [
      {
        "kind": "visual",
        "detail": "The centerpiece is missing entirely: SB renders ResourceMatrix — a full-width daily capacity heatmap (240px name col + % col + 31 colored day cells per row). Prod renders NO heatmap at all; in its place is a flat AssignmentsTable. Critically, prod ALREADY fetches useCapacityTree(monthIso, id) — the exact per-day capacity data the matrix needs — but only uses it to build a 5-item text risk list, discarding the per-day grid.",
        "severity": "blocker",
        "dataAvailable": "yes"
      },
      {
        "kind": "hierarchy",
        "detail": "SB shows a 3-level collapsible org hierarchy (workshop → role → person) with indentation (indent 0/1/2) and WBS guide lines. Prod has no hierarchy: AssignmentsTable is a flat per-assignment list and CapacityRiskPanel flattens the tree to employee nodes only. The backend CapacityTreeNode.type enum is [direction, unit, team, position, employee] with children, so an even richer hierarchy than SB is already available.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "controls",
        "detail": "SB group rows (workshop/role) have collapse/expand toggle buttons (ChevronRight). Prod has no collapse/expand interaction anywhere on this surface.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "SB matrix columns are day-of-month (1..31) with weekday tooltip and weekend/holiday/today header styling, plus a name column and a load % column. Prod AssignmentsTable columns are entirely different and task-oriented: Задача / Роль / Ресурс / План(ч) — no per-day columns and no per-row load % column. Per-day dates come from CapacityDayCell.date; isFreeDay flag distinguishes non-working days.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "stats",
        "detail": "SB renders a horizontal ResourceMatrixStats strip with 5 metrics + a load progress bar. Prod renders 4 vertical bento tiles with a different metric set. Missing in prod: Ёмкость (capacity hours), Загрузка % (load %), Свободно (free hours), and the load progress-bar fill. Prod instead shows Участники and Перегруз ч. CapacitySummary already exposes totalCapacityMinutes / totalWorkMinutes / totalFreeMinutes / totalOverloadMinutes / overloadedEmployeeCount, so every SB metric is derivable.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "states",
        "detail": "SB day cells encode 5 distinct visual states — weekend, holiday, vacation, zero (no-load \"·\"), and load with normal/high/over color — plus a today-column highlight. Prod visualizes none of these (no per-day cells exist). CapacityDayCell already carries workMinutes, heat (free/normal/busy/overloaded), isAbsence (→vacation), isFreeDay (→weekend/holiday), so the load/zero/vacation/normal/high/over states are derivable; only the weekend-vs-holiday split may need the production calendar.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "toolbar",
        "detail": "SB PageIntro has a 3-action toolbar: \"Роли\" role filter (ghost), \"Май 2026\" month picker (ghost), \"Назначить\" create-assignment (primary). Prod PageIntro has zero actions. The capacity API already accepts ?monthIso=YYYY-MM (prod hardcodes currentMonthIso() with no picker); roles are present in assignment.role / tree position nodes; \"Назначить\" is a write flow not currently wired.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "visual",
        "detail": "SB person rows show colored avatar initials (initials + color c1..c6) and a per-row load % cell with tone levels. Prod shows no avatars on this surface, and no per-resource load % anywhere (AssignmentsTable has only План hours; CapacityRiskPanel shows absolute overload hours, not %). Initials are derivable from resource.name and % from workMinutes/capacityMinutes, but the avatar color is not in the model.",
        "severity": "minor",
        "dataAvailable": "partial"
      },
      {
        "kind": "visual",
        "detail": "SB renders ResourceMatrixLegend — a 7-swatch legend explaining the heatmap color scale (Свободно / Норма ≤8ч / Высокая >10ч / Перегруз >15ч / Выходной / Отпуск / Праздник). Prod has no legend (no heatmap to legend).",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "sections",
        "detail": "Overall composition differs: SB is a single-focus layout (stats strip → legend → full-width daily matrix). Prod is a two-column entity-grid (left: assignments table; right: risk list) preceded by bento tiles. Prod's CapacityRiskPanel \"Риски загрузки\" is a prod-only addition with no SB equivalent (SB surfaces overload inline via the matrix's over-level coloring and per-row %), so it does not compensate for the missing matrix.",
        "severity": "major",
        "dataAvailable": "yes"
      }
    ],
    "severity": "blocker",
    "summary": "Prod's ProjectResourcesRuntime bears almost no resemblance to its Storybook block. The Storybook surface is built around one thing — a full-width daily capacity heatmap (ResourceMatrix): a 31-day grid with a collapsible workshop→role→person hierarchy, per-row load %, avatars, color-coded day cells (weekend/holiday/vacation/zero/load with normal/high/over levels) and today highlighting — fronted by a horizontal 5-metric stats strip with a load bar, a 7-swatch legend, and a 3-action toolbar (role filter, month picker, Назначить). Prod renders none of the heatmap: it shows 4 bento metric tiles (a different metric set, missing Ёмкость/Загрузка%/Свободно/progress-bar), a flat task-oriented AssignmentsTable (Задача/Роль/Ресурс/План), and a small top-5 text risk list — with no toolbar, no legend, no hierarchy, no per-day visualization, and no month/role controls. The most important finding for implementation: the data is already in hand — prod already calls useCapacityTree(monthIso, projectId), whose CapacityTreeNode provides the org hierarchy (direction/unit/team/position/employee + children) and per-day CapacityDayCell records (workMinutes, capacityMinutes, freeMinutes, overloadMinutes, heat, isAbsence, isFreeDay) — i.e. essentially everything the heatmap needs — yet it is collapsed into a 5-line risk list and thrown away. Severity is blocker: the entire reason-for-being of the surface (the load matrix) is absent despite the backing data already being fetched."
  },
  {
    "surface": "02-my-work",
    "sbSections": [
      "PageIntro (title \"Моя работа\" + lead)",
      "view-toolbar with Segmented mode switch Канбан/Список",
      "KanbanBoard with 3 columns: Бэклог (count 24), В работе (count 4), Готово (count 13)",
      "KanbanColumn header: title + count Badge + MoreHorizontal ghost \"Действия колонки\" button",
      "KanbanCard content: real task key id (MDS-39 / MDS-2), PriorityFlag (level+label), title, meta rows (e.g. \"Новая Homepage\", \"Срок: 29 июля\"), assignee avatar stack (real initials+colors, can be multiple), comments count with MessageSquare icon, mono date, highlight variant",
      "List mode: placeholder paragraph (demo only)"
    ],
    "prodSections": [
      "PageIntro (title \"Моя работа\" + longer lead about saving status/comment/blocker)",
      "view-toolbar with Segmented mode switch Канбан/Список (identical to SB)",
      "StateGate (skeleton TableSkeleton + empty 'Назначенных задач нет.')",
      "TaskKanban: KanbanBoard with 4 columns mapped by statusCategory: Бэклог(new) / В работе(in_progress) / Проверка(review) / Готово(done), count = real item count",
      "KanbanColumn header: same component (count Badge + MoreHorizontal button, non-functional)",
      "KanbanCard content: synthetic id 'Задача N', PriorityFlag from task.priority, real title, meta [Срок: date, statusName], single HARDCODED avatar {ИИ,c1}, mono date, foot=TaskAdvanceButton (status advance); NO comments count, NO highlight",
      "List mode: full TaskTable (columns Задача / Срок / Статус badge / Прогресс / Действие) with TaskDetailSheet, TaskAdvanceButton, TaskCommentForm — richer than SB"
    ],
    "gaps": [
      {
        "kind": "visual",
        "detail": "SB kanban cards render a real per-card assignee avatar stack (BemAvatarStack with real initials+colors, supporting multiple people). Prod hardcodes a single fake avatar {initials:\"ИИ\", color:\"c1\"} on EVERY card regardless of who is actually assigned — fake data on a surface that must show real data.",
        "severity": "blocker",
        "dataAvailable": "partial"
      },
      {
        "kind": "visual",
        "detail": "SB card head shows a real task key/code (e.g. \"MDS-39\", \"MDS-2\"). Prod shows a synthetic positional label `Задача ${index+1}` that is not a stable or real task identifier — it changes with filtering/ordering and is meaningless.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "SB cards display a comment count with a MessageSquare icon (e.g. comments={13}). Prod TaskKanban passes no `comments` prop, so the comment indicator is entirely absent from kanban cards even though comments exist (TaskCommentForm posts to /api/workspace/tasks/{id}/comments).",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "states",
        "detail": "SB demonstrates a kanban-card--highlight emphasis variant (the 'Sales deck' card). Prod never sets `highlight`, so there is no active/focused/emphasis state on any card.",
        "severity": "minor",
        "dataAvailable": "unknown"
      },
      {
        "kind": "columns",
        "detail": "SB kanban has exactly 3 columns (Бэклог / В работе / Готово). Prod renders 4 columns (adds Проверка/review). Prod is arguably richer, but the column set deviates from the approved SB design and the count badges no longer match the design reference.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "visual",
        "detail": "SB card meta rows carry contextual descriptors (e.g. \"Новая Homepage\" + \"Срок: 29 июля\"). Prod meta is [\"Срок: <date>\", statusName] — it duplicates the due date (which also renders in the card foot) and surfaces the status name (already implied by the column), so the meta area conveys less than the SB design.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "visual",
        "detail": "Empty-column copy differs: SB Готово shows \"Нет задач за сегодня\"; prod empty columns show generic \"Нет задач\".",
        "severity": "minor",
        "dataAvailable": "yes"
      }
    ],
    "severity": "major",
    "summary": "The My Work surface is near structural parity at the shell level — prod reuses the same PageIntro, the identical Канбан/Список Segmented toolbar, and the same KanbanBoard/KanbanColumn/KanbanCard widgets, and the prod List mode (a full TaskTable with detail sheet, status-advance and comment forms) actually exceeds the SB list (a placeholder paragraph). The shortfall is concentrated inside the kanban card content. The most serious issue is an honesty/real-data violation: every card shows a hardcoded fake avatar (\\\"ИИ\\\"/c1) instead of real assignees, and the card identifier is a synthetic \\\"Задача N\\\" index rather than a real task key like SB's \\\"MDS-39\\\". On top of that, the SB comment-count indicator is dropped entirely, the highlight/emphasis state is never used, prod uses 4 status columns vs SB's 3, and the meta rows duplicate the due date instead of carrying contextual labels. None of these break layout, so overall severity is major (not blocker), but the fake avatars + fake ids must be fixed for the surface to be \\\"on real data.\\\" Data readiness is mixed: assignee names need a user lookup (Task.participants has only userId+role, no initials/name), and there is no comment count or task code in the read-model, so closing the avatar/comments/id gaps requires read-model additions, not just wiring."
  },
  {
    "surface": "05-deals",
    "sbSections": [
      "PageIntro with primary '+ Сделка' create-deal action button",
      "view-toolbar: Segmented mode toggle (Канбан / Список / Прогноз)",
      "view-toolbar__filters: SearchPill ('Сделки, клиенты…', w-240) + secondary 'Фильтр' button (Filter icon, demo-disabled)",
      "Kanban funnel: 5 stage columns each with title + count Badge",
      "Deal cards: deal id (mono) + owner BemAvatar in head, title, client, foot Chip(stage) + amount",
      "List/Forecast placeholder paragraphs",
      "Deals Table (shown for kanban+list): columns Сделка(CellStack title+id) / Клиент / Стадия(Badge info) / Сумма(numeric mono) / Команда(BemAvatarStack of 2 avatars)"
    ],
    "prodSections": [
      "PageIntro title+lead only (no action button)",
      "view-toolbar: Segmented mode toggle only (Канбан / Список / Прогноз)",
      "StateGate wrapper (skeleton TableSkeleton / empty 'Сделок пока нет')",
      "DealsFunnel (kanban): stage columns with count badge, deal cards link to /deals/:id",
      "ForecastPanel (forecast mode): CardPanel with probability-weighted total (functional, exceeds SB placeholder)",
      "DealsTable: columns Сделка(CellStack title+contactName) / Клиент / Стадия(Badge secondary) / Сумма / action column (DealAdvanceButton '→ next stage')"
    ],
    "gaps": [
      {
        "kind": "controls",
        "detail": "SB PageIntro has a primary '+ Сделка' action button (create deal). Prod DealsRuntime renders <PageIntro title lead /> with no actions at all — no way to create a deal from this surface.",
        "severity": "major",
        "dataAvailable": "unknown"
      },
      {
        "kind": "toolbar",
        "detail": "SB toolbar has a view-toolbar__filters group containing a SearchPill ('Сделки, клиенты…', w-240). Prod toolbar has ONLY the Segmented mode toggle — no search input. Filtering opportunities/clients by text is impossible in prod.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "toolbar",
        "detail": "SB toolbar has a secondary 'Фильтр' button (Filter icon). Prod has no filter control at all.",
        "severity": "minor",
        "dataAvailable": "partial"
      },
      {
        "kind": "columns",
        "detail": "SB Deals Table 5th column is 'Команда' rendering a BemAvatarStack (owner + teammate avatars). Prod replaces this column with an action cell (DealAdvanceButton). The team/owner column is entirely absent in prod.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "SB funnel deal-card head shows the deal id (e.g. 'DEAL-101', mono) in the deal-card__id slot. Prod's DealsFunnel binds stage.name into deal-card__id instead — so the id is never shown and the stage name appears twice per card (once in the id slot, once in the foot Chip). Data-binding bug.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "visual",
        "detail": "SB funnel deal-card head shows a per-deal owner BemAvatar (varying initials/colors). Prod hardcodes BemAvatar initials='ИИ' color='c1' on every card — same fake avatar for all deals.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "SB Table 'Стадия' cell uses Badge variant='info' (blue). Prod uses Badge variant='secondary' (grey) — different stage chip styling.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "SB Table 'Сделка' CellStack subtitle is the deal id (DEAL-101). Prod uses contactName ?? 'Контакт не указан' as the subtitle — different secondary line (no id surfaced anywhere in prod table).",
        "severity": "minor",
        "dataAvailable": "yes"
      }
    ],
    "severity": "major",
    "summary": "Prod DealsRuntime has the right skeleton — same three-mode Segmented toggle (Канбан/Список/Прогноз), a funnel, and a deals table on real /api/workspace/opportunities + /deal-stages data, and its Forecast mode actually exceeds the SB placeholder by computing a probability-weighted total. But it falls short of the Storybook block in several concrete ways: the PageIntro is missing the primary '+ Сделка' create button; the toolbar is missing the entire filters group (SearchPill text search + 'Фильтр' button); the table drops SB's 'Команда' avatar-stack column (replaced by a stage-advance action); the funnel cards mis-bind data (stage name is rendered into the deal-id slot, duplicating the foot Chip and hiding the id) and hardcode a single fake 'ИИ' owner avatar on every card; and minor styling diverges (Стадия badge info→secondary, card subtitle id→contact). The search/filter and id-binding gaps are backable by data already in the read-model (deal id, title, client all present), so they are quick wins; the owner/team avatars are NOT fillable because the Opportunity read-model carries no owner/assignee field."
  },
  {
    "surface": "07-projects-list",
    "sbSections": [
      "PageIntro: title \"Проекты\" + multi-stat lead (\"14 активных, 3 на ревью, 2 на финальной стадии\") + primary \"Проект\" create button (Plus icon)",
      "view-toolbar: Segmented tab filter (Активные / Архив / Шаблоны)",
      "view-toolbar filters: SearchPill (\"Код или название\") + secondary \"Фильтр\" button (Filter icon)",
      "Conditional helper note when filter != active (Архив / Шаблоны demo text)",
      "Table wrapped in styled panel (rounded border, bg-panel, overflow-hidden)",
      "6 columns: Название | Клиент | Ответственный | Статус | Срок(numeric) | Действия(sr-only)",
      "Название cell: CellStack title=name, subtitle=project code (PRJ-2026-014), Folder icon",
      "Ответственный cell: Avatar (initials) + manager name",
      "Статус cell: Badge with semantic tone mapping (secondary/info/success/danger by status)",
      "Срок cell: due date, numeric/right-aligned",
      "Row actions DropdownMenu: Открыть / Дублировать / В архив / separator / Удалить (destructive)",
      "Archived rows dimmed (opacity-60)"
    ],
    "prodSections": [
      "PageIntro: title \"Проекты\" + single-count lead (\"N активных проектов в работе\"), NO actions",
      "StateGate: skeleton (TableSkeleton 5 cols) / empty (\"Активных проектов пока нет\") / loaded",
      "ProjectsTable: bare Table, NOT wrapped in a panel container",
      "5 columns: Название | Клиент | Статус | Срок(numeric) | Действия(sr-only)",
      "Название cell: CellStack title=project.title, subtitle=dateRange(plannedStart, plannedFinish), Folder icon",
      "Статус cell: Badge variant=secondary always (neutral, businessStatus() label)",
      "Срок cell: formatDate(plannedFinish), numeric",
      "Row actions DropdownMenu (with Tooltip): Открыть проект / План-график / Ресурсы (nav links)"
    ],
    "gaps": [
      {
        "kind": "toolbar",
        "detail": "SB has a Segmented tab filter (Активные / Архив / Шаблоны) in a view-toolbar; prod renders no toolbar at all — no way to switch between active/archived/template projects.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "toolbar",
        "detail": "SB has a SearchPill search input (placeholder \"Код или название\"); prod has no search box. Cannot filter the list by name or code.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "toolbar",
        "detail": "SB has a secondary \"Фильтр\" button (Filter icon) for advanced filtering; prod has none.",
        "severity": "minor",
        "dataAvailable": "unknown"
      },
      {
        "kind": "controls",
        "detail": "SB PageIntro has a primary \"Проект\" create CTA (Plus icon) in the actions slot; prod PageIntro passes no actions, so there is no create-project entry point on this screen.",
        "severity": "major",
        "dataAvailable": "unknown"
      },
      {
        "kind": "stats",
        "detail": "SB lead is a multi-stat summary (\"14 активных проектов, 3 на ревью, 2 на финальной стадии\"); prod lead is a single bare count (\"N активных проектов в работе\") with no status breakdown.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "SB has an \"Ответственный\" column rendering an Avatar (initials) + manager name; prod ProjectsTable omits this column entirely (5 cols vs SB's 6). No owner/PM shown per row.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "columns",
        "detail": "Название cell subtitle differs: SB shows the project code (PRJ-2026-014); prod shows the planned date range instead. No project code is surfaced anywhere in prod.",
        "severity": "minor",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "SB Статус badge uses a semantic tone map (secondary=В работе, info=На ревью, success=Завершён, danger=Просрочено — Principle 1 color-by-meaning); prod always renders Badge variant=secondary (flat neutral), losing the at-a-glance status signal.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "controls",
        "detail": "Row action menu intent differs: SB exposes lifecycle CRUD (Открыть / Дублировать / В архив / Удалить-destructive); prod exposes navigation only (Открыть проект / План-график / Ресурсы). Duplicate, archive, and delete actions are absent in prod.",
        "severity": "minor",
        "dataAvailable": "unknown"
      },
      {
        "kind": "visual",
        "detail": "SB wraps the table in a styled panel (overflow-hidden, rounded-[--radius-md], border-subtle, bg-panel); prod renders a bare <Table> with no surrounding panel/card chrome.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "states",
        "detail": "SB dims archived rows (opacity-60) for visual de-emphasis; prod has no archived-row treatment (and no archive concept on this list).",
        "severity": "minor",
        "dataAvailable": "no"
      },
      {
        "kind": "sections",
        "detail": "SB shows a contextual helper paragraph when the segmented filter is Архив/Шаблоны; prod has no equivalent (tied to the missing filter feature).",
        "severity": "minor",
        "dataAvailable": "partial"
      }
    ],
    "severity": "major",
    "summary": "The prod ProjectsRuntime renders a functional but stripped-down version of the Storybook ProjectsListBlock: it keeps the PageIntro + a Folder/CellStack table on real data, but drops nearly all of SB's structure. Missing entirely: the create-project CTA, the whole view-toolbar (Активные/Архив/Шаблоны segmented filter, search pill, Фильтр button), the multi-stat summary lead, the Ответственный (manager + avatar) column, the semantic status-badge tone mapping (prod hardcodes neutral secondary), the styled panel wrapper, and the lifecycle action menu (Дублировать/В архив/Удалить — prod offers navigation links instead). Several gaps are data-backed and shippable now (status breakdown stats, semantic status tones, search-by-name, panel chrome), but two are blocked by the read-model: there is no manager/responsible field and no project code on either the web Project type or the backend ProjectRecord (only demand[], status, templateId, closedAt), so the Ответственный column and the code subtitle/search need a read-model extension first. Overall a major visual+feature shortfall, not a blocker since the core table works on real data."
  },
  {
    "surface": "07b-project-detail",
    "sbSections": [
      "PageIntro: title + subtitle/lead, actions row = 'Запланировать' (secondary, Calendar icon), 'Сохранить' (primary save), overflow IconButton 'Действия' (MoreHorizontal)",
      "Stage header row: stage Chip with tone (info/violet/success/warning) + BemAvatarStack of team members with '+2' more",
      "entity-grid two-column layout (main + aside)",
      "Main · CardPanel 'Описание' (subtitle 'Контекст для команды') — descriptive body text / custom primary slot",
      "Main · CardPanel 'Лента' (subtitle 'Активность по сущности') — activity feed list (avatar, author name, timestamp, text)",
      "Main · Feed compose box — Textarea 'Написать комментарий…' + attach IconButton (Paperclip) + 'Отправить' button (Send icon)",
      "Aside · CardPanel 'Параметры' (subtitle 'Свойства сущности') with FormSection 'Основное' (lead 'Доступно владельцу и админу') — EDITABLE form: Field 'Стадия' Select (Лид/Квалификация/КП/Договор), Field 'Срок' DatePicker, Field 'Сумма' mono numeric Input",
      "Aside · CardPanel 'Связи' (subtitle 'Проекты и продукты') — link-list of related projects/products (Briefcase icon, name + code)"
    ],
    "prodSections": [
      "PageIntro: real project title + lead 'clientName · dateRange', actions row = 'Гант' (secondary, Calendar icon, Link to /timeline), 'Ресурсы' (primary, Link to /resources)",
      "StateGate wrapper (loading/error/empty illustration)",
      "EntityCards 'Контур проекта' — entity-grid: main CardPanel with generated description paragraph (plannedHours, contractValue)",
      "EntityCards aside · CardPanel 'Параметры' — READ-ONLY FactList dl: Клиент, Статус, Период, Задач",
      "CreateTaskPanel 'Новая задача' — title Input + 'Создать' button (extra, not in SB)",
      "TaskTable — columns Задача/Срок/Статус/Прогресс/actions, rows open TaskDetailSheet; per-row TaskAdvanceButton (status step) + TaskCommentForm (Комментарий/Сохранить/Блокер) (extra, not in SB)"
    ],
    "gaps": [
      {
        "kind": "hierarchy",
        "detail": "SB renders a stage header row directly under the title: a tone-colored stage Chip (info/violet/success/warning) plus a BemAvatarStack of team members with a '+2' overflow. Prod shows neither — project status appears only as a plain text row ('Статус') inside the read-only FactList, and there is no team/avatar presence on the project detail at all.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "sections",
        "detail": "SB has a 'Лента' activity-feed CardPanel (subtitle 'Активность по сущности') listing events with avatar, author name, timestamp and text. Prod's ProjectDetailRuntime has NO activity feed — there is no per-project history/comment stream rendered (the AuditPanel/useAuditEvents feed exists only on the Admin surface).",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "controls",
        "detail": "SB's feed card includes a project-level comment composer: Textarea 'Написать комментарий…' + attach IconButton (Paperclip) + 'Отправить' (Send) button. Prod has no project-level comment composer; commenting exists only per-task inside TaskTable rows (TaskCommentForm), and there is no attach/file affordance anywhere.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "controls",
        "detail": "SB's aside 'Параметры' is an EDITABLE form inside FormSection 'Основное' (lead 'Доступно владельцу и админу') — Стадия Select, Срок DatePicker, Сумма numeric Input. Prod renders the same fields as a READ-ONLY FactList (dt/dd: Клиент, Статус, Период, Задач) with no Select, no DatePicker, no amount input and no mutation wired, so the project's stage/date/amount cannot be changed from the detail screen.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "sections",
        "detail": "SB has an aside 'Связи' CardPanel (subtitle 'Проекты и продукты') with a link-list of related projects/products (Briefcase icon + name + code). Prod has no relations/links card on the project detail.",
        "severity": "minor",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB PageIntro actions = 'Запланировать' (Calendar, secondary), 'Сохранить' (primary save), and an overflow IconButton 'Действия' (MoreHorizontal menu). Prod replaces these with two pure navigation links ('Гант' → /timeline, 'Ресурсы' → /resources): there is no primary 'Сохранить' action (consistent with the non-editable params) and no overflow '…' actions menu for the entity.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "visual",
        "detail": "SB main 'Описание' card carries a rich multi-line entity description; prod's main card shows a single auto-generated sentence assembled from plannedHours/contractValue. Card titles/subtitles also differ ('Описание'/'Контур проекта'), a minor copy/altitude mismatch.",
        "severity": "minor",
        "dataAvailable": "partial"
      }
    ],
    "severity": "major",
    "summary": "Prod's ProjectDetailRuntime keeps the same broad skeleton as the generic EntityDetailBlock (PageIntro + two-column entity-grid with a description card on the left and a 'Параметры' card on the right) and on real data, but it is missing most of the block's substance. The SB stage-chip + team-avatar header row is absent; the 'Лента' activity feed and its comment composer (textarea + attach + send) are not rendered at all on the project; the aside 'Параметры' is a read-only FactList instead of SB's editable Стадия/Срок/Сумма form; the 'Связи' relations card is gone; and the toolbar drops SB's primary 'Сохранить' and overflow 'Действия' menu in favor of two nav links. Prod does add genuine project-management value SB lacks (CreateTaskPanel + TaskTable with status advance, per-task comments and a TaskDetailSheet), but as a like-for-like rendering of the entity-detail block it falls short on the feed, the editable parameters form, the stage/team header, the relations panel, and the save/overflow actions — overall a major gap. Underlying data for the editable params (status, plannedStart/Finish, contractValue) already exists in the Project read-model; the feed/comments and relations would need read-model/endpoint work."
  },
  {
    "surface": "06-deal-card",
    "sbSections": [
      "PageIntro header (title + subtitle) with action set: 'Запланировать' (secondary, Calendar icon), 'Сохранить' (primary), and a 'Действия' overflow IconButton (MoreHorizontal)",
      "Stage row: stage Chip (tone info/violet/success/warning) + BemAvatarStack of participants (+2 more)",
      "entity-grid two-column layout (main + aside)",
      "Main: Description card (CardPanel 'Описание' / 'Контекст для команды')",
      "Main: Activity feed card (CardPanel 'Лента' / 'Активность по сущности') — list of entries with avatar, author name, timestamp, message text",
      "Main: Comment composer inside feed card — Textarea ('Написать комментарий…') + 'Прикрепить' IconButton (Paperclip) + 'Отправить' Button (Send icon)",
      "Aside: Parameters card (CardPanel 'Параметры' / 'Свойства сущности') with FormSection 'Основное' (lead 'Доступно владельцу и админу.') and editable FormGrid: Field 'Стадия' → Select (Лид/Квалификация/КП/Договор), Field 'Срок' → DatePicker, Field 'Сумма' → mono numeric Input",
      "Aside: Relations card (CardPanel 'Связи' / 'Проекты и продукты') — link-list of linked projects with Briefcase icon and project codes"
    ],
    "prodSections": [
      "PageIntro header (item.title / 'клиент · период') with action set: 'Проверить реализуемость' (secondary, feasibility mutation) and 'Активировать проект' (primary, opens confirm Dialog)",
      "DisabledReason permission-hint line under the header",
      "StateGate → EntityCards: Description card (CardPanel 'Описание' / 'Контекст для команды') with generated text (title, contact, probability, budget)",
      "Aside: Parameters card (CardPanel 'Параметры' / 'Свойства сущности') rendering a read-only FactList (dl): Клиент, Сумма, Срок, Статус проверки",
      "MutationMessage error line at the bottom"
    ],
    "gaps": [
      {
        "kind": "sections",
        "detail": "Activity feed card is entirely absent. SB renders a 'Лента / Активность по сущности' CardPanel with a list of feed entries (avatar + author name + timestamp + message text). Prod's DealDetailRuntime renders no feed/activity section at all.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "controls",
        "detail": "Comment composer is missing. SB has, inside the feed card, a Textarea ('Написать комментарий…') plus a 'Прикрепить' (Paperclip) IconButton and an 'Отправить' (Send) Button. Prod offers no way to add a comment/note.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "controls",
        "detail": "Parameters card is read-only in prod vs editable in SB. SB renders a FormSection 'Основное' (lead 'Доступно владельцу и админу.') with editable controls: Стадия Select (Лид/Квалификация/КП/Договор), Срок DatePicker, Сумма mono numeric Input — implying an inline edit + Save flow. Prod renders a static FactList (dl of label/value pairs: Клиент, Сумма, Срок, Статус проверки) with no inputs, no FormSection grouping, and no save action.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "sections",
        "detail": "Relations card is missing. SB renders a 'Связи / Проекты и продукты' CardPanel with a link-list of linked projects (Briefcase icon + project code, e.g. PRJ-2026-014). Prod shows no relations/linked-entities section.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "Stage chip + participant avatar stack row is missing. SB shows, above the grid, a stage Chip (toned info/violet/success/warning) plus a BemAvatarStack of participants ('+2'). Prod never surfaces the deal stage visually anywhere (stageId is not even rendered as a fact) and shows no team avatars.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "toolbar",
        "detail": "Header overflow actions menu is missing. SB header has a 'Действия' overflow IconButton (MoreHorizontal) plus generic 'Запланировать' and 'Сохранить' buttons. Prod replaces these with two domain actions ('Проверить реализуемость', 'Активировать проект') and has no overflow/more-actions affordance and no save button.",
        "severity": "minor",
        "dataAvailable": "unknown"
      },
      {
        "kind": "states",
        "detail": "Description card content differs: SB shows a curated multi-line context paragraph; prod concatenates a single sentence (title, contact, probability%, budget). Cosmetic/copy parity gap rather than missing data.",
        "severity": "minor",
        "dataAvailable": "yes"
      }
    ],
    "severity": "major",
    "summary": "The prod DealDetailRuntime delivers only a thin slice of the Storybook EntityDetailBlock: a header (with deal-specific feasibility/activate actions), one description card, and a read-only fact list. It is missing four of the block's signature sections — the stage chip + participant avatar stack, the activity feed, the comment composer, and the 'Связи' relations card — and it downgrades the editable Parameters form (Stage Select / Срок DatePicker / Сумма Input grouped in a FormSection with a Save flow) to a static read-only FactList. Most underlying data for the editable parameters exists in the Opportunity read-model (stageId, plannedStart/Finish, contractValue), so the parameters-editing and stage-chip work is largely wireable; the activity feed, comment composer, and relations link-list have no backing data in the current deal-detail query and would need new endpoints/read-model fields. Overall major: the page is functional and on real data, but visually and behaviorally it is far from the SB block."
  },
  {
    "surface": "09-admin",
    "sbSections": [
      "PageIntro: title \"Администрирование\" + lead + primary action button \"Пригласить\" (UserPlus icon)",
      "grid-2 two-column layout (both cards on ONE page side-by-side)",
      "CardPanel \"Пользователи\" with live count subtitle (\"{N} активных\"), flush",
      "Users Table: columns Имя (BemAvatar + CellStack name/email), Роль (Badge info), Активен (Badge success/secondary), Actions (IconButton MoreHorizontal per row)",
      "CardPanel \"Политики безопасности\" with subtitle (workspace · project) and ghost action button \"Аудит\" (ShieldCheck icon)",
      "SwitchRowList: 4 SwitchRow toggles — 2FA обязательна (on), Сессии 8 часов (on), SSO (SAML), Domain allowlist — each with description + default state"
    ],
    "prodSections": [
      "PageIntro: title (Пользователи/Роли/Аудит) + lead, NO action button",
      "Single-column, single section per route (entityId switches users|roles|audit; default = users only)",
      "UsersTable: CardPanel \"Пользователи\" subtitle static \"Команда рабочей области\" (no count)",
      "Users Table: columns Имя (plain text), Email, Должность (positionName), Статус (Badge secondary, non-semantic)",
      "RolesPanel (separate route): CardPanel \"Роли\", bare <ul> link-list \"{name} · {N} прав\"",
      "AuditPanel (separate route): CardPanel \"Журнал\", feed list of audit events"
    ],
    "gaps": [
      {
        "kind": "sections",
        "detail": "SB lays out Users + a full \"Политики безопасности\" card side-by-side in a single grid-2 page. Prod has NO security-policies card at all and renders only one section at a time (users by default). The entire second column is absent.",
        "severity": "blocker",
        "dataAvailable": "no"
      },
      {
        "kind": "controls",
        "detail": "SB security card contains a SwitchRowList of 4 toggle controls (2FA обязательна — on, Сессии — 8 часов — on, SSO (SAML), Domain allowlist), each with description and default checked state. Prod renders zero toggles/switches and no security settings whatsoever.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB PageIntro has a primary \"Пригласить\" action button (UserPlus icon) in the page header. Prod AdminRuntime PageIntro passes no `actions` at all — no invite affordance.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "toolbar",
        "detail": "SB security card header has a ghost \"Аудит\" button (ShieldCheck icon). Prod users view has no such button; audit exists only as a separate route/section, not surfaced from the admin landing.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "SB \"Имя\" column renders a CellStack with BemAvatar (initials+color) + name as title + email as subtitle. Prod \"Имя\" column is plain text name only, with email pushed to a separate flat column — no avatar, no stacked identity cell.",
        "severity": "major",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "SB users table has a \"Роль\" column rendering a Badge(info) per user (PM / Архитектор / Дизайнер / Разработчик). Prod has no Роль column — it shows \"Должность\" (positionName) as plain muted text instead; access-profile/role is split off into a separate RolesPanel route and never joined onto the user row.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "columns",
        "detail": "SB \"Активен\" column uses semantic badges: Badge(success) \"Активен\" vs Badge(secondary) \"Заблокирован\". Prod \"Статус\" column always renders a single neutral Badge(secondary) via businessStatus(status) with no success/blocked color semantics.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "columns",
        "detail": "SB users table has a trailing per-row actions column with an IconButton (MoreHorizontal) opening a row-level menu (edit/block/manage user). Prod users table has no actions column and no per-row controls.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "stats",
        "detail": "SB \"Пользователи\" card subtitle is a live count (\"{USERS.length} активных\"). Prod subtitle is the static string \"Команда рабочей области\" — no count/stat shown.",
        "severity": "minor",
        "dataAvailable": "yes"
      },
      {
        "kind": "hierarchy",
        "detail": "SB presents one unified admin page (users + security in grid-2). Prod fragments admin into 3 separate routed sections (users/roles/audit selected by entityId) with no on-page tabs/segmented switcher between them; the default landing shows only Users and the breadcrumb hardcodes \"Пользователи\".",
        "severity": "major",
        "dataAvailable": "yes"
      }
    ],
    "severity": "major",
    "summary": "The prod AdminRuntime diverges substantially from the AdminBlock Storybook design. SB is a single unified admin page with a primary \\\"Пригласить\\\" toolbar action and a grid-2 two-column layout: a rich Users table (avatar+name/email CellStack, Роль info-badge, semantic Активен/Заблокирован badge, per-row MoreHorizontal actions, live \\\"N активных\\\" count) alongside a complete \\\"Политики безопасности\\\" card (ghost \\\"Аудит\\\" button + 4 SwitchRow toggles for 2FA, session timeout, SSO/SAML, domain allowlist). Prod instead fragments admin into three separate routed sections (users/roles/audit), shows only one at a time (users by default), and strips the page down: no invite button, no avatars, no Роль badge column (only flat positionName), no semantic status coloring, no per-row actions, no count subtitle, and — most critically — the entire Security Policies card and all toggle controls are absent. Users data (name/email/position/status) is real and available, role/access-profile data exists but isn't joined onto the user row, and security-policy settings + user-mutation/invite endpoints do not exist in the read-model, so the security card and write actions need backend support before they can be built to parity."
  },
  {
    "surface": "10-settings",
    "sbSections": [
      "PageIntro (title 'Настройки рабочей области' + lead + primary 'Сохранить' action button)",
      "Segmented tab toolbar with 4 tabs: Профиль / Уведомления / Интеграции / Оплата",
      "Demo placeholder caption for non-profile tabs",
      "CardPanel container",
      "Profile tab: FormSection 'Профиль' with FormGrid of 4 fields (Имя required, Email required, Локаль select, Таймзона select)",
      "Notifications tab: FormSection 'Уведомления' with SwitchRowList of 3 toggles (Email упоминания, Email дайджест, Slack control signals)",
      "Integrations tab (placeholder)",
      "Billing/Оплата tab (placeholder)"
    ],
    "prodSections": [
      "PageIntro (title 'Настройки рабочей области' + lead 'Профиль, права и состояние текущей сессии.', NO action button)",
      "StateGate (loading/error/empty wrapper)",
      "EntityCards: two-column entity-grid — main CardPanel 'Профиль' with one-line read-only description (name · email · permissions count), aside CardPanel 'Параметры' with FactList (Рабочая область=Текущая, Права=N)"
    ],
    "gaps": [
      {
        "kind": "controls",
        "detail": "SB has a 4-way Segmented tab toolbar (Профиль / Уведомления / Интеграции / Оплата) driving section switching via useState; prod renders a single static view with no tabs and no navigation between settings sections.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "controls",
        "detail": "SB PageIntro has a primary 'Сохранить' action button; prod PageIntro passes no actions — settings are fully read-only with no save affordance and no update mutation wired (no profile/settings PUT endpoint exists in the runtime).",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "sections",
        "detail": "SB Profile tab is an editable FormSection/FormGrid with 4 inputs (Имя required Input, Email required Input, Локаль Select, Таймзона Select). Prod shows none of these as form controls — it collapses the entire profile into a single read-only sentence: `${name} · ${email}. Разрешений: N.` No editable Name or Email field.",
        "severity": "major",
        "dataAvailable": "partial"
      },
      {
        "kind": "controls",
        "detail": "SB has a Локаль (locale) Select with options Русский / English; prod has no locale control. Locale is not present in the AuthMe read-model (user has id/name/email/positionName/status only).",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "controls",
        "detail": "SB has a Таймзона Select (Europe/Moscow UTC+3 / UTC); prod has no timezone control. Timezone is not present in the AuthMe read-model.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "sections",
        "detail": "SB Notifications tab renders a SwitchRowList of 3 toggle rows with descriptions (Email — упоминания [on], Email — дайджест по понедельникам [on], Slack — control signals [off]). Prod has no notifications section and no switch controls at all. No notification-preferences data in the read-model.",
        "severity": "major",
        "dataAvailable": "no"
      },
      {
        "kind": "sections",
        "detail": "SB has an Интеграции (Integrations) tab; prod has no integrations section. No integrations data in the read-model.",
        "severity": "minor",
        "dataAvailable": "no"
      },
      {
        "kind": "sections",
        "detail": "SB has an Оплата (Billing) tab; prod has no billing section. No billing data in the read-model.",
        "severity": "minor",
        "dataAvailable": "no"
      },
      {
        "kind": "visual",
        "detail": "Layout differs structurally: SB uses a CardPanel + FormSection (single-column form layout with grid of labeled fields). Prod uses entity-grid (two-column EntityCards: main description panel + aside 'Параметры' FactList). The prod aside also surfaces 'Рабочая область: Текущая' and 'Права: N' which SB does not show — and 'Текущая' is a hardcoded placeholder (only workspace.id is in the read-model, not a real workspace name).",
        "severity": "minor",
        "dataAvailable": "partial"
      },
      {
        "kind": "other",
        "detail": "PageIntro lead copy diverges: SB 'Профиль, уведомления и интеграции.' vs prod 'Профиль, права и состояние текущей сессии.' — reflects that prod is a session/permissions readout rather than the SB settings surface.",
        "severity": "minor",
        "dataAvailable": "yes"
      }
    ],
    "severity": "major",
    "summary": "Prod's SettingsRuntime is a one-line read-only profile/session readout (a PageIntro plus a single EntityCards showing name · email · permission count and a 'Параметры' FactList), whereas the Storybook SettingsBlock is a full tabbed settings surface: a 4-tab Segmented toolbar (Профиль/Уведомления/Интеграции/Оплата), an editable Profile form (Name, Email, Locale select, Timezone select), a Notifications panel with 3 switch toggles, Integrations and Billing tabs, and a 'Сохранить' save action. Essentially every interactive element of the SB block is missing in prod: no tabs, no editable fields, no selects, no switches, no save. The real data backing parity is thin — only name and email exist in the AuthMe read-model; locale, timezone, notification preferences, integrations, billing, and a settings/profile update endpoint are all absent — so reaching SB parity requires both new UI and new backend read/write contracts, not just wiring. Overall: major divergence (read-only stub vs full settings workspace)."
  }
]
```
