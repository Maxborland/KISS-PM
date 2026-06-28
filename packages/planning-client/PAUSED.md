# ⏸ PAUSED — planning-client

**Status:** paused, **not** wired into the product (2026-06-25).

This package is excluded from the active build graph (removed from root `tsconfig.json`
references, from `apps/web` deps, and from `next.config.ts` transpilePackages) so the
workspace typecheck stays green. **Source is intentionally preserved** — это годная база для оживления.

## Что это
Типизированный доменный клиент планирования (~75% готов, quality 4/5): HTTP/SSE-транспорт,
optimistic concurrency (`clientPlanVersion → 409`), undo через compensating-commands,
predecessors parse/serialize, duration/fill helpers, realtime plan events. **REST/SSE-контракт
совпадает с живым backend 1:1.**

## Почему отключён, а не удалён
Не импортируется приложением (живой план дублируется inline в
`apps/web/src/views/screens/runtime-screen-view.tsx`). Оживление как data-слоя — дни.

## Revive
Полный разбор и план: [`docs/audit/planning-packages-assessment.md`](../../docs/audit/planning-packages-assessment.md).
Починка typecheck — 1–2 ч (конфиг: `types` в `tsconfig.base.json` + references на `../domain`).
