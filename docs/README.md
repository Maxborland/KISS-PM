# Документация KISS PM

Эта папка — новый canonical baseline продукта. Документы написаны на русском языке и предназначены для того, чтобы по ним можно было заново реализовать KISS PM без переноса старого непригодного кода.

## Порядок чтения

1. `00_ВИДЕНИЕ_ПРОДУКТА.md` — что строим и чего не строим.
2. `01_ПРОДУКТОВЫЙ_КОНТУР.md` — полный пользовательский и управленческий цикл.
3. `02_ДОМЕННАЯ_МОДЕЛЬ.md` — сущности, связи, инварианты.
4. `03_АРХИТЕКТУРА_SAAS_SELF_HOSTED.md` — будущая архитектура реализации.
5. `04_TENANT_НАСТРОЙКИ_И_ШАБЛОНЫ.md` — кастомизация без кода.
6. `05_РОЛИ_ПРАВА_АУДИТ.md` — доступ, роли, scope, аудит.
7. `06_CRM_ПРИЕМКА_И_ПРОЕКТЫ.md` — CRM-вход, проектный черновик, lifecycle.
8. `07_GANTT_ЗАДАЧИ_РЕСУРСЫ.md` — Gantt, задачи, назначения, ресурсная матрица.
9. `08_KPI_СИГНАЛЫ_ДЕЙСТВИЯ.md` — KPI, отклонения, действия, corrective actions.
10. `09_CONTROL_SURFACES.md` — управленческие поверхности и конструктор.
11. `10_UX_UI_РЕФЕРЕНСЫ.md` — UX/UI правила и референсное выравнивание.
12. `11_E2E_КОНТРАКТ.md` — как доказываем, что продукт работает.
13. `12_ФАЗОВЫЙ_ПЛАН.md` — как строим продукт по этапам.
14. `13_ГЛОССАРИЙ_И_АНТИПАТТЕРНЫ.md` — единый словарь и запреты.
15. `14_PHASE_1_NODE_PNPM_START.md` — закрытый scope первого Node + pnpm implementation slice.
16. `15_PHASE_1_2_POSTGRES_PERSISTENCE.md` — PostgreSQL/Drizzle schema, migrations и audit foundation.
17. `16_PHASE_1_3_DOCKER_POSTGRES_RUNTIME.md` — Docker Compose PostgreSQL runtime, DB integration tests и API Postgres wiring.
18. `17_PHASE_1_4_DEV_SEED_AND_DB_API_SMOKE.md` — dev seed и DB-backed API smoke.
19. `18_PHASE_1_5_BROWSER_API_E2E_SMOKE.md` — browser/API E2E smoke для web shell и DB-backed API.
20. `19_PHASE_2_1_ACCESS_PROFILE_ADMIN.md` — первый Phase 2 tenant admin flow для access profiles, прав и audit.
21. `20_PHASE_2_2_SINGLE_WORKSPACE_AUTH_RBAC.md` — single-workspace auth/RBAC/user foundation после решения отложить SaaS-админку.
22. `21_PHASE_2_3_SINGLE_WORKSPACE_CONFIG_AUDIT.md` — audit viewer, negative RBAC и первый custom fields/templates baseline.
23. `22_PHASE_3_CRM_INTAKE_ACTIVE_PROJECT.md` — manual CRM intake, demand `должность + часы`, ресурсная проверка и активация проекта.
24. `23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md` — клиенты, контакты, типы проектов, этапы сделок, детали сделки, list/kanban views и UI/UX cleanup.
25. `24_PHASE_4_PROJECT_LIFECYCLE_TASKS_MY_WORK.md` — starter-срез project lifecycle: Task, participant roles, project detail, My Work и audit.
26. `25_CRM_ENTITY_WORKSPACE_TEMPLATE.md` — единый шаблон карточек CRM-сущностей: сделка, клиент, контакт, товар/услуга, документ и future line items.
27. `26_PHASE_4_2_STORAGE_CONNECTOR_FOUNDATION.md` — будущий cross-cutting слой файловых объектов, внешних ссылок и connector references для CRM, задач, документов и control surfaces.
28. `27_UX_UI_DESIGN_SYSTEM.md` — визуальная дизайн-система: токены, shell/layout, controls, kanban cards, таблицы, detail/activity, responsive, accessibility и visual QA snapshots.
29. `28_PHASE_4_2_TASK_WORKSPACE.md` — полноценный task workspace: список/канбан, CRUD задач, карточка задачи, статусы задач, права редактирования, bulk и activity.
30. `30_PHASE_5_6_MS_PROJECT_CLASS_BACKEND.md` — backend planning engine contract: PlanSnapshot, PlanningCommand, scheduling core, resource planning, scenario proposals, права, audit и API.
31. `31_PHASE_7_PLANNING_WORKSPACE_UI_CONTRACT.md` — UI/product contract для MS Project-like planning workspace: Gantt/WBS, resource sheet, resource matrix, scenario UX и browser acceptance.
32. `31_PLANNING_WORKSPACE_UI_DESIGN.md` — визуальный контракт planning workspace: утвержденные reference screens, вкладки проекта и требования к Gantt/WBS плотности.
33. `32_PHASE_B_PLANNING_UI_DECISIONS.md` — решения по извлечению и адаптации BR2 Gantt UI boundaries.
34. `33_PHASE_C_1_GRID_PARITY_REALTIME.md` — Phase C.1 UI contract для grid/Gantt parity и realtime command preview.
35. `34_PHASE_C_2_RESOURCES_ASSIGNMENTS_CALENDARS.md` — Phase C.2 UI contract для ресурсов, назначений и календарей.
36. `35_PHASE_C_3_SCENARIOS_BASELINE.md` — Phase C.3 UI contract для сценариев и baseline.
37. `36_PHASE_C_4_PROJECT_AUDIT_SETTINGS.md` — Phase C.4 UI contract для project audit/settings.
38. `37_PHASE_C_5_HARDENING.md` — Phase C.5 UI hardening contract.
39. `38_PHASE_D_PLAN.md` — Phase D/E planning: production calendars, absences, оргструктура и tenant resource load.
40. `39_PHASE_7_KPI_SIGNALS_ACTION_ENGINE_BACKEND.md` — backend contract для KPI definitions, evaluations, signals, governed actions и action engine.
41. `40_PHASE_8_CONTROL_SURFACES_BUILDER_BACKEND.md` — backend contract для configurable control surfaces, drafts, publish/archive, widgets and action bindings.
42. `41_PHASE_10_BACKEND_HARDENING.md` — backend production hardening: security/privacy, DB/migrations, performance, operations readiness и release-like smoke.
43. `42_PHASE_G_11_COLLABORATION_COMMUNICATIONS_BACKEND.md` — backend contract для chats/discussions, notifications, meetings, external video links, audit/security и storage integration.
44. `43_PHASE_G_2_COMMUNICATIONS_REALTIME_BACKEND.md` — backend contract для call rooms, audio/video provider control-plane, join tokens, participant state, call events и recordings через Storage layer.
45. `44_PHASE_12_CALENDAR_OCCUPANCY_V2_BACKEND.md` — backend contract для personal calendars, unified occupancy, meetings/calls capacity occupation, minute-slot capacity и future Google/Microsoft/CalDAV sync boundary.
46. `45_PHASE_12_BACKGROUND_JOBS_INFRASTRUCTURE.md` — backend foundation для scheduled/background jobs, retries, cleanup, notification dispatch, connector sync, search projection rebuild и capacity cache warmup.
47. `44_PHASE_H_DOCUMENTS_KNOWLEDGE_LAYER_BACKEND.md` — backend contract для project documents, meeting minutes, decision log, action items, document attachments, versioning и future approvals boundary.

