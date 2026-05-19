# Статус Phase 2.2: single-workspace CRUD foundation

## Блок

Видимый CRUD пользователей, ролей доступа, должностей, профиль пользователя, тема и акцентный цвет.

## Текущее состояние

- Login экран доступен по email/password.
- Главный экран показывает метрики и последние audit events.
- `Пользователи` содержит таблицу, модалку создания, модалку редактирования и модалку подтверждения удаления.
- `Роли доступа` содержит таблицу, модалку создания, модалку редактирования прав и модалку подтверждения удаления.
- `Должности` содержит таблицу, модалку создания, модалку редактирования и модалку подтверждения удаления.
- `Профиль` сохраняет имя, телефон и Telegram; пустые optional contact fields очищаются, а не откатываются к старому значению.
- `Оформление` сохраняет тему и акцентный цвет через color input.
- API продолжает проверять permissions и писать audit для state-changing действий.
- Protected workspace routes требуют session cookie; `x-user-id` не принимается на auth/workspace/audit endpoints.
- RBAC fail-closed: missing access profile возвращает `access_profile_not_found`, а не admin fallback.
- RBAC fail-closed также срабатывает, если persistence-backed datasource не предоставляет access profile repository.
- User create/update требует transaction boundary и audit wiring; partially wired persistence mode получает `persistence_not_configured`.
- Разделы и action controls скрываются, если у текущего пользователя нет соответствующих permissions.
- Создание пользователя требует пароль не короче 8 символов.
- PATCH пользователя сохраняет неотправленные поля профиля/темы и синхронизирует credential email при смене email.
- Browser smoke проверяет вход ограниченного пользователя без падения shell, даже если часть endpoints недоступна по RBAC.

## Артефакты

- Browser smoke: `e2e/smoke/single-workspace-auth-rbac.spec.ts`.
- Скриншот видимого CRUD: `docs/status/artifacts/phase2-2-users-crud.png`.

## Последняя проверка

- `pnpm typecheck` — passed, exit code 0.
- `pnpm test` — passed, exit code 0, 7 files / 23 tests.
- `pnpm test:db` — passed, exit code 0, 3 files / 14 tests.
- `pnpm run build` — passed, exit code 0.
- `pnpm test:e2e:smoke` — passed, exit code 0, 1 browser test.
- Bug Hunt: найден и исправлен state leak active view между пользователями; найден и исправлен запрет очистки optional profile fields; добавлена validation для user status.
- Requesting Code Review: найдено 1 Critical и 2 Important; исправлены fail-open RBAC, transaction boundary для user management и permission-gated UI controls.
- Повторное Requesting Code Review: найдено 2 Important; исправлены optional repository fail-open и fallback transaction/audit behavior.
