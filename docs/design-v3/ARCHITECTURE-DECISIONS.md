# Design v3 — Architecture Decisions

Зафиксированные решения для тотальной переделки фронта KISS-PM.
Источник: ревью `lead-architect-review` (15 findings, 8 Required) +
`design-system-architect` (R1–R7 must-fix + 10 архитектурных решений).
Все 16 пунктов одобрены пользователем перед началом Phase 1.

> Этот документ — нормативный. На него ссылаются все последующие фазы.
> Изменение любого решения требует отдельного ADR-обновления.

## Решение 1 — §10 lockdown отменён

**Источник:** B1 / lead-architect.

**Что было:** в `AGENTS.md §10 Design-v2 lockdown` зафиксирована изоляция UI в
`apps/web/src/design-v2/*` + health-test `design-v2-enforcement.health.test.ts` +
скрипты `verify-design-v2.mjs`, `verify-react-dv2.mjs`, `generate-design-v2-catalog.mjs` +
матрица `parity-matrix-v2.json`.

**Решение:** lockdown снимается. Новая библиотека живёт в:

- `apps/web/src/components/ui/` — shadcn primitives (тонкая обёртка)
- `apps/web/src/components/domain/` — composite domain-компоненты
- `apps/web/src/widgets/` — тяжёлые виджеты (gantt / resource-matrix / task-inspector / kanban) с `next/dynamic`
- `apps/web/src/shell/` — AppShell / Sidebar / Topbar / ProjectChrome / CommandPalette / NotificationCenter
- `apps/web/src/features/` — экранная композиция

**Действия в Phase 1:**

1. Удалить `apps/web/src/__health__/design-v2-enforcement.health.test.ts`.
2. Удалить `scripts/verify-design-v2.mjs`, `scripts/verify-react-dv2.mjs`, `scripts/generate-design-v2-catalog.mjs`.
3. Удалить `docs/design-review/parity-matrix-v2.json`.
4. Переписать `AGENTS.md §10` на новый lockdown (см. раздел "AGENTS.md §10 — новая редакция" ниже).
5. Поправить путь `docs/references/planning-ui-approved/` (одно `references`) во всех 16 фазах плана и в `AGENTS.md §5`.

## Решение 2 — Палитра design-v2 + геометрия планирования

**Источник:** B2 / design-system-architect.

**Решение:**

- Семантика, цвет, типографика, spacing, radii, shadows → **design-v2 побеждает**.
- Синий accent `#2563eb` — индустриальный стандарт PM/CRM SaaS (Linear, Asana, Monday, Notion). Тёмный `#0f172a` из planning неприменим как primary.
- Из `docs/references/planning-ui-approved/mockup-tokens.css` берём **только** геометрию: `--wbs-width`, `--inspector-width`, `--gantt-bar-h`, `--cell-day/week/month`, `--row-h-summary`, `--tabs-height`, `--bottom-bar-height`, `--critical-stripe` и весь z-stack планирования (`--z-arrow/bar/sticky-col/sticky-header/sticky-corner/bottom-bar/drawer`).
- `--inspector-width` повышается с `360px` (planning) до **`380px`** для form-grid в TaskInspector (Решение зависит от Phase 8 spec).

Полная reconciliation table — в [`TOKENS.md`](./TOKENS.md).

## Решение 3 — shadcn `cssVariables: false`

**Источник:** B5 / design-system-architect R1.

**Проблема:** shadcn по умолчанию пишет в `globals.css` собственные `--background`, `--foreground`, `--primary` и т.д. через `:root` блок. Это конфликтует с нашими BEM-токенами (`--canvas`, `--panel`, `--text`, `--accent`).

**Решение:** в `components.json` ставим `"cssVariables": false`. shadcn использует Tailwind-классы напрямую (`bg-background`, `text-foreground` и т.д.), а Tailwind v4 `@theme inline` в `globals.css` мапит наши BEM-токены в Tailwind theme:

```css
@theme inline {
  --color-background: var(--canvas);
  --color-foreground: var(--text);
  --color-primary: var(--accent);
  --color-primary-foreground: #fff;
  --color-muted: var(--panel-strong);
  --color-muted-foreground: var(--muted);
  --color-accent: var(--accent-soft);
  --color-destructive: var(--danger);
  --color-border: var(--border);
  --color-input: var(--border-strong);
  --color-ring: var(--accent-ring);
  --color-card: var(--panel);
  --color-popover: var(--panel-elevated);
  --radius: var(--radius-md);
}
```

