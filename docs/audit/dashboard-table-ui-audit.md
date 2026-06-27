# Аудит дашбордов и таблиц KISS-PM по «3 признакам новичка»

**Дата:** 2026-06-25
**Источник критериев:** видео «The 3 dashboard UI flaws that give away you've NEVER built one» (Kole Jain) и сопровождающий Figma-файл «Dashboard-Flaws».

**Метод.** Аудит проведён мульти-агентным проходом: набор агентов независимо прошёл по 11 поверхностям (примитивы таблицы, списки, CRM, сущности, админка, Gantt/WBS, kanban, бенто-дашборд, матрица ресурсов, список каналов чата, runtime-экран), сверяя каждую поверхность со всеми тремя принципами рубрики. Затем все находки прошли через состязательную верификацию (adversarial verification): каждый кандидат перечитывался по исходному коду — `file:line`, наличие реального примитива в `components/ui`, отсутствие правила в CSS — и ложноположительные срабатывания удалялись. Ниже остались только подтверждённые находки. Общее число подтверждённых пробелов — **102** (high 35, medium 44, low 23).

> **Добор вручную (12-я поверхность).** Поверхность `domain-data-table` (`components/domain/data-table.tsx`) выпала из авто-прохода из-за перегрузки API и проверена отдельно. Это тонкая презентационная обёртка (4 строки: `.table-wrap` → `<table class="table">`, единственный проп `compact`). **Собственных уникальных пробелов не несёт** — поведение по форме/выравниванию делегировано `ui/table` + CSS `.table` (право-выравнивания нет — см. H4), а содержимое приходит от вызывающих. Но именно `DataTable` — естественное место для общих фиксов: добавить пропы `loading`/`empty`/`error`, рендерящие `ui/skeleton`/`ui/empty-state`/`ui/error-state` вместо `children` (это и есть **H1 «одним импортом»**), и опц. конфиг колонок с `align`/`numeric` (**H4**). Итог: 12-я поверхность не добавляет находок — она удешевляет H1/H4.

---

## Кратко (executive summary)

Поверхности построены аккуратно (единый `Table`/`DataTable`, `CellStack`, токены, набор `ui/*` примитивов уже существует), но почти всюду повторяются одни и те же системные пробелы — это не точечные баги, а отсутствие нескольких общих утилит, из-за чего каждый экран «недотягивает» одинаково:

- **Тултипов нет нигде.** Это самый частый признак новичка по рубрике, и он подтверждён практически на каждой поверхности: иконки-кнопки, аббревиатуры (`SPI`/`CPI`, `КП`, `Реж`, `Предш.`, `SSO/SAML`), KPI-метрики и дельты (`+1`, `83% среднее завершение`) висят без объяснения.
- **Enum-значения отрисованы как сырой текст или как один декоративный «info»-чип.** Статусы/стадии/роли либо обычный текст (kanban, gantt-ресурсы), либо всегда синий `variant="info"` независимо от значения (projects, crm, admin, entities, dashboard, runtime). Семантический цвет из данных почти не используется.
- **Числа выровнены по левому краю.** `.mono` даёт `tabular-nums`, но базовое правило таблицы — `text-align:left`, а право-выравнивающей утилиты (`.u-text-right`/`.num`) в `bem.css` нет вовсе. Поэтому суммы, часы, проценты и даты не выстраиваются по разрядам.
- **«Мёртвые» кнопки действий.** Кебаб-кнопки (`MoreHorizontal`), `Фильтр`, `Пригласить`, `Аудит`, тоггл сворачивания в матрице ресурсов отрисованы, но не открывают меню/диалог — disclosure-аффорданс есть, а раскрывать нечего.
- **Нет промежуточных состояний.** Loading / empty / error / disabled отсутствуют почти везде (поверхности рендерят захардкоженный mock), нет drawer'ов для детализации строки и нет подтверждающих модалок для необратимых действий (`Активировать проект`, `Применить план`).
- **Длинный текст не обрезается.** `CellStack`/ячейки не имеют `truncate` + `title`, поэтому длинное имя/описание ломает ширину остальных колонок.

Хорошая новость: бóльшая часть исправлений сводится к 4–5 переиспользуемым примитивам, которые уже есть в репозитории (`ui/tooltip`, `ui/badge`, `ui/dropdown-menu`, `ui/sheet`, `ui/skeleton`/`ui/empty-state`/`ui/error-state`, `ui/avatar`) плюс одна-две новые CSS-утилиты и пара пропов на `Table`/`CellStack`. Сначала строим/расширяем эти общие кирпичики — после этого правки по экранам становятся дешёвыми.

---

## Принцип 1 — Data dictates form (форму диктуют данные)

Подтверждённых находок: **45**.

### ui-table-primitive (примитив `components/ui/table.tsx`)

| Severity | Пробел | Evidence | Исправление (примитив) |
|---|---|---|---|
| high | Нет числового/право-выровненного варианта ячейки — разряды не выстраиваются | `TableCell` (table.tsx:81-92) — голый `<td>` с фиксированными классами; `TableHead` (table.tsx:68-79) хардкодит `text-left`; grep по `apps/web/src/components` не находит `tabular-nums` нигде | Добавить `align?: 'left'|'right'|'center'` и `numeric?: boolean` (или cva) в `TableCell`/`TableHead`; при numeric/right дописывать `text-right tabular-nums [font-variant-numeric:tabular-nums]`. Примитив: новый |
| high | `whitespace-nowrap` без обрезки — длинный текст «распирает» колонку вместо ellipsis | `TableCell` (table.tsx:86) и `TableHead` (table.tsx:73) хардкодят `whitespace-nowrap`, нет `max-w`/`truncate` | `truncate?: boolean` (или `maxW`) → `max-w-[var(--col-w,16rem)] truncate`, в паре с `title=`/`ui/tooltip`. Примитив: `ui/tooltip` |
| medium | Нет состояния «неактивная/архивная строка» | `TableRow` (table.tsx:55-66) знает только hover/`data-[state=selected]` (line 60), нет `data-[state=disabled]`/`aria-disabled` | `inactive?: boolean` → `opacity-60 text-[var(--muted)]`, по образцу существующего `data-[state=selected]`. Примитив: новый |

