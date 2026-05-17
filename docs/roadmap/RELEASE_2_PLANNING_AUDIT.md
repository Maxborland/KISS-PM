# Release 2 Planning Audit

Updated: 2026-05-17

## Purpose

Prepare the planning surface for Release 2 without starting Release 2 product implementation.

This audit checks whether the restored Release 2 roadmap and implementation decomposition align with the accepted Phase 12 baseline and the KISS PM source-of-truth documents.

## Sources Read

- `AGENTS.md`
- `.agent-bus/README.md`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/queue.json`
- `.agent-bus/ownership.json`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/backlog/FUTURE_SCOPE.md`
- `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md`
- `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md`

## Repository Baseline

Current local baseline:

- branch: `master`
- latest accepted release-gate commit: `0940de2 Close P12 market release exit gate`
- remote: no git remote is configured in this checkout, so there is no fetch/pull target to update local `master`
- Release 2 product implementation: not started by this audit

The current repository state says Phase 12 is accepted as the repository-defined market-release gate. This is the correct starting point for Release 2 planning.

## Restored Planning Surface

The Release 2 roadmap/decomposition documents were not present in the current working tree and were restored from prior checkpoint history:

- `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md`
- `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md`

They are valid as planning inputs because they preserve the KISS PM direction:

- Release 2 deepens Phase 0-12 instead of replacing it.
- Control surfaces remain governed management instruments, not passive reports.
- State-changing work still requires UI/API/domain readback, backend permission checks, audit, reload persistence, and cleanup/reset evidence.
- Candidate work stays blocked until promoted through a finite Release 2 detail document.

## Alignment Findings

### Finding 1: Release 2 docs align with P12 accepted baseline

The roadmap assumes Release 2 begins after the Phase 0-12 market-readiness loop is accepted. That condition is now true for the repository-defined gate.

No change required except adding the current baseline status so future agents do not treat the roadmap as pre-P12.

### Finding 2: Release 2 still needs a closed contract before implementation

The decomposition is intentionally a backlog, not a runnable implementation plan. This still matches `AGENTS.md` phase discipline: no product phase starts without a finite contract, fixtures, E2E scenarios, matrix/verifier behavior, and exit gate.

Recommended next task: `R2-FND-000 Release 2 foundation contract`.

### Finding 3: First Release 2 slice should harden foundations before broad feature expansion

The planning docs already recommend starting from production risk rather than impressive feature depth. With no stronger customer evidence in the current repo, the best first finite slice is:

- `R2-ACT-001` governed command and audit contract hardening
- `R2-DATA-001` versioned data migration protocol
- `R2-TEN-001` configuration lifecycle core
- `R2-TEN-004` impacted-object preview and migration planning
- `R2-SEC-001` API key scopes, expiry, rotation, last-used, and revocation audit
- `R2-PERF-001` large portfolio fixture and performance budgets
- `R2-SCH-001` calendar model and non-working time as the first product-depth candidate after the foundation contract, unless product leadership selects a different priority

This does not remove or downgrade any planned functionality. It only sequences the first safe implementation surface.

### Finding 4: P12 market-release gate is not live production deployment

P12 explicitly excludes real cloud account provisioning, production credentials, payment setup, external security certification, and live production database backup execution.

Release 2 planning must keep those as future operational/enterprise candidates, especially under `R2-SEC` and `R2-ENT`.

### Finding 5: Future scope needs explicit Release 2 routing

`docs/backlog/FUTURE_SCOPE.md` only recorded the TanStack server-state follow-up. It should also point to the Release 2 roadmap and clarify that R2 candidates remain planned until promoted.

## Recommended Next Runnable Task

Create:

```txt
R2-FND-000-release2-foundation-contract
```

Recommended write scope:

- `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md`
- `docs/status/release2-foundation-requirements-matrix.json`
- verifier support if a new matrix shape is introduced
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/**`

Recommended non-scope:

- product code under `apps/**` and `packages/**`
- E2E implementation beyond defining future gates
- production credentials or live infrastructure changes
- deleting any Release 2 candidate functionality

Recommended acceptance:

- closed Release 2 foundation contract exists;
- first implementation slice is chosen or explicitly deferred with decision owner;
- R2 matrix/verifier policy is defined;
- R2 E2E truth contour is defined;
- no P0-P12 baseline evidence is weakened;
- agent-bus queue has exactly one next runnable R2 task.

## Worktree Recommendation

After this planning-surface commit, create a Release 2 branch/worktree from local `master`, for example:

```bash
git worktree add ../kiss-pm-worktrees/release2-foundation -b release2/foundation-contract
```

Because this checkout has no configured remote, this branch would be based on local `master`. If a remote is later added, fetch/rebase policy should be decided before implementation begins.