Variants shadcn-компонентов (Button/Dialog/Sheet/...) переписываются через CVA под BEM-визуал — спецификация в [`SHADCN-OVERRIDE.md`](./SHADCN-OVERRIDE.md).

## Решение 4 — Planning data layer переписываем с нуля

**Источник:** B3 / lead-architect.

**Решение:** не таскаем существующий `apps/web/src/features/dv2/planning/hooks/*` как есть. Сначала извлекаем поведенческий контракт в [`SPEC-PLANNING-MUTATION.md`](./SPEC-PLANNING-MUTATION.md), затем в Phase 9b пишем новую реализацию по этому spec с unit-тестами на каждый transition.

**Что переезжает 1-в-1 (нет смысла переписывать):**

- `@kiss-pm/planning-client` (packages/planning-client) — API-клиент, типы, SSE-helper, build-compensating-commands
- `@kiss-pm/domain` — типы команд

**Что переписывается:**

- `usePlanMutation` — full state-machine (см. spec)
- `usePlan` — read-hook с SSE-подпиской
- `useCompensatingUndo` — переписываем под новый стейт (текущая реализация ОК как референс)
- `usePlanningPermissions` — без изменений семантики, переезд в `hooks/planning/`

## Решение 5 — fake hooks → `featureFlag=ui-only-preview`

**Источник:** B4 / design-system-architect.

**Проблема:** KPI/Audit/Baseline/Scenarios/NotificationCenter не имеют backend-эндпоинтов. Реализовывать их с фейковыми API-запросами нарушит §7.3 AGENTS.md (запрет fake affordances).

**Решение:**

1. Все эти поверхности рендерятся на статических read-only моках, прописанных в feature-компонентах.
2. На каждой такой поверхности обязателен `<BannerInline variant="warn">Preview — backend не подключён</BannerInline>` поверх контента.
3. Feature flag `featureFlags.uiOnlyPreview` (enum) перечисляет эти 5 поверхностей в `apps/web/src/lib/featureFlags.ts`.
4. Все интерактивные элементы внутри (кнопки, формы) `disabled` с `aria-disabled` + tooltip "Backend не подключён".
5. Это явный disabled-state reason → §7.3 не нарушается.

**Когда снимаем флаг:** при появлении соответствующего backend-эндпоинта в отдельном PR (не в design-v3).

## Решение 6 — Все design-v2 tooling удаляется, новые health-tests с нуля

**Источник:** B6 / lead-architect.

**Удаляем в Phase 1 (корень монорепо / design-review):**

- `apps/web/src/__health__/design-v2-enforcement.health.test.ts`
- `scripts/verify-design-v2.mjs`
- `scripts/verify-react-dv2.mjs`
- `scripts/generate-design-v2-catalog.mjs`
- `docs/design-review/parity-matrix-v2.json`

**Статус в worktree `design-v3-rebuild` (`@kiss-pm/web`, batches 4–8):**

| Артефакт | Статус |
|----------|--------|
| `src/stories/design-v2/**` (32 CSF) | удалено (batch 8) |
| `scripts/generate-design-v2-react-stories.mjs` | удалено (batch 8) |
| npm `gen:design-v2-stories` | удалено из `package.json` (batch 8) |
| Storybook index `design-v2-*` | 0 entries; whitelist в `.storybook/main.ts` (batch 4) |
| RU sidebar (UI/Foundations/Views/Catalog) | `.storybook/manager.ts`, `sidebarLabelsRu.ts` (batches 5–7) |

Документация Storybook: [`MOCKUPS.md`](./MOCKUPS.md).

**Создаём в Phase 16 (verification gate):**

1. **Line-budgets per layer** (health-test):
   - `components/ui/**` ≤ 300 строк на файл
   - `components/domain/**` ≤ 500 строк
   - `widgets/gantt/**` ≤ 1500 строк (model + chart + drag)
   - `widgets/resource-matrix/**` ≤ 800 строк
   - `widgets/task-inspector/**` ≤ 600 строк
   - `widgets/kanban/**` ≤ 500 строк
   - `shell/**` ≤ 400 строк
2. **Ban-list** (health-test):
   - inline `style={{ ... }}` в `app/`, `components/`, `features/`, `shell/`, `widgets/` (исключение: SVG bar `transform`/`width` атрибуты в Gantt, документированы в комментарии)
   - hex `#xxxxxx` / `rgba(...)` в TSX (только в CSS-файлах)
   - прямой импорт `lucide-react@1.x` (старая версия — самозванец, должно быть `^0.460`)
   - импорт из `apps/web/src/design-v2/*` или `apps/web/src/features/dv2/*` (старые пути)
