# KISS PM: runtime route inventory для beta

Цель inventory: runtime не должен открывать демо- или Storybook-backed экраны как рабочий продукт. Экран допускается в runtime-навигацию только если он подключён к реальным read-model/API данным и имеет минимальный beta proof.

## Включено в текущий beta runtime

| Route | ScreenId | Статус | Почему включено |
| --- | --- | --- | --- |
| `/dashboard` | `01-dashboard` | wired | Загружает operations cockpit, проекты, задачи и workspace agent thread через runtime read models. |
| `/agent` | `20-agent-cockpit` | wired | Единый workspace agent cockpit; не project-based. |
| `/my-work` | `02-my-work` | wired | Загружает задачи пользователя и scheduled tasks через runtime read models. |
| `/deals` | `05-deals` | wired+stage-action | Загружает opportunities и deal stages без лишних catalog dependencies; stage move включен только при `tenant.opportunities.manage`. |
| `/deals/:dealId` | `06-deal-card` | wired+handoff | Загружает сделку по runtime ID; handoff в проект идет через подтвержденный API action. |
| `/projects` | `07-projects-list` | wired | Загружает проекты; project templates optional и не блокируют список проектов. |
| `/projects/:projectId` | `07b-project-detail` | wired+task-actions | Загружает проект, задачи, статусы, пользователей и activity; статус/поля/комментарии идут через runtime actions. |
| `/projects/:projectId/timeline` | `12-project-gantt` | wired/read-only | Загружает timeline из runtime project read model; mutation planning остается отдельным slice. |
| `/projects/:projectId/resources` | `13-project-resources` | wired/read-only | Показывает workload/resources из runtime project read model; conflict actions остаются отдельным slice. |
| `/directories/clients` | `08-entities-clients` | wired/read-only | Загружает клиентов из runtime API; create/update flows остаются отдельным slice. |
| `/directories/contacts` | `08-entities-contacts` | wired/read-only | Загружает контакты из runtime API; create/update flows остаются отдельным slice. |
| `/directories/products` | `08-entities-products` | wired/read-only | Загружает продукты из runtime API; catalog management остается отдельным slice/defer. |
| `/admin/users` | `09-admin` | wired/read-only | Загружает пользователей рабочей области из runtime API. |
| `/admin/roles` | `09-admin-roles` | wired/read-only | Загружает роли/permissions из runtime API. |
| `/admin/audit` | `17-project-audit` | wired/read-only | Загружает audit events из runtime API. |

## Скрыто из runtime-навигации до API-backed slice

| Route | Причина |
| --- | --- |
| `/showcase/spacing` | Design showcase, не рабочий runtime экран. |
| `/tasks/demo/MDS-39` | Demo task detail; нет runtime task route/data contract. |
| `/tasks/new` | Create flow не входит в текущий proof. |
| `/projects/demo` | Demo project detail; нужен runtime project detail by id. |
| `/projects/demo/baseline` | Demo baseline; нет beta API/action proof. |
| `/projects/demo/scenarios` | Demo scenarios; нет beta API/action proof. |
| `/projects/demo/kpi` | Demo KPI; нет runtime KPI/read-model proof. |
| `/projects/demo/audit` | Demo audit; нет runtime audit feed proof. |
| `/projects/demo/calendars` | Demo calendars; нет runtime calendar contract. |
| `/admin` | Нужен admin/settings proof, чтобы не показывать fixture-backed controls. |
| `/settings` | Нужен workspace config runtime proof. |
| `/profile` | Нужен user profile runtime proof или explicit defer. |
| `/login` | Auth route отдельно, не часть product navigation. |

## Proof этого slice

- `CURRENT_BETA_RUNTIME_SCREEN_IDS` фиксирует текущий allowlist.
- `scripts/beta-runtime-routes.mjs` фиксирует 15 route-smoke paths для `pnpm qa:fast`.
- `canOpenRuntimePath()` возвращает `false` для unknown/non-beta routes, поэтому такие пути не попадают в rail/context navigation.
- `RuntimeDataScreen` для non-beta screen id показывает состояние `Раздел не включён в beta`, а не `ScreenView` fixture fallback.
- Регрессия покрыта в `navigation-registry.test.ts`, `runtime-data-screen.test.ts` и `pnpm qa:fast`.
