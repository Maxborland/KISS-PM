# KISS PM: Wave 1 foundation status

## План

Source of record: `docs/beta/kiss-pm-beta-plan.md`, Wave 1.

Wave 1 цель: создать clean beta foundation, чтобы дальнейшие slices проверялись локально и не тащили demo/prototype routes в runtime beta.

## Статус задач

| Задача | Статус | Evidence |
| --- | --- | --- |
| Clean beta integration base | done | Worktrees создаются от `origin/design-v3`; dirty root не используется для разработки |
| PR #73 My Work review mapping | done | PR #73 merged into `design-v3` at `54f0ecf`; maps to MW2 status action slice and leaves owner/due/comment/blocker follow-ups |
| Runtime route inventory / beta allowlist | done in PR #74 | `/dashboard`, `/my-work`, `/agent`, `/projects`, `/deals`; non-beta runtime routes disabled instead of fixture fallback |
| Beta seed/reset | done in PR #75 | `pnpm db:reset:dev`, `pnpm db:seed:check`, API smoke over clients/deals/projects/my-work/operations-cockpit/audit |
| Fast PR gate | done | `pnpm qa:fast` standardizes local CI-equivalent without Storybook/VRT; green on `design-v3` at `ce5c58c` |
| GitHub CI billing/local artifact policy | done | `docs/beta/local-artifact-policy.md`; GitHub jobs with no steps/runner are infra failures, not product test failures |
| Current integration base | done | `origin/design-v3` includes PRs #96, #97, #98, #99 and #73; local `pnpm qa:fast` green after #73 |

## PR #73 mapping

Decision: PR #73 is merged and accepted as the My Work task-status action slice. It covers:

- My Work task status read-model via `/api/workspace/task-statuses`;
- runtime status move through `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`;
- regression proof that My Work does not fall back to full `/api/workspace/tasks/:taskId` update.
- role-gated DnD: `approver`/`observer` cards are not draggable unless the user has `tenant.projects.manage`.

It does not cover:

- owner update;
- due date update;
- comment action;
- blocker mutation.

These remain separate My Work slices.

## Remote CI rule for Wave 1

GitHub CI red from billing/spending-limit is documented and not treated as product/test failure. Code review threads still must be resolved. Local matching gate must be green before considering merge/override.

## Latest local gate

Command: `pnpm qa:fast`

Result on `design-v3` `ce5c58c`: pass.

Result after PR #73 on `design-v3` `54f0ecf`: pass.

Coverage summary:

- seed check: 3 clients, 5 deals, 4 projects, 26 tasks, 6 users, 13 audit events;
- API unit tests: 120 passed, 1 skipped;
- web unit tests: 357 passed;
- runtime smoke: 15 beta routes opened without blank/error states.

## Wave 1 exit

Wave 1 is complete as of `design-v3` `54f0ecf`.

Next work should start Wave 2/3 scoped slices from the same base:

- My Work: owner/due/comment actions; blocker remains a documented gap until backend contract exists.
- Project detail: create task, owner/due/comment, blocker/activity proof.
- Timeline/resources: move from read-only runtime foundations toward interaction/proof slices.
- Agent: grounded context and confirmation/audit hardening after task/deal/project contracts stabilize.
