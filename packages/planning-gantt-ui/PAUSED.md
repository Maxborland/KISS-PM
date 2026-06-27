# ⏸ PAUSED — planning-gantt-ui

**Status:** paused, **not** wired into the product (2026-06-25). Kept as **design reference**.

Excluded from the active build graph (removed from root `tsconfig.json` references) so the
workspace typecheck stays green. Source preserved.

## Что это
Headless типизированный Gantt/WBS-скелет (~35% готов): чистая архитектура props-in/intents-out
(`types/viewModel|intents|capabilities|features`), сильный протестированный lib-слой
(`timelineScale`, `treeRows`, `displayFormat`), компоненты timeline + WBS-грид.

## Важно (ложная готовность)
Интерактивный слой **не построен**: ни один компонент не эмитит `onIntent`, адаптера к
`@kiss-pm/planning-client` нет, часть зависимостей мертва. Богатый словарь intents создаёт
впечатление готовой фичи — это не так.

## Статус vs живой Gantt
Живой Gantt в продукте — отдельный `apps/web/src/widgets/gantt/*`. Этот пакет — более амбициозный
задел того же (с приостановленного Phase B/C).

- До read-only вьюера на parity с `widgets/gantt`: ~1 неделя.
- До заявленной амбиции (drag/inline-edit/dependency authoring/виртуализация): multi-week (~55% плана не доделано).

## Revive
Полный разбор: [`docs/audit/planning-packages-assessment.md`](../../docs/audit/planning-packages-assessment.md).
