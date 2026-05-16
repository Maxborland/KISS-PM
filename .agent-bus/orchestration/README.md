# Lead/Worker Orchestration

This directory defines the active two-agent operating model.

The model is not passive monitoring. Agent A is the lead/orchestrator and owns process control, intervention, verification, and the final verdict. Agent B is the worker and owns assigned implementation blocks. Both agents may use subagents only inside the current objective and only with readback plus independent verification by the agent that delegated the work.

## Source Of Truth

Each active coordinated run must have one shared ledger:

```txt
.agent-bus/orchestration/runs/<run-id>.json
```

Create it from `.agent-bus/orchestration/TEMPLATE.json`.

The ledger is the source of truth for:

- objective;
- lead and worker identities;
- task ids and worktrees;
- work blocks;
- owners;
- statuses;
- blockers;
- timeout actions;
- verification evidence;
- lead interventions;
- final verdict.

Oral status is never source of truth. A report from another agent is an input to verify, not acceptance evidence.

## Roles

Agent A, the lead, must:

- create and maintain the run ledger;
- assign exactly scoped work blocks;
- track worker heartbeat, changed files, claims, locks, and test evidence;
- use timeouts to trigger action;
- intervene when worker progress is stale, weak, off-scope, or unverifiable;
- independently inspect artifacts and run fresh verification commands;
- decide final acceptance.

Agent B, the worker, must:

- work only on assigned blocks;
- keep the ledger current;
- provide exact commands, exit codes, artifacts, changed files, and unresolved issues;
- mark a block `blocked` or `failed` instead of inventing success;
- never mark final acceptance.

## Status Values

Every work block and gate uses one status:

- `pending` — assigned but not started.
- `in_progress` — active work with fresh heartbeat.
- `blocked` — cannot proceed; must include reason, evidence, and parallel action taken instead.
- `failed` — attempted and failed; must include evidence and next proposed action.
- `verified` — lead independently verified the result with fresh evidence.

Only the lead can move a work block to `verified`.

## Blocked Requirements

Every `blocked` block must include:

- current reason;
- command, exit code, artifact, or readback proving the blocker;
- what was done in parallel instead of stopping.

If any of those are missing, the run is not healthy.

## Verified Requirements

Every `verified` block must include:

- `verified_by` equal to the lead agent id;
- `verified_at`;
- evidence such as command, exit code, log summary, artifact path, screenshot, readback, or test result.

Worker self-report is not verification.

## Timeout Rule

Timeouts must cause action. If `heartbeat_at` is stale, the ledger must record `timeout_action`, for example:

- lead sent clarification to worker;
- lead narrowed the task;
- lead took over a file slice;
- lead assigned a subagent;
- lead marked the block failed and moved to another parallel block.

## Gates

Use gates for acceptance checks that span blocks:

- claims/locks are valid;
- dirty files are within scope;
- required unit/integration/E2E checks ran or have documented blockers;
- lead reviewed worker diff;
- final Definition of Done is met.

## Commands

Check run health:

```bash
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json
```

Check final acceptance:

```bash
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json --acceptance
```

Final acceptance is valid only when the acceptance command exits 0 and the lead has fresh verification evidence.
