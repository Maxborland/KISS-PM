# Lane 06: Security/access-control audit — Projects

Дата: 2026-07-10
Ветка: `codex/pre-prod-hardening-on-master`
Режим: source review + non-DB unit tests; продуктовые файлы не изменялись.

## Executive summary

Вердикт: **FAIL до исправления SEC-PROJ-001**.

Найдено 3 проблемы:

| ID | Severity | Кратко |
|---|---|---|
| SEC-PROJ-001 | High | Полный `PATCH /api/workspace/tasks/:taskId` позволяет постановщику обойти допустимые переходы статусов и acceptance workflow |
| SEC-PROJ-002 | Medium | Audit события комментария ложно указывают `task_participant_role` для актора, прошедшего по `tenant.tasks.edit` |
| SEC-PROJ-003 | Low | Create-task принимает `id`, который затем отвергают все task route-парсеры |

Критических проблем и подтверждённого cross-tenant чтения/записи не найдено. Same-origin/session controls и destructive-action authorization в просмотренных путях fail closed. При этом аудит ограничен исходниками и non-DB тестами: поведение Postgres и DB-транзакций не исполнялось.

## Scope

Проверено:

- прямые Next routes `/projects`, `/projects/:id`, все `/projects/:id/*` и `apps/web/src/proxy.ts`;
- API routes `/api/workspace/projects*`, project task reads/mutations, project planning, knowledge, control и closure paths;
- tenant/horizontal scoping через `actor.tenantId`, project/task binding и persistence predicates;
- RBAC, participant-role fallbacks, hidden-control/direct-call bypass;
- project/task route IDs, JSON size/content type и предметные body bounds;
- cookie session, same-origin mutation middleware и trusted-origin policy;
- audit attribution/transaction coupling;
- archive/delete/close and other destructive operations;
- только source и unit tests без DB-конфига.

Вне scope:

- любые `*.db.test.ts`, `vitest.db.config.ts`, миграции, seed/reset и live DB;
- browser/E2E execution, network/deployment proxy, TLS termination;
- исправления продукта.

## Findings

### SEC-PROJ-001 — High — Full task PATCH bypasses status-transition and acceptance policy

**Impact.** Актор-постановщик без `tenant.tasks.edit`/`tenant.projects.manage` может прямым запросом перевести задачу из `new` сразу в любой активный статус, включая `done`, хотя специализированный status endpoint запрещает `new -> done`. Так обходятся workflow/hidden controls; событие также журналируется как общий `task.updated`, а не `task.status_changed`.

**Source evidence.**

1. `apps/api/src/projectWorkRoutes.ts:186-216` принимает полный task PATCH и делегирует `updateTask` после requester-aware preflight.
2. `apps/api/src/project-work/taskCommandGuards.ts:97-126` даёт `canEditTaskFields(...).allowed=true` текущему `task.requesterUserId` даже без edit/manage permission.
3. `apps/api/src/project-work/taskUpdateCommands.ts:29-32,55-66` повторяет тот же requester-aware check до и после planning lock.
4. `apps/api/src/planningTaskCompatibility.ts:55-103` добавляет `task.update_status`, если `body.statusId !== task.statusId`.
5. `apps/api/src/project-work/taskCommandGuards.ts:129-140` проверяет дополнительное право только для assignment-команд; status-команда проходит.
6. В этом пути нет `isTaskStatusTransitionAllowed` и acceptance check. Они есть только в `apps/api/src/project-work/taskLifecycleCommands.ts:152-191` у `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`.
7. `apps/api/src/project-work/taskUpdateCommands.ts:132-146` пишет `actionType: "task.updated"`, скрывая семантику обходного status transition.

**Exact HTTP repro.** Предусловия: действующая cookie постановщика задачи; профиль содержит только `tenant.projects.read`; текущая задача `status=new`, `requiresAcceptance=true`; `status-done` активен; assignments в теле не меняются.

