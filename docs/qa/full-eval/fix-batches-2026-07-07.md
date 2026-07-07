# Fix batches — 2026-07-07

Источник: `reconciliation-matrix-2026-07-07.json`.

Правило: сюда попадают только строки `confirmed-open` со свежим evidence.

## Batch 1 — Profile permission-aware edit state

**Status:** fixed in current branch, verified

**Finding:** `BUG-SHELL-11`

**Severity:** medium

**Affected role:** `plan-reader-no-resources@kiss-pm.local` and any role without profile/theme update permissions.

**Surface:** `/profile`

**Original failing evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/auth-shell-browser-2026-07-07.json`
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/auth-shell-extra-browser-2026-07-07.json`

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-shell-11-profile-after-fix-browser-2026-07-07.json`
- `apps/web/src/auth/profile/profile-surface.test.ts`
- `corepack pnpm --filter @kiss-pm/web test -- src/auth/profile/profile-surface.test.ts` → 16 files / 251 tests passed
- `corepack pnpm --filter @kiss-pm/web typecheck` → passed

**Expected:** a role without profile/theme update permissions sees a disabled or clearly read-only profile form.

**Original actual:** profile fields were editable; after changing name, `Сохранить` became enabled; submit returned `Недостаточно прав для этого действия`.

**Changed area:** `apps/web/src/auth/profile/profile-surface.tsx`

**Fix applied:** profile/theme controls are permission-aware using permissions already exposed by `/api/auth/me`; backend `403` remains a fallback.

**Verification result:**

- unit helper test covers independent `profile.update` and `workspace.theme.manage` capabilities;
- browser recheck under `plan-reader-no-resources`: profile inputs, color input, theme buttons and save are disabled; warning is visible;
- browser recheck under `admin`: controls are enabled; after dirty name edit, save enables;
- backend `403` remains a fallback, but normal no-permission UI no longer presents fake editable controls.


## Batch 2 — Notification read idempotency

**Status:** fixed in current branch, verified

**Finding:** `BUG-COMM-05`

**Severity:** medium

**Affected role:** authenticated notification owner.

**Surface:** `POST /api/workspace/notifications/:notificationId/read`, unread summary/readback.

**Original expected:** repeated mark-read is a no-op; first `readAt` remains stable; unread count decrements once.

**Original actual:** repeated `POST /read` overwrote `readAt` with a newer timestamp.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-comm-05-notification-read-idempotency-2026-07-07.json`
- RED: `readAt` changed between first and second read request.
- GREEN: `apps/api/src/collaborationRoutes.db.test.ts` passed `12/12` with repeated read preserving `readAt` and unread summary at `0`.
- `corepack pnpm --filter @kiss-pm/api typecheck` → passed.

**Changed area:** `packages/persistence/src/collaborationRepository.ts`, `apps/api/src/collaborationRoutes.db.test.ts`

**Fix applied:** `markUserNotificationRead` updates only unread rows; if the notification is already read, it returns the existing row without mutating `readAt`.

**Regression risk:** low. The route still returns `200` and the same notification shape; only repeated writes stop changing audit-facing timestamp data.

## Batch 3 — CRM small-money formatter

**Status:** fixed in current branch, verified

**Finding:** `BUG-CRM-08`

**Severity:** low/medium

**Affected role:** CRM user viewing deals, forecast, and deal amount summaries.

**Surface:** `/crm/deals` money labels through shared CRM formatter.

**Original expected:** values below `1000` render as exact rubles (`100 ₽`, `500 ₽`, `999 ₽`), while thousands/millions keep compact labels.

