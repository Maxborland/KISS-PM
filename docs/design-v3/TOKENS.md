# Design v3 — Token Reconciliation

Reconciliation двух источников токенов перед реализацией Phase 1 (foundation).
Этот документ фиксирует историческую сверку двух наборов; **источник истины
по фактически отгруженным значениям** — сам CSS (`tokens.css` база +
`kiss-v4.css` `:root` в `layer(components)`, который перебивает базу) и
машинный гейт `apps/web/src/__health__/design-v3-enforcement.health.test.ts`.

> **ОБНОВЛЕНО 2026-06-25 — пост-унификация дизайна.** Каноничный вид сведён
> к одному набору («индиго-канон»). Что изменилось против таблиц ниже:
> - **Accent больше НЕ синий `#2563eb`.** Канон — индиго `#5b5bd6` из
>   `kiss-v4.css :root`. Раньше индиго жил в scope-острове `.kiss-v4`; теперь
>   промоутнут в глобальный `:root` (`layer(components)` → перебивает
>   `layer(tokens)`). Решение №2 (industrial blue) перекрыто унификацией.
> - **Type scale уточнён:** добавлен `--text-2xs = 10px` и display-токены
>   `--text-15/19/22/28`; body = 14 (не 13), h2 = 24 (не 26). См. раздел Typography.
> - **Dark OUT для v1.** Тумблер темы удалён (мёртвый код); колонки «dark» в
>   таблицах ниже — историчны, в проде только светлая тема.

## Источники

| Источник | Путь | Назначение |
|---|---|---|
| `design-v2` | `docs/design-v2/tokens.css` | Полная палитра, типографика, тени, spacing, radii. **Глобальный winner.** |
| `planning-ui-approved` | `docs/references/planning-ui-approved/mockup-tokens.css` | Геометрия Gantt/WBS/Inspector, z-index стека планирования. **Берём только geometry.** |

## Принцип решения

1. **Семантика, цвет, типографика, spacing, radii, shadows → design-v2 побеждает.**
   Решение №2 в `ARCHITECTURE-DECISIONS.md`: индустриальный синий accent `#2563eb`,
   layered shadows, полный набор семантических цветов, priority chips.
2. **Геометрия Gantt/WBS/Inspector → planning-ui-approved побеждает.**
   В `design-v2` этих токенов нет вообще (там нет Gantt/WBS), поэтому они уникальны.
3. **Совпадающие имена с разными значениями (canvas, panel, border, text, accent, info,
   row-h, sidebar-width, radius-*) → design-v2 побеждает.** Планирование с тёмным
   `--accent: #0f172a` и blue `--accent-soft: #1d4ed8` несовместимо с продуктовым
   синим `#2563eb` design-v2.

## Reconciliation table

### Surface / Backgrounds

| Token | design-v2 | planning-ui-approved | Winner | Файл |
|---|---|---|---|---|
| `--canvas` | `#eef0f4` | `#f6f7f9` | **design-v2** | `tokens.css` |
| `--canvas-tint` | `#f4f5f8` | _(нет)_ | design-v2 | `tokens.css` |
| `--panel` | `#ffffff` | `#ffffff` | совпадают | `tokens.css` |
| `--panel-subtle` | `#fafbfc` | `#f9fafb` | **design-v2** | `tokens.css` |
| `--panel-strong` | `#f3f5f8` | `#f1f3f7` | **design-v2** | `tokens.css` |
| `--panel-elevated` | `#ffffff` | _(нет)_ | design-v2 | `tokens.css` |
| `--border` | `#e6e8ee` | `#e3e6eb` | **design-v2** | `tokens.css` |
| `--border-strong` | `#d4d8e0` | `#d4d9e2` | **design-v2** | `tokens.css` |
| `--border-subtle` | `#eef0f4` | _(нет)_ | design-v2 | `tokens.css` |

### Text

