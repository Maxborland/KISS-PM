# Storybook / UI scaffold — интерфейс-аудит (2026-06-22)

**Worktree:** `codex/storybook-interface-scaffold-audit-20260621`
**Цель:** сделать Storybook KISS PM пригодным для продуктового ревью «product-first» до углубления runtime.
**Метод:** чтение исходников всех view-блоков + shell, визуальная инспекция 27 экранов на desktop (1440) и mobile (390), adversarial-проверка ключевых утверждений (workflow, 18 агентов).

**Артефакты-доказательства:**
- Скриншоты (54 шт., desktop+mobile): `tmp/storybook-audit-2026-06-22/shots/<screen>.{desktop,mobile}.png`
- Консоль/pageerror per-story: `tmp/storybook-audit-2026-06-22/console-report.json` (0 ошибок на всех 54)
- Скрипт съёмки: `tmp/storybook-audit-2026-06-22/shoot.mjs`

## Baseline (до изменений)

| Команда | Результат |
|---------|-----------|
| `pnpm --filter @kiss-pm/web typecheck` | **exit 0** |
| `pnpm --filter @kiss-pm/web test` | **exit 0** |
| Storybook dev (`:6006`) | стартует, 49 story-файлов, 27 экранов Views/Screens, 0 console/pageerror |
| `pnpm verify:storybook-contract` | не запускался в baseline (тяжёлый build+serve); запланирован в Phase 3 |

Инвентарь stories: 43 UI-примитива (`components/ui/*`), 1 каталог, 2 foundations (Colors, Typography), 1 файл `Views/Screens` (27 экранов через диспетчер `ScreenView` → `BLOCK_BY_ID`). Stories под `domain/`, `widgets/`, `shell/` отсутствуют (компоненты показаны только косвенно через экраны и каталог).

---

## Ранжированные находки

### P0 — ломает композицию/навигацию/ревью

**P0-1. Workspace-shell не адаптивен — на 390px нечитаемы все ~22 workspace-экрана.**
`.app-canvas__panel` — это `display:flex` с `.app-sidebar { width: var(--sidebar-width)=232px; flex-shrink:0 }` и `overflow:hidden`; **ни одного `@media` для shell** (`bem.css:95-122`, `tokens.css:130`). На 390px сайдбар забирает 232px, контенту остаётся ~158px → заголовки/таблицы/тайлы обрезаются за правым краем. Подтверждено визуально на `dashboard.mobile.png`, `deals.mobile.png`, `admin.mobile.png`, `settings.mobile.png`, `my-work.mobile.png`, `project-gantt.mobile.png` и др. Дефект структурный (единый AppShell), затрагивает каждый экран через `WorkspaceChrome`. Исключения, которые на mobile в порядке: `19-login` (`variant:"login"`) и `state-*` (`variant:"bare"`) — они не используют shell. *(adversarial: confirmed)*

**P0-2. Внутренние сетки не сворачиваются на mobile.** `.bento` (`repeat(12,1fr)`, `bem.css:764`), `.funnel` (`repeat(5,1fr)`, `bem.css:695`), `DataTable`, `resource-matrix` (inline `gridTemplateColumns: 240px 56px repeat(...)`), Gantt — без mobile-брейкпоинтов. Компаундит с P0-1: даже при свёрнутом сайдбаре контент переполняет 390px.

### P1 — fake-контролы / нечестность / EN-копи / отсутствие состояний

**P1-1. Fake-dead affordances почти повсеместны.** Кликабельные контролы без `onClick`/`disabled`, выглядящие рабочими, ведущие в никуда. Топбар (`Экспорт`/`Создать`) и кнопки `Фильтр` в тулбарах — единственные честные (`disabled` + `title`). Остальное мёртвое:
- **Shell:** все 13 пунктов сайдбара (`app-sidebar.tsx:39-48`, `href="#"`+`preventDefault`), родительские хлебные крошки (`topbar-breadcrumbs.tsx:17-19`), колокольчик «Уведомления» (`app-topbar.tsx:18-20`), submit «Войти» на логине (`login-screen-view.tsx:10,44`).
- **Dashboard (6):** «Месяц», IconButton «Календарь», 2× ExternalLink митингов, «Вся работа», «Открыть управленческую поверхность» (`dashboard-bento.tsx:92,132,142,155,168,236`).
- **PageIntro CTA (все экраны):** «+ Сделка» (`deals-block.tsx:40`), «+ Проект» (`projects-list-block.tsx:25`), «Пригласить»/«Аудит» (`admin-block.tsx:28,75`), «Добавить»/«Импорт» (`entities-block.tsx:55,59`), «Открыть управленческую поверхность» (`project-kpi-block.tsx:28`), «Создать снимок»/«Сравнить» (`project-baseline-block.tsx:46-47`), «Принять сценарий»/«Принять» (`project-scenarios-block.tsx:21,55`), «Шаблоны»/«Сохранить»/«Добавить»/«×»-удаление (`project-calendars-block.tsx:72,76,112,140`), «Сохранить» (`settings-block.tsx:28`), «Роли»/«Май 2026»/«Назначить» (`project-resources-block.tsx:21-32`).
- **Gantt:** вся тулбар-панель (13 кнопок) + «Май 2026»/«Сохранить» (`gantt-slice-block.tsx:36-82`); WBS-свёртка (`gantt.tsx:52`); Segmented масштаба переключает подсветку, но `zoom` не передаётся в `<Gantt>` (`gantt-slice-block.tsx:84,114`).
- **Row-actions «…»:** projects, entities, admin, kanban-колонки (`Действия` без меню).
- **Entity-detail:** «Запланировать»/«Сохранить»/«…», композер ленты (textarea + «Прикрепить» + «Отправить»), псевдо-ссылки «Связи» (`entity-detail-block.tsx:52-148`).
- **Resource-matrix:** свёртка групп (`resource-matrix.tsx:31`).
*(adversarial C6: confirmed — page CTA активна и мертва, тогда как топбар-CTA честно disabled.)*