### projects-list (`projects-list-block.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| medium | Колонка «Срок» не право-выровнена | ячейки `mono cell-muted` (lines 82,100); `.mono` даёт tabular-nums (bem.css:24), но `.table td` = `text-align:left` (bem.css:949-951) | право-выровнять `th`/`td` «Срок» (утилита `.cell-num`/`text-right`). Примитив: новый |
| medium | Статус-чип декоративно-синий, не семантический | оба ряда `<Chip variant="info">В работе</Chip>` (lines 80,98) для рутинного статуса | маппинг status→variant; нейтральный для «В работе», danger/warning для blocked/overdue. Примитив: `ui/badge` |
| medium | Нет цвета срочности срока и нет колонки прогресса | дата всегда `cell-muted` без сравнения с сегодня (82,100); прогресса нет в колонках (58-62) | колонка «Прогресс» с inline-баром (reuse `.progress-bar` bem.css:1859-1869) + цвет «Срок» по дате. Примитив: новый |
| low | Длинные названия/клиенты не обрезаются | `cell-stack__title/__sub` без overflow/ellipsis (bem.css:1007-1017); клиент — голый `<td>` (75,93) | `overflow/ellipsis/nowrap` + `title=`. Примитив: новый |
| low | Аватар на legacy BEM, без overflow/группировки | `<BemAvatar initials="ИИ" .../>` (77,95) | заменить на `ui/avatar` (Avatar + AvatarFallback, AvatarGroup/AvatarGroupCount). Примитив: `ui/avatar` |

### crm-deals (`deals-block.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Колонка «Сумма» не право-выровнена | `<td className="mono">{d.amount}</td>` (118), `.mono` без выравнивания, `.table td` left (bem.css:949-951); утилиты `u-text-right` нет | право-выровнять header и ячейку (добавить `u-text-right` или по образцу `.gantt2__cell--right` gantt.css:59). Примитив: новый |
| medium | Чип стадии всегда `variant=info` | карточка (83) и ячейка (116) хардкодят info для всех стадий | маппинг stage→variant (won→success, deal→violet, lead/qual→info). Примитив: `ui/badge` |
| medium | Длинные title/client не обрезаются | `.cell-stack__title` без ellipsis (bem.css:1007), `.deal-card__title` тоже (bem-supplement.css:759), клиент — голый `<td>` (114) | truncate + `title`/`ui/tooltip` (есть готовая `.u-truncate` bem.css:2058). Примитив: `ui/tooltip` |
| low | Forecast-режим без графика/агрегации | при `mode==='forecast'` — заглушка-параграф (93-95), таблица скрыта (97); суммы по стадиям не агрегируются | хотя бы сумма amount по стадии + bar/sparkline. Примитив: новый |
| low | Закрытые/won-сделки не приглушены | все сделки на полной яркости (74-87,109-126); стадия `won` есть (21), но без dim | `.is-archived`/opacity для `stage==='won'`. Примитив: новый |

### entities (`entities-block.tsx`, `entity-detail-block.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Числовые колонки-счётчики left-aligned, без tabular | `<td>{String(r.deals)}</td>` без класса (96,114); даже `.mono`-валюта (97,113) left | `.u-text-right`/`.cell-num` на счётчики и валюту + header. Примитив: новый |
| medium | Заголовки числовых колонок не право-выровнены | `c.cols.map((col) => <th>{col}</th>)` (76-78); cols — плоский `string[]` | апгрейд cols до `{label, align?}` + `u-text-right` на `th`. Примитив: новый |
| medium | Чипы на legacy `Chip`; «Черновик» мис-окрашен | `Chip` default `variant:'info'` (chip.tsx:16) → `<Chip>Черновик</Chip>` (119) синий, а не нейтральный | заменить на `ui/badge` (secondary/default нейтральные тона). Примитив: `ui/badge` |
| medium | Email/company/CellStack-title не обрезаются с tooltip | email/company — голые `<td>` (102,104); `.cell-stack__title` без overflow; `.u-truncate` (bem.css:2058) не применён | применить `.u-truncate` + `title`/`ui/tooltip`; проп title-passthrough в CellStack. Примитив: `ui/tooltip` |
| low | Имя менеджера дублируется текстом рядом с аватаром | `<BemAvatar/> {r.manager.name}` (91); detail — аватар + жирное имя (88-91) | `title={name}` на аватаре, убрать/обрезать текст; опц. `ui/tooltip`. Примитив: `ui/avatar` |

### admin (`admin-block.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Неактивная строка пользователя не приглушена | для `active:false` (line 18) меняется только статус-чип (59); имя/email/аватар полной яркости; нет CSS-правила is-inactive | `tr.is-inactive { opacity:.55 }` рядом с tr:hover/is-selected (bem.css:977-979). Примитив: новый |
| medium | Все роли — одинаковый info-чип | `<Chip variant="info">{u.role}</Chip>` (56) для PM/Архитектор/Дизайнер/Разработчик | `ROLE_VARIANT` маппинг; лучше через `ui/badge` (11 вариантов). Примитив: `ui/badge` |
| medium | Длинный email не обрезается, счётчик не tabular | `.cell-stack__sub` без overflow/title (bem.css:1013-1017); `${USERS.length} активных` — обычная проза (35) | ellipsis + title на `cell-stack__sub` (проп `subtitleTitle`). Примитив: `ui/tooltip` |

### gantt-wbs (`gantt.tsx`, `gantt-slice-block.tsx`, `project-scenarios-block.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Исполнитель — литеральный текст, не аватар | `resources = `Инициалы ${row.assignee.initials}`` (101-102), рендер строкой (127); в модели есть initials+color (types.ts:21) | `Avatar size="sm"` + `AvatarFallback`, цвет из `assignee.color`; убрать префикс. Примитив: `ui/avatar` |
| high | Полосы Gantt без заливки прогресса несмотря на данные | `ChartBar` (gantt.tsx:35-44) — пустой `aria-hidden` div; `.gbar__progress`/`.gbar__label` (gantt.css:240-258) не рендерятся; в mock есть fractional progress | отрисовать готовый `.gbar__progress` со `width:${progress*100}%`. Примитив: новый (CSS уже есть) |
| medium | Длит. и % центрированы, без tabular | ячейки в `.gantt2__cell--center` (120-121), который только `justify-content:center` (gantt.css:58) | использовать `.gantt2__cell--right` (уже tabular-nums, gantt.css:59). Примитив: новый |
| medium | Зависимости и предшественники описаны в CSS/заголовках, но не рендерятся | SVG-система `.gdep*` (gantt.css:315-352) не используется; «Предш.» захардкожен `—` (126); в `GanttRow` нет поля | поле `dependsOn`, чипы предшественников (`ui/badge`) + `.gdep`-overlay. Примитив: `ui/badge` |
| low | SPI как голый скаляр, без тренда/порога | per-scenario SPI `<td className="mono">{s.spi}</td>` (scenarios:50); статы 0.94/1.02 (slice:98-103) | sparkline или порог-цвет через `ui/badge` (>=1 success, <1 warning). Примитив: `ui/badge` |

