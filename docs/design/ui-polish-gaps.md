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
- [ ] **Confirm Dialog для необратимых действий** — «Активировать проект» / смена статуса идут без подтверждения (есть toast после). Аудит хочет `ui/dialog`-подтверждение на необратимом.
- [ ] **Кебаб на TaskTable/DealsTable** — там основное действие (advance) видно инлайн; вторичные действия (комментарий/блокер у задач — инлайн-форма) можно собрать в кебаб. Низкий приоритет.
- [ ] **Тултипы на прочих icon-only** — пройтись по KanbanCard, тулбарам, иконкам в шапке; сейчас тултип только на kebab проектов.
- [x] **Live-верификация** — проверено на authed-стеке (Postgres :55433 / API :4000 / web :3000): логин → /projects (kebab открывает Открыть/План-график/Ресурсы, навигация работает), /projects/:id/resources (AssignmentsTable рендерит реальные назначения, «План» право-выровнен). Состояния loading/empty/error через перехват маршрутов — отдельный заход.

## Найдено визуальным аудитом (данные, не UI-регрессия)
- [ ] **Ресурсы — заголовок** «Ресурсы · Проект»: `planning.project.title` отдаёт дженерик «Проект» вместо названия проекта. Бэк/мэппинг read-model.
- [ ] **Ресурсы — имена** «Ресурс 1…9» (плейсхолдер `Ресурс {index+1}` в `AssignmentsTable`): `assignment.resourceId` не резолвится в имя сотрудника. Нужен джойн на пользователя в read-model или на клиенте.

## Вне scope этого захода (другие поверхности)
- Storybook mock-блоки на BEM `DataTable`: `deals-block`, `entities-block`, `admin-block`, `project-baseline-block`, `project-scenarios-block`. Пользователь выбрал prod-runtime первым; блоки — отдельный заход.
