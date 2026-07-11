# Full Evaluation Reconciliation And Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the current truth matrix for the Full Product Evaluation backlog after master merge, then fix only freshly confirmed open issues.

**Architecture:** Separate status reconciliation from product fixes. First build a machine-readable matrix that maps old audit findings to current master/current-branch evidence; only rows with `confirmed-open` enter fix batches. Verification is browser/API/data evidence per role and per risk area, with subagents used only for independent surfaces.

**Tech Stack:** Markdown/JSON evidence under `docs/qa/full-eval`, PowerShell, pnpm/vitest/typecheck, Browser plugin/Playwright evidence scripts, CodeGraph for source changes.

---

### Task 1: Build Current-Truth Reconciliation Matrix

**Files:**
- Create: `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json`
- Modify: `docs/qa/full-eval/reconciliation-2026-07-07.md`
- Read: `docs/qa/full-eval/bugs.md`
- Read: `docs/qa/full-eval/phase5-outcome.md`
- Read: `docs/qa/full-eval/uiux-loop-2026-07-05/report.md`
- Read: `docs/qa/full-eval/uiux-loop-2026-07-05/findings/*.json`

- [ ] **Step 1: Extract all old finding IDs**

Run:

```powershell
Select-String -Path docs/qa/full-eval/bugs.md,docs/qa/full-eval/bugs/*.md,docs/qa/full-eval/uiux-loop-2026-07-05/findings/*.json -Pattern 'BUG-[A-Z0-9-]+|G[0-9]+-[A-Z0-9-]+' | Select-Object Path, LineNumber, Line
```

Expected: list of old `BUG-*` and `G*-*` findings with source files.

- [ ] **Step 2: Create matrix schema**

Create `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json` with entries shaped exactly like:

```json
{
  "generatedAt": "2026-07-07",
  "branch": "codex/pre-prod-hardening-on-master",
  "statuses": ["fixed-by-master", "fixed-by-current-branch", "confirmed-open", "unverified", "not-a-bug", "superseded"],
  "items": [
    {
      "id": "BUG-ADM-02",
      "source": "docs/qa/full-eval/bugs/admin.md",
      "surface": "/admin/roles",
      "summary": "Saving zero permissions on an assigned role lacked confirmation",
      "masterEvidence": "docs/qa/full-eval/phase5-outcome.md: cluster I says ADM-02 fixed with explicit destructive confirmation",
      "currentBranchEvidence": null,
      "freshEvidence": null,
      "status": "fixed-by-master",
      "nextAction": "Do not fix unless fresh browser recheck fails"
    }
  ]
}
```

- [ ] **Step 3: Populate matrix from master fix reports**

Mark as `fixed-by-master` every finding covered by:

```text
P0, P1, P2, P3 sections in docs/qa/full-eval/uiux-loop-2026-07-05/report.md
Clusters A, B, C, D, E, F, H, I, J, M in docs/qa/full-eval/phase5-outcome.md
```

Expected: old IDs like `BUG-002`, `BUG-PROJ-06`, `BUG-ADM-02`, `G2-01`, `G3-01`, `G4-01`, `G5-01`, `G6-01` are not left as open without a fresh failing evidence row.

- [ ] **Step 4: Populate current-branch fixes**

Mark current branch fixes as `fixed-by-current-branch`:

```text
Admin RBAC/read-only surface
Loopback trusted mutation origins/logout
Project overview live status IDs
Project overview real links instead of demoAction
```

Expected: each has `freshEvidence` from the previous targeted tests/browser checks, and no row claims clean-pass for unrelated surfaces.

- [ ] **Step 5: Mark honest unverified zones**

Mark as `unverified`, not `open`, unless fresh checks fail:

```text
Valid password-reset happy path with real email provider
Real LLM agent proposals and live SSE
LiveKit/Jitsi/media provider real call behavior
Full role × route × action browser traversal after master fixes
Duplicate/race/idempotency matrix for every write-flow
```

Expected: these are visible as audit debt, but not mislabeled as confirmed product bugs.

### Task 2: Re-run Fresh Verification For High-Risk Unverified Zones

**Files:**
- Create: `docs/qa/full-eval/evidence/reconciliation-2026-07-07/`
- Create: `docs/qa/full-eval/reconciliation-runbook-2026-07-07.md`
- Use existing: `docs/qa/full-eval/uiux-loop-2026-07-05/tools/*.mjs`

- [ ] **Step 1: Start clean current-branch stand**

Run current branch web/API against the full-eval Postgres database or a freshly migrated copy. Record exact ports, commit, env vars, and DB in `reconciliation-runbook-2026-07-07.md`.

Expected: one unambiguous stand, no mixed worktree ports.

- [ ] **Step 2: Browser traversal smoke by role**

For each role:

```text
admin@kiss-pm.local
engineer@kiss-pm.local
plan-reader-no-resources@kiss-pm.local
resource-reader@kiss-pm.local
beta@kiss-pm.local
anonymous
```

