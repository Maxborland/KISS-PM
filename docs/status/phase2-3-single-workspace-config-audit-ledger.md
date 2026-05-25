# Статус Phase 2.3: single-workspace config и audit hardening

## Блок

Audit viewer, negative RBAC browser coverage и первый workspace config baseline для custom fields/templates.

## Текущее состояние

- Scope Phase 2.3 зафиксирован в `docs/21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md`.
- Single-workspace подход сохраняется: отдельную SaaS/operator admin surface в этой фазе не строим.
- Phase 2.3 должна добавить права `tenant.workspace_config.read` и `tenant.workspace_config.manage`.
- Custom fields/templates должны быть DB-backed, tenant-scoped и auditable.
- Custom fields/templates должны использовать canonical пару `systemKey` + `tenantLabel`.
- `Аудит` и `Настройки` должны быть permission-aware UI routes.

## Артефакты

- Canonical scope: `docs/21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md`.
- Browser smoke: `e2e/smoke/single-workspace-auth-rbac.spec.ts` будет расширен в рамках реализации.

## Проверки блока 1

- Стартовый `git status --short`: generated `apps/web/next-env.d.ts` и untracked `phase2-2-users-crud.png`; generated файл возвращен к dev routes import, screenshot не трогается.
- Docs links добавлены в `AGENTS.md` и `docs/README.md`.
- Bug Hunt по docs baseline нашел 3 Important: acceptance не требовал root typecheck, create/update/validation были сформулированы слабее scope, negative RBAC не разделял read и mutation endpoints.
- Исправлено: acceptance теперь требует `pnpm typecheck`, отдельные create/update/validation/audit proofs для custom fields/templates и `403` для read + mutation endpoints.
- Security review Critical/Important не нашел; Minor уточнение про read/write `403` закрыто тем же acceptance update.
- Повторный Bug Hunt Critical/Important не нашел; minor по терминологии `tenantLabel` закрыт.
- Повторный security review Critical/Important/Minor не нашел.

## Review loop

- После каждого блока Phase 2.3: Bug Hunt, Requesting Code Review, security-best-practices review.
- Critical / Important замечания исправляются до перехода к следующему блоку.

## Блок 2: DB/API baseline workspace config

- Добавлены права `tenant.workspace_config.read` и `tenant.workspace_config.manage`.
- Добавлены tenant-scoped таблицы `custom_field_definitions` и `project_templates`.
- Добавлена миграция `packages/persistence/migrations/0002_phase_2_3_workspace_config.sql`.
- Добавлены repository методы create/list/update для custom fields и project templates.
- Добавлены API endpoints:
  - `GET /api/workspace/config/custom-fields`
  - `POST /api/workspace/config/custom-fields`
  - `PATCH /api/workspace/config/custom-fields/:fieldId`
  - `GET /api/workspace/config/project-templates`
  - `POST /api/workspace/config/project-templates`
  - `PATCH /api/workspace/config/project-templates/:templateId`
- Mutating endpoints требуют cookie session, `x-kiss-pm-action: same-origin`, permission `tenant.workspace_config.manage`, транзакционный datasource и audit write.
- Read endpoints требуют cookie session и permission `tenant.workspace_config.read`.
- API фиксирует audit action types:
  - `workspace.custom_field.created`
  - `workspace.custom_field.updated`
  - `workspace.project_template.created`
  - `workspace.project_template.updated`

## Проверки блока 2

- TDD RED: `pnpm --filter @kiss-pm/persistence test` падал на отсутствующих таблицах и миграции 2.3.
- TDD RED: `pnpm --filter @kiss-pm/access-control test` и `pnpm --filter @kiss-pm/api test` показали старую проблему package-level scripts (`No test files found` из-за root include); для доказательств используются root checks.
- GREEN: `pnpm test` прошел, 14 файлов / 48 тестов.
- GREEN: `pnpm typecheck` прошел.
- DB RED до миграции: `pnpm test:db` падал на `relation "custom_field_definitions" does not exist`.
- Миграция: `pnpm db:migrate` применил `0002_phase_2_3_workspace_config.sql`.
- DB GREEN: `pnpm test:db` прошел, 3 файла / 19 тестов.
- `git diff --check` прошел; есть только CRLF/LF warning для `apps/api/src/app.db.test.ts`.

## Review loop блока 2

