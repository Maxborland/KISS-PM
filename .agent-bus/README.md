# Agent Bus

`.agent-bus/` is the project-local coordination and memory layer for concurrent Codex agents working in this repository.

It is intentionally simple: Markdown for human-readable state, JSON templates for machine-readable claims, JSONL for append-only runtime events, and lock directories for risky shared files. It is not a server, database, daemon, or external memory service.

## Why It Exists

Codex sessions do not share memory directly. This directory gives agents a durable local protocol for understanding:

- what KISS PM is;
- what the current objective and phase are;
- which tasks exist;
- which task is claimed by which agent;
- which files are risky to edit concurrently;
- which decisions were already made;
- what changed in previous sessions;
- what the next agent should do.

## What To Read First

Every agent must read these files before editing project files:

1. `AGENTS.md`
2. `.agent-bus/README.md`
3. `.agent-bus/state/CURRENT.md`
4. `.agent-bus/state/RISKS.md`
5. `.agent-bus/tasks/`
6. `.agent-bus/claims/`
7. `.agent-bus/locks/`
8. the relevant project source-of-truth docs under `docs/`

## Directory Map

```txt
.agent-bus/
  README.md
  queue.json              # Machine-readable task queue and dependencies.
  ownership.json          # Machine-readable file ownership and parallelism map.
  orchestration/          # Lead/Worker run ledger templates and runtime ledgers.
  runbooks/               # Operational instructions for starting/integrating agents.
  state/                 # Long-lived project memory, committed.
  tasks/                 # Task templates and task records, committed.
  claims/                # Runtime task claims, ignored except templates/.gitkeep.
  sessions/              # Runtime session notes, ignored except .gitkeep.
  handoff/               # Handoff notes and template.
  locks/                 # Runtime risky-file locks, ignored except .gitkeep.
  events/                # Runtime JSONL events, ignored except .gitkeep.
  artifacts/             # Plans/audits committed; test outputs/screenshots ignored.
  scratch/               # Runtime scratch space, ignored except .gitkeep.
```

## Long-Lived Files

Commit these files:

- `.agent-bus/README.md`
- `.agent-bus/state/*`
- `.agent-bus/queue.json`
- `.agent-bus/ownership.json`
- `.agent-bus/orchestration/README.md`
- `.agent-bus/orchestration/TEMPLATE.json`
- `.agent-bus/orchestration/runs/.gitkeep`
- `.agent-bus/runbooks/*`
- `.agent-bus/tasks/TEMPLATE.md`
- `.agent-bus/tasks/backlog/*`
- `.agent-bus/tasks/active/*`, `.agent-bus/tasks/blocked/*`, `.agent-bus/tasks/done/*` when task records should be preserved
- `.agent-bus/handoff/TEMPLATE.md`
- `.agent-bus/artifacts/plans/*`
- `.agent-bus/artifacts/audits/*`
- `.agent-bus/claims/EXAMPLE.claim.json.template`
- `.gitkeep` files needed to preserve empty directories

## Runtime-Only Files

These are local coordination files and are ignored by git:

- `.agent-bus/sessions/*`
- `.agent-bus/claims/*.claim.json`
- `.agent-bus/locks/*`
- `.agent-bus/scratch/*`
- `.agent-bus/events/*.jsonl`
- `.agent-bus/orchestration/runs/*`
- `.agent-bus/artifacts/test-results/*`
- `.agent-bus/artifacts/screenshots/*`

Runtime files may be copied into a handoff note when the information should become durable.

## Task Claiming

Before editing project files, claim exactly one task.

1. Pick a `runnable` task from `.agent-bus/queue.json`, or a task from `.agent-bus/tasks/backlog/` when it is not yet represented in the queue.
2. Inspect `.agent-bus/claims/` for an existing claim with the same task id.
3. If there is no active claim, create `.agent-bus/claims/<task-id>.claim.json` using `.agent-bus/claims/EXAMPLE.claim.json.template`.
4. Set `claimed_by`, `claimed_at`, `heartbeat_at`, `branch`, `expected_files`, and `notes`.
5. Keep `heartbeat_at` current during long work.
6. Do not work on an already claimed task unless the claim is stale or explicitly abandoned.

Claim file names must match task ids. Example:

```txt
.agent-bus/tasks/backlog/0001-verify-agent-bus.md
.agent-bus/claims/0001-verify-agent-bus.claim.json
```

