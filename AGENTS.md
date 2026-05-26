# AGENTS.md

## 0. Статус репозитория

KISS PM перезапущен как **docs-first проект с новой чистой реализацией**.

Старый код, старые тесты, старые runtime-слои и старые phase-артефакты не являются пригодной основой. Их нельзя использовать как архитектурный источник истины. Новая реализация начинается с Node + pnpm skeleton и развивается только по русскоязычным canonical docs.

## 1. Обязательный старт агента

Перед любой работой агент обязан:

1. Прочитать этот `AGENTS.md`.
2. Выполнить `git status --short` и увидеть существующие изменения.
3. **CodeGraph (обязательно для кодовых задач):** см. раздел 8 — обновить индекс до начала работы; при отсутствии `.codegraph/` выполнить `codegraph init -i`.
4. Прочитать ближайшие документы из `docs/`.
5. Определить, является ли задача продуктовой, архитектурной, UI/UX, кодовой, документационной, ревью или только read-only вопросом.
6. Для любой задачи, которая меняет файлы, код, документы, архитектуру, UX, тесты, планы, git-состояние или продуктовый контракт, сначала пройти workflow из раздела 6.
7. Не делать разрушительные действия без явного подтверждения границ.

## 2. Язык

Все продуктовые документы в репозитории пишутся **на русском языке**.

Разрешены английские технические термины, если они являются устойчивыми именами концептов или будущими кодовыми идентификаторами: `Tenant`, `ControlSurface`, `ManagementAction`, `ControlSignal`, `KpiDefinition`, `ProjectIntake`, `ActionExecution`, `AuditEvent`.

Пользовательский UI по умолчанию проектируется на русском языке.

## 3. Миссия продукта

KISS PM — SaaS/self-hosted платформа управления проектами, ресурсной загрузкой и управленческим контролем.

Продукт не должен стать:

- статическим набором отчетов;
- BitrixReports-клоном;
- кастомной системой под одну компанию;
- хаотичным MVP;
- BI-конструктором без управленческих действий;
- таск-трекером без планирования, ресурсов, KPI и аудита.

Продукт должен вести пользователя по контуру:

```txt
Tenant-настройки
  -> CRM opportunity
  -> intake / оценка спроса
  -> capacity feasibility
  -> project draft
  -> active project
  -> Gantt / tasks / resources
  -> KPI / control signal
  -> governed action
  -> audit
  -> closure
  -> retrospective learning
  -> improved templates
```

## 4. Главные правила продукта

1. Простота KISS PM — это простота пользовательского решения, а не слабая доменная модель.
2. Каждый важный сигнал должен вести к понятному разрешенному действию.
3. Любое существенное управленческое действие должно быть проверено правами и записано в аудит.
4. Tenant-специфичные роли, стадии, KPI, поля и названия живут в настройках, не в коде.
5. CRM, Bitrix24, AmoCRM, MS Project, Jira, Slack, email — это интеграционные адаптеры, не ядро домена.
6. Gantt, Kanban, resource matrix, KPI и control surfaces используют единую модель проекта, задачи и назначения.
7. Control surface не меняет бизнес-состояние напрямую. Она вызывает application/action command.
8. Закрытые проекты дают снимки и уроки, которые улучшают будущие шаблоны.
9. Референсы BR2 используются как источник возможностей и паттернов, но не как дизайн для копирования.
10. Старый код не переносится автоматически.

## 5. Источники истины

Читать документы в таком порядке:

