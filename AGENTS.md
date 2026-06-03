# AGENTS.md

## 0. Статус репозитория

KISS PM остается **docs-first проектом**, но уже не находится в состоянии пустого skeleton.

Текущая реализация — Node + pnpm monorepo:

- `apps/api` — Node/Hono backend, OpenAPI/Scalar, PostgreSQL persistence, audit/RBAC/application routes;
- `apps/web` — Next.js App Router frontend, design-v3 UI, Storybook catalog, runtime shell;
- `packages/*` — доменные, access-control, persistence, planning и test-fixture пакеты;
- `e2e/*` — Playwright smoke/a11y/planning/runtime проверки;
- `docs/*` — canonical product, architecture, API, beta, design, runbook, marketing и status документы.

Старый код и старые phase-артефакты не являются архитектурным источником истины. Исторические решения можно смотреть в Git history, но нельзя автоматически переносить в новую реализацию.

Текущий фокус проекта: founder-beta/runtime readiness. Для beta важны не только компиляция и красивые stories, а рабочие маршруты с реальными data contracts, действиями, правами, аудитом, screenshot evidence и отсутствием demo/fake runtime UI.

## 1. Обязательный старт агента

Перед любой работой агент обязан:

1. Прочитать этот `AGENTS.md`.
2. Выполнить `git status --short` и увидеть существующие изменения.
3. Определить тип задачи: продуктовая, архитектурная, UI/UX, кодовая, документационная, ревью, QA/runtime, marketing или read-only.
4. Прочитать ближайшие источники истины из `docs/` и, если задача marketing-facing, `.agents/product-marketing.md`.
5. Для кодовых задач выполнить CodeGraph-цикл из раздела 8.
6. Для задач, меняющих файлы, сначала сформулировать маленький проверяемый slice: scope, acceptance, verification.
7. Не делать разрушительные действия и не трогать unrelated files без явного разрешения.

Если рабочее дерево уже грязное, считать изменения пользовательскими или результатом другой ветки работы. Не сбрасывать и не переписывать их. Если они мешают задаче, сначала разобраться и только потом предложить безопасный путь.

## 2. Язык

Все продуктовые документы в репозитории пишутся **на русском языке**.

Пользовательский UI по умолчанию проектируется на русском языке.

Разрешены английские технические термины, если они являются устойчивыми именами концептов, API/кодовых идентификаторов или market/category vocabulary: `Tenant`, `ControlSurface`, `ManagementAction`, `ControlSignal`, `KpiDefinition`, `ProjectIntake`, `ActionExecution`, `AuditEvent`, `project diff`, `hunk`, `self-hosted`, `Gantt`.

В runtime UI избегать dev-лейблов и внутренней терминологии. Например: `tenant` -> `арендатор`, `baseline` -> `базовый план`, `What-if` -> `сценарии`, `diff` в публичном UI -> `Сверка`.

## 3. Миссия продукта

KISS PM — SaaS/self-hosted платформа управления проектами, ресурсной загрузкой и управленческим контролем.

Продукт не должен стать:

- статическим набором отчетов;
- BitrixReports-клоном;
- кастомной системой под одну компанию;
- хаотичным MVP;
- BI-конструктором без управленческих действий;
- таск-трекером без планирования, ресурсов, KPI и аудита;
- декоративным AI-чатом поверх старых экранов.

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

Для marketing/alpha позиционирования главный цикл формулируется короче:

```txt
Цель -> запуск агента -> proposed project diff / Сверка -> ревью -> применение -> аудит
```

## 4. Главные правила продукта

1. Простота KISS PM — это простота пользовательского решения, а не слабая доменная модель.
2. Каждый важный сигнал должен вести к понятному разрешенному действию.
3. Любое существенное управленческое действие должно быть проверено правами и записано в аудит.
4. Tenant-специфичные роли, стадии, KPI, поля и названия живут в настройках, не в коде.
5. CRM, Bitrix24, AmoCRM, MS Project, Jira, Slack, email — это интеграционные адаптеры, не ядро домена.
6. Gantt, Kanban, resource matrix, KPI и control surfaces используют единую модель проекта, задачи и назначения.
7. Control surface не меняет бизнес-состояние напрямую. Она вызывает application/action command.
8. Агент не меняет проектное состояние без review/confirmation. Сначала proposal/diff, затем явное применение и audit/result.
9. Закрытые проекты дают снимки и уроки, которые улучшают будущие шаблоны.
10. Референсы BR2 и design references используются как источник возможностей, плотности и паттернов, но не копируются буквально.