**P1-2. EN-копи в UI (нарушения §1/§6/§7).** Подтверждено в коде и на скриншотах:
| Текст | Где | Должно быть |
|-------|-----|-------------|
| `Urgent` / `Low` | `my-work-block.tsx:36,48` (priorityLabel) | Срочный / Низкий |
| `Action` / `Review` | `project-kpi-block.tsx:59` (Chip) | RU-статус (напр. «К действию»/«На контроле») |
| `Domain allowlist` | `admin-block.tsx:85` | **Белый список доменов** (точная замена §1) |
| `single sign-on`, `tenant` | `admin-block.tsx:84,85` | единый вход (SSO) / организации |
| `Enterprise`/`Mid-market`/`SMB` | `entities-block.tsx:20-22` | Крупный/Средний/Малый бизнес |
| `CFO`/`Operations` | `entities-block.tsx:30-31` | Фин. директор / Операционный директор |
| `tenant` | `entities-block.tsx:17`, `project-calendars-block.tsx:69,83` | организации/рабочей области |
| `control signals` | `settings-block.tsx:101` | сигналы контроля |
| `What-if`, `+1 dev`/`-1 dev` | `project-scenarios-block.tsx:20,11,12` | «что если» / +1 разработчик |
| `Renewal · 2027`, `Sales deck`, `Homepage` | `deals-block.tsx:28`, `my-work-block.tsx:37,46` | Продление / RU-названия |
| `Quick Daily`, `John Onboarding`, `Avg`, `vs` | `dashboard-bento.tsx:139,152,117,67` | RU |
| `Overlay вместо push`, `Только overlay` | `space-discipline-block.tsx:9,11` | Наложение вместо сдвига |
| `Backend каркас`/`Frontend shell`/`scope`/`UI mockups` | `widgets/gantt/mock-data.ts` | RU |
| `dropdown`/`topbar`, `self-hosted`/`design-v3`, `React view`/`parity`/`Phase 2` | avatar-menu/login/placeholder subtitles | RU / убрать dev-метки |
*(adversarial C2: confirmed; C3: partial — это EN-копи в Chip, НЕ кликабельная ссылка; C4: confirmed.)*

**P1-3. Отсутствуют состояния, привязанные к реальным экранам.** `state-empty/error/forbidden/loading` существуют только как 4 generic «bare»-экрана. Ни у одного функционального экрана (deals, projects, my-work, kpi, audit, admin, entities) нет loading/empty/error/forbidden/readonly. Поиск/таблицы не имеют empty-результата; `SearchPill` поддерживает `loading`, но не используется. Режим «Список» в `my-work` — однострочная заглушка «демо переключения режима» (видимая dev-формулировка). Вкладки «Интеграции»/«Оплата» в `settings` рендерят пустую карточку.

**P1-4. Композиционные анти-паттерны.**
- §5: `deals` показывает воронку-канбан **и** полную таблицу одновременно при активном «Канбан» (`deals-block.tsx:65-129`; условие таблицы `mode!=="forecast"` истинно для kanban). *(confirmed)*
- §6: «Модалка создания задачи» — это `CardPanel` в потоке страницы внутри `WorkspaceChrome`, без Dialog/Sheet/overlay (`task-create-modal-block.tsx:23`). Кнопки «Отмена/Назад/Далее» и stepper статичны/мертвы. *(confirmed)*
- `projects` Архив/Шаблоны показывают те же 2 активные строки (тоггл меняет только подпись).

### P2 — полиш / консистентность / токены

