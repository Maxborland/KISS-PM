# KISS PM: runtime route inventory для beta

Цель inventory: runtime не должен открывать демо- или Storybook-backed экраны как рабочий продукт. Экран допускается в runtime-навигацию только если он подключён к реальным read-model/API данным и имеет минимальный beta proof.

## Включено в текущий beta runtime

| Route | ScreenId | Статус | Почему включено |
| --- | --- | --- | --- |
| `/dashboard` | `01-dashboard` | wired | Загружает operations cockpit, проекты, задачи и workspace agent thread через runtime read models. |
| `/agent` | `20-agent-cockpit` | wired | Единый workspace agent cockpit; не project-based. |
| `/my-work` | `02-my-work` | wired | Загружает задачи пользователя и scheduled tasks через runtime read models. |
| `/deals` | `05-deals` | wired | Загружает opportunities и deal stages без лишних catalog dependencies. |
| `/projects` | `07-projects-list` | wired | Загружает проекты; project templates optional и не блокируют список проектов. |

## Скрыто из runtime-навигации до API-backed slice

| Route | Причина |
| --- | --- |
| `/showcase/spacing` | Design showcase, не рабочий runtime экран. |
| `/tasks/demo/MDS-39` | Demo task detail; нет runtime task route/data contract. |
| `/tasks/new` | Create flow не входит в текущий proof. |
| `/deals/demo/DEAL-101` | Demo deal detail; нужен runtime deal detail/handoff slice. |
| `/projects/demo` | Demo project detail; нужен runtime project detail by id. |
| `/projects/demo/gantt` | Demo planning; нужен runtime timeline/read-model proof. |
| `/projects/demo/resources` | Demo resources; нужен runtime workload proof. |
| `/projects/demo/baseline` | Demo baseline; нет beta API/action proof. |
| `/projects/demo/scenarios` | Demo scenarios; нет beta API/action proof. |
| `/projects/demo/kpi` | Demo KPI; нет runtime KPI/read-model proof. |
| `/projects/demo/audit` | Demo audit; нет runtime audit feed proof. |
| `/projects/demo/calendars` | Demo calendars; нет runtime calendar contract. |
| `/directories/clients` | Нужен отдельный clients runtime/data/action proof. |
| `/directories/contacts` | Нужен отдельный contacts runtime/data/action proof. |
| `/directories/products` | Нужен отдельный products runtime proof или explicit defer. |
| `/admin` | Нужен admin/settings proof, чтобы не показывать fixture-backed controls. |
| `/settings` | Нужен workspace config runtime proof. |
| `/profile` | Нужен user profile runtime proof или explicit defer. |
| `/login` | Auth route отдельно, не часть product navigation. |

## Proof этого slice

- `CURRENT_BETA_RUNTIME_SCREEN_IDS` фиксирует текущий allowlist.
- `canOpenRuntimePath()` возвращает `false` для unknown/non-beta routes, поэтому такие пути не попадают в rail/context navigation.
- `RuntimeDataScreen` для non-beta screen id показывает состояние `Раздел не включён в beta`, а не `ScreenView` fixture fallback.
- Регрессия покрыта в `navigation-registry.test.ts` и `runtime-data-screen.test.ts`.