## 5. Источники истины

Не поддерживать в `AGENTS.md` полный список всех phase-файлов вручную. Он быстро устаревает. Порядок чтения такой:

1. `docs/README.md` — актуальная карта canonical docs и порядок чтения.
2. `docs/00_*` ... `docs/13_*` — базовое видение, контур, доменная модель, архитектура, права, UX/E2E, glossary.
3. Активные phase/contract документы `docs/14_*` и выше — читать только ближайшие к задаче.
4. `docs/beta/*` — обязательны для founder-beta/runtime задач:
   - `business-process.md`;
   - `user-stories.md`;
   - `screen-readiness-matrix.md`;
   - `component-readiness.md`;
   - `qa-gate.md`;
   - `implementation-backlog.md`;
   - `kiss-pm-beta-plan.md`.
5. `docs/api/*` — frontend-facing API contracts, OpenAPI conventions, screen recipes и coverage ledger.
6. `docs/design-v3/*` — enforceable UI/design contract, tokens, shadcn overrides, Storybook contract.
7. `docs/runbooks/*` — runtime operations, self-hosted deployment, E2E smoke.
8. `docs/references/*` — canonical reference materials. Не создавать дубли вроде `docs/references/references/*`.
9. `docs/marketing/*` и `.agents/product-marketing.md` — единственный источник истины для лендинга, GTM, positioning и публичного copy.
10. `docs/status/*`, `docs/plans/*`, `docs/superpowers/plans/*` — статус и планы, полезны как evidence/history, но не сильнее canonical contract.

Если документы конфликтуют, приоритет такой:

```txt
AGENTS.md
  -> docs/README.md + canonical product docs
  -> active beta/API/design/runtime contract
  -> current implementation and tests
  -> historical plans/status
```

## 6. Workflow выполнения задач

Для задач, которые меняют репозиторий, продуктовый контракт, архитектуру, UI/UX, тесты, планы, документацию или git-состояние, применять глобальный workflow `task-workflow-orchestrator`, если он доступен в текущем агентском окружении.

Если skill недоступен, не блокировать работу. Выполнить его порядок вручную и явно сказать в финальном отчете, что был использован fallback:

```txt
git status
  -> codegraph sync/status для кодовых задач
  -> context reading
  -> compact specification
  -> architecture/product/UI risk check
  -> small implementation plan
  -> focused edits
  -> review diff
  -> targeted verification
  -> codegraph sync/status для кодовых задач
  -> final report
```

Простые read-only вопросы можно отвечать без полного workflow, но нельзя под видом read-only выполнять скрытые изменения.

## 7. Инженерная чистота и компонентный подход

Перед добавлением существенной функциональности агент обязан определить границы системы: доменные модули, application services, route/view слои, UI components, hooks/query modules, tests и styles.

Обязательные правила:

1. `App.tsx`, route composition files, API composition files и CSS не должны бесконтрольно расти.
2. Повторяющиеся UI primitives, формы, модалки, таблицы, dropdown/popover, toolbar, empty/loading/error/forbidden states и chips выносить в переиспользуемые компоненты.
3. Нельзя добавлять fake affordances: кнопка, чекбокс, фильтр, сортировка, bulk selection, экспорт, уведомление или меню допускаются только если есть реальный сценарий, disabled-state reason или явно скрытый future scope.
4. Storybook — каталог и evidence, но не автоматический runtime source of truth. Runtime может использовать Storybook blocks только после classification из `docs/beta/component-readiness.md`.
5. Для UI primitives сначала проверять существующий компонент проекта, затем shadcn/Radix baseline. Самописный компонент допустим только с понятной причиной.
6. CSS должен оставаться token/system oriented. Не добавлять одноразовые хаки, z-index без причины и селекторы, ломающие compact/mobile layout.
7. Dead code, unused imports, stale generated artifacts, временные логи и дублирующие helpers удаляются только с доказательством: `rg`, typecheck/test/build или другой свежий сигнал.
8. Экспортируемый код, migrations, public API contracts, route ids, permission keys и persistence schema не удалять по одному `rg` без дополнительной проверки.
9. Любой refactor должен быть behavior-preserving, маленький и проверяемый. Если меняется поведение, сначала нужна compact spec и тест/acceptance сценарий.
10. Runtime beta routes не должны показывать placeholders, demo arrays, debug/admin dump UI, UUID-first labels, internal statuses или тестовые записи.