### kanban (`kanban-card.tsx`, `kanban-board.tsx`, `runtime-screen-view.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Статус задачи — обычный текст в meta, не чип | `meta.map(... <span>)` (kanban-card.tsx:40-44), `task.statusName` приходит в meta (runtime-screen-view.tsx:552) как muted-текст | проп `status?: {label,tone}` + рендер через `ui/badge`, маппинг statusCategory→variant. Примитив: `ui/badge` |
| medium | Заголовок карточки без обрезки | `.kanban-card__title` без overflow/line-clamp (bem.css:1112-1117) | `-webkit-line-clamp:2` + `title=`/`ui/tooltip`. Примитив: `ui/tooltip` |
| medium | Фейковые аватары вместо реальных владельцев | `assignees={[{initials:"ИИ",color:"c1"}]}` литералом для каждой задачи (552) | initials из реального владельца; опц. `ui/avatar` (AvatarGroup + AvatarGroupCount). Примитив: `ui/avatar` |
| low | Карточки в колонке «Готово» не приглушены | нет `muted`-пропа (kanban-card.tsx:8-19), нет muted-правила (bem.css:1074-1094) | `muted?:boolean` → `.kanban-card--muted` (opacity ~.65) для группы done. Примитив: новый |

### dashboard-bento (`dashboard-bento.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Колонка «Срок» left-aligned, не как числовая | даты `mono cell-muted` (190,203); `.table td` left (bem.css:949-955); right-align утилиты для таблицы нет | `.table td.num{text-align:right;font-variant-numeric:tabular-nums}` + класс на `th`/`td`. Примитив: новый |
| medium | Статус-чипы не семантичны | `<Chip variant="info">В работе</Chip>` (192), `<Chip>Новая</Chip>` (205, тоже info по default chip.tsx:16) | маппинг статус→variant (Готово→success, Просрочено→danger). Примитив: `ui/chip` |
| low | Аватары — инициалы без tooltip-идентификации | `BemAvatar initials="ИИ"` (195), `"АП"` (208), без img/title (bem-avatar.tsx:14-20) | `ui/avatar` (Image+Fallback) + `ui/tooltip` с именем. Примитив: `ui/avatar` |
| low | Длинные заголовки задач не обрезаются | `.cell-stack__title` без overflow (bem.css:1007-1012); строки вроде «Подготовить смету этапа 2» (200) | overflow/ellipsis (или `.u-truncate` bem.css:2058) + tooltip. Примитив: `ui/tooltip` |

### resource-matrix (`resource-matrix.tsx`, `cells.tsx`, `stats.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| medium | Нагрузка % как сырой текст, не чип | `PercentCell` → `{p.value}%` голым текстом (resource-matrix.tsx:9-22); level — finite enum (types.ts:21-24) | обернуть значение в `ui/badge` по `p.level` (norm→secondary, high→warning, over→danger), сохранив tabular-nums. Примитив: `ui/badge` |
| medium | Кастомный BEM-аватар вместо примитива; цвет c6 без правила (баг) | `rmatrix__avatar--{color}` (39-43); CSS только c1..c5 (resource-matrix.css:310-314), а mock даёт `c6` (mock-data.ts:119) | заменить на `ui/avatar`; для групп-ролей `AvatarGroup`+`AvatarGroupCount`; уходит и c6-баг. Примитив: `ui/avatar` |
| low | Свёрнутые/неактивные строки не приглушены | row-варианты меняют только bg/вес (resource-matrix.css:247-271); нет inactive-флага (types.ts:30-44) | флаг `inactive` + `.rmatrix__row--inactive` (opacity/muted). Примитив: новый |

### chat-channel-list (`channel-list.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| medium | Счётчик непрочитанных — декоративная accent-заливка, не tabular | `<Badge variant="primary">{channel.unread}</Badge>` (43); `primary` = сплошной accent (badge.tsx:19), без tabular-nums/min-width | мягкий `accent`/`secondary` вариант + `tabular-nums`, опц. cap «99+». Примитив: `ui/badge` |
| low | DM-строки без аватара; обрезанные имена без title | DM-ветка показывает PresenceDot+текст, не лицо (37-42); `.chat-channel__name` обрезается (chat.css:89-94), но без `title` | `ui/avatar` (+ AvatarBadge для присутствия) + `title={name}`. Примитив: `ui/avatar` |

### runtime-screen (`runtime-screen-view.tsx`, `cell-stack.tsx`)

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Числовые колонки left-aligned | часы (480), срок (563), прогресс % (565), деньги (674) — `className="mono"`; `.mono` без выравнивания, `.table td` left (bem.css:949-951) | `.num{text-align:right}` + `class="mono num"` на `th` и `td`. Примитив: новый |
| high | Длинные заголовки/описания не обрезаются | `CellStack` без `title`/ellipsis (cell-stack.tsx:12-22); `subtitle={task.description}` (562), `.u-truncate` (bem.css:2058) не применён | ellipsis на `.cell-stack__title/__sub` + `title=` в cell-stack.tsx. Примитив: новый |
| medium | Цвет статус-чипа захардкожен, не из данных | DealsTable (674), ProjectsTable (678), UsersTable (687) — `variant="info"` безусловно; только TaskTable (564) варьирует | `chipVariantFor(value)` + `ui/badge` (есть secondary/success/warning/danger). Примитив: `ui/badge` |
| medium | Данные priority есть, но колонка выброшена из списка задач | priority в модели (65), `priorityLevel()` (774), `PriorityFlag` есть; TaskTable-колонки (558) без приоритета | добавить колонку «Приоритет» с `PriorityFlag`. Примитив: `PriorityFlag` |
| low | Исполнитель/владелец — плейсхолдер-текст/фейк вместо аватара | `BemAvatar "ИИ" Иванова М.` для всех проектов (678); `Ресурс {index+1}` (479) | реальные участники через `ui/avatar`; для projects тип `Project` (56) без поля owner — нужна правка типа/API. Примитив: `ui/avatar` |
| low | Архивные/неактивные строки не приглушены | UsersTable tr без класса по статусу (687); ProjectsTable — фейковый `index===0 is-selected` (678); `.is-dimmed` в bem.css нет | `is-dimmed{opacity:.55}` для `status==='archived'`; убрать фейковый is-selected. Примитив: новый |

---

## Принцип 2 — Progressive disclosure (раскрывать по мере необходимости)

Подтверждённых находок: **22**.

### ui-table-primitive

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| medium | Нет аффорданса row-actions (слот действий по hover) | у `TableRow` нет `group`-класса (table.tsx:60) и нет helper'а для actions-ячейки (экспорты 107-116 — только 8 базовых частей) | добавить `group` в base-класс `TableRow` + `TableRowActions` (`opacity-0 group-hover:opacity-100`) под `DropdownMenu`-кебаб. Примитив: `ui/dropdown-menu` |

### projects-list

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Кебаб строки — мёртвая всегда-видимая кнопка без меню | `<Button ...><MoreHorizontal/></Button>` в `.cell-actions` (83-87,101-105), всегда виден (bem.css:1032-1035), ничего не открывает | обернуть в `DropdownMenu` (open/archive/share/delete-destructive) + показывать на hover строки. Примитив: `ui/dropdown-menu` |
| low | Нет онбординга/empty для архива; противоречивый контент | `filter` гейтит только `<p>` (50-54), а DataTable рендерит те же активные строки (67-106) | `EmptyState` (с действием «Создать шаблон») когда у фильтра нет строк. Примитив: `ui/empty-state` |

