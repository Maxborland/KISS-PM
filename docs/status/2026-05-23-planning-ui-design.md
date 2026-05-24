# Phase A — Planning Workspace UI design

**Дата:** 23.05.2026
**Ветка:** `feature/planning-ui-design-2026-05-23`
**Worktree:** `E:\KISS-PM\.worktrees\planning-ui-2026-05-23`
**Базовая ветка:** `origin/master`
**Скоуп Phase A:** только дизайн-документ, HTML-mockups, скриншоты. Никаких
изменений в `apps/web` или `apps/api`.

## Status

Status: design ready for Phase B.

## Changed

- Добавлен `docs/31_PLANNING_WORKSPACE_UI_DESIGN.md` — целевой дизайн всех 10
  вкладок Planning Workspace, user stories, контракт с backend planning engine,
  acceptance criteria, anti-patterns, Phase B/C scope. Отдельный раздел
  **2A. WBS-таблица как spreadsheet (MS Project parity)** с parity-матрицей
  keyboard / mouse / clipboard / undo, набором inline-редактируемых колонок,
  paste/drag-fill семантикой, context menu и acceptance-сценариями для
  Phase B Schedule grid.
- Добавлен каталог `docs/references/planning-ui-approved/` с 19 HTML-mockups +
  shared CSS (mockup-tokens, mockup, schedule, _partials) + `index.html` /
  `index.json`.
- Добавлен `scripts/screenshot-planning-ui.mjs` — Playwright-скрипт съёмки
  всех экранов на 3 viewport-ах.
- Добавлено 57 PNG в `docs/status/artifacts/2026-05-23-planning-ui/` (19×3).

## Files

### Design doc

- `docs/31_PLANNING_WORKSPACE_UI_DESIGN.md`

### Mockups (HTML + CSS)

- `docs/references/planning-ui-approved/index.html`
- `docs/references/planning-ui-approved/index.json`
- `docs/references/planning-ui-approved/mockup-tokens.css`
- `docs/references/planning-ui-approved/mockup.css`
- `docs/references/planning-ui-approved/schedule.css`
- `docs/references/planning-ui-approved/_partials.css`
- `docs/references/planning-ui-approved/mockup-shell.html`
- `docs/references/planning-ui-approved/01-overview.html`
- `docs/references/planning-ui-approved/02-schedule-wbs-gantt.html`
- `docs/references/planning-ui-approved/02b-schedule-task-selected.html`
- `docs/references/planning-ui-approved/02c-schedule-preview-pending.html`
- `docs/references/planning-ui-approved/03-task-inspector-detail.html`
- `docs/references/planning-ui-approved/04-resources.html`
- `docs/references/planning-ui-approved/04b-resource-detail.html`
- `docs/references/planning-ui-approved/05-assignments.html`
- `docs/references/planning-ui-approved/06-calendars.html`
- `docs/references/planning-ui-approved/07-scenarios.html`
- `docs/references/planning-ui-approved/07b-scenario-compare.html`
- `docs/references/planning-ui-approved/08-baseline.html`
- `docs/references/planning-ui-approved/09-audit.html`
- `docs/references/planning-ui-approved/10-settings.html`
- `docs/references/planning-ui-approved/state-empty.html`
- `docs/references/planning-ui-approved/state-loading.html`
- `docs/references/planning-ui-approved/state-error.html`
- `docs/references/planning-ui-approved/state-forbidden.html`
- `docs/references/planning-ui-approved/state-narrow-fallback.html`

### Screenshots

- `docs/status/artifacts/2026-05-23-planning-ui/desktop-1920/*.png` (19 файлов)
- `docs/status/artifacts/2026-05-23-planning-ui/laptop-1440/*.png` (19 файлов)
- `docs/status/artifacts/2026-05-23-planning-ui/narrow-390/*.png` (19 файлов)

### Скрипт

- `scripts/screenshot-planning-ui.mjs`

## Tests / verification

Phase A — дизайн-only, поэтому verification ограничена визуальной проверкой и
автоматической съёмкой скриншотов.

| Что | Команда | Результат |
| --- | --- | --- |
| Worktree создан и переключён | `git worktree list` | новый worktree `E:/KISS-PM/.worktrees/planning-ui-2026-05-23` присутствует, на ветке `feature/planning-ui-design-2026-05-23` |
| Зависимости установлены | `pnpm install --frozen-lockfile` | 488 пакетов восстановлено из store за 15.4s |
| Playwright скрипт работает | `node scripts/screenshot-planning-ui.mjs` | 57 PNG сгенерированы за 18s без ошибок |
| Файлы PNG на месте | `Get-ChildItem … -Recurse -File` | 19 desktop + 19 laptop + 19 narrow = 57 |