## 8. CodeGraph

В проекте включен MCP **CodeGraph** (`@colbymchenry/codegraph`) — локальный граф символов и связей (tree-sitter + SQLite), без внешних API.

CodeGraph обязателен для любой задачи, где агент читает, меняет или ревьюит исходный код, маршруты, API, тесты или архитектуру модулей.

Исключение: чисто документационные/product/marketing/read-only задачи без анализа исходного кода. Для таких задач достаточно `git status` и релевантных docs, но если workflow требует CodeGraph и он доступен, можно выполнить `codegraph status/sync` как процессный контроль.

### Обязательный цикл для кодовых задач

```bash
codegraph status
codegraph sync
```

Если нет `.codegraph/`:

```bash
codegraph init -i
```

Во время работы использовать MCP-инструменты `codegraph_*` для структурных вопросов:

- `codegraph_search`, `codegraph_context` — вход в область;
- `codegraph_explore`, `codegraph_callers`, `codegraph_callees` — поток и зависимости;
- `codegraph_impact` — перед правками затрагиваемых символов;
- `codegraph_node` — точечные детали символа.

Не начинать структурное исследование с широкого grep/read, если доступны `codegraph_*`. `rg` допустим для литеральных строк, конфигов, комментариев, логов, docs и случаев, где CodeGraph не покрывает область.

Перед финальным claim по кодовой задаче выполнить `codegraph sync` и при необходимости `codegraph status`.

## 9. Runtime, beta и QA gates

Founder-beta screen считается готовым только при наличии рабочего runtime evidence, а не потому что экран рендерится.

Для beta/runtime задач читать:

- `docs/beta/business-process.md`;
- `docs/beta/screen-readiness-matrix.md`;
- `docs/beta/component-readiness.md`;
- `docs/beta/qa-gate.md`;
- `docs/beta/implementation-backlog.md`.

Минимальные правила:

1. Экран имеет одну ясную operational job и связан с user story.
2. Данные идут из typed runtime API/read-model, а не из hardcoded demo arrays.
3. Действия работают, сохраняются после reload и показывают success/failure.
4. Permission/read-only/forbidden состояния обработаны.
5. Agent writes проходят proposal -> confirmation -> result/audit.
6. Desktop и narrow screenshots нужны для визуальных claims.
7. В runtime UI нет dead controls, visible placeholders, Storybook chrome assumptions, debug labels и тестовых записей.

Основные проверки:

```bash
pnpm typecheck
pnpm test
pnpm test:e2e:smoke
pnpm qa:runtime
pnpm verify:storybook-contract
```

Выбирать targeted subset по риску задачи. Не говорить "готово", если релевантная проверка не запускалась; вместо этого назвать, что именно не проверено.

`pnpm qa:runtime` запускает `e2e/runtime/**` через Playwright, поднимает API/web на изолированных портах и включает Storybook visual QA через `KISS_PM_STORYBOOK_QA=1`.

## 10. Design-v3 lockdown

Единственный путь визуала:

```txt
docs/design-v3/TOKENS.md + docs/design-v3/DESIGN_CONTRACT.md
  -> apps/web/src/styles/{tokens,tokens.planning,bem,bem-supplement}.css
  -> apps/web/src/styles/widgets/*.css
  -> apps/web/src/components/{ui,domain}/*
  -> apps/web/src/widgets/* + apps/web/src/shell/* + apps/web/src/views/layout/*
  -> apps/web/src/{app,views,features}/**
```

