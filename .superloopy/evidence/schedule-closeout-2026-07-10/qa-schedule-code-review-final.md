# Schedule Closeout Code Review

## Verdict

**REJECT**

В текущем diff есть два High-блокера и три Medium-блокера. Unit/typecheck проходят, но они не покрывают реальные live-контракты, на которых проявляются основные дефекты.

## Findings

### High 1. Live Schedule потерял справочник ресурсов

- **Файлы:** `apps/web/src/delivery/schedule/schedule-surface.tsx:56`, `apps/web/src/delivery/schedule/schedule-surface.tsx:356`, `apps/web/src/delivery/schedule/schedule-editors.tsx:52`, `apps/api/src/planning/planningReadModel.ts:64`, `packages/domain/src/planning/planningReadModel.ts:47`
- **Confidence:** Confirmed
- **Сценарий:** администратор открывает live Schedule и пытается назначить/сменить исполнителя. `planningResourcesOf()` читает `readModel.authored.resources`, затем пустой override передаётся в `ResourceEditor` и `TaskModal`. В каноническом `PlanningReadModel.authored` поля `resources` нет, и API `createPlanningReadModel()` его не формирует. Поэтому список исполнителей пуст, а существующие назначения показываются как `Участник xxxx`.
- **Почему это регрессия:** diff удалил `useResourceDirectory()` из Schedule и заменил его на cast к несуществующему полю. Переданный `[]` считается override, поэтому `useResourceDirectory` уже не делает live-запрос `/api/workspace/users`.
- **Тест скрывает дефект:** `schedule-batch-integrity.test.tsx:171-204` вручную добавляет `authored.resources`, которого нет в production-контракте.
- **Нужно:** вернуть live resource directory как источник имён/selector options либо официально добавить ресурсы в доменный read-model, API-проекцию и типы. Тест должен использовать каноническую production-форму без фиктивного поля.

### High 2. TSV-import сохраняет календарно неверные даты и durationMinutes

- **Файл:** `apps/web/src/delivery/schedule/schedule-productivity.ts:11`, `apps/web/src/delivery/schedule/schedule-productivity.ts:100`, `apps/web/src/delivery/schedule/schedule-productivity.ts:106`, `apps/web/src/delivery/schedule/schedule-productivity.ts:151`
- **Confidence:** Confirmed
- **Сценарий:** проект работает по 6-часовому календарю; пользователь импортирует задачу со стартом `2026-07-10` (пятница), длительностью 2 дня и трудом 12 часов. Текущий код показывает finish `2026-07-12` (воскресенье) и отправляет `durationMinutes: 960`. По календарю проекта это должны быть 720 минут и рабочий finish `2026-07-13`.
- **Свежая репродукция:** inline `tsx` на текущем коде вернул `finishIso: "2026-07-12"` и `durationMinutes: 960`.
- **Impact:** до 200 задач за импорт получают тихо неверную длительность/дату; preview говорит про одни дни, а scheduling engine затем нормализует другой график.
- **Причина:** TSV path всё ещё использует `MINUTES_PER_DAY = 480`, `daysBetween()` и `addIsoDays()`, хотя остальные новые Schedule-команды переведены на `schedule-working-time`.
- **Нужно:** строить TSV preview/commands через project/task calendar и working-time helpers; добавить кейсы non-8h calendar, weekend и holiday.

### Medium 3. План-ридер не может загрузить live-историю коммитов

- **Файлы:** `apps/web/src/delivery/lib/planning-client.ts:75`, `apps/api/src/auditRoutes.ts:33`, `packages/access-control/src/index.ts:114`, `apps/web/src/delivery/commits/commits-permission.test.tsx:92`
- **Confidence:** Confirmed
- **Сценарий:** пользователь имеет только `tenant.projects.read` + `tenant.project_plan.read`, как fixture `plan-reader-no-resources`. UI-тест утверждает, что история читается, но live client вызывает `/api/tenant/current/audit-events`; endpoint требует отдельное `tenant.audit_events.read` и возвращает 403.
- **Impact:** вкладка Commit history функционально недоступна штатному read-only пользователю, несмотря на разрешённый planning read-model и заявленное поведение теста.
- **Нужно:** либо дать project-scoped planning history endpoint с `tenant.project_plan.read`, либо явно ограничить вкладку и продуктовый контракт правом audit read. Добавить integration test с реальным policy/route, а не mock `loadCommits`.

### Medium 4. Ошибка загрузки commit history превращается в пустой экран и unhandled rejection

- **Файлы:** `apps/web/src/delivery/commits/commits-surface.tsx:48`, `apps/web/src/delivery/lib/planning-client-commits-error.test.ts:111`
- **Confidence:** Confirmed
- **Сценарий:** audit endpoint отвечает 403/500 либо сеть падает. Client теперь намеренно пробрасывает ошибку, но `useEffect` делает `void loadCommits().then(...)` без `catch`, error state или retry. Read-model остаётся `ready`, поэтому поверхность показывает пустую историю вместо ошибки.
- **Дополнительный race:** несколько незавершённых `loadCommits()` не имеют cancellation/generation guard и могут перезаписать более свежие данные старым ответом.
- **Нужно:** отдельный status/error для history, catch + retry и защита от stale response. Добавить surface test на rejected `loadCommits`.

