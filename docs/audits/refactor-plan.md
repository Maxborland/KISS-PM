# План безопасного рефакторинга KISS PM

Дата: 2026-05-19.

## Цель

Привести репозиторий к форме, в которой его можно развивать как SaaS/self-hosted продукт управления проектами, ресурсной загрузкой, KPI, control surfaces и governed actions без смешения domain/API/UI и без Bitrix-specific логики в ядре.

Рефакторинг идет не через big-bang rewrite, а через цикл:

```txt
baseline -> audit -> refactor matrix -> characterization tests -> small refactor -> verification -> next block
```

## Baseline

| Проверка | Статус | Наблюдение |
| --- | --- | --- |
| `git status --short` | есть untracked | `phase2-2-users-crud.png`; файл не трогать без явного решения |
| `npm run typecheck` | passed | TypeScript baseline зеленый |
| `pnpm typecheck` | passed | Project references baseline зеленый |
| `npm test` | passed после escalation | В sandbox был `spawn EPERM`; вне sandbox 71 тест прошел |
| `pnpm test` | passed | 18 файлов, 71 тест |
| `pnpm test:db` | passed | 3 файла, 20 тестов; есть NOTICE о truncate cascade |
| `pnpm --filter @kiss-pm/web build` | passed | Next.js build зеленый |
| `npm run test:e2e:smoke` | passed после cleanup/escalation | Сначала был `EPERM` на `test-results/.last-run.json`, затем `spawn EPERM`; после удаления generated `test-results` и запуска вне sandbox smoke прошел |
| `npm run lint` | baseline failure | script отсутствует |
| `npm run test:unit` | baseline failure | script отсутствует |
| `npm run test:integration` | baseline failure | script отсутствует |

## Карта текущей архитектуры

- `packages/domain` — минимальное ядро tenant/user. Сейчас не владеет правилами workspace config, хотя эти правила уже используются в API и UI.
- `packages/access-control` — модель permissions/RBAC.
- `packages/persistence` — Postgres schema/repositories/migrations; главный риск: широкий `repositories.ts`.
- `apps/api` — Hono API, auth/session, route groups, workspace config routes, audit. `app.ts` теперь является composition entrypoint; endpoint bodies вынесены в route modules.
- `apps/web` — Next.js App Router client shell с TanStack Query. Главные риски: большой `App.tsx`, крупный `styles.css`, UI state и CRUD-поверхности в одном файле.
- `e2e/smoke` — критичный browser smoke по Phase 2.2, но сценарий большой.
- `scripts` — DB seed/migrate/dev helpers.

## Найденные риски

1. Старые англоязычные source-of-truth пути из задачи отсутствуют. Текущая истина — русские canonical docs из `docs/README.md`.
2. `apps/web/src/App.tsx` стал god-file: route shell, CRUD, dialogs, navigation и состояния находятся вместе.
3. Workspace config validation дублируется в `apps/api/src/workspaceConfigParsers.ts` и `apps/web/src/workspaceForms.ts`.
4. `packages/persistence/src/repositories.ts` остается следующим крупным кандидатом для поэтапного разделения после characterization tests.
5. Baseline scripts `lint`, `test:unit`, `test:integration` отсутствуют; это не новый регресс.
6. Есть локальные generated artifacts и untracked screenshot; в этом батче они не удаляются.

## Приоритетные блоки

### REF-002 — workspace config validation в domain

Статус: completed.

Причина: это безопасный boundary refactor с небольшим blast radius. Он убирает дублирование API/UI, делает domain владельцем правил для `systemKey`, `status`, `fieldType` и лимитов, но не меняет поведение.

План проверки:

1. Добавить RED characterization tests для domain validation contract.
2. Добавить boundary tests для web form limits.
3. Вынести helpers/constants в `packages/domain/src/workspaceConfig.ts`.
4. Подключить helpers в API parser и web forms.
5. Запустить targeted tests и typecheck по domain/API/web.

Результат текущего батча:

- Добавлен `packages/domain/src/workspaceConfig.ts`.
- `apps/api/src/workspaceConfigParsers.ts` использует normalized domain validators.
- `apps/web/src/workspaceForms.ts` использует raw-input validators, чтобы сохранить прежнее UX-поведение с вводом пробелов и последующей нормализацией на API-границе.
- `apps/web/src/api.ts` использует `WorkspaceConfigFieldType` и `WorkspaceConfigStatus` из domain.
- RED был подтвержден: domain tests падали из-за отсутствующих экспортов.
- GREEN подтвержден targeted tests и typecheck по domain/API/web.