1. `docs/README.md`
2. `docs/00_ВИДЕНИЕ_ПРОДУКТА.md`
3. `docs/01_ПРОДУКТОВЫЙ_КОНТУР.md`
4. `docs/02_ДОМЕННАЯ_МОДЕЛЬ.md`
5. `docs/03_АРХИТЕКТУРА_SAAS_SELF_HOSTED.md`
6. `docs/04_TENANT_НАСТРОЙКИ_И_ШАБЛОНЫ.md`
7. `docs/05_РОЛИ_ПРАВА_АУДИТ.md`
8. `docs/06_CRM_ПРИЕМКА_И_ПРОЕКТЫ.md`
9. `docs/07_GANTT_ЗАДАЧИ_РЕСУРСЫ.md`
10. `docs/08_KPI_СИГНАЛЫ_ДЕЙСТВИЯ.md`
11. `docs/09_CONTROL_SURFACES.md`
12. `docs/10_UX_UI_РЕФЕРЕНСЫ.md`
13. `docs/11_E2E_КОНТРАКТ.md`
14. `docs/12_ФАЗОВЫЙ_ПЛАН.md`
15. `docs/13_ГЛОССАРИЙ_И_АНТИПАТТЕРНЫ.md`
16. `docs/14_PHASE_1_NODE_PNPM_START.md`
17. `docs/15_PHASE_1_2_POSTGRES_PERSISTENCE.md`
18. `docs/16_PHASE_1_3_DOCKER_POSTGRES_RUNTIME.md`
19. `docs/17_PHASE_1_4_DEV_SEED_AND_DB_API_SMOKE.md`
20. `docs/18_PHASE_1_5_BROWSER_API_E2E_SMOKE.md`
21. `docs/19_PHASE_2_1_ACCESS_PROFILE_ADMIN.md`
22. `docs/20_PHASE_2_2_SINGLE_WORKSPACE_AUTH_RBAC.md`
23. `docs/21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md`

## 6. Единый workflow выполнения задач

Для каждой задачи, которая меняет репозиторий, продуктовый контракт, архитектуру, UI/UX, тесты, планы, документацию или git-состояние, агент обязан применять глобальный skill `task-workflow-orchestrator`.

`task-workflow-orchestrator` является единственным источником истины по порядку:

```txt
codegraph sync (или init) -> brainstorming -> specification -> lead-architect-review
  -> ui-ux-pro-max для UI/UX задач
  -> writing-plans
  -> executing-plans или subagent-driven-development  [активно: codegraph_* во время работы]
  -> review loop
  -> receiving-code-review
  -> verification-before-completion
  -> codegraph sync
  -> finishing-a-development-branch
```

Простые read-only вопросы можно отвечать без полного workflow, но нельзя под видом read-only выполнять скрытые изменения.

## 7. Инженерная чистота и компонентный подход

Новая реализация не должна снова превращаться в god-file и набор самописных виджетов.

Перед добавлением существенной функциональности агент обязан сначала определить границы системы: какие доменные модули, application services, route/view слои, UI components, hooks/query modules, tests и styles нужны. Реализация должна сразу раскладываться по focused files с ясной ответственностью; начинать с монолитного файла "на потом разнесем" запрещено.

Обязательные правила для кода:

1. `App.tsx`, API composition files и CSS не должны бесконтрольно расти. Если файл приближается к установленному health-budget, сначала выделить focused module/component, а не продолжать дописывать в конец.
2. Повторяющиеся UI primitives, формы, модалки, таблицы, dropdown/popover, toolbar, empty/loading/error states и chips выносить в переиспользуемые компоненты.
3. Нельзя добавлять fake affordances: кнопка, чекбокс, фильтр, сортировка, bulk selection, экспорт, уведомление или меню допускаются только если есть реальный сценарий, disabled-state reason или явно скрытый future scope.
4. Для UI primitives сначала проверять готовый путь: существующий компонент проекта, затем `shadcn/ui` registry/MCP. Самописный компонент допустим только если:
   - в проекте еще нет shadcn scaffold для этого primitive;
   - есть осознанное решение не тянуть зависимость в текущем slice;
   - поведение покрыто тестом или browser smoke, если компонент интерактивный.