```http
PATCH /api/workspace/tasks/task-1
Cookie: kiss_pm_session=<valid requester session>
Content-Type: application/json
X-Kiss-Pm-Action: same-origin

{
  "title": "Task",
  "description": null,
  "priority": "normal",
  "statusId": "status-done",
  "plannedStart": "2026-07-10",
  "plannedFinish": "2026-07-10",
  "durationWorkingDays": 1,
  "plannedWork": 8,
  "requiresAcceptance": true,
  "clientUpdatedAt": "<current task updatedAt>",
  "participants": [{"userId":"user-executor","role":"executor"}]
}
```

**Command-backed pure repro.** `bun -e` импортировал `canEditTaskFields`, `isTaskStatusTransitionAllowed` и `buildUpdateTaskPlanningCommands` с указанными входами. Exit 0:

```json
{
  "editDecision": {
    "allowed": true,
    "reason": "same_tenant_permission_granted",
    "authorizationBasis": "task_requester_role",
    "participantRole": "requester"
  },
  "canonicalNewToDoneAllowed": false,
  "directPatchStatusCommand": {
    "type": "task.update_status",
    "payload": { "taskId": "task-1", "statusId": "status-done" }
  },
  "requiresAcceptance": true
}
```

**Expected.** Full PATCH must not mutate status, or it must call the same transition/acceptance authorization used by the dedicated status endpoint and emit the same audit semantics.

### SEC-PROJ-002 — Medium — Comment audit misstates the authorization basis

**Impact.** Пользователь с `tenant.tasks.edit`, не являющийся участником задачи, законно создаёт комментарий, но audit trail утверждает, что действие разрешено через `task_participant_role`. Это снижает доказательность журнала при расследовании и проверке делегированных прав.

**Source evidence.**

- `apps/api/src/project-work/taskCommentCommands.ts:37-44` допускает `(participant OR canEditTaskFields)`.
- `apps/api/src/project-work/taskCommentCommands.ts:79-99` безусловно пишет `reason: "task_participant"`, `authorizationBasis: "task_participant_role"` и participant role, даже когда сработала permission-ветка.

**Command-backed repro.** `createTaskComment` вызван с in-memory deps, актором `editor`, permission `tenant.tasks.edit` и задачей, где editor отсутствует в `participants`. Exit 0:

```json
{
  "result": { "ok": true },
  "auditPermissionResult": {
    "allowed": true,
    "reason": "task_participant",
    "authorizationBasis": "task_participant_role"
  }
}
```

Поле `participantRole` при этом `undefined` и исчезает из JSON. Expected: сохранить фактический `canEditTaskFields` decision (`permission: tenant.tasks.edit`, `authorizationBasis: permission`) либо participant basis, в зависимости от реально сработавшей ветки.

### SEC-PROJ-003 — Low — Create body accepts task IDs that task routes reject

**Impact.** Авторизованный creator может создать malformed/unbounded task ID, который нельзя затем адресовать через task routes. Это нарушение integrity/availability внутри tenant: orphan-like записи, неработающие ссылки и большие ID в planning/audit payloads. Глобальный JSON limit ограничивает запрос 64 KiB, но самого `id` bounds нет.

**Source evidence.**

- `apps/api/src/projectWorkParsers.ts:86-90` извлекает optional `id`, но не вызывает identifier validator.
- `apps/api/src/project-work/taskCreateCommands.ts:65,200` использует клиентский `body.id` как persistence/planning ID.
- `apps/api/src/routeParamParsers.ts:146-153` принимает route IDs только по `^[a-z0-9][a-z0-9_-]{2,119}$`.

**Command-backed repro.** Exit 0:

```json
{
  "createBody": {
    "ok": true,
    "value": { "id": "bad..id", "title": "Valid task" }
  },
  "routeParam": {
    "ok": false,
    "error": "invalid_task_id"
  }
}
```

Expected: absent ID remains server-generated; supplied ID must pass the same `parseTaskIdParam` contract and length bound.

## No-finding areas

### Direct-route guards