- Bug Hunt нашел Important: config `id` был глобальным primary key при tenant-scoped модели; `systemKey` был изменяемым через PATCH.
- Requesting Code Review нашел Important: `systemKey` был изменяемым; API/repository shape терял `createdAt`/`updatedAt`.
- Security review нашел Important: client-controlled global `id` ослаблял tenant isolation и мог давать cross-tenant collision/side-channel.
- Исправлено:
  - `custom_field_definitions` и `project_templates` переведены на primary key `tenant_id + id`;
  - добавлена repair migration `0003_phase_2_3_workspace_config_scoped_ids.sql` для уже примененной локальной миграции;
  - PATCH больше не меняет `systemKey` и возвращает `system_key_immutable` при попытке rename;
  - records/API responses включают `createdAt` и `updatedAt`;
  - DB/API tests доказывают same-id в разных tenants, immutable `systemKey`, timestamps и `x-user-id` fallback rejection для config read.
- Повторные проверки после правок:
  - `pnpm db:migrate` применил `0003_phase_2_3_workspace_config_scoped_ids.sql`;
  - `pnpm typecheck` прошел;
  - `pnpm test` прошел, 14 файлов / 49 тестов;
  - `pnpm test:db` прошел, 3 файла / 19 тестов.
- Статус: отправлено на повторный Bug Hunt, Requesting Code Review и security-best-practices review.
- Повторный Requesting Code Review нашел 2 Important:
  - restricted-user smoke проверял не все mutation endpoints;
  - в user-facing copy шаблонов остались `project templates` / `process builder`.
- Исправлено:
  - restricted-user smoke добавил `403` для `PATCH /api/workspace/config/custom-fields/:id` и `POST /api/workspace/config/project-templates`;
  - описание раздела шаблонов переведено на русский пользовательский текст.
- Повторные проверки после second-pass fixes:
  - `pnpm test:e2e:smoke` прошел, 1 chromium test;
  - `pnpm typecheck` прошел;
  - `pnpm test` прошел, 14 файлов / 54 теста;
  - `pnpm --filter @kiss-pm/web build` прошел;
  - `git diff --check` прошел.
- Статус: отправлено на final повторный Requesting Code Review и security/Bug Hunt quick confirmation.
- Повторный Bug Hunt: Critical/Important нет; Minor про duplicate race оставлен как будущая нормализация DB unique errors.
- Повторный Requesting Code Review: Critical/Important нет.
- Повторный Security Review: Critical/Important нет; Minor про length caps и config rollback test закрыт дополнительными правками.
- Дополнительно после Minor:
  - добавлены max length проверки для config `id`, `systemKey`, `tenantLabel`, `description`;
  - добавлен DB/API test на откат custom field create при audit failure внутри transaction.
- Финальные проверки блока 2:
  - `pnpm typecheck` прошел;
  - `pnpm test` прошел, 14 файлов / 49 тестов;
  - `pnpm test:db` прошел, 3 файла / 20 тестов;
  - `git diff --check` прошел с CRLF/LF warning для `apps/api/src/app.db.test.ts`.

## Блок 3: web UI для Audit и Workspace Config

- Добавлены App Router страницы `/audit` и `/settings`.
- В permission-aware navigation добавлены разделы `Аудит` и `Настройки`.
- Web API client и TanStack Query hooks подключены к DB-backed config endpoints:
  - custom fields list/create/update;
  - project templates list/create/update;
  - targeted invalidation для config и audit queries после mutation.
- `WorkspaceData` скрывает config data без права `tenant.workspace_config.read`.
- Добавлены формы/валидация для `systemKey`, `tenantLabel`, статусов, типов полей и описания шаблонов.
- `Настройки` показывает плотные таблицы custom fields и project templates, summary counters, search, create/edit modals и inline mutation errors.
- `Аудит` показывает полный журнал действий с workflow, entity, correlation id и человекочитаемыми labels для config-событий.

## Проверки блока 3

- TDD RED: targeted web tests и `pnpm typecheck` падали на отсутствующих routes/query hooks/API types.
- GREEN targeted: `pnpm test -- apps/web/src/workspaceDashboard.test.ts apps/web/src/workspaceForms.test.ts apps/web/src/workspaceQueries.test.ts apps/web/src/api.test.ts` прошел, 4 файла / 14 тестов.
- `pnpm typecheck` прошел.
- Browser smoke на живом Next runtime и API через rewrite:
  - `/settings` загрузил config tables;
  - `POST /api/workspace/config/custom-fields` вернул `201`;
  - `PATCH /api/workspace/config/custom-fields/:id` вернул `200`;
  - `POST /api/workspace/config/project-templates` вернул `201`;
  - `PATCH /api/workspace/config/project-templates/:id` вернул `200`;
  - `/audit` показал 4 новых события `workspace.custom_field.*` и `workspace.project_template.*`;
  - browser console errors: 0.