### Acceptance vs `31_PLANNING_WORKSPACE_UI_DESIGN.md`

| Критерий | Где зафиксирован | Где проверен |
| --- | --- | --- |
| WBS строки и Gantt полоса в едином grid | разд. 13 design doc, `schedule.css`, `02*.html` | визуальная проверка `desktop-1920/02-*.png` — строки WBS «Согласовать требования», «Подготовить макеты», «Согласовать с клиентом ◇» лежат на одних высотах со своими барами/милстоунами |
| Preview/Apply bar появляется только в pending | разд. 14 design doc, `02c-…html` | `desktop-1920/02c-schedule-preview-pending.png` — bar внизу с метриками «3 задачи изменятся, финиш +7 дн, 1 предупреждение» |
| Critical path = stripe, не fill | разд. 2, `schedule.css` `.gantt-bar.critical` | в screenshot 02 у задач 1.2, 3.1.1, 3.2.1 видна левая красная stripe, без красной заливки бара |
| Baseline overlay тонкой линией | разд. 2, `schedule.css` `.gantt-baseline` | в `02-…png` под полосами 1.2 / 3.1.1 / 3.2.1 видны тонкие серые baseline-полосы |
| Inspector — не модал, а правая панель | разд. 3, `02b-…html` | `02b-…png` показывает inspector справа без блокировки графика |
| JSON только в advanced | разд. 9, `03-task-inspector-detail.html`, `09-audit.html` | в Audit и Inspector raw payload в `<details>`, скрыт по умолчанию |
| Forbidden / Empty / Loading / Error / Narrow реализованы | разд. 11, `state-*.html` | соответствующие PNG (`state-empty`, `state-loading`, `state-error`, `state-forbidden`, `state-narrow-fallback`) присутствуют во всех 3 viewport-ах |
| Narrow fallback закрывает редактирование плана | разд. 12, `state-narrow-fallback.html` | `narrow-390/state-narrow-fallback.png` — disabled tabs «График / Ресурсы / Календари / Сценарии / Baseline / Настройки», доступны Обзор / Назначения / Аудит |
| Fake affordances отсутствуют | разд. 4, 18 design doc | в `state-forbidden`, `02c-preview`, settings disabled-кнопки имеют title-tooltip с причиной (`Доступно после применения превью`, `Появится в Phase C`, `Требуется canManageProjectPlan`) |
| Permission keys согласованы с `@kiss-pm/access-control` | разд. «Контракт с backend» design doc | в `10-settings`, `03-task-inspector-detail`, `07-scenarios`, `09-audit` permission-имена соответствуют экспортам `canReadProjectPlan`, `canManageProjectPlan`, `canManageProjectBaselines`, `canPreviewPlanningScenarios`, `canApplyPlanningScenarios`, `canReadAuditEvents`, `canManageWorkspaceConfig` |
| Контракт с backend planning engine соблюдён | разд. «Контракт с backend» design doc | mapping «экран → planning command → permission → audit» совпадает с endpoint-ами `apps/api/src/planningRoutes.ts` |

### Self-check (раздел selfcheck из TODO)

- [x] **WBS и Gantt строки выровнены.** Подтверждено визуально на
  `02-schedule-wbs-gantt.png`: 20 task-строк WBS и 20 строк Gantt лежат на
  одинаковых вертикальных позициях, header-row 36px у обеих половин, общий
  scroll в `.schedule__body { overflow: auto }`.
- [x] **Нет fake affordances.** Все disabled-кнопки в state-forbidden,
  02c-preview-pending и 10-settings имеют `title=` с реальной причиной.
- [x] **Нет JSON по умолчанию.** Raw payload в Inspector и в Audit обёрнут в
  `<details>` и появляется только при явном «Показать advanced» / «Показать raw
  payload».
- [x] **Русский язык везде.** Все user-facing строки на русском; английские
  оставлены только для технических токенов (`canManageProjectPlan`,
  `task.update_schedule`, `planning.task.scheduled`, `fixed_work`, и т.п.),
  что соответствует AGENTS.md разд. 2.
