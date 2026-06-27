# 31. Planning Workspace UI design

## Статус

Этот документ фиксирует целевой UI внутреннего пространства проекта KISS PM:
все вкладки, экраны, состояния, основные сценарии и контракт с backend planning
engine. Документ обязателен для реализации Project Shell, Schedule (WBS/Gantt),
Task Inspector, Resources, Assignments, Calendars, Scenarios, Baseline, Audit и
Project Settings.

Документ является продолжением:

- `27_UX_UI_DESIGN_SYSTEM.md` — визуальный baseline KISS PM (tokens, плотность,
  controls, состояния, dark theme parity).
- `30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md` — контракт backend planning engine
  и его команды.
- `references/MS_PROJECT_МОДЕЛЬ_ПЛАНИРОВАНИЯ.md` — требуемая управленческая
  модель (Work / Duration / Units, типы задач, зависимости, calendar,
  constraint, critical path).
- `07_GANTT_ЗАДАЧИ_РЕСУРСЫ.md` и `10_UX_UI_РЕФЕРЕНСЫ.md` — продуктовый контур.

Документ НЕ заменяет реализацию: UI обязан проходить permission checks,
ходить через planning command layer и оставлять audit. Скриншоты и HTML mockups
в `references/planning-ui-approved/` являются утверждённым визуальным baseline,
но не являются доказательством работоспособности.

## Дизайн-принципы

### KISS в управленческом инструменте

KISS PM — это «easy to learn, hard to master» для MS-Project-class планирования.
Это не означает «бедный движок» или «таск-трекер с диаграммой».

1. На первом экране задачи пользователь видит то, что нужно ровно сейчас:
   сроки, прогресс, перегруз, отклонения, ближайший шаг. Это уровень PM.
2. Продвинутые поля задачи (task type, effort-driven, constraint, calendar
   override, units, lag/lead) живут под progressive disclosure: «Подробнее» в
   Task Inspector, «Параметры» в зависимости, «Advanced» в баннере коррекций.
3. Любая операция, меняющая план (даты, work, units, dependency, assignment,
   constraint, baseline, calendar exception), идёт через единый Preview/Apply
   bar и попадает в audit. PM никогда не «теряет» план неожиданным изменением.
4. Action не показывается активным, если её сценарий ещё не доступен: либо
   `disabled` с явной причиной, либо скрыта по permission.
5. JSON, raw payload, внутренние коды команд НЕ показываются пользователю по
   умолчанию. Только в Audit advanced drawer и в Task Inspector advanced section.

### Что мы запрещаем

- Marketing hero на operational surface.
- WBS-таблица и Gantt в разных контейнерах с независимой прокруткой строк.
- Отдельная страница «настроек проекта», прячущая Calendar / Resources / KPI
  без всякой логики.
- «Кнопка Применить» без preview и без audit.
- «Кнопка Применить» без позволения проверить, что именно поменяется.
- Перегруженная правая панель с десятками полей сразу.
- Перегруженный сценарный экран с «20 предложений ИИ».

## Контракт с backend

Все экраны Planning Workspace опираются на следующие endpoints из
`apps/api/src/planningRoutes.ts`:

| Endpoint | Назначение | Используют экраны |
| --- | --- | --- |
| `GET /api/workspace/projects/:projectId/planning/read-model` | calculated plan + snapshot для view-only данных | все вкладки кроме Settings |
| `POST .../planning/preview-command` | preview одного `PlanningCommand`, возвращает `planDelta`, `validationIssues`, `after` | Schedule, Task Inspector, Resources, Assignments, Calendars |
| `POST .../planning/apply-command` | governed apply одной команды, permission + audit | Schedule, Task Inspector, Resources, Assignments, Calendars |
| `POST .../planning/scenarios/preview` | proposals (aggressive/balanced/resilient) | Scenarios |
| `POST .../planning/scenarios/:id/apply` | apply сценария как пачки команд | Scenarios |
| baseline endpoints из backend | capture, list, compare | Baseline |
| audit endpoints | management audit events | Audit |

### Permission keys, использованные в UI

Из `packages/access-control/src/index.ts`:

| Permission | Где гейтит |
| --- | --- |
| `canReadProjectPlan` | весь Planning Workspace (Overview, Schedule, Inspector, Scenarios, Baseline, Audit read-only) |
| `canManageProjectPlan` | все `task.*`, `dependency.*`, `assignment.*`, `constraint.*`, `project.deadline.move` в Schedule и Inspector |
| `canManageProjectBaselines` | `baseline.capture` в Baseline и в нижней Preview/Apply bar |
| `canReadProjectResources` | Resources, Assignments, Calendars (read) |
| `canManageProjectResources` | редактирование ресурсов, `calendar.exception.upsert`, `resource.reserve` |
| `canPreviewPlanningScenarios` | preview/compare на вкладке Scenarios |
| `canApplyPlanningScenarios` | apply сценария |
| `canReadAuditEvents` | вкладка Audit |
| `canManageWorkspaceConfig` | редактирование Project Settings, project-level integrations placeholders |

### Mapping «экран → planning command → permission → audit»

| Экран | Команда | Permission | Audit action (примеры) |
| --- | --- | --- | --- |
| Schedule (inline edit dates) | `task.update_schedule` | `canManageProjectPlan` | `planning.task.scheduled` |
| Schedule (drag link) | `dependency.upsert`, `dependency.delete` | `canManageProjectPlan` | `planning.dependency.changed` |
| Schedule (indent/outdent) | `task.move_wbs` | `canManageProjectPlan` | `planning.task.moved` |
| Schedule toolbar / Add | `task.create` | `canManageProjectPlan` | `planning.task.created` |
| Task Inspector (Work/Duration/Units, task type) | `task.update_work_model` | `canManageProjectPlan` | `planning.task.work_model.changed` |
| Task Inspector (constraint/deadline) | `constraint.update` | `canManageProjectPlan` | `planning.task.constraint.set` |
| Task Inspector (assignment) | `assignment.upsert`, `assignment.delete` | `canManageProjectPlan` | `planning.assignment.changed` |
| Resources / Assignments | `assignment.upsert`, `resource.reserve` | `canManageProjectResources` | `planning.assignment.changed`, `planning.resource.reserved` |
| Calendars | `calendar.exception.upsert` | `canManageProjectResources` | `planning.calendar.exception.set` |
| Scenarios | scenarios apply | `canApplyPlanningScenarios` | `planning.scenario.applied` |
| Baseline | `baseline.capture` | `canManageProjectBaselines` | `planning.baseline.captured` |
| Overview / Schedule (deadline shift) | `project.deadline.move` | `canManageProjectPlan` | `planning.project.deadline.moved` |
| Overload accept | `risk.accept_overload` | `canManageProjectResources` | `planning.risk.overload.accepted` |

## Information architecture

```text
Project Shell
├── Обзор           (overview, что горит, ближайшие риски)
├── График          (Schedule = WBS + Gantt, основной экран)
├── Ресурсы         (resource list + simple drilldown)
├── Назначения      (resource usage matrix)
├── Календари       (project + per-resource calendar)
├── Сценарии        (what-if proposals)
├── Baseline        (захват, сравнение, история)
├── Аудит           (human timeline + advanced drawer)
└── Настройки       (project-level config)
```

Mobile/narrow viewport: видимы только Обзор, Аудит и Назначения (read-only),
остальные вкладки заменяются на `state-narrow-fallback`.

## Project Shell

### Назначение

Единый каркас для всех вкладок проекта. Решает проблему «пользователь не
понимает где он, dirty ли план, идёт ли preview, может ли применять».

### Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ App sidebar │ Project header: name · status · planVersion · deadline · поиск │
│             ├──────────────────────────────────────────────────────────────┐ │
│             │ Tabs: Обзор · График · Ресурсы · Назначения · Календари ·   │ │
│             │       Сценарии · Baseline · Аудит · Настройки               │ │
│             ├──────────────────────────────────────────────────────────────┤ │
│             │ Active tab content                                            │ │
│             │                                                               │ │
│             ├──────────────────────────────────────────────────────────────┤ │
│             │ Preview / Apply bar (sticky bottom, появляется при dirty)    │ │
│             └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Header

- Слева: иконка проекта (тип), название, chip статуса (`Черновик`, `В работе`,
  `Заморожен`, `Закрыт`).
- В центре: `Дедлайн 12.07.2026 · план v17`. Дата дедлайна красная, если в
  риске; нейтральная, если safe; muted, если deadline не задан.
- Справа: search `Найти задачу или ресурс`, notifications, profile.
- Под header: tabs (segmented, 36px, без декоративных иконок), правее — индикатор
  состояния плана: `Сохранено` / `Идёт расчёт` / `Есть превью изменений` /
  `Ошибка расчёта`.

### Preview / Apply bar (sticky bottom)

Появляется только когда есть pending preview. Состояния:

| State | Внешний вид | Кнопки |
| --- | --- | --- |
| `idle` | bar скрыт | — |
| `preview-pending` | bar показан, текст «Считаем превью…», шиммер на цифрах | `Отмена` |
| `preview-ready` | bar показан, «`23 задачи изменятся`, `Финиш +4 дня`, `1 предупреждение`» | `Сравнить`, `Отмена`, `Применить` |
| `applying` | bar показан, кнопка «Применяем…» с лоадером | disabled |
| `applied` | bar 3 секунды показывает «Изменения сохранены, аудит записан», потом закрывается | `Откатить?` (если backend поддерживает; иначе скрыта) |
| `error` | красный bar, текст ошибки человеческим языком, рядом `Подробнее` (open drawer with details) | `Закрыть`, `Повторить` |

Bar НЕ дублируется в каждой вкладке. Любое preview-able действие из любой
вкладки попадает сюда.

### Anti-patterns

- Marketing hero, иллюстрации.
- Tabs c badges, скрывающие настоящие counters.
- Notifications icon, который ничего не открывает.
- Sticky banner поверх содержимого без причины.

## 1. Обзор

### Основной сценарий

PM открывает проект и за 5 секунд должен ответить: «где мы, что горит, что
сделать дальше».

### User stories

- **US1**. Given активный проект, when открыта вкладка «Обзор», then PM видит
  статус проекта, ближайший milestone и факт перегруза, если он есть.
- **US2**. Given baseline зафиксирован, when проект сдвинулся, then PM видит
  «Финиш сдвинулся: +4 дня к baseline» с прямой ссылкой в Baseline-вкладку.
- **US3**. Given у PM есть `canManageProjectPlan`, when есть просроченные
  задачи без статуса, then на Обзоре есть карточка «5 задач просрочены,
  открыть График с фильтром».

### Layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Заголовок: «Проект X»  Статус · Финиш · Дедлайн · Откл от baseline           │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ Now & next           │ Внимание (attention cards)                            │
│ - сегодня %          │ - 5 задач просрочено → График                        │
│ - на этой неделе     │ - 2 ресурса перегружены → Назначения                 │
│ - на след. неделе    │ - baseline: финиш +4д → Baseline                     │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ Контрольные точки    │ Последний аудит                                       │
│ (ближайшие 5 mile-   │ (компактный timeline 5 строк → Аудит)                │
│  stones и дедлайнов) │                                                       │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

### Поля

- Status chip (tenant labels).
- Финиш проекта (`projectFinish` из `CalculatedPlan`).
- Дедлайн (`PlanProject.deadline`).
- Сдвиг от baseline в днях.
- Доля выполненных задач (count + %).
- Кол-во просроченных задач (status ≠ done && plannedFinish < today).
- Кол-во ресурсов с overload в ближайшие 14 дней.

### States

- **loading**: skeleton-блоки на 6 секций.
- **empty**: «План пуст. Откройте «График», чтобы добавить первые задачи.»
- **error**: «Не удалось получить план. Повторить.»
- **forbidden**: «Нет прав на просмотр плана этого проекта.»
- **preview-pending**: счётчики attention помечены пунктиром «обновятся после
  preview», не подменяются устаревшими данными.

### Advanced

- Кнопка `Показать engine-метаданные` (только при `canReadAuditEvents`) —
  открывает drawer с planVersion, engineVersion, calculatedAt, длительностью
  последнего расчёта.

### Anti-patterns

- «Свежие новости проекта» в стиле marketing.
- Hero иллюстрация типа «Привет, PM!».
- Большие KPI-карточки без drilldown.

## 2. График (Schedule = WBS + Gantt)

Главный экран Planning Workspace. На нём проходит 80% работы PM.

### Основной сценарий

PM видит иерархию задач (WBS) и timeline (Gantt) как единое полотно: строки
WBS и полосы Gantt связаны строго один-к-одному, никогда не сдвигаются друг
относительно друга. Любое изменение проходит через Preview/Apply bar.

### User stories

- **US1**. Given план загружен, when пользователь скроллит вниз, then WBS и
  Gantt прокручиваются синхронно по вертикали, sticky остаются header WBS и
  header timeline.
- **US2**. Given есть зависимость FS task A → task B, when PM удлиняет A
  inline, then preview показывает сдвиг B и финиша проекта, до apply ничего не
  меняется.
- **US3**. Given baseline зафиксирован, when PM включает «Сравнить с baseline»,
  then на Gantt появляется тонкая полоса baseline под текущей полосой задачи,
  цветом нейтральной muted-strong линии.
- **US4**. Given задача на critical path, when она выделена, then её полоса
  Gantt получает левую красную border-stripe (status warning, не destructive),
  и в Inspector — chip `На критическом пути`.

### Layout

```text
┌─ Toolbar ────────────────────────────────────────────────────────────────┐
│ + Задача · + Подзадача · ← Outdent · → Indent · Зависимость · Baseline    │
│ · Фильтры · Зум: День · Неделя · Месяц · «Сравнить с baseline» (toggle)   │
├────────────────────────────────┬─────────────────────────────────────────┤
│ WBS header                     │ Timeline header (Месяц / Неделя)        │
├────────────────────────────────┼─────────────────────────────────────────┤
│ WBS rows (sticky horizontal)   │ Gantt rows (sync row height)            │
│                                │                                          │
│ # · Название · Длит · План.Ф · │ │ ▓▓▓▓▓ baseline                       │
│   ·  Прогресс · Назначения · ! │ │ ▓▓▓▓▓▓▓▓ current bar (critical=red ▌)│
│                                │ │ ◇ milestone                          │
│                                │ │ ⊳→⊲ FS/SS/FF/SF dependency lines     │
├────────────────────────────────┴─────────────────────────────────────────┤
│ Inspector (right rail, открывается при выделении строки)                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### WBS колонки (default)

1. `#` — WBS-номер (1, 1.1, 1.2, 2, 2.1.1).
2. `Название` — title; depth подчёркнут indentation 14px на уровень + caret
   для summary tasks.