### Medium 5. OpenAPI не описывает новый обязательный revert contract и противоречит response

- **Файлы:** `apps/api/src/apiDocs/openApiDocument.ts:140`, `apps/api/src/apiDocs/schemas/planning.ts:875`, `apps/api/src/planningParsers.ts:103`, `packages/planning-client/src/api/types.ts:47`
- **Confidence:** Confirmed
- **Сценарий:** generated client следует OpenAPI и вызывает `revert-last` без body. Runtime требует `targetCommitId`, `clientPlanVersion`, `idempotencyKey` и вернёт 400. Кроме того, runtime response содержит `reverted`, а заявленный `PlanningApplyResponse` имеет `additionalProperties: false` и этого поля не допускает.
- **Нужно:** добавить `PlanningRevertRequest` и `PlanningRevertResponse` schemas и привязать request/response к route definition; добавить schema contract test.

### Low 6. Calendar-aware modal продолжает показывать формулу на 8 часов и закрывается после локального permission reject

- **Файлы:** `apps/web/src/delivery/schedule/schedule-editors.tsx:247`, `apps/web/src/delivery/schedule/schedule-editors.tsx:248`, `apps/web/src/delivery/schedule/schedule-editors.tsx:275`, `apps/web/src/delivery/schedule/schedule-surface.tsx:1023`
- **Confidence:** Confirmed
- **Сценарий 1:** на 6-часовом календаре задача 1 день / 6 часов отображается как 75% units, хотя сохраняется как 100%.
- **Сценарий 2:** plan manager без resource-manage меняет труд назначенной задачи; parent отклоняет submit и показывает toast, но child безусловно вызывает `onOpenChange(false)`, закрывая modal и теряя введённые значения.
- **Нужно:** передавать workingMinutesPerDay в modal и возвращать success/failure из submit, закрывая его только после принятого действия.

## Targeted Verification

Passed:

- `pnpm vitest run ...planningRevertRoute.test.ts ...schedule-productivity.test.ts ...schedule-calendar-semantics.test.ts ...schedule-batch-integrity.test.tsx ...planning-error-mapping.test.ts ...planning-client-commits-error.test.ts ...commits-permission.test.tsx --config vitest.config.ts` -> 7 files, 55 tests passed.
- `pnpm vitest run apps/web/src/delivery/schedule packages/planning-client/src/api/planningApiClient.test.ts --config vitest.config.ts` -> 10 files, 39 tests passed.
- `pnpm --filter @kiss-pm/web typecheck` -> passed.
- `pnpm --filter @kiss-pm/api typecheck` -> passed.
- `pnpm --filter @kiss-pm/planning-client typecheck` -> passed.
- Scoped `git diff --check` -> passed (CRLF warnings only).
- Inline `tsx` TSV reproduction -> confirmed Sunday finish and 960-minute duration.

Not run:

- `planningRoutes.db.test.ts`: suite truncates the configured database and was not safe to run while other workers/services own shared state.
- `e2e/full-eval/projects-schedule-closeout.spec.ts`: requires fixed live ports/database and was not safe to start against the active workspace services. Its C07 covers admin commits only; it does not cover the plan-reader permission mismatch.

The all-Schedule Vitest run emitted `ECONNREFUSED/ECONNRESET` stderr from navigation tests attempting localhost navigation, although Vitest reported all tests passed. This weakens those tests as clean evidence but does not affect the findings above.

## CodeGraph

- Index healthy: 2,237 files, 25,062 nodes, 53,349 edges.
- Ran context/explore for `ProjectSchedule`, `usePlanning`, `createDeliveryPlanningClient`, `registerPlanningRevertRoute`, parser/apply paths and working-time/compensation helpers.
- Ran impact for `registerPlanningRevertRoute` and `usePlanning`; the latter reaches Assignments, Resources, Overview and Commits, so idempotency/error changes are shared behavior.
- CodeGraph did not resolve `runDataSourceTransaction`, `lockTenantResourcePlanning`, or `canReadAuditEvents`; disclosed fallback was targeted `rg` plus direct reads of the exact files.
- Per task instruction, no `codegraph sync` was run for this read-only review.

## Testing Gaps

- No production-shaped test proves Schedule resource options using the actual `PlanningReadModel` plus `/api/workspace/users`.
- No non-8h/weekend TSV test.
- No live policy test for project-plan reader on Commit history.
- No Commit surface rejection/stale-response test.
- No OpenAPI test for the revert request/response envelope.
- Revert unit concurrency uses a serialized in-memory harness; the DB regression test covers happy path but not two simultaneous first requests with the same new key.

## Scope And Change Index

Reviewed the requested Schedule, planning hook/client, commits, planning-client package, revert route/parser, governed apply/transaction wiring and focused tests. Saved View rename API/persistence implementation was excluded. Existing worker reports under this evidence root were not used as evidence.

Repository changes made by this review:

- Added `.superloopy/evidence/schedule-closeout-2026-07-10/qa-schedule-code-review-final.md`.
- Product/test files changed: none.
- CodeGraph nodes/edges before -> after: unchanged for source code; evidence Markdown is outside the indexed source change surface.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/qa-schedule-code-review-final.md