- Финальные проверки перед review loop:
  - `pnpm test` прошел, 14 файлов / 52 теста;
  - `pnpm typecheck` прошел;
  - `pnpm --filter @kiss-pm/web build` прошел, route list включает `/audit` и `/settings`.

## Review loop блока 3

- Bug Hunt нашел Important: audit viewer не показывал before/after summary.
- Requesting Code Review нашел Important:
  - audit viewer не показывал before/after summary;
  - server-side validation ошибки в config CRUD были техническими (`path failed: status`);
  - UI настроек/аудита протаскивал внутренний английский язык;
  - автоматический smoke не покрывал новые `/settings` и `/audit` flows.
- Security review Critical/Important не нашел.
- Исправлено:
  - web `AuditEvent` type расширен `beforeState`/`afterState`;
  - audit viewer получил колонку `Изменение` с readable before/after summary;
  - config audit labels переведены на русский;
  - `ApiError` сохраняет backend error code, а UI маппит его в русское form-level сообщение;
  - user-facing copy в `/settings`, `/audit` и route descriptions очищен от внутреннего `workspace config`/`custom field`/`baseline`;
  - `e2e/smoke/single-workspace-auth-rbac.spec.ts` расширен create/update custom field, create/update project template, inline validation, audit event visibility, restricted route hiding и API `403` checks.
- Повторные проверки после исправлений:
  - `pnpm test:e2e:smoke` прошел, 1 chromium test;
  - `pnpm test` прошел, 14 файлов / 54 теста;
  - `pnpm typecheck` прошел;
  - `pnpm --filter @kiss-pm/web build` прошел, route list включает `/audit` и `/settings`;
  - `pnpm test:db` прошел, 3 файла / 20 тестов;
  - `git diff --check` прошел.
- Статус: отправлено на повторный Bug Hunt, Requesting Code Review и security-best-practices review.

## Блок 4: refactor API-slice auth/session и workspace config routes

- Вынесены API-типы в `apps/api/src/apiTypes.ts`.
- Вынесены session/cookie helpers в `apps/api/src/authSession.ts`.
- Вынесены общие parser helpers в `apps/api/src/parseHelpers.ts`.
- Вынесены workspace parsers в `apps/api/src/workspaceParsers.ts`.
- Вынесены config parsers в `apps/api/src/workspaceConfigParsers.ts`.
- Вынесены workspace config routes в `apps/api/src/workspaceConfigRoutes.ts`.
- `apps/api/src/app.ts` оставлен application composition layer и делегирует auth/config helper-модулям.
- Для session cookie добавлен secure-cookie guard: локальный HTTP dev остается рабочим, production включает `Secure` по умолчанию, self-hosted HTTPS может явно включить `KISS_PM_SECURE_COOKIES=true` или `createApp({ secureCookies: true })`, а нестандартный non-TLS production должен явно отключить `KISS_PM_SECURE_COOKIES=false`.
- Исправлен package-level test script `@kiss-pm/api`, чтобы API tests запускались без root include ambiguity.

## Проверки блока 4

- TDD RED: targeted tests падали на отсутствующих `authSession` и `workspaceConfigParsers`.
- TDD RED: repository health budget падал на `apps/api/src/app.ts` как god-file.
- GREEN targeted: `pnpm vitest run apps/api/src/authSession.test.ts apps/api/src/workspaceConfigParsers.test.ts apps/web/src/repositoryHealth.test.ts` прошел, 12 тестов.
- `pnpm --filter @kiss-pm/api typecheck` прошел.
- `pnpm --filter @kiss-pm/api test` прошел, 16 тестов.
- `pnpm typecheck` прошел.
- `pnpm test` прошел, 66 тестов на момент блока.
- `pnpm test:db` прошел, 20 тестов.
- `pnpm --filter @kiss-pm/web build` прошел.
- Первый `pnpm test:e2e:smoke` был нестабилен из-за stale Docker runtime; после `docker compose up -d --force-recreate api web` повторный smoke прошел, 1 chromium test.
- `git diff --check` прошел.
- Коммит блока: `f32167e refactor(api): slice auth and workspace config routes`.

## Review loop блока 4

- Bug Hunt нашел Important: strict env typing ломал API typecheck после secure-cookie helper.
- Requesting Code Review Critical/Important не нашел.
- Security review нашел Important: session cookie helper не умел ставить `Secure` для HTTPS deployment.
- Исправлено:
  - `shouldUseSecureCookies` типизирован через `Partial<Pick<NodeJS.ProcessEnv, "KISS_PM_SECURE_COOKIES" | "NODE_ENV">>`;
  - `buildSessionCookieHeader` и `buildExpiredSessionCookieHeader` принимают secure option;
  - `createApp` поддерживает `secureCookies`, а default определяется через env.
