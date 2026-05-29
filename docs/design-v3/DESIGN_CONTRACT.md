# Design Contract — KISS PM (design-v3)

**Версия: 2.0 · Phase 9 lockdown (2026-05-26).** Источник токенов: [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css). Checkpoint: [`CHECKPOINT-2026-05-26-STORYBOOK-BASELINE.md`](./CHECKPOINT-2026-05-26-STORYBOOK-BASELINE.md).

**Путь визуала:** `tokens.css` → `bem.css` / `bem-supplement.css` → `components/{ui,domain}`, `shell`, `widgets` → `app` / `features` / `views`.

---

## 1. Language rules

| Область | Правило |
|--------|---------|
| UI copy | **Русский** по умолчанию (кнопки, заголовки, пустые состояния, ошибки, табы, breadcrumbs). |
| Storybook sidebar | **8 корней:** `Foundations`, `Primitives`, `Composites`, `Widgets`, `Screens`, `Flows`, `Patterns`, `API Contract`. Имена stories (`name`) на русском для product screens. |
| EN в UI | Только: устойчивые коды (`PRJ-2026-014`, `MDS-39`), зарегистрированные термины в скобках (`ИСП (SPI)`), бренды устройств (`iPhone` — по необходимости). |
| Запрещено в UI | Dev-лейблы (`Primary`, `Default`, `Dialog`, `Toast`), жаргон (`tenant` → **арендатор**, `baseline` → **базовый план**). |
| Storybook catalog | Не показывать EN variant names как пользовательский текст; EN допустим в `argTypes`/docs. |
| Доменные имена | Mock-проекты локализовать: `CRM intake` → **Внедрение CRM** (`MOCK_PROJECT_CRM` в `views/catalog.ts`). |

### Классификация EN (что не переводить в UI)

**Категория 2 — допустимые тех. аббревиатуры в UI** (при необходимости с русской подписью в скобках): `WBS`, `SPI`, `CPI`, `KPI`, `PRJ-*`, `MDS-*`, `DEAL-*`, `CLI-*`, `SP` (story points в mock), `v2` (версия снимка).

**Категория 3 — mock-бренды и домены** (оставлять как в макете): `ACME Studio`, `DataHub KPI`, `DataHub`, `acme.studio` (домен в sidebar), `Salesforce` (в названии сделки), `Zoom` / `Google Meet` (в mock митингов).

**Категория 4 — не пользовательский текст** (не трогать в language pass): `storyTitle` / id stories, имена компонентов (`Table`, `WorkspaceChrome`), `variant: "workspace"`, CSS `align-items: baseline`, ключи `featureFlags`, пути `design-v2/*`, EN в `argTypes`/docs Storybook.

---

## 2. Typography scale usage

Рантайм-шкала (не отклоняться без записи в PR):

| Роль | Token / класс | px |
|------|----------------|-----|
| Page title (h1) | `.page-intro__title`, `--text-h1` | **32** |
| Section / story title (h2) | `.type-h2`, `--text-h2` | **24** |
| Card title (h3) | `.card__title`, `--text-h3` | **18** |
| Body, поля, select, table cell | `.app-content`, `--text-md`, `.u-text-body` | **14** |
| Button label | `button` default size | **12** |
| Caption, sidebar nav, breadcrumb | `--text-sm`, `.u-text-sm` | **12** |
| Micro, kbd, table th | `--text-xs` | **11** |

**MUST**

- Один h1 на экран — через `PageIntro` (`views/layout/page-intro.tsx`), не дублировать вторым hero на 24px.
- Заголовки секций **внутри** `CardPanel` — `form-section__title` (**14px**, `--font-ui`), не второй h3 18px.
- Display-шрифт (`--font-display`) — только h1–h3 карточки/страницы; body и подписи — `--font-ui`.
- Числа KPI в плитках: не крупнее h1; метрики — до `--text-h2` (24px), не `--text-4xl`.

**NEVER**

- `text-[var(--text-strong)]` вместе с `text-[var(--text-sm)]` на одном элементе (Tailwind перебивает размер). Размер: `text-[length:var(--text-md)]`, цвет: `text-[var(--text-strong)]` или BEM-класс.
- Сырые Tailwind `text-lg` / `text-2xl` в product UI.

---

## 3. Spacing / density rules

| Token | Значение | Где |
|-------|----------|-----|
| `--space-1…6` | 4–24px | Отступы блоков (шаг 4px) |
| `--row-h` | 30px | Компактные строки, `switch-row`, `table--compact` |
| `.app-content` padding | `--space-6` × `--space-5` | Основная область |
| `.card__body` | `--space-4` / `--space-5` | Карточки |

### 3a. Density tiers (Phase 1)

