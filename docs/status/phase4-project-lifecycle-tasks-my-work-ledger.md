# Phase 4 ledger: Project lifecycle, задачи и My Work

## Срез 4.0 Starter

Статус: completed for starter slice.

Scope:

- `Task` как единая задача active project;
- `TaskParticipant` с ролью `executor` в starter-срезе;
- API project detail/tasks/my-work;
- создание задачи через governed action с audit `task.created`;
- web route `Моя работа`;
- web project detail route `/projects/:projectId`;
- создание задачи через модалку в деталях проекта.

Non-scope:

- Gantt/WBS;
- dependencies;
- baseline;
- Kanban;
- project stages CRUD;
- time tracking.

Acceptance mapping:

- AC1: migration/schema/repository tests.
- AC2-AC3: parser/API validation tests.
- AC4-AC7: API DB tests.
- AC8: route/query/web build checks.

Fresh evidence:

- `pnpm typecheck`: passed, exit 0.
- `pnpm test`: passed, exit 0, 28 files / 134 tests.
- `pnpm test:db`: passed, exit 0, 7 files / 38 tests. PostgreSQL notices only confirmed cascade cleanup for new task tables.
- `pnpm --filter @kiss-pm/web build`: passed, exit 0. Next.js generated `/my-work` and `/projects/[projectId]`.
- `pnpm test:e2e:smoke`: first failed, exit 1, because Playwright reused the already-running parent/Docker runtime on `3000/4000`; the stale UI did not contain `Моя работа` or project row action `Открыть`.
- Fix: Playwright web servers now use the current worktree explicitly and isolated smoke ports `3100/4100`; Next `turbopack.root` is pinned to the current worktree root.
- `pnpm test:e2e:smoke`: passed after fix, exit 0, 1 Chromium smoke. Covered login, CRM/intake, project activation, project detail, task creation, `Моя работа`, audit and restricted user shell.
- Verification process note: `pnpm test:db` and `pnpm test:e2e:smoke` must not be run in parallel against the same local PostgreSQL database because both reset/seed shared state.

Quality review notes:

- Bug Hunt: found stale-runtime smoke risk and fixed it through isolated ports.
- Architecture review: starter keeps API as security boundary, uses existing project permissions, stores task participants tenant-scoped, and writes `task.created` audit in the same transactional action.
- Security review: state-changing create task route requires session, `tenant.projects.manage`, same-origin action header inherited by API client, active project check and active participant validation.
- UI/UX review: starter adds real navigation, real project detail and task modal; no fake bulk actions or dead controls added. Gantt/Kanban/baseline remain explicit non-scope.

## Срез 4.1 Task status transitions

Статус: in verification.

Scope:

- governed endpoint `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`;
- parser contract for task statuses `todo`, `in_progress`, `blocked`, `done`;
- persistence update scoped by `tenantId + projectId + taskId`;
- participant authorization for `executor`, `co_executor`, `controller`;
- project manager authorization through `tenant.projects.manage`;
- audit `task.status_changed`;
- web mutation with targeted invalidation for project detail/tasks, `Моя работа`, projects and audit;
- inline status actions in project detail and `Моя работа`.

Acceptance mapping:

- AC9 parser: `apps/api/src/projectWorkParsers.test.ts`.
- AC9 persistence: `packages/persistence/src/projectWorkRepository.db.test.ts`.
- AC9 API permissions/audit: `apps/api/src/projectWorkRoutes.db.test.ts`.
- AC9 web client contract: `apps/web/src/api.test.ts`.
- AC9 smoke: `e2e/smoke/single-workspace-auth-rbac.spec.ts`.

Fresh evidence:

- `pnpm vitest run --config vitest.db.config.ts apps/api/src/projectWorkRoutes.db.test.ts`: first RED, exit 1, new transition endpoint returned `404`.
- `pnpm vitest run apps/api/src/projectWorkParsers.test.ts apps/web/src/api.test.ts apps/web/src/workspaceQueries.test.ts`: passed, exit 0, 3 files / 15 tests.
- `pnpm vitest run --config vitest.db.config.ts packages/persistence/src/projectWorkRepository.db.test.ts apps/api/src/projectWorkRoutes.db.test.ts`: passed, exit 0, 2 files / 7 tests.
- `pnpm typecheck`: passed, exit 0.
- `pnpm test`: first failed, exit 1, because `apps/web/src/styles.css` exceeded the 1800-line health budget after adding one-off action styles.
- Fix: removed the new CSS and reused existing `table-actions`.
- `pnpm test`: passed after fix, exit 0, 35 files / 188 tests.
- `pnpm --filter @kiss-pm/web build`: passed, exit 0.
- Review fix: endpoint now enforces explicit transition graph, re-reads active project/task inside the data-source transaction, updates with `expectedStatus`, and the repository update checks active project and expected current status.
- Review fix: Project Detail now allows the same participant roles as API (`executor`, `co_executor`, `controller`) and My Work hides transition actions for non-transition participant roles.
- Review fix: added negative API DB coverage for observer participant denial, no-header same-origin denial and terminal status rollback.
- `pnpm typecheck`: passed after review fixes, exit 0.
- `pnpm test`: passed after review fixes, exit 0, 35 files / 188 tests.
- `pnpm --filter @kiss-pm/web build`: passed after review fixes, exit 0.
- `docker compose up -d postgres`: failed, exit 1, Docker daemon/pipe unavailable: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
- `pnpm vitest run --config vitest.db.config.ts packages/persistence/src/projectWorkRepository.db.test.ts apps/api/src/projectWorkRoutes.db.test.ts`: blocked after Docker failure, exit 1, `connect ECONNREFUSED 127.0.0.1:55432`.
- `pnpm test:e2e:smoke`: blocked after Docker failure, exit 1, migration cannot connect to `127.0.0.1:55432`.

Quality review notes:

- Bug Hunt: found style health-budget regression through `pnpm test`; fixed by removing one-off CSS.
- Code Review: found three Important issues: missing transition graph, Project Detail/API participant mismatch, My Work fake actions for non-transition roles. All were fixed.
- Security Review: found two Important issues: enum-any transitions and stale beforeState/active-project precondition outside write transaction. Both were fixed. Minor negative-edge coverage was added.
- Security Review repeat: found remaining Important audit issue because participant authorization was recorded as synthetic permission `task.role`. Fixed by recording `authorizationBasis: task_participant_role`, `participantRole`, and `permission: null` for participant-path transitions.
- Security Review final repeat: clean, no remaining Critical/Important findings. `tenant.projects.manage` remains the only permission key for manager-path authorization; participant authorization is represented as contextual role metadata, not a synthetic permission.
- Follow-up blocker: DB/e2e verification requires Docker/Postgres to be running on local port `55432`.
