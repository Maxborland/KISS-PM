# Design-v3 checkpoint - 2026-05-25

**Worktree:** `E:\KISS-PM\.worktrees\design-v3-rebuild`  
**Branch:** `dv3/phase-1-foundation`

## Важно

- Этот документ - **только обзор** (cleanup checkpoint). **Product code в рамках этой задачи не менялся.**
- Весь diff в `apps/web/**` **уже существовал до** запуска checkpoint (визуальные батчи V-1...V-I, copy sweep, V-G docs). Checkpoint лишь зафиксировал состояние worktree.
- Единственное изменение от задачи перекодировки: **этот файл** `docs/design-v3/CHECKPOINT-2026-05-25.md`.

---

## Решение: NO-GO

**Коммитить текущий diff как один коммит - NO-GO.**

Причины:

1. В одном worktree смешаны **visual batches**, **copy sweep (11-15c)** и **V-G** (docs + `run-contract-audit.mjs`).
2. Изменены **JSON в `apps/web/.storybook-verify-tmp/`** - их **нельзя** коммитить.
3. Часть evidence **устарела** или **не подходит для sign-off** (см. раздел Evidence).

Коммит возможен только **после разделения** diff на отдельные PR/коммиты (см. рекомендации ниже).

---

## 1. Сводка git (на момент checkpoint)

| Метрика | Значение |
|---------|----------|
| Tracked в `apps/web` | **31 файл** (~+274 / -195 строк) |
| Untracked | `docs/design-review/**`, `docs/design-v3/V-H-PLANNING-PARITY-GAPS.md` |
| Staged | нет |
| `.storybook-verify-tmp` | изменены `batch10-contract-audit.json`, `batch16-ci-evidence.json` - **не коммитить** |

---

## 2. Файлы по batch

### V-1 Deals

**Файлы:**

- `apps/web/src/views/blocks/deals-block.tsx`

**Поведение:** Segmented "Канбан / Список / Прогноз" - канбан только при `kanban`, таблица только при `list`, прогноз - текст; стадия `won` с `Chip success`; сделки DEAL-098/099; счетчики воронки через `<Badge>`.

**Соответствие batch:** да (убран fake dual view: канбан + таблица одновременно).

**Риск:** низкий (Storybook mock).

---

### V-C Dashboard

**Файлы:**

- `apps/web/src/views/blocks/dashboard-bento.tsx`
- `apps/web/src/styles/bem-supplement.css` (`.bento .tile__value--kpi`)
- `apps/web/src/views/catalog.ts` (`01-dashboard` -> `activeNav: "Дашборд"`)

**Поведение:** KPI-плитка через `tile__value--kpi` (24px, `--text-h2`); SVG без hardcoded hex (`var(--danger)`).

**Соответствие batch:** да.

**Риск:** низкий.

---

### V-E Entity detail (stage bar)

**Файлы:**

- `apps/web/src/views/blocks/entity-detail-block.tsx` (часть правок)
- `apps/web/src/styles/bem-supplement.css` (`.entity-stage-bar`)

**Поведение:** вместо `ds-demo__row` - `entity-stage-bar` (стадия + avatar stack).

**Соответствие batch:** да.

**Риск:** низкий.

---

### V-F Gantt zoom

**Файлы:**

- `apps/web/src/widgets/gantt/gantt.tsx`
- `apps/web/src/widgets/gantt/types.ts`
- `apps/web/src/widgets/gantt/index.ts`
- `apps/web/src/views/blocks/gantt-slice-block.tsx`

**Поведение:** prop `zoom` -> ширина дня (`DAY_W_BY_ZOOM`: час 44, день 28, неделя 18, месяц 12), CSS `--gantt-day-w` / `--gantt-chart-w`, `data-gantt-zoom`, aria-label. Segmented в toolbar больше не "пустой".

**Соответствие batch:** да (без агрегации колонок неделя/месяц - ожидаемый scope).

**Риск:** средний (только mock; planning parity - в V-H).

---

### V-G Evidence / sign-off

**Файлы (docs):**

- `docs/design-review/parity-matrix.json`
- `docs/design-review/scripts/capture-evidence-visual-v-g.mjs`
- `docs/design-review/evidence/visual-v-g-2026-05-24/*` (PNG, manifest, README, sign-off)

**Файлы (отдельно от docs - не смешивать с visual PR без ревью):**

- `apps/web/scripts/run-contract-audit.mjs`

**Поведение:** capture v2 - scroll `.gantt2`, проверка видимых `.gbar`/`.gmile`, manifest `visual-v-g-signoff-v2`, `allPass: true`.

**Соответствие batch:** да (после исправления false positive v1).

**Риск:** низкий для docs; **средний** для `run-contract-audit.mjs` - вынести в **отдельный** коммит/PR.

---

### V-H Planning parity gaps

**Файлы:**

- `docs/design-v3/V-H-PLANNING-PARITY-GAPS.md` (untracked)

**Поведение:** только план: gaps vs `planning-ui-approved`, порядок impl H-1...H-5.

**Соответствие batch:** да.

**Риск:** нет.

---

### V-I Entity CTA

**Файлы:**

- `apps/web/src/views/blocks/entity-detail-block.tsx` (часть правок, пересекается с V-E)

**Поведение:** в `PageIntro` один visible primary "Сохранить"; "Запланировать" в меню "Действия"; в ленте "Отправить" - `secondary` (DESIGN_CONTRACT, раздел 9).

