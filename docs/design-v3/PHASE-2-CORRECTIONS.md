# Phase 2 — коррекции и критерий «фаза закрыта»

Дата: 2026-05-26  
Коммиты базовой реализации: `cfb9a87`, `3adacc4`  
Коммит коррекций: (после review PO / architect)

## Что исправлено

| # | Находка | Действие |
|---|---------|----------|
| 1 | `verify:storybook-contract` — `EMFILE` на copy-scan | Copy-scan сам поднимает `serve` чанками по 40 stories (`run-copy-scan-all-stories.mjs`); CI больше не держит один долгоживущий `serve` |
| 2 | `GanttBar` путаница с `GanttChartBar` | Основной экспорт: `GanttBarDemo`; `GanttBar` — deprecated re-export; story `Composites/GanttBarDemo` |
| 3 | `ParticipantList` дублировал аватары и список | `layout: "compact" \| "detailed"` (по умолчанию `detailed`) |
| 4 | Inline `width`/`transform` в TSX | Проценты через CSS-переменные на track/root (`--progress-pct`, `--capacity-fill-pct`, `--gantt-bar-demo-pct`) |
| 5 | `widgets-gantt--drawer-visual-correction` без кириллицы в preview | RU lead + `name: "Коррекция drawer"` |

## Критерий «Phase 2 выполнена»

Фаза считается **закрытой**, если одновременно:

1. Все пункты Task 2.1 / 2.2 плана ([`2026-05-25-kiss-pm-design-v3-storybook-production-grade.md`](../plans/2026-05-25-kiss-pm-design-v3-storybook-production-grade.md)) — компоненты + stories + BEM.
2. `pnpm --filter @kiss-pm/web typecheck` — OK.
3. `pnpm --filter @kiss-pm/web test` — OK.
4. `pnpm --filter @kiss-pm/web verify:storybook-contract` — OK (copy-scan без ложных connection refused).
5. Adoption в widgets/screens **не обязателен** для Phase 2 (ожидается Phase 5–7).

## Вне scope Phase 2 (отложено)

- Переименование `UI/*` → `Primitives/*` (Phase 8).
- axe / VRT (Phase 9).
- Подключение composites в Gantt / ResourceMatrix / screens (Phase 6–7).

## Следующий шаг

**Phase 3** — scenario fixtures, MSW, Storybook structure.
