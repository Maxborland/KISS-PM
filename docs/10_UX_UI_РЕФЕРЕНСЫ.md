# 10. UX/UI референсы

## Правило работы с референсами

Референсы не копируются буквально. Из них извлекаются capabilities, workflow logic, плотность данных, интерактивные паттерны и ожидания пользователя.

## Что берем из BR2

- Матричная ресурсная загрузка.
- Кастомный Gantt renderer и interaction model как исходный implementation
  asset для Phase 7 planning workspace.
- Gantt/WBS interaction density для рабочих planning surfaces.
- Мультипроектный контроль.
- Интерактивные действия прямо из таблиц, карточек, ячеек и drilldown.
- Несколько естественных путей выполнить одно действие.
- Подсказки и автозаполнения.
- Выявление и разрешение ресурсных конфликтов.
- KPI, deviations, control signals.
- Плотные рабочие интерфейсы для реальной операционной работы.

## Что не берем из BR2

- Bitrix-specific naming.
- Привязку к Bitrix24 как ядру продукта.
- Hardcoded роли, стадии и KPI конкретной компании.
- Report-first мышление.
- Legacy layout как обязательный визуальный стиль.
- Hidden scheduling/resource logic в UI-пакете, если он расходится с KISS PM
  planning engine.

## Обязательные reference surfaces

1. Portfolio Gantt / timeline.
2. CRM -> project wizard.
3. Project Gantt/WBS workspace.
4. Project settings with budgets and roles.
5. Role dashboard.
6. My Tasks / Kanban with filters.
7. Guided task creation modal.
8. Resource load matrix.
9. Resource cell drilldown.
10. Availability exception editor.
11. Free capacity heatmap.
12. Active projects operational grid.
13. Closed projects retrospective.
14. Profile/help and notifications.

## UX-принципы

- Первый экран приложения должен вести в работу, а не в маркетинговую страницу.
- На operational surfaces важнее сканируемость, плотность и ясные действия, чем декоративность.
- Для foundation shell допустим admin-dashboard паттерн: фиксированный sidebar с группами разделов, тонкий topbar с контекстом пользователя/workspace, быстрый переход по разделам и плотная content area с таблицами, метриками и audit preview.
- У каждого риска должна быть причина и следующий шаг.
- У сложного действия должен быть preview.
- У destructive или массового действия должно быть подтверждение и audit.
- Обычный пользователь не должен видеть внутренние технические концепции.
- Admin/builder mode может быть сложнее, но должен иметь presets, validation и preview.

## Visual density

KISS PM не должен быть пустой SaaS-страницей с большими карточками. Для менеджеров и resource managers нужны плотные таблицы, матрицы, фильтры, сохраненные views, sticky headers, drilldowns и быстрые действия.

Для Phase 7 planning workspace BR2 Gantt/resource packages можно переносить и
адаптировать как implementation asset. Они не являются доменным source of truth:
даты, dependencies, critical path, resource load, overloads и scenarios приходят
из KISS PM backend planning engine.

WBS table остается заменяемым слоем. Если OSS/headless table дает более сильную
virtualization, pinned columns, resize, keyboard navigation и accessibility, его
можно использовать вместо BR2 table при сохранении BR2 Gantt interaction model.

## Design system baseline

Визуальный baseline KISS PM закреплен в canonical design-system документе и PNG boards:

- `docs/27_UX_UI_DESIGN_SYSTEM.md` — правила экранов, компонентов, токенов и visual QA;
- `docs/references/design-system/01-colors-and-tokens.png` — цвета и surface tokens;
- `docs/references/design-system/02-typography-and-density.png` — типографика и плотность;
- `docs/references/design-system/03-shell-and-layout.png` — shell, layout и page anatomy;
- `docs/references/design-system/04-controls-and-forms.png` — controls, формы и states;
- `docs/references/design-system/05-kanban-cards.png` — карточки и операционные списки;
- `docs/references/design-system/06-tables-lists-resource-status.png` — таблицы, списки и resource status;
- `docs/references/design-system/07-detail-pages-activity-feed.png` — detail pages и activity feed;
- `docs/references/design-system/08-responsive-accessibility-themes.png` — responsive, accessibility и темы.

Дизайн-система описывает:

- цвета, surface tokens, состояния и stage lines;
- типографику, числовые форматы и плотность operational surfaces;
- workspace shell, responsive layout и page anatomy;
- buttons, inputs, tabs, segmented controls, chips, menus и dialogs;
- kanban карточки сделок с прозрачными данными: клиент, контакт, владелец, деньги, часы, потребность, ресурсный статус и давность сигнала;
- таблицы, списки, resource status matrix и состояния loading/empty/error/forbidden;
- two-block detail layout для CRM-карточек и activity feed;
- dark theme parity, accessibility и visual QA checklist.

Визуальные boards лежат в `docs/references/design-system/` и используются как reference surfaces для ревью и реализации. Parity проверяется через visual QA checklist из `docs/27_UX_UI_DESIGN_SYSTEM.md` и обязательный финальный отчет по `AGENTS.md` §9. Boards не заменяют E2E, permission checks, audit и реальные application commands.

## Русский UI

Пользовательский интерфейс проектируется на русском языке. Tenant labels могут отличаться по компаниям. Code identifiers остаются стабильными английскими ключами.
