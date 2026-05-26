# Design v3 — Production-Grade Brief

Объединённый бриф: направление Cursor (premium-industrial, операционная плотность) + блокеры визуального аудита Eva (2026-05-25).

**План реализации:** [`docs/plans/2026-05-25-kiss-pm-design-v3-storybook-production-grade.md`](../plans/2026-05-25-kiss-pm-design-v3-storybook-production-grade.md)

**Контракт:** [`DESIGN_CONTRACT.md`](./DESIGN_CONTRACT.md) · **Токены:** [`TOKENS.md`](./TOKENS.md)

---

## Цель

Storybook design-v3 — надёжный визуальный baseline продукта: экраны выглядят как готовое приложение, сценарии типизированы, контракт API виден, регрессии ловятся CI.

## Направление (Cursor brief)

- **Визуал:** premium-industrial duotone; плотные операционные поверхности + просторные decision surfaces.
- **Структура Storybook (8 секций):** подготовлена в [`STORYBOOK-STRUCTURE.md`](./STORYBOOK-STRUCTURE.md) (inventory, globs, миграция). **В sidebar пока** Catalog, Foundations, UI, Views, Widgets — внедрение roots Phase 8.
- **Данные:** typed fixtures + MSW + переключатель сценариев (`default` / `empty` / `loading` / `error` / `forbidden` / `overload` / `late`).
- **Состояния:** L1–L4, shimmer skeleton, словарь ошибок с `correlationId`.
- **Shell:** icon rail + context sidebar + тонкий topbar (после стабилизации контракта).
- **Верификация:** VRT, axe, health tests, contract tests.

## Непереговорные правила

| Правило | Смысл |
|--------|--------|
| UI на русском | Кнопки, заголовки, пустые/ошибки, breadcrumbs — RU. |
| Код и API на английском | Типы, идентификаторы, команды, route ids. |
| Product stories = готовые экраны | Не демо примитивов; без Storybook error UI. |
| Без новых CSS-островов | Только `tokens.css`, BEM, `styles/widgets/*`. |
| Reuse first | Kanban, DatePicker, states, shell, PageIntro, DataTable, Gantt, Funnel, ResourceMatrix. |
| Control surface | Не меняет домен напрямую — только command/action. |
| **Finished-screen @ 1440px** | Любой product screen в default-сценарии проходит композицию на 1440px **до** premium polish. |

`framer-motion` — не по умолчанию; только явное решение, если CSS/dnd-kit недостаточно (Gantt).

---

## Current blockers before production-grade upgrade

Источник: аудит Eva 2026-05-25 + обход Storybook. Закрываются в **Phase 0–7** плана.

### Надёжность Storybook

- [x] Сломанные play stories (дубликаты `getByText`) — Phase 0, 2026-05-26:
  - `views-screens--my-work-kanban-dragging` — «В работе»
  - `views-screens--create-task-modal-validation` — «Участники»
  - `views-screens--deals-funnel-dragging` — «КП»
- [x] CI gate: `run-copy-scan-all-stories.mjs` + `phase0-screen-error-gate.json` для `Views/Screens`

### Композиция и плотность

- Белые пустоты, разреженные placeholder, несогласованный shell.
- Gantt / ResourceMatrix перегружены; остальные экраны недокормлены.
- State screens смешивают naked primitives и product shell.

### Навигация и копирайт

- Deals подсвечивает «Входящие» вместо CRM.
- Projects / Gantt / Resources часто подсвечивают «Отчёты».
- Утечки EN/техтекста: `UpdateTaskBody`, `PATCH /api/...`, `active`, `opportunity`, `Quick Daily`, `John Onboarding`, dev-баннеры.

### Виджеты

- Gantt: геометрия зависимостей, приоритет toolbar.
- ResourceMatrix: иерархия group/person/overload/weekend/selection.

### Взаимодействия (отдельный backlog)

См. [`STORYBOOK-INTERACTION-AUDIT-2026-05-25.md`](./STORYBOOK-INTERACTION-AUDIT-2026-05-25.md) — локальный state/DnD/формы; не блокирует Phase 0, но влияет на credibility экранов.

---

## Reuse map (не дублировать)

| Область | Путь |
|--------|------|
| Kanban | `apps/web/src/widgets/kanban/*` |
| Funnel | `apps/web/src/widgets/funnel/*` |
| DatePicker | `apps/web/src/components/ui/date-picker.tsx` |
| States | `empty-state`, `error-state`, `forbidden-state`, `loading-state`, `illu-state` |
| Shell | `apps/web/src/shell/*` |
| Page surface | `page-intro`, `card-panel`, `data-table`, `form-layout` |
| Widgets | `gantt`, `funnel`, `resource-matrix` |

---

## Фазы (кратко)

0. Baseline lock + play/CI gate  
1. Tokens + Foundations  
2. Primitives + domain components  
3. Scenarios + MSW  
4. State system  
5. Shell + nav  
6. Widgets  
7. Screens  
8. Flows + Patterns + API Contract  
9. VRT + axe + lockdown  

**Phase 1 (2026-05-26):** токены (`--text-display`, `--brand-grad`, density/depth tiers), `DESIGN_CONTRACT` §3a–3d, Foundations stories (Colors+contrast, Typography, Density, Depth, Iconography), Storybook overview `Foundations/Контракт дизайна`.

**Не заявлять:** «8 секций Storybook locked» — только после Phase 8.

**Scope PR:** [`PHASE-0-1-SCOPE-BOUNDARY.md`](./PHASE-0-1-SCOPE-BOUNDARY.md) — API/task-contract вне Phase 0–1.

**Phase 2 (2026-05-26):** primitives + domain composites; коррекции — [`PHASE-2-CORRECTIONS.md`](./PHASE-2-CORRECTIONS.md).

**Следующий шаг:** Phase 3 — scenario fixtures, MSW, Storybook structure.
