# План Phase 2.2: single-workspace auth/RBAC/user foundation

## Контекст

После обсуждения решено не строить сейчас отдельную SaaS-админку оператора платформы. Сначала нужен рабочий базис продукта для одного рабочего пространства: вход, пользователь, роль доступа, должность, профиль, тема, минимальные права и audit.

## Скоуп

1. Расширить domain/persistence под пользователя как реальную сущность приложения.
2. Добавить локальный email/password login и session cookie.
3. Добавить CRUD пользователей, ролей доступа и должностей.
4. Сделать CRUD видимым в UI: таблица, кнопка редактирования, форма создания/редактирования, удаление с безопасными disabled-состояниями.
5. Добавить профиль пользователя и настройку темы.
6. Сохранить permission checks на API, UI использовать только как удобство.
7. Писать audit для state-changing действий.
8. Проверить через DB/API tests и Playwright smoke.

## Решения

- `Tenant` остается в модели данных, но UI сейчас называется single workspace.
- Dev admin: `admin@kiss-pm.local` / `admin12345`.
- Удаление самого себя запрещено.
- Удаление назначенной роли или должности защищает БД через FK.
- shadcn preset `b5clqg4G1` принят как направление дизайна, но полноценный shadcn/Tailwind scaffold будет отдельным решением, чтобы не смешивать setup UI-kit с auth/RBAC foundation.

## Проверка

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:db`
- `pnpm db:migrate`
- `pnpm db:seed:dev`
- `pnpm test:e2e:smoke`

## Следующий план

Phase 2.3: добавить audit viewer, negative RBAC browser сценарии, улучшить подтверждение опасных действий, начать custom fields/templates basics.
