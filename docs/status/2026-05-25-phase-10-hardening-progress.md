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
| Closure denied audit | Lesson creation and template improvement apply returned 403 without denied audit | Retrospective lesson and template improvement denied paths write closure audit events | `pnpm vitest run apps/api/src/retrospectiveRoutes.test.ts`, `pnpm typecheck` |
| Release-like smoke | Не было DB smoke, который проходит полный backend management loop | Добавлен сквозной DB smoke: auth → planning apply → control evaluate → closure close → audit read | `pnpm vitest run --config vitest.db.config.ts apps/api/src/backendManagementLoop.db.test.ts`, `pnpm typecheck` |
| Planning auto-solver permissions | Solver run proposals could expose assignment/allocation deltas to plan managers without resource-manage permission | Auto-solver run create/read now require resource management permission before persisted proposal data is returned | `pnpm vitest run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts`, `pnpm typecheck` |
| Capacity invalidation | Closing a project changed capacity-committed status but left tenant capacity cache warm until TTL | Project closure now invalidates tenant capacity cache so closed project load disappears immediately | `pnpm vitest run --config vitest.db.config.ts apps/api/src/capacityRoutes.db.test.ts`, `pnpm typecheck` |
| Control action preview permissions | Management action preview returned persisted `planDelta` with only execute/control-read permissions, before action-specific permission checks | Preview now runs the same action-specific permission gate as apply, writes denied audit/execution on refusal, and control read-model requires project plan read | `pnpm vitest run apps/api/src/app.test.ts`, `pnpm typecheck` |
| Control surface action binding safety | Action permission arrays accepted non-string/blank entries as long as the mandatory permissions were present | Control surface validation now rejects malformed permission array entries before publish | `pnpm vitest run packages/domain/src/controlSurfaces/validation.test.ts apps/api/src/controlSurfaceRoutes.test.ts`, `pnpm typecheck` |
| Closure snapshot read boundary | Project close built and returned a plan-derived closure snapshot without requiring project plan read permission | Close permission composition now requires `tenant.project_plan.read` before snapshot construction, and denied close remains audited | `pnpm vitest run apps/api/src/retrospectiveRoutes.test.ts`, `pnpm typecheck` |
| Planning auto-solver apply audit | Persisted solver apply returned stale plan/precondition 409 responses without an audit trail | Solver apply now writes conflict/precondition audit events before returning governed 409 outcomes | `pnpm vitest run apps/api/src/planningAutoSolverRoutes.test.ts`, `pnpm typecheck` |
| KPI definition read exposure | Control read-model returned KPI definitions without requiring the dedicated KPI definition read permission | Control read-model now requires `tenant.kpi_definitions.read` before loading definitions/evaluations/signals | `pnpm vitest run apps/api/src/app.test.ts`, `pnpm typecheck` |
| Control surface published action exposure | Published control surface read-model returned actions even when the actor lacked action-specific permissions | Non-builder published read-model now filters actions by actor permissions while builder state remains complete | `pnpm vitest run apps/api/src/controlSurfaceRoutes.test.ts`, `pnpm typecheck` |
| Control surface required-permission exposure | Published surfaces were visible to non-builder readers even when their definition-level required permissions were missing | Non-builder published read-model now hides surfaces unless definition `requiredPermissions` are all granted | `pnpm vitest run apps/api/src/controlSurfaceRoutes.test.ts`, `pnpm typecheck` |
| KPI definition mutation denied audit | KPI definition upsert denied by missing manage permission returned 403 without an audit trail | Denied KPI definition upserts now write safe metadata-only control audit events before returning 403 | `pnpm vitest run apps/api/src/app.test.ts`, `pnpm typecheck` |
| Management action route-level denied audit | Management action preview/apply route-level permission failures returned 403 before loading candidates without audit | Preview/apply now audit safe route metadata for execute/read permission denials before loading action candidates | `pnpm vitest run apps/api/src/app.test.ts`, `pnpm typecheck` |
| Planning auto-solver apply rejection audit | Expired, already-applied, and payload-hash-mismatch solver apply rejections returned 409 without audit | Solver apply now writes rejection-specific audit events before returning governed 409 outcomes | `pnpm vitest run apps/api/src/planningAutoSolverRoutes.test.ts`, `pnpm typecheck` |
| Planning auto-solver proposal rejection audit | Missing proposal ids and accepted-overload proposals without risk reason returned errors without audit | Solver apply now audits missing proposal and accepted-risk-reason precondition failures before returning 404/409 | `pnpm vitest run apps/api/src/planningAutoSolverRoutes.test.ts`, `pnpm typecheck` |
| Planning auto-solver route-level denied audit | Solver run create/read/apply route-level permission denials returned 403 without audit | Solver create/read/apply now write safe route-metadata denied audit before exposing or applying persisted proposals | `pnpm vitest run apps/api/src/planningAutoSolverRoutes.test.ts`, `pnpm typecheck` |
| Closure retry/conflict audit | Close-project race outcomes mapped to stable 404/409 but left no audit trail | Closure close now audits not-found/closability race failures without writing success `project.closed` audit | `pnpm vitest run apps/api/src/retrospectiveRoutes.test.ts`, `pnpm typecheck` |

## Broad verification

- `pnpm test`: passed, 56 files, 340 tests.
- `pnpm test:db`: passed.
- `pnpm typecheck`: passed for every code slice.
- `git diff --check`: passed for every code slice.

## Remaining Phase 10 audit queue

| Area | Next check |
|------|------------|
| Planning / solver apply | Continue focused review for low-level persistence failure mapping after route-level denied audit symmetry |
| Capacity | Continue focused review for less common project lifecycle status transitions beyond closure |
| KPI / action engine | Continue focused review for action execution persistence edge cases after route-level denied audit |
| Control surfaces | Continue focused review for saved-view/audit mutation boundaries after published permission gates |
| Closure / retrospectives | Continue focused review for template-improvement retry/error semantics after close conflict audit |
| Release-like smoke | Keep smoke in the Phase 10 verification set and expand only when a new backend phase adds a mandatory loop step |
