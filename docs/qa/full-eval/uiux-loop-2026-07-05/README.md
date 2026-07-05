# UI/UX Full Product Evaluation Loop — KISS PM — 2026-07-05

Прогон Loop Library «Full Product Evaluation Loop» (https://signals.forwardfuture.com/loop-library/loops/full-product-evaluation-loop/) с фокусом **исключительно на UI/UX**: удобство, логичность, достаточность функционала, кривость, недоделанность. Дополняет широкий audit-only pass `docs/qa/full-eval/literal-loop-2026-07-05/` (security/RBAC/data-integrity), не дублирует его.

## Канонический loop-промпт (источник)

> Build sanitized, production-scale local data under production-like settings. Inventory every user-facing feature, role, route, button, input, modal, state, and workflow; define documented acceptance criteria and finite risk-based edge cases for each. Test as a real user, logging every bug with reproduction evidence. Review findings for shared causes and dependencies; implement coherent fixes with regression tests, then rerun the full inventory. Stop at a clean pass or blocked handoff. Ask before production, sensitive data, or destructive actions.

Verification condition: «Every inventoried product surface meets its documented acceptance criteria.»

## Environment

- Worktree: `E:\KISS-PM\.claude\worktrees\full-eval-uiux`, ветка `worktree-full-eval-uiux`, база `origin/master` (`ab90acc9`).
- Стенд: docker compose project `kiss-pm-full-eval-20260705` — web `http://127.0.0.1:3000`, api `http://127.0.0.1:4000`, postgres `:55436`. Код стенда = тот же коммит master.
- Данные: миграции + `scripts/seed-dev.ts` (2 тенанта, 5 ролей, орг-структура, CRM, проекты, коммуникации) + синтетика от предыдущего audit-pass.
- Отличия окружения от master (документировано, влияет на оценку):
  - `apps/web/src/middleware.ts` на стенде отключён предыдущей сессией (Next 16 blocker `middleware.ts + proxy.ts`, FPE-ENV-001). Гейтинг анонимных маршрутов на стенде обеспечивает proxy; редирект `/` → `/login` работает.
  - API пересоздан с `KISS_PM_VIDEO_PROVIDER=disabled`: hardening из #223 (`requiredSecret` ≥ 8 символов) несовместим с dev-ключом `devkey` из `.env.example`/`infra/livekit/livekit.yaml` — сам факт зафиксирован как находка (ENV-финдинг). Поверхности звонков оцениваются в состоянии provider=disabled.

## Учётные записи (seed)

| Роль | Email | Пароль |
|---|---|---|
| Админ (тенант Alpha) | admin@kiss-pm.local | admin12345 |
| Админ (тенант Beta) | beta@kiss-pm.local | beta12345 |
| Инженер (профиль alpha-admin!) | engineer@kiss-pm.local | engineer12345 |
| Читатель планов без ресурсов | plan-reader-no-resources@kiss-pm.local | reader12345 |
| Читатель ресурсов | resource-reader@kiss-pm.local | resource12345 |

## Артефакты

- `inventory.md` — реестр поверхностей + acceptance-критерии UI/UX.
- `findings/*.json` — структурированные находки агентов по группам поверхностей.
- `evidence/**` — скриншоты и json-доказательства (воспроизводимые скрипты в `tools/`).
- `report.md` — синтез: общие причины, severity, fix-план.