| Token | design-v2 | planning-ui-approved | Winner | Файл |
|---|---|---|---|---|
| `--text` | `#0f172a` | `#020617` | **design-v2** (`#0f172a` лучше для body) | `tokens.css` |
| `--text-strong` | `#020617` | _(нет)_ | design-v2 | `tokens.css` |
| `--muted` | `#64748b` | `#667085` | **design-v2** | `tokens.css` |
| `--muted-strong` | `#475569` | `#475467` | **design-v2** | `tokens.css` |
| `--muted-soft` | `#94a3b8` | _(нет)_ | design-v2 | `tokens.css` |

### Brand & accents

> ⚠️ Таблица ниже историческая (Решение №2). **Канон после унификации —
> индиго из `kiss-v4.css :root`** (колонка «shipped» — фактический прод).

| Token | design-v2 (база) | **shipped (kiss-v4 `:root`)** | Файл-победитель |
|---|---|---|---|
| `--accent` | `#2563eb` (blue) | **`#5b5bd6` (indigo)** | `kiss-v4.css` |
| `--accent-hover` | `#1d4ed8` | **`#5151c8`** | `kiss-v4.css` |
| `--accent-soft` | `#eef4ff` | **`#eeeefb`** | `kiss-v4.css` |
| `--accent-muted` | `#dbeafe` | **`#e0e0f8`** | `kiss-v4.css` |
| `--accent-ring` | `rgba(37,99,235,0.18)` | **`rgba(91,91,214,0.22)`** | `kiss-v4.css` |
| `--info` | `#0ea5e9` | **`#5b5bd6`** (= accent) | `kiss-v4.css` |

### Semantic

| Token | design-v2 | planning-ui-approved | Winner |
|---|---|---|---|
| `--success` | `#10b981` | `#137a4f` | **design-v2** |
| `--success-text` | `#047857` | _(нет)_ | design-v2 |
| `--success-soft` | `#ecfdf5` | `#e6f4ec` | **design-v2** |
| `--warning` | `#f59e0b` | `#a15c07` | **design-v2** |
| `--warning-text` | `#b45309` | _(нет)_ | design-v2 |
| `--warning-soft` | `#fffbeb` | `#fdf2e0` | **design-v2** |
| `--danger` | `#ef4444` | `#b42318` | **design-v2** |
| `--danger-text` | `#b91c1c` | _(нет)_ | design-v2 |
| `--danger-soft` | `#fef2f2` | `#fde7e5` | **design-v2** |
| `--info` | `#0ea5e9` | `#1d4ed8` | **design-v2** |
| `--info-soft` | `#f0f9ff` | `#e6edff` | **design-v2** |
| `--violet` | `#8b5cf6` | _(нет)_ | design-v2 |
| `--violet-soft` | `#f5f3ff` | _(нет)_ | design-v2 |
| `--critical-stripe` | _(нет)_ | `#c0331e` | **planning** (нужен в Gantt для критпути) |

### Priority chips

Все из `design-v2`, в planning отсутствуют:

`--prio-urgent`, `--prio-urgent-soft`, `--prio-critical`, `--prio-critical-soft`,
`--prio-high`, `--prio-high-soft`, `--prio-normal`, `--prio-normal-soft`,
`--prio-med`, `--prio-med-soft`, `--prio-low`, `--prio-low-soft`.

### Gradients

Все из `design-v2` (Bento dashboard tiles), в planning отсутствуют:

`--grad-warm`, `--grad-warm-overlay`, `--grad-cool`, `--grad-cool-overlay`, `--grad-mono`.

### Spacing

Полностью берём из `design-v2`:
`--space-1..12` = 4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 48 px.

### Typography

Полностью из `design-v2`:

- Семейства: `--font-ui` (Inter), `--font-display` (Plus Jakarta Sans), `--font-mono` (JetBrains Mono).
- Размеры (shipped `tokens.css`): `--text-2xs / xs / sm / base = md / lg / h3 / h2 / h1 / 4xl`
  = 10 / 11 / 12 / 14 / 16 / 18 / 24 / 32 / 40. Алиасы: `xl=h3`, `2xl=h2`, `3xl=h1`.