- Повторные Bug Hunt, Requesting Code Review и Security Review Critical/Important не нашли.

## Блок 5: shadcn scaffold и Tailwind foundation

- Добавлен app-local `apps/web/components.json` с shadcn registry scaffold.
- Добавлен Tailwind v4/PostCSS foundation:
  - `apps/web/postcss.config.mjs`;
  - `apps/web/src/shadcn.css`;
  - импорт shadcn/Tailwind foundation из `apps/web/src/styles.css`.
- Добавлены shadcn UI primitives для будущих CRUD surfaces:
  - `button`;
  - `dialog`;
  - `dropdown-menu`;
  - `table`.
- Добавлен `apps/web/src/lib/utils.ts` с `cn`.
- Добавлены aliases `@/*` в `apps/web/tsconfig.json`.
- Добавлен `apps/web/src/shadcnFoundation.test.ts`, который фиксирует scaffold, Tailwind runtime entry, shadcn primitives, theme alignment и Next dev runtime guardrails.
- Добавлен `apps/web/src/useDocumentThemeClass.ts`, чтобы persisted product theme синхронизировалась с корневым `.dark` для portal-компонентов.
- Next dev runtime настроен для Docker/browser smoke:
  - `allowedDevOrigins: ["127.0.0.1", "localhost"]`;
  - `devIndicators: false`, чтобы Next dev portal не перекрывал интерактивный smoke.

## Проверки блока 5

- TDD RED: `pnpm vitest run apps/web/src/shadcnFoundation.test.ts` падал на отсутствующих `components.json`, Tailwind deps и shadcn primitives.
- GREEN targeted: `pnpm vitest run apps/web/src/shadcnFoundation.test.ts` прошел, 5 тестов.
- `pnpm --filter @kiss-pm/web typecheck` прошел.
- `pnpm --filter @kiss-pm/web build` прошел.
- `pnpm typecheck` прошел.
- `pnpm test` прошел, 18 файлов / 71 тест.
- `pnpm test:db` прошел, 3 файла / 20 тестов.
- `pnpm audit --prod --audit-level moderate` прошел.
- `pnpm test:e2e:smoke` сначала выявил два runtime blockers:
  - Next dev resource был заблокирован для `127.0.0.1`, shell зависал на загрузке;
  - Next dev indicator portal перекрывал клики в collapsed sidebar smoke.
- Исправлено через `allowedDevOrigins` и `devIndicators: false`.
- После очистки generated `test-results` от stale Windows lock повторный `pnpm test:e2e:smoke` прошел, 1 chromium test.
- `docker compose ps` подтвердил running `postgres`, `api`, `web`.

## Review loop блока 5

- Bug Hunt и Requesting Code Review нашли Important:
  - shadcn semantic tokens конфликтовали с существующими app CSS variables `--accent`, `--muted`, `--border`;
  - shadcn dark mode был привязан только к `.dark`, тогда как продукт использует `.theme-dark`;
  - dropdown primitives hardcoded `dark` и могли рендериться темными в светлой теме.
- Security Review нашел Important:
  - production dependency surface был расширен aggregate `radix-ui` и CLI-пакетом `shadcn` в runtime dependencies;
  - `pnpm audit --prod --audit-level moderate` падал на vulnerable transitive `postcss` через Next.
- Исправлено:
  - shadcn semantic tokens переведены в namespace `--shadcn-*`, а Tailwind tokens смотрят на этот namespace;
  - dark variant принимает `.dark` и `.theme-dark`;
  - `useDocumentThemeClass` синхронизирует persisted product theme с корневым `.dark` для portal-компонентов;
  - hardcoded `dark` удален из dropdown content/subcontent;
  - aggregate `radix-ui` заменен на точечные `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`;
  - `shadcn` перенесен в devDependencies;
  - добавлен root `pnpm.overrides.postcss = ^8.5.14`;
  - `pnpm audit --prod --audit-level moderate` теперь проходит.
- Повторный Bug Hunt Critical/Important не нашел.
- Повторный Security Review Critical/Important не нашел.
- Повторный Requesting Code Review нашел Important: записи блока 5 были ошибочно вставлены внутрь review tail блока 2 и делали ledger неоднозначным.
- Исправлено: записи блоков 4/5 перенесены в конец ledger после блока 3.
- Повторный Requesting Code Review после исправления ledger Critical/Important не нашел.
- После security follow-up выполнен `pnpm install --frozen-lockfile`; локальный `node_modules` синхронизирован с lockfile.
- Повторный Security Review после fresh install Critical/Important не нашел: `postcss` в web dependency tree один, `8.5.14`; aggregate `radix-ui` не найден; `shadcn` остается devDependency.
- Финальный smoke после `docker compose up -d --force-recreate web` прошел; `docker compose ps` подтвердил running `postgres`, `api`, `web`.