Обязательные правила:

1. Product screens импортируют UI только из:
   - `apps/web/src/components/ui/*`;
   - `apps/web/src/components/domain/*`;
   - `apps/web/src/widgets/*`;
   - `apps/web/src/shell/*`;
   - `apps/web/src/views/layout/*`.
2. Запрещено:
   - inline `style={{ ... }}` в TSX, кроме SVG/Gantt-атрибутов с комментарием;
   - hex `#xxxxxx` / `rgba(...)` в TSX;
   - прямой импорт legacy `apps/web/src/features/dv2/*` или `apps/web/src/design-v2/*`;
   - создавать `*.css` в `features/**` или `components/**`;
   - писать новый runtime UI на устаревших Storybook/demo blocks без readiness classification.
3. Новые общие BEM-классы добавляются в `apps/web/src/styles/bem.css` или, если это widget-specific, в `apps/web/src/styles/widgets/<name>.css`.
4. shadcn primitives генерируются с `cssVariables: false`; variants под BEM-визуал описаны в `docs/design-v3/SHADCN-OVERRIDE.md`.
5. Storybook contract gate: `pnpm --filter @kiss-pm/web verify:storybook-contract`.
6. Перед PR для web/UI по умолчанию: `pnpm --filter @kiss-pm/web typecheck`, `pnpm --filter @kiss-pm/web test`, `pnpm --filter @kiss-pm/web build`, плюс targeted Playwright/screenshot где нужно.

## 11. API и backend contract

Backend API contract живет не только в route handlers.

Для backend/frontend integration задач:

1. Читать `docs/api/README.md`.
2. Соблюдать `docs/api/00_FRONTEND_API_CONVENTIONS.md`.
3. Проверять экранные recipes в `docs/api/07_FRONTEND_SCREEN_RECIPES.md`.
4. Обновлять OpenAPI/Scalar (`GET /api/openapi.json`, `GET /api/docs`) вместе с новым frontend-facing endpoint.
5. Если route есть в коде, но отсутствует в OpenAPI/Scalar, это дефект API-контракта.

Мутации должны учитывать auth, RBAC, mutation guard/stale state, audit и понятные error shapes.

## 12. Marketing и публичный copy

Marketing-facing задачи не брать из root README или runtime copy на глаз.

Источники:

- `.agents/product-marketing.md`;
- `docs/marketing/README.md`;
- `docs/marketing/01_POSITIONING_AND_MARKET.md`;
- `docs/marketing/02_MESSAGING_AND_TONE_OF_VOICE.md`;
- `docs/marketing/03_LANDING_PAGE_STRUCTURE.md`;
- `docs/marketing/08_INTERACTIVE_LANDING_DEMO_SPEC.md`.

Правила:

1. KISS PM не позиционируется как "дашборд + AI-чат".
2. Главная ценность — контролируемое изменение проекта через агента, Сверку, ревью человеком и журнал.
3. Публичные claims держать на уровне закрытой альфы: без ROI, production SLA, логотипов и "автономного PM", пока нет доказательств.
4. Главный CTA закрытой альфы: `Запросить доступ`.

## 13. Локальные данные и артефакты

Не коммитить:

- `.codegraph/`;
- `.kiss-pm-storage/`;
- `playwright-report/`;
- `test-results/`;
- `.playwright-mcp/`;
- `.storybook-verify-tmp/` screenshots/evidence, если они не являются намеренным артефактом задачи;
- временные `tmp-*`, `.tmp/`, `tmp/`, worktrees.

Перед добавлением generated/reference/assets проверить, является ли файл canonical source, evidence artifact или случайный дубль. Не плодить вторые копии reference tree.

## 14. Формат финального отчета

Для задач с изменениями отвечать в таком формате:

```txt
Status:
Changed:
Files:
Tests / verification:
CodeGraph:
Decisions / assumptions:
Risks / follow-up:
```

Для простых read-only ответов можно короче. Для review — findings and risks first, summary second.
