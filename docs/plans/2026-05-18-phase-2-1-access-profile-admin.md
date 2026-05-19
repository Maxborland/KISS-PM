# Phase 2.1: Access profile admin flow plan

## Цель

Начать Phase 2 с маленького, но настоящего управляемого tenant admin flow.

## Архитектура

Access-control package расширяет typed permissions. Persistence package читает/создает access profiles и audit events. API реализует application command с permission check. Web shell получает tenant admin surface. E2E проверяет browser journey.

## План работ

1. Добавить phase doc и этот plan.
2. RED: расширить access-control tests для новых permissions.
3. RED: добавить DB/API tests для access profile command и audit.
4. Реализовать permissions.
5. Реализовать persistence repository methods.
6. Реализовать API endpoints:
   - `GET /api/tenant/current/access-profiles`;
   - `POST /api/tenant/current/access-profiles`;
   - `GET /api/tenant/current/audit-events`.
7. Обновить dev seed permissions.
8. Обновить web API client и UI.
9. Добавить Playwright E2E access profile creation.
10. Запустить verification:
    - `pnpm db:migrate`;
    - `pnpm db:seed:dev`;
    - `pnpm test`;
    - `pnpm test:db`;
    - `pnpm typecheck`;
    - `pnpm test:e2e:smoke`;
    - markdown link check.

## Границы

Не делаем полноценный admin module. Это первый вертикальный control loop для access profile creation, не вся Phase 2.