### crm-deals

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет меню действий строки (open/edit/move stage/delete) | в строках только data-ячейки (110-125); карточки `cursor:pointer` (bem-supplement.css:739), но без onClick/меню | actions-ячейка с hover-кебабом → `DropdownMenu`; опц. `ContextMenu` на строке. Примитив: `ui/dropdown-menu` |
| low | Фильтр — мёртвая disabled-кнопка без раскрытия | постоянно disabled Filter с title-тултипом (59-62) | `ui/popover` с фильтрами стадии/owner/суммы. Примитив: `ui/popover` |

### entities

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Кебаб «Действия» — мёртвая кнопка без меню | `<IconButton label="Действия">...` (124-128), без обёртки/onClick; в detail то же (entity-detail-block.tsx:57-59) | `DropdownMenu` (Открыть/Редактировать/Дублировать + destructive Удалить). Примитив: `ui/dropdown-menu` |
| medium | Кебаб закреплён всегда, не по hover | `.cell-actions` (bem.css:1032-1034) без opacity-гейтинга; кебаб видим в каждой строке | CSS: `opacity:0` + reveal на `tr:hover`/`focus-within`. Примитив: новый (CSS) |
| low | Кнопка «Фильтр» ничего не раскрывает | `<Button>...<Filter/>Фильтр</Button>` без onClick/popover (68-71) | обернуть в `ui/popover` с фильтрами. Примитив: `ui/popover` |

### admin

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Кебаб строки ничего не открывает | `IconButton` (61-65) без onClick/меню | `DropdownMenu` (Изменить роль/Деактивировать + destructive Удалить за Separator). Примитив: `ui/dropdown-menu` |
| medium | Действие кебаба всегда закреплено, не по hover | `.cell-actions` (bem.css:1032-1035) без opacity/hover-reveal | `opacity:0` + reveal на `tr:hover`/`focus-within`. Примитив: новый (CSS) |
| medium | «Пригласить» без флоу | primary `Пригласить` (28-31) и `Аудит` (75-78) без onClick | `Dialog` с email+role (или лёгкий `Popover`). Примитив: `ui/dialog` |

### gantt-wbs

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | 10 действий тулбара закреплены, без overflow/меню | 8 icon-Button + 2 text-Button + Segmented zoom рендерятся безусловно (gantt-slice-block.tsx:47-95) | оставить Add + zoom; вторичное (indent/link/unlink/crit-path/baseline) в `DropdownMenu`-кебаб; Delete — destructive + confirm Dialog. Примитив: `ui/dropdown-menu` |
| medium | Нет действий по строке/контекстного раскрытия | `DataRow` (105-140) только ячейки; тоггл сворачивания (53) без onClick | `ContextMenu` на строку и/или hover-кебаб `DropdownMenu`; подключить toggle. Примитив: `ui/context-menu` |

### kanban

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Кебаб колонки — мёртвый контрол без меню | `<Button ... aria-label="Действия колонки">` (kanban-board.tsx:22-24) без onClick/меню | `DropdownMenu` (rename/add/archive/sort) или проп `menu?`; нет меню — не рендерить кнопку. Примитив: `ui/dropdown-menu` |
| medium | Действия карточки отсутствуют / всегда-видимый footer | у `KanbanCard` (33-69) нет кебаба/меню; единственное действие — всегда-видимый `foot` (552) | hover-кебаб в `.kanban-card__head` → `DropdownMenu` (или `ContextMenu`). Примитив: `ui/dropdown-menu` |

### dashboard-bento

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Строки задач без действий/меню | строки заканчиваются на ячейке исполнителя (185-210); нет actions-колонки/кебаба | trailing `.cell-actions` с hover-кебабом → `DropdownMenu` (Open/Mark done/Reassign/Remove). Примитив: `ui/dropdown-menu` |
| medium | «Сигналы контроля» без drill-in/dismiss/snooze | сигналы — статичные строки, одна общая кнопка «Открыть…» (217-239) | hover-меню на сигнал (View/Acknowledge/Snooze) через `ui/popover`/`DropdownMenu`. Примитив: `ui/popover` |

### resource-matrix

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Тоггл сворачивания — мёртвая кнопка; строки никогда не сворачиваются | toggle-кнопка без onClick (resource-matrix.tsx:30-38); компонент без state (54-100); `collapsible:true` ничего не делает (mock 176,187,198) | поднять collapsed-set в state, скрывать дочерние строки, вращать ChevronRight. Примитив: новый |
| medium | Нет действий по строке/ячейке — назначение только в глобальном тулбаре | единственное действие — глобальная «Назначить» (project-resources-block.tsx:29-32); ячейки/строки без hover-действий | hover-`IconButton` на ячейке → `Popover` с редактором часов; редкие действия — `DropdownMenu`-кебаб на sticky name-ячейке. Примитив: `ui/popover` |

### chat-channel-list

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| medium | Нет hover-действий по каналу (mute/mark read/leave) и overflow-меню | строка — один `<button class="chat-channel">` (30-44), без кебаба; `.chat-channel:hover` уже есть (chat.css:71) | hover-триггер → `DropdownMenu` (Отметить прочитанным / Без уведомлений / destructive Покинуть). Важно: строка сама `<button>`, триггер меню должен быть соседом, а не вложенным. Примитив: `ui/dropdown-menu` |

### runtime-screen

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Форма комментария (input + 2 кнопки) закреплена в каждой строке | TaskTable рендерит `TaskCommentForm` инлайн на каждой строке (566-568); это Input + «Сохранить» + «Блокер» (595-623) | оставить `TaskAdvanceButton` как primary; комментарий+«Блокер» — в `ui/popover` по hover-иконке. Примитив: `ui/popover` |
| medium | Иконка «more» — навигационная ссылка, а не меню действий | последняя ячейка ProjectsTable — `MoreHorizontal` внутри `<Link href>` (678) | заменить на `ui/dropdown-menu` (Открыть/План-график/Ресурсы). Примитив: `ui/dropdown-menu` |

---

## Принцип 3 — Invisible UI (скрытые состояния и аффордансы)

Подтверждённых находок: **35**.

### ui-table-primitive

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| medium | Нет guidance по loading/empty-состояниям в семействе таблицы | экспорты только 8 базовых частей (table.tsx:107-116); нет `TableEmpty`/loading-row с colSpan | `TableEmptyRow`/`TableLoadingRow` (`<TableRow><TableCell colSpan>`), оборачивающие `EmptyState`/`SkeletonRow`. Примитив: `ui/skeleton` |
| low | Нет sort/tooltip-аффорданса для аббревиатур в заголовке | `TableHead` — голый `<th>` без `aria-sort`/слота; `uppercase tracking` усложняет чтение аббревиатур (table.tsx:73) | паттерн обёртки label в `ui/tooltip`; опц. `sortDirection` + `aria-sort` + chevron. Примитив: `ui/tooltip` |