A claim is stale when `heartbeat_at` is older than 4 hours and no matching session, lock, handoff, or repository activity indicates the owner is still working. A takeover must be documented in a handoff note.

## Queue And Ownership

`.agent-bus/queue.json` is the machine-readable task queue. It records task status, dependencies, allowed write scope, forbidden files, required locks, and recommended verification commands.

`.agent-bus/ownership.json` maps repository paths to ownership groups and parallelism rules. Use it to decide whether two agents can safely run together.

General rule:

```txt
parallel is allowed only when write_scope sets do not overlap
  and no agent needs another agent's locked files
  and all task dependencies are satisfied
```

Use `node scripts/agent-bus-status.mjs` for a quick local view of queue, claims, locks, handoffs, and git status.

Use `node scripts/agent-bus-guard.mjs --task <TASK_ID> --once` as the mandatory machine guard before editing and before handoff. It runs the task-scoped consistency checks, writes a pass/fail event to `.agent-bus/events/events.jsonl`, and exits nonzero when the selected task is not safe to continue.

For unattended monitoring, run:

```bash
node scripts/agent-bus-guard.mjs --task <TASK_ID> --watch --interval 60
```

The watch process is local supervision only. It does not fix problems; it records them and prints the first blocking reason.

## Lead/Worker Orchestration

Two-agent runs must use the Lead/Worker model in `.agent-bus/orchestration/README.md`.

Agent A is the lead/orchestrator. Agent B is the worker. The lead owns decomposition, tracking, intervention, verification, and final acceptance. The worker owns assigned work blocks and evidence collection.

Each coordinated run uses one shared ledger:

```txt
.agent-bus/orchestration/runs/<run-id>.json
```

Create it from `.agent-bus/orchestration/TEMPLATE.json`. Runtime run ledgers are ignored by git, but handoff notes must preserve durable conclusions and evidence summaries.

Check run health:

```bash
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json
```

Check final lead acceptance:

```bash
node scripts/agent-bus-orchestration-check.mjs --ledger .agent-bus/orchestration/runs/<run-id>.json --acceptance
```

The lead cannot accept a run when any work block is unverified, any blocker lacks evidence and a parallel action, any heartbeat timeout lacks an action, or final verdict evidence is missing.

## Lock Files

Locks protect risky shared files from concurrent edits.

Risky files include:

- `AGENTS.md`
- `.gitignore`
- `package.json` and package lockfiles
- workspace package manifests
- database schemas and migrations
- global configs such as TypeScript, ESLint, Vite, Playwright, CI
- `docs/status/*`
- `.agent-bus/state/*`
- phase contracts under `docs/phases/`

Prefer atomic directory creation:

```bash
mkdir .agent-bus/locks/AGENTS.md.lock
```

Then add an owner file inside the lock directory:

```txt
.agent-bus/locks/AGENTS.md.lock/owner.json
```

The owner file should include agent id, task id, locked paths, timestamp, and reason. Remove only your own locks when finished.

## Handoff Notes

Use `.agent-bus/handoff/TEMPLATE.md` for handoff notes.

Write a handoff note when:

- a task completes;
- a task is blocked;
- a stale claim is taken over;
- risky files were edited;
- verification failed or could not be run;
- another agent needs clear next steps.

Handoff notes should be concise, factual, and evidence-based.

## Event Log

Runtime events go to `.agent-bus/events/events.jsonl`. This file is ignored because it can be noisy and session-local.

Use one JSON object per line. Suggested event fields:

```json
{"ts":"2026-05-15T00:00:00Z","agent":"codex-unknown","event":"claim_created","task_id":"0001-verify-agent-bus","details":"Claimed task for verification"}
```

Events are useful for local coordination, but durable conclusions belong in task files, state files, decisions, or handoff notes.

## Updating State

Update `.agent-bus/state/CURRENT.md` when:

- the active phase changes;
- a phase gate state changes;
- active or blocked work changes;
- next recommended steps change;
- testing expectations change;
- important constraints change.

Record stable architecture decisions in `.agent-bus/state/DECISIONS.md` or project ADRs under `docs/decisions/`.

## Minimal Agent Loop

```txt
read protocol
  -> read queue and ownership
  -> inspect tasks/claims/locks
  -> create or update Lead/Worker ledger when using two agents
  -> create session note
  -> claim one task
  -> lock risky files if needed
  -> implement narrowly
  -> verify with evidence
  -> update task/state/handoff/events
  -> remove own locks
```
