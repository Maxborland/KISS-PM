# Integrate Agent Work

Use this runbook when combining work from multiple agents.

## Integration Order

1. Coordination/protocol changes.
2. Domain contracts.
3. API/application services.
4. Fixtures.
5. UI.
6. E2E and matrix evidence.
7. Future-phase docs.

Do not integrate UI/E2E before the domain/API contract they depend on is stable.

## Checklist

- [ ] Read the shared run ledger under `.agent-bus/orchestration/runs/`.
- [ ] Run `node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER>`.
- [ ] Read agent handoff.
- [ ] Check claim and locks.
- [ ] Inspect changed files.
- [ ] Confirm edits stayed inside write scope.
- [ ] Run targeted tests listed in handoff.
- [ ] Run broader tests if shared contracts changed.
- [ ] Agent A marks blocks `verified` only after independent fresh verification.
- [ ] Run `node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER> --acceptance` before final verdict.
- [ ] Update `.agent-bus/state/CURRENT.md` if project state changed.
- [ ] Move or update task records when useful.
- [ ] Remove stale locks only after confirming ownership or abandonment.

## Commands

```bash
git status --short
git diff --stat
node scripts/agent-bus-status.mjs
node scripts/agent-bus-guard.mjs --task <TASK_ID> --once
node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER>
node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER> --acceptance
npm run typecheck
npm run lint
npm test
```

Use narrower commands first when integrating a small task.