3. **Bundle-budget assert** (через `next build` + `@next/bundle-analyzer`):
   - `<300KB gzip` на стандартных страницах
   - `<400KB gzip` на `/projects/[id]/schedule` (Gantt widget)
4. **axe-core continuous** (Решение №16): запуск после Phase 3, 5, 10 + финальный gate в Phase 16. Zero critical/serious.

## Решение 7 — Storybook 8 в Phase 1b

**Источник:** R7 / design-system-architect.

**Решение:**

1. Установка: `@storybook/nextjs-vite ^8.4.7`, `@storybook/addon-essentials`, `@storybook/addon-a11y`, `@storybook/test`.
2. `.storybook/main.ts` — framework `@storybook/nextjs-vite`, addons включают a11y.
3. `.storybook/preview.tsx` — импортирует `app/globals.css`, оборачивает в `ThemeProvider` (next-themes).
4. По одному `.stories.tsx` на каждый ui-компонент в Phase 2 и каждый domain-компонент в Phase 4.
5. `pnpm build-storybook` обязан проходить exit 0 в Phase 16 verification gate.

**Зачем:** isolated axe-сканы на уровне компонента, визуальная регрессия (через Chromatic — backlog), документирование вариантов перед интеграцией в экраны.

## Решение 8 — `state-empty` vs `state-illu` — оба, с guideline

**Источник:** design-system-architect.

| Кейс | Компонент | Когда |
|---|---|---|
| Список после фильтра не нашёл совпадений | `<EmptyState>` (`state-empty`) | Filtered / no-results |
| Сущность ещё не создана пользователем | `<IlluState>` (`state-illu`) | First-time / onboarding / get-started |
| Запрос упал | `<ErrorState>` (`state-error`) | Error |
| Нет прав | `<ForbiddenState>` (`state-forbidden`) | 403 / permission denied |
| Загрузка | `<Skeleton>` варианты в составе layout | Loading |

`state-illu` имеет дополнительные элементы: `__art` (большая иллюстрация SVG), `__deco` (фоновый паттерн), call-to-action button. `state-empty` — компактнее, только icon + text + CTA.

## Решение 9 — Select vs Combobox rule

**Источник:** design-system-architect.

| Условие | Компонент |
|---|---|
| ≤ 7 опций без поиска, фиксированный набор | `<Select>` (Radix) |
| Длинный/динамический список (клиенты, исполнители, задачи), нужен поиск/виртуализация | `<Combobox>` (Popover + cmdk) |

Ban-list test (Phase 16): `<Select>` с >7 `<SelectItem>` детьми → ошибка.

## Решение 10 — Bundle budget

**Источник:** lead-architect.

| Маршрут | Бюджет gzip |
|---|---|
| `/login`, `/dashboard`, `/my-work`, list/detail в CRM, settings, admin | **< 300 KB** |
| `/projects/[id]/schedule` (Gantt + TaskInspector lazy) | **< 400 KB** |

Baseline стека (Next 16 + React 19 + Radix + TanStack Query + cmdk + sonner + date-fns + react-hook-form + zod) ≈ **180 KB gzip**. 250 KB нереалистичен. 300/400 KB — реалистично с запасом.

Замер: `next build --profile` + `@next/bundle-analyzer`. Assert в Phase 16 health-test.

## Решение 11 — Lazy-load тяжёлых виджетов

**Источник:** lead-architect.

`next/dynamic` с `ssr: false` для:

- `widgets/gantt/*` — грузится только в `/projects/[id]/schedule`
- `widgets/resource-matrix/*` — только в `/projects/[id]/resources` и `/dashboard` (cross-project tooltip)
- `widgets/task-inspector/*` — только в `/projects/[id]/schedule` (drawer) и `/tasks/[id]` (full)
- `widgets/kanban/*` — только в `/my-work`, `/opportunities`, `/projects` (когда переключатель в kanban-режиме)

Каждый widget имеет `Suspense`-friendly skeleton-fallback в layer-loader.

## Решение 12 — Dark mode инфра, тёмная палитра отложена

**Источник:** design-system-architect.

**Phase 1:** ставим `next-themes ^0.4`, `<ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>`. `<html class="light">` баребоунный.

**Backlog (после Phase 16):** добавление dark-палитры в `tokens.css` через `:root.dark { ... }` блок + проверка контраста на каждом компоненте + dark variant в Storybook. Не делается до закрытия design-v3.

**Зачем сразу инфра:** избежать сквозного refactor "добавить ThemeProvider во все экраны".

