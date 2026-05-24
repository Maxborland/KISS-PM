# Design Contract — KISS PM (design-v3)

Краткий enforceable-контракт для UI и Storybook. Источник токенов: [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css). Детали компонентов: [`SHADCN-OVERRIDE.md`](./SHADCN-OVERRIDE.md), [`TOKENS.md`](./TOKENS.md).

**Путь визуала:** `tokens.css` → `bem.css` / `bem-supplement.css` → `components/{ui,domain}`, `shell`, `widgets` → `app` / `features` / `views`.

---

## 1. Language rules

| Область | Правило |
|--------|---------|
| UI copy | **Русский** по умолчанию (кнопки, заголовки, пустые состояния, ошибки, табы, breadcrumbs). |
| Storybook sidebar | Имена stories на **русском** (как продуктовые экраны), без `Dashboard` / `My work` / `State · empty`. |
| EN в UI | Только: устойчивые коды (`PRJ-2026-014`, `MDS-39`), зарегистрированные термины в скобках (`ИСП (SPI)`), бренды устройств (`iPhone` — по необходимости). |
| Запрещено в UI | Dev-лейблы (`Primary`, `Default`, `Dialog`, `Toast`), жаргон (`tenant` → **арендатор**, `baseline` → **базовый план**, `What-if` → **сценарии «что если»**). |
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

**MUST**

- Sidebar nav: **12px** (`--text-sm`); контент: **14px** base — это норма, не баг.
- Списки настроек: `SwitchRow` + `switch-row-list` (BEM), padding `var(--space-2)` по вертикали.
- Toolbar: `view-toolbar` + один ряд фильтров; не два несвязанных ряда кнопок.

**NEVER**

- Смешивать «рыхлые» таблицы (td 48px) и compact на одном экране без причины — списки сущностей: `DataTable` + `table--compact` или выровненная высота строк.

---

## 4. Cards and surfaces

| Primitive | Когда |
|-----------|--------|
| `CardPanel` (BEM `.card`) | Все workspace-экраны, формы, настройки |
| shadcn `Card` | Только Storybook catalog / изолированные demos, не дублировать на экранах |
| `tile` / `bento` | Дашборд, KPI-плитки |
| `panel` / `--panel` | Фон карточек, sidebar, topbar |

**MUST**

- У карточки один заголовок h3 (18px) + опциональный `card__sub` (11px muted).
- `flush` на таблицах внутри карточки — для audit, admin, baseline lists.

**NEVER**

- Inline `style={{}}` в TSX (кроме SVG Gantt с комментарием).
- Новые `*.css` в `features/**` или `components/**` — только `styles/bem.css`, `styles/widgets/*`, `globals.css`.
- Legacy `src/stories/design-v2/**` в Storybook (удалены из репозитория и индекса); импорты `apps/web/src/design-v2/*`, `features/dv2/*` в product code.

---

## 5. Tables / lists

| Тип | Компонент | Стиль |
|-----|-----------|--------|
| App lists | `DataTable` → `.table` | body 14px; compact: `.table--compact` |
| Storybook catalog table | Тот же `DataTable`, не shadcn `Table` | Parity с app |
| Audit / feed | `.audit-list`, `.feed`, `.exception-list` | body 14px; meta 12px |

**MUST**

- Primary cell: `CellStack` (title 14px semibold, subtitle 12px).
- Деньги и коды: класс `mono` + 14px.
- Выравнивание действий: `cell-actions` + `IconButton` с `aria-label`.

**NEVER**

- Две таблицы с разным row-height на одном экране без смысла (пример: канбан + полная таблица при активном «Канбан»).

---

## 6. Forms

| Элемент | Правило |
|---------|---------|
| Label | `Field` + `Label` / `.field__label` — **14px** |
| Input, Select, Textarea | **14px** (`data-slot` / `--text-md`) |
| Section title | `FormSection` — **14px** semibold внутри карточки |
| Hint / error | **11–12px**, `--danger-text` для ошибки |

**MUST**

- `SwitchRow` / `SwitchRowList` для boolean-настроек, не голый `Switch` без подписи.
- `FormGrid` columns 1 | 2 | 3; на mobile — одна колонка (уже в CSS).
- Модалки создания — `Dialog` / `Sheet`, не `CardPanel` на странице с заголовком «модалка».

**NEVER**

- Fake tabs: Segmented «Канбан / Список» при одновременном показе обоих видов.
- EN labels в формах (`Domain allowlist` → **Белый список доменов**).

---

## 7. Badge / Chip / status taxonomy

| Primitive | Назначение | Пример |
|-----------|------------|--------|
| **Badge** | Счётчик, нумерация, микро-метка без смысла стадии | `24` в funnel, soft count |
| **Chip** | Стадия, статус сущности, риск, тип исключения | «В работе», «Праздник», «Высокий» |
| **PriorityFlag** | Приоритет задачи в Kanban | Срочный / Низкий (RU label) |
| Legacy `.badge` BEM | **Запрещён** в новом коде | Заменить на `<Badge>` |

**Variant mapping (Chip)**