## Блок 6: closure verification Phase 2.3

- Выполнена сверка `docs/21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md` с текущим кодом и smoke.
- По review-loop внесены точечные правки в RBAC/audit atomicity и audit viewer labels.
- Обновлен canonical статус фазы: Phase 2.3 закрыта в single-workspace реализации.
- Access-role create/update/delete теперь выполняются в transaction вместе с audit write.
- `access_profiles` переведен с глобального primary key по `id` на tenant-scoped primary key `(tenant_id, id)`.
- Dev/test seed использует upsert по `(tenant_id, id)` и не перетирает роль другого tenant с тем же локальным id.
- Полный audit viewer теперь получает человекочитаемый action label напрямую из helper, а не через ограниченный dashboard preview.
- Пользовательская copy настроек очищена от raw permission key и `workspace`-англицизма.

## Проверки блока 6

- `pnpm vitest run apps/web/src/workspaceForms.test.ts apps/web/src/routes.test.ts apps/web/src/workspaceQueries.test.ts` прошел: 3 файла / 19 тестов.
- `pnpm vitest run apps/api/src/workspaceConfigParsers.test.ts apps/api/src/app.test.ts` прошел: 2 файла / 11 тестов.
- `pnpm typecheck` прошел.
- `pnpm test` прошел: 23 файла / 95 тестов.
- `pnpm --filter @kiss-pm/web typecheck` прошел.
- `pnpm --filter @kiss-pm/web build` прошел; Next route list включает `/audit` и `/settings`.
- `pnpm test:db` прошел: 3 файла / 20 тестов.
- `pnpm test:e2e:smoke` прошел: 1 chromium test; smoke доказал login, CRUD users/roles/positions, profile/theme, config create/update/validation, audit events и restricted-user `403` checks.
- TDD RED для RBAC atomicity: `pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts -t "rolls back access role"` падал, потому что новая роль сохранялась при падении audit.
- TDD GREEN для RBAC atomicity: `pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts -t "rolls back access role"` прошел: 1 тест.
- TDD RED для audit label helper: `pnpm vitest run apps/web/src/workspaceDashboard.test.ts` падал на отсутствующем `getAuditActionLabel`.
- TDD GREEN для audit label helper: `pnpm vitest run apps/web/src/workspaceDashboard.test.ts` прошел: 4 теста.
- TDD RED для tenant-scoped role ids: `pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts -t "keeps access role ids"` падал с `expected 500 to be 201`, потому что второй tenant упирался в глобальный `access_profiles.id`.
- Миграция: `pnpm db:migrate` применил `0004_phase_2_3_access_profiles_scoped_ids.sql`.
- TDD GREEN для tenant-scoped role ids: `pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts -t "keeps access role ids"` прошел: 1 тест.
- Migration guard: `pnpm vitest run packages/persistence/src/migration.test.ts` прошел: 4 теста.
- DB regression после правки seed: `pnpm test:db` прошел: 3 файла / 22 теста.

## Review loop блока 6

- Bug Hunt нашел Important: полный audit viewer терял human-readable labels после 200 событий, потому что использовал capped preview list. Исправлено через `getAuditActionLabel`.
- Requesting Code Review Critical/Important не нашел; Minor по user-facing copy закрыт заменой raw permission wording на русский текст.
- Security Review нашел Important: access-role create/update/delete были неатомарны с audit write. Исправлено transaction pattern по аналогии с workspace config routes и DB rollback test.
- Повторный Security Review нашел Important: API трактовал роли как tenant-scoped, но persistence держал глобальный primary key по `access_profiles.id`. Исправлено composite primary key `(tenant_id, id)`, seed upsert target и DB/API regression test на одинаковый role id в двух tenant.
- Финальный Bug Hunt после tenant-scoped PK Critical/Important не нашел; дополнительно прогнал `pnpm vitest run packages/persistence/src/migration.test.ts apps/web/src/workspaceDashboard.test.ts`, `pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts -t "keeps access role ids|rolls back access role"`, `pnpm typecheck` и `git diff --check`.
- Финальный Requesting Code Review после tenant-scoped PK Critical/Important не нашел.
- Финальный Security Review после tenant-scoped PK Critical/Important не нашел.
