# Projects preview -> apply governance fix

## Goal
Every direct planning mutation uses a fresh, user-visible server preview before apply. Batch preview is cumulative and uses the same reducer/preconditions as batch apply.

## Non-goals
- Redesign Schedule, Resources, Assignments, Calendars, Baseline, Commits, or Settings editors.
- Change planning command semantics.
- Weaken server-side permission or optimistic concurrency checks.

## Acceptance criteria
- AC1: Single-command UI requests preview-command, renders delta and validation issues, and sends no apply-command until explicit confirmation.
- AC2: Batch UI requests preview-command-batch; the API previews commands sequentially against one cumulative snapshot using previewPlanningCommands.
- AC3: Blocking validation disables confirmation; cancel resolves without mutation.
- AC4: Preview/apply conflicts reload the read model and return the existing conflict result.
- AC5: Fresh E2E evidence proves preview -> confirm -> apply -> API readback -> reload -> cleanup.

## Failure behavior
- Missing read model returns no_read_model.
- Preview permission denial/validation/network errors return a non-success result and never call apply.
- Closing or cancelling the confirmation gate does not mutate.
- Batch preview uses the same status normalization and datasource preconditions as apply-batch.

## Test plan
- AC2 -> API route test for cumulative batch preview and planning-client request test.
- AC1/AC3 -> runtime gate component test plus usePlanning mutation test.
- AC4 -> existing conflict tests plus focused regression.
- AC5 -> Projects write E2E specs assert request order and cleanup.
