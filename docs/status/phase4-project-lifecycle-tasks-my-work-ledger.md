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