**Original actual:** `deals-surface.tsx` had a local duplicate formatter that rendered small values as `0 тыс ₽` or `1 тыс ₽`.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-crm-08-money-formatting-2026-07-07.json`
- RED: `corepack pnpm --filter @kiss-pm/web test -- src/crm/ui/money.test.ts` failed before implementation because `./money` did not exist and the deals surface still had a local bad formatter.
- GREEN: `corepack pnpm --filter @kiss-pm/web test -- src/crm/ui/money.test.ts` → 17 files / 253 tests passed; `src/crm/ui/money.test.ts` passed 2 tests.
- `corepack pnpm --filter @kiss-pm/web typecheck` → passed.

**Changed area:** `apps/web/src/crm/ui/money.ts`, `apps/web/src/crm/ui/crm-bits.tsx`, `apps/web/src/crm/deals/deals-surface.tsx`, `apps/web/src/crm/ui/money.test.ts`

**Fix applied:** extracted the shared `money`/`rub` formatter into `crm/ui/money.ts`, re-exported it from `crm-bits`, and removed the local `deals-surface` duplicate.

**Regression risk:** low. Existing compact formatting is preserved; the new test locks sub-thousand, thousand, and million outputs.

## Batch 4 — CRM permission-aware create controls

**Status:** fixed in current branch, verified

**Finding:** `BUG-CRM-09`

**Severity:** medium

**Affected role:** live CRM read-only users without the relevant manage permission.

**Surface:** `/crm/clients`, `/crm/contacts`, `/crm/products`, `/crm/deals` create triggers and empty-state create actions.

**Original expected:** a live user without write permission must not see an enabled create trigger that opens a modal and only fails after submit.

**Original actual:** create triggers were not capability-aware and relied on backend `403` after the user entered the modal.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-crm-09-permission-aware-create-controls-2026-07-07.json`
- RED: `corepack pnpm --filter @kiss-pm/web test -- src/crm/ui/permissions.test.ts` failed before implementation because `./permissions` did not exist.
- GREEN: `corepack pnpm --filter @kiss-pm/web test -- src/crm/ui/permissions.test.ts src/crm/ui/money.test.ts` → 18 files / 256 tests passed.
- `corepack pnpm --filter @kiss-pm/web typecheck` → passed.

**Changed area:** `apps/web/src/crm/ui/permissions.ts`, `apps/web/src/crm/clients/clients-surface.tsx`, `apps/web/src/crm/contacts/contacts-surface.tsx`, `apps/web/src/crm/products/products-surface.tsx`, `apps/web/src/crm/deals/deals-surface.tsx`

**Fix applied:** create controls now use the current live session permissions via `useSessionUser()` and disable triggers when the relevant backend manage permission is missing. Mock/Storybook mode remains writable.

**Regression risk:** medium-low. The change is UI gating only; backend authorization remains unchanged. Follow-up traversal should still check edit/archive controls for the same read-only roles.

## Batch 5 — CRM contact email uniqueness

**Status:** fixed in current branch, verified

**Finding:** `BUG-CRM-06`

**Severity:** medium

**Affected role:** CRM user creating or editing contacts.

**Surface:** `POST /api/workspace/contacts`, `PATCH /api/workspace/contacts/:contactId`, CRM mock backend, contact persistence schema.

**Original expected:** contact email is unique per tenant when present; duplicate create/update returns `409 contact_email_taken`; repeated or concurrent duplicate writes cannot create conflicting rows.