### projects-list

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет drawer'а детализации строки и нет loading/empty/error | строки — статичные `<tr>` без onClick/href (67-107); DataTable рендерится безусловно, без Skeleton/Empty/Error | row-click → `Sheet` (детали проекта), confirm `Dialog` для archive/delete, `Skeleton`/`EmptyState`/`ErrorState`. Примитив: `ui/sheet` |
| medium | Иконки/метрики без тултипов | кебаб с aria-label, без Tooltip (84); счётчики в PageIntro (23); статус-чипы без объяснения | обернуть кебаб и чипы в `ui/tooltip`. Примитив: `ui/tooltip` |
| low | Нет hover-copy на ячейках-идентификаторах | код проекта `PRJ-2026-014` — обычный subtitle (71,91); у CellStack нет hover-слота (cell-stack.tsx:12-21) | hover `copy IconButton` + `ui/tooltip`. Примитив: `ui/icon-button` |

### crm-deals

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет drawer'а/клика по строке/карточке | карточки `cursor:pointer` (bem-supplement.css:739) без handler; строки без onClick; нет Sheet/Dialog | клик → `ui/sheet` с деталями сделки (timeline стадий, сумма, owner, клиент). Примитив: `ui/sheet` |
| high | Нет loading/empty/error | DEALS/STAGES — захардкоженные массивы (16-29), рендер без условий; DataTable презентационный | `Skeleton` (load), `EmptyState` (пустой pipeline + per-stage), `ErrorState`. Примитив: `ui/skeleton` |
| medium | Нет тултипов на deal id/аббревиатурах/суммах | id сырой (77,112); стадия «КП» (19); единственный тултип — title disabled-фильтра (59) | `ui/tooltip` с расшифровкой («КП → Коммерческое предложение») + title на truncated. Примитив: `ui/tooltip` |
| low | Нет hover-copy/микро-действий на ячейках | id (77,112) и amount (84,118) — статичный текст; hover только меняет фон (bem.css:977) | hover ghost `copy IconButton`. Примитив: `ui/icon-button` |

### entities

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет loading/empty/error | всегда маппит статичный mock (14-44,83-130); импортов Skeleton/Empty/Error нет (1-10) | `SkeletonRow` / `EmptyState` («Ничего не найдено» + clear-filter) / `ErrorState` с onRetry. Примитив: `ui/skeleton` |
| medium | Нет тултипов на аббревиатуры/метрику активности | сегменты Enterprise/Mid-market/SMB (94), роли CFO/Operations (103), «12 событий · сегодня» (105) без объяснения. *(Кебаб-`IconButton` НЕ в этом списке — у него уже `title` через icon-button.tsx:56.)* | обернуть чипы и метрику в `ui/tooltip` (TooltipProvider в корне). Примитив: `ui/tooltip` |
| medium | Строки некликабельны, нет drawer'а и hover-copy | `<tr>` без onClick/role/href (84); `.is-selected` (bem.css:978-979) не применяется; `cell-stack--link` (bem.css:1019-1028) не используется | row-click → `ui/sheet` (контент entity-detail), `.is-selected` на активной строке, hover-copy на email/code. Примитив: `ui/sheet` |
| low | Нет confirm-модалки для destructive/Save | в detail primary «Сохранить» + мёртвый кебаб (56-59); `ui/dialog` не импортирован | `ui/dialog` confirmation для destructive-пункта. Примитив: `ui/dialog` |

### admin

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет loading/empty/error/disabled для таблицы пользователей | маппит захардкоженный USERS (14-19,46); subtitle = `USERS.length` (35); DataTable/CardPanel без state-ветвления | `SkeletonRow` / `EmptyState` («Нет пользователей» + invite) / `ErrorState` с onRetry. Примитив: `ui/skeleton` |
| medium | Нет тултипов на security-жаргон | «SSO (SAML)», «Domain allowlist» (84-85) без help; `SwitchRow` без help-слота; «Аудит» необъяснён | help-`IconButton` в `SwitchRow` + `ui/tooltip` с определениями SSO/SAML/allowlist. Примитив: `ui/tooltip` |
| medium | Журнал аудита — мёртвая кнопка, а не timeline | «Аудит» Button без handler (74-79); timeline/drawer'а нет | «Аудит» → `ui/sheet` с вертикальным timeline событий (кто/что/когда). Примитив: `ui/sheet` |
| low | Нет confirm-модалки для destructive | т.к. меню нет (61-65) — нет deactivate/remove и подтверждения | destructive `DropdownMenuItem` + `ui/dialog` confirmation. Примитив: `ui/dialog` |

### gantt-wbs

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Необъяснённые метрики/аббревиатуры без тултипов | SPI 0.94 / CPI 1.02 голыми парами (slice:96-113); icon-кнопки только aria-label; заголовки «Реж» (163), «Предш.» (170) | `ui/tooltip` на SPI/CPI и заголовки; icon-кнопки → `ui/icon-button`/Tooltip. Примитив: `ui/tooltip` |
| high | Нет loading/empty/error — всегда рендерит mock | `data.rows` маппится безусловно (196); блок всегда передаёт GANTT_MOCK (slice:114) | guard на 0 строк → `EmptyState`; loading/error props → `Skeleton`/`ErrorState`. Примитив: `ui/empty-state` |
| medium | Полосы/вехи `aria-hidden`, без hover-детали/тултипа/drawer'а | bar (44) и milestone (32) `aria-hidden`, без title/tooltip/click; DataRow без onClick (105-140) | `ui/tooltip` на bar (name/даты/progress/assignee); клик → `ui/sheet` row-detail. Примитив: `ui/sheet` |

### kanban

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет drawer'а/клика для детализации карточки | `<article>` с `cursor:grab` (bem.css:1082), но без onClick/draggable/drawer (grep пуст) | проп `onOpen?` → `ui/sheet` с деталями; либо реальный DnD, либо убрать вводящий в заблуждение `cursor:grab`. Примитив: `ui/sheet` |
| high | Аббревиатуры/иконки без тултипов | счётчик комментов — голый `MessageSquare`+число (58-63); кебаб только aria-label (board:22); id «MDS-39» и дата (64) необъяснены | `ui/tooltip` на коммент-счётчик, дату и кебаб. *(Кебаб — `Button`, не `IconButton`, поэтому `title` не выводится из aria-label — добавить явно.)* Примитив: `ui/tooltip` |
| medium | Нет loading/empty/error на карточке/колонке; ad-hoc пустышки | empty-колонки — сырые `<p class="u-text-muted">` у вызывающих (552; my-work:59); у `KanbanColumn` (14-28) нет empty/loading-слота | `KanbanColumn` `empty?` (default `EmptyState`) + `Skeleton`-плейсхолдеры карточек. Примитив: `ui/skeleton` |