5. Если компонент уже есть в `shadcn/ui`, запрещено писать кастомный аналог без причины в коде или документированного решения. Для dropdown/dialog/table/form использовать shadcn/Radix-подход как целевой baseline.
6. CSS должен оставаться token/system oriented. Не добавлять одноразовые хаки, светлые hover/focus цвета без dark-theme пары, z-index без причины и селекторы, которые ломают compact/mobile layout.
7. Dead code, unused imports, stale generated artifacts, временные логи и дублирующие helper methods удаляются только с доказательством: `rg`, typecheck/test/build или другой свежий сигнал.
8. Экспортируемый код, migrations, public API contracts, route ids, permission keys и persistence schema не удалять по одному `rg` без дополнительной проверки.
9. Любой refactor должен быть behavior-preserving, маленький и проверяемый. Если меняется поведение, сначала нужна compact spec и тест/acceptance сценарий.
10. Для предотвращения повторного bloat допускаются repository health tests: line budgets, ban-list для fake classes/selectors, smoke assertions на ключевые interaction states.

## 8. CodeGraph — обязательное использование

В проекте включён MCP **CodeGraph** (`@colbymchenry/codegraph`) — локальный граф символов и связей (tree-sitter + SQLite), без внешних API.

**CodeGraph обязателен** для любой задачи, где агент читает, меняет или ревьюит исходный код, маршруты, API, тесты или архитектуру модулей. Исключение: чисто read-only вопросы без анализа кода (документация, продукт, git-статус).

### Конфигурация

- MCP (глобально и/или в проекте): сервер `codegraph` (`codegraph serve --mcp --path ${workspaceFolder}`).
- Правила агента: этот `AGENTS.md`.
- Индекс: `.codegraph/` (в git не коммитится).

### Обязательный цикл на каждую задачу

| Фаза | Когда | Действие агента |
|------|--------|-----------------|
| **До работы** | Сразу после `git status`, до spec/плана/правок | `codegraph status`; если нет `.codegraph/` — `codegraph init -i`; иначе **`codegraph sync`** (при большом расхождении с веткой — `codegraph index --force`) |
| **Во время работы** | Исследование, проектирование, рефакторинг, правки | **Активно** вызывать MCP `codegraph_*` (см. ниже); не обходить граф массовым grep/read для структурных вопросов |
| **После задачи** | Перед финальным отчётом и claim «готово» | **`codegraph sync`**; при необходимости `codegraph status` и зафиксировать в отчёте |

Команды (из корня репозитория / worktree):

```bash
codegraph status          # проверка индекса (до и после)
codegraph sync            # обязательно: до начала и после завершения задачи
codegraph index --force   # полная переиндексация (после крупных merge/rename)
codegraph init -i         # первичная инициализация (если нет .codegraph/)
```

### Активное использование во время работы

Перед изменением кода агент обязан понять контекст через CodeGraph:

1. **Поиск и вход в область:** `codegraph_search`, `codegraph_context`.
2. **Понимание потока и зависимостей:** `codegraph_explore`, `codegraph_callers`, `codegraph_callees`.
3. **Перед правками:** `codegraph_impact` для затрагиваемых символов.
4. **Детали символа:** `codegraph_node` (точечно, не десятками вызовов подряд).

**Запрещено** для структурных вопросов («где определено», «кто вызывает», «что сломается», «как устроен модуль») начинать с широкого grep/glob/read по всему репозиторию, если доступны инструменты `codegraph_*`.

**Допустимо** grep/read только для: литеральных строк, комментариев, логов, конфигов вне графа, или когда `codegraph_*` вернул пустой результат и это зафиксировано в отчёте.

### Инструменты MCP