**Original actual:** API and mock allowed duplicate non-null contact emails; persistence had no tenant/email unique index, so race/concurrent duplicates were possible.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-crm-06-contact-email-unique-2026-07-07.json`
- RED: web mock duplicate create resolved successfully before implementation; API DB duplicate create returned `201` before implementation.
- GREEN: `corepack pnpm --filter @kiss-pm/web test -- src/crm/lib/mock-crm-backend.test.ts` → 18 files / 257 tests passed.
- GREEN: `$env:DATABASE_URL='postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55436/kiss_pm'; corepack pnpm exec vitest run --config vitest.db.config.ts apps/api/src/crmRoutes.db.test.ts` → 1 file / 8 tests passed.
- GREEN: `corepack pnpm --filter @kiss-pm/persistence test -- src/migration.test.ts` → 6 files / 69 tests passed.
- `corepack pnpm --filter @kiss-pm/api typecheck` → passed.
- `corepack pnpm --filter @kiss-pm/web typecheck` → passed.
- `corepack pnpm --filter @kiss-pm/persistence typecheck` → passed.

**Changed area:** `apps/api/src/crmRoutes.ts`, `apps/api/src/crmRoutes.db.test.ts`, `apps/web/src/crm/lib/mock-crm-backend.ts`, `apps/web/src/crm/lib/mock-crm-backend.test.ts`, `apps/web/src/crm/ui/crm-bits.tsx`, `packages/persistence/src/schema/crm.ts`, `packages/persistence/src/migration.test.ts`, `packages/persistence/migrations/0049_contact_email_unique.sql`

**Fix applied:** API and mock reject duplicate active contact email on create/update with `409 contact_email_taken`; API also maps Postgres `contacts_tenant_id_email_uidx` unique violations to the same 409 for race safety; persistence adds the tenant/email unique index; UI now shows a Russian error for the new code.

**Regression risk:** medium-low. Nullable emails still allow multiple empty contacts, but a production database with existing duplicate non-null contact emails would need cleanup before applying migration `0049_contact_email_unique.sql`.

## Batch 6 — CRM legacy stage select

**Status:** fixed in current branch, verified

**Finding:** `BUG-CRM-03`

**Severity:** high

**Affected role:** CRM user opening a deal card for a legacy opportunity row with `pipelineId=null` and non-null `stageId`.

**Surface:** `/crm/deals/[id]`, deal card `Стадия` select.

**Original expected:** stage select shows all stages from the current stage's pipeline and labels the selected stage correctly.

**Original actual:** UI filtered stages by `opportunity.pipelineId`; for legacy rows with `pipelineId=null`, the select had only one fallback option `— без стадии —` and no real stage choices.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-crm-03-legacy-stage-select-2026-07-07.json`
- RED: `corepack pnpm --filter @kiss-pm/web test -- src/crm/deals/deal-card-surface.test.ts` failed because the resolver was missing.
- GREEN: `corepack pnpm --filter @kiss-pm/web test -- src/crm/deals/deal-card-surface.test.ts` → 19 files / 259 tests passed.
- `corepack pnpm --filter @kiss-pm/web typecheck` → passed.

**Changed area:** `apps/web/src/crm/deals/deal-card-surface.tsx`, `apps/web/src/crm/deals/deal-card-surface.test.ts`

**Fix applied:** `DealCardBody` now computes an effective pipeline id from `opportunity.pipelineId` or, for legacy rows, from the selected stage's `pipelineId`; the stage select uses that effective pipeline to build options.

**Regression risk:** low. Explicit `opportunity.pipelineId` still wins; fallback only changes legacy null-pipeline rows. Full browser traversal remains tracked separately as a risk-zone item.

## Batch 7 — Communication channel rename sidebar

**Status:** fixed in current branch, verified

**Finding:** `BUG-COMM-01`

**Severity:** low

**Affected role:** communication channel manager editing a non-system channel.

**Surface:** `/communications/channels`, sidebar channel list after edit dialog save.

**Original expected:** detail heading and sidebar item both show the new channel title immediately after successful PATCH.