- Display-точные (фрейм-заголовки, bento-числа, инспектор): `--text-15/19/22/28` = 15 / 19 / 22 / 28.
- Line-heights: `--lh-2xs..4xl` = 14 / 16 / 18 / 22 / 24 / 24 / 32 / 38 / 44 (md=base, h3=lg).
- **Правило:** в `className` запрещены raw-px шрифты (`text-[13px]`) — только `--text-*`
  токены. Это машинно проверяет enforcement-гейт (Phase 16).

`planning-ui-approved` имеет только `--mono`. Перекрывается `--font-mono` из design-v2.

### Radii

| Token | design-v2 | planning-ui-approved | Winner |
|---|---|---|---|
| `--radius-xs` | `4px` | `4px` | совпадают |
| `--radius-sm` | `6px` | `6px` | совпадают |
| `--radius-md` | `8px` | `8px` | совпадают |
| `--radius-lg` | `12px` | `14px` | **design-v2** (12px консистентнее с UI) |
| `--radius-xl` | `16px` | _(нет)_ | design-v2 |
| `--radius-2xl` | `20px` | _(нет)_ | design-v2 |
| `--radius-3xl` | `28px` | _(нет)_ | design-v2 |
| `--radius-full` | `999px` | _(нет)_ | design-v2 |

### Shadows

Все из `design-v2` (multi-layer Soft UI):
`--shadow-xs/sm/md/lg/xl/panel/inset`, `--ring-focus`.

`planning-ui-approved` имеет только `--shadow-1/--shadow-2` (плоские) — не используем.

### Layout / Geometry — общее

| Token | design-v2 | planning-ui-approved | Winner |
|---|---|---|---|
| `--sidebar-width` | `232px` | `232px` | совпадают |
| `--topbar-height` | `60px` | `56px` | **design-v2** (60px согласован с button + breadcrumbs) |
| `--row-h` | `36px` | `36px` | совпадают |
| `--page-header-height` | `64px` | _(нет)_ | design-v2 |
| `--toolbar-h` | `40px` | _(нет)_ | design-v2 |
| `--content-max` | `1480px` | _(нет)_ | design-v2 |
| `--canvas-pad` | `16px` | _(нет)_ | design-v2 |
| `--canvas-radius` | `var(--radius-2xl)` | _(нет)_ | design-v2 |
| `--modal-sm/md/lg` | 480/640/880 | _(нет)_ | design-v2 |

### Layout / Geometry — planning-only (берём)

Эти токены в `design-v2` отсутствуют, переносим как есть в
`apps/web/src/styles/tokens.planning.css`:

| Token | Значение | Назначение |
|---|---|---|
| `--row-h-summary` | `36px` | Высота summary-row в WBS |
| `--gantt-bar-h` | `18px` | Высота бара Gantt |
| `--wbs-width` | `720px` | Ширина левой WBS-таблицы |
| `--inspector-width` | **`380px`** ⚠ | Решение №2: расширили с 360px (узко для form-grid) |
| `--tabs-height` | `44px` | Высота tabbar в проекте |
| `--bottom-bar-height` | `56px` | Высота PreviewApplyBar |
| `--cell-day` | `40px` | Ширина дневной ячейки таймлайна |
| `--cell-week` | `140px` | Ширина недельной ячейки |
| `--cell-month` | `220px` | Ширина месячной ячейки |
| `--critical-stripe` | `#c0331e` | Цвет полосы критического пути |

### Z-index

