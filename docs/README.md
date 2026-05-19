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

## Референсы

`references/` содержит обязательные материалы для продуктовой проверки: BR2-скриншоты, русское описание паттернов и русские выжимки по MS Project scheduling. Референсы нельзя копировать буквально. Из них извлекаются возможности, плотность интерфейса, управленческие сценарии и доменные требования.

## Статус старого кода

Старый код удален из рабочей версии репозитория. Он не является foundation. Если что-то из старой реализации понадобится как историческая справка, это берется из Git history, а не переносится в новую архитектуру автоматически.

## Статус новой реализации

Новая реализация начинается с Phase 1 Node + pnpm skeleton: `apps/api`, `apps/web`, `packages/domain`, `packages/access-control`, `packages/persistence`, `packages/test-fixtures`. PostgreSQL для разработки поднимается через Docker Compose и наполняется demo данными через `pnpm db:seed:dev`; browser smoke проверяется через `pnpm test:e2e:smoke`. Phase 2 стартовала с access profile admin flow, а затем была сужена до single-workspace foundation: вход, пользователи, роли доступа, должности, профиль, тема, RBAC и audit без отдельной SaaS-админки. Phase 2.3 закрыла audit viewer, negative RBAC и базовые workspace settings для custom fields/templates. Phase 3 добавляет ручные возможности, расчет плановых часов из стоимости и ставки, demand `должность + часы`, resource feasibility и governed activation проекта через lifecycle `Project status=draft -> active`. Phase 3.1 укрепляет CRM/intake foundation: клиенты и контакты вынесены в отдельные CRM-страницы, типы проектов и этапы сделок вынесены в настройки, справочники можно создавать, редактировать и архивировать с audit trail, а раздел `Сделки` отвечает за list/kanban/detail, resource feasibility и активацию без fake UI controls.

Текущий web runtime: `apps/web` является Next.js App Router приложением. API остается отдельным Node/Hono backend в `apps/api`. Authenticated workspace shell остается Client Components UI поверх cookie-сессии `kiss_pm_session`, а server-state слой живет в TanStack Query внутри Next client provider. В dev web доступен на `http://127.0.0.1:3000`, API — на `http://127.0.0.1:4000`, а `/api/...` и `/health` маршрутизируются через Next rewrites в API runtime.

Для постоянной локальной разработки используется Docker Compose runtime:

```bash
pnpm dev:compose
```

Эта команда поднимает `postgres`, `api` и `web`, ставит Node/pnpm зависимости в Linux-volume, применяет миграции, выполняет dev seed и держит frontend/backend включенными для live reload. Для фонового режима используется `pnpm dev:compose:detached`.
