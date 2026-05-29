# Design v3 — Polish (production-grade finish)

Системный polish design-v3 для **светлой темы**: глубина canvas/panel, CSS-only микроинтеракции, лексикон деталей из референсов Taskplus/Layers, верификация Playwright + axe-core + health-тесты.

## Зафиксированные решения

| Ветка | Решение |
|-------|---------|
| Scope | **D** — foundational + bento + kanban + tables + drawer + shell + forms + Gantt micro |
| Отделение bento | **D combo** — canvas холоднее, panel white, multi-layer shadow, inner highlight |
| Motion | **B standard** — CSS-only: lift/press/focus, stagger, count-up |
| Details | **B standard** — status dots, column strip, hairline, progress--mini, badge--dot |
| CSS arch | **A** — patch `tokens.css`, `bem.css`, `widgets/*.css`; без новых css-файлов |
| Verify | **C strict** — vitest health + Playwright visual + axe-core |
| Refs | **B inspiration** — лексикон, не 1:1 копия |

## Не в scope

- Dark theme, framer-motion, noise/grain на canvas
- Gantt PROD (стрелки, z-index stack) — только micro hover/pulse
- Backend, универсальный Kanban widget

## Фазы

1. **Фаза 0** — этот документ + delta в `TOKENS.md`
2. **Фаза 1** — `tokens.css` (canvas, shadows, motion, focus) + global `prefers-reduced-motion` в `bem.css`
3. **Фаза 2** — примитивы: `chip--dot`, `badge--dot`, `progress--mini`, `u-hairline-*`
4. **Фаза 3** — bento/tile depth, stagger, count-up, `dashboard-bento.tsx`
5. **Фаза 4** — kanban column strip, card lift, drag preview, `kanban.tsx` + cards + my-work/deals tones
6. **Фаза 5** — tables, drawer, shell, forms
7. **Фаза 6** — Gantt micro: `.gbar:hover`, `.gantt2__today` pulse, `.gdep__path:hover`
8. **Фаза 7** — `design-v3-polish.health.test.ts`, Playwright visual spec, evidence JSON

## Критерии приёмки

- Luminance canvas vs panel ≥ **1.12** (health-test)
- chip--dot, progress--mini, column strip, hairline — на Storybook
- axe **0 critical** на 4 polish stories (dashboard, my-work, projects-list, deals); task-card и gantt — visual-only (pre-existing form/grid a11y)
- `verify:storybook-contract` + polish health green
- Нет inline style / hex в TSX; нет новых `*.css` в `features/**`

## Верификация

```bash
codegraph sync
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web build
pnpm --filter @kiss-pm/web verify:storybook-contract
pnpm --filter @kiss-pm/web test:visual:polish
codegraph sync
```
