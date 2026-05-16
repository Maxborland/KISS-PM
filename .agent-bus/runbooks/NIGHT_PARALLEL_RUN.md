# Night Parallel Run

Use this when starting Agent A as lead/orchestrator and Agent B as worker.

## Operating Model

Agent A is the lead. Agent B is the worker. The lead is not a passive monitor: it owns the run ledger, progress checks, interventions, verification, and the final verdict.

Recommended split while Phase 4 is active:

```txt
Agent A: orchestration and acceptance, plus small non-overlapping verification/doc work
Agent B: one bounded implementation or docs/planning task
```

Do not run two agents that both edit `packages/project-core/**`, `packages/workflow-engine/**`, `docs/status/**`, package manifests, or global configs.

## Preflight

Run:

```bash
node scripts/agent-bus-status.mjs
node scripts/agent-bus-status.mjs --check
node scripts/agent-bus-guard.mjs --task <TASK_ID_FOR_AGENT_A> --once
node scripts/agent-bus-guard.mjs --task <TASK_ID_FOR_AGENT_B> --once
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json
git status --short
find .agent-bus/claims -maxdepth 1 -type f -print
find .agent-bus/locks -maxdepth 2 -type f -print
```

Check:

- each agent has a different `TASK_ID`;
- tasks are `runnable` or intentionally active for that owner;
- write scopes do not overlap;
- required locks are free or owned by the intended agent;
- worktrees are separate.
- durable `.agent-bus` files are committed or every agent has `AGENT_BUS_ROOT` pointed at the canonical checkout.
- a shared run ledger exists and every work block has owner/status/timeout/evidence expectations.

## Shared Ledger

Create one ledger before starting Agent B:

```bash
cp .agent-bus/orchestration/TEMPLATE.json .agent-bus/orchestration/runs/<run-id>.json
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json
```

Fill in:

- objective;
- lead and worker ids;
- worktrees;
- task ids;
- work blocks;
- gates;
- timeout policy.

## Worktree Layout

Example:

```bash
git worktree add ../kiss-pm-worktrees/agent-a -b agent/p4-domain-a master
git worktree add ../kiss-pm-worktrees/agent-b -b agent/p5-docs-b master
```

Both agents should use the same shared bus:

```bash
export AGENT_BUS_ROOT=/mnt/e/KISS-PM/.agent-bus
```

Agent A must actively poll Agent B through the shared ledger and workspace evidence. Use guard processes only as supporting checks:

```bash
node scripts/agent-bus-guard.mjs --task <TASK_ID_FOR_AGENT_A> --watch --interval 60
node scripts/agent-bus-guard.mjs --task <TASK_ID_FOR_AGENT_B> --watch --interval 60
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json
```

Timeouts require action. Agent A must update the ledger with one of: clarification sent, task narrowed, work reassigned, takeover started, subagent assigned, block failed, or parallel block started.

## Morning Integration

1. Read latest files in `.agent-bus/handoff/`.
2. Run `node scripts/agent-bus-status.mjs`.
3. In each worktree, run `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once`.
4. Run `node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json`.
5. Inspect each worktree with `git status --short`.
6. Agent A reviews Agent B changed files and artifacts.
7. Integrate one agent branch at a time.
8. After each integration, run targeted tests.
9. After all integrations, run broader checks:

```bash
npm run typecheck
npm run lint
npm test
```

Run phase E2E only when product flows changed and fixtures/API/UI are ready.

Before final verdict:

```bash
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json --acceptance
```

## Stop Conditions

Do not integrate an agent branch when:

- it edited files outside its write scope;
- it changed locked files without owning the lock;
- it skipped required verification without explanation;
- it changed phase scope or matrix evidence incorrectly;
- another branch must land first.
