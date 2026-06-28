# UI-полировка prod-runtime по сторибуку — журнал допила

Ветка: `codex/ui-storybook-polish` (от root1 `codex/backend-prod-go-no-go-fixes`).
Цель: довести `apps/web/src/views/screens/runtime-screen-view.tsx` (реальный экран на живом бэке) до сторибук-фиделити по аудиту таблиц (Kole Jain: 3 принципа) + аудит-примитивы.

## Сделано
- **AssignmentsTable** (`/projects/:id/resources`): BEM `DataTable` → shadcn `Table`, числовая колонка «План» право-выравнивание + `tabular-nums`, `truncate` на названии. Это был последний BEM-`DataTable` в prod-runtime.
- **ProjectsTable** (`/projects`): голая иконка-ссылка `MoreHorizontal` → row-action **кебаб** (`DropdownMenu`) с реальными действиями (Открыть проект / План-график / Ресурсы) + **Tooltip** «Действия» на триггере; kebab остаётся виден при открытом меню (`data-[state=open]:opacity-100`).

## Уже покрыто (не требует работы)
- **Состояния таблиц (loading/empty/error)** — закрыто `StateGate` на уровне панели: skeleton (`TableSkeleton`/`FeedSkeleton`), empty-иллюстрация (`state-illu` + Inbox), `ErrorState` с retry. Per-row `TableEmptyRow/LoadingRow` — избыточно, не делаем.
- **Числовые ячейки / truncate / StatusChip(Badge)** — уже в TaskTable/DealsTable/ProjectsTable/UsersTable.
- **Корневой `TooltipProvider`** — смонтирован в `app/providers.tsx`.

## Недостающее / отложено (gaps)
- [ ] **Row-detail Sheet (quick-peek)** — в prod-runtime карточки задач/сделок открываются полной навигацией; быстрый сайд-просмотр (`ui/sheet`) не реализован. Решить: нужен ли peek или достаточно full-page.
- [x] **Confirm Dialog — «Активировать проект»** — сделка→проект теперь через `ui/dialog`-подтверждение (необратимость в тексте, Отмена/Активировать). Проверено вживую.
- [ ] **Confirm Dialog — прочие необратимые** — смена статуса задачи/стадии сделки идут без подтверждения (есть toast после). Решить, какие из них достаточно необратимы для confirm.
- [ ] **Кебаб на TaskTable/DealsTable** — там основное действие (advance) видно инлайн; вторичные действия (комментарий/блокер у задач — инлайн-форма) можно собрать в кебаб. Низкий приоритет.
- [ ] **Тултипы на прочих icon-only** — пройтись по KanbanCard, тулбарам, иконкам в шапке; сейчас тултип только на kebab проектов.
- [x] **Live-верификация** — проверено на authed-стеке (Postgres :55433 / API :4000 / web :3000): логин → /projects (kebab открывает Открыть/План-график/Ресурсы, навигация работает), /projects/:id/resources (AssignmentsTable рендерит реальные назначения, «План» право-выровнен). Состояния loading/empty/error через перехват маршрутов — отдельный заход.

## Найдено визуальным аудитом (данные, не UI-регрессия)
- [x] **EN-утечка «sufficient»** — карточка сделки, «Статус проверки» рендерила сырой `feasibilityStatus`. Добавил в `businessStatus` маппинг канонических (`ok/warning/conflict/blocked`) + legacy seed (`sufficient/insufficient`) → теперь «Достаточно». Проверено вживую.
- [ ] **Ресурсы — заголовок** «Ресурсы · Проект»: `planning.project.title` отдаёт дженерик «Проект» вместо названия проекта. Бэк/мэппинг read-model.
- [ ] **Ресурсы — имена** «Ресурс 1…9» (плейсхолдер `Ресурс {index+1}` в `AssignmentsTable`): `assignment.resourceId` не резолвится в имя сотрудника. Нужен джойн на пользователя в read-model или на клиенте.

## Storybook mock-блоки → shadcn (сделано)
- [x] **deals/entities/admin/baseline/scenarios** мигрированы с BEM `DataTable` на shadcn `Table` по утверждённому паттерну (numeric/truncate/Badge/align). `Chip`→`Badge` внутри таблиц (kanban-карточки с Chip не тронуты). web typecheck зелёный; визуально сверены deals/entities-products/baseline в Storybook (:6006) — консистентно с runtime.
- [ ] **Мелочь:** статус «Черновик» (entities-products) рендерится info-цветом (унаследовано от Chip defaultVariants), а не нейтральным. Faithful к оригиналу; при желании → `Badge variant="secondary"`.

## Дальше по плану пользователя (3→2→1)
- [x] (3) Storybook mock-блоки → shadcn — выше.
- [ ] (2) Row-detail Sheet (peek по строке).
- [ ] (1) Визуальный проход по остальным prod-экранам (дашборд/моя работа/админ/гант/настройки).