- [x] **Narrow fallback работает.** `narrow-390/state-narrow-fallback.png`
  показывает доступные вкладки `Обзор` (active), `Назначения`, `Аудит` и
  disabled tabs остальных вкладок с tooltip-причиной.
- [x] **Все экраны имеют скриншоты.** 19 экранов × 3 viewport = 57 PNG (см.
  раздел Files).

## Decisions / assumptions

1. **Phased delivery.** По договорённости в начале сессии Phase A
   ограничивается design doc + HTML mockups + screenshots, без правок
   `apps/web` / `apps/api`. Phase B и Phase C расписаны в design doc разд. 17.
2. **HTML+CSS mockups вместо Figma.** В репозитории Figma не подключена и
   `references/planning-ui-approved/` ранее отсутствовал. Mockups сделаны
   живым HTML, чтобы их можно было автоматически снимать Playwright и
   использовать в дальнейшем как regression visual reference.
3. **Единый CSS grid для WBS+Gantt.** Реализован через flex `.schedule__body`
   с общим вертикальным скроллом и горизонтальным скроллом только внутри
   `.schedule__gantt-pane`. Это базовый, без виртуализации, подход — он
   валиден до ~5 000 строк. Виртуализация — open question Phase B.
4. **WBS-width 720px.** Выбрано как баланс между видимостью названий задач
   на русском и шириной для Gantt-таймлайна. Колонки задаются единым
   `grid-template-columns: 40px 1fr 56px 96px 130px 130px 28px`.
5. **Cell zoom = неделя (140px).** Базовый zoom для скриншотов и spec; день
   (40px) и месяц (220px) описаны в design doc, но в mockups не отдельно
   нарисованы.
6. **Critical path = красная stripe, не заливка.** Сохраняем семантику
   `--danger` (warning state), не превращая critical-задачу в визуальный
   danger.
7. **Baseline overlay = тонкая `--muted-strong` линия 4px** под полосой
   задачи, opacity 0.55-0.7. Это не «вторая полоса», а аккуратный
   подоснованной маркер.
8. **Permission keys взяты из `packages/access-control`**: `canReadProjectPlan`,
   `canManageProjectPlan`, `canManageProjectBaselines`,
   `canPreviewPlanningScenarios`, `canApplyPlanningScenarios`,
   `canReadProjectResources`, `canManageProjectResources`,
   `canReadAuditEvents`, `canManageWorkspaceConfig`.
9. **Audit raw payload скрыт по умолчанию.** Доступен только из drawer
   события в Audit и из Advanced-таба Inspector. Это соответствует разд.
   «JSON по умолчанию» AGENTS.md и design doc.

## Risks / follow-up

- **MS Project parity для WBS — пересмотр после ревью.** В первой
  итерации дизайн-документа spreadsheet-режим был описан только базово
  (двойной клик по `Финиш`, Tab/Shift+Tab для indent/outdent). После
  ревью добавлен явный раздел **2A** с parity-матрицей (F2/Enter/стрелки,
  multi-cell select, copy/paste TSV+JSON, drag-fill, Delete, context menu,
  predecessor-string parser, undo/redo). Это **значительное** требование
  к Phase B и предполагает отдельный design spike по выбору grid-библиотеки.
  В Phase A mockups это поведение не было визуализировано (HTML-mockups
  показывают только статичную сетку), поэтому первый шаг Phase B —
  собрать кликабельный prototype поверх выбранной grid-библиотеки и
  отснять интерактивные screenshots / video.
- **Старый каталог worktree.** При перемещении worktree из `E:\KISS-PM-planning-ui`
  в `.worktrees/planning-ui-2026-05-23` git успешно отвязал старую запись,
  но физический каталог `E:\KISS-PM-planning-ui` не удалось удалить —
  Windows file lock со стороны Cursor IDE. Удалить вручную после перезапуска
  IDE: `Remove-Item E:\KISS-PM-planning-ui -Recurse -Force`.
- **Виртуализация Schedule.** Базовый mockup использует чистый CSS grid без
  виртуализации. При ≥ 5 000 задач это начнёт лагать. В Phase B нужно
  принять решение: virtualized scroll или window-based pagination.
- **Saved views.** Filter chips в Schedule (Просрочено / Без ресурсов / Кр.
  путь / Изменено от baseline / Только мои) описаны в design doc, но saved
  views (сохранённые наборы фильтров) отложены в Phase C.
- **ICS-import календарей** не планируется в Phase B; решение в Phase C.
- **Drag-to-link зависимостей в WBS таблице** (не только в Gantt) — open
  question, дизайн заложен только для Gantt.