**Original actual:** detail updated, but sidebar list kept the old title until full page reload because parent list state was not patched/refetched.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-comm-01-channel-rename-sidebar-2026-07-07.json`
- RED: `corepack pnpm --filter @kiss-pm/web test -- src/communications/lib/use-comms.test.ts` failed because the list replacement primitive did not exist.
- GREEN: `corepack pnpm --filter @kiss-pm/web test -- src/communications/lib/use-comms.test.ts` → 20 files / 261 tests passed.
- `corepack pnpm --filter @kiss-pm/web typecheck` → passed.

**Changed area:** `apps/web/src/communications/lib/use-comms.ts`, `apps/web/src/communications/lib/use-comms.test.ts`, `apps/web/src/communications/channels/channels-surface.tsx`

**Fix applied:** `patchChannel` now returns the updated `Channel`; `ChannelsSurface` passes a parent `replaceChannel` callback into `ChannelDetail`; after successful save, the sidebar list replaces the patched channel immediately.

**Regression risk:** low. Create/archive behavior is unchanged; the detail panel still updates its local state. Full browser traversal remains tracked separately as a risk-zone item.

## Batch 8 — Auth reset-token repeat classification

**Status:** fixed in current branch, verified

**Finding:** `BUG-AUTH-13`

**Severity:** low/medium

**Affected role:** user completing password reset.

**Surface:** `POST /api/auth/password-reset/confirm`, reset-token persistence.

**Original expected:** a reset token succeeds once; repeating confirm with the same token returns `400 reset_token_used`; other outstanding reset tokens for that user are invalidated after password change.

**Original actual:** successful confirm deleted all reset-token rows for the user, including the consumed token, so the same token later returned `400 invalid_reset_token`.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-auth-13-reset-token-repeat-2026-07-07.json`
- RED: targeted auth route test showed second confirm returned `invalid_reset_token` instead of `reset_token_used`.
- GREEN: `corepack pnpm exec vitest run --config vitest.config.ts apps/api/src/authRegistrationRoutes.test.ts` → 1 file / 14 tests passed.
- `corepack pnpm --filter @kiss-pm/api typecheck` → passed.
- `corepack pnpm --filter @kiss-pm/persistence typecheck` → passed.

**Changed area:** `apps/api/src/authRegistrationRoutes.ts`, `apps/api/src/authRegistrationRoutes.test.ts`, `packages/persistence/src/repositories.ts`

**Fix applied:** reset confirm now preserves the just-consumed token row as evidence for stable repeat-token classification and deletes only other reset tokens for the same user. Sessions are still invalidated.

**Regression risk:** low-medium. This intentionally retains consumed reset-token rows until normal retention cleanup; any future cleanup must preserve the product/security expectation for repeat-token classification.

## Batch 9 — Baseline label readback

**Status:** fixed in current branch, targeted verified

**Finding:** `BUG-PROJ-21`

**Severity:** minor

**Affected role:** project user capturing baseline snapshots.

**Surface:** `/projects/[id]/baseline`, `baseline.capture`, planning read-model `authored.baselines`.

**Original expected:** a baseline name entered by the user is visible in baseline history after capture/readback.

**Original actual:** `project_baselines.label` was persisted, but `mapBaselines` omitted it from the read-model and the UI always rendered `Снимок плана`.

**Fix evidence:**

- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-21-baseline-label-2026-07-07.json`
- RED: DB integration assertion showed `freshBaseline?.label === undefined` after `baseline.capture` with label `Свежий`.
- GREEN: targeted DB test for `shows zero deltas immediately after capturing a baseline` passed with label readback.
- GREEN: web mock planning backend baseline test passed 31/31.
- `corepack pnpm --filter @kiss-pm/domain typecheck` → passed.
- `corepack pnpm --filter @kiss-pm/persistence typecheck` → passed.

**Changed area:** `packages/domain/src/planning/types.ts`, `packages/domain/src/planning/commandReducer.ts`, `packages/persistence/src/planningRepository.ts`, `apps/web/src/delivery/baseline/baseline-surface.tsx`, related tests.

**Fix applied:** `PlanBaseline` now includes `label`; domain capture and persistence read-model mapping propagate it; baseline history renders `b.label` with the existing fallback.

**Regression risk:** low. The DB column already existed; the change exposes existing data through typed contracts. Full browser traversal remains a separate risk-zone item.

## Batch 10 — Project date origin hardening

**Status:** fixed in current branch, targeted verified

**Finding:** `BUG-PROJ-05`

**Surface:** `/schedule`, `/overview`, `/calendars`.

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-05-date-origin-2026-07-07.json`

**Fix applied:** delivery date math now uses shared current/project/read-model helpers instead of hardcoded March/April/June 2026 constants.

**Verification:** date-origin/overview/project-action/schedule/projects tests passed; web typecheck passed.

**Regression risk:** medium-low; browser visual placement still belongs to full traversal.

