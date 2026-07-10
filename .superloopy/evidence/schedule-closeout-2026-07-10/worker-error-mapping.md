# F5 planning error mapping worker evidence

Date: 2026-07-10
Status: PASS

## Scope

Changed only the requested planning delivery slice:

- `apps/web/src/delivery/lib/project-chrome.ts`
- `apps/web/src/delivery/lib/use-planning.ts`
- `apps/web/src/delivery/lib/planning-error-mapping.test.ts`
- this evidence report

No Schedule UI, Saved Views, backend/API, matrix, or documentation files were edited. The tenant-safe, per-hook project identity state and fetch logic in `useProjectBase` are unchanged.

## Implementation evidence

`mapPlanningError` is the single mapping boundary for load and mutation failures. It returns separate `code`, `message`, and optional `status` fields, so UI text is Russian while backend machine codes remain available for branching and telemetry.

Covered mappings:

| Input | Russian UI behavior | Preserved machine data |
|---|---|---|
| `session_required` / `unauthorized`, HTTP 401 | expired-session sign-in message | original code + 401 |
| `permission_missing` / `forbidden`, HTTP 403 | insufficient planning permission | original code + 403 |
| `project_not_found`, HTTP 404 | project missing/stale-link message | original code + 404 |
| `plan_version_conflict`, HTTP 409 | plan changed; data refreshed/retry | original code + 409 |
| `planning_precondition_failed`, HTTP 409 | current plan state rejects change | original code + 409 |
| `idempotency_key_conflict`, HTTP 409 | request conflicts with prior operation | original code + 409 |
| `persistence_not_configured`, HTTP 501 | planning service temporarily unavailable | original code + 501 |
| `network_error` or fetch `TypeError` | connection/retry message | original `network_error`, or normalized `transport_failure` |
| generic `request_failed` plus a known status | status-specific Russian message | `request_failed` remains unchanged |

Unknown backend codes no longer leak into visible text; they receive a generic planning-operation message while their original code is retained.

`usePlanning` uses the mapper in load, single apply, batch apply, revert, scenario preview, and scenario apply error paths. Existing mutation semantics remain intact:

- preview and confirmation still precede apply;
- successful responses and read-model updates are unchanged;
- `plan_version_conflict` still reloads authoritative data and returns `conflict: true`;
- load 403 still selects the dedicated `forbidden` state;
- validation issues and entity IDs are still returned;
- local no-model, empty-batch, and preview-cancelled control outcomes are unchanged.

## Fresh verification

Focused planning tests:

```text
pnpm vitest run apps/web/src/delivery/lib/mock-planning-backend.test.ts apps/web/src/delivery/lib/planning-client-commits-error.test.ts apps/web/src/delivery/lib/planning-error-mapping.test.ts apps/web/src/delivery/lib/planning-preview-gate.test.tsx

Result: PASS, 4 files / 57 tests.
```

The new table-driven mapper suite contains 21 passing cases: every requested code/status, status-only fallbacks, generic-code-plus-status preservation, and transport failure without raw-message leakage.

An isolated TypeScript project extending the web tsconfig and including only the three changed TypeScript files passed:

```text
pnpm exec tsc -p E:\tmp\kiss-pm-web-planning-tsconfig.json --pretty false

Result: PASS. The temporary config was removed after the check.
```

Required shared-worktree typecheck:

```text
pnpm --filter @kiss-pm/web typecheck

Result: PASS. Next route types generated and TypeScript completed without diagnostics.
```

Earlier reruns were temporarily blocked by concurrent Schedule edits. The final fresh command passed after that worker completed; this slice did not edit the Schedule file.

`git diff --check` on the three changed code/test files passed; Git emitted only the pre-existing CRLF normalization warning for `use-planning.ts`.

## CodeGraph change index

CodeGraph was synchronized before investigation and after implementation. The final checkpoint moved from 2,234 files / 24,933 nodes / 53,194 edges to 2,237 files / 25,039 nodes / 53,355 edges. Because other workers are changing this shared worktree, the global delta includes concurrent activity and is not attributed solely to this slice.

Task-owned symbol changes:

- `project-chrome.ts`: added `PlanningUiError`, `mapPlanningError`, and mapping constants/tables; changed `planningErr` to delegate to the central mapper. `useProjectBase`, `ProjectIdentity`, and `codeInitials` were not changed.
- `use-planning.ts`: changed `ApplyResult`, `ScenarioPreviewResult`, and `usePlanning` error branches to return Russian `message` plus optional machine `code`; no client call order or success mutation path changed.
- `planning-error-mapping.test.ts`: added table-driven `mapPlanningError` and `planningErr` coverage.

Post-sync CodeGraph confirms `planningErr -> mapPlanningError`, `mapPlanningError -> PlanningUiError`, and the existing `usePlanning -> createDeliveryPlanningClient` edge remains.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-error-mapping.md
