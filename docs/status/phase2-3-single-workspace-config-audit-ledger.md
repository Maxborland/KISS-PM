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
- Повторный Bug Hunt Critical/Important не нашел.
- Повторный Security Review Critical/Important не нашел.
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