| Смысл | variant |
|-------|---------|
| Нейтральный / черновик | default / outline |
| Активный / в работе / info | `info` |
| Успех / активен | `success` |
| Риск / праздник / внимание | `warning` |
| Кастом / роль / фиолетовая стадия | `violet` |

**NEVER**

- Chip для английского сегмента (`Enterprise`) или английского audit action (`Action` / `Review`).
- Badge и Chip для одного и того же «статуса строки» на соседних экранах — выбрать Chip для стадий.

---

## 8. Date / money / percentage formats

| Тип | Формат | Пример |
|-----|--------|--------|
| Дата в таблице | `ДД.ММ.ГГГГ` | `27.05.2026` |
| Дата в карточке / компакт | `ДД.ММ` допустимо только в Gantt/baseline grid с легендой | `27.05` + колонка «Год» |
| Время аудита | `ДД.ММ.ГГГГ, ЧЧ:ММ` | `23.05.2026, 14:32` |
| Деньги RU | Пробел тысяч, суффикс `₽` | `1 240 000 ₽` |
| «От» в каталоге | Единообразно: везде **от** или нигде | `от 890 000 ₽` |
| Процент | Без пробела перед `%` | `82%`, `112%` |
| Delta сроков | `+2 дн.` / `−4 дн.` | Не `+2 д` и не `baseline` в UI |
| ID | `mono`, префикс латиницей OK | `PRJ-2026-014`, `DEAL-101` |

---

## 9. CTA / link / action patterns

| Зона | Правило |
|------|---------|
| Page actions | В `PageIntro` → `btn-group`: вторичное слева, **primary** справа |
| Topbar default | «Экспорт» + «Создать» **только** если `SCREEN_META` разрешает; иначе `showDefaultActions={false}` |
| Primary CTA | Один на экран (сохранить / создать / принять) |
| Destructive | `variant="destructive"` в menu; не primary |
| Ghost | Фильтры, вторичные иконки |
| Links в тексте | Accent + underline on hover; не кнопка под текст |

**NEVER**

- Кнопки без сценария (экспорт на audit-only, «Создать» на login).
- EN глаголы на кнопках (`Save` → **Сохранить**).

---

## 10. Storybook acceptance checklist

Перед merge UI / stories агент **отмечает всё**. Последний re-audit: [`STORYBOOK-CONTRACT-AUDIT-2026-05-24.md`](./STORYBOOK-CONTRACT-AUDIT-2026-05-24.md) (batch 10).

- [x] Story в `Views/Screens` — **fullscreen** + `WorkspaceChrome` (кроме `19-login`, state-*). _Batch 13a: `variant: "bare"` + `app-canvas__panel--bare`; Playwright `batch13a-state-bare-evidence.json`._
- [x] Нет stories из `src/stories/design-v2/**` в индексе (каталог удалён, batch 8).
- [x] `Catalog/All Components` использует те же primitives, что экраны (`CardPanel`, `DataTable`, RU copy). _Batch 13b: domain `CardPanel`/`DataTable`; evidence `batch13b-catalog-domain-evidence.json`._
- [x] UI/* stories: есть variant states, не только один fullscreen DesignV2 showcase. _Batch 13c: story «Варианты» в 43 UI files; id `ui-*--variants`; evidence `batch13c-ui-variants-evidence.json`._
- [x] Copy: нет EN dev labels; breadcrumbs RU; mock dates/money по §8. _Batch 15c: все story entries (106), Playwright EN_DEV; evidence `batch15c-copy-scan-evidence.json`._
- [x] Typography: один h1 32px; card h3 18px; section 14px; body 14px; кнопки 12px. _Batch 14 + 14m: `PageIntro` 32px; `deal-card__title` → `--text-h3` (18px); evidence `batch14-views-typography-evidence.json`, `batch14m-deal-card-typography-evidence.json`._
- [x] Badge/Chip по §7; нет legacy `.badge` BEM в новых блоках. _Batch 13e: `deals-block.tsx`, `widgets/kanban/kanban-board.tsx`; evidence `batch13e-badge-chip-evidence.json`._
- [x] Нет fake segmented / fake topbar actions. _Batch 13g: `Segmented` + `useState` в blocks; `WorkspaceChrome` export/create `disabled` + title; `run-fake-affordances-audit.mjs` + health test._
- [x] `pnpm --filter @kiss-pm/web typecheck` + `test` + `build` (AGENTS §10). _Batch 15: build evidence; batch 16: `pnpm verify:storybook-contract` в CI (`.github/workflows/design-v3-storybook-contract.yml`)._
- [x] Визуально открыты: затронутые screen stories + 1 соседний экран для сравнения плотности. _7 эталонных PNG в `.storybook-verify-tmp/`; соседний экран для плотности — batch 13._

---

## Быстрые ссылки

- Импорты UI на экранах: `@/components/ui`, `@/components/domain`, `@/widgets`, `@/shell`, `@/views/layout`.
- Единый `PageIntro`: `@/views/layout/page-intro` (не дублировать `@/components/ui/page-intro` на экранах).
- Аудит-основа: [`STORYBOOK-CONTRACT-AUDIT-2026-05-24.md`](./STORYBOOK-CONTRACT-AUDIT-2026-05-24.md) (batch 10).

_Версия: 1.0 · design-v3 rebuild worktree._
