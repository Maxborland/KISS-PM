# P0 merge notes — register/reset stack conflict ✅ RESOLVED

**Статус: РАЗРЕШЕНО.** Дубль убран с обеих сторон; стек мёржится без ручного
вмешательства по этому пункту.

## Что было

`register` + `password-reset` бэкенд был реализован дважды:
- **Канон** (фронт-мок зеркалит его): #208/#209 — `apps/api/src/authRegistrationRoutes.ts`
  + миграция `0042_phase_i_auth_password_reset.sql`.
- **Дубль** (P3.3, избыточный): #210 — `apps/api/src/authRoutes.ts` + миграция `0046`.

Причина: при P3.3 проверил trunk + #210 (там бэка не было) и построил заново, не
сверившись с SSOT/#209, где канон уже был. Моя ошибка. См. [[pr205-base-and-master-unrelated]].

## Как разрешено

- **#210 (`ebd5a693`):** forward-коммит убрал весь P3.3-дубль (роуты register/reset из
  `authRoutes.ts`, миграцию 0046, `password_reset_tokens` из schema, `createTenant` +
  reset-методы из repo/apiTypes, `exposeDevSecrets`). Осталось только net-new:
  P3.1 (security-policy), P3.2 (active-sessions), P4 (SSE/DM/presence). tsc 0 · тесты зелёные.
- **#209 (этот коммит):** восстановлены doc-ссылки `authRoutes.ts` → `authRegistrationRoutes.ts`
  в `apps/web/src/auth/**` (мой P3.3-frontend ошибочно их переименовал; #209 хранит
  `authRegistrationRoutes.ts`). Login-ссылка (`authRoutes.ts:160`) не тронута.

## Итог для P0

Слияние стека (#208 → trunk, #209 → #208, #210 → trunk) по register/reset больше
не конфликтует: канон — #209's `authRegistrationRoutes.ts`; #210 его не дублирует.
Прочие миграции #210 (0044 security-policy, 0045 sessions, 0047 direct) с #209 не
пересекаются. (`0046` удалён; на dev-БД, где он уже применялся, это безвредно —
`kiss_pm_migrations` просто хранит лишний тег.)
