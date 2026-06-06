# 37. Phase C.5 — Hardening

## Scope

- **Narrow viewport:** `<768px` → `NarrowFallback` (audit остаётся доступен).
- **a11y:** `@axe-core/playwright` на `planning-workspace`, critical = 0.
- **Health budgets:** ban `<select>` в `features/planning/**`, line budget WbsGrid.
- **Prod build:** `pnpm build` в closure gate.