- `apps/web/src/proxy.ts:16-38` redirects requests without `kiss_pm_session` from every non-public page, including all project routes, to `/login?from=<pathname>` before project client code executes.
- `apps/web/src/proxy.ts:41-44` excludes API/assets only; API performs real authentication.
- Proxy deliberately checks cookie presence, not validity. A forged/stale cookie can render the shell, but reviewed project APIs still return 401 and no protected data was found embedded in server-rendered project pages.

### Tenant and horizontal access

- Project list/detail/task code derives tenant only from `actor.tenantId`: `projectIntakeRoutes.ts:269-281`, `taskReadWorkspace.ts:68-122,146-193`.
- Production persistence predicates include tenant: `projectIntakeRepository.ts:482-495`, `projectWorkRepository.ts:358-439,537-577`.
- Cross-project status mutation binds the task by listing tasks for the already tenant-scoped route project: `taskLifecycleCommands.ts:138-150`.
- Knowledge object lookup and archive bind `tenantId + projectId + entityId`; project access resolves from the actor tenant: `knowledgeRoutes.ts:438-496` and `191-228`.

No confirmed cross-tenant read/write was found. Within a tenant, Projects uses tenant-wide permissions rather than project membership; see Doubts.

### Same-origin and session

- `apps/api/src/app.ts:106-118,309-312` applies same-origin protection to every API mutation except login.
- The guard requires `x-kiss-pm-action: same-origin` and rejects `Sec-Fetch-Site: cross-site` or an untrusted `Origin`: `requestSecurity.ts:17-39`.
- Session cookie is `HttpOnly; SameSite=Lax`, with `Secure` controlled fail-closed in production: `authSession.ts:35-60`, `runtimeSecurityConfig.ts:28-37`.
- Token syntax is fixed 64-hex, lookup uses token hash, expiry is checked, inactive users are rejected, and access profiles are looked up by actor tenant: `authSession.ts:18-25`, `app.ts:129-152,168-183,196-203`.

### Destructive action authorization and audit coupling

- Task archive requires `tenant.tasks.delete` both before and after planning lock and writes audit through the transaction data source: `taskLifecycleCommands.ts:24-95`.
- Knowledge document archive requires project manage, is tenant/project/entity scoped, and writes audit in the same transaction: `knowledgeRoutes.ts:191-228,462-487`.
- Task update/status/create and task-status-definition mutations generally pass `transactionDataSource` into `appendManagementAuditEvent`; no mutation-without-audit path was confirmed apart from idempotent no-op returns.
- Planning mutations authorize commands server-side; the visible deadline edit control is not an authorization boundary.

### IDs and body bounds

- Route identifiers are normalized and bounded to 120 chars: `routeParamParsers.ts:146-153`.
- JSON requests enforce content type, validated `Content-Length`, and streamed 64 KiB maximum: `jsonBody.ts:1-80`.
- Task fields bound title, description, duration, work, participant count/roles and comments: `projectWorkParsers.ts:86-142,164-219,232-345`.
- Exception: client-supplied create-task `id`, reported as SEC-PROJ-003.

## Test evidence

### Passing non-DB tests

Command 1:

```powershell
node node_modules/vitest/vitest.mjs run apps/api/src/routeAuth.test.ts apps/api/src/requestSecurity.test.ts apps/api/src/authSession.test.ts apps/api/src/runtimeSecurityConfig.test.ts apps/api/src/projectWorkParsers.test.ts apps/api/src/projectIntakeParsers.test.ts apps/api/src/app.test.ts packages/access-control/src/policy.test.ts
```

Result: **8 files, 117 tests passed**, exit 0, 4.62 s.

Command 2:

```powershell
node node_modules/vitest/vitest.mjs run apps/api/src/entityAccess.test.ts apps/api/src/knowledgeRoutes.test.ts apps/api/src/jsonBody.test.ts apps/api/src/planningAutoSolverRoutes.test.ts apps/api/src/planningEventsRoute.test.ts apps/api/src/control/controlSignalCommandHandlers.test.ts apps/api/src/retrospectiveRoutes.test.ts apps/api/src/routeParamParsers.test.ts
```

Result: **8 files, 48 tests passed**, exit 0, 3.76 s.

