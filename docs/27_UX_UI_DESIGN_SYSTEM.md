# 25. UX/UI design system

## Статус

Этот документ фиксирует визуальную систему KISS PM для текущего web foundation.

Дизайн-система не заменяет продуктовые документы и не является свободной
галереей макетов. Она переводит UX-принципы из `10_UX_UI_РЕФЕРЕНСЫ.md`,
CRM-шаблон из `25_CRM_ENTITY_WORKSPACE_TEMPLATE.md` и текущие web tokens в
практические правила для экранов, компонентов и visual QA.

Implementation source для CSS-токенов находится в:

- `apps/web/src/styles.css`;
- `apps/web/src/shadcn.css`;
- `apps/web/src/components/ui`;
- `apps/web/src/components/workspace-ui.tsx`.

Визуальные boards лежат в `docs/references/design-system/` и используются как
reference surfaces для обсуждения, ревью и будущей реализации.

## Визуальные boards

1. [Цвета и токены](references/design-system/01-colors-and-tokens.png)
2. [Типографика и плотность](references/design-system/02-typography-and-density.png)
3. [Shell и layout](references/design-system/03-shell-and-layout.png)
4. [Controls и формы](references/design-system/04-controls-and-forms.png)
5. [Kanban карточки](references/design-system/05-kanban-cards.png)
6. [Таблицы, списки и ресурсные статусы](references/design-system/06-tables-lists-resource-status.png)
7. [Detail pages и activity feed](references/design-system/07-detail-pages-activity-feed.png)
8. [Responsive, accessibility и темы](references/design-system/08-responsive-accessibility-themes.png)

Дополнительные рабочие снимки UI-итераций лежат в
`docs/references/design-system/snapshots/`. Они используются как исторические
visual QA artifacts: до/после CRM-экранов, карточек сущностей, inline editing,
date picker, kanban и Phase 2.2 CRUD. Эти файлы являются частью дизайн-системы,
но не заменяют canonical boards выше.

## Базовый визуальный принцип

KISS PM выглядит как рабочее место операционного менеджера, а не как
маркетинговый SaaS landing.

Главные свойства интерфейса:

- плотная, но читаемая подача данных;
- явные деньги, часы, роли, статусы и следующий шаг;
- спокойная светлая поверхность без декоративных hero-блоков;
- русская пользовательская терминология;
- каждое существенное действие ведет в application command, permission check и audit;
- disabled-состояние объясняет причину, если действие важно для сценария;
- controls не показываются как активные, если сценарий не реализован.

## Цвета и токены

Базовая светлая тема:

| Token | Значение | Применение |
|---|---:|---|
| `--canvas` | `#f6f7f9` | фон приложения |
| `--panel` | `#ffffff` | панели, карточки, таблицы |
| `--panel-subtle` | `#f9fafb` | header rows, hover, secondary surfaces |
| `--border` | `#e3e6eb` | обычные границы |
| `--border-strong` | `#d4d9e2` | активные или структурные границы |
| `--text` | `#020617` | основной текст |
| `--muted` | `#667085` | вторичный текст |
| `--muted-strong` | `#475467` | важный вторичный текст |
| `--danger` | `#b42318` | destructive / reject |
| `--success` | `#137a4f` | confirmed / sufficient |
| `--warning` | `#a15c07` | warning / attention |

Primary action в текущем стиле черный или почти черный. Цветной акцент
используется точечно: stage line, status chip, warning, danger, focus.

Радиусы:

- kanban cards и компактные metadata chips: 6-8px;
- app panels и shell surfaces: текущий `--radius`, сейчас 14px;
- не вкладывать декоративные cards внутрь cards.

## Типографика и плотность

Основной стек: `Inter`, system UI, `Segoe UI`, sans-serif.

Рекомендуемая иерархия:

| Уровень | Размер | Пример |
|---|---:|---|
| Page title | 22px | `Сделки` |
| Section title | 16px | `Ресурсная проверка` |
| Body | 14px | `Клиенты, контакты и этапы ведут входящий проект` |
| Dense body | 13px | `ООО Ромашка · Ирина Клиент` |
| Caption | 12px | `проверено 19.05.2026, 20:14` |
| Chip text | 12px | `Квалификация` |

Числа должны быть видимыми без drilldown:

- `32 100 000 ₽`;
- `100 ч · 600 000 ₽ · 6 000 ₽/ч`;
- `44 из 44`;
- `Сегодня`, `1дн`, `23дн`.

На operational surfaces запрещены hero-scale заголовки, отрицательный
letter-spacing и viewport-scaled typography.

## Shell и layout

Foundation shell:

- sidebar: 272px на desktop;
- compact sidebar: 86px для промежуточных состояний;
- topbar: около 58px;
- content padding: 24px на desktop;
- основной canvas: `#f6f7f9`;
- content panels: белые поверхности с тонкой границей.

Page anatomy:

1. Header: title, subtitle, primary action, contextual actions.
2. Summary metrics: только данные, которые помогают принять решение.
3. Toolbar: search, counters, view switch, real filters.
4. Primary surface: table, kanban, matrix, detail workspace.
5. Secondary surface: audit preview, blockers, related objects.