**Соответствие batch:** да.

**Риск:** низкий.

---

### Unknown / suspicious

| Подгруппа | Файлы | Суть | Риск |
|-----------|--------|------|------|
| **Copy sweep (batch 11-15c)** | `demos.tsx`, `ui-variant-presets.tsx`, `ComponentCatalog.stories.tsx`, `breadcrumb.tsx`, `command.tsx`, `dialog.tsx`, `pagination.tsx`, `app/page.tsx`, `login-screen-view.tsx`, многие `views/blocks/*` | RU copy, убран EN dev labels / `tenant` в UI | Средний - **отдельный коммит**, не в один PR с V-1...F |
| **Catalog meta** | `catalog.ts` (часть строк) | RU breadcrumbs/leads; пересекается с V-C (`activeNav`) | Низкий |
| **CI tmp** | `.storybook-verify-tmp/batch10-contract-audit.json`, `batch16-ci-evidence.json` | Артефакты `verify:storybook-contract` | **Не коммитить** |
| **Lint** | `package.json` script `lint` | `next lint` падает | Средний - отдельная задача |

---

## 3. Evidence (V-G)

### v2 visible-chart - PASS

Manifest: `docs/design-review/evidence/visual-v-g-2026-05-24/capture-manifest.json`  
Batch: `visual-v-g-signoff-v2`, `allPass: true` (2026-05-25).

Проверки Gantt chart: `ganttBarCount: 15`, `visibleGanttBarCount: 11`, `chartScrolledIntoView: true`; день `28px`, месяц `12px`.

### Canonical Gantt sign-off (только эти файлы)

| Файл | Назначение |
|------|------------|
| `docs/design-review/evidence/visual-v-g-2026-05-24/audit-views-screens-gantt-chart.png` | День: timeline + полосы в кадре |
| `docs/design-review/evidence/visual-v-g-2026-05-24/audit-views-screens-gantt-chart-zoom-month.png` | Месяц: timeline + полосы |

Справочно (не primary sign-off): `audit-views-screens-gantt-table.png`.

### Не sign-off (legacy / full-page / устаревшее)

| Файл | Почему |
|------|--------|
| `audit-views-screens-gantt.png` | Full-page alias; график может быть **вне кадра** |
| `audit-views-screens-gantt-zoom-month.png` | То же для месяца |
| `audit-foundations-colors.png` (~6 KB) | Старый малый снимок |
| `audit-views-screens-resources.png` (2026-05-24) | Не переснят v2; **stale** |
| `apps/web/.storybook-verify-tmp/*.png` | gitignore, локально |

### Другие v2 screen PNG (manifest pass)

- `audit-views-screens-task-card.png`
- `audit-views-screens-deals.png`
- `audit-views-screens-dashboard.png`

---

## 4. Verification (checkpoint run)

| Команда | Результат |
|---------|-----------|
| `pnpm --filter @kiss-pm/web typecheck` | exit 0 |
| `pnpm --filter @kiss-pm/web test` | exit 0 (17 tests) |
| `pnpm --filter @kiss-pm/web lint` | exit 1 |
| `pnpm verify:storybook-contract` | exit 0 |

`pnpm --filter @kiss-pm/web build` отдельно не запускался; покрыт `web-build` в verify.

---

## 5. Рекомендации по коммитам

### Разделить (обязательно перед merge)

1. **Visual batches:** V-1, V-C, V-E, V-F, V-I + `bem-supplement.css` + `catalog.ts` (activeNav дашборда).
2. **Design-review:** `docs/design-review/**` + `V-H-PLANNING-PARITY-GAPS.md`.
3. **Copy sweep:** `demos.tsx`, UI primitives, прочие blocks - **отдельный PR**.
4. **`run-contract-audit.mjs`:** **отдельный PR**, не в один коммит с visual.

### Не коммитить

- `apps/web/.storybook-verify-tmp/**/*.json` (и PNG из tmp).
- Legacy/full-page Gantt PNG как доказательство zoom sign-off.

### Следующий batch

1. V-H-impl-1 (split-pane / chart scroll) по `V-H-PLANNING-PARITY-GAPS.md`.
2. Переснять `audit-views-screens-resources.png` тем же dev-capture скриптом.
3. Починить `next lint` отдельной задачей.

---

## 6. Индекс tracked-файлов

```
apps/web/src/views/blocks/deals-block.tsx           -> V-1
apps/web/src/views/blocks/dashboard-bento.tsx       -> V-C
apps/web/src/styles/bem-supplement.css              -> V-C, V-E
apps/web/src/views/catalog.ts                       -> V-C + Unknown
apps/web/src/views/blocks/entity-detail-block.tsx   -> V-E, V-I
apps/web/src/widgets/gantt/gantt.tsx                -> V-F
apps/web/src/widgets/gantt/types.ts                 -> V-F
apps/web/src/widgets/gantt/index.ts                 -> V-F
apps/web/src/views/blocks/gantt-slice-block.tsx     -> V-F
apps/web/scripts/run-contract-audit.mjs             -> V-G (отдельный коммит)
apps/web/src/stories/showcases/demos.tsx + др.      -> Unknown
docs/design-review/**                               -> V-G
docs/design-v3/V-H-PLANNING-PARITY-GAPS.md          -> V-H
```

---

_Конец checkpoint. Кодировка UTF-8. Product code не изменялся._