Traverse:

```text
/login
/register
/password-reset
/
/dashboard
/my-work
/projects
/projects/project-vektor-portal/overview
/projects/project-vektor-portal/schedule
/projects/project-vektor-portal/assignments
/projects/project-vektor-portal/resources
/projects/project-vektor-portal/baseline
/projects/project-vektor-portal/calendars
/projects/project-vektor-portal/scenarios
/projects/project-vektor-portal/commits
/projects/project-vektor-portal/settings
/crm/deals
/crm/clients
/crm/contacts
/crm/products
/communications/channels
/communications/meetings
/communications/calls
/communications/notifications
/admin/users
/admin/roles
/admin/security
/admin/audit
/agent
/profile
/settings
```

Expected: evidence JSON per role with status `pass|fail|forbidden-expected|blocked`, route, screenshot/log path, and notes.

- [ ] **Step 3: Provider behavior verification**

Check:

```text
email provider status and password-reset UX
LLM provider status and agent proposal UX
video provider status and call join UX
```

Expected: if provider is degraded/disabled, UI must clearly say so; if provider is configured, happy path must be verified or marked blocked by env with exact reason.

- [ ] **Step 4: Duplicate/race/idempotency matrix**

For every write-flow identified in inventory, test:

```text
single submit success
double click same button
two concurrent identical API calls
refresh/readback
permission-denied role
invalid payload
stale version/conflict where applicable
```

Expected: each write-flow row has backend status, UI feedback, persisted data/readback, and idempotency/race outcome.

### Task 3: Promote Only Confirmed Failures To Fix Batches

**Files:**
- Modify: `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json`
- Create: `docs/qa/full-eval/fix-batches-2026-07-07.md`

- [ ] **Step 1: Filter matrix**

Create fix batches only from rows where:

```text
status == "confirmed-open"
freshEvidence is not null
expected and actual are both written
affected role/surface is known
```

Expected: no old stale finding enters a fix batch.

- [ ] **Step 2: Batch by independent ownership**

Use up to 6 parallel agents only if files do not overlap:

```text
Auth/provider
Comms/media
Agent/LLM
Admin/RBAC/security
Projects/planning write-flows
CRM write-flows
```

Expected: each batch has owner, file boundaries, tests, browser evidence, and rollback risk.

- [ ] **Step 3: Block risky product decisions**

Keep these out of blind coding unless fresh evidence plus product intent is clear:

```text
real 2FA/SAML enforcement that can lock users out
real media-provider infrastructure changes
LLM behavior expectations without provider key/config
large navigation or information architecture redesigns
```

Expected: these become explicit decision rows, not accidental implementation.

### Task 4: Execute Fix Batch 1 With TDD And Browser Evidence

**Files:**
- Determined by `fix-batches-2026-07-07.md`

- [ ] **Step 1: Enter code area through CodeGraph**

Run CodeGraph context/search for the selected batch before reading/changing source.

Expected: final report includes changed symbols and CodeGraph before/after count.

- [ ] **Step 2: Write failing tests**

For each confirmed bug, write the smallest regression test that fails on current branch.

Expected: test fails for the exact bug, not for unrelated environment setup.

- [ ] **Step 3: Implement minimal fix**

Change only files listed in the batch.

Expected: no unrelated formatting churn, no broad refactor.

- [ ] **Step 4: Verify**

Run:

```powershell
corepack pnpm --filter @kiss-pm/web typecheck
corepack pnpm --filter @kiss-pm/web test
corepack pnpm --filter @kiss-pm/api typecheck
```

Run more targeted API/domain tests if the batch touches backend.

Expected: targeted tests pass; if a full suite has pre-existing failures, record exact names and why unrelated.

- [ ] **Step 5: Browser readback**

Use Browser plugin on the current-branch stand to replay the scenario as the affected role.

Expected: screenshot/network/log evidence saved under `docs/qa/full-eval/evidence/reconciliation-2026-07-07/`.

- [ ] **Step 6: Update matrix**

Move fixed rows from `confirmed-open` to `fixed-by-current-branch` with fresh evidence.

Expected: no row is called fixed without test/browser/API/readback evidence.

### Task 5: Stop Condition

**Files:**
- Modify: `docs/qa/full-eval/reconciliation-2026-07-07.md`
- Modify: `docs/qa/full-eval/reconciliation-matrix-2026-07-07.json`

- [ ] **Step 1: Report current truth**

Summarize counts:

```text
fixed-by-master
fixed-by-current-branch
confirmed-open
unverified
blocked-by-env
not-a-bug/superseded
```

- [ ] **Step 2: Do not claim clean-pass unless true**

Clean-pass requires:

```text
full browser traversal completed after latest code changes
provider behavior verified or explicitly environment-blocked
duplicate/race/idempotency matrix completed for write-flows
all confirmed-open rows either fixed or intentionally deferred by user decision
```

Expected: final answer distinguishes “fix batch complete” from “Full Product Evaluation clean-pass complete”.
