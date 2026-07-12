# Карантин e2e-спек

Спеки в этой папке нацелены на UI, которого больше нет в `apps/web/src` (все «мёртвые» якоря
проверены grep'ом: 0 совпадений). Раннер их не запускает: `playwright.config.ts` содержит
`testIgnore: "**/quarantine/**"`.

**Правило выхода из карантина: спека возвращается в прогон ТОЛЬКО переписанной на живые
якоря текущего UI.** Механически вернуть файл на место нельзя — гейт снова станет красным.

Покрытие keyboard-only работы с расписанием (keyboard-only-10-tasks и родственные
planning-спеки) сознательно отложено до PR Planning Cockpit (PR6) — там появится новый
целевой UI, под который эти сценарии и будут переписаны.

| Спека | Мёртвый якорь | Что делать при возврате |
| --- | --- | --- |
| `planning/planning-grid.spec.ts` | testid'ы `planning-wbs-grid`, `planning-gantt-pane`, `planning-gantt-bar`, `planning-gantt-dep-line`, `planning-schedule-pane`, `planning-conflict-banner`; хелпер `openFirstProjectSchedule` ждёт мёртвый `planning-workspace` | Переписать на грид/гант Planning Cockpit (PR6) |
| `planning/excel-paste-10x6.spec.ts` | `planning-workspace`, `planning-wbs-grid` | Сценарий вставки из Excel ценный — перенести на новый грид (PR6) |
| `planning/keyboard-only-10-tasks.spec.ts` | `planning-wbs-grid` | Keyboard-only покрытие расписания отложено до Planning Cockpit (PR6) |
| `planning/drag-fill-dates.spec.ts` | `planning-drag-fill-handle`, `planning-wbs-grid` | Drag-fill дат — переписать при появлении хэндла в новом гриде |
| `planning/compensating-undo.spec.ts` | `planning-wbs-grid`; тост «Изменения сохранены» (0 совпадений) | Undo-семантику проверить на живом тосте/гриде PR6 |
| `planning/planning-a11y.spec.ts` | axe-scan включает мёртвые `planning-workspace`, `planning-gantt-pane` | Пересобрать axe-скан по живым панелям планирования |
| `planning/assignments.spec.ts` | `planning-assignments-pane`, `planning-apply-bar` | Переписать на текущую вкладку назначений проекта |
| `planning/calendars.spec.ts` | кнопка «Добавить исключение» (0 совпадений); `planning-apply-bar` | Переписать на текущий UI календарей проекта |
| `planning/resources.spec.ts` | `planning-resources-pane` | Переписать на текущую вкладку ресурсов проекта |
| `planning/resource-matrix.spec.ts` | `planning-resource-matrix(-nav)`; проект `project-alpha` не сидируется | Переписать на живую матрицу ресурсов + сидированный проект |
| `planning/cross-project-drilldown.spec.ts` | `resource-day-drawer`, `resource-matrix-cell-*`; `project-alpha` не сидируется | Кросс-проектный drilldown — переписать на живой UI матрицы |
| `planning/settings.spec.ts` | `planning-settings-pane`, `calendar-preview-summary`; `project-alpha` не сидируется | Переписать на текущие настройки проекта + сидированный проект |
| `admin/absences.spec.ts` | роут `/settings/absences` не имеет страницы; testid'ы `absences-*` | Вернуть вместе со страницей отсутствий, когда она появится |
| `admin/org-structure.spec.ts` | роут `/settings/org-structure` не имеет страницы; `org-structure-*` | Вернуть вместе со страницей оргструктуры |
| `admin/production-calendar.spec.ts` | роут `/settings/production-calendar` не имеет страницы | Вернуть вместе со страницей производственного календаря |
| `smoke/crm-activity.spec.ts` | роуты `/opportunities/:id`, `/clients/:id`, `/contacts/:id`, `/products/:id` без страниц; якоря секций (0 совпадений) | Переписать на живые карточки `/crm/deals/:id` и т.д. |
| `smoke/crm-entity-template.spec.ts` | те же отсутствующие entity-роуты | Переписать на живые CRM-страницы сущностей |
| `smoke/production-business-flow.spec.ts` | роут `/projects/:id/timeline` отсутствует; кнопки «Подготовить сверку»/«Подготовить предложение» и 5 тостов (0 совпадений где-либо) | Бизнес-флоу ценен — пересобрать по живым роутам поставки |
| `smoke/task-workspace.spec.ts` | старый v3-UI: кнопка «Моя работа», «+ Добавить задачу», «Создать и открыть», «Включить массовый режим», `.task-kanban-column` (всё 0 совпадений) | Переписать на текущий task-workspace (`/my-work`, канбан задач) |