## Решение 13 — Иконки: lucide-react в TSX, inline SVG в BEM

**Источник:** lead-architect.

| Где | Что |
|---|---|
| React-компоненты в `components/ui/`, `components/domain/`, `widgets/` | `lucide-react@^0.460` |
| BEM-блоки в `bem.css` (если иконка часть стиля блока) | inline `<svg class="icon icon--sm">...</svg>` |

В существующем `_partials-core.css` есть `.icon { width: 18px; height: 18px; }` + `.icon--sm/lg/xl`. Эти классы наследуем в `bem.css`.

**КРИТИЧНО:** в текущем `apps/web/package.json` стоит **`lucide-react: ^1.16`** — это **самозванец** (`@types/lucide-react`-подобный пакет), не настоящая библиотека. Настоящий пакет — `lucide-react ^0.460`. В Phase 1 ставим правильную версию явно.

## Решение 14 — CSS layers order

**Источник:** design-system-architect R3.

`app/globals.css` обязан начинаться декларацией:

```css
@layer reset, tokens, base, components, utilities;
```

Затем импорты в правильные layer-ы:

```css
@import "tailwindcss";
@import "../styles/tokens.css" layer(tokens);
@import "../styles/tokens.planning.css" layer(tokens);
@import "../styles/bem.css" layer(components);
```

Tailwind utilities идут в `utilities` (последний → побеждает на equal specificity).
BEM в `components` (выше base, ниже utilities) — Tailwind utility побеждает BEM при коллизии,
но `[data-state]` и `:hover` в BEM сохраняют свою специфичность за счёт layer-порядка.

## Решение 15 — ProjectChrome → `shell/`

**Источник:** lead-architect (R4).

`ProjectChrome` (header проекта со статами + tabbar) используется во всех 10 tabs `/projects/[id]/*` (overview, schedule, resources, baseline, scenarios, kpi, audit, calendars, assignments, settings), не только в Gantt.

→ переезжает из `widgets/gantt/` в `shell/ProjectChrome.tsx`. Не lazy-loaded.

## Решение 16 — axe-core continuous, не финальный

**Источник:** design-system-architect R6.

**Проблема:** запуск axe только в Phase 16 копит 15 фаз a11y-долга.

**Решение:** запускаем `playwright test --grep @a11y` после:

- Phase 3 (Shell + patterns) — первые keyboard-navigable экраны
- Phase 5 (Kanban) — drag-drop a11y
- Phase 10 (Auth + Dashboard + MyWork) — первые полноценные screens
- Phase 16 (final gate)

В каждой фазе: zero critical/serious. Любая регрессия блокирует merge PR-а.

---

## AGENTS.md §10 — новая редакция (replace в Phase 1)

```markdown
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
   - любой импорт из `apps/web/src/design-v2/*` или `apps/web/src/features/dv2/*` (legacy)
3. Запрещено создавать `*.css` в `features/**` или `components/**` — все стили в `apps/web/src/styles/{bem.css, widgets/*.css}` и `app/globals.css`.
4. Новые BEM-классы добавляются в `apps/web/src/styles/bem.css` (общие) или `apps/web/src/styles/widgets/<name>.css` (widget-specific, lazy через `widgets/<name>/*.tsx`).
5. shadcn primitives генерируются с `cssVariables: false`. Variants под BEM-визуал переписываются через CVA по `docs/design-v3/SHADCN-OVERRIDE.md`.
6. Перед PR: `pnpm typecheck && pnpm test && pnpm build && pnpm test:a11y` — все exit 0.
7. Каталог компонентов: Storybook (`pnpm storybook`).

Любое нарушение ловится:

- health-test `apps/web/src/__health__/design-v3-enforcement.health.test.ts` (line-budgets + ban-list)
- bundle-budget assert в `next build` health-test
- axe-core continuous (после P3/P5/P10 + final P16)
```

---

## Поправка в AGENTS.md §5 (Phase 1)

В §5 указан путь `docs/references/references/planning-ui-approved/` (двойное `references`). Исправить на `docs/references/planning-ui-approved/`.

Аналогично в файле плана rebuild — все 16 упоминаний.

---

## Ссылки

- [`TOKENS.md`](./TOKENS.md) — token reconciliation
- [`SPEC-PLANNING-MUTATION.md`](./SPEC-PLANNING-MUTATION.md) — extracted contract for Phase 9b
- [`SHADCN-OVERRIDE.md`](./SHADCN-OVERRIDE.md) — variants переопределения shadcn-компонентов
