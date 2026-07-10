# Worker 06: project resources absence write E2E

## Scope

Only `e2e/full-eval/projects-resources-write.spec.ts` and this evidence note are added. Product code is unchanged.

## Behavior spec

- AC1: ADMIN creates a one-day resource absence through the Resources UI.
- AC2: The batch command succeeds and the planning read-model contains the exact `calendar.exception.upsert` payload captured from the UI request.
- AC3: A reload preserves the active absence; the Calendars UI shows the same resource/date exception.
- AC4: ADMIN removes the absence through the Calendars exception-list UI.
- AC5: API readback marks the exception inactive by restoring `workingMinutesPerDay`; after reload the exception is absent from the selected resource UI.
- AC6: A `finally` cleanup restores full working minutes through the public planning API if the ADMIN flow fails after creation, retrying one plan-version conflict.
- AC7: `resource-reader` can reach the Resources write control, but the server rejects the batch with `403`; plan version and exception set remain unchanged after reload.

## Test mapping

- AC1-AC6 -> `ADMIN creates and removes a resource absence with API readback and reload`
- AC7 -> `RESOURCE reader absence write is rejected and leaves the plan unchanged`

## Selectors and data

- Resources entry control: role `button`, exact accessible name `Отсутствие`.
- Dialog: role `dialog`, accessible name `Отсутствие сотрудника`.
- Fields: exact labels `Сотрудник`, `С`, and `По`; type/button `Отпуск`; submit `Добавить отсутствие`.
- Calendar removal: select the resource button by its exact visible employee name, locate the exact `DD.MM.YYYY` exception row, then click the existing `title="Снять исключение"` control.
- The test chooses the first project-calendar working date with no existing exception record, so it cannot collide with seeded holidays, absences, or previously deactivated rows.
- Identity is taken from the actual UI request (`id`, `calendarId`, `resourceId`, `date`), not inferred from DOM text.

## Cleanup contract

- Product removal is semantic, not a physical row delete: `calendar.exception.upsert` reuses the same exception id and restores the calendar's full daily minutes with an empty reason.
- The `finally` path first reads the latest plan version. It does nothing if the exception is already inactive; otherwise it submits the same restoring command via the public API.
- Cleanup retries once on `409 plan_version_conflict` and fails loudly for any other status or a second conflict.

## Gaps and limits

- Project Resources currently uses planning calendar exceptions. It does not call the separate tenant CRUD endpoint `/api/tenant/current/absences`; this test follows the real project UI contract and does not claim coverage of that unused endpoint.
- Creation and removal live on different project surfaces: Resources creates the range; Calendars owns the existing removal control. No product selector or behavior was added for the test.
- The read-only UI currently exposes an enabled write control to `resource-reader`; the negative case records server-safe `403` behavior rather than assuming the control is hidden.
- Per instruction, no live mutation run was performed. Verification is limited to Playwright discovery (`--list`) and TypeScript no-emit checking, so selector timing and seeded role/project data remain runtime assumptions.

## Static verification

- PASS: `node_modules\.bin\playwright.cmd test --config playwright.config.ts e2e/full-eval/projects-resources-write.spec.ts --list` discovered exactly 2 tests in 1 file.
- PASS: `node_modules\.bin\tsc.cmd --noEmit --pretty false --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck e2e/full-eval/projects-resources-write.spec.ts` completed with exit code 0.
- Infrastructure note: the first equivalent `pnpm exec playwright ... --list` attempt did not reach Playwright because the Codex pnpm runtime wrapper attempted an install and stopped on `ERR_PNPM_IGNORED_BUILDS`. The direct already-installed local binary was used; no install or lockfile change was made.

## Mandatory preview gate adaptation

- ADMIN create now submits the exact batch envelope to `preview-command-batch`, waits for `200`, opens the `Предпросмотр изменений` dialog, and only then submits the same envelope to `apply-command-batch`.
- ADMIN removal now submits the exact single-command envelope to `preview-command`, waits for `200`, confirms through the same preview dialog, and only then submits the same envelope to `apply-command`.
- Both positive flows assert that the apply request body is exactly equal to the corresponding preview request body.
- The `resource-reader` case now expects `403` from `preview-command-batch`, asserts that the preview dialog is absent, and proves that no `apply-command-batch` request was sent.
- Read-model and reload assertions remain unchanged, so the preview gate is covered without weakening persistence or non-mutation checks.

## Preview gate static verification

- PASS: `node_modules\.bin\playwright.cmd test --config playwright.config.ts e2e/full-eval/projects-resources-write.spec.ts --list` discovered exactly 2 tests in 1 file.
- PASS: `node_modules\.bin\tsc.cmd --noEmit --pretty false --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck e2e/full-eval/projects-resources-write.spec.ts` completed with exit code 0.
- Per instruction, no browser test body or live mutation was executed.