### REF-003 — разрезание `App.tsx`

Статус: completed.

Начинать только после отдельной матрицы UI-flow рисков. Первый безопасный срез: вынести shell/navigation и shared CRUD section primitives, не меняя routes и permission gating.

#### REF-003A — shell state helpers

Статус: completed.

Срез без изменения UI и маршрутов:

- `getSectionState`, `getMetricHint`, `hasPermission`, `getErrorMessage` вынесены из `App.tsx` в `apps/web/src/workspaceShellState.ts`.
- `SectionState` больше не принадлежит компонентному файлу `workspace-ui.tsx`; это нейтральный тип shell-state.
- Добавлены characterization tests для permission matching, section state, metric hints и API error message mapping.
- RED подтвержден отсутствующим модулем `workspaceShellState`; GREEN подтвержден targeted tests и web typecheck.

#### REF-003B — route icon registry

Статус: completed.

Срез без изменения navigation behavior:

- `workspaceRouteIcons` вынесен из `App.tsx` в `apps/web/src/workspaceRouteIcons.ts`.
- Добавлен test, который проверяет, что каждый stable `WorkspaceRouteId` имеет icon reference.
- RED подтвержден отсутствующим модулем `workspaceRouteIcons`.
- При GREEN обнаружено неверное предположение теста: текущие `lucide-react` icons могут быть React component objects, не только functions. Тест уточнен на реальный runtime contract.

#### REF-003C — dashboard view extraction

Статус: completed.

- `DashboardView` вынесен из `App.tsx` в `apps/web/src/DashboardView.tsx`.
- `App.tsx` health-budget ужесточен с 2800 до 2600 строк.
- RED подтвержден падением `repositoryHealth.test.ts`: `expected 2732 to be less than or equal to 2600`.
- GREEN подтвержден после extraction: `App.tsx` 2582 строки.

#### REF-003D — users view extraction

Статус: completed.

- `UsersView` вынесен из `App.tsx` в `apps/web/src/UsersView.tsx`.
- `App.tsx` health-budget ужесточен с 2600 до 2200 строк.
- Поведение CRUD пользователей, модалок, inline validation, password toggle, mutation calls и permission gating не менялось.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003E — roles view extraction

Статус: completed.

- `RolesView` вынесен из `App.tsx` в `apps/web/src/RolesView.tsx`.
- `App.tsx` health-budget ужесточен с 2200 до 1900 строк.
- Поведение CRUD ролей доступа, permission matrix, disabled-state reasons и mutation calls не менялось.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003F — positions view extraction

Статус: completed.

- `PositionsView` вынесен из `App.tsx` в `apps/web/src/PositionsView.tsx`.
- `App.tsx` health-budget ужесточен с 1900 до 1600 строк.
- Поведение CRUD должностей, disabled-state reasons и mutation calls не менялось.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003G — audit view extraction

Статус: completed.

- `AuditView` вынесен из `App.tsx` в `apps/web/src/AuditView.tsx`.
- `App.tsx` health-budget ужесточен с 1600 до 1450 строк.
- Поведение audit table, formatting и permission gating не менялось.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003H — account views extraction

Статус: completed.

- `ProfileView` и `ThemeView` вынесены из `App.tsx` в `apps/web/src/AccountViews.tsx`.
- `App.tsx` health-budget ужесточен с 1450 до 1300 строк.
- Поведение profile/theme mutation calls, permission gating и form markup не менялось.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003I — workspace settings view extraction

Статус: completed.

- `WorkspaceSettingsView` вынесен из `App.tsx` в `apps/web/src/WorkspaceSettingsView.tsx`.
- `App.tsx` health-budget ужесточен с 1300 до 700 строк.
- Поведение custom fields/templates mutation calls, permission gating и form markup не менялось.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003J — workspace shell extraction

Статус: completed.

