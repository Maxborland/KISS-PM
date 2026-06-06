# Phase 3.1 ledger: CRM foundation, сделки и intake UX

## Scope

- `Client`, `Contact`, `ProjectType`, `DealStage`.
- Сделка как UI-label для `Opportunity`.
- Связи сделки с клиентом, основным контактом, типом проекта и этапом.
- Детальная страница сделки `/opportunities/:id`.
- Views сделок: список и kanban.
- Context-aware `Quick Create` только там, где есть реальные действия.
- UI/UX cleanup перед проектным контуром.
- CRM hardening после пользовательского ревью: реальный drag-and-drop kanban, кликабельные клиент/контакт, редактирование сделки, корректная экономика сделки и custom fields для сущности `Сделка`.
- Governed final actions: закрытие выигранной сделки и отклонение сделки с обязательной причиной, permission check и audit.
- Runtime custom field values for `Сделка`: форма рендерит активные поля, валидирует значения и показывает сохраненные значения в деталях.

## Decisions

- Code/API identifier `Opportunity` сохраняется в Phase 3.1; UI использует “Сделка”.
- Детали сделки делаем отдельной Next.js page, не slider, чтобы получить deep link, reload и E2E-friendly navigation.
- Kanban поддерживает drag-and-drop как desktop baseline; явная смена этапа остается keyboard/accessibility fallback и вызывает тот же backend action.
- Этапы сделок и типы проектов являются tenant-scoped сущностями, а не React constants.
- Карточка сделки не показывает audit block. Audit остается отдельным разделом и backend evidence layer.
- `Стоимость`, `Норма часа`, `Необходимые часы` и `Потребность` показываются отдельно: `plannedHours = contractValue / plannedHourlyRate`, demand хранится строками `должность + часы`.
- Чистая модель финального lifecycle сделки: `won_closed` и `lost_rejected`; старые legacy-статусы не являются текущей моделью.

## Red / Green evidence