- **P2-1. Fixture-счётчики ≫ видимых строк** (читается как «скрытые данные»): kanban 24/4/13 при 1/1/0 карточках («Готово 13» при «Нет задач»); воронка 12/7/4/3/18 при 4 сделках («Закрыто 18» пусто); «14 активных проектов» при 2 строках. Badge-как-счётчик легален (§7), но рассинхрон с данными снижает честность. *(adversarial C5: confirmed, реклассифицирован в P2.)*
- **P2-2. Дубль «пустых» сообщений** на `state-empty`: PageIntro «Нет задач» + EmptyState «Пока пусто». Тексты комплементарны (заголовок vs тело), не идентичны, всё RU. *(adversarial C9: partial → P2.)* Error-state без кнопки «Повторить» при тексте «Повторите позже».
- **P2-3. Навигация неконсистентна экранам.** Лейблы сайдбара (Бэклог/В работе/Проверка/Готово/Входящие/Интеграции/Отчёты/Активные/Прошлые) не соответствуют набору экранов; `activeNav` рассинхронен (Дашборд→«Задачи», Сделки→«Входящие», Проекты/Аудит/Базовый/KPI→«Отчёты», Меню аватара→«Дашборд»). Ревьюер на «Дашборде» видит подсвеченным «Задачи».
- **P2-4.** Перенос суммы «890 000 ₽» → «890 / 000 ₽» в карточке воронки (нужен nowrap). Одна иконка `Target` на всех KPI-плитках. «4 записей» без RU-плюрализации. `tr.is-selected` статичен. Хардкод hex в sparkline (`dashboard-bento.tsx:100-110`) и `DAY_W`/`fakeDate` в Gantt. `English` как value локали.

---

## Сводка inventory affordances

| Класс | Кол-во (прибл.) | Трактовка |
|-------|-----------------|-----------|
| `disabled-honest` | ~4 | топбар Экспорт/Создать, кнопки «Фильтр» — **эталон честности** |
| `wired` | ~8 | командная палитра (Ctrl+K), Select/DatePicker в entity-detail и calendars, resource-stats/legend/cells |
| `fixture-toggle` | ~20 | Segmented-переключатели, uncontrolled inputs/switches форм — приемлемо как изолированный мок |
| `fake-dead` | **~60** | основная проблема: контролы выглядят рабочими, `onClick`/`disabled` отсутствуют |

---

## План Phase 2 (по решениям пользователя)

**Решение 1 — честность affordances: «Interactive fixture + markers».** Флагманские create-CTA (задача/сделка) открывают РЕАЛЬНУЮ форму в Dialog/Sheet, явно помеченную как Storybook-прототип без сохранения; остальные не-форменные действия → честный `disabled` + `title`.
**Решение 2 — охват: «Broad consistent pass».** Чинить P0-shell один раз (помогает всем экранам), затем единообразно применить honesty + RU-копи + честность данных по всем workspace-областям.

Чек-лист реализации (evidence-gated):
1. **P0 responsive shell** — drawer-сайдбар (`@media` + burger-тогл в топбаре), mobile-брейкпоинты `.bento`/`.funnel`/таблиц.
2. **Honesty-примитивы** — видимый маркер прототипа; переиспользуемый create-Dialog поверх существующей формы; конвенция `disabled + title` для не-форменных действий.
3. **Broad pass** — RU-копи везде; create-CTA→Dialog (флагман task/deal), прочие fake→disabled+title; deals §5; create-modal §6→Dialog; settings пустые вкладки; sidebar/breadcrumbs/bell честность.
4. **States** — убрать дубль empty, добавить retry; честность счётчиков/плотности.
5. **Verify** — typecheck, test, `verify:storybook-contract`, `build-storybook`, повторные скриншоты desktop+390, console/pageerror, `git diff --check`.

---

## Что сделано (Phase 2/3 — rebuild)

**Решения пользователя:** честность affordances = «Interactive fixture + markers»; охват = «Broad consistent pass».

### Новые честность-примитивы
- `apps/web/src/views/lib/demo.ts` — `demoAction(what)` (→ `{ disabled, title }`), `PROTOTYPE_LABEL`, `DEMO_NAV_TITLE`. Единый честный паттерн для неподключённых действий.
- `apps/web/src/views/lib/prototype-dialog.tsx` — `PrototypeDialog` (реальный Dialog/overlay с видимой пометкой «Прототип · форма не сохраняется») для флагманских create-сценариев.

### P0 — адаптивный shell (исправлено)
- `shell/app-shell.tsx` — клиентский off-canvas drawer: рабочий бургер (реальный `useState`-тогл) + scrim. `styles/bem.css` — `@media (max-width:860px)`: сайдбар → fixed drawer, `.app-topbar` скрыт, `.app-mobilebar` (бургер+бренд+чип «Прототип»), контент во всю ширину, `.table-wrap` скроллится. `@media (max-width:720px)`: `.bento`→1 кол (bem.css), `.funnel`→1 кол (bem-supplement.css). Проверено: на 390px `horizontalOverflow: 0`, контент не обрезан; desktop без изменений.