- `WorkspaceShell` вынесен из `App.tsx` в `apps/web/src/WorkspaceShell.tsx`.
- `App.tsx` стал тонким Next client entrypoint на 7 строк.
- Repository health теперь ограничивает `App.tsx` 100 строками.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck` и `pnpm test`.

#### REF-003K — workspace shell layout/data split

Статус: completed.

- `WorkspaceSidebar` вынесен в `apps/web/src/WorkspaceSidebar.tsx`.
- `WorkspaceTopbar` вынесен в `apps/web/src/WorkspaceTopbar.tsx`.
- `WorkspaceRouteRenderer` вынесен в `apps/web/src/WorkspaceRouteRenderer.tsx`.
- Auth/data orchestration вынесена в `apps/web/src/useWorkspaceShellData.ts`.
- `WorkspaceShell.tsx` уменьшен до 415 строк и ограничен health-budget 500 строк.
- GREEN подтвержден `repositoryHealth.test.ts`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @kiss-pm/web build` и `pnpm test:e2e:smoke`.

Итог REF-003: `App.tsx` больше не god-file и находится ниже целевого бюджета 500 строк. Все route views, navigation drawer, topbar, route renderer и auth/data orchestration вынесены в отдельные reusable модули.

### REF-004 / REF-005 — API и persistence boundaries

Статус: completed for current plan.

Начинать после дополнительного покрытия auth/session/workspace config/audit acceptance. Для каждого route/service split нужен `pnpm test:db`.

#### REF-004A — API app error boundary

Статус: completed.

Срез без изменения API contracts:

- `MissingAccessProfileError` и `resolveAppErrorResponse` вынесены из `apps/api/src/app.ts` в `apps/api/src/appErrors.ts`.
- `app.onError` остался тонким Hono adapter.
- Fail-closed response для missing access profile остается `{ error: "access_profile_not_found" }` со статусом 403.
- Unknown error остается `{ error: "internal_error" }` со статусом 500.
- RED подтвержден отсутствующим модулем `appErrors`; GREEN подтвержден unit/API/DB проверками.

#### REF-004B — API route group extraction

Статус: completed.

Срез без изменения API contracts:

- `apps/api/src/app.ts` уменьшен с 1302 до 186 строк и стал Hono composition entrypoint.
- Auth/session endpoints вынесены в `apps/api/src/authRoutes.ts`.
- Dev tenant/session endpoints вынесены в `apps/api/src/devTenantRoutes.ts`.
- Access role endpoints вынесены в `apps/api/src/accessRoleRoutes.ts`.
- Audit endpoint вынесен в `apps/api/src/auditRoutes.ts`.
- Workspace users endpoints вынесены в `apps/api/src/workspaceUserRoutes.ts`.
- Positions endpoints вынесены в `apps/api/src/positionRoutes.ts`.
- Profile/theme endpoints вынесены в `apps/api/src/profileRoutes.ts`.
- In-memory datasource и tenant admin profile вынесены в отдельные модули.
- Repository health guardrail для `apps/api/src/app.ts` ужесточен до 500 строк.
- Tailwind/shadcn foundation проверен guard-тестом: scaffold уже был установлен ранее, поэтому повторной установки зависимостей не было.

RED подтвержден `repositoryHealth.test.ts`: `expected 1302 to be less than or equal to 500`.
GREEN подтвержден targeted tests и typecheck по API/web.

#### REF-010 — Tailwind/shadcn foundation guardrail

Статус: completed.

