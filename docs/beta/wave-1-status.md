# KISS PM: Wave 1 foundation status

## План

Source of record: `docs/beta/kiss-pm-beta-plan.md`, Wave 1.

Wave 1 цель: создать clean beta foundation, чтобы дальнейшие slices проверялись локально и не тащили demo/prototype routes в runtime beta.

## Статус задач

| Задача | Статус | Evidence |
| --- | --- | --- |
| Clean beta integration base | done | Worktrees создаются от `origin/design-v3`; dirty root не используется для разработки |
| PR #73 My Work review mapping | done | PR #73 maps to My Work status action slice; leaves owner/due/comment/blocker follow-ups |
| Runtime route inventory / beta allowlist | done in PR #74 | `/dashboard`, `/my-work`, `/agent`, `/projects`, `/deals`; non-beta runtime routes disabled instead of fixture fallback |
| Beta seed/reset | done in PR #75 | `pnpm db:reset:dev`, `pnpm db:seed:check`, API smoke over clients/deals/projects/my-work/operations-cockpit/audit |
| Fast PR gate | current slice | `pnpm qa:fast` standardizes local CI-equivalent without Storybook/VRT |
| GitHub CI billing/local artifact policy | current slice | `docs/beta/local-artifact-policy.md` |

## PR #73 mapping

Decision: keep PR #73 as useful My Work task-status action slice after review acceptance. It covers:

- My Work task status read-model via `/api/workspace/task-statuses`;
- runtime status move through `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`;
- regression proof that My Work does not fall back to full `/api/workspace/tasks/:taskId` update.

It does not cover:

- owner update;
- due date update;
- comment action;
- blocker mutation.

These remain separate My Work slices.

## Remote CI rule for Wave 1

GitHub CI red from billing/spending-limit is documented and not treated as product/test failure. Code review threads still must be resolved. Local matching gate must be green before considering merge/override.