| Tier | Token | Высота строк | Где |
|------|--------|--------------|-----|
| Ultra | `--row-h-ultra` | **24px** | Плотные матрицы, вторичные списки |
| Compact | `--row-h-compact` | **32px** | Таблицы, Kanban meta, Gantt grid |
| Cozy | `--row-h-cozy` | **40px** | Decision surfaces, формы |
| Free | без фиксированного token | по контенту | Hero, empty L4 |

**MUST:** один dominant tier на экране.

### 3b. Depth tiers (Phase 1)

| Tier | Токены | Где |
|------|--------|-----|
| Flat | border `--border` | Inset panels |
| Resting | `--shadow-xs` / `--shadow-sm` | `CardPanel` |
| Elevated | `--shadow-md` / `--shadow-panel` | Popover, sticky sub-panels |
| Floating | `--shadow-floating` | Modals, drag overlay |

### 3c. Brand gradient (`--brand-grad`)

Градиент **не** на `body`, sidebar, topbar. Допустимо: bento KPI, hero callout в Foundations.

### 3d. Язык и Storybook (production-grade)

| Область | Правило |
|--------|---------|
| UI copy | Русский (см. §1). |
| API / types / fixtures | English identifiers. |
| Product Storybook `Screens` | Default = готовый экран **1440×900**: shell + плотность + без error UI. |

---

## 4. Cards and surfaces

| Primitive | Когда |
|-----------|--------|
| `CardPanel` (BEM `.card`) | Все workspace-экраны, формы, настройки |
| shadcn `Card` | Только Storybook catalog / изолированные demos |
| `tile` / `bento` | Дашборд, KPI-плитки |

**NEVER:** inline `style={{}}` в TSX (кроме SVG Gantt с комментарием); новые `*.css` в `features/**` / `components/**`.

---

## 5. Tables / lists

| Тип | Компонент | Стиль |
|-----|-----------|--------|
| App lists | `DataTable` → `.table` | body 14px; compact: `.table--compact` |
| Primary cell | `CellStack` | title 14px semibold, subtitle 12px `--muted-strong` |

Кликабельные строки: `tabIndex={0}` + keyboard, **без** `role="button"` если в строке есть `DropdownMenu` / кнопки (axe `nested-interactive`).

---

## 6. Forms

`SwitchRow` / `SwitchRowList` для boolean; `FormGrid`; модалки — `Dialog` / `Sheet`.

---

## 7. Badge / Chip / status taxonomy

| Primitive | Назначение |
|-----------|------------|
| **Badge** | Счётчик, микро-метка |
| **Chip** | Стадия, статус, риск |
| **PriorityFlag** | Приоритет Kanban (RU label, цвета `--*-text` на белом фоне) |

---

## 8. Date / money / percentage formats

`ДД.ММ.ГГГГ`, `1 240 000 ₽`, `82%`, `+2 дн.` — см. v1.1 §8 (без изменений).

---

## 9. CTA / link / action patterns

Один primary CTA на экран; destructive не primary; RU глаголы на кнопках.

---

## 10. Storybook acceptance checklist (Phase 9 — locked)

Перед merge UI / stories:

- [x] **8 корней** Storybook (`storybook-section-roots.health.test.ts`).
- [x] **VRT:** `widgets-*`, `screens-*`, `flows-*`, `patterns-*` — 119 snapshots в `apps/web/tests/e2e/storybook-vrt-baselines/`; `pnpm test:vrt` после `build-storybook`.
- [x] **axe:** 11 эталонных stories, 0 critical/serious — `pnpm test:a11y`.
- [x] **Health gates:** `design-v3-quality-gates.health.test.ts` (density/depth tokens, contrast pairs, bundle budget, inline-style allowlist, strict `views`+`app`).
- [x] **Copy scan:** `run-copy-scan-all-stories.mjs` (все stories, RU, без EN dev labels).
- [x] **CI:** `pnpm verify:storybook-contract` = typecheck + vitest + build-storybook + web build + copy-scan + VRT + a11y.
- [x] **Product screens** — `Screens/*` fullscreen + `WorkspaceChrome` (кроме login / state-* bare по контракту).
- [x] **Primitives** — `Primitives/*` с variant states (`ui-variant-presets`).

Команды:

```bash
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web build-storybook
pnpm --filter @kiss-pm/web test:vrt
pnpm --filter @kiss-pm/web test:a11y
pnpm --filter @kiss-pm/web build
pnpm verify:storybook-contract
```

---

## Быстрые ссылки

- Структура: [`STORYBOOK-STRUCTURE.md`](./STORYBOOK-STRUCTURE.md)
- Production brief: [`PRODUCTION-GRADE-BRIEF.md`](./PRODUCTION-GRADE-BRIEF.md)
- Baseline checkpoint: [`CHECKPOINT-2026-05-26-STORYBOOK-BASELINE.md`](./CHECKPOINT-2026-05-26-STORYBOOK-BASELINE.md)
- VRT: `apps/web/tests/e2e/storybook-vrt*.ts`
- Обзор в Storybook: `Foundations/Контракт дизайна`
