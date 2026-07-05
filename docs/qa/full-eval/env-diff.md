# Full Product Evaluation Loop — окружение и отличия от прода

Loop: https://signals.forwardfuture.com/loop-library/loops/full-product-evaluation-loop/ (Loop #010, Evaluation)
Дата запуска: 2026-07-04

## Локальный стенд

| Компонент | Локально | Прод-аналог |
|---|---|---|
| Postgres | docker `kiss-pm-postgres-1`, 127.0.0.1:55433, single node | managed k8s Postgres |
| API | `@kiss-pm/api` dev (tsx), **http://127.0.0.1:4020**, текущий чекаут E:\KISS-PM, `DATABASE_URL=…:55433`, trusted mutation origins по умолчанию (`:3000`) | prod build за ingress/TLS |
| Web | Next.js dev (`next dev`), **http://127.0.0.1:3000**, `KISS_PM_API_ORIGIN=http://127.0.0.1:4020` | `next build`+`next start` за CDN |
| Данные | синтетический seed `scripts/seed-dev.ts` (идемпотентный, onConflict) — санитизация по построению, секретов прода нет | реальные тенантные данные |

> ⚠️ **Не путать с чужими процессами на машине:** web :3001 и API :4010 запущены из worktree `.worktrees/v3-backend-unblock` (другая ветка!), а :4000 — вообще посторонний проект. Первый прогон auth частично шёл через :3000→:4010 и ловил ложные 403 `same_origin_action_required` (тот API доверяет только origin `:3001`) — затронутые позиции перепроверены на чистом стенде :3000→:4020.

## Учётные записи (seed)

| Роль | Email | Пароль | Профиль доступа |
|---|---|---|---|
| Админ tenant-alpha | admin@kiss-pm.local | admin12345 | access-profile-alpha-admin (full) |
| Админ tenant-beta | beta@kiss-pm.local | beta12345 | access-profile-beta-admin (full) |
| Инженер (full-профиль) | engineer@kiss-pm.local | engineer12345 | alpha-admin, позиция «Инженер» |
| Читатель плана без ресурсов | plan-reader-no-resources@kiss-pm.local | reader12345 | tenant.projects.read + tenant.project_plan.read |
| Наблюдатель ресурсов | resource-reader@kiss-pm.local | resource12345 | tenant.project_resources.read |

## Неустранимые отличия от прода (фиксируются, влияние учитывается)

1. **Next dev-режим** вместо prod-сборки: нет минификации/оптимизаций, есть dev-оверлеи ошибок. Ошибки гидрации/рантайма видны ЛУЧШЕ, чем в проде — это плюс для QA.
2. **Нет TLS/CDN/ingress** — куки без Secure, кэширование CDN не проверяется.
3. **Email — in-memory провайдер** (дефолт dev): реальная SMTP-доставка не проверяется, проверяется только выпуск/приём токенов сброса пароля.
4. **Медиа-план (LiveKit) выключен** — opt-in профиль compose; аудио/видео-звонки тестируются до границы «нет медиа-провайдера» (деградация должна быть корректной).
5. **Масштаб данных** — seed даёт демо-объём, не прод-масштаб; нагрузочные аспекты вне охвата этого прогона.
6. **Один браузер (Chromium/Playwright)** — кроссбраузерность вне охвата.

## Границы безопасности (из инструкции лупа)

- Прод не трогаем, секреты не копируем, деструктивные действия только на локальном стенде.
- Непротестированная или заблокированная поверхность НЕ засчитывается как пройденная.
