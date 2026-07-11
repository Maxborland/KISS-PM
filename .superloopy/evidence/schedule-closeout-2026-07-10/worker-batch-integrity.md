# Worker evidence: Schedule batch/resource integrity

## Status

PASS for the bounded Schedule surface slice.

## Scope

Changed only:

- `apps/web/src/delivery/schedule/schedule-surface.tsx`
- `apps/web/src/delivery/schedule/schedule-batch-integrity.test.tsx`
- this evidence artifact

The existing `ScheduleSavedViews` import, payload derivation, apply callback, toolbar component, and zoom state integration remain present.

## Implemented

- Added one batch-aware mutation gateway, `mutateCommands`, behind the existing single/batch convenience wrappers.
- Routed work/duration, finish, milestone, subtree delete, TaskModal, TSV, fill, drag/resize, inline, dependency, assignment, and WBS commands through that gateway.
- Preserved staged commands, optimistic model, batch base, navigation sentinel, and retry affordance on `preview_cancelled`.
- Cleared staged state only after success or a non-cancel rejection; explicit discard restores the base model.
- Blocked switching batch mode off while staged commands exist.
- Captured the staged batch base immediately before apply and used it as the compensating undo snapshot.
- Preserved `lastCommitRef` and enabled Undo after a cancelled undo preview; cleared it only after successful undo or version conflict.
- Emitted `assignment.delete` when edit clears an existing assignment.
- Split `canManagePlan` and `canManageResources` using `tenant.project_resources.manage`.
- Hid row assignment controls and disabled the TaskModal assignee field without resource-manage permission.
- Added a gateway-level deny for assignment/resource commands without resource-manage permission.
- Rejected duration/work changes on an assigned task for plan-only managers with an explicit message, preserving resource load.
- Removed the Schedule surface `useResourceDirectory` call and passed one planning resource list into every `ResourceEditor` and `TaskModal`; overrides prevent per-row directory fetches.

## Focused coverage

`schedule-batch-integrity.test.tsx` proves:

1. staged preview cancel preserves state and successful retry applies once;
2. explicit discard restores base state without apply;
3. a multi-command TaskModal write cannot bypass batch mode and produces one final batch commit;
4. dirty batch mode cannot be disabled;
5. cancelled undo remains available and retries the same inverse;
6. clearing an assignee emits `assignment.delete`;
7. plan-manage without resource-manage sees no assignment editor, cannot mutate assignment/resource work, and emits no assignment command.

## Verification

- `pnpm vitest run src/delivery/schedule/schedule-batch-integrity.test.tsx` from `apps/web`: PASS, 1 file / 7 tests.
- `pnpm run typecheck` from `apps/web`: PASS; Next route type generation and TypeScript completed.
- Related Schedule regression run: PASS, 4 files / 19 tests. The pre-existing navigation test emitted localhost Saved Views connection stderr while still exiting 0; no production request occurred in the focused worker test because Saved Views was isolated.
- `git diff --check -- apps/web/src/delivery/schedule/schedule-surface.tsx apps/web/src/delivery/schedule/schedule-batch-integrity.test.tsx`: PASS (line-ending warning only).
- `codegraph sync`: PASS.

## Integration note

The current checked-in `PlanningReadModel` type does not yet declare `authored.resources`. The surface reads the requested field through a narrow optional compatibility type and maps it to editor resources. This keeps current typecheck green and removes directory calls; the list becomes populated when the disjoint read-model producer includes `authored.resources`. If that producer does not land, assignment pickers intentionally receive an empty override rather than falling back to per-row `/api/workspace/users` requests.

## CodeGraph change index

- Session review baseline recorded in `lane-code-review.md`: 2,228 files / 24,825 nodes / 53,167 edges.
- Final synchronized graph: 2,237 files / 25,039 nodes / 53,355 edges.
- Global delta is `+9 files / +214 nodes / +188 edges`; concurrent workers contributed to this repository-wide delta.
- `schedule-surface.tsx`: added indexed top-level nodes `canManageScheduleResourceControls` and `planningResourcesOf`; changed `ProjectSchedule`. Nested local gateway/lifecycle functions are represented inside `ProjectSchedule`, not as separately searchable CodeGraph nodes.
- `schedule-batch-integrity.test.tsx`: new indexed file with 17 symbols, including `renderSchedule` and `stageQuickCreate`.
- No symbols were intentionally removed. Saved Views nodes/integration were preserved.
