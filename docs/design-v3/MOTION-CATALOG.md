# Motion Catalog — design-v3

**Статус:** Phase 8. **Применение:** CSS-only, токены `tokens.css`, `bem.css`, `widgets/*.css`.  
**Исключения:** Gantt PROD-анимации (routing/layering) — отдельный punchlist; здесь только micro-motion.

## Принципы

1. **Без framer-motion** в product UI и Storybook.
2. **`prefers-reduced-motion`** — глобальное отключение transform/animation в `bem.css`.
3. **Длительности** — `--motion-fast` (120ms), `--motion-base` (180ms), `--motion-slow` (260ms).
4. **Easing** — `--ease-standard`, `--ease-emphasized` (см. `TOKENS.md`).

## Каталог паттернов

| Паттерн | Класс / контекст | Назначение |
|---------|------------------|------------|
| Lift on hover | `.tile:hover`, `.kanban-card--draggable:hover` | Карточка приподнимается, тень усиливается |
| Press | `.btn:active`, `.segmented__btn:active` | Лёгкое `scale(0.98)` |
| Focus ring | `.focus-ring`, `:focus-visible` на primitives | Доступный focus без outline-hack |
| Stagger reveal | `.bento__cell` (dashboard) | Каскад появления KPI (Phase polish) |
| Count-up | `.tile__value--kpi` | Числовой акцент (CSS, не JS loop в SB) |
| Kanban drag ghost | `@dnd-kit` + `.kanban-card--dragging` | Preview при перетаскивании |
| Sheet enter | Radix Sheet + `data-state` | Drawer detail (Patterns) |
| Today pulse | `.gantt2__today` | Маркер «сегодня» на шкале |
| Bar hover | `.gbar:hover` | Подсветка полосы Gantt |
| Dependency hover | `.gdep__path:hover` | Подсветка связи |
| Loading skeleton | `.screen-block-skeleton`, `Skeleton` | Shimmer через token `--skeleton-base` |
| Toast | Sonner | Появление уведомления (библиотека) |

## Storybook

- **Patterns/Состояния загрузки** — статические L3 states (без лишней анимации).
- **Flows/** — сценарии с MSW delay только через toolbar «Сценарий → Загрузка».
- **Foundations/Depth** — тени и elevation без motion.

## Запрещено

- Бесконечные loop-анимации на product canvas (кроме явного loading).
- Motion без dark/light пары теней.
- Inline `style={{ transition: ... }}` в TSX (design-v3 lockdown).

## Связанные документы

- `docs/design-v3/DESIGN-POLISH-V3-PLAN.md` — фазы polish и motion scope B.
- `docs/design-v3/TOKENS.md` — token deltas Phase 1.
- `docs/design-v3/STORYBOOK-STRUCTURE.md` — §7 Patterns, §8 API Contract.