Responsive rules:

- desktop: полный sidebar и максимально плотная рабочая поверхность;
- tablet: compact sidebar и сохранение ключевых columns/actions;
- narrow viewport: sidebar overlay, stacked rows, horizontal board for kanban или stage list;
- actions wrap, но не перекрывают данные;
- action column в таблицах остается доступной.

## Controls и формы

Базовые controls:

- primary button: главное действие текущего экрана;
- secondary outline: рабочие команды без главного визуального веса;
- danger outline: reject/archive/destructive path;
- icon button: toolbar actions с tooltip или понятным `aria-label`;
- segmented control: переключение `Список / Канбан`;
- tabs: `Общие`, `Сделки`, `Контакты`, `Аудит`, `Еще`;
- chips: stage, status, role demand, source tags.

Правила:

- min-height интерактивного control: 36px;
- lucide-style icon size: 16px для dense surfaces;
- focus ring обязателен;
- loading, empty, error и forbidden states должны быть русскими;
- disabled action содержит reason, если пользователь ожидает это действие;
- fake affordances запрещены: нет bulk/export/sort/drag, если нет end-to-end сценария.

## Kanban карточки

Kanban в KISS PM не является доской с пустыми стикерами. Карточка сделки должна
быстро отвечать на вопросы: кто клиент, что продаем, сколько денег и часов,
какая роль нужна, кто владелец, насколько свежий сигнал, можно ли двигаться
дальше.

Анатомия карточки:

- client/contact/source line;
- recency или date;
- title;
- owner;
- amount, planned hours, rate;
- demand chips;
- source tags;
- resource status;
- age/severity marker.

Column header показывает:

- stage label из tenant-настроек;
- count;
- total amount;
- тонкую stage line.

Карточка не должна скрывать money/hours/resource status за hover-only UI.
Drag-and-drop не показывается, пока изменение этапа не реализовано как command
с permission, validation и audit.

## Таблицы, списки и ресурсные статусы

Основные таблицы должны оставаться плотными и сканируемыми.

Deal list baseline columns:

```txt
Сделка | Этап | Период | План | Потребность | Ресурсная проверка | Действия
```

Cell patterns:

- deal cell: avatar/key, title, client/contact/email;
- stage cell: chip;
- period cell: start -> end plus secondary date;
- plan cell: hours, amount, rate;
- demand cell: role chips;
- resource cell: status, warnings, timestamp;
- action cell: executable buttons or disabled reason.

Resource matrix использует цвет как усиление, но не как единственный источник
смысла. Текст ячейки показывает planned/available hours или status.

Стандартные states:

- loading skeleton;
- empty state с реальным next action;
- error state с retry;
- forbidden state с понятной причиной;
- archived/final state без исчезновения исторических данных.

## Detail pages и activity feed

Для CRM-сущностей используется two-block layout:

- левая часть: structured facts, required fields, business fields, linked objects;
- правая часть: activity workspace, composer, tasks, comments, system events, audit context.

Этот layout закреплен в `25_CRM_ENTITY_WORKSPACE_TEMPLATE.md`.

Activity feed не должен быть декоративной историей. Он показывает, что система
и пользователь уже сделали, и какое действие доступно сейчас:

- recommendation / next action;
- persisted user activity;
- system event;
- audit-relevant state change;
- governed action buttons.

Pipeline/status bar показывает lifecycle и доступные переходы. Переходы берутся
из модели или tenant settings, а не из hardcoded React.

## Accessibility, темы и QA

Минимальный accessibility contract:

- все интерактивные элементы имеют видимый label или `aria-label`;
- keyboard focus видим;
- Escape закрывает меню и modal;
- modal удерживает focus trap;
- disabled state не выглядит как ошибка;
- status не кодируется только цветом;
- destructive actions требуют confirmation;
- permission-denied не маскируется только UI-hiding.

Dark theme должна иметь пару для canvas, panel, border, text, muted, status
chips и focus ring. Нельзя добавлять hover/focus цвет только для light theme.

Visual QA checklist перед закрытием UI-задачи:

1. На desktop и narrow viewport нет наложения текста.
2. Деньги, часы, роли, статусы и next action видимы.
3. Нет fake controls.
4. Disabled actions имеют reason или скрыты по permission.
5. Таблица, kanban или detail surface имеют loading/empty/error states.
6. Dark theme не ломает contrast.
7. State-changing actions проходят через backend command и audit.
8. E2E или browser smoke проверяет основной пользовательский путь.

## Anti-patterns

Нельзя:

- превращать рабочие экраны в landing page;
- прятать критические данные в hover-only popover;
- переносить Bitrix-specific naming в ядро продукта;
- hardcode этапов, ролей, KPI и tenant labels в UI;
- показывать будущие controls как доступные;
- добавлять одноразовые CSS hacks без token/system причины;
- делать `App.tsx`, route/view или CSS god-file;
- считать скриншот или визуальный board заменой реализации и E2E.
