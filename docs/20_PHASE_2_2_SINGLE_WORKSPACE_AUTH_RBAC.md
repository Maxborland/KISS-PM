# 20. Phase 2.2: Single workspace auth/RBAC/user foundation

## Статус

Phase 2.2 фиксирует поворот реализации: сначала строим рабочий продуктовый каркас для одного рабочего пространства, как будто команда KISS PM является единственным tenant. SaaS-разделение и отдельная админка оператора платформы остаются будущим слоем, а не текущей пользовательской поверхностью.

## Цель

Сделать базовый, проверяемый контур входа и управления пользователями:

- экран входа по email/password;
- session cookie;
- главный экран рабочего пространства;
- CRUD пользователей;
- профиль пользователя с изменяемыми полями;
- CRUD ролей доступа;
- CRUD должностей;
- минимальный RBAC scaffold;
- настройки темы и акцентного цвета;
- audit для административных и профильных изменений;
- browser smoke, который доказывает работу через UI.

## Выбранный подход

- Runtime остается Node + pnpm + Docker Compose PostgreSQL.
- Web runtime: Next.js App Router. Workspace shell, формы, модалки и TanStack Query provider работают как Client Components.
- API runtime остается отдельным Node/Hono backend в `apps/api`; Next.js rewrites направляют `/api/...` и `/health` в API server в dev/browser smoke.
- Auth пока локальный: email/password, password hash через `scrypt`, session token хранится в cookie `kiss_pm_session`.
- Dev admin:
  - email: `admin@kiss-pm.local`;
  - пароль: `admin12345`.
- В БД сохраняется `tenantId`, но UI говорит языком одного рабочего пространства.
- Административные CRUD-действия проходят через API, permission check и audit.
- shadcn/ui остается целевым UI-направлением. В текущем slice применены shadcn-like tokens, размеры, формы и плотность интерфейса без установки Tailwind/shadcn scaffold.
- CRUD пользователей, ролей доступа и должностей выполняется через модальные окна создания, редактирования и подтверждения удаления. Таблица остается основным обзорным состоянием; текущий UI использует summary cards, локальный поиск, понятные empty/loading/error states и disabled-state reasons.
- Web foundation использует плотный admin-dashboard layout: сгруппированный permission-aware sidebar, sticky topbar, быстрый переход по доступным разделам, dashboard metrics и audit preview.
- Protected workspace routes принимают только session cookie. Dev `x-user-id` остается только для dev endpoints и не является заменой авторизации.
- RBAC fail-closed: если access profile пользователя не найден, API возвращает ошибку доступа, а не подставляет admin-профиль.
- User create/update требует transaction boundary и audit wiring; связанные user/credential/audit операции не выполняются в partially wired persistence mode.
- UI скрывает недоступные разделы и action controls по permission set текущего пользователя.

## Реализованный backlog Phase 2.2

1. Расширить модель прав:
   - `tenant.users.manage`;
   - `tenant.positions.read`;
   - `tenant.positions.manage`;
   - `profile.read`;
   - `profile.update`;
   - `workspace.theme.manage`.
2. Добавить persistence-модель:
   - должности;
   - расширенные поля пользователя;
   - credentials;
   - sessions.
3. Добавить auth API:
   - `POST /api/auth/login`;
   - `POST /api/auth/logout`;
   - `GET /api/auth/me`.
4. Добавить workspace API:
   - `GET/POST/PATCH/DELETE /api/workspace/users`;
   - `GET/POST/PATCH/DELETE /api/workspace/positions`;
   - `GET/PATCH/DELETE /api/workspace/access-roles`;
   - `PATCH /api/profile`;
   - `PATCH /api/profile/theme`.
5. Обновить dev seed под рабочий вход и демо-должности.
6. Пересобрать web UI:
   - login screen;
   - sidebar shell;
   - dashboard;
   - явный CRUD пользователей: таблица, модалка создания, модалка редактирования, модалка подтверждения удаления;
   - явный CRUD ролей доступа: таблица, модалка создания, модалка редактирования прав, модалка подтверждения удаления;
   - явный CRUD должностей: таблица, модалка создания, модалка редактирования, модалка подтверждения удаления;
   - профиль пользователя с редактируемыми полями;
   - оформление с настройкой темы и акцентного цвета.
7. Расширить DB/API tests и browser smoke:
   - session-only protected routes;
   - fail-closed missing access profile;
   - fail-closed missing access profile repository для persistence-backed actors;
   - сохранение необновляемых полей при user PATCH;
   - обновление credential email при смене email пользователя;
   - rollback user create при audit failure внутри транзакции;
   - отказ user management при отсутствии transaction boundary;
   - запрет создания пользователя без пароля;
   - запрет невалидного статуса пользователя;
   - очистка optional profile contact fields;
   - вход ограниченного пользователя без падения shell.

## Non-scope

- Отдельная админка владельца SaaS-платформы.
- Регистрация новых tenant.
- Invite email flow.
- OAuth/SAML/LDAP.
- Полная модель должностных и проектных ролей.
- Custom fields/templates UI.
- Gantt, задачи, ресурсная матрица, KPI.
- Коммерческая security-hardening модель.

## Acceptance criteria

- `pnpm typecheck` проходит.
- `pnpm test` проходит.
- `pnpm test:db` проходит против Docker PostgreSQL.
- `pnpm db:migrate` и `pnpm db:seed:dev` подготавливают runtime.
- `pnpm test:e2e:smoke` проходит и доказывает:
  - вход по email/password;
  - видимый CRUD экран должностей;
  - создание, изменение и удаление должности через модалки и таблицу;
  - видимый CRUD экран ролей доступа;
  - создание, изменение и удаление роли доступа через модалки и таблицу;
  - видимый CRUD экран пользователей;
  - создание, изменение и удаление пользователя через модалки и таблицу;
  - вход пользователя с ограниченными правами без падения из-за недоступных audit/role/position endpoints;
  - изменение профиля;
  - изменение акцентного цвета.

## Следующий шаг после Phase 2.2

Phase 2.3 должна закрепить рабочий single-workspace admin foundation:

- видимый audit viewer для последних административных действий;
- негативные browser сценарии по RBAC;
- начальный custom fields/templates baseline;
- решение, когда возвращаем multi-tenant UI и operator admin.
