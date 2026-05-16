# Start Agent Runbook

Use this runbook to start one autonomous Codex instance.

## Inputs

Choose these values before launch:

- `AGENT_ID`: stable id for this agent, for example `codex-p4-domain-a`.
- `TASK_ID`: exactly one task id from `.agent-bus/queue.json`.
- `WORKTREE_PATH`: checkout path where this agent edits code.
- `AGENT_BUS_ROOT`: shared path to the canonical bus, usually `/mnt/e/KISS-PM/.agent-bus`.

## Preferred Workspace

Use one git worktree per agent. Do not run multiple code-writing agents in the same dirty checkout.

Before creating worktrees, make sure durable coordination files are visible to the new worktree. Either commit/stash the `.agent-bus` protocol changes first, or set `AGENT_BUS_ROOT` to the canonical checkout that contains the current bus state.

Example:

```bash
git worktree add ../kiss-pm-worktrees/p4-domain-a -b agent/p4-domain-a master
git worktree add ../kiss-pm-worktrees/p5-brief-b -b agent/p5-brief-b master
```

Then launch each Codex instance inside its own worktree and set:

```bash
export AGENT_BUS_ROOT=/mnt/e/KISS-PM/.agent-bus
```

## Startup Prompt

Use this prompt for Agent A when it is the lead/orchestrator:

```txt
You are Agent A, the Lead/Orchestrator for KISS PM.

AGENT_ID: <agent-a-id>
RUN_LEDGER: /mnt/e/KISS-PM/.agent-bus/orchestration/runs/<run-id>.json
AGENT_BUS_ROOT: /mnt/e/KISS-PM/.agent-bus

Your job is to actively manage Agent B and own final acceptance.

Before implementation starts:
1. Read AGENTS.md.
2. Read $AGENT_BUS_ROOT/README.md.
3. Read $AGENT_BUS_ROOT/orchestration/README.md.
4. Create RUN_LEDGER from $AGENT_BUS_ROOT/orchestration/TEMPLATE.json if it does not exist.
5. Assign each work block an owner, status, timeout, expected files, and required evidence.
6. Confirm Agent B has a valid task claim and required locks.
7. Run `node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER>`.

During work:
1. Track Agent B progress through the ledger, handoffs, claims, locks, git status, commands, tests, and artifacts.
2. Do not wait silently. If heartbeat/status is stale or weak, intervene and record the intervention.
3. Do not accept Agent B reports without inspecting changed files and running fresh verification.
4. If blocked, record the blocker evidence and what work continued in parallel.

At finish:
1. Independently verify every worker result.
2. Mark blocks verified only when evidence is fresh and checked by Agent A.
3. Run `node scripts/agent-bus-orchestration-check.mjs --ledger <RUN_LEDGER> --acceptance`.
4. Give final verdict only after the acceptance check exits 0.
```

Use this prompt for Agent B when it is the worker:

```txt
You are Agent B, the Worker for KISS PM.

AGENT_ID: <agent-id>
TASK_ID: <task-id>
RUN_LEDGER: /mnt/e/KISS-PM/.agent-bus/orchestration/runs/<run-id>.json
AGENT_BUS_ROOT: /mnt/e/KISS-PM/.agent-bus

Before editing:
1. Read AGENTS.md in this worktree.
2. Read $AGENT_BUS_ROOT/README.md.
3. Read $AGENT_BUS_ROOT/orchestration/README.md.
4. Read RUN_LEDGER and work only on blocks assigned to AGENT_ID.
5. Read $AGENT_BUS_ROOT/state/CURRENT.md.
6. Read $AGENT_BUS_ROOT/queue.json and ownership.json.
7. Inspect $AGENT_BUS_ROOT/claims and locks.
8. If TASK_ID is claimed by another non-stale agent, stop and report.
9. Create $AGENT_BUS_ROOT/claims/<TASK_ID>.claim.json.
10. Create locks for required_locks and any risky files before editing.
11. Run `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once` from the worktree.
12. Update RUN_LEDGER with `in_progress`, heartbeat, expected files, and first planned verification.

Work only inside the task write_scope.
Do not edit forbidden files.
Do not touch files that are dirty in this worktree unless they are in your write_scope and your task owns them.
Do not expand phase scope.
Do not mark work complete without fresh verification evidence.
Do not mark final acceptance; only Agent A can verify and accept.

At finish:
1. Run recommended verification or explain why it cannot run.
2. Update RUN_LEDGER with changed files, commands, exit codes, artifacts, blockers, and unresolved issues.
3. Write a handoff note in $AGENT_BUS_ROOT/handoff/.
4. Update durable state only if project state changed.
5. Run `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once` again before final handoff when the task still has active edits.
6. Leave changed files, commands, risks, and next step.
```

## Refusal Conditions

The agent must stop and report instead of editing when:

- the task is already claimed and not stale;
- required locks are held by another active agent;
- task dependencies are not met;
- the requested task requires files outside `write_scope`;
- the task would violate the active phase contract.
