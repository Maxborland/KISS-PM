# Storybook — re-audit контракта §10 (batch 10)

**Дата:** 2026-05-24  
**Worktree:** `design-v3-rebuild`  
**Индекс:** 106 entries, `design-v2` в индексе: **0**  
**Машинный артефакт:** [`apps/web/.storybook-verify-tmp/batch10-contract-audit.json`](../../apps/web/.storybook-verify-tmp/batch10-contract-audit.json)  
**Скрипт:** [`apps/web/scripts/run-contract-audit.mjs`](../../apps/web/scripts/run-contract-audit.mjs)

## Verification (batch 10)

| Команда | Результат |
|---------|-----------|
| `pnpm --filter @kiss-pm/web typecheck` | exit 0 |
| `pnpm --filter @kiss-pm/web build` | exit 0 |
| `pnpm --filter @kiss-pm/web test` | exit 1 — `No test files found` (vitest в `@kiss-pm/web` без unit-тестов) |
| `pnpm --filter @kiss-pm/web build-storybook` | exit 0, 106 stories |
| Playwright 7 эталонных stories (dev `:6026`) | 7/7 preview OK, EN dev-labels не найдены |

## Чеклист §10 (`DESIGN_CONTRACT.md`)

| # | Пункт | Статус | Доказательство / gap |
|---|--------|--------|----------------------|
| 1 | Views/Screens: fullscreen + `WorkspaceChrome` (кроме `19-login`, state-*) | **PASS** | batch 13a: `variant: "bare"` в `catalog.ts`, рендер без sidebar в `screen-view.tsx`; evidence `batch13a-state-bare-evidence.json`. |
| 2 | Нет `design-v2` в индексе | **PASS** | `batch10-contract-audit.json` → `designV2Entries: 0` |
| 3 | Catalog: `CardPanel`, `DataTable`, RU copy | **PASS** | batch 13b: `ComponentCatalog.stories.tsx` → domain primitives; Playwright `.card` + `.table-wrap`. |
| 4 | UI/*: variant states, не только DesignV2 | **PASS** | batch 13c: +43 stories «Варианты» (`createVariantsStory`), id `ui-button--variants` и т.д.; `DesignV2` id сохранён. |
| 5 | Copy: нет EN dev labels; breadcrumbs RU | **PASS** | batch 15c: 106/106 stories, EN_DEV regex; `demos.tsx` vitrina RU; evidence `batch15c-copy-scan-evidence.json`. |
| 6 | Typography: h1 32px (`type-h1` / `PageIntro`) | **PASS** | batch 14 + 14m: PageIntro 32px; `deal-card__title` 18px на deals; evidence `batch14-views-typography-evidence.json`, `batch14m-deal-card-typography-evidence.json`. |
| 7 | Badge/Chip §7; нет legacy `.badge` BEM | **PASS** | batch 13e: funnel count → `<Badge variant="secondary">`; views/widgets без `.badge` BEM. |
| 8 | Нет fake segmented / fake topbar | **PASS** | batch 13g: нет raw `segmented__btn` / `onChange={() => {}}` в `views/**`; topbar `disabled` + title; evidence `batch13g-fake-affordances-evidence.json`. |
| 9 | typecheck + test + build | **PASS** | batch 13f: test exit 0; batch 15: `pnpm --filter @kiss-pm/web build` exit 0 — `batch15-build-evidence.json` |
| 10 | Визуально: затронутые + соседний экран | **PASS** (эталонная выборка) | 7 PNG: `apps/web/.storybook-verify-tmp/audit-*.png`. Сравнение плотности с соседним экраном — batch 13. |

## Эталонные 7 stories (Playwright)

| Story id | Preview | RU | EN dev | Заметки |
|----------|---------|-----|--------|---------|
| `foundations-colors--palette` | OK | ✓ | нет | `h1.type-h1` ✓ |
| `foundations-typography--type-scale` | OK | ✓ | нет | `h1.type-h1` ✓ |
| `views-screens--dashboard` | OK | ✓ | нет | `.page-intro__title` 32px ✓ batch 14 |
| `views-screens--task-card` | OK | ✓ | нет | `.page-intro__title` ✓ |
| `views-screens--project-gantt` | OK | ✓ | нет | `.page-intro__title` ✓ |
| `views-screens--project-resources` | OK | ✓ | нет | `.page-intro__title` ✓ |
| `catalog-all-components--for-approval` | OK | ✓ | нет | `.page-intro__title` ✓ |

Скриншоты: `audit-foundations-colors.png`, `audit-foundations-typography.png`, `audit-views-screens-dashboard.png`, `audit-views-screens-task-card.png`, `audit-views-screens-gantt.png`, `audit-views-screens-resources.png`, `audit-all-components.png` (префикс `audit-` в `.storybook-verify-tmp/`).

## Следующие batches (из gaps)

| Batch | Риск | Scope |
|-------|------|--------|
| **11** | safe | ~~RU ссылки в docs stories~~ ✓ batch 11 (`story-docs-copy.tsx`, 11 Docs + 31 JSDoc) |
| **12** | safe | ~~Корень sidebar RU~~ ✓ batch 12 (`group`+`root` в `renderSidebarLabelRu`, Playwright sidebar) |
| **13a** | medium | ~~`state-*` без `WorkspaceChrome`~~ ✓ batch 13a |
| **13b** | medium | ~~Catalog → `CardPanel`/`DataTable`~~ ✓ batch 13b |
| **13c** | medium | ~~UI/* variant stories~~ ✓ batch 13c |
| **13d** | medium | ~~Dashboard: `welcome-hero` → `PageIntro`~~ ✓ batch 13d |
| **13e** | medium | ~~`deals-block`: `.badge` → `Badge`~~ ✓ batch 13e |
| **13f** | safe | ~~Vitest smoke~~ ✓ batch 13f |
| **13g** | safe | ~~Fake affordances scan (segmented, topbar)~~ ✓ batch 13g |
| **14** | safe | ~~Views/Screens typography gate~~ ✓ batch 14 |
| **14m** | medium | ~~`deal-card__title` → `--text-h3`~~ ✓ batch 14m |
| **15** | safe | ~~`pnpm build` gate~~ ✓ batch 15 |
| **15c** | safe | ~~Copy scan 106 stories~~ ✓ batch 15c |
| **16** | safe | ~~CI gate: `verify:storybook-contract` + GitHub Actions~~ ✓ batch 16 |

### CI (batch 16)

| Команда | Назначение |
|---------|------------|
| `pnpm verify:storybook-contract` | `build-storybook` → `pnpm --filter @kiss-pm/web build` → static serve → `run-copy-scan-all-stories.mjs` (106) |
| `.github/workflows/design-v3-storybook-contract.yml` | PR/push на `apps/web/**`: typecheck, verify, vitest health |

Артефакт: `apps/web/.storybook-verify-tmp/batch16-ci-evidence.json`

---

_Связано: batch 8 (удаление design-v2), batch 9 (docs sync)._
