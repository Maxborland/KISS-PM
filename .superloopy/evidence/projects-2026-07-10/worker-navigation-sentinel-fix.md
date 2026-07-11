# Schedule navigation sentinel lifecycle fix

## Result

PASS. History sentinel теперь физически потребляется перед продолжением подтверждённого link-перехода и после apply/discard. Следующий Back больше не попадает в дублированный /schedule.

## Root cause

Guard создавал отдельную same-URL запись через history.pushState, но при очистке staged только снимал click/popstate/beforeunload listeners. Сама sentinel-запись оставалась в history.

## Product fix

- Добавлен единый consumeNavigationSentinel, который возвращается с sentinel на базовую /schedule запись через history.back().
- Link-confirm временно отменяет исходный click, потребляет sentinel и после popstate повторно запускает тот же anchor. Это сохраняет точный href и не выполняет planning writes.
- Apply и discard потребляют sentinel при очистке staged batch.
- Одноразовый popstate listener всегда сбрасывает restoring-флаг, поэтому повторный staging после apply/discard снова корректно охраняется.
- Modified click и middle-click по-прежнему не перехватываются; cancel/confirm Back, internal/sidebar links и beforeunload сохранены.

## Regression coverage

apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx содержит 9 сценариев, включая отдельные доказательства consumption sentinel:

1. link-confirm: history.back() вызывается до повторного click того же anchor; confirm выполняется один раз, planning writes отсутствуют.
2. apply: после успешного applyBatch sentinel потребляется ровно одним history.back().
3. discard: sentinel потребляется ровно одним history.back(), optimistic read model возвращается к batch base, writes отсутствуют.

Также покрыты clean native link, cancel с сохранением batch, internal/sidebar cancel, modified/middle-click, browser Back cancel-confirm и beforeunload.

## Verification

- pnpm --filter @kiss-pm/web exec vitest run src/delivery/schedule/schedule-navigation-guard.test.tsx
  - PASS: 1 file, 9 tests.
- pnpm --filter @kiss-pm/web typecheck
  - PASS: next typegen и tsc -p tsconfig.json --pretty false.
- git diff --check -- apps/web/src/delivery/schedule/schedule-surface.tsx
- git diff --no-index --check -- /dev/null apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx
- git diff --no-index --check -- /dev/null .superloopy/evidence/projects-2026-07-10/worker-navigation-sentinel-fix.md
  - PASS: whitespace errors отсутствуют и в modified, и в untracked deliverables.

## Scope

Product/test:

- apps/web/src/delivery/schedule/schedule-surface.tsx
- apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx

Evidence:

- .superloopy/evidence/projects-2026-07-10/worker-navigation-sentinel-fix.md

Другие product, test и docs файлы не изменялись.

## CodeGraph change index

- До работы: 2,225 files, 24,771 nodes, 53,040 edges.
- После codegraph sync: 2,225 files, 24,773 nodes, 53,113 edges.
- schedule-surface.tsx: ProjectSchedule изменён; добавлены SCHEDULE_NAVIGATION_GUARD_STATE_KEY и вложенный consumeNavigationSentinel.
- schedule-navigation-guard.test.tsx: индексирован как TSX с 14 symbols; добавлены regression-сценарии link-confirm/apply/discard.
- CodeGraph context/explore не локализовал guard из-за неоднозначного дубликата ProjectSchedule в .claude/worktrees; после входа через CodeGraph использованы точечные чтения только двух разрешённых файлов.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-navigation-sentinel-fix.md
