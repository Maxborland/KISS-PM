# API Contract Map — Storybook ↔ mock ↔ backend

**Статус:** Phase 8. **Индекс в Storybook:** `API Contract/Индекс сущностей`.  
**Код-реестр:** `apps/web/src/lib/mock-data/api-contract-registry.ts` (health: `api-contract.health.test.ts`).

## Назначение

Сделать расхождение backend/UI видимым: каждая сущность читания имеет фикстуру, MSW-маршрут, потребляющие stories и зеркальный web-type. Мутации задач вынесены в `API Contract/Задачи`.

## Колонки карты

| Колонка | Описание |
|---------|----------|
| Entity | Доменная сущность |
| Fixture | Экспорт из `apps/web/src/lib/mock-data/*` |
| MSW route | GET handler в `.storybook/msw-handlers.ts` |
| Consuming story | Story id (`views-screens--*`, `widgets-*`, `flows-*`) |
| Web type | `apps/web/src/lib/api-types.ts` или зеркало в `views/domain/*` |
| Backend | `apps/api` parsers / routes (источник истины для мутаций) |

## GET-сущности (реестр)

| Entity | Fixture | MSW route | Consuming stories | Web type |
|--------|---------|-----------|-------------------|----------|
| Opportunity | `MOCK_OPPORTUNITIES` | `/api/workspace/opportunities` | `views-screens--deals`, `flows--crm-to-project` | `Opportunity` |
| Project | `MOCK_PROJECTS` | `/api/workspace/projects` | `views-screens--projects-list`, `flows--crm-to-project` | `Project` |
| Task | `MOCK_TASKS` | `/api/workspace/projects/:projectId/tasks` | `views-screens--my-work`, `flows--project-wizard` | `Task` |
| ControlReadModel | `MOCK_CONTROL_SIGNALS` (+ KPI) | `/api/workspace/projects/:projectId/control/read-model` | `views-screens--project-kpi`, `flows--kpi-signal-corrective` | KPI / signals types |
| Client | `MOCK_CLIENTS` | `/api/workspace/clients` | `views-screens--entities-clients` | `Client` |
| Contact | `MOCK_CONTACTS` | `/api/workspace/contacts` | `views-screens--entities-contacts` | `Contact` |
| Product | `MOCK_PRODUCTS` | `/api/workspace/products` | `views-screens--entities-products` | `Product` |
| DealStage | `MOCK_DEAL_STAGES` | `/api/workspace/deal-stages` | `views-screens--deals` | `DealStage` |
| ProjectType | `MOCK_PROJECT_TYPES` | `/api/workspace/project-types` | `views-screens--projects-list` | `ProjectType` |
| WorkspaceUser | `MOCK_WORKSPACE_USERS` | `/api/workspace/users` | `views-screens--admin`, `flows--onboarding-tenant` | `WorkspaceUser` |
| Position | `MOCK_POSITIONS` | `/api/workspace/positions` | `views-screens--admin` | `Position` |
| TaskStatus | `MOCK_TASK_STATUSES` | `/api/workspace/task-statuses` | `views-screens--my-work` | `TaskStatus` |
| CustomFieldDefinition | `MOCK_CUSTOM_FIELDS` | `/api/workspace/config/custom-fields` | `views-screens--settings` | `CustomFieldDefinition` |
| ProjectTemplate | `MOCK_PROJECT_TEMPLATES` | `/api/workspace/config/project-templates` | `views-screens--settings`, `flows--onboarding-tenant` | `ProjectTemplate` |
| KpiDefinition | `MOCK_KPI_DEFINITIONS` | `/api/tenant/current/kpi-definitions` | `views-screens--project-kpi` | `KpiDefinition` |
| AccessProfile | `MOCK_ACCESS_PROFILES` | `/api/tenant/current/access-profiles` | `views-screens--admin` | `AccessProfile` |
| OrgStructureSnapshot | `MOCK_ORG_STRUCTURE` | `/api/tenant/current/org-structure` | `views-screens--admin` | `OrgStructureSnapshot` |
| AuditEvent | `MOCK_AUDIT_EVENTS` | `/api/tenant/current/audit-events` | `views-screens--project-audit`, `flows--audit-trail` | `AuditEvent` |
| ProductionCalendar | `MOCK_PRODUCTION_CALENDAR` | `/api/tenant/current/production-calendar` | `widgets-resource-matrix--default` | `ProductionCalendar` |
| Absence | `MOCK_ABSENCES` | `/api/tenant/current/absences` | `widgets-resource-matrix--default` | `Absence` |
| ScheduledTask | `MOCK_SCHEDULED_TASKS` | `/api/tenant/current/scheduled-tasks` | `views-screens--my-work-list-mode`, `flows--capacity-conflict` | `ScheduledTask` |

Полный machine-readable список — `API_CONTRACT_ENTRIES` в коде (генерирует `.storybook-verify-tmp/api-contract-coverage.json` при тестах).

## Мутации задач

| Operation | Web contract | Backend | Story |
|-----------|--------------|---------|-------|
| POST CreateTaskBody | `views/domain/task-api/task-api-contract.ts` | `apps/api/src/projectWorkParsers.ts` | `api-contract--create-task-payload` |
| PATCH UpdateTaskBody | то же | то же | `api-contract--update-task-payload` |
| Validation | `task-api-validation.ts` | parser errors | `api-contract--create-task-validation` |

Product screens **не** показывают JSON payload (`showApiContractPreview` только в API Contract).

## Верификация

```bash
pnpm --filter @kiss-pm/web test -- api-contract.health.test.ts
pnpm --filter @kiss-pm/web verify:storybook-contract
```
