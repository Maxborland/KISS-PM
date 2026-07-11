# Worker navigation: Calendars conflict banner -> Schedule

## Result

PASS для lane PROJ-095. В текущем `calendars-surface.tsx` CTA реального баннера
конфликта уже реализован как `Link` на `/projects/${projectId}/schedule`, поэтому
product code не менялся. Добавлен focused regression test для A и PR read paths,
счётчика конфликтов и edge state без расчётных дат.

## Scope

- `apps/web/src/delivery/calendars/calendars-surface.tsx` — проверен, не изменён.
- `apps/web/src/delivery/calendars/calendars-navigation.test.tsx` — создан.
- `.superloopy/evidence/projects-2026-07-10/worker-navigation-calendars.md` — создан.
- Matrix и E2E не изменялись. Коммит не создавался.

## Acceptance evidence

- A с plan/resource manage permissions видит реальный conflict banner и ссылку
  `Открыть График` с `href=/projects/project-alpha/schedule`.
- PR с `tenant.project_plan.read` получает тот же read-only путь и тот же CTA.
- Два конфликта сохраняют счётчик `И ещё 1.`.
- Задача с `calculatedStart === calculatedFinish` на праздничной дате считается
  конфликтом, то есть однодневная edge-ветка не потеряна.
- Задача с `calculatedStart/calculatedFinish = null` не создаёт ложный баннер или CTA.

## Verification

1. `codegraph sync` до исследования — PASS, индекс был актуален.
2. CodeGraph `context` + `search` + `impact(ProjectCalendars, depth=3)` — impact
   ограничен `ProjectCalendars`/файловым узлом; внешних вызывающих символов граф
   не показал.
3. `pnpm vitest run apps/web/src/delivery/calendars/calendars-navigation.test.tsx`
   — PASS: 1 файл, 3 теста.
4. `git diff --check -- apps/web/src/delivery/calendars/calendars-navigation.test.tsx`
   — PASS.
5. `pnpm --filter @kiss-pm/web typecheck` — запущен дважды; `next typegen` PASS,
   общий `tsc` BLOCKED единственной ошибкой TS2375 в concurrent untracked-файле
   `apps/web/src/delivery/ui/delivery-frame-navigation.test.tsx:38`. Файл вне
   scope: он передаёт `projectId: string | undefined` в exact-optional prop.
   Ошибок из calendars test/type surface не выведено.
6. Финальный `codegraph sync` — PASS, watcher уже проиндексировал изменения.

## CodeGraph fallback

Первичный semantic `codegraph_context` не вернул JSX `ProjectCalendars`, а первый
`codegraph_explore` выбрал нерелевантные calendar symbols. После обязательных
context/impact точечное чтение разрешённого surface и соседних calendar tests
использовано как fallback для конкретной разметки и тестового паттерна.

## CodeGraph change index

- Before: `calendars-navigation.test.tsx` отсутствовал и имел 0 nodes/edges;
  production symbol `ProjectCalendars` уже содержал Schedule `Link`.
- After: добавлен один TSX-файл с 9 symbols; ключевые новые функции —
  `conflictReadModel` и `renderCalendars`, тесты ссылаются на `ProjectCalendars`.
- Production symbols/edges: без изменений; `calendars-surface.tsx` не менялся.
- Final graph: 2,221 files, 24,704 nodes, 52,772 edges.

## Residual risk

Полный web typecheck нельзя подтвердить зелёным до исправления concurrent
`delivery-frame-navigation.test.tsx`; этот внешний файл не изменён по условию
scope и правилу не трогать работу других lanes.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-calendars.md