3. `Длит` — `5 дн` / `40 ч` (зависит от taskType).
4. `Финиш` — `12.06.2026`.
5. `Прогресс` — % + узкий progress bar 60px.
6. `Назначения` — chip 2 первых + `+N`.
7. `!` — компактная иконка risk/blocker/validation issue (tooltip объясняет).

Скрытые advanced колонки за `Колонки`-меню: `Начало`, `Тип`, `Работа`,
`Constraint`, `Deadline`, `Calendar`, `Slack`, `Critical`. Не более 7 видимых
колонок одновременно.

### Gantt timeline

- Зум: День (cellWidth 40px), Неделя (cellWidth 140px), Месяц (cellWidth
  220px).
- Today marker: вертикальная пунктирная линия `--accent`.
- Deadline marker: вертикальная сплошная линия `--warning` (если дедлайн внутри
  видимого диапазона).
- Полоса задачи: высота 18px, скруглена 4px, заполнена `--surface-strong`,
  внутри — заштрихованная часть прогресса.
- Полоса summary task: тонкая 6px линия с засечками по началу и финишу.
- Milestone: ромб 12px.
- Baseline overlay: тонкая 4px линия под полосой задачи, цвет
  `--muted-strong`, opacity 0.6.
- Critical path: левая 3px red `--danger` stripe + сам бар без danger fill
  (цвет — только акцент, не заливка).
- Dependency arrows: тонкие 1px линии с маленькой стрелкой; цвет
  `--border-strong`; при hover родительской задачи становятся `--text`.

### Контракт row-sync (КРИТИЧНО)

WBS и Gantt — это **один** CSS grid:

```css
.schedule-grid {
  display: grid;
  grid-template-columns: var(--wbs-width) 1fr;
  grid-auto-rows: 36px; /* высота строки = единственный источник истины */
  scroll-behavior: smooth;
}
.schedule-grid__wbs-cell,
.schedule-grid__gantt-cell {
  min-height: 36px;
  align-items: center;
}
.schedule-grid__wbs-header,
.schedule-grid__gantt-header {
  position: sticky;
  top: 0;
}
.schedule-grid__wbs {
  position: sticky;
  left: 0;
  background: var(--panel);
  z-index: 2;
}
```

- Высота строки фиксирована и идентична в обеих половинах: `36px` default,
  `44px` comfort.
- Горизонтальная прокрутка распространяется только на gantt-половину; WBS
  остаётся sticky слева. Реализуется через `overflow-x: auto` только на
  `.schedule-grid__gantt-scroll`, либо через `position: sticky` на WBS-колонке.
- Вертикальная прокрутка общая: одна `overflow-y: auto` на корне.
- Hover строки красит сразу обе половины (общий row через CSS `:has` или общий
  state-class).
- Selection помечает обе половины (`aria-selected="true"` на обеих ячейках
  одной строки).

### Inline edit

- Двойной клик по `Финиш` или drag правого края полосы Gantt → `task.update_schedule`
  preview. До apply ничего не меняется.
- Drag-link от одной полосы к другой → `dependency.upsert` preview.
- Indent / Outdent (Tab / Shift+Tab) → `task.move_wbs` preview.

### Right inspector