## Batch 11 — Schedule summary rows from parent tree

**Status:** fixed in current branch, targeted verified

**Finding:** `BUG-PROJ-13`

**Surface:** `/schedule` summary/non-leaf rows.

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-13-summary-parent-chain-2026-07-07.json`

**Fix applied:** schedule rows and interactions now use `parentTaskId` chains for summary detection, collapse, rollups, subtree delete, dependency filtering, and edit/drag guards.

**Verification:** schedule row + mock planning backend tests passed; web typecheck passed.

**Regression risk:** medium; tree semantics changed from WBS heuristics to canonical parent links.

## Batch 12 — Projects list honest scope

**Status:** fixed in current branch, targeted verified

**Finding:** `BUG-PROJ-16`

**Surface:** `/projects`.

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-16-projects-list-honest-scope-2026-07-07.json`

**Fix applied:** removed unsupported `Все/Активные` fake filter and aligned story/surface copy with the active-projects API contract.

**Verification:** projects-list test passed; web typecheck passed.

**Regression risk:** low.

## Batch 13 — Non-schedule project action links

**Status:** partially fixed in current branch, targeted verified

**Finding:** `BUG-PROJ-09`

**Surface:** `/baseline`, `/calendars`, `/settings`.

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-09-non-schedule-actions-partial-2026-07-07.json`

**Fix applied:** converted touched fake/demo controls to real `Link`-backed buttons for existing project routes.

**Verification:** project-action-links test passed; web typecheck passed.

**Remaining:** schedule fake controls were closed later in Batch 15. No non-schedule BUG-PROJ-09 scope remains here; full browser traversal remains tracked separately as `RISK-FULL-BROWSER-TRAVERSAL`.

## Batch 14 — Agent no-provider degraded behavior

**Status:** partially fixed in current branch, targeted verified

**Finding:** `BUG-SHELL-12`, `BUG-SHELL-13`

**Surface:** `/agent`, `/api/workspace/agent/tools`, `/agent/propose`, `/agent/propose/stream`.

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-shell-12-13-agent-provider-degraded-partial-2026-07-07.json`

**Fix applied:** no-provider mode now exposes `provider.configured=false` and fail-closes proposal endpoints with `503 agent_provider_not_configured`; UI shows explicit setup message instead of fake thinking/proposal flow.

**Verification:** agent provider/loop/openrouter/web stream tests passed; API and web typecheck passed.

**Remaining:** live OpenRouter provider, authenticated API SSE, and Chrome browser stream/review/reject/apply/readback now pass for `create_task`; broader every-role/every-agent-tool/provider-variant sweeps remain under `RISK-AGENT-REAL-LLM-SSE`.

## Batch 15 — Schedule project action controls

**Status:** fixed in current branch, targeted verified

**Finding:** `BUG-PROJ-09`

**Severity:** medium

**Affected role:** project user opening the schedule toolbar.

**Surface:** `/projects/[id]/schedule`

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-09-schedule-actions-2026-07-07.json`

**Original expected:** schedule toolbar controls either perform real navigation/actions or are not exposed as enabled fake controls.

**Original actual:** `Baseline`, `Фильтры`, and `Колонки` were enabled toolbar buttons wired to `demoAction(...)`; only a toast-like placeholder existed, with no route/action behind the latter two controls.

**Fix applied:** `Baseline` is now a real `Link` to `/projects/${projectId}/baseline`; unsupported `Фильтры` and `Колонки` buttons were removed from the schedule toolbar.

**Verification:**

- RED: new schedule contract test in `apps/web/src/delivery/project-action-links.test.ts` failed before implementation because the baseline route link was absent.
- GREEN: `./node_modules/.bin/vitest.cmd run apps/web/src/delivery/project-action-links.test.ts` → 4 tests passed.
- GREEN: from `apps/web`, `../../node_modules/.bin/next.cmd typegen` → passed.
- GREEN: from `apps/web`, `../../node_modules/.bin/tsc.cmd -p tsconfig.json --pretty false` → passed.

**Remaining:** no `BUG-PROJ-09`-specific schedule/non-schedule fake-action scope remains. Full role × route × action browser traversal remains tracked separately as `RISK-FULL-BROWSER-TRAVERSAL`.


## Batch 16 — Planning apply-command idempotency coverage

**Status:** targeted coverage added, verified

**Risk zone:** `RISK-WRITE-FLOW-RACE-IDEMPOTENCY`

**Surface:** `POST /api/workspace/projects/:projectId/planning/apply-command`

**Write flows:** `baseline.capture`, `task.update_schedule`

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-write-flow-planning-idempotency-coverage-2026-07-07.json`

