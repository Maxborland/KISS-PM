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