| Блок | RED | GREEN |
| --- | --- | --- |
| Spec/docs | `docs/23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md` отсутствовал | Документ создан с AC1-AC10 и traceable test plan |
| Backend/domain CRM foundation | `canReadClients is not a function`; schema tables/columns missing; migration `0007_phase_3_1_crm_foundation.sql` missing; DB tests падали на `relation "contacts" does not exist` | Добавлены permissions, schema/migrations, CRM repository, API routes, linked opportunity create/detail/stage update, dev seed и DB coverage |
| CRM UX hardening | E2E ожидал старую модель: фиктивный kanban без DnD, некликабельные client/contact, deal detail с audit context, отсутствие update deal и opportunity custom fields | Добавлены PATCH deal, custom fields `targetEntity=opportunity`, client/contact deep links, deal edit modal, split economics UI и DnD stage move |

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
- CRM hardening Bug Hunt: smoke выявил нестабильные Playwright selectors для economics preview, detail fields и kanban drop target; исправлено на scoped locators и accessible kanban region.
- CRM hardening Code Review: найдено, что редактирование стоимости до 1 200 000 при норме 6 000 и demand 160 должно давать warning, а не `ok`; smoke зафиксировал `Есть предупреждения`.
- CRM hardening Security Review: backend update сделки проходит через permission check, tenant-scoped linked entity resolution, transaction и audit; Critical/Important замечаний нет.
- Governed final actions/custom fields Bug Hunt: старые legacy-статусы оставались в docs/status/ADR; исправлено на `won_closed/lost_rejected`.
- Governed final actions/custom fields Code Review: runtime custom fields должны валидироваться backend-side, а не только в форме; добавлена validation against active `targetEntity=opportunity` definitions.
- Governed final actions/custom fields Security Review: final action проходит permission check, tenant-scoped repository update, final-state lock и denied audit for restricted mutation.
- Repeat Bug Hunt: frontend date validation принимала rollover-даты вроде `2026-02-31`, а backend уже был строгим; исправлено общим strict date parser и тестом.
- Repeat Security Review: повторное или гоняющееся final action больше не приводит к repository exception/500; persistence возвращает empty update, service отвечает `409 opportunity_final_action_locked`.
- Runtime UI Review: после restart compose web/API экран `Сделки` показывает финальные строки как `Отклонена` и `Закрыта`, без старых action controls для final deals.

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
- CRM hardening RED API `pnpm vitest run apps/api/src/projectIntakeParsers.test.ts apps/api/src/projectIntakeService.test.ts`: failed, exit 1; `parseOpportunityUpdateBody` и `service.updateOpportunity` отсутствовали.
- CRM hardening RED web `pnpm vitest run apps/web/src/opportunityDisplay.test.ts apps/web/src/routes.test.ts`: failed, exit 1; `formatOpportunityEconomics` отсутствовал, `/clients/:id` не маршрутизировался.
- CRM hardening targeted API `pnpm vitest run apps/api/src/projectIntakeParsers.test.ts apps/api/src/projectIntakeService.test.ts apps/api/src/workspaceConfigParsers.test.ts`: passed, exit 0.
- CRM hardening targeted web `pnpm vitest run apps/web/src/opportunityDisplay.test.ts apps/web/src/routes.test.ts apps/web/src/workspaceForms.test.ts`: passed, exit 0.
- CRM hardening `pnpm typecheck`: passed, exit 0.
- CRM hardening `pnpm test`: passed, exit 0; 28 files / 138 tests.
- CRM hardening `pnpm test:db`: passed, exit 0; 7 files / 38 tests.
- CRM hardening `pnpm --filter @kiss-pm/web build`: passed, exit 0; Next.js build successful.
- CRM hardening `pnpm test:e2e:smoke`: passed, exit 0; 1 Chromium smoke covering deal create/edit, client/contact deep links, DnD stage move, feasibility warning and activation.
- Governed final actions/custom fields targeted tests: `pnpm vitest run apps/api/src/projectIntakeParsers.test.ts apps/api/src/projectIntakeService.test.ts apps/web/src/workspaceForms.test.ts packages/persistence/src/migration.test.ts` passed, exit 0; 33 tests.
- Governed final actions/custom fields targeted DB tests: `DATABASE_URL=...55433 pnpm vitest run --config vitest.db.config.ts apps/api/src/app.db.test.ts packages/persistence/src/repositories.db.test.ts` passed, exit 0; 27 tests.
- Governed final actions/custom fields `pnpm typecheck`: passed, exit 0.
- Governed final actions/custom fields `pnpm --filter @kiss-pm/web typecheck`: passed, exit 0.
- Governed final actions/custom fields `pnpm test`: passed, exit 0; 144 tests.
- Governed final actions/custom fields `pnpm test:db`: passed, exit 0; 38 tests.
- Governed final actions/custom fields `pnpm --filter @kiss-pm/web build`: passed, exit 0; Next.js build successful.
- Governed final actions/custom fields `pnpm test:e2e:smoke`: passed, exit 0; 1 Chromium smoke, 42.0s.
- Governed final actions/custom fields docs grep: `rg -n 'converted|status: "rejected"|status=rejected|status=converted|Проект создан|Возможности|runtime rendering/validation значений' docs apps packages e2e` returned no matches, exit 1.
- Governed final actions/custom fields `git diff --check`: passed, exit 0.
- Governed final actions/custom fields `docker compose ps` after restart with `KISS_PM_WEB_PORT=3001`, `KISS_PM_API_PORT=4001`, `KISS_PM_POSTGRES_PORT=55433`: `postgres`, `api`, `web` up; `postgres` healthy.
- Browser proof on `http://127.0.0.1:3001/opportunities`: table rows show `Отклонена` for `lost_rejected` and `Закрыта` for `won_closed`; narrow viewport has no document-level horizontal overflow, table uses contained horizontal scroll.

## Remaining follow-up after Phase 3.1

- External CRM/intake connectors.
- Full resource matrix.
- Gantt/WBS/tasks.
- Настраиваемые options для select/custom dictionary fields; текущий baseline валидирует scalar number/text/date values.