### dashboard-bento

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет тултипов на KPI/дельты/график — числа без объяснения | bare 83%/56% (41-52), дельты «+2 неделя»/«+1» (65,81), «Avg концентрация: 41%» + легенда (116-126) | `ui/tooltip` с одной строкой определения на каждый метрик/дельту/легенду. Примитив: `ui/tooltip` |
| high | Нет empty/loading/error — захардкоженный mock | всё литералами (29,133-158,185-210,217-235); fetch/условий нет; Skeleton/Empty/Error не импортированы | `Skeleton`/`EmptyState`/`ErrorState` (с onRetry) на тело каждой карточки. Примитив: `ui/skeleton` |
| medium | Нет hover-copy/row-open на ячейках таблицы | ячейки — обычный текст (186-201); `.cell-stack--link` (bem.css:1019-1028) не используется; CellStack без href/onClick | hover `copy IconButton` у id (MDS-39) + `ui/tooltip`; проп onClick/asChild в CellStack для row-open. Примитив: `ui/icon-button` |

### resource-matrix

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет тултипов на уровни ячеек/метрику %/статы | ячейки только `title=\`${hours} ч\`` (cells.tsx:74); пороги уровней (legend.tsx:8-9) не объяснены на ячейке; `PercentCell` (21) и статы Ёмкость/Загрузка/Свободно (stats.tsx:21-30) без тултипа | `ui/tooltip` с порогом («Перегруз: 16.9 ч (порог 15 ч)») и формулой метрики. Примитив: `ui/tooltip` |
| medium | Нет loading/empty/error для матрицы/статов | оба компонента берут готовые данные, без isLoading/error/empty (resource-matrix.tsx:54, stats.tsx:12); вход — статичный RESOURCE_MATRIX_MOCK | `SkeletonRow` (load), `EmptyState` (пустой период), `ErrorState` (onRetry). Примитив: `ui/skeleton` |
| low | freeHours danger по magic-порогу, выглядит как декоративный red | `stats.freeHours < 500` (stats.tsx:29), литерал без единиц; mock 361.01 → всегда red (resource-matrix.css:40); порог не объяснён | порог через проп + `ui/tooltip` с объяснением. Примитив: `ui/tooltip` |

### chat-channel-list

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет empty-состояния при пустом списке каналов | безусловный `<ul>` + map (channel-list.tsx:27-47), без length-guard; пустой workspace/фильтр → пустой `<ul>` | при `channels.length===0` → `EmptyState` («Каналов пока нет» / «Ничего не найдено»). Примитив: `ui/empty-state` |
| medium | Presence-dot и Hash без hover-тултипа | dot только `aria-label` (presence-dot.tsx:11-18); Hash `aria-hidden` (40) | `Tooltip` с presence-label (PRESENCE_LABEL приватный — экспортировать/прокинуть) + tooltip «Канал» на Hash; один TooltipProvider на rail. Примитив: `ui/tooltip` |

### runtime-screen

| Severity | Пробел | Evidence | Исправление |
|---|---|---|---|
| high | Нет тултипов на метрики/аббревиатуры | `MetricTile` (546) — обычные spans; «Перегрузка»/«Перегруз, ч» (164,442), capacityCount (799), gantt-stats (419), «План»/«ч» (469,480) без объяснения; Tooltip не импортирован | `ui/tooltip` на label'ы MetricTile и gantt-stats (+ TooltipProvider у корня). Примитив: `ui/tooltip` |
| high | Необратимые действия срабатывают по одному клику без confirm-модалки | `activate.mutate()` напрямую (335) + router.push; `applyMutation.mutate()` напрямую (415); только toast. Agent-флоу (254-266) — исключение с 2-шаговым confirm | гейт «Активировать проект» (335) и «Применить» (415) за `ui/dialog`. Примитив: `ui/dialog` |
| medium | Нет drawer'а детали строки; loading = голый текст вместо skeleton | у строк нет onClick (grep — только кнопки); нет Sheet; loading-ветка StateGate — `<p>Загрузка данных…</p>` (545) | `ui/sheet` row-detail по клику; заменить текст-лоадер на `Skeleton`/`SkeletonRow`. Примитив: `ui/sheet` |
| low | Нет hover-copy на ячейках | значения рендерятся напрямую (674,563,478-480); clipboard/copy нет (grep) | `ui/icon-button` (copy) скрытый, reveal по hover + `ui/tooltip` («Скопировать»). Примитив: `ui/icon-button` |

---

## Приоритизированный бэклог исправлений

Сгруппированы повторяющиеся кросс-поверхностные правки в единые пункты — один общий fix закрывает много экранов.

### High

| # | Surface(s) | Fix | Принцип | reusePrimitive |
|---|---|---|---|---|
| H1 | **Все таблицы** (ui-table, projects, crm, entities, admin, gantt, kanban, dashboard, resource-matrix, chat, runtime) | Добавить loading/empty/error состояния через единый паттерн `TableEmptyRow`/`TableLoadingRow`, оборачивающий общие примитивы — **один shared fix, ~9 поверхностей** | invisible-ui | `ui/skeleton` + `ui/empty-state` + `ui/error-state` |
| H2 | **Все surfaces с метриками/аббревиатурами/icon-кнопками** (gantt, dashboard, runtime, crm, projects, entities, admin, kanban, resource-matrix, chat) | Обернуть все неоднозначные иконки/метрики/аббревиатуры в `ui/tooltip` (+ корневой TooltipProvider) — **один shared fix, самый частый пробел рубрики** | invisible-ui | `ui/tooltip` |
| H3 | **Все строки/карточки с «мёртвым» кебабом** (projects, crm, entities, admin, kanban, dashboard) | Оживить кебаб: `DropdownMenu` (open/edit/reassign + destructive delete), показ по hover строки — **shared fix** | progressive-disclosure | `ui/dropdown-menu` |
| H4 | ui-table, runtime, crm, entities, admin, dashboard | Право-выравнивание числовых колонок: новая утилита `.num`/`.u-text-right` + `numeric`-проп на `TableCell`/`TableHead` — **shared fix** | data-dictates-form | новый (CSS-утилита) |
| H5 | crm, kanban, projects, entities, dashboard, gantt, resource-matrix, runtime | Детализация: row/card click → `ui/sheet` drawer | invisible-ui | `ui/sheet` |
| H6 | gantt-wbs | Заливка прогресса в полосах Gantt (готовые `.gbar__progress`/`.gbar__label`) | data-dictates-form | новый (CSS есть) |
| H7 | gantt-wbs | Исполнитель — `ui/avatar` вместо строки «Инициалы …» | data-dictates-form | `ui/avatar` |
| H8 | gantt-wbs | Свернуть 10 действий тулбара: primary видимы, вторичные в `DropdownMenu` | progressive-disclosure | `ui/dropdown-menu` |
| H9 | kanban | Статус задачи → чип через `ui/badge`, не сырой текст в meta | data-dictates-form | `ui/badge` |
| H10 | resource-matrix | Оживить тоггл сворачивания (state collapsed-set, скрытие дочерних строк) | progressive-disclosure | новый |
| H11 | runtime, projects (truncate) | Обрезка длинного текста в `CellStack` (ellipsis + `title`) | data-dictates-form | новый (`ui/tooltip` для reveal) |
| H12 | runtime | Comment-form убрать из каждой строки в `ui/popover` по hover | progressive-disclosure | `ui/popover` |
| H13 | runtime | Confirm-модалки для «Активировать проект»/«Применить план» | invisible-ui | `ui/dialog` |
| H14 | admin | Приглушить неактивную строку пользователя (`tr.is-inactive`) | data-dictates-form | новый |
| H15 | entities | Право-выравнивание числовых счётчиков/валюты | data-dictates-form | новый (см. H4) |
| H16 | dashboard, crm | Право-выравнивание колонки даты/суммы | data-dictates-form | новый (см. H4) |
| H17 | chat-channel-list | `EmptyState` при пустом списке каналов | invisible-ui | `ui/empty-state` |
| H18 | kanban | Оживить кебаб колонки (`DropdownMenu`) или не рендерить кнопку | progressive-disclosure | `ui/dropdown-menu` |

