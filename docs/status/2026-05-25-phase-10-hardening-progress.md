# Phase 10 backend hardening progress — 2026-05-25

## Scope

Этот ledger фиксирует уже закрытые backend hardening gaps в ветке `codex/phase10-backend-hardening`. Он дополняет capability inventory и нужен, чтобы Phase 10 не стала неявным набором разрозненных фиксов.

## Closed gaps

| Area | Gap | Resolution | Evidence |
|------|-----|------------|----------|
| Operations readiness | Не было разделения liveness/readiness и provider checks | Добавлены `/health/live`, `/api/health/live`, `/health/ready`, `/api/health/ready`; readiness проверяет DB/storage | `pnpm vitest run apps/api/src/app.test.ts`, `pnpm typecheck` |
| Operations readiness | Production мог быть ready без `DATABASE_URL` и уйти в in-memory datasource | Server readiness fail-closed для production без Postgres | `pnpm vitest run apps/api/src/serverReadiness.test.ts apps/api/src/app.test.ts` |
| Operations readiness | Production local storage мог писать в default `.kiss-pm-storage` без явного root | `KISS_PM_STORAGE_LOCAL_ROOT` обязателен для local storage в production | `pnpm vitest run apps/api/src/storageProvider.test.ts apps/api/src/serverReadiness.test.ts` |
| Security headers | Public `/health*` routes не получали baseline security/no-store headers | Baseline headers применяются ко всем API app routes | `pnpm vitest run apps/api/src/app.test.ts apps/api/src/requestSecurity.test.ts` |
| Attachment privacy | File download response не задавал explicit no-store cache policy | Download response задает `Cache-Control: no-store, private` | `pnpm vitest run --config vitest.db.config.ts apps/api/src/attachmentRoutes.db.test.ts` |
| External references | IPv6 unspecified literals `[::]` / `[0:...:0]` не отклонялись как unsafe host | URL validation rejects IPv6 unspecified hosts | `pnpm vitest run apps/api/src/attachmentValidation.test.ts apps/api/src/storageProvider.test.ts` |
| KPI expression safety | Constrained KPI AST валидировал finite листья, но арифметика могла вернуть `Infinity` | KPI expression arithmetic normalizes operation results through finite guard | `pnpm vitest run packages/domain/src/control/controlEngine.test.ts`, `pnpm typecheck` |
| Control action apply | После planning lock повторно проверялось наличие `planDelta`, но не пустой command list | Locked action recheck rejects empty planDelta before preview/apply/version increment | `pnpm vitest run apps/api/src/app.test.ts packages/domain/src/control/controlEngine.test.ts`, `pnpm typecheck` |
| Control surface lifecycle | Archived control surface можно было восстановить через publish/rollback paths | Publish/rollback reject archived surfaces; persistence adds secondary invariant guard | `pnpm vitest run apps/api/src/controlSurfaceRoutes.test.ts packages/persistence/src/migration.test.ts`, `pnpm typecheck` |

## Broad verification

- `pnpm test`: passed, 56 files, 340 tests.
- `pnpm test:db`: passed.
- `pnpm typecheck`: passed for every code slice.
- `git diff --check`: passed for every code slice.

## Remaining Phase 10 audit queue

| Area | Next check |
|------|------------|
| Planning / solver apply | Re-run focused review for persisted proposal consistency, stale planVersion, allocation mutation permissions and audit trace |
| Capacity | Re-run focused review for project filter semantics, hidden contribution masking and cache invalidation after all mutating paths |
| KPI / action engine | Continue focused review for denied-path audit completeness and read-model exposure |
| Control surfaces | Continue focused review for action binding safety and published read-model shape |
| Closure / retrospectives | Re-run focused review for immutable snapshot consistency and retry/conflict semantics |
| Release-like smoke | Add or run backend smoke covering the full management loop from auth to closure/audit |