- Фактический foundation уже был создан до этого среза: `apps/web/components.json`, `apps/web/postcss.config.mjs`, `apps/web/src/shadcn.css`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/*`, Tailwind/shadcn dependencies в `apps/web/package.json`.
- `apps/web/src/shadcnFoundation.test.ts` теперь явно проверяет PostCSS bridge `@tailwindcss/postcss`, Tailwind runtime import, shadcn tokens, `cn` utility, primitives и Next dev runtime expectations.
- Поведение UI не менялось; это guardrail против повторного “псевдо-scaffold”.

#### REF-005A — persistence row mappers

Статус: completed.

Срез без изменения SQL и repository public API:

- Pure row-to-domain mappers вынесены из `packages/persistence/src/repositories.ts` в `packages/persistence/src/repositoryMappers.ts`.
- `toPermission` вынесен вместе с мапперами и сохраняет fail-fast поведение для неизвестных persisted permission keys.
- Добавлены unit tests на tenant user, access profile, workspace user, position, custom field и project template mappings.
- RED подтвержден отсутствующим модулем `repositoryMappers`; GREEN подтвержден persistence typecheck и `pnpm test:db`.

#### REF-005B — workspace config repository area

Статус: completed.

Срез без изменения SQL, schema и public datasource API:

- Workspace config persistence для custom fields и project templates вынесен в `packages/persistence/src/workspaceConfigRepository.ts`.
- `packages/persistence/src/repositories.ts` остался root datasource composition и уменьшен с 627 до 524 строк.
- Repository health guardrail для `repositories.ts` установлен на 560 строк.
- Поведение tenant-scoped custom fields/templates подтверждено DB characterization test.

RED подтвержден `repositoryHealth.test.ts`: `expected 627 to be less than or equal to 560`.
GREEN подтвержден `repositoryHealth.test.ts`, DB test и persistence typecheck.

Итог REF-004 / REF-005: API `app.ts` больше не является god-file, route groups вынесены в отдельные модули, из persistence вынесены pure mappers и workspace config repository area. На этом refactor wave останавливается: дальнейшее разделение persistence откладывается до появления конкретной бизнес-функции или доказанного риска, чтобы не превращать работу в рефактор ради рефактора.

### REF-006 — стабилизация больших тестов

Статус: completed for current plan.

Сначала выделить fixtures/helpers, затем дробить specs. Нельзя ослаблять E2E assertions.

#### REF-006A — Playwright smoke helpers

Статус: completed.

Срез без ослабления E2E:

- `loginToWorkspace`, `logoutThroughUserMenu`, `expectAdminDashboardReady`, `verifyResponsiveNavigation` вынесены в `e2e/smoke/smokeHelpers.ts`.
- `single-workspace-auth-rbac.spec.ts` стал короче и читабельнее: 348 строк вместо примерно 420+.
- RED подтвержден отсутствующим `smokeHelpers` после перевода импорта.
- GREEN подтвержден `pnpm test:e2e:smoke`.

### REF-007 / REF-008 — hygiene и package scripts

Статус: documented.

- Generated/local artifacts не удалялись, потому что единственный видимый untracked файл `phase2-2-users-crud.png` может быть пользовательским.
- Новые script aliases `lint`, `test:unit`, `test:integration` не добавлялись: это изменило бы смысл команд без явного toolchain decision. Текущий проверяемый baseline остается `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm --filter @kiss-pm/web build`, `pnpm test:e2e:smoke`.

## Architecture review remediation queue

Очередь принята после lead architecture review от 2026-05-19. Правило исполнения: сначала исправлять boundary issues, которые блокируют следующий продуктовый контур, затем принимать irreversible domain decisions отдельными ADR.

### REF-011 — project intake application service

Статус: completed for current slice.

Срез без изменения API contracts:

- `apps/api/src/projectIntakeService.ts` создан как application-service слой для state-changing CRM/intake commands.
- `apps/api/src/projectIntakeRoutes.ts` стал HTTP adapter для session/body parsing и response mapping; create/stage/feasibility/activate команды делегируются service.
- После архитектурного follow-up `projectIntakeService.ts` дополнительно превращен в facade: create/stage/feasibility/activate, authorization, audit, linked-reference resolving и feasibility assessment вынесены в `apps/api/src/projectIntakeService/*`.
- `apps/api/src/projectIntakeService.test.ts` фиксирует service contract: linked snapshot labels, transaction boundary и management audit для создания сделки.
- `apps/web/src/repositoryHealth.test.ts` ограничивает facade 120 строками, authorization module 240 строками, activation command 160 строками.
- `ProjectDraft` intentionally closed in REF-012: это `Project.status = "draft"`, не отдельный aggregate.

RED подтвержден `pnpm vitest run apps/api/src/projectIntakeService.test.ts`: отсутствовал модуль `./projectIntakeService`.

Дополнительный RED для modularization подтвержден `pnpm vitest run apps/web/src/repositoryHealth.test.ts`: `projectIntakeService.ts` был 729 строк при лимите 120.

Проверки текущего среза:

- `pnpm vitest run apps/api/src/projectIntakeService.test.ts`
- `pnpm vitest run apps/api/src/projectIntakeService.test.ts apps/api/src/app.test.ts apps/api/src/projectIntakeParsers.test.ts`
- `pnpm vitest run apps/web/src/repositoryHealth.test.ts`
- `pnpm --filter @kiss-pm/api typecheck`

### REF-012 — ProjectDraft lifecycle decision

Статус: completed.

Решение принято в `docs/decisions/2026-05-19-project-draft-lifecycle-status.md`: `ProjectDraft` не является отдельной таблицей или отдельным aggregate. Draft реализуется как `Project.status = "draft"`, active project как `Project.status = "active"`.

Срез с изменением поведения:

- `projects.activated_at` стал nullable, чтобы draft мог существовать до governed activation.
- Persistence получил explicit lifecycle methods: `createProjectDraftFromOpportunity` и `activateProjectDraft`.
- Совместимый Phase 3 endpoint `/api/workspace/opportunities/:id/activate` внутри проходит путь draft -> active.
- `/api/workspace/projects` остается боевой зоной и возвращает только `active`.
- Resource feasibility по-прежнему резервирует capacity только по `active` project.
- Audit `project.activated` теперь фиксирует `beforeState.status = "draft"` и `afterState.status = "active"`.

Проверки:

- RED: `pnpm vitest run --config vitest.db.config.ts packages/persistence/src/repositories.db.test.ts` падал на отсутствующем `createProjectDraftFromOpportunity`.
- GREEN: targeted persistence/API DB tests, migration test и typecheck.

### REF-013 — datasource port split

Статус: planned.

`ApiTenantDataSource` остается слишком широким портом. Следующий безопасный срез: выделять context-specific ports только вместе с новым business slice: `CrmIntakeRepository`, `ProjectIntakeRepository`, `ResourcePlanningRepository`, `AuditWriter`, `TransactionRunner`.

### REF-014 — reference snapshot label contract

Статус: planned.

Нужно закрепить contract для `clientName`, `contactName`, `projectType`: snapshot labels vs current labels. UI уже предпочитает current reference labels, но API DTO и persistence должны явно различать historical snapshot и актуальную проекцию.

### REF-015 — resource availability provider

Статус: planned before resource matrix.

Текущий feasibility считает demand по `positionId + requiredHours`; это корректный intake seed, но не финальная BR2-like resource matrix model. Перед Phase 4 нужен provider boundary для availability/reservations/load buckets.

### REF-016 — frontend feature data boundaries

Статус: planned when adding new project-control pages.

`WorkspaceData` допустим для текущего shell, но новые Gantt/resource/KPI/control pages должны получать feature-specific query hooks вместо расширения одного центрального workspace object.

## Closure status

Текущий план закрыт как безопасный refactor batch:

- `REF-002` completed: workspace config validation в domain.
- `REF-003` completed: `App.tsx` стал тонким entrypoint меньше 500 строк; route views, sidebar, topbar, route renderer и auth/data orchestration вынесены.
- `REF-004` completed: API app error mapping и route groups вынесены из `app.ts`.
- `REF-005` completed for current plan: persistence row mappers и workspace config repository area вынесены из `repositories.ts`.
- `REF-006` completed: smoke helpers вынесены без ослабления E2E.
- `REF-007` documented: user-owned/generated artifacts не удалялись.
- `REF-008` documented: новые script aliases не добавлялись без toolchain decision.
- `REF-011` completed for current slice: state-changing project intake commands вынесены из route handlers в application service.

Следующий отдельный refactor-plan можно открыть только при конкретном продуктово-техническом поводе:

1. Следующий web refactor-plan: дробить `WorkspaceShell.tsx` дальше только при появлении новых shell responsibilities; текущий budget 500 строк должен оставаться жестким guardrail.
2. `packages/persistence/src/repositories.ts`: выделять новые repository areas только вместе с новой бизнес-областью, например CRM intake, project draft, Gantt/resource planning или KPI/control signals.
3. `REF-012` закрыт: Phase 4 строится поверх единой `Project` lifecycle model со статусами `draft|active`.

## Правила исполнения

- Behavior change допускается только через отдельный decision/bugfix.
- Production dependency не добавлять без отдельного решения.
- Dead code не удалять без evidence из `git ls-files`, imports/search и тестов.
- UI hiding не заменяет backend permission checks.
- Для navigation-critical изменений нужен browser/E2E smoke.