### Medium

| # | Surface(s) | Fix | Принцип | reusePrimitive |
|---|---|---|---|---|
| M1 | **Все статус/стадия/роль-чипы** (projects, crm, entities, admin, dashboard, runtime) | Семантический маппинг enum→variant через `ui/badge` (нейтральный по умолчанию, danger только для critical) — **shared fix** | data-dictates-form | `ui/badge` |
| M2 | **Все hover-actions на ячейке/строке** (entities, admin) | CSS reveal `.cell-actions` по `tr:hover`/`focus-within` вместо always-on | progressive-disclosure | новый (CSS) |
| M3 | **Truncate длинного текста** (crm, entities, admin, kanban, dashboard) | ellipsis + `title`/`ui/tooltip` на `cell-stack__title/__sub` и текстовые ячейки (`.u-truncate` уже есть) | data-dictates-form | `ui/tooltip` |
| M4 | **Dead disclosure-кнопки** (crm Filter, entities Filter, admin Пригласить, dashboard Сигналы) | Раскрыть в `ui/popover`/`ui/dialog` | progressive-disclosure | `ui/popover` / `ui/dialog` |
| M5 | ui-table | `group`-класс + `TableRowActions`-helper | progressive-disclosure | `ui/dropdown-menu` |
| M6 | projects | Колонка «Прогресс» (inline-бар) + цвет срочности «Срок» | data-dictates-form | новый |
| M7 | gantt | Длит./% → право-выравнивание (`.gantt2__cell--right`) | data-dictates-form | новый |
| M8 | gantt | Предшественники: поле `dependsOn` + чипы + `.gdep`-overlay | data-dictates-form | `ui/badge` |
| M9 | gantt | Контекст-меню/hover-действия по строке + подключить toggle | progressive-disclosure | `ui/context-menu` |
| M10 | gantt | Hover-тултип на полосах + клик в drawer | invisible-ui | `ui/sheet` (см. H5) |
| M11 | runtime | Колонка «Приоритет» через `PriorityFlag` | data-dictates-form | `PriorityFlag` |
| M12 | runtime | `MoreHorizontal`-ссылка → `ui/dropdown-menu` | progressive-disclosure | `ui/dropdown-menu` |
| M13 | runtime | Row-detail drawer + skeleton вместо текст-лоадера | invisible-ui | `ui/sheet`/`ui/skeleton` |
| M14 | admin | Журнал аудита → `ui/sheet` timeline | invisible-ui | `ui/sheet` |
| M15 | kanban | Hover-кебаб действий карточки | progressive-disclosure | `ui/dropdown-menu` |
| M16 | resource-matrix | Нагрузка % → чип `ui/badge` по level | data-dictates-form | `ui/badge` |
| M17 | resource-matrix | Заменить `rmatrix__avatar` на `ui/avatar` (уходит c6-баг) | data-dictates-form | `ui/avatar` |
| M18 | resource-matrix | Per-cell hover-действие → `ui/popover` редактор часов | progressive-disclosure | `ui/popover` |
| M19 | chat | Hover-меню действий канала | progressive-disclosure | `ui/dropdown-menu` |
| M20 | chat | Тултипы на presence-dot/Hash | invisible-ui | `ui/tooltip` (см. H2) |
| M21 | chat | Unread-badge: мягкий вариант + `tabular-nums` | data-dictates-form | `ui/badge` |
| M22 | entities | cols `string[]` → `{label, align?}` для право-выравнивания заголовков | data-dictates-form | новый |

### Low

| # | Surface(s) | Fix | Принцип | reusePrimitive |
|---|---|---|---|---|
| L1 | **Hover-copy на ячейках-идентификаторах** (projects, crm, dashboard, runtime) | Скрытый `copy IconButton` + `ui/tooltip` — **shared fix** | invisible-ui | `ui/icon-button` |
| L2 | **Приглушение архивных/неактивных строк** (crm won, kanban done, resource-matrix, runtime) | `.is-dimmed`/opacity-модификатор по данным — **shared fix** | data-dictates-form | новый |
| L3 | **Avatar legacy → `ui/avatar`** (projects, entities, dashboard, chat, runtime) | Замена `BemAvatar` на `ui/avatar` (Image/Fallback/Group) | data-dictates-form | `ui/avatar` |
| L4 | **Confirm-модалки для destructive** (entities, admin) | `ui/dialog` confirmation | invisible-ui | `ui/dialog` |
| L5 | ui-table | Sort/tooltip-аффорданс в `TableHead` | invisible-ui | `ui/tooltip` |
| L6 | projects | EmptyState для архива/шаблонов | progressive-disclosure | `ui/empty-state` |
| L7 | crm | Filter → popover | progressive-disclosure | `ui/popover` (см. M4) |
| L8 | crm | Forecast: агрегация суммы по стадии + sparkline | data-dictates-form | новый |
| L9 | entities | Filter → popover | progressive-disclosure | `ui/popover` (см. M4) |
| L10 | gantt | SPI/CPI: порог-цвет/sparkline | data-dictates-form | `ui/badge` |
| L11 | resource-matrix | freeHours: порог через проп + tooltip | invisible-ui | `ui/tooltip` |

---

## Что уже сделано хорошо