## Планы исправлений

- [`plans/ux-remediation-2026.md`](plans/ux-remediation-2026.md) — полный UI/UX-аудит продукта и дорожная карта (честность affordances, planning parity, reference surfaces, a11y, SSE).

## Runbooks

- [`runbooks/backend-operations.md`](runbooks/backend-operations.md) — Phase 10 backend operations: env, start/update, readiness, migrations, backup/restore, storage cleanup и incident checklist.
- [`runbooks/self-hosted-deployment.md`](runbooks/self-hosted-deployment.md) — Phase 10 self-hosted backend deployment contract: required services, readiness gate, backup/update invariants and Phase G dependency note.
- [`runbooks/e2e-smoke.md`](runbooks/e2e-smoke.md) — локальный browser/API smoke для проверки dev runtime.

## Референсы

`references/` содержит обязательные материалы для продуктовой проверки: BR2-скриншоты, русское описание паттернов, русские выжимки по MS Project scheduling и визуальные boards дизайн-системы. Референсы нельзя копировать буквально. Из них извлекаются возможности, плотность интерфейса, управленческие сценарии, доменные требования и стабильные UI-паттерны KISS PM.

## Статус старого кода

Старый код удален из рабочей версии репозитория. Он не является foundation. Если что-то из старой реализации понадобится как историческая справка, это берется из Git history, а не переносится в новую архитектуру автоматически.