`codegraph_search`, `codegraph_context`, `codegraph_explore`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`, `codegraph_files`, `codegraph_status`.

Если MCP недоступен — сообщить пользователю (перезапуск Cursor, проверка `mcp.json`), выполнить `codegraph sync` в терминале и не считать исследование кода завершённым без явного fallback в отчёте.

## 9. Формат финального отчета

```txt
Status:
Changed:
Files:
Tests / verification:
CodeGraph: (sync до / sync после; status: nodes/edges; использованные codegraph_*)
Decisions / assumptions:
Risks / follow-up:
```

## 10. Design-v3 lockdown

После миграции UI единственный путь визуала:

```txt
docs/design-v3/TOKENS.md → apps/web/src/styles/{tokens,tokens.planning,bem}.css
  → apps/web/src/components/{ui,domain}/* + widgets/* + shell/*
  → apps/web/src/{app,features}/**
```

Обязательные правила:

1. `apps/web/src/{app,features}/**` импортируют UI **только** из:
   - `apps/web/src/components/ui/*` (shadcn primitives)
   - `apps/web/src/components/domain/*` (composite)
   - `apps/web/src/widgets/*` (lazy-loaded)
   - `apps/web/src/shell/*` (AppShell / Topbar / Sidebar / ...)
2. Запрещено:
   - inline `style={{ ... }}` (исключение: SVG-атрибуты в Gantt с комментарием)
   - hex `#xxxxxx` / `rgba(...)` в TSX
   - прямой импорт `lucide-react@1.x` (правильно `^0.460`)
   - любой импорт из legacy `apps/web/src/features/dv2/*` или `apps/web/src/design-v2/*`
3. Запрещено создавать `*.css` в `features/**` или `components/**` — все стили в `apps/web/src/styles/{bem.css, widgets/*.css}` и `app/globals.css`.
4. Новые BEM-классы добавляются в `apps/web/src/styles/bem.css` (общие) или `apps/web/src/styles/widgets/<name>.css` (widget-specific).
5. shadcn primitives генерируются с `cssVariables: false`. Variants под BEM-визуал — `docs/design-v3/SHADCN-OVERRIDE.md`.
6. Перед PR: `pnpm --filter @kiss-pm/web typecheck && pnpm --filter @kiss-pm/web test && pnpm --filter @kiss-pm/web build`.
7. Каталог компонентов: Storybook (`pnpm --filter @kiss-pm/web storybook`).

Референсы планирования: `docs/references/planning-ui-approved/` (один каталог `references`, без дублирования).

Health-tests design-v3 (line-budgets, ban-list, bundle-budget) — Phase 16 в `apps/web/src/__health__/design-v3-enforcement.health.test.ts`.

## Cursor Cloud specific instructions

### Prerequisites

Docker is required for PostgreSQL. The VM environment snapshot has Docker pre-installed with `fuse-overlayfs` storage driver and `iptables-legacy`. If Docker daemon is not running, start it with `sudo dockerd &>/tmp/dockerd.log &` and ensure socket permissions: `sudo chmod 666 /var/run/docker.sock`.

### Starting services

1. **PostgreSQL** (port 55432): `pnpm db:up` (starts `postgres:16-alpine` via docker compose).
2. **Migrations + seed**: `pnpm db:migrate && pnpm db:seed:dev` (applies all SQL migrations and seeds demo data).
3. **API** (port 4000): `DATABASE_URL=postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm KISS_PM_ENABLE_DEV_ROUTES=true pnpm dev:api`
4. **Web** (port 3000): `KISS_PM_API_ORIGIN=http://127.0.0.1:4000 pnpm dev:web`

### Gotchas

- The API requires `DATABASE_URL` env var to enable auth and persistence. Without it, login returns `auth_not_configured` (501).
- Mutations (POST/PUT/PATCH/DELETE) require headers `x-kiss-pm-action: same-origin` and `Origin: http://127.0.0.1:3000`.
- `.env` file is not auto-loaded by the API. Pass env vars explicitly or use `set -a && source .env && set +a` before starting.
- pnpm blocks build scripts by default (esbuild, sharp). Run `pnpm rebuild esbuild` after install if tsx/next fail.
- Redis is optional; the API falls back to in-memory event bus when `PLANNING_EVENTS_BACKEND` is unset.
- Dev login credentials after seed: `admin@kiss-pm.local` / `admin12345`.

### Standard commands (see `package.json` scripts)

- `pnpm test` — unit tests (vitest)
- `pnpm test:db` — DB integration tests (requires running Postgres)
- `pnpm typecheck` — TypeScript project-wide check
- `pnpm build` — Next.js build + typecheck
- `pnpm --filter @kiss-pm/web storybook` — Storybook (port 6006)
