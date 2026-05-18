# 19. Phase 2.1: Access profile admin flow

## Статус

Phase 2.1 начинает Phase 2: tenant/users/access/config. Phase 1 platform skeleton считается технически закрытым.

## Цель

Сделать первый настоящий tenant admin flow: authorized tenant admin создает `AccessProfile` через API command, система проверяет права, пишет `AuditEvent`, UI показывает новый профиль, а DB/API tests доказывают tenant isolation и negative permission path.

## Выбранный подход

- Dev actor для UI: `user-alpha-admin`.
- API command: `POST /api/tenant/current/access-profiles`.
- Read endpoints:
  - `GET /api/tenant/current/access-profiles`;
  - `GET /api/tenant/current/audit-events`;
  - существующие users/current tenant endpoints.
- Permissions:
  - `tenant.users.read`;
  - `tenant.access_profiles.read`;
  - `tenant.access_profiles.manage`;
  - `tenant.audit_events.read`.
- Audit action type: `tenant.access_profile.created`.

## Закрытый backlog Phase 2.1

1. Расширить permission model.
2. Расширить dev seed admin permissions.
3. Добавить repositories для access profiles и audit read.
4. Добавить API command создания access profile.
5. Добавить API tests:
   - authorized admin создает profile;
   - unauthorized user получает `permission_missing`;
   - audit event создан;
   - tenant B не видит profile tenant A.
6. Добавить tenant admin UI:
   - текущий tenant;
   - users;
   - access profiles;
   - форма создания access profile;
   - audit events.
7. Добавить Playwright E2E smoke для создания access profile через UI.

## Non-scope

- Настоящая auth/session модель.
- Invite user flow.
- Редактирование и удаление профилей.
- Custom fields/templates.
- Роли проекта, stage/task permissions.

## Acceptance criteria

- `pnpm test`, `pnpm test:db`, `pnpm typecheck` проходят.
- `pnpm test:e2e:smoke` проходит.
- E2E показывает создание access profile в UI.
- DB/API tests доказывают negative permission path и audit.

## Следующий шаг после Phase 2.1

Phase 2.2: tenant labels/custom fields basics с тем же паттерном command -> permission -> audit -> UI -> E2E.