| Token | design-v2 | planning-ui-approved | Стратегия |
|---|---|---|---|
| `--z-sticky` | `10` | _(нет)_ | design-v2 (общий sticky) |
| `--z-dropdown` | `40` | _(нет)_ | design-v2 |
| `--z-modal` | `50` | _(нет)_ | design-v2 |
| `--z-toast` | `60` | _(нет)_ | design-v2 |
| `--z-arrow` | _(нет)_ | `3` | **planning** (Gantt deps) |
| `--z-bar` | _(нет)_ | `4` | **planning** (Gantt bar) |
| `--z-sticky-col` | _(нет)_ | `6` | **planning** (sticky WBS column) |
| `--z-sticky-header` | _(нет)_ | `7` | **planning** (sticky timeline header) |
| `--z-sticky-corner` | _(нет)_ | `8` | **planning** (corner of WBS+timeline) |
| `--z-bottom-bar` | _(нет)_ | `20` | **planning** (PreviewApplyBar) |
| `--z-drawer` | _(нет)_ | `30` | **planning** (TaskInspector / ResourceDayDrawer) |

Финальный consolidated z-stack (от низа к верху):
`3 arrow → 4 bar → 6 sticky-col → 7 sticky-header → 8 sticky-corner → 10 sticky → 20 bottom-bar → 30 drawer → 40 dropdown → 50 modal → 60 toast`.

### Motion (новые, добавляются в Phase 1)

В обоих источниках отсутствуют. Добавляются в `tokens.css` design-v3:

| Token | Значение | Назначение |
|---|---|---|
| `--duration-fast` | `120ms` | Hover, focus, micro-feedback |
| `--duration-base` | `200ms` | Standard transitions |
| `--duration-slow` | `320ms` | Modals, drawers |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | Exit |
| `--ease-out` | `cubic-bezier(0,0,.2,1)` | Enter |
| `--ease-in-out` | `cubic-bezier(.4,0,.2,1)` | Move |

## Итог: что записываем в Phase 1

### `apps/web/src/styles/tokens.css` (layer: tokens)

Полная копия `docs/design-v2/tokens.css` (139 строк) **плюс** motion-токены выше.

### `apps/web/src/styles/tokens.planning.css` (layer: tokens)

Только geometry + critical-stripe + z-stack планирования:

```css
:root {
  --row-h-summary: 36px;
  --gantt-bar-h: 18px;
  --wbs-width: 720px;
  --inspector-width: 380px;
  --tabs-height: 44px;
  --bottom-bar-height: 56px;
  --cell-day: 40px;
  --cell-week: 140px;
  --cell-month: 220px;
  --critical-stripe: #c0331e;
  --z-arrow: 3;
  --z-bar: 4;
  --z-sticky-col: 6;
  --z-sticky-header: 7;
  --z-sticky-corner: 8;
  --z-bottom-bar: 20;
  --z-drawer: 30;
}
```

### `app/globals.css` — `@theme inline` маппинг для shadcn

Связывает BEM-токены с Tailwind/shadcn API. Без `cssVariables` (Решение №3),
shadcn использует Tailwind-классы, а Tailwind v4 `@theme inline` тянет наши токены:

```css
@layer reset, tokens, base, components, utilities;
@import "tailwindcss";
@import "../styles/tokens.css" layer(tokens);
@import "../styles/tokens.planning.css" layer(tokens);
@import "../styles/bem.css" layer(components);

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
  --animate-duration: var(--duration-base);
}
```

## Anti-decisions (что НЕ берём)

- ❌ `planning-ui-approved` `--accent: #0f172a` — индустриально неверный для PM/CRM SaaS.
- ❌ `planning-ui-approved` `--accent-soft: #1d4ed8` — это не "soft", это primary в planning. Конфликт.
- ❌ `planning-ui-approved` плоские `--shadow-1/2` — не дают Soft UI глубины.
- ❌ `planning-ui-approved` `--radius-lg: 14px` — нечётное значение, ломает 4-grid.
- ❌ `planning-ui-approved` `--text: #020617` для body — слишком тёмный, низкий комфорт.

## Ссылки

- `ARCHITECTURE-DECISIONS.md` — 16 зафиксированных решений
- `docs/design-v2/tokens.css` — source of truth для базы
- `docs/references/planning-ui-approved/mockup-tokens.css` — source of truth для геометрии планирования
