# Референсы продукта

Эта папка содержит обязательные reference materials для KISS PM. Скриншоты BR2 используются как источник возможностей и паттернов. Документы MS Project используются как источник требований к scheduling engine.
Визуальные boards дизайн-системы используются как источник текущего KISS PM UI baseline для реализации и ревью.

## BR2 screenshots

- `BR2_ (1).png` — Portfolio Gantt: мультипроектный timeline, KPI strip, действия, фильтры.
- `BR2_ (2).png` — CRM deal -> project wizard.
- `BR2_ (3).png` — выбор структуры проекта: пустой проект, шаблон, будущий AI draft.
- `BR2_ (4).png` — параметры проекта и назначение ролей.
- `BR2_ (5).png` — Gantt/WBS workspace: toolbar, baseline, critical path, dependencies.
- `BR2_ (6).png` — настройки проекта, бюджеты, роли, CRM-linked dates.
- `BR2_ (7).png` — role dashboard с KPI и attention cards.
- `BR2_ (8).png` — profile/help menu; Bitrix24 link считается obsolete.
- `BR2_ (9).png` — notification center.
- `BR2_ (10).png` — My Tasks Kanban.
- `BR2_ (11).png` — фильтр задач по роли участия.
- `BR2_ (12).png` — фильтр задач по статусу.
- `BR2_ (13).png` — фильтр задач по проекту.
- `BR2_ (14).png` — modal создания задачи.
- `BR2_ (15).png` — месячная ресурсная матрица.
- `BR2_ (16).png` — drilldown ячейки resource matrix.
- `BR2_ (17).png` — редактирование отсутствия/исключения календаря.
- `BR2_ (18).png` — free capacity heatmap.
- `BR2_ (19).png` — active projects operational grid; legacy report wording не переносится.
- `BR2_ (20).png` — closed projects retrospective.

## MS Project references

- `MS_PROJECT_МОДЕЛЬ_ПЛАНИРОВАНИЯ.md` — русская выжимка по Work/Duration/Units, типам задач, зависимостям, календарям и constraints.
- `MS_PROJECT_АРХИТЕКТУРА_РЕАЛИЗАЦИИ.md` — русская выжимка по архитектуре scheduling engine, CPM, resource leveling и MSPDI.

## Design system boards

- `design-system/01-colors-and-tokens.png` — цвета, surface tokens, stage lines, радиусы, тени и dark theme parity.
- `design-system/02-typography-and-density.png` — типографика, числовые форматы, spacing и operational density.
- `design-system/03-shell-and-layout.png` — workspace shell, sidebar/topbar, page anatomy, kanban/table grids и breakpoints.
- `design-system/04-controls-and-forms.png` — buttons, inputs, tabs, segmented controls, chips, menus, dialogs и accessibility states.
- `design-system/05-kanban-cards.png` — анатомия kanban карточек сделки, stage variants, resource status variants и quick add.
- `design-system/06-tables-lists-resource-status.png` — deal list table, cell patterns, resource matrix и loading/empty/error/forbidden states.
- `design-system/07-detail-pages-activity-feed.png` — two-block CRM detail layout, pipeline/status bar, fields pane и activity feed.
- `design-system/08-responsive-accessibility-themes.png` — responsive behavior, keyboard focus, touch targets, dark theme и visual QA checklist.
- `design-system/snapshots/` — рабочие visual QA снимки UI-итераций: CRM deal/client/product detail, kanban, inline editing, date picker и Phase 2.2 CRUD.

## Правило

Референсы обязательны для проверки продукта, но BR2/MS Project материалы не являются готовым UI-дизайном или готовой архитектурой. KISS PM должен извлечь из них управленческую логику и реализовать ее в универсальной SaaS/self-hosted модели. Design system boards являются визуальным baseline KISS PM, но все равно требуют реализации через текущие components, permissions, application commands, audit и E2E.