- **Единый табличный слой.** Есть общий `Table`/`DataTable`, `CellStack`, `CardPanel` — структура переиспользуется, правки централизуемы.
- **Богатый набор `ui/*` примитивов уже существует** и просто недо-используется: `ui/tooltip`, `ui/badge` (11 вариантов), `ui/dropdown-menu` (с destructive-вариантом item), `ui/context-menu`, `ui/sheet`, `ui/dialog`, `ui/popover`, `ui/skeleton` (+`SkeletonRow`), `ui/empty-state`, `ui/error-state`, `ui/loading-state`, `ui/avatar` (Image/Fallback/Badge/Group/GroupCount), `ui/icon-button`. Большинство исправлений — переиспользование, а не разработка с нуля.
- **`tabular-nums` уже заложен** в `.mono` (bem.css:24) и в gantt-числовые ячейки — не хватает только право-выравнивания, чтобы он заработал.
- **CSS уже содержит «спящие» аффордансы:** `.gbar__progress`/`.gbar__label` (Gantt-прогресс), `.gdep*` (SVG-зависимости), `.cell-stack--link`, `.u-truncate`, `.is-selected`, `.cell-actions`, `.progress-bar` — структура есть, её просто не подключили.
- **`ui/icon-button` уже выставляет `title`** из `label` (icon-button.tsx:56) — поэтому icon-кнопки на его базе уже имеют нативный тултип (это учтено: на entities кебаб НЕ помечен как пробел).
- **Точечные правильные паттерны:** в runtime-экране Agent-флоу имеет двухшаговое подтверждение (254-266); TaskTable варьирует чип статуса (waiting→warning); resource-matrix задаёт нативные `title` на ячейках (часы/отпуск). Есть от чего отталкиваться.

---

## Рекомендованный порядок работ

Идея: сначала построить/расширить горстку общих кирпичиков, после чего правки по экранам становятся почти тривиальными (поменять класс/обернуть в примитив). Порядок:

1. **CSS-утилита числовой ячейки** `.num` / `.u-text-right` (`text-align:right; font-variant-numeric:tabular-nums`) + `numeric`/`align`-проп на `TableCell`/`TableHead`. Закрывает H4/H15/H16/M7 (числа во всех таблицах) одним кирпичиком, т.к. `tabular-nums` уже есть.
2. **Truncate в `CellStack`/`TableCell`** (`truncate`-проп → `overflow/ellipsis/nowrap` + проброс `title`). Закрывает H11/M3/L (длинный текст) повсеместно.
3. **`StatusChip`/`BadgeCell` обёртка** поверх `ui/badge` с маппингом enum→variant (нейтральный по умолчанию). Закрывает M1 (статусы/стадии/роли на 6 поверхностях) и переводит чипы с legacy BEM `Chip` на токены.
4. **`IconButton`, обёрнутый в `ui/tooltip`** (и корневой `TooltipProvider`). Закрывает H2 (тултипы — самый частый пробел) и параллельно даёт основу для icon-кнопок действий.
5. **`TableRowActions` + hover-reveal** (`group` на `TableRow`, `ui/dropdown-menu`-кебаб). Закрывает H3/H8/H18/M5/M12/M15/M19 (оживление «мёртвых» кебабов и сворачивание тулбаров).
6. **`TableEmptyRow`/`TableLoadingRow`** поверх `ui/skeleton`/`ui/empty-state`/`ui/error-state`. Закрывает H1/H17/M13 (loading/empty/error на ~9 поверхностях) одним импортом.
7. **Row-detail `ui/sheet` паттерн** + **confirm `ui/dialog`** для необратимых действий. Закрывает H5/H13/M10/M13/M14/L4.
8. **Точечная полировка по экранам:** Gantt-прогресс/зависимости (H6/M8/L10), `ui/avatar` миграция (H7/M17/L3), приглушение неактивных строк (H14/L2), hover-copy (L1), `PriorityFlag`-колонка (M11) и пр.

После шагов 1–6 (общие примитивы) бóльшая часть из 102 находок закрывается заменой класса или обёрткой в готовый примитив; шаги 7–8 — это уже адресные доработки на конкретных поверхностях.

---

## Приложение: визуальные эталоны (Figma-референсы Kole Jain)

Из библиотеки Kole Jain скопированы в драфты и просмотрены 3 файла. Они подтверждают рубрику на живых макетах и служат «как надо» для конкретных пунктов бэклога. (Полное чтение в высоком разрешении упёрлось в лимит Figma MCP для View-seat — здесь зафиксированы паттерны с обзорных скриншотов.)

| Референс | Паттерн «как надо» | Закрывает |
|---|---|---|
| **Vibe-Coded-SaaS** (LinkGuard) | KPI-тайл = крупное число + спарклайн + дельта ↑↓ (семантический зелёный/красный) | dashboard P1 (число+график), L8 |
| **Vibe-Coded-SaaS** | Ranked-list строка: цветная точка категории + label + **число по правому краю** + % + дельта | M16 (resource-matrix %→чип), H4 (право-выравнивание), stats |
| **Vibe-Coded-SaaS** | Таблица Active Links: статус-чип, числа справа, **неактивные строки приглушены**, трейлинг-меню по строке | M1 (семантичные чипы), H4, L2 (dim), H3 (row-меню) |
| **Vibe-Coded-SaaS** | Inline горизонтальный бар внутри ячейки (страна + % заполнения) | M6 (колонка «Прогресс» inline-баром) |
| **Micro-Dashboard** | Project Overview = горизонтальный прогресс-бар + **лента активности справа (timeline с аватарами)** | Gantt-прогресс H6, «лог→timeline» P1, аватары H7/L3, disclosure в боковую колонку |
| **Software-Sections** | **Avatar-стеки** для команды/доступа; мини-бары «insight at a glance» в карточках | L3 (`ui/avatar` Group), dashboard-виджеты |

**Сквозной вывод эталонов** дублирует рубрику принципа 1: число → `число+спарклайн, правый край`; категория → `цветной чип/точка`; человек → `аватар`; лог → `таймлайн+аватары сбоку`.

### Полные экспорты получены — «до/после» эталоны

Все 5 файлов выгружены целиком (JSON-дерево + PNG-рендеры узлов) в [`../design/`](../design/). Курируемый индекс с привязкой каждого рендера к принципам/шагам/бэклогу — в [`refs/README.md`](./refs/README.md). Ключевые «как надо» из **Dashboard-Flaws** (тот самый файл из видео):

| Рендер | Эталон | Закрывает |
|---|---|---|
| `node_2_2` | Таблица сотрудников: категория-точки, статус-чипы ✓/✗, числа справа, email-обрезка, **приглушённые неактивные строки** | H4, M1, L2, H11 (шаги 1–3) |
| `node_2_740` | Incident Tracking: KPI+бар-чарт, Severity иконкой+цветом, Category-чипы, аватары | KPI+chart, M1, L3 |
| `node_2_466` | Drawer: лог активности как **таймлайн в боковой шторке** | H5, P1-timeline |
| `node_2_1078` | Share-поповер: поиск+Invite сверху, роль справа | H3, M4 |
| `node_2_645`, `node_2_1220/1221` | Онбординг: чеклист + коачмарки-указатели (не модалка) | онбординг (P2) |

Из **UI-Elements**: `node_1_48` — KPI «число+спарклайн+дельта» (компакт→развёрнутый график). Перед каждым фиксом поверхности открываю соответствующий рендер как визуальную цель.