### Честность affordances (broad)
- **Shell:** пункты сайдбара и родительские крошки больше не fake-ссылки `href="#"` — неинтерактивные элементы с `title`; колокольчик «Уведомления» → disabled+title; маркеры «Прототип» в сайдбаре и mobilebar.
- **Флагманские create как реальные модалки:** «04 Новая задача» — реальный `Dialog` со степпером (Назад/Далее рабочие, «Создать» честно disabled); «+ Сделка» открывает `PrototypeDialog` с формой; пустое состояние «Создать задачу» открывает ту же модалку.
- **Прочие неподключённые действия** (Сохранить/Сравнить/Принять/Пригласить/Импорт/Снимок/Шаблоны/Назначить/Роли/месяц/строковые «…»/тулбар Ганта/свёртки/удаление исключений и т.д.) → `disabled` + честный `title` через `demoAction`.
- **Мёртвые поля поиска** (deals/projects/entities/audit) → `disabled` + title.

### Композиция и копи
- **§5 deals:** один вид за раз (канбан ИЛИ таблица); воронка с честными вычисляемыми счётчиками и более плотным набором (8 сделок).
- **§6 task-create:** форма перенесена из inline-CardPanel в реальный Dialog.
- **my-work:** RU-приоритеты (Срочный/Низкий…), счётчики колонок = числу карточек, рабочий вид «Список».
- **settings:** вкладки «Интеграции»/«Оплата» → честный `EmptyState` «Раздел в разработке»; «Slack — сигналы контроля»; «Английский».
- **RU-копи везде:** «Белый список доменов», «единый вход (SSO)», «организации», сегменты/должности (Крупный бизнес…/Финансовый директор…), «Сценарии «что если»», «+1 разработчик», «Продление», RU-названия задач/митингов, «Средняя концентрация», «Наложение вместо сдвига», RU в Ганте (UI-макеты/Каркас бэкенда/Объём…), login-footnote «Демо-прототип · вход не выполняется» и т.д.
- **admin:** «Заблокирован» → `variant="danger"`. **audit:** «Записей: N» (плюрализация). **projects:** честный lead без ложных чисел + 5 строк для плотности.

### Что стало пригодно для ревью
- Интерфейс **читаем и юзабелен на 390px** на всех 22 workspace-экранах (drawer-навигация), не только на desktop.
- **Граница «реальное vs прототип» явная и консистентная:** глобальные маркеры «Прототип» + честные disabled-действия; неподключённые кнопки больше не выдаются за рабочие.
- **Ключевые workflow проверяемы как fixture:** создание задачи/сделки (реальные модалки со степпером), переключение видов (канбан/список, вкладки настроек, режимы), состояния empty/error/loading/forbidden/dense-data.
- KPI-сигналы, аудит, базовый план, сценарии, ресурсы, календари читаются как серьёзный операционный инструмент на русском.

### Осталось (runtime-only / следующие итерации)
- **Навигация между экранами** в Storybook не «живая» (сайдбар/крошки честно неинтерактивны). Полноценный навигируемый «прототип приложения» (один story с внутренним роутингом) — отдельная итерация.
- **Реальные мутации/персист** (создание, сохранение настроек/политик, экспорт, приглашение, удаление) — runtime, требуют API/read-model; сейчас честно disabled или fixture-модалки без сохранения.
- **P2-полиш:** дубль «empty»-заголовка (PageIntro + EmptyState — комплементарны, оставлено), hex в SVG-sparkline/`DAY_W` Ганта (допустимо как SVG), `activeNav`-маппинг сайдбара (исторический мок), per-KPI иконки.

### Verification (после rebuild)
| Команда | Результат |
|---------|-----------|
| `pnpm --filter @kiss-pm/web typecheck` | **exit 0** |
| `pnpm --filter @kiss-pm/web test` | **exit 0** (18/18, вкл. storybook-contract health) |
| `pnpm verify:storybook-contract` (build-storybook + web build + copy-scan 106) | **exit 0** |
| Скриншоты desktop+390 (54) | 0 console/pageerror; `tmp/storybook-audit-2026-06-22/shots/` (после), `shots-before/` (до) |
| Runtime-проверки (Playwright) | drawer открывается; вкладки настроек→EmptyState; «Создать задачу»→Dialog (`data-state: open`); funnel 390→1 кол |
| `git diff --check` | чисто |

**Evidence:** `tmp/storybook-audit-2026-06-22/shots/` (54 после) и `shots-before/` (54 до), `console-report.json` (0 ошибок), `shoot.mjs` / `inspect-mobile.mjs`.