- **Удаление baseline.** Архивирование разрешено, удаление — open question;
  по умолчанию запрещено даже admin'у.
- **Mobile experience.** narrow fallback — только чтение. Если бизнес
  попросит часть редактирования на мобиле, потребуется отдельный design
  pass.
- **Реальные данные.** Mockups содержат статичные демо-значения. В Phase B
  при подключении к `/planning/read-model` нужно убедиться, что layout
  держит крайние случаи: 0 задач, 1 задача, 200+ задач, deep WBS (depth 6+),
  длинные русские названия, без assignments.

## Phase B / Phase C scope (повторно для PM)

### Phase B (immediate next)

1. **Design spike по spreadsheet-grid библиотеке** (custom CSS grid + windowing
   / TanStack Table + virtualizer / AG Grid Community / Handsontable) под
   parity-матрицу из раздела 2A. Решение фиксируется в
   `docs/32_PHASE_B_PLANNING_UI_DECISIONS.md`.
2. Project Shell + Tabs + sticky Preview/Apply bar.
3. **Schedule = WBS-spreadsheet + Gantt** с полным spreadsheet-режимом по
   разделу 2A: inline edit ячеек, F2/Enter/Tab/стрелки, copy/paste TSV +
   KISS-PM JSON, drag-fill, multi-select, Delete на строке, indent/outdent,
   context menu, parser predecessor-string (`3,5FS+2д`), inline validation,
   локальный undo/redo стек.
4. Task Inspector (tabs Общие / Зависимости / Ресурсы / Constraints /
   Advanced) для операций, не покрытых spreadsheet'ом.
5. Smoke E2E (обязательны для acceptance Phase B):
   - ввод 5 задач только через клавиатуру (Tab/Enter/стрелки) → `task.create` batch;
   - paste TSV 10×6 из «Excel» → `task.create` + `dependency.upsert` batch;
   - F2+Enter на ячейке `Финиш` → preview→apply;
   - Delete на 3 выделенных строках → подтверждение → batch `task.delete`;
   - ввод `Predecessors = "3,5FS+2д;8SS"` → 3 корректные зависимости;
   - drag-link зависимости на Gantt → preview→cancel.
6. Permission gates в toolbar, inline-ячейках и Inspector; явные tooltip-причины disabled.
7. Repository health tests: line budgets для `App.tsx` и grid-обёртки,
   ban-list для self-rolled dropdown/modal/dialog, smoke на ключевые states.

### Phase C (after Phase B)

7. Ресурсы, Назначения, Календари, Сценарии, Baseline, Аудит, Настройки.
8. Filter chips + saved views для Schedule.
9. Calendar UI с inline-добавлением exceptions.
10. Scenarios apply pipeline (`/planning/scenarios/:id/apply`).
11. Baseline capture wizard + overlay в Gantt.
12. Audit drawer + откат отдельного события.
13. Интеграции — оставлены как future scope.

## Ссылки

- Дизайн-документ: [docs/31_PLANNING_WORKSPACE_UI_DESIGN.md](../31_PLANNING_WORKSPACE_UI_DESIGN.md)
- Mockups index: [docs/references/planning-ui-approved/index.html](../references/planning-ui-approved/index.html)
- Главный экран: [docs/references/planning-ui-approved/02-schedule-wbs-gantt.html](../references/planning-ui-approved/02-schedule-wbs-gantt.html)
- Скриншоты desktop: [docs/status/artifacts/2026-05-23-planning-ui/desktop-1920/](artifacts/2026-05-23-planning-ui/desktop-1920/)
- Скриншоты laptop: [docs/status/artifacts/2026-05-23-planning-ui/laptop-1440/](artifacts/2026-05-23-planning-ui/laptop-1440/)
- Скриншоты narrow: [docs/status/artifacts/2026-05-23-planning-ui/narrow-390/](artifacts/2026-05-23-planning-ui/narrow-390/)
- Контракт backend: [docs/30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md](../30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md)
- Design system: [docs/27_UX_UI_DESIGN_SYSTEM.md](../27_UX_UI_DESIGN_SYSTEM.md)
- Reference MS Project: [docs/references/MS_PROJECT_МОДЕЛЬ_ПЛАНИРОВАНИЯ.md](../references/MS_PROJECT_МОДЕЛЬ_ПЛАНИРОВАНИЯ.md)