Открывается при selection одной задачи. Не модал. Сворачивается. Закрывается
Esc. Inspector детально описан в разделе [3. Task Inspector](#3-task-inspector).

### Validation issues

В строке `!` показывается компактный значок при наличии `ValidationIssue` с
этой задачей. Hover — short reason (`Цикл зависимостей`, `Конфликт календаря`).
Click — открывает Inspector на вкладке «Проблемы».

### States

- **loading**: skeleton 12 строк.
- **empty**: «План пока пуст. Добавьте первую задачу.» + кнопка `+ Задача`.
- **forbidden**: «Нет прав на изменение плана. Просмотр доступен.» — toolbar в
  read-only, drag/inline edit отключены.
- **preview-pending**: задачи, попавшие в `planDelta.changedTaskIds`,
  получают тонкую `--accent` outline и шиммер; редактирование других задач
  заблокировано до завершения preview, чтобы не накапливать конфликты.
- **error**: «Сервер не смог посчитать план: <reason>. Повторить.»

### Anti-patterns

- Два независимых scroll контейнера для WBS и Gantt.
- Подсветка цветной заливкой всего бара critical path (он сольётся с danger).
- Decorative emoji в WBS колонках.
- Mini-charts в строке вместо `Длит` / `Прогресс`.
- Скрытое за hover поле «Назначения» (теряется visibility при печати/скриншоте).
- Drag-and-drop без preview.

### Advanced

- Доп. колонки за `Колонки`-меню.
- Filter chips: `Просрочено`, `Без ресурсов`, `На критическом пути`,
  `Изменилось от baseline`, `Только мои`.
- Saved views (Phase C, в Phase A не показываем).

## 2A. WBS-таблица как spreadsheet (MS Project parity)

WBS — это **не списочная таблица**, а полноценный spreadsheet-grade grid.
Сценарий PM: «открыть Excel, вбить задачи и Predecessors, нажать Enter,
получить план». Без этого режима KISS PM не может называться MS-Project-class.

### Принцип

Любое значимое поле задачи редактируется **прямо в ячейке WBS**, без
открытия Inspector. Inspector нужен для глубоких деталей (constraints,
advanced, audit), но 90% повседневной работы должно решаться в табличной
сетке.

### Целевая интерактивность (parity matrix)

| Поведение | MS Project desktop | KISS PM target | Backend mapping |
| --- | --- | --- | --- |
| Click в ячейку | выделяет ячейку | выделяет ячейку | — |
| F2 / Enter / двойной клик | enter edit mode | enter edit mode | — |
| Esc | отмена редактирования | отмена редактирования | — |
| Enter после редактирования | commit, перейти на строку вниз | commit (preview), переход вниз | `task.update_*` preview |
| Tab / Shift+Tab | переход вправо/влево по ячейкам | то же | — |
| Стрелки (Up/Down/Left/Right) | навигация по ячейкам | то же | — |
| Home / End / Ctrl+Home / Ctrl+End | начало/конец строки/таблицы | то же | — |
| Shift+стрелки / Shift+клик | расширение выделения диапазона | то же | — |
| Ctrl+клик | добавить ячейку/строку в выделение | то же | — |
| Ctrl+A | выделить всё | выделить таблицу | — |
| Delete на ячейке | очистить значение | очистить значение (где разрешено) | `task.clear_field` или `task.update_*` с null |
| Backspace в выделенной ячейке | войти в edit-mode, очистив | то же | — |
| Delete на выделенной строке | удалить строки (с подтверждением) | то же | `task.delete` (batch) |
| Insert (toolbar / context) | вставить строку выше | вставить строку выше / ниже / как подзадачу | `task.create` (batch при multi-select) |
| Tab на строке (в первой ячейке) | indent | indent | `task.move_wbs` |
| Shift+Tab на строке | outdent | outdent | `task.move_wbs` |
| Ctrl+C | копировать выделение (ячейки или строки) | то же, в clipboard сериализуется TSV + KISS-PM-структурный JSON | — |
| Ctrl+V | вставить из clipboard | вставить (умный merge: совпадающие колонки) | batch `task.create` или `task.update_*` |
| Ctrl+X | вырезать | то же | batch `task.delete` + clipboard |
| Drag-fill (ручка в правом нижнем углу выделения) | заполнить вниз/вверх по образцу | то же; date series распознаётся как день/неделя | batch `task.update_*` |
| Ctrl+D | fill-down | fill-down | batch `task.update_*` |
| Ctrl+Z / Ctrl+Y | undo/redo | undo/redo (через стек preview-команд) | `planning.command.undo` / `redo` |
| Right-click | context menu | context menu (insert above/below/child, indent, outdent, link, unlink, copy, paste, delete) | соответствующие команды |
| Drag строки за номер | reorder | reorder | `task.move_wbs` |
| Sort по колонке (toolbar или header) | сортировка | сортировка (виртуальная, не меняет WBS) | UI-only |
| Filter по колонке | фильтрация | фильтрация | UI-only |
| Hide / Show колонок | persist column visibility | то же, per-user view | UI-only |
| Resize колонок (drag header) | изменить ширину | то же | UI-only |
| Frozen columns | первая колонка sticky | `#` и `Название` sticky | UI-only |
| Inline picker для Resource / Predecessor | dropdown с typeahead | dropdown с typeahead | — |
| Predecessor-string `3,5FS+2д` | парсится в зависимости | парсится в `dependency.upsert` batch | `dependency.upsert` |
| Auto-complete для status / task type | dropdown в ячейке | dropdown в ячейке | — |
| Validation на blur / Enter | inline error indicator + tooltip | то же | `planning/preview-command` + `validationIssues` |
| Auto-save vs explicit save | Project = autosave (preview) | KISS PM = preview сразу в Apply bar | — |

### Inline-редактируемые колонки

Минимум, который должен работать с MS Project parity на старте Phase B:

| Колонка | Тип ячейки | Командa | Особенности |
| --- | --- | --- | --- |
| `Название` | text | `task.update_title` | inline, Enter = commit |
| `Длит` | number + unit (`5 дн`, `40 ч`) | `task.update_work_model` | парсится `5d`/`5 дн`/`5 дней`/`40h`/`40 ч` |
| `Работа` | number + unit | `task.update_work_model` | то же |
| `Начало` | date | `task.update_schedule` | datepicker dropdown |
| `Финиш` | date | `task.update_schedule` | datepicker dropdown |
| `Прогресс` | number 0..100 | `task.update_progress` | accepts `25`/`25%`/`0.25` |
| `Тип` (task type) | enum dropdown | `task.update_work_model` | fixed_work / fixed_duration / fixed_units |
| `Назначения` | resource picker chips | `assignment.upsert` / `assignment.delete` | typeahead + units `100%` |
| `Predecessors` | spreadsheet-string `3,5FS+2д;8SS` | `dependency.upsert` (batch) | парсер обязателен |
| `Календарь` | calendar picker | `task.update_calendar_override` | — |
| `Constraint` | type + date | `constraint.update` | dropdown + datepicker |
| `Deadline` | date | `task.update_deadline` | datepicker |
| `Статус` | enum dropdown | `task.update_status` | tenant labels |
| `WBS#` | computed | — | read-only |
| `Прогресс bar` | computed | — | read-only |
| `Slack` / `isCritical` | computed | — | read-only |

### Multi-row / multi-cell semantics

- **Selection grid.** Spreadsheet поддерживает: одиночную ячейку, диапазон
  ячеек (Shift), несколько диапазонов (Ctrl), целую строку (клик по `#`),
  диапазон строк (Shift+клик по `#`), все ячейки (Ctrl+A).
- **Edit propagation.** Если выделено N ячеек одной колонки и пользователь
  печатает значение, ввод применяется ко всем при Enter — но **как ОДИН
  preview**, не как N независимых. В Apply bar мы покажем «3 задачи изменят
  Финиш на 17.06». Это явное MS Project behavior.
- **Paste split.** При Ctrl+V из Excel (TSV) парсим количество колонок и
  строк. Если выделена 1 ячейка — вставляем целиком от неё. Если выделен
  диапазон — повторяем источник tile-ом. Несовпадение колонок = inline error.
- **Delete row.** Удаление строки = удаление задачи + всех её зависимостей и
  назначений. Идёт через `task.delete` команды и обязательное подтверждение
  при ≥ 1 destructive impact (есть зависимости / назначения / прогресс > 0).
  Без подтверждения удалять можно только пустую только что созданную строку.

### Undo / Redo

- Стек preview/apply команд хранится локально и синхронно с server-side
  audit.
- `Ctrl+Z` откатывает **последнее применённое (apply'нутое)** действие через
  обратную команду (`planning.command.undo` если backend поддерживает) или
  через явный compensating command, который записывается в audit.
- Если поддержка undo на стороне backend ещё не готова в Phase B, local
  preview-стек откатывает только pending preview, не уже-applied. Это
  должно быть честно показано в UI (`Ctrl+Z` пишет «Откат возможен только
  для несохранённых правок»).

### Clipboard format

- В clipboard кладём **два** mime-type одновременно:
  - `text/plain`: TSV (как Excel ожидает).
  - `application/vnd.kiss-pm.planning+json`: структурный JSON с полями
    задачи и зависимостями; при paste обратно — приоритет JSON.
- Это позволяет копировать из KISS PM → Excel → KISS PM без потерь
  semantics.

### Context menu (right-click)

Минимально:

```
Вставить строку выше
Вставить строку ниже
Вставить подзадачу
─────────────────
Indent
Outdent
─────────────────
Создать зависимость…
Удалить зависимость…
─────────────────
Копировать
Вырезать
Вставить
─────────────────
Заполнить вниз
─────────────────
Удалить задачу(и)…
```

Каждый пункт показывается только если есть permission и действие имеет
смысл в текущем выделении.

### Validation в ячейке

- Inline-error indicator (красная точка в правом верхнем углу ячейки +
  tooltip) появляется, когда backend `preview-command` вернул
  `validationIssues` с severity `error`.
- Cell остаётся в edit-mode, фокус не уходит. Apply bar блокируется.
- Если severity `warning` — ячейку помечаем оранжевой точкой, но Apply
  разрешён.

### Performance / scale

- Целевая отзывчивость: ≤ 50 ms на keystroke в edit-mode, ≤ 250 ms от
  Enter до отображения preview-сводки в Apply bar.
- При ≥ 2 000 строк grid должен оставаться плавным. Это open question —
  решение по библиотеке (custom CSS grid + windowing / TanStack Table +
  virtualizer / AG Grid Community / Handsontable) принимается в начале
  Phase B как первый design spike.

### Что НЕ делаем (anti-parity)

- Формулы Excel (`=SUM(...)`). KISS PM не калькулятор.
- Кросс-таблицы вне WBS. Spreadsheet — это именно WBS-grid, а не
  Resources/Assignments (там другая семантика).
- Произвольные пользовательские колонки в Phase B. Сначала ровно те, что
  перечислены в parity-таблице выше. Custom fields — Phase C.
- Авто-расчёт длительности через формулу «=Финиш−Начало» руками. Длит,
  Работа, Финиш связаны через task type и effort-driven, и backend сам
  решает, что пересчитывать.

### Acceptance (для Phase B Schedule grid)

Phase B Schedule считается готовой только если:

1. PM может ввести 10 задач в пустом проекте, используя Enter/Tab/стрелки,
   без открытия Inspector ни разу.
2. PM может скопировать 5 строк из Excel и вставить в KISS PM, получив 5
   корректных задач с Predecessors.
3. PM может выделить 3 строки и нажать Delete, получить подтверждение и
   удалить их через `task.delete` (batch), увидев аудит.
4. PM может ввести в `Predecessors` строку `3,5FS+2д;8SS` и получить 3
   корректные зависимости после Apply.
5. Drag-fill копирует значение «25.05.2026» вниз на 4 строки с серией
   `26.05, 27.05, 28.05, 29.05` (день-серия по умолчанию).
6. `Ctrl+Z` откатывает последний apply, аудит фиксирует обратное событие.
7. Inline-validation видна в ячейке без открытия Inspector.

### Open questions

- Библиотека grid (custom vs AG Grid Community vs TanStack Table +
  virtualizer vs Handsontable) — решается design spike'ом в начале
  Phase B.
- Server-side undo: добавляем ли `planning.command.undo` сразу в Phase B
  или ограничиваемся local preview-стеком? Если local — нужен явный
  UI-сигнал.
- Custom fields: Phase C или вообще не делаем?

## 3. Task Inspector

### Основной сценарий

PM выделяет задачу и в правой панели быстро редактирует ключевые поля или
заходит в детали. Никакого modal-окна. Inspector скрывает advanced поля,
открывает только нужное.

### User stories

- **US1**. Given задача выделена, when открыт Inspector, then PM видит title,
  даты, длительность, прогресс, назначения и зависимости без дополнительных
  кликов.
- **US2**. Given у задачи есть constraint `must_start_on`, when PM меняет
  даты вручную, then preview validates constraint и blocking issue приходит в
  bar до apply.
- **US3**. Given у PM нет `canManageProjectPlan`, when открыт Inspector, then
  поля read-only, кнопки spaced disabled с reason tooltip.

### Layout

```text
┌─ Header: WBS · Title · status chip · « закрыть ───────────────────────┐
├─ Tabs: Общие · Зависимости · Ресурсы · Constraints · Заметки · Аудит ·
│        Advanced
├─ Tab content (scrollable)
└─ Footer: «Удалить/Архивировать» (disabled if no perm)
```

### Tab «Общие»

- Название.
- WBS-номер (read-only).
- Статус (select из tenant statuses).
- Прогресс (% slider 0/25/50/75/100 + ручной ввод).
- Начало / Финиш (datepicker, можно отвязать в advanced).
- Длительность (auto-derived из работы или дат — пометка «расчёт»).
- Краткая визуальная плашка: `На критическом пути` / `Резерв 3 дн` / `Без
  резерва`.

### Tab «Зависимости»

- Predecessors list: row = `WBS · Title · type chip (FS/SS/FF/SF) · lag`.
- Successors list тем же форматом.
- `+ Зависимость` — inline picker через type-ahead по задачам проекта.
- Удаление: `× Удалить` с подтверждением (preview, не destructive в один клик).
- При выборе зависимости — preview сразу показывает sched.delta.

### Tab «Ресурсы»

- Assignments list: `Resource · Role chip · Units (%) · Часы`.
- `+ Назначить` — picker ресурса + role + units.
- Hint: если effort-driven и добавили ресурса — длительность пересчитается;
  явно сказано «Длительность станет 4 дн вместо 5».

### Tab «Constraints»

- Constraint type select: `Как можно раньше`, `Старт не раньше`, `Финиш не
  позже`, `Должно начаться`, `Должно закончиться`.
- Constraint date (если применимо).
- Deadline (как soft deadline).
- Warning: «Жёсткий constraint может конфликтовать с предшественниками».

### Tab «Заметки»

- Plain текстовый блок (Markdown позже).
- Audit footprint каждого изменения видим в Tab «Аудит».

### Tab «Аудит»

- Компактный timeline только этой задачи: `12.05 14:32 · Иван изменил
  длительность с 4д на 5д · применено`.
- 10 последних событий, ссылка `Открыть в Аудите`.

### Tab «Advanced»

Скрытый по умолчанию. Открывается явным кликом «Показать advanced».

- Task type: `Фикс. работа` / `Фикс. длительность` / `Фикс. ресурс` (рус.
  переводы `fixed_work` / `fixed_duration` / `fixed_units`).
- Effort-driven toggle.
- Scheduling mode: `auto` / `manual`.
- Calendar override.
- Slack minutes (read-only).
- Earliest/Latest start/finish (read-only).
- Raw planning command preview (JSON, collapsible) — только для admin/debug.

### States

- empty (no selection): «Выделите задачу, чтобы открыть детали».
- loading: skeleton fields.
- forbidden: «Просмотр без редактирования».
- preview-pending: поля заблокированы, баннер «Идёт расчёт».

### Anti-patterns

- Модальное окно вместо inspector.
- Все 30 полей сразу.
- Advanced поля без явного раскрытия.
- Эмодзи в табах.
- Кнопка «Удалить» без подтверждения и без audit hint.

## 4. Ресурсы

### Основной сценарий

Resource manager и PM видят простой список ресурсов проекта, понимают, кто
перегружен, открывают конкретный ресурс для деталей.

### User stories

- **US1**. Given у проекта 12 ресурсов, when открыта вкладка «Ресурсы», then
  список показывает имя, роль, текущую загрузку и индикатор overload.
- **US2**. Given у ресурса есть конфликт календаря, when открыт раскрытый
  ресурс, then видны исключения и предложение `Открыть Календарь`.
- **US3**. Given у PM нет `canManageProjectResources`, when открыт ресурс,
  then действия редактирования disabled с reason.

### Layout (level 1 — список)

```text
┌─ Toolbar: Поиск · Фильтры (роль · перегруз · доступен) ──────────────┐
├──────────────────────────────────────────────────────────────────────┤
│ Resource | Роль       | Загрузка | Overload | Назначено | Действия  │
│ Иванов И | Аналитик   | 84%      | —        | 3 задачи  | Открыть    │
│ Петров П | Разработчик| 142%     | 14 ч/нед | 7 задач   | Открыть    │
└──────────────────────────────────────────────────────────────────────┘
```

- Колонка `Загрузка` — горизонтальный bar 80px + число.
- `Overload` — chip `--warning` с часами; empty — прочерк.
- Никаких heatmap, ничего шумного на первом уровне.

### Layout (level 2 — раскрытый ресурс)

```text
┌─ Иванов И. · Аналитик · Календарь: ProjCal · 0.8 ставки ─────────────┐
├──────────────────────────────────────────────────────────────────────┤
│ Доступность         │ Назначенные задачи             │ Конфликты      │
│ - 08:00-17:00       │ - Анализ требований 40ч        │ - 21.06 нет    │
│ - Пн-Пт             │ - Согласование макетов 16ч     │   рабочих часов│
│ - Исключение: 14.06 │ - QA-стенд 24ч                 │                │
│ Открыть Календарь → │ Открыть в Назначениях →        │ Открыть Календ │
└──────────────────────────────────────────────────────────────────────┘
```

### Поля

- `name`, `userId`, `positionId`, `teamId`, `calendarId`.
- aggregated load = sum(assignment.workMinutes) / available.workMinutes.
- assigned tasks list.
- calendar exceptions в окне 30 дней.

### Permission

- read: `canReadProjectResources`.
- edit: `canManageProjectResources` (только action `Изменить календарь`,
  `Снять назначение`, `Резервировать`).

### States

- loading: skeleton 5 строк.
- empty: «Нет ресурсов в проекте. Добавьте через Назначения.»
- error: «Не удалось загрузить ресурсы».
- forbidden: «Нет прав на просмотр ресурсов проекта».

### Anti-patterns

- 12-колоночная таблица с месяцами.
- Heatmap на главной странице ресурсов.
- KPI карточки сверху без пользы.

## 5. Назначения / Resource Usage

### Основной сценарий

Resource manager выбирает период и видит матрицу `ресурс × задача`, где ячейка
— часы. Перегруз подсвечен. Кликом раскрывается детализация по ресурсу.

### User stories

- **US1**. Given matrix загружен, when выбран период 4 недели, then ячейки
  показывают часы по неделям, столбец «Итого» показывает суммарную загрузку
  ресурса.
- **US2**. Given ресурс перегружен в неделю 24-30 июня, when пользователь
  кликает в ячейку, then раскрывается список задач этой недели по ресурсу с
  возможностью открыть задачу.
- **US3**. Given у PM есть `canManageProjectResources`, when пользователь
  меняет units в ячейке, then preview обновляет финиш и overload.

### Layout

```text
┌─ Фильтр периода: │ 2 нед │ 4 нед │ 8 нед │  Гранул: │День│Нед│Месяц│ ┐
├──────────────────────────────────────────────────────────────────────┤
│             │ Нед1 │ Нед2 │ Нед3 │ Нед4 │ Итого │ Доступно │ Δ      │
│ Иванов И    │ 32   │ 40   │ 40   │ 24   │ 136   │ 160      │ -24    │
│ Петров П    │ 40   │ 56!  │ 60!  │ 40   │ 196   │ 160      │ +36 OV │
└──────────────────────────────────────────────────────────────────────┘
```

- Overload cell: красный (`--danger`) подкрашенный фон без текста на красном
  (число остаётся читаемым), `!` маркер.
- Click ячейки: drilldown в drawer (не модал) с списком задач этого периода.
- Inline edit units доступен при `canManageProjectResources`.

### States

- loading: shimmer matrix.
- empty: «Нет назначений за период».
- forbidden: «Нет прав на ресурсные данные проекта».
- preview-pending: затронутые ячейки помечены `--accent` outline.

### Anti-patterns

- Pie chart над матрицей.
- 12 колонок «месяцев года» по умолчанию.
- Цвет как единственный сигнал overload (число обязательно).

## 6. Календари

### Основной сценарий

PM/Resource Manager редактирует календарь проекта и календари ресурсов.
Добавляет исключения (праздники, отсутствие, перепланированный сдвиг).

### User stories

- **US1**. Given у проекта 1 calendar и 4 resource calendars, when открыта
  вкладка «Календари», then PM видит список календарей и месяц текущего
  календаря.
- **US2**. Given PM добавляет исключение «14 июня — нерабочий», when клик по
  ячейке месяца, then preview показывает, какие задачи сдвинутся.
- **US3**. Given у PM нет `canManageProjectResources`, when открыта вкладка,
  then редактирование disabled.

### Layout

```text
┌─ Sidebar          │ Календарь проекта · Июнь 2026                      │
│ - Проект          │ Пн  Вт  Ср  Чт  Пт  Сб  Вс                          │
│ - Иванов И        │  1   2   3   4   5  [6] [7]    [...] — нерабочие   │
│ - Петров П        │  8   9 [10] 11  12 [13][14]                         │
│ - Аналитика       │ ...                                                  │
│                   │                                                      │
│ + Календарь       │ Рабочая неделя: Пн–Пт, 8 ч/день                     │
│   (если perm)     │ Исключения: список 5 строк                          │
└───────────────────┴──────────────────────────────────────────────────────┘
```

- Calendar month view с подсветкой нерабочих дней.
- Список исключений (date · workingMinutes · reason).
- Add exception dialog: дата, тип (выходной / сокращённый / дополнительный
  рабочий), reason.
- Resource calendar inherit indicator: chip `Наследует от ProjCal` если
  exceptions нет.

### States

- loading: skeleton month grid.
- empty list of exceptions: «Исключений нет. Добавьте, если есть праздники.»
- forbidden: «Нет прав на изменение календарей».

### Anti-patterns

- Календарь, не связанный с планом (визуальный гэп).
- Возможность задать рабочую неделю «Сб-Вс 00:00» без подтверждения.
- ICS import как первичный путь (Phase C).

## 7. Сценарии

### Основной сценарий

PM хочет понять, как разрулить перегруз или дедлайн. Запрашивает proposals,
видит 3 варианта (агрессивный, балансированный, устойчивый), сравнивает с
текущим планом, выбирает.

### User stories

- **US1**. Given есть overload, when PM нажимает «Получить предложения», then
  backend возвращает три ScenarioProposal с описанием эффекта на финиш и
  изменённые задачи.
- **US2**. Given выбран один из proposals, when PM открывает «Сравнить», then
  side-by-side показывает «Сейчас vs Сценарий: финиш +0д vs +2д, overload 14 ч
  vs 0 ч, изменения: 8 задач».
- **US3**. Given у PM есть `canApplyPlanningScenarios`, when нажат «Применить
  сценарий», then preview всех команд проходит через Apply bar и пишется в
  audit как `planning.scenario.applied`.

### Layout (список)

```text
┌─ Запрос сценариев: цель = Снять overload  Финиш = до 12.07  ───────────┐
├────────────────────────────────────────────────────────────────────────┤
│ Сценарий           │ Финиш  │ Overload │ Изм. задач │ Действия         │
│ Агрессивный        │ +0д    │ 0 ч      │ 12         │ Превью · Срав    │
│ Балансированный    │ +2д    │ 0 ч      │ 8          │ Превью · Срав    │
│ Устойчивый         │ +4д    │ 0 ч      │ 5          │ Превью · Срав    │
└────────────────────────────────────────────────────────────────────────┘
```

- Никаких длинных абзацев AI-объяснений.
- Risk score chip справа от каждого сценария (`низкий`/`средний`/`высокий`).

### Layout (сравнение)

```text
┌─ Сравнение: Балансированный ────────────────────────────────────────────┐
├──────────────────────────┬──────────────────────────────────────────────┤
│ Сейчас                   │ Сценарий                                     │
│ Финиш 12.06              │ Финиш 14.06                                  │
│ Overload 14 ч/нед        │ Overload 0                                   │
│ Изменения:               │                                              │
│ - Задача A: +1 день      │                                              │
│ - Задача B: новый ресурс │                                              │
│ - Зависимость X→Y удалена│                                              │
├──────────────────────────┴──────────────────────────────────────────────┤
│ [Отмена] [Превью в Gantt] [Применить (canApplyPlanningScenarios)]      │
└─────────────────────────────────────────────────────────────────────────┘
```

### States

- empty: «Сценарии для этого проекта ещё не запрашивались».
- preview-pending: «Считаем сценарии…» (single shimmer block).
- forbidden: «Нет прав на сценарное планирование».
- error: «Не удалось посчитать сценарии».

### Anti-patterns

- 20 предложений с длинными описаниями.
- Авто-apply сценария.
- ML-confidence score без объяснения, что именно изменится.

## 8. Baseline

### Основной сценарий

PM фиксирует baseline до старта или после согласования. Потом сравнивает
текущий план с baseline и видит, что сдвинулось.

### User stories

- **US1**. Given у PM есть `canManageProjectBaselines`, when клик «Зафиксировать
  baseline», then preview показывает количество задач, попадающих в baseline,
  и просит подтверждения с label.
- **US2**. Given baseline B1 выбран, when открыт компаратор, then таблица
  показывает по задачам «Финиш baseline · Финиш текущий · Δ дней · Δ работа».
- **US3**. Given baseline B1 активен, when PM на Gantt включает overlay, then
  под полосами задач появляется тонкая baseline-полоса.

### Layout

```text
┌─ Toolbar: Активный baseline = B2 (12.05.2026) │ + Зафиксировать │ Сравн │
├─────────────────────────────────────────────────────────────────────────┤
│ Список baseline                  │ Сравнение                            │
│ B1 · 02.05 · Согласовано клиентом│ Финиш проекта:                       │
│ B2 · 12.05 · После kick-off ✓    │ - Baseline: 12.06.2026               │
│ + Зафиксировать                  │ - Текущий: 14.06.2026 (+2д)          │
│                                  │ Изменилось задач: 14 из 87           │
│                                  │ Топ отклонений:                      │
│                                  │ - WBS 2.1 +3д                        │
│                                  │ - WBS 4.2 +1д                        │
│                                  │ - WBS 5.0 -1д                        │
│                                  │ [Открыть в Gantt с overlay]          │
└─────────────────────────────────────────────────────────────────────────┘
```

- Capture wizard: label (required), notes (optional), preview «64 задачи будут
  включены».
- Compare table: virtualized; сортировка по `Δ дней`, фильтр «Только
  изменённые».
- History: компактный список baseline с label и timestamp; нельзя удалять
  baseline без явного admin action.

### States

- empty: «Baseline ещё не зафиксирован. Зафиксируйте перед стартом фазы.»
- forbidden: «Нет прав на baseline».
- preview-pending capture: «Считаем, что войдёт в baseline…».

### Anti-patterns

- Авто-baseline без подтверждения.
- Compare без указания baseline label.
- Удаление baseline без audit warning.

## 9. Аудит

### Основной сценарий

PM/контролёр видит, кто и когда изменил план. Все события — на русском, без
JSON. Advanced raw payload доступен явно.

### User stories

- **US1**. Given в проекте 320 событий, when открыта вкладка «Аудит», then
  виден человеческий timeline без JSON.
- **US2**. Given выбран фильтр «За 7 дней» и «Иванов И.», when пользователь
  применяет фильтры, then timeline показывает только подходящие события.
- **US3**. Given событие выделено, when кликнут «Подробнее», then drawer
  показывает before/after diff человеческим языком; кнопка «Raw payload» (для
  admin/debug) раскрывает JSON.

### Layout

```text
┌─ Фильтры: Период · Пользователь · Тип события · Задача · «Показать сис»  │
├──────────────────────────────────────────────────────────────────────────┤
│ 14.05 09:32 · Иван Иванов · Изменил даты задачи WBS 2.1 «Анализ»        │
│   План.Финиш с 14.06 на 17.06. Применено. → Открыть задачу              │
│ 13.05 18:10 · Система · Зафиксирован baseline B2 «После kick-off»       │
│   64 задачи. → Открыть Baseline                                          │
│ 13.05 16:22 · Анна П. · Применила сценарий «Балансированный»             │
│   8 задач изменены, финиш +2д. → Открыть Сценарии                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Event card (drawer)

- Что сделано (русским).
- Кто.
- Когда.
- Какие сущности затронуты (clickable links).
- Diff человеческим языком: «План.Финиш: 14.06 → 17.06».
- `Показать raw payload` — collapsible.

### States

- empty filter: «По выбранным фильтрам событий нет».
- forbidden: «Нет прав на просмотр аудита».
- loading: timeline skeleton 8 строк.
- error: «Не удалось загрузить аудит».

### Anti-patterns

- Default-просмотр JSON.
- Двойные дубли событий (system + user).
- Цветные tag-облака для типов.

## 10. Настройки проекта

### Основной сценарий

PM/admin меняет project-level настройки: default calendar, planning mode,
ключевые поля проекта.

### User stories

- **US1**. Given у admin есть `canManageWorkspaceConfig`, when открыта вкладка
  «Настройки», then admin может выбрать default calendar и planning mode.
- **US2**. Given нет интеграции Bitrix24, when открыта секция «Интеграции»,
  then плашка «Интеграции появятся в Phase C» с disabled action и reason.

### Layout

```text
┌─ Section: Календарь по умолчанию                                        │
│   [select PrjCal▾]                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Section: Режим планирования                                              │
│   ○ Авто (по умолчанию)  ○ Ручной                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Section: Поля проекта                                                    │
│   - Дедлайн: 12.07.2026                                                  │
│   - Старт: 01.05.2026                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Section: Права                                                           │
│   PM (canManageProjectPlan): Иван, Анна                                 │
│   Resource Manager: Сергей                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Section: Интеграции (Phase C)                                            │
│   [Bitrix24]  disabled · «Появится в Phase C»                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### States

- forbidden: read-only summary без edit controls.
- preview-pending: settings save идёт обычным form submit, не через
  Preview/Apply bar (это нерасчётные настройки).

### Anti-patterns

- Tabs внутри tab «Настройки» с маркетинговыми блоками.
- «Интеграции» с активной кнопкой при отсутствии реализации.
- Прятать `Дедлайн` за advanced.

## 11. Общие состояния

### Empty / Loading / Error / Forbidden / Narrow

Каждый экран обязан реализовать эти 5 состояний. Общие правила:

- **Empty**: чёткое объяснение причины + предложение основного действия.
- **Loading**: skeleton, не spinner на весь экран. Skeleton повторяет layout.
- **Error**: одна строка причины + `Повторить` + `Сообщить администратору`
  (последнее опционально, только если есть `audit/feedback`).
- **Forbidden**: явный текст «Нет прав на …». Никаких подмен UI («сделайте
  вид что нет данных»).
- **Narrow fallback** (≤768px): сводка только-чтение Обзора + Аудита.
  Schedule, Resources, Assignments, Calendars, Scenarios, Baseline, Settings
  показывают «Этот экран доступен на широком экране. Откройте на ноутбуке или
  десктопе.» + ссылка «Обзор/Аудит».

## 12. Mobile / narrow fallback

Полноценное редактирование MS-Project-class плана на мобилке не имеет смысла:
WBS+Gantt не помещаются физически без потери смысла. Поэтому narrow viewport:

- доступно только: Обзор (read-only), Аудит (read-only), Назначения
  (read-only matrix без edit).
- остальные tabs показывают `state-narrow-fallback`.
- App sidebar превращается в drawer.
- Inspector в narrow никогда не открывается поверх Gantt; вместо этого
  пользователь не может выделить задачу для редактирования.

## 13. Контракт row-sync (повтор для важности)

Главная причина старого срыва UI — рассинхрон строк WBS и Gantt. Поэтому:

1. WBS-таблица и Gantt-таблица — **один** CSS grid с общим
   `grid-auto-rows: 36px`.
2. Левый блок (WBS) использует `position: sticky; left: 0`, заливается
   `--panel`, не оказывается прозрачным.
3. Правый блок (Gantt) разворачивается в горизонтальный scroll
   container; вертикальный scroll общий с WBS.
4. Header timeline — `position: sticky; top: 0` внутри того же scroll.
5. Selection и hover работают через row-class, который висит на обеих
   ячейках одной строки (CSS `:has(.row-selected)`/`:has(.row-hover)` или
   shared state).
6. Никаких независимых virtualized lists: либо одна виртуализация по строкам
   на оба блока, либо классический CSS grid (Phase B fallback).
7. Никакого `transform: translateY(...)` для синхронизации скролла — это
   ломается на хайдипиай и при touch-скролле.

## 14. Preview/Apply bar (повтор для важности)

- Любая команда `PlanningCommand` запускается как preview сразу при изменении
  inline-поля.
- Bar появляется снизу, не перекрывает таблицу больше чем на 56px.
- Bar содержит: краткую сводку («23 задачи изменятся, финиш +2 дня»),
  список из 0..5 ключевых predupreждений (severity warning/error), кнопки
  `Сравнить` (открывает diff drawer), `Отмена`, `Применить`.
- Apply делает `POST /planning/apply-command`, после успеха показывает
  applied состояние 3 секунды, затем закрывается.
- Failed apply не закрывает bar; пользователь читает ошибку человеческим
  языком и либо повторяет, либо отменяет.

## 15. Tokens и плотность

Все визуальные правила берутся из `27_UX_UI_DESIGN_SYSTEM.md`. Здесь не
дублируем цвета. Только дополнения:

- WBS row height default 36px, comfortable 44px, compact 28px.
- Gantt bar height 18px (default), 22px (comfortable), 14px (compact).
- Gantt cellWidth (день / неделя / месяц): 40 / 140 / 220 px.
- Inspector ширина 360px (default), 440px (extended).
- Sticky header z-index ≥ 5, sticky left column z-index ≥ 4, dependency arrows
  z-index ≥ 3, bars z-index ≥ 2.
- Все числовые поля моноширинные на колонках `Финиш`, `Длит`, `Прогресс`,
  `Часы`, `Δ`.

## 16. Acceptance criteria (общие)

UI Planning Workspace принимается, если:

1. На каждом из 10 экранов выполнены user stories секции «Основной сценарий».
2. Schedule показывает строго синхронные строки WBS и Gantt на desktop
   1920×1080, laptop 1440×900 и narrow fallback.
3. Любое изменение плана идёт через Preview/Apply bar, не через прямой commit.
4. У каждого важного действия есть permission gate и реальный audit action.
5. На каждом экране реализованы empty / loading / error / forbidden состояния.
6. UI на русском, advanced поля скрыты до явного раскрытия.
7. Нет fake affordances: любая видимая активная кнопка делает реальный
   command или явно disabled с причиной.

## 17. Open questions и Phase B/C scope

### Open questions

- Библиотека spreadsheet-grid для WBS (custom CSS grid + windowing vs
  TanStack Table + virtualizer vs AG Grid Community vs Handsontable) —
  принимается design spike'ом в самом начале Phase B; обязательное
  требование parity-матрица из раздела 2A.
- Виртуализация WBS+Gantt при ≥ 5 000 задач: формат виртуализации (row
  windowing, viewport culling Gantt-баров) — обязательная часть того же
  spike'а.
- Server-side undo (`planning.command.undo`) — добавляем в Phase B или
  ограничиваемся локальным preview-стеком в Phase B и server-undo выносим
  в Phase C?
- Predecessor-string парсер: единая грамматика на FE и BE или только FE?
  Тесты грамматики обязательны (см. раздел 2A).
- Drag-to-link зависимостей: только на Gantt, или ещё inline в WBS?
- Сохранённые saved views (фильтры Schedule): Phase C или раньше?
- Custom fields в WBS: Phase C или не делаем?
- Baseline delete: разрешаем admin-flow или только archive?
- Calendar ICS import: Phase C или не делаем?

### Phase B (следующая задача)

1. **Design spike (≤ 2 дня):** выбрать spreadsheet-grid library под
   parity-таблицу из раздела 2A. Критерии: keyboard navigation, multi-cell
   select, copy/paste с TSV, drag-fill, inline edit, virtualization,
   возможность кастомного renderer для chip-ячеек (resources, status),
   совместимость с нашей CSS-токен-системой. Результат — фиксация решения
   в `docs/32_PHASE_B_PLANNING_UI_DECISIONS.md` (создаётся в Phase B).
2. **Project Shell** + Tabs + sticky Preview/Apply bar (раздел Project
   Shell).
3. **Schedule = WBS-spreadsheet + Gantt** с обязательным **полным
   spreadsheet-режимом** по разделу 2A: inline edit ячеек, F2/Enter/Tab,
   копировать/вставить, drag-fill, multi-select, Delete на строке, indent/
   outdent, context menu, predecessor-string parser, inline validation,
   undo/redo (минимум локальный для pending preview).
4. **Gantt-полотно** с строгой row-sync, baseline overlay, critical-path
   stripe, dependency arrows, drag-edit финиша, drag-link зависимости.
5. **Task Inspector** (Tabs «Общие» / «Зависимости» / «Ресурсы» /
   «Constraints» / «Advanced») для глубоких операций, не закрываемых
   spreadsheet'ом.
6. **Permission gates** в toolbar, inline-ячейках и Inspector; явные
   tooltip-причины disabled.
7. **Smoke E2E** (обязательны для acceptance Phase B):
   - загрузка плана из `/planning/read-model`;
   - ввод 5 новых задач в пустом проекте только через клавиатуру (Tab/
     Enter/стрелки) — `task.create` batch;
   - paste TSV-блока из «Excel» (10 строк × 6 колонок) — корректные
     `task.create` + `dependency.upsert`;
   - inline edit `Финиш` через F2+Enter — preview→apply;
   - выделение 3 строк + Delete → подтверждение → batch `task.delete`;
   - ввод `Predecessors = "3,5FS+2д;8SS"` → 3 корректные зависимости;
   - drag-link зависимости на Gantt → preview→cancel.
8. **Repository health tests:** line budgets для `App.tsx` и grid-обёртки,
   ban-list для self-rolled dropdown/modal/dialog, smoke на ключевые
   состояния (empty/loading/forbidden/preview-pending).

### Phase C (после Phase B)

- Остальные вкладки: Ресурсы, Назначения, Календари, Сценарии, Baseline,
  Аудит, Настройки.
- Saved views, calendar import, экспорт.

## 18. Anti-patterns (сводно для review)

- Marketing hero на operational экранах.
- WBS-таблица и Gantt в разных контейнерах прокрутки.
- `Применить` без preview.
- JSON по умолчанию.
- Fake кнопки без сценария.
- Advanced поля без явного раскрытия.
- Перегруженная правая панель.
- Цвет как единственный сигнал статуса.
- Эмодзи в operational UI.
- Удаление baseline в один клик.
- Авто-apply сценария.

## 19. Связь с mockups и screenshots

HTML-mockups лежат в [docs/references/planning-ui-approved/](references/planning-ui-approved/).
PNG screenshots для desktop 1920×1080, laptop 1440×900 и narrow 390×844 —
в [docs/status/artifacts/2026-05-23-planning-ui/](status/artifacts/2026-05-23-planning-ui/).
Финальный отчёт со ссылками и verification table —
[docs/status/2026-05-23-planning-ui-design.md](status/2026-05-23-planning-ui-design.md).

> **Внимание.** Phase A HTML-mockups статичны и **не демонстрируют**
> spreadsheet-интерактивность из раздела 2A (F2/Enter/Tab, copy/paste,
> drag-fill, multi-select, context menu, predecessor-string parser,
> undo/redo). Они фиксируют только визуальный baseline сетки. Phase B
> обязан начать с клик-prototype поверх выбранной grid-библиотеки и
> отснять интерактивные демонстрации каждого пункта parity-матрицы.
## Plan Forecast backend contract

Plan Forecast is a read-only Planning Workspace backend/API capability. It stores forecast runs and exposes manager-facing fields only:

- `health`: `stable`, `watch`, `needs_decision`, `unstable`, or `blocked`;
- `managerSummary`: one sentence suitable for PM/manager review;
- `riskDrivers`: concrete task/resource/dependency reasons;
- `recommendations`: suggested next action labels that do not apply changes automatically.

Routes:

- `POST /api/workspace/projects/{projectId}/planning/forecast-runs`
- `GET /api/workspace/projects/{projectId}/planning/forecast-runs/{runId}`

Runtime UI panel is not beta-ready in this increment. A future panel must remain read-only, show action links only when the linked governed flow exists, and route every state-changing follow-up through the existing planning command path.
