 KISS PM production blocker remediation plan

 Request

 Составить и затем выполнить детальный план исправления всех блокеров и малых stopper-ов, которые отделяют KISS PM от production readiness, с особым фокусом на:

 1. функциональность проектного управления по всему бизнес-процессу;
 2. визуальную стабильность, красоту и удобство UI/UX;
 3. честные production/founder-beta gates без фальшивых green-сигналов.

 Planning basis

 План основан на уже выполненном repo/master readiness audit и дополнительной read-only проверке backend, frontend, UI/UX, QA/CI и beta specs.

 ### Confirmed audit facts

 - Branch during audit: codex/backend-prod-go-no-go-fixes, ahead 1 / behind 2 relative to origin/master.
 - GitHub/origin master during audit: dfeda24cfcef19a71c9c3647fe8fce883e1cba73.
 - Current HEAD during audit: 2bac627cec135431112b17c9d38ee13525c7798c.
 - Worktree was dirty with staged runtime QA files, unstaged docs/CSS/runtime-test edits, and untracked beta/marketing/reference/runtime style paths. Treat all dirty/untracked files as
 user work until inspected.
 - apps/web/src/app exposes only runtime / and /_not-found; / renders KISS PM — design-v3 foundation, not product shell.
 - pnpm build confirmed only / and /_not-found as App Router production routes.
 - Storybook/static screens exist under apps/web/src/views/** and apps/web/src/widgets/**, but runtime product routes are not wired to API-backed data.
 - Existing view blocks include hardcoded/mock/demo data and fake/dead controls: MOCK_PROJECT_CRM, GANTT_MOCK, RESOURCE_MATRIX_MOCK, disabled demo buttons, href="#",
 placeholder/prototype copy.
 - Backend has substantial real route/persistence/domain coverage for auth, RBAC, audit, CRM/opportunities, project work, planning, capacity/resources, control, background jobs, DB
 migrations and OpenAPI inventory.
 - Confirmed API contract drift: apps/api/src/auditRoutes.ts returns { auditEvents: [...] }, while apps/api/src/apiDocs/schemas/workspace.ts documents { events: [...] }.
 - Confirmed production safety risk: KISS_PM_E2E_TEST_HOOKS=1 registers planning test mutation route, but production server config did not reject that env during audit.
 - pnpm test failed because apps/api/src/occupancyRoutes.test.ts fixture session expired on 2026-06-01.
 - pnpm security:check failed on a critical vitest advisory.
 - Targeted e2e/smoke failed 7/7 because login/workspace routes expected by tests do not exist in runtime.
 - pnpm typecheck, pnpm build, pnpm verify:storybook-contract, pnpm qa:runtime, pnpm test:db, and pnpm security:scan passed during audit, but these do not prove production readiness.

 Product and engineering decisions

 ### Production definition used by this plan

 Production readiness has two layers and both must be addressed:

 1. Founder-beta/runtime readiness
     - Users can execute the project-management business process in the browser with real runtime data, real persisted actions, role states, audit proof, screenshots, and no demo UI.
 2. Strict self-hosted/public production readiness
     - Red tests/security gates fixed, no exposed test/dev surfaces, API/OpenAPI contracts accurate, migrations/seed/DB verified, release CI gates in place, readiness/privacy/ops
 behavior safe.

 ### Scope decision

 Do a clean runtime cutover, not a backend rewrite:
 - keep the existing backend/domain/persistence APIs as the source of truth where they already exist;
 - add/fix backend only where contract, safety, missing DTO, permission/audit, or persistence gaps are confirmed;
 - transform Storybook/static blocks into runtime-safe presentational components, with route containers owning data, actions, states, conflicts, and permissions.

 ### Route/product scope for production-track beta

 Core route set to make real (пути сверены с `apps/web/src/app/**` на 2026-07-19; исходные plan-time имена `/deals*` и `/projects/:id/timeline` в рантайме приземлились как `/crm/deals*` и `/projects/:id/schedule`):
 - / or /dashboard — operational attention cockpit (`/` — auth-aware redirect: нет сессии → `/login`, есть → `/my-work`, `apps/web/src/app/page.tsx`; боевой рабочий экран — `/dashboard`);
 - /crm/deals — real deals pipeline/list (`apps/web/src/app/crm/deals/page.tsx`);
 - /crm/deals/:id — deal detail, feasibility/handoff/activation (`apps/web/src/app/crm/deals/[id]/page.tsx`);
 - /crm/clients, /crm/contacts, /crm/products — live CRM directory routes (не «intentionally absent»; `apps/web/src/app/crm/{clients,contacts,products}/page.tsx`);
 - /projects — real projects list;
 - /projects/:id — project overview + task management;
 - /projects/:id/schedule — real Gantt/planning screen (route — `schedule`, не `timeline`: `apps/web/src/app/projects/[id]/schedule/page.tsx`);
 - /projects/:id/resources — workload/resource/conflict screen;
 - /my-work — current-user execution queue and actions;
 - /agent — global workspace agent with confirmation/audit;
 - /admin/users, /admin/roles, /admin/audit — minimal real admin/RBAC/audit;
 - /settings — workspace settings (реальный route — `/settings`, не `/settings/workspace`: `apps/web/src/app/settings/page.tsx`).

 All other routes must be hidden, removed, protected behind an explicit unavailable state, or marked deferred without fake controls.

 ### UI/UX acceptance bar

 A screen is not acceptable just because it renders or passes Storybook. It must:
 - have one obvious operational job in the first screenful;
 - use business Russian copy, not debug/API/internal labels;
 - prioritize risk, deadline, owner, blocker, workload, and next action;
 - show loading, empty, no-results, error, read-only/forbidden states;
 - persist every visible enabled mutation after reload;
 - avoid UUID/debug/status/source labels outside admin/audit;
 - avoid demo/placeholder/foundation/Storybook/prototype copy;
 - pass desktop and narrow screenshot review without overlap, clipping, horizontal body overflow, hover layout shift, unreadable wrapping, or accidental sparse marketing layout.

 Execution model

 - Work in small vertical slices. Each slice must start from a clear acceptance scenario and end with targeted verification.
 - Do not merge or rely on dirty worktree blindly. First inspect every staged/unstaged/untracked file that overlaps a slice.
 - Do not keep aliases/stubs/placeholders for compatibility. Use clean cutover with updated callers/tests/docs.
 - Do not implement fake affordances. A visible control must work, be hidden, or be disabled with a precise business reason.
 - Do not run full gates after every tiny change. Run targeted tests per slice, then full release gates at checkpoints.
 - For exported symbols, routes, API shapes, permission keys, and shared components, use CodeGraph/LSP where available and check references before changes.

 Phase 0 — repo hygiene and release base

 ### Goal

 Start from a safe integration base and prevent accidental shipping of dirty/user artifacts.

 ### Tasks

 1. Capture current git status --short --branch, HEAD, origin/master, and changed-file groups.
 2. Inspect every dirty/untracked file before using or deleting it:
     - staged runtime QA workflow/tests/script/package/playwright changes;
     - unstaged AGENTS.md, beta docs, CSS/runtime test changes;
     - untracked .agents/, .kiss-pm-storage/, marketing docs, landing-agent-demo paths.
 3. Decide per file:
     - keep as implementation source;
     - convert into tracked canonical artifact;
     - ignore as local generated/storage artifact;
     - remove only after explicit confirmation or after proving it is generated/unrelated and safe.
 4. Reconcile branch being ahead/behind origin/master before broad implementation.
 5. Run CodeGraph cycle for code work:
     - codegraph status
     - codegraph sync
     - codegraph status

 ### Acceptance

 - A clean implementation base is chosen and documented.
 - No unrelated user changes are overwritten.
 - Local generated artifacts are not committed.

 ### Critical paths

 - AGENTS.md
 - .github/workflows/*
 - package.json
 - playwright.config.ts
 - scripts/run-runtime-qa.mjs
 - docs/beta/*
 - apps/web/src/styles/widgets/landing-agent-demo.css
 - apps/web/src/views/marketing/**
 - apps/web/src/widgets/landing-agent-demo/**
 - .kiss-pm-storage/

 ### Verification

 - git status --short --branch
 - codegraph sync && codegraph status

 Phase 1 — immediate red production blockers

 ### Goal

 Make the basic engineering gates honest and green before building on top.

 ### Slice 1.1 — fix expired occupancy test fixture

 #### Files

 - apps/api/src/occupancyRoutes.test.ts

 #### Change

 - Replace hard-coded expired session expiry with future-relative or far-future expiry while keeping tested event timestamps fixed.
 - Do not weaken auth behavior or skip assertions.

 #### Acceptance

 - Occupancy route tests exercise create/update/masking/archive, invalid range, and actor-default reads under a valid session.

 #### Verification

 - Targeted occupancy route test.
 - Then pnpm test after all Phase 1 fixes.

 ### Slice 1.2 — resolve security audit failure

 #### Files

 - package.json
 - apps/web/package.json
 - packages/*/package.json where vitest is declared
 - pnpm-lock.yaml
 - scripts/security-audit-backend.mjs
 - .github/workflows/security.yml

 #### Change

 - Align all backend/root-relevant vitest dependency specs to a patched version represented consistently in the lockfile.
 - Keep scripts/security-audit-backend.mjs narrow and documented; do not suppress backend-relevant critical advisories.
 - Add scripts/security-audit-backend.mjs to security workflow path triggers if missing.

 #### Acceptance

 - pnpm security:check passes without ignoring backend-relevant critical/moderate findings.
 - Security workflow triggers on changes to the audit script, dependency files, app/package files, and security workflow itself.

 #### Verification

 - pnpm security:check
 - pnpm security:scan

 ### Slice 1.3 — align audit OpenAPI/runtime contract

 #### Files

 - apps/api/src/auditRoutes.ts
 - apps/api/src/apiDocs/schemas/workspace.ts
 - apps/api/src/apiDocs/openApiDocument.ts
 - apps/api/src/apiDocs/openApiDocument.test.ts
 - frontend/API consumers/tests that parse audit response

 #### Change

 - Choose the lowest-risk clean cutover: document the existing runtime key auditEvents in OpenAPI instead of renaming runtime, unless fresh code inspection proves consumers already
 require events.
 - Document runtime query params, including limit and optional projectId, if supported by route.
 - Add/adjust tests so OpenAPI and runtime response key cannot drift again.

 #### Acceptance

 - /api/openapi.json documents AuditEventsResponse.required === ["auditEvents"] and property auditEvents.
 - Runtime /api/tenant/current/audit-events returns the documented shape.
 - Frontend/e2e helpers use the same key.

 #### Verification

 - pnpm test -- apps/api/src/apiDocs/openApiDocument.test.ts
 - targeted audit route/API test
 - pnpm test after Phase 1

 ### Slice 1.4 — forbid E2E test hooks in production

 #### Files

 - apps/api/src/serverConfig.ts
 - apps/api/src/serverConfig.test.ts or equivalent
 - apps/api/src/planning/registerPlanningRoutes.ts
 - apps/api/src/apiDocs/openApiDocument.test.ts
 - playwright.config.ts

 #### Change

 - Add production startup guard: NODE_ENV=production must reject KISS_PM_E2E_TEST_HOOKS=1 with stable machine-readable error.
 - Keep non-production Playwright ability to use planning test hooks.
 - Prefer central runtime config boolean over direct route-level process.env reads if it reduces coupling safely.
 - Keep public OpenAPI omitting test-hook route.

 #### Acceptance

 - Production cannot start with E2E hooks enabled.
 - Non-production E2E can still enable hook-specific tests.
 - Without hooks, planning bump test endpoint is absent/404.

 #### Verification

 - server config tests for production rejection and non-production allowance
 - OpenAPI test confirming omission
 - targeted planning hook test if present

 Phase 2 — real runtime shell and route foundation

 ### Goal

 Replace the foundation-only runtime with a real authenticated workspace shell and honest route surface.

 ### Slice 2.1 — authenticated shell entry

 #### Files

 - apps/web/src/app/page.tsx
 - apps/web/src/app/layout.tsx
 - apps/web/src/app/providers.tsx
 - new/updated App Router route groups under apps/web/src/app/**
 - apps/web/src/lib/api.ts
 - shell/layout components under apps/web/src/shell/** or apps/web/src/views/layout/**

 #### Change

 - Replace the root foundation page with a production entry:
     - if unauthenticated: login/session-required flow;
     - if authenticated: redirect/render dashboard cockpit.
 - Add route tree for beta scope.
 - Use real navigation links and active states; no href="#" in runtime shell.
 - Topbar actions must be screen-owned, not default fake Export/Create buttons.

 #### Acceptance

 - Direct navigation works for beta routes.
 - Root no longer shows foundation/Phase copy.
 - Non-beta routes are hidden or explicitly unavailable.
 - Auth state is visible and testable.

 #### Verification

 - pnpm --filter @kiss-pm/web typecheck
 - targeted route smoke for /, /dashboard, and /_not-found
 - desktop/narrow screenshot for shell

 ### Slice 2.2 — shared frontend API/query layer

 #### Files

 - apps/web/src/lib/api.ts
 - apps/web/src/lib/** or apps/web/src/features/** query modules if existing conventions allow
 - route containers under apps/web/src/app/**

 #### Change

 - Centralize typed API calls for auth, projects/tasks, opportunities/deals, planning, capacity/resources, audit, admin.
 - Map 401, 403, 404, 409, validation errors, and network errors to reusable UI states.
 - Ensure mutations include x-kiss-pm-action: same-origin through one transport path.

 #### Acceptance

 - Screens do not hand-roll inconsistent fetch/error handling.
 - No screen requests unused catalogs just because a Storybook block needed them.
 - Stale/conflict states can be represented, especially for planning.

 #### Verification

 - frontend API unit tests
 - targeted component/route tests for loading/error/forbidden/conflict states

 ### Slice 2.3 — remove demo coupling from runtime candidates

 #### Files

 - apps/web/src/views/screens/screen-view.tsx
 - apps/web/src/views/catalog.ts
 - apps/web/src/views/blocks/**
 - apps/web/src/widgets/gantt/**
 - apps/web/src/widgets/resource-matrix/**
 - apps/web/src/widgets/kanban/**

 #### Change

 - Split runtime-usable visual blocks into pure presentational components with typed props.
 - Keep Storybook mocks isolated to stories/catalog only.
 - Ensure MOCK_PROJECT_CRM, GANTT_MOCK, RESOURCE_MATRIX_MOCK, demo arrays, placeholder copy, disabled demo controls, and href="#" cannot reach runtime routes.

 #### Acceptance

 - Runtime bundle/routes consume API-backed view models only.
 - Storybook can still use fixture data without contaminating runtime.

 #### Verification

 - static search/check for banned runtime strings/imports
 - Storybook contract after affected blocks are adapted

 Phase 3 — project-management business process completion

 ### Goal

 Make the end-to-end business flow real:
 dashboard -> deal/intake -> feasibility -> project -> tasks -> Gantt -> resources -> My Work -> agent proposal -> confirmation -> audit.

 Phase 3A — Dashboard attention cockpit

 ### Files

 - apps/web/src/app/(workspace)/dashboard/page.tsx or actual route convention
 - apps/web/src/views/blocks/dashboard-bento.tsx
 - dashboard widgets/components under apps/web/src/widgets/**
 - apps/api/src/controlRoutes.ts
 - apps/api/src/controlSurfaceRoutes.ts
 - apps/api/src/projectWorkRoutes.ts
 - capacity/control read-model files if dashboard DTO gaps appear

 ### Change

 - Build a real CEO/PM attention cockpit from API-backed data:
     - overdue tasks;
     - blockers;
     - overloaded resources;
     - risky projects/control signals;
     - pipeline pressure/deal handoff items;
     - next allowed actions.
 - Dashboard links must open real entity IDs.

 ### Acceptance

 - Seeded risk/overdue/blocker/overload appears.
 - Empty/no-risk state is useful.
 - Forbidden/read-only states are explicit.
 - No static metric cards detached from actions.
 - First screenful clearly answers: “что требует моего внимания и что можно сделать”.

 ### Verification

 - route smoke for dashboard
 - dashboard API/read-model test if new backend DTO added
 - desktop/narrow screenshots
 - no console/pageerror/API failures

 Phase 3B — Deals, intake, feasibility, activation

 ### Files

 - apps/web/src/app/crm/deals/** (реализованный путь; plan-time было `app/**/deals/**`)
 - apps/web/src/views/blocks/deals-block.tsx
 - apps/api/src/projectIntakeRoutes.ts
 - apps/api/src/projectIntakeService.ts
 - packages/domain/src/projectIntake*
 - CRM/deal persistence files if stage/handoff gaps appear

 ### Change

 - Make /crm/deals and /crm/deals/:id real:
     - pipeline/list from GET /api/workspace/opportunities;
     - stage move persists;
     - deal detail shows client/contact/scope/value/dates/owner/next action;
     - feasibility action returns visible result;
     - activation creates/opens real project;
     - handoff context is visible in project.

 ### Acceptance

 - Stage change persists after reload.
 - Feasibility result visible and actionable.
 - Activate/handoff creates or opens project with deal context.
 - No hidden dependency on clients/projectTypes unless rendered.
 - Duplicate/validation/save-error states exist for create/update flows.

 ### Verification

 - API tests for stage/feasibility/activate if missing
 - Playwright deal pipeline/detail smoke
 - audit event proof for mutation
 - desktop/narrow screenshots

 Phase 3C — Projects list and project detail/tasks

 ### Files

 - apps/web/src/app/**/projects/**
 - apps/web/src/views/blocks/projects-list-block.tsx
 - task/project components under apps/web/src/components/domain/** or apps/web/src/widgets/**
 - apps/api/src/projectWorkRoutes.ts
 - apps/api/src/projectWorkParsers.ts
 - apps/api/src/taskReadWorkspace.ts
 - apps/api/src/taskCommandWorkspace.ts
 - persistence project/task repositories if field gaps appear

 ### Change

 - Make /projects and /projects/:id real:
     - list/open project by real ID;
     - project header/context from API;
     - task CRUD/status/owner/due/blocker/comment;
     - task activity/attachments if already supported;
     - project attention panel reflects blockers/overdue.

 ### Acceptance

 - Create/update/status/comment/blocker actions persist after reload.
 - Task status and blocker changes appear in project detail, My Work, and dashboard attention.
 - Invalid/forbidden/conflict states are visible.
 - Tables/lists are dense but readable; no raw debug/admin dump layout.

 ### Verification

 - targeted API tests for task mutations and audit
 - Playwright project detail/task mutation smoke
 - reload proof
 - desktop/narrow screenshots

 Phase 3D — Planning/Gantt timeline

 ### Files

 - apps/web/src/app/projects/[id]/schedule/** (реализованный путь; plan-time было `.../[id]/timeline/**`)
 - apps/web/src/views/blocks/gantt-slice-block.tsx
 - apps/web/src/widgets/gantt/**
 - packages/planning-gantt-ui/**
 - apps/api/src/planning/registerPlanningRoutes.ts
 - packages/domain/src/planning/**

 ### Change

 - Replace static GANTT_MOCK runtime usage with planning read-model:
     - render real tasks/milestones/dependencies/resource summaries;
     - preview command before apply;
     - apply command with planVersion;
     - handle 409 stale plan conflict by rereading and showing conflict state;
     - show validation issues for invalid dates/status/assignment.

 ### Acceptance

 - Timeline renders real tasks from selected project.
 - Date/status/assignment command previews before apply.
 - Applied command persists after reload and advances plan version.
 - Stale plan version path is tested and understandable.
 - Gantt remains usable at desktop/tablet widths with stable scroll/sticky behavior.

 ### Verification

 - planning API tests for preview/apply/conflict if missing
 - Gantt component tests for real read-model mapping
 - Playwright timeline command smoke
 - desktop/tablet/narrow screenshots where applicable

 Phase 3E — Resources/workload/capacity

 ### Files

 - apps/web/src/app/**/projects/[id]/resources/**
 - apps/web/src/views/blocks/project-resources-block.tsx
 - apps/web/src/widgets/resource-matrix/**
 - capacity API/client modules
 - capacity/persistence/domain files if read-model gaps appear

 ### Change

 - Replace RESOURCE_MATRIX_MOCK runtime usage with project planning resource load and tenant-wide capacity APIs:
     - overload signals;
     - missing role/coverage;
     - employee-day drilldown;
     - masked restricted metadata where required.

 ### Acceptance

 - Seeded overload and missing role appear with person, role, date, project/task contribution.
 - Restricted users see masked project metadata but complete totals.
 - Filters, empty, no-results, forbidden, and error states exist.
 - Matrix/table remains usable with stable horizontal scroll.

 ### Verification

 - capacity API tests for masking/totals if missing
 - resource matrix component tests
 - Playwright resources smoke
 - desktop/tablet screenshots

 Phase 3F — My Work execution queue

 ### Files

 - apps/web/src/app/**/my-work/**
 - apps/web/src/views/blocks/my-work-block.tsx
 - task action components
 - apps/api/src/projectWorkRoutes.ts
 - task command/read files

 ### Change

 - Build current-user work queue:
     - assigned tasks grouped by status/priority/due/project;
     - status update;
     - blocker reason;
     - comment/action result;
     - links back to project/task.

 ### Acceptance

 - Specialist sees assigned seeded tasks.
 - Status/comment/blocker mutations persist after reload.
 - PM dashboard/project detail reflects blocker/status changes.
 - Forbidden/read-only behavior is explicit for users without manage permissions.

 ### Verification

 - My Work API/unit tests if missing
 - Playwright My Work mutation smoke
 - reload proof
 - desktop/narrow screenshots

 Phase 3G — Global workspace agent

 ### Files

 - apps/web/src/app/**/agent/**
 - agent cockpit widgets/components
 - backend agent/proposal/action routes if present
 - apps/api/src/controlRoutes.ts
 - apps/api/src/controlSurfaceRoutes.ts
 - governed action/audit files

 ### Change

 - Implement global workspace agent, not project-specific hidden agent:
     - receives actor, route, role, visible entity context, allowed action list;
     - answers with grounded citations to visible entities;
     - creates structured proposals for allowed actions only;
     - requires explicit confirmation before any mutation;
     - shows success/failure result;
     - writes/links audit event.

 ### Acceptance

 - Agent can summarize dashboard/project/deal/My Work context with real entity references.
 - No mutation occurs before confirmation.
 - Confirmed mutation changes real state and persists.
 - Denied/failure path is visible and audited where required.
 - User can complete core workflows without agent.

 ### Verification

 - negative no-mutation-before-confirm test
 - positive confirmed mutation test
 - failure/denied test
 - audit event proof
 - desktop/narrow screenshots

 Phase 3H — Admin/RBAC/audit minimum

 ### Files

 - apps/web/src/app/**/admin/**
 - admin/users/roles/audit components
 - apps/api/src/authRoutes.ts
 - apps/api/src/auditRoutes.ts
 - access-control package
 - workspace/users/access profile route files

 ### Change

 - Make admin minimum real:
     - users list/status/profile;
     - roles/access profiles enough to affect UI/API behavior;
     - audit log with actor/action/entity/result and project filter.

 ### Acceptance

 - Role change affects UI/API behavior in an observable test.
 - Audit shows task/deal/planning/agent mutations.
 - Unauthorized users see forbidden/read-only states.
 - Admin tables are purposeful, not raw debug dumps.

 ### Verification

 - RBAC API tests
 - Playwright admin/role/audit smoke
 - audit route test
 - desktop/narrow screenshots

 Phase 4 — UI/UX stabilization and visual polish

 ### Goal

 Make the product feel coherent, stable, dense enough for real project work, and visually polished.

 ### Slice 4.1 — runtime-safe shell and navigation

 #### Files

 - apps/web/src/views/layout/workspace-chrome.tsx
 - shell/nav components
 - apps/web/src/styles/bem.css
 - apps/web/src/app/globals.css

 #### Change

 - Remove default fake topbar buttons.
 - Make nav route-driven and role-aware.
 - Ensure active state, breadcrumbs, title, status, and page actions are consistent.
 - Keep product copy Russian-first.

 #### Acceptance

 - No dead nav/action controls.
 - No clipped breadcrumbs/actions on narrow width.
 - Shell density stable across dashboard, project detail, timeline, resources, My Work.

 #### Verification

 - route smoke + visual screenshots

 ### Slice 4.2 — approve runtime primitives

 #### Files

 - apps/web/src/components/domain/data-table.tsx
 - apps/web/src/components/domain/**
 - apps/web/src/components/ui/**
 - apps/web/src/styles/bem.css
 - apps/web/src/styles/bem-supplement.css
 - apps/web/src/styles/widgets/**

 #### Change

 - Harden/approve core primitives:
     - DataTable: compact rows, loading, empty, error, no-results, forbidden/read-only, row actions, narrow behavior;
     - CardPanel: title/subtitle/action zones and flush table behavior;
     - FormGrid/field rows: validation, hint/error sizing, pending/save/error states;
     - Chip/status components for statuses/stages, Badge only for counts;
     - toolbar/filter components with predictable wrapping.

 #### Acceptance

 - Runtime screens use approved primitives instead of one-off tables/forms.
 - Technical labels/UUIDs hidden outside admin/audit.
 - Components have Storybook coverage with realistic states.

 #### Verification

 - component tests where present
 - Storybook contract
 - screenshots for key states

 ### Slice 4.3 — remove demo/debug/placeholder UI

 #### Files

 - apps/web/src/views/blocks/**
 - apps/web/src/widgets/**
 - runtime routes under apps/web/src/app/**
 - QA no-placeholder script if added

 #### Change

 - Remove or isolate runtime occurrences of:
     - foundation, Phase, Storybook, demo, prototype, подключится к API, React view, Smoke, raw UUIDs, raw API/source labels, hidden disabled demo controls.
 - Replace demo entity names with architecture-bureau realistic seed/copy.

 #### Acceptance

 - Runtime beta routes contain no visible demo/debug/placeholder copy.
 - Storybook may keep fixtures, but clearly isolated to stories.

 #### Verification

 - automated no-placeholder/no-debug scan
 - manual screenshot review

 ### Slice 4.4 — responsive and visual matrix

 #### Files

 - playwright.config.ts
 - e2e/runtime/**
 - e2e/a11y/**
 - screenshot helper/scripts if added
 - docs/beta/qa-gate.md

 #### Change

 - Add visual matrix for product routes:
     - dashboard: 1440, 1024, 390;
     - deals list/detail: 1440, 390;
     - projects list/detail: 1440, 1024, 390;
     - timeline: 1440, 1024;
     - resources: 1440, 1024;
     - My Work: 1440, 390;
     - agent: 1440, 390;
     - admin users/roles/audit: 1440, 390.
 - Assert no horizontal body overflow, no clipped primary action, no critical axe violation.

 #### Acceptance

 - Every production-critical screen has desktop/narrow evidence.
 - Screens pass visual review for density, hierarchy, stable layout, and operational clarity.

 #### Verification

 - pnpm qa:visual
 - pnpm qa:a11y
 - pnpm verify:storybook-contract

 Phase 5 — backend/API hardening beyond red blockers

 ### Goal

 Make backend behavior safe under production assumptions, not merely passing happy-path tests.

 ### Slice 5.1 — governed mutation audit policy

 #### Files

 - planning routes/services
 - CRM/opportunity mutation routes
 - project work mutation routes
 - attachment/control/action routes
 - audit helpers and tests

 #### Change

 - Define and apply policy:
     - denied permission for governed mutation is audited;
     - successful governed mutation is audited transactionally;
     - security-relevant replay/tamper/conflict attempts are audited as rejected where required;
     - simple validation errors need stable user errors, not noisy audit unless product requires it.

 #### Acceptance

 - Core task/deal/planning/agent mutations have success and denied/rejected audit coverage.
 - Audit executionResult.status is consistent.

 #### Verification

 - targeted route/unit/DB tests per route family

 ### Slice 5.2 — mutation guard and trusted-origin posture

 #### Files

 - apps/api/src/requestSecurity.ts
 - apps/api/src/runtimeSecurityConfig.ts
 - apps/api/src/app.ts
 - related tests
 - runbooks

 #### Change

 - Document and test production policy:
     - same-origin action header required for non-login browser mutations;
     - cross-site fetch metadata rejected;
     - trusted origins are exact origins only;
     - no wildcard/credential URL behavior;
     - production defaults fail safe.

 #### Acceptance

 - Missing/bad header, cross-site with header, allowed same-origin, configured trusted origin, invalid origin cases are tested.

 #### Verification

 - request security/app tests
 - pnpm test

 ### Slice 5.3 — readiness/privacy/ops checks

 #### Files

 - apps/api/src/serverReadiness.ts
 - health/readiness routes
 - apps/api/src/serverConfig.ts
 - runbooks
 - tests

 #### Change

 - In production, required DB/storage checks must be configured and fail closed.
 - If Redis/realtime backend is enabled, readiness includes realtime check.
 - Readiness body exposes only safe status/provider labels and stable error codes, not paths, bucket names, URLs, or exception text.

 #### Acceptance

 - Production cannot report ready with missing DB/storage checks.
 - Redis mode readiness fails if Redis unavailable.
 - Errors are redacted.

 #### Verification

 - server readiness/health tests

 Phase 6 — QA/CI/release gates

 ### Goal

 Prevent future false-ready states and make release decisions evidence-based.

 ### Slice 6.1 — route smoke and business smoke scripts

 #### Files

 - package.json
 - playwright.config.ts
 - scripts/run-runtime-qa.mjs
 - e2e/runtime/**
 - e2e/smoke/**

 #### Change

 - Add honest scripts:
     - qa:route-smoke for fast route load/no-runtime-errors/no-debug strings;
     - qa:visual for screenshot matrix;
     - qa:a11y for critical axe checks;
     - qa:release composing production release gates.
 - Separate normal release smoke from hook-enabled planning tests.

 #### Acceptance

 - Route smoke fails if a core route is missing, blank, has pageerror/console.error/requestfailed/API 4xx/5xx, or shows debug/demo strings.
 - Business smoke covers actual mutations for project-management path.

 #### Verification

 - pnpm qa:route-smoke
 - pnpm test:e2e:smoke

 ### Slice 6.2 — DB/migration/seed gate

 #### Files

 - package.json
 - .github/workflows/**
 - persistence migration/seed tests if gaps found

 #### Change

 - Add release/CI stage:
     - fresh Postgres service;
     - pnpm db:migrate;
     - pnpm db:seed:dev twice to prove idempotency;
     - pnpm test:db.

 #### Acceptance

 - Fresh DB can migrate and seed deterministically.
 - DB tests pass without relying on local existing state.

 #### Verification

 - pnpm db:migrate
 - pnpm db:seed:dev
 - pnpm db:seed:dev
 - pnpm test:db

 ### Slice 6.3 — CI workflow hardening

 #### Files

 - .github/workflows/runtime-qa.yml
 - .github/workflows/security.yml
 - .github/workflows/design-v3-storybook-contract.yml
 - new .github/workflows/release-gate.yml if chosen

 #### Change

 - Keep separate workflows for runtime QA, Storybook contract, and security.
 - Add or expand release gate to cover:
     - install;
     - typecheck;
     - build;
     - unit tests;
     - DB migrate/seed/test;
     - OpenAPI contract;
     - runtime route smoke;
     - business e2e smoke;
     - visual/a11y;
     - security;
     - artifact upload.

 #### Acceptance

 - PRs touching app/API/packages/scripts/workflows/docs contracts cannot merge with red relevant gates.
 - Artifacts include screenshots, traces, and evidence summary.

 #### Verification

 - local command parity for release gate
 - workflow path filter review

 ### Slice 6.4 — docs/runbook parity

 #### Files

 - docs/beta/qa-gate.md
 - docs/beta/screen-readiness-matrix.md
 - docs/beta/component-readiness.md
 - docs/beta/implementation-backlog.md
 - docs/api/99_COVERAGE_LEDGER.md
 - docs/46_PHASE_G_4_COMMUNICATIONS_SELF_HOSTED_AV_BACKEND.md
 - docs/47_PHASE_G_5_COMMUNICATIONS_UI_CONTRACT.md
 - docs/runbooks/backend-operations.md
 - docs/runbooks/self-hosted-deployment.md
 - docs/runbooks/e2e-smoke.md

 #### Change

 - Update docs only after implementation evidence exists.
 - Record:
     - route readiness;
     - data contracts;
     - states/actions;
     - visual screenshots;
     - known deferred scope;
     - production env invariants, including E2E hook ban;
     - release pass/fail policy.

 #### Acceptance

 - Docs do not claim beta-ready or production-ready without matching tests/screenshots.
 - Coverage ledger matches OpenAPI/runtime contract.

 #### Verification

 - doc review against code/routes/tests/workflows

 Production pass/fail policy

 ### Hard fail

 Production/founder-beta remains blocked if any is true:
 - TypeScript/build/unit/DB/security gate fails.
 - Critical dependency advisory remains on backend/root-relevant path.
 - Core runtime route missing or blank.
 - Core route shows foundation/demo/Storybook/prototype/debug UI.
 - Core route uses hardcoded demo arrays instead of runtime API data.
 - Visible enabled action is dead or does not persist after reload.
 - Mutation bypasses RBAC, mutation guard, confirmation boundary where required, or audit where required.
 - OpenAPI/runtime/client contract drift exists.
 - Fresh DB migrate/seed/test fails.
 - E2E test hook available in production or without explicit test env.
 - Agent mutates before confirmation.
 - Critical axe violation exists on core route.
 - Narrow layout clips primary actions or has unreadable/overlapping content.
 - Required screenshot/evidence missing for production-critical route.

 A/V infra rules (communications self-hosted media plane, `docs/46`/`docs/47`):

 - `provider=livekit` but LiveKit/coturn/egress health is not wired into readiness (media dependencies must be readiness-checked and fail closed in production).
 - TURN credential issuance or egress start/stop bypasses RBAC or audit.
 - A call recording attachment is readable by a user without parent-entity/room read (recording-attachment isolation broken).
 - LiveKit api-secret, coturn shared secret, TURN credential, or egress storage key appears in readiness, audit, logs or OpenAPI examples.
 - Any call/egress/TURN test or mock hook is reachable in production.
 - `/api/internal/livekit/webhook` accepts unsigned requests in production (signature verification is mandatory, fail-closed).

 Note: `docs/43`'s "Backend makes no provider network calls" invariant is **superseded** for the egress/webhook path (`docs/46`). Server-side LiveKit calls and webhook reconcile are allowed, but they must be timeout-bounded and failure-audited; the join-token contract is unchanged.

 ### Allowed only with explicit release note/waiver

 - Finance screens deferred if hidden from runtime navigation and not part of promised beta path.
 - Non-critical visual refinements if core workflow clarity and stability are proven.
 - Limited mobile scope if 390px narrow viewport remains usable for core actions.

 Full verification plan

 Run targeted checks after each slice, then full gates at release checkpoints.

 ### Baseline/repo

 - git status --short --branch
 - codegraph sync && codegraph status

 ### Static/build/unit/security

 - pnpm typecheck
 - pnpm build
 - pnpm test
 - pnpm security:check
 - pnpm security:scan

 ### DB

 - pnpm db:migrate
 - pnpm db:seed:dev
 - pnpm db:seed:dev
 - pnpm test:db

 ### Runtime/e2e/visual

 - pnpm qa:runtime
 - pnpm qa:route-smoke
 - pnpm test:e2e:smoke
 - pnpm qa:visual
 - pnpm qa:a11y
 - pnpm verify:storybook-contract

 ### Manual/browser inspection when automated servers are up

 - /
 - /dashboard
 - /crm/deals
 - /crm/deals/:id
 - /crm/clients
 - /crm/contacts
 - /projects
 - /projects/:id
 - /projects/:id/schedule
 - /projects/:id/resources
 - /my-work
 - /agent
 - /admin/users
 - /admin/roles
 - /admin/audit
 - /api/openapi.json
 - /api/docs
 - /health/live
 - /health/ready

 Critical implementation files by area

 ### Runtime routes and shell

 - apps/web/src/app/page.tsx
 - apps/web/src/app/**
 - apps/web/src/app/layout.tsx
 - apps/web/src/app/providers.tsx
 - apps/web/src/views/layout/workspace-chrome.tsx
 - apps/web/src/shell/**
 - apps/web/src/app/globals.css

 ### Frontend API/data/state

 - apps/web/src/lib/api.ts
 - frontend query/mutation modules to create under existing project conventions
 - apps/web/src/components/domain/**
 - apps/web/src/widgets/**

 ### Project-management screens

 - apps/web/src/views/blocks/dashboard-bento.tsx
 - apps/web/src/views/blocks/deals-block.tsx
 - apps/web/src/views/blocks/projects-list-block.tsx
 - apps/web/src/views/blocks/my-work-block.tsx
 - apps/web/src/views/blocks/gantt-slice-block.tsx
 - apps/web/src/views/blocks/project-resources-block.tsx
 - apps/web/src/widgets/gantt/**
 - apps/web/src/widgets/resource-matrix/**
 - apps/web/src/widgets/kanban/**

 ### Backend/API/domain/persistence

 - apps/api/src/app.ts
 - apps/api/src/serverConfig.ts
 - apps/api/src/serverReadiness.ts
 - apps/api/src/auditRoutes.ts
 - apps/api/src/apiDocs/openApiDocument.ts
 - apps/api/src/apiDocs/schemas/**
 - apps/api/src/projectIntakeRoutes.ts
 - apps/api/src/projectIntakeService.ts
 - apps/api/src/projectWorkRoutes.ts
 - apps/api/src/planning/registerPlanningRoutes.ts
 - apps/api/src/controlRoutes.ts
 - apps/api/src/controlSurfaceRoutes.ts
 - apps/api/src/requestSecurity.ts
 - apps/api/src/runtimeSecurityConfig.ts
 - packages/domain/src/**
 - packages/access-control/src/**
 - packages/persistence/src/**

 ### QA/CI/ops/docs

 - package.json
 - playwright.config.ts
 - scripts/run-runtime-qa.mjs
 - scripts/security-audit-backend.mjs
 - .github/workflows/**
 - e2e/runtime/**
 - e2e/smoke/**
 - e2e/a11y/**
 - docs/beta/**

 Recommended execution order

 1. Phase 0 repo hygiene and base selection.
 2. Phase 1 immediate red blockers: tests, security, OpenAPI drift, production test-hook guard.
 3. Phase 2 runtime shell and shared data layer.
 4. Phase 3C projects/tasks first if implementation needs a core entity backbone; otherwise Phase 3A dashboard can begin once routes/data layer exist.
 5. Phase 3B deals/intake/handoff and Phase 3C projects/tasks converge on real project creation/opening.
 6. Phase 3D Gantt and Phase 3E resources after project/task read models are stable.
 7. Phase 3F My Work after task mutation semantics are stable.
 8. Phase 3G agent after allowed actions and audit contracts are stable.
 9. Phase 3H admin/RBAC/audit in parallel after audit contract is fixed.
 10. Phase 4 UI/UX stabilization runs continuously per route, then final visual matrix.
 11. Phase 5 backend hardening in parallel with route slices, but before release gate.
 12. Phase 6 QA/CI/release gates last, then full production readiness verification.

 Final deliverable format after execution

 Use repository report format:

 ```txt
   Status:
   Changed:
   Files:
   Tests / verification:
   CodeGraph:
   Decisions / assumptions:
   Risks / follow-up:
 ```

 The final status must distinguish:
 - founder-beta runtime readiness;
 - strict production/self-hosted readiness;
 - any explicit deferred scope or waiver.