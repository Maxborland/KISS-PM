# P0 merge notes — известный конфликт стека (register/reset бэк)

**Статус:** ветки #208/#209/#210 индивидуально зелёные, НО при слиянии стека есть
один реальный конфликт, который надо разрешить вручную. Документируется заранее,
чтобы P0-merge не упал.

## Суть конфликта

`register` + `password-reset` бэкенд реализован **дважды**, в разных файлах, на разных ветках:

| | Ветка | Файл | Миграция |
|---|---|---|---|
| **Канонический** (фронт-мок зеркалит именно его) | #208/#209 (через SSOT) | `apps/api/src/authRegistrationRoutes.ts` | `0042_phase_i_auth_password_reset.sql` |
| **Дубль** (P3.3, мой, избыточный) | #210 (codex/v3-backend-unblock) | `apps/api/src/authRoutes.ts` (register + password-reset/*) | `0046_password_reset_tokens.sql` |

Причина: при выполнении P3.3 я проверил наличие бэка на `codex/backend-prod-go-no-go-fixes`
(trunk) и в #210 — там его не было, и я построил заново. Но SSOT (#208), на котором
стоит #209, **уже содержал** канонический `authRegistrationRoutes.ts`. Это моя ошибка
(не проверил baseRefName/SSOT перед реализацией). См. [[pr205-base-and-master-unrelated]].

Контракты идентичны по кодам (`invalid_registration_payload` / `weak_password` /
`email_taken` / `invalid_email` / `invalid_reset_token` / `reset_token_used` /
`token_expired`), поэтому фронт работает с любым — но **оба одновременно в trunk нельзя**:
дубль маршрутов Hono + дубль строк в `openApiDocument.ts` (упадёт `openApiDocument.test`)
+ дубль `pgTable("password_reset_tokens")` в `schema.ts` (TS duplicate export) + дубль
`createTenant` в `repositories.ts`/`apiTypes.ts`.

## Что НЕ конфликтует (чистый net-new в #210)

P3.1 (security-policy, mig 0044), P3.2 (active-sessions, mig 0045), P4.1/4.2/4.3
(SSE / DM `conversation_members` mig 0047 / presence) — в #209 их нет, конфликта нет.
Их сохраняем как есть.

## Рекомендованное разрешение при merge (#210 → trunk, после #208/#209)

Канон — версия #209 (`authRegistrationRoutes.ts`). Из ветки #210 **отбросить только P3.3**:

1. `apps/api/src/authRoutes.ts` — удалить роуты `POST /api/auth/register`,
   `POST /api/auth/password-reset/request`, `…/confirm` и их парсеры
   (`parseRegistrationInput`, `isWeakPassword`, `parseResetRequestEmail`,
   `parseResetConfirmInput`, `resetTokenTtlMs`, `maxRegistrationNameLength`,
   `maxResetTokenLength`) + импорты `hashPassword`/`permissions` если больше не нужны.
   Оставить login/logout/me + **active-sessions** (P3.2) и `normalizeUserAgent`/charCode-хелперы.
2. `packages/persistence/migrations/0046_password_reset_tokens.sql` — удалить
   (канон — `0042_phase_i_auth_password_reset.sql` из #209).
3. `schema.ts` — убрать `passwordResetTokens` из #210 (оставить версию #209).
   ⚠️ если имена/колонки таблиц расходятся — сверить и оставить только #209-вариант.
4. `repositories.ts` / `apiTypes.ts` — `createTenant`: оставить ОДНУ копию (#209 уже
   добавил `createTenant`; убрать дубль из #210). Убрать `PasswordResetTokenRecord` +
   методы `createPasswordResetToken`/`findPasswordResetTokenByHash`/`consumePasswordResetToken`
   из #210, если #209 их предоставляет под своими именами.
5. `routeTypes.ts`/`app.ts` — `exposeDevSecrets` (P3.3): нужен ли он #209-версии?
   #210 ввёл его для devToken в reset-request. Если #209's `authRegistrationRoutes`
   имеет свой механизм dev-токена — `exposeDevSecrets` из #210 можно убрать; иначе оставить.
6. `apiDocs/openApiDocument.ts` — оставить ОДИН набор строк для register/password-reset.
7. Фронт #209: комментарии в `apps/web/src/auth/**` снова должны ссылаться на
   `authRegistrationRoutes.ts` (мой P3.3-frontend-коммит `4d953aef` ошибочно
   переименовал ссылки в `authRoutes.ts`). Косметика, но для точности — вернуть.

После разрешения: `pnpm exec tsc -b` (0), `vitest run openApiDocument` (6/6),
`vitest run app.test authRegistrationRoutes` — зелёные; миграции применяются
идемпотентно; e2e register/reset проходит на каноне #209.

## Альтернатива

Если предпочитаешь — могу заранее отребейзить #210 и убрать P3.3 из его истории
(риск: P4 стоит поверх P3.3 и трогает те же файлы → конфликты при revert; делать
аккуратно). Скажи, если так — сделаю.