Оба запуска использовали только перечисленные unit-файлы. Ни одного `*.db.test.ts`, DB config, migration, seed/reset или E2E command не запускалось. Оба Vitest запуска были повторены вне sandbox только потому, что sandbox блокировал дочерний процесс esbuild (`spawn EPERM`).

Раннер дважды вывел существующее предупреждение `packages/domain/src/planning/commandReducer.ts:582`: duplicate `case "assignment.delete"`; оно вне security scope этой lane.

### Other commands/evidence

- `codegraph sync` — exit 0, index already up to date.
- CodeGraph `status/context/explore/search/node` — вход в Projects/auth/planning/task area до raw reads.
- `rg -n` и line-numbered `Get-Content -LiteralPath` — literal route/test inventory and exact source lines после CodeGraph.
- Три `bun -e` pure repro — exit 0; не обращались к DB и не писали файлы.
- `pnpm exec tsx -e ...` — **не выполнен**: pnpm попытался восстановить bin links и остановился на `ERR_PNPM_IGNORED_BUILDS`; репро затем успешно выполнены через `bun -e`.
- Первый sandboxed Vitest command — **не выполнен** из-за `spawn EPERM`; идентичный фиксированный command вне sandbox прошёл.

## Test gaps

1. Нет non-DB regression test, доказывающего, что full task PATCH не может обойти `isTaskStatusTransitionAllowed`/acceptance checks. Existing DB tests проверяют специализированный status endpoint, но не adversarial `statusId` в полном PATCH.
2. Нет теста audit `permissionResult` для comment author с `tenant.tasks.edit`, который не является участником.
3. Нет теста равенства create-task ID contract и route task-ID contract; текущий parser test проверяет их отдельно.
4. Cross-tenant project/task repository checks в основном находятся в DB suites; по условиям lane они не исполнялись.
5. Planning apply authorization имеет значимое покрытие в `planningRoutes.db.test.ts`, но DB suite запрещён этой assignment.
6. Direct-route E2E inventory не проверяет forged/stale cookie; proxy пропускает такой request до shell, а API затем должен вернуть 401.
7. Нет executable verification rollback atomicity, если audit append падает после project/task mutation; это требует DB transaction test.

## Doubts and assumptions

- **Project membership.** В просмотренной модели нет project-membership ACL; `tenant.projects.read/manage` сознательно открывает все проекты tenant. Это не отмечено как finding. Если продуктовая политика требует project-level membership/assigned-only visibility, текущая реализация представляет системный horizontal-access gap.
- **Full PATCH intent.** Теоретически status change через полный PATCH мог быть задуман. Но отдельный status endpoint, явная transition matrix и acceptance checks делают SEC-PROJ-001 high-confidence bypass, пока контракт прямо не заявит обратное.
- **Proxy semantics.** Presence-only cookie check оценён как UX gate, не security boundary. Требование валидировать сессию до отдачи HTML изменит вывод для direct routes.
- Source read отражает рабочее дерево во время параллельной работы других lanes; чужие изменения не откатывались и не редактировались.

## Unverified

- Postgres constraints, DB isolation, transaction rollback and concurrent row behavior.
- DB-config tests, migrations, seed/reset and any shared-database state.
- Browser/E2E navigation, rendered hidden controls and live network traces.
- Production reverse-proxy headers, trusted-origin environment and TLS/cookie behavior after deployment.
- Whether audit storage is append-only/tamper-resistant outside application authorization.

## CodeGraph change index

- Before report: **2177 files, 24140 nodes, 52020 edges**.
- Product symbols added/changed/removed by this lane: **0 / 0 / 0**.
- Files touched by this lane: `.superloopy/evidence/projects-2026-07-10/lane-06-security.md` only.
- After final sync: **2180 files, 24189 nodes, 52080 edges**.
- Observed index delta: **+3 files, +49 nodes, +60 edges**. These are concurrent TypeScript additions/changes from other lanes visible in the shared worktree; the Markdown report itself is not AST-indexed and this lane changed no product symbol.

SUPERLOOPY_EVIDENCE: E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-06-security.md
