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
- `apps/api` — Hono API, auth/session, workspace config routes, audit. Главные риски: большой `app.ts`, часть validation сидит на API-границе.
- `apps/web` — Next.js App Router client shell с TanStack Query. Главные риски: большой `App.tsx`, крупный `styles.css`, UI state и CRUD-поверхности в одном файле.
- `e2e/smoke` — критичный browser smoke по Phase 2.2, но сценарий большой.
- `scripts` — DB seed/migrate/dev helpers.

## Найденные риски

1. Старые англоязычные source-of-truth пути из задачи отсутствуют. Текущая истина — русские canonical docs из `docs/README.md`.
2. `apps/web/src/App.tsx` стал god-file: route shell, CRUD, dialogs, navigation и состояния находятся вместе.
3. Workspace config validation дублируется в `apps/api/src/workspaceConfigParsers.ts` и `apps/web/src/workspaceForms.ts`.
4. `apps/api/src/app.ts` и `packages/persistence/src/repositories.ts` требуют поэтапного разделения после characterization tests.
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

Статус: in_progress.

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

Итог REF-003 на текущий момент: `App.tsx` больше не владеет shell-state helpers, route icon registry, dashboard presentation, users CRUD view и roles CRUD view, но REF-003 остается открытым. Цель следующей серии — использовать Next.js App Router и page/view-level boundaries, чтобы довести `App.tsx` до shell-файла меньше 500 строк.

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

#### REF-005A — persistence row mappers

Статус: completed.

Срез без изменения SQL и repository public API:

- Pure row-to-domain mappers вынесены из `packages/persistence/src/repositories.ts` в `packages/persistence/src/repositoryMappers.ts`.
- `toPermission` вынесен вместе с мапперами и сохраняет fail-fast поведение для неизвестных persisted permission keys.
- Добавлены unit tests на tenant user, access profile, workspace user, position, custom field и project template mappings.
- RED подтвержден отсутствующим модулем `repositoryMappers`; GREEN подтвержден persistence typecheck и `pnpm test:db`.

Итог REF-004 / REF-005: из API и persistence вынесены первые pure/boundary куски с тестами. Глубокий split route groups и repository areas остается будущей серией, но текущий refactor-plan больше не держит их как открытые блокеры.

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

## Closure status

Текущий план закрыт как безопасный refactor batch:

- `REF-002` completed: workspace config validation в domain.
- `REF-003` in_progress: shell-state, route icon registry, dashboard presentation, users CRUD view и roles CRUD view вынесены из `App.tsx`; нужны page/view-level slices до бюджета меньше 500 строк.
- `REF-004` completed for current plan: API app error mapping вынесен из `app.ts`.
- `REF-005` completed for current plan: persistence row mappers вынесены из `repositories.ts`.
- `REF-006` completed: smoke helpers вынесены без ослабления E2E.
- `REF-007` documented: user-owned/generated artifacts не удалялись.
- `REF-008` documented: новые script aliases не добавлялись без toolchain decision.

Следующий отдельный refactor-plan можно открыть для более глубокого разделения:

1. `App.tsx`: вынести `PositionsView`, `WorkspaceSettingsView`, `AuditView`, `ProfileView`, `ThemeView` по одному; где возможно, привязать к Next.js route page boundaries.
2. `apps/api/src/app.ts`: выделить route groups для users/positions/access roles/profile/theme.
3. `packages/persistence/src/repositories.ts`: выделить repository areas после дополнительных DB characterization tests.

## Правила исполнения

- Behavior change допускается только через отдельный decision/bugfix.
- Production dependency не добавлять без отдельного решения.
- Dead code не удалять без evidence из `git ls-files`, imports/search и тестов.
- UI hiding не заменяет backend permission checks.
- Для navigation-critical изменений нужен browser/E2E smoke.
