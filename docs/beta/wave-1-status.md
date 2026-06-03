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
| Fast PR gate | done | `pnpm qa:fast` standardizes local CI-equivalent without Storybook/VRT; green on last verified runtime base `d12b838` |
| Product screenshot harness | done | `pnpm qa:screenshots -- --routes /dashboard,/my-work` generated desktop+narrow artifacts for dashboard and My Work; manifest `test-results/beta-runtime-screenshots-manifest.json` allPass=true |
| GitHub CI billing/local artifact policy | done | `docs/beta/local-artifact-policy.md`; GitHub jobs with `steps: []`/no runner are infra failures, not product test failures; local relevant gate is SSSOT while CI does not start |
| Current integration base | done | Clean beta work starts from `origin/design-v3`; dirty root is not used as the beta base |

## PR #73 mapping

Decision: PR #73 is merged and accepted as the My Work task-status action slice. It covers:

- My Work task status read-model via `/api/workspace/task-statuses`;
- runtime status move through `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`;
- regression proof that My Work does not fall back to full `/api/workspace/tasks/:taskId` update.
- role-gated DnD: `approver`/`observer` cards are not draggable unless the user has `tenant.projects.manage`.

It was originally limited to status actions. Later separate My Work slices added runtime proof for:

- owner update;
- due date update;
- comment action;
- blocker gap UX without fake mutation.

Remaining My Work follow-up: forbidden/read-only proof.

## Remote CI rule for Wave 1

GitHub CI red from billing/spending-limit with `steps: []` is not treated as product/test failure. Code review blockers still must be resolved. While GitHub jobs do not start with real steps, the local matching gate is SSSOT for beta PR merge decisions.

## Latest local gate

Command: `pnpm qa:fast`

Result on current `origin/design-v3` `846434f`: pass.

Coverage summary:

- seed check: 3 clients, 5 deals, 5 projects, 27 tasks, 6 users, 36 audit events;
- beta seed includes overload, missing-role demand, overdue/waiting tasks and deal next-action coverage;
- API unit tests: 120 passed, 1 skipped;
- web unit tests: 391 passed;
- runtime smoke: 15 beta routes opened without blank/error states.

## Latest screenshot evidence

Command: `pnpm db:migrate && pnpm db:seed:dev && pnpm qa:screenshots -- --routes /dashboard,/my-work`

Result on `origin/design-v3` `d4aaae4`: pass. Manifest: `test-results/beta-runtime-screenshots-manifest.json`.

Artifacts:

- `/dashboard` desktop: `runtime-dashboard-desktop.png`, 967127 bytes;
- `/dashboard` narrow: `runtime-dashboard-narrow.png`, 759607 bytes;
- `/my-work` desktop: `runtime-my-work-desktop.png`, 122166 bytes;
- `/my-work` narrow: `runtime-my-work-narrow.png`, 479305 bytes.

Known environment note: local Next dev could not download Google Fonts and used fallback fonts; this is infra/network noise, not a route failure.

## Wave 1 exit

Wave 1 foundation is complete on current `origin/design-v3` `846434f` with fresh `pnpm qa:fast` evidence.

Next work continues in PR-sized slices from clean `origin/design-v3`:

- My Work: status/owner/due/comment actions and blocker gap UX are runtime-proven; next My Work slice is forbidden/read-only proof.
- Project detail: create task, owner/due/comment, blocker/activity proof.
- Timeline/resources: move from read-only runtime foundations toward interaction/proof slices.
- Agent: grounded context and confirmation/audit hardening after task/deal/project contracts stabilize.