## Статус новой реализации

Новая реализация начинается с Phase 1 Node + pnpm skeleton: `apps/api`, `apps/web`, `packages/domain`, `packages/access-control`, `packages/persistence`, `packages/test-fixtures`. PostgreSQL для разработки поднимается через Docker Compose и наполняется demo данными через `pnpm db:seed:dev`; browser smoke проверяется через `pnpm test:e2e:smoke`. Phase 2 стартовала с access profile admin flow, а затем была сужена до single-workspace foundation: вход, пользователи, роли доступа, должности, профиль, тема, RBAC и audit без отдельной SaaS-админки. Phase 2.3 закрыла audit viewer, negative RBAC и базовые workspace settings для custom fields/templates, включая определения полей для `Сделка` и `Проект`. Phase 3 добавляет ручные сделки, расчет плановых часов из стоимости и ставки, demand `должность + часы`, resource feasibility и governed activation проекта через lifecycle `Project status=draft -> active`. Phase 3.1 укрепляет CRM/intake foundation: клиенты и контакты вынесены в отдельные CRM-страницы и открываются из карточки сделки, типы проектов и этапы сделок вынесены в настройки, справочники можно создавать, редактировать и архивировать с audit trail, сделку можно создавать/редактировать/закрывать/отклонять через governed actions, runtime-значения кастомных полей сделки рендерятся в форме и деталях, а раздел `Сделки` отвечает за list/kanban/detail, drag-and-drop смену этапа, split economics, resource feasibility и активацию без fake UI controls. CRM entity workspace baseline фиксирует единый шаблон карточек для сделки, клиента, контакта и товара/услуги; товар/услуга является самостоятельной tenant-scoped сущностью каталога, а связь со сделкой переносится в будущую модель `DealLineItem`. Общий `CrmActivity` contract дает всем CRM-карточкам persisted ленту, follow-up задачи и файловые ссылки без deal-only placeholder. Phase 4 starter добавляет tenant-scoped `Task`, участников задач, детали активного проекта, создание задачи с audit trail и раздел `Моя работа`. Phase 4.2 расширяет это до полноценного task workspace: список/канбан задач, CRUD задач, карточка задачи, tenant-настраиваемые статусы, права редактирования, bulk и task activity. Следующий логичный cross-cutting slice после Phase 4.2 — `Storage and connector foundation`: он переводит файловые ссылки из metadata-only режима в общий `FileAsset`/`ExternalReference` контракт для CRM, задач, документов, импортов и будущих control surfaces. Phase 5/6 закрепляет backend planning engine: единый `PlanSnapshot`, `PlanningCommand`, MS Project-class scheduling, resource load matrix, scenario proposals, plan-version checks, права и audit без import/export. Phase 7 переводит этот backend в рабочий planning workspace: Gantt/WBS, resource sheet, resource matrix, scenario UX, baseline comparison и command preview/apply без frontend-only планировщика. Визуальная дизайн-система зафиксирована в `27_UX_UI_DESIGN_SYSTEM.md`, boards `references/design-system/` и visual QA snapshots `references/design-system/snapshots/`; она закрепляет текущий KISS PM стиль для токенов, shell, controls, kanban, таблиц, detail/activity, responsive и accessibility.

Текущий web runtime: `apps/web` является Next.js App Router приложением. API остается отдельным Node/Hono backend в `apps/api`. Authenticated workspace shell остается Client Components UI поверх cookie-сессии `kiss_pm_session`, а server-state слой живет в TanStack Query внутри Next client provider. В dev web доступен на `http://127.0.0.1:3000`, API — на `http://127.0.0.1:4000`, а `/api/...` и `/health` маршрутизируются через Next rewrites в API runtime.

Browser smoke `pnpm test:e2e:smoke` запускает собственные процессы на изолированных портах `3100/4100`, чтобы не проверять случайно уже запущенный Docker/dev runtime на `3000/4000`. При необходимости используются `E2E_WEB_PORT` и `E2E_API_PORT`.

Для постоянной локальной разработки используется Docker Compose runtime:

```bash
pnpm dev:compose
```

Эта команда поднимает `postgres`, `api` и `web`, ставит Node/pnpm зависимости в Linux-volume, применяет миграции, выполняет dev seed и держит frontend/backend включенными для live reload. Для фонового режима используется `pnpm dev:compose:detached`.