**Expected:** concurrent identical requests with the same idempotency key deduplicate to one planVersion bump and identical responses; same key with different payload returns `409 idempotency_key_conflict`.

**Actual before:** generic idempotency tests existed, but these two high-risk planning commands had no command-specific concurrent coverage.

**Fix applied:** added DB integration tests for concurrent `baseline.capture` and `task.update_schedule` requests. No production code change was required.

**Verification:** `$env:DATABASE_URL='postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55433/kiss_pm'; .\node_modules\.bin\vitest.CMD run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t "deduplicates concurrent"` → 2 selected tests passed.

**Remaining:** this narrows only the planning slice of `RISK-WRITE-FLOW-RACE-IDEMPOTENCY`; admin user/role writes, communication channel rename, auth reset concurrent confirm, CRM contact concurrent uniqueness, and notification read concurrency remain separate slices.


## Batch 17 — Agent production chrome honesty

**Status:** fixed in current branch, targeted verified

**Finding:** `BUG-SHELL-13`

**Surface:** `/agent` production history, mini-navigation, message timestamps.

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-shell-13-agent-production-chrome-2026-07-07.json`

**Original expected:** production /agent history, navigation, and timestamps are real or absent; no clickable fake landing-demo chrome appears on the product route.

**Original actual:** /agent inherited static landing demo history, button-only nav, and synthetic message timestamps.

**Fix applied:** production /agent passes real product route links, an empty production history list, and Date-based message timestamps; landing demo defaults remain intact through opt-in props.

**Verification:** `cmd /c ..\..\node_modules\.bin\vitest.cmd run --config vitest.config.ts src/workspace/agent/agent-surface.test.tsx` → 3 tests passed; `corepack pnpm --filter @kiss-pm/web typecheck` → passed.

**Remaining:** live provider/API SSE plus browser proposal/apply/readback are now covered by `risk-agent-live-browser-sse-apply-2026-07-07.json`; broader role/tool/provider sweeps remain under `BUG-SHELL-12` / `RISK-AGENT-REAL-LLM-SSE`.


## Batch 18 — Media participant cleanup state

**Status:** fixed in current branch, targeted verified

**Risk zone:** `RISK-MEDIA-LIVEKIT-JITSI-CALL`

**Surface:** `/calls/[roomId]`, `apps/web/src/lib/call/call-engine.ts`

**Fix evidence:** `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-media-participant-left-on-cleanup-2026-07-07.json`

**Original expected:** after a successful LiveKit join, cleanup/unmount/refresh records participantState `left` exactly once; cleanup before connect or failed token does not send `left`.

**Original actual:** cleanup disconnected the LiveKit room but did not post `left`, so a user who closed/refreshed after joining could remain `joined` in backend participant state.

**Fix applied:** `useCallEngine` tracks the joined session only after successful connect and uses one idempotent `markParticipantLeft()` path for explicit leave and cleanup.

**Verification:** `cmd /c ..\..\node_modules\.bin\vitest.cmd run --config vitest.config.ts src/lib/call/call-engine.test.tsx` → 4 tests passed; `corepack pnpm --filter @kiss-pm/web typecheck` → passed.

**Remaining:** full LiveKit/Jitsi provider browser traversal remains unverified: provider config, prejoin, permissions, real join, remote participant, media-denied behavior, reconnect, leave/rejoin.
