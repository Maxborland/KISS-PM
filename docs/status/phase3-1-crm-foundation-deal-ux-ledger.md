# Phase 3.1 ledger: CRM foundation, сделки и intake UX

## Scope

- `Client`, `Contact`, `ProjectType`, `DealStage`.
- Сделка как UI-label для `Opportunity`.
- Связи сделки с клиентом, основным контактом, типом проекта и этапом.
- Детальная страница сделки `/opportunities/:id`.
- Views сделок: список и kanban.
- Context-aware `Quick Create` только там, где есть реальные действия.
- UI/UX cleanup перед проектным контуром.

## Decisions

- Code/API identifier `Opportunity` сохраняется в Phase 3.1; UI использует “Сделка”.
- Детали сделки делаем отдельной Next.js page, не slider, чтобы получить deep link, reload и E2E-friendly navigation.
- Kanban без drag-and-drop в Phase 3.1; смена этапа через явное действие.
- Этапы сделок и типы проектов являются tenant-scoped сущностями, а не React constants.

## Red / Green evidence

| Блок | RED | GREEN |
| --- | --- | --- |
| Spec/docs | `docs/23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md` отсутствовал | Документ создан с AC1-AC10 и traceable test plan |
| Backend/domain CRM foundation | `canReadClients is not a function`; schema tables/columns missing; migration `0007_phase_3_1_crm_foundation.sql` missing; DB tests падали на `relation "contacts" does not exist` | Добавлены permissions, schema/migrations, CRM repository, API routes, linked opportunity create/detail/stage update, dev seed и DB coverage |

## Review cycle

- Block A Bug Hunt: проверены placeholder/TODO, fake promises и противоречия с Phase 3; подтвержденных дефектов в spec/docs нет.
- Block A Code Review: spec содержит AC1-AC10, non-goals и traceable test plan; Critical/Important замечаний нет.
- Block A Security Review: код не менялся; security-relevant требования зафиксированы в AC9 и test plan.
- Block B Bug Hunt: найдено отсутствие denied audit для части CRM mutations; исправлено для `contact`, `project_type`, `deal_stage`.
- Block B Code Review: найдено отсутствие DB-инварианта `primaryContact принадлежит client`; исправлено миграцией `0008_phase_3_1_contact_client_fk.sql`.
- Block B Security Review: найден production-risk dev header fallback и отсутствие лимита JSON body до парсеров; добавлен opt-in `enableDevTenantRoutes`, `KISS_PM_ENABLE_DEV_ROUTES=true` только в compose-dev и `readLimitedJsonBody` для CRM/intake mutations.
- Block B Repeat Code Review: найдено, что dev routes не должны включаться по `NODE_ENV !== "production"` и malformed JSON не должен превращаться в `{}` для activation; исправлено.
- Block B Repeat Code Review final: Critical/Important замечаний нет.
- Block B Repeat Security Review final: Critical/Important замечаний нет.

## Fresh verification

- Block A `Test-Path docs/23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md`: passed, exit 0.
- Block A `Test-Path docs/status/phase3-1-crm-foundation-deal-ux-ledger.md`: passed, exit 0.
- Block A `rg -n "23_PHASE_3_1|Phase 3\.1|AC10|TODO|TBD" ...`: passed, exit 0; новых `TODO`/`TBD` нет.
- Block A `git diff --check -- docs/...`: passed, exit 0.
- Block B `pnpm vitest run apps/api/src/app.test.ts apps/api/src/projectIntakeParsers.test.ts packages/access-control/src/policy.test.ts packages/persistence/src/schema.test.ts packages/persistence/src/migration.test.ts`: passed, exit 0; 34 tests.
- Block B `pnpm typecheck`: passed, exit 0.
- Block B `pnpm db:migrate`: passed, exit 0; applied `0008_phase_3_1_contact_client_fk.sql`.
- Block B `pnpm vitest run --config vitest.db.config.ts packages/persistence/src/crmRepository.db.test.ts packages/persistence/src/repositories.db.test.ts packages/persistence/src/seed.db.test.ts apps/api/src/crmRoutes.db.test.ts apps/api/src/app.db.test.ts`: passed, exit 0; 32 tests.
- Block B `git diff --check`: passed, exit 0; только warning про будущую CRLF->LF нормализацию `apps/api/src/app.db.test.ts`.

## Remaining follow-up after Phase 3.1

- Drag-and-drop kanban.
- External CRM/intake connectors.
- Full resource matrix.
- Gantt/WBS/tasks.
