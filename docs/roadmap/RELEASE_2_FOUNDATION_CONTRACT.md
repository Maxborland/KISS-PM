# Release 2 Foundation Contract

Updated: 2026-05-17

## 1. Purpose

This document is the finite planning contract for starting Release 2 from the accepted Phase 0-12 baseline.

It merges the actionable findings from `docs/roadmap/RELEASE_2_PLANNING_AUDIT.md` into the main Release 2 implementation planning surface. The audit remains supporting evidence; this contract is the operational source for the next Release 2 planning and implementation tasks.

Release 2 product implementation must not start until a promoted task points to a closed section in this contract or a narrower follow-up contract.

## 2. Current Baseline

Current baseline:

- local branch at planning time: `master`
- accepted Phase 12 gate commit: `0940de2 Close P12 market release exit gate`
- Release 2 planning-surface commit: `fed0a22 Prepare Release 2 planning surface`
- remote status at audit time: no git remote was configured, so no remote main/master fetch or pull target existed
- Release 2 implementation status: not started

Accepted Phase 0-12 evidence available for Release 2 planning:

- strict phase matrices P3-P12 passed during the P12 exit gate;
- P12 E2E-110..115 passed;
- P3-P11 release-path E2E and strict matrix sweep passed during P12 exit verification;
- tenant isolation, backend authorization, action/audit evidence, reload persistence, fixture reset, mocked external-service operation, and deterministic critical journey evidence exist in the baseline.

Not completed by P12 and not assumed complete for Release 2:

- real cloud account provisioning;
- production credentials;
- payment/billing setup;
- external security certification;
- live production database backup execution;
- broad enterprise/operator maturity beyond the deterministic P12 smoke surfaces.

These are future operational/enterprise candidates, not hidden accepted baseline.

## 3. Scope

This foundation contract authorizes planning and later promotion of the first Release 2 implementation slice.

In scope for this contract:

- first-slice sequencing;
- Release 2 matrix/verifier policy;
- Release 2 E2E truth contour;
- write-scope and forbidden-scope rules for first implementation blocks;
- evidence requirements for permissions, audit, readback, reload, and cleanup;
- preservation of all candidate functionality from `RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md`;
- promotion rules for turning candidate tasks into runnable agent-bus tasks.

Out of scope for this contract:

- product code under `apps/**` or `packages/**`;
- executable E2E implementation;
- dependency installation;
- live infrastructure provisioning;
- production credentials or payment setup;
- deleting, shrinking, or silently dropping planned Release 2 functionality.

## 4. First Slice Decision

Default first Release 2 slice: foundation/security-first.

Use this default unless product leadership records stronger customer, commercial, or security evidence for a different first slice.

The foundation/security-first slice should include these candidate tasks as the first promotion pool:

| Candidate | Reason |
| --- | --- |
| `R2-ACT-001` governed command and audit contract hardening | All state-changing Release 2 work depends on consistent authorization, preview, execution, audit, and projection-refresh semantics. |
| `R2-DATA-001` versioned data migration protocol | Tenant configuration and operational depth must not corrupt active runtime data or historical interpretation. |
| `R2-TEN-001` configuration lifecycle core | Tenant customization maturity requires draft, validate, activate, archive, restore, and version behavior through governed commands. |
| `R2-TEN-004` impacted-object preview and migration planning | Risky configuration activation must show affected active objects before mutation. |
| `R2-SEC-001` API key scopes, expiry, rotation, last-used, and revocation audit | Production trust should harden before broad feature expansion. |
| `R2-PERF-001` large portfolio fixture and performance budgets | Scale risks need deterministic budgets before deeper UI/projection work. |
| `R2-SCH-001` calendar model and non-working time | First product-depth candidate after foundation, unless product leadership selects another depth track. |

This is sequencing, not deletion. All other Release 2 candidate tasks remain planned future functionality.

## 5. Matrix And Verifier Policy

Release 2 must not reuse P3-P12 phase matrices as proof of new Release 2 behavior.

Before the first implementation candidate is promoted:

- create a Release 2 matrix or per-slice matrix with explicit rows for the selected scope;
- add verifier support if the current verifier cannot validate the new matrix shape;
- require fresh evidence per row;
- keep non-selected candidate tasks out of verified rows;
- keep future candidates referenced as planned scope, not blocked rows, unless the selected slice depends on them.

Verifier must fail on:

- missing required rows from the selected contract;
- verified rows without tests/evidence;
- missing command, exit code, test path, or checked timestamp for required evidence;
- stale evidence;
- verified row with blocker;
- blocked row with placeholder or stale blocker;
- phase/slice exit row verified while required rows are blocked;
- missing permissions, audit, readback, reload, or cleanup evidence for write-flow rows;
- E2E path mismatch for user-facing or state-changing rows.

## 6. E2E Truth Contour

Release 2 E2E ids are defined as candidate gates in `RELEASE_2_DEPTH_HARDENING.md`. The first implementation slice must choose the subset it owns and define exact test paths before code work starts.

Default first-slice E2E contour:

- `R2-E2E-011`: governed command records authorization, preconditions, dry-run when required, execution result, audit, and refreshed projection.
- `R2-E2E-012`: failed or unauthorized command does not mutate business state and leaves auditable denial or validation result.
- `R2-E2E-013`: API key is scoped, expiring, auditable, revocable, and blocked after revocation.
- `R2-E2E-016`: large seeded portfolio remains usable within documented budgets.
- `R2-E2E-018`: versioned data migration previews affected objects, executes, reports reconciliation counts, and preserves historical interpretation.

If the first slice includes tenant configuration lifecycle, it must also own:

- `R2-E2E-003`: tenant admin edits an operational taxonomy in draft, previews affected active objects, activates it, and sees stable runtime behavior after reload.
- `R2-E2E-004`: invalid tenant configuration is rejected with actionable blockers and previous active configuration remains in force.
- `R2-E2E-005`: tenant A cannot read, import, export, search, or mutate tenant B configuration or configuration-derived runtime data.

For every state-changing E2E:

1. User sees starting state.
2. Authorized user executes action.
3. Unauthorized or out-of-tenant user is denied through backend and UI behavior where applicable.
4. UI shows result.
5. API/domain state changed correctly.
6. Audit/action log exists.
7. Related projection refreshes.
8. Reload preserves state.
9. Cleanup/reset readback proves deterministic reset.

No toast-only, UI-only, backend-only, skipped, or flaky proof is acceptable for accepted Release 2 write-flow rows.

## 7. Promotion Rules

Before any candidate from the implementation decomposition becomes runnable, the lead must record:

- exact contract section authorizing the scope;
- source docs read before implementation;
- write scope and forbidden paths;
- deterministic fixtures and tenant data;
- unit, integration, E2E, lint, typecheck, and matrix commands;
- permission, audit, readback, reload, and cleanup assertions;
- rollback, retry, or roll-forward behavior if data shape changes;
- pilot decision record if entry gates are narrowed;
- acceptance criteria and final report format.

Candidate task promotion must add the task to `.agent-bus/queue.json` only after the scope is finite and verifiable.

## 8. First Implementation Task Recommendation

Recommended next runnable implementation-planning task after this contract:

```txt
R2-ACT-001-governed-command-audit-contract-hardening
```

Recommended initial scope:

- inventory existing P3-P12 governed command shapes;
- define common command DTO/result/audit/projection-refresh contract;
- define dry-run and apply semantics;
- define denial/validation diagnostics;
- define cross-surface action correlation requirements;
- write focused package/API tests for the shared contract;
- do not migrate every existing phase surface in the first commit unless the contract explicitly selects that migration.

Recommended forbidden scope:

- broad UI redesign;
- replacing P3-P12 behavior without compatibility tests;
- live infrastructure or secrets;
- deleting future Release 2 candidate functionality.

## 9. Exit Gate For This Foundation Contract

This planning contract is accepted when:

- audit findings are represented in the main Release 2 planning docs;
- the first slice decision is explicit;
- matrix/verifier policy is explicit;
- E2E truth contour is explicit;
- future planned functionality remains preserved;
- `.agent-bus/queue.json` points to the next runnable Release 2 task;
- agent-bus guard and `git diff --check` pass.
