# Storybook — подготовка 8 секций (production-grade)

**Статус:** обновлено 2026-05-26. **Phase 8 (закрыто):** 8 корней sidebar, Flows/Patterns/API Contract, `UI`→`Primitives`, `Views/Screens`→`Screens`, Catalog → `Foundations/Каталог компонентов`. Health: `storybook-section-roots.health.test.ts`.

**Canonical brief:** [`PRODUCTION-GRADE-BRIEF.md`](./PRODUCTION-GRADE-BRIEF.md) · **План:** [`docs/plans/2026-05-25-kiss-pm-design-v3-storybook-production-grade.md`](../plans/2026-05-25-kiss-pm-design-v3-storybook-production-grade.md)

---

## 1. Целевые 8 секций (таксономия)

| # | Sidebar root (цель) | Назначение | Язык `story.name` |
|---|---------------------|------------|-------------------|
| 1 | **Foundations** | Токены, типографика, density/depth, иконография, контракт | RU |
| 2 | **Primitives** | shadcn/Radix UI primitives, состояния L1 | RU variants |
| 3 | **Composites** | Domain-композиты: `CardPanel`, `DataTable`, `FormLayout`, `PageIntro`, KPI tiles | RU |
| 4 | **Widgets** | Gantt, Kanban, Funnel, ResourceMatrix | RU |
| 5 | **Screens** | Продуктовые экраны 1440px, сценарии | RU |
| 6 | **Flows** | Сквозные сценарии (CRM→Project, wizard, KPI signal, …) | RU |
| 7 | **Patterns** | Empty/loading/error, формы, drawer, filters, bulk | RU |
| 8 | **API Contract** | Fixture ↔ MSW ↔ type ↔ story index | EN ids OK в docs |

**Корни секций (папки `title`):** на Phase 8 можно оставить **English system ids** (`Primitives/Button`) или ввести RU (`Примитивы/Кнопка`) — потребует миграции story id и CI probes (см. §6).

---

## 2. Текущий индекс (до миграции)

| Sidebar root (факт) | Файлы |
|---------------------|-------|
| `Foundations/*` | `src/stories/foundations/**`, `src/stories/catalog/ComponentCatalog.stories.tsx` (`Foundations/Каталог компонентов`) |
| `Primitives/*` | `src/components/ui/**/*.stories.tsx` |
| `Composites/*` | `src/components/domain/**/*.stories.tsx` |
| `Widgets/*` | `src/widgets/**` |
| `Screens` | `src/views/screens/screens.stories.tsx` |
| `Flows/*` | `src/stories/flows/**` |
| `Patterns/*` | `src/stories/patterns/**` |
| `API Contract/*` | `src/stories/api-contract/**` |

| Было (legacy) | Стало |
|---------------|-------|
| `UI/*` | `Primitives/*` |
| `Catalog/All Components` | `Foundations/Каталог компонентов` |
| `Views/Screens` | `Screens` (story id: `screens--*`) |
| — | — | §6 Flows (нет) |
| — | — | §7 Patterns (нет) |
| — | — | §8 API Contract (нет) |

**Composites сегодня:** domain primitives показываются только в `Catalog/All Components` и на product screens — отдельных `src/components/domain/**/*.stories.tsx` **нет**.

---

## 3. Планируемые globs (`.storybook/main.ts`) — Phase 8

```ts
stories: [
  "../src/stories/foundations/**/*.stories.@(ts|tsx)",
  "../src/components/ui/**/*.stories.@(ts|tsx)",           // → title prefix Primitives/
  "../src/components/domain/**/*.stories.@(ts|tsx)",       // NEW Composites
  "../src/widgets/**/*.stories.@(ts|tsx)",                 // → title prefix Widgets/
  "../src/views/screens/**/*.stories.@(ts|tsx)",           // → title Screens/ (не Views/Screens)
  "../src/stories/flows/**/*.stories.@(ts|tsx)",           // NEW
  "../src/stories/patterns/**/*.stories.@(ts|tsx)",        // NEW
  "../src/stories/api-contract/**/*.stories.@(ts|tsx)",    // NEW
  // Catalog — deprecate после переноса
];
```

**`preview.tsx` storySort (цель):**

```ts
order: [
  "Foundations",
  "Primitives",
  "Composites",
  "Widgets",
  "Screens",
  "Flows",
  "Patterns",
  "API Contract"
];
```

---

## 4. Инвентарь по секциям (подготовка)

### §1 Foundations — **частично готово (Phase 1)**

| Story `title` | Файл | Статус |
|---------------|------|--------|
| `Foundations/Colors` | `Colors.stories.tsx` | есть |
| `Foundations/Typography` | `Typography.stories.tsx` | есть |
| `Foundations/Density` | `Density.stories.tsx` | Phase 1 |
| `Foundations/Depth` | `Depth.stories.tsx` | Phase 1 |
| `Foundations/Iconography` | `Iconography.stories.tsx` | Phase 1 |
| `Foundations/Контракт дизайна` | `DesignContract.stories.tsx` | Phase 0–1 docs layer |

**Добавить позже (не Phase 1):** Motion catalog stub → `docs/design-v3/MOTION-CATALOG.md` + optional story.

### §2 Primitives — **готово по содержанию, не по имени root**

| Источник | ~Кол-во | Действие Phase 8 |
|----------|---------|------------------|
| `UI/*` stories | 43 компонента + variants | Rename meta `title`: `UI/X` → `Primitives/X` (механическая замена) |
| State primitives | `empty-state`, `error-state`, `forbidden-state`, `loading-state`, `illu-state` | Остаются в Primitives; product L4 — в Screens/Patterns |

**Исключить из Primitives при миграции:** дубли `page-intro` в UI (product использует `@/views/layout/page-intro`) — story оставить как reference или перенести в Composites.

### §3 Composites — **подготовить каталог (Phase 2 + 8)**

| Компонент (план story) | Путь кода | Сейчас |
|------------------------|-----------|--------|
| CardPanel | `components/domain/card-panel.tsx` | Catalog + screens |
| DataTable | `components/domain/data-table.tsx` | Catalog + screens |
| FormLayout | `components/domain/form-layout.tsx` | screens |
| PageIntro (domain) | `views/layout/page-intro.tsx` | screens |
| BemAvatar / CellStack | `components/domain/*` | screens |
| KpiTile, MoneyValue, … | Phase 2 domain | нет stories |

**Phase 8 deliverable:** `src/components/domain/**/*.stories.tsx` или `src/stories/composites/*.stories.tsx` с `title: "Composites/..."`.

### §4 Widgets — **готово**

| `title` | Файл |
|---------|------|
| `Widgets/Gantt` | `widgets/gantt/gantt.stories.tsx` |
| `Widgets/Kanban` | `widgets/kanban/kanban.stories.tsx` |
| `Widgets/Funnel` | `widgets/funnel/funnel.stories.tsx` |

**Добавить:** `Widgets/ResourceMatrix` — когда стабилизируется block (Phase 6).

### §5 Screens — **готово по содержанию**

| Сейчас | Цель |
|--------|------|
| `Views/Screens` (+ variants) | `Screens/*` — один meta root |

**Инвентарь screens (из `screens.stories.tsx`):** 19 base + state + interaction variants (~39 story ids с префиксом `screens--`).

**Сценарии (Phase 3+):** `default`, `empty`, `loading`, `error`, `forbidden` per screen group — см. план Phase 7.

### §6 Flows — **подготовить (Phase 8, stories нет)**

| Flow story (план) | Зависимости |
|-------------------|-------------|
| CRM → Project | MSW, fixtures, screens CRM + project |
| Project Wizard | task-create-modal, wizard blocks |
| KPI Signal → Corrective Action | analytics blocks |
| Capacity Conflict | resources / planning |
| Onboarding Tenant | admin/settings |
| Audit Trail | project audit |

**Путь:** `apps/web/src/stories/flows/<flow>.stories.tsx`  
**Prefix:** `Flows/...`

### §7 Patterns — **подготовить (Phase 8, stories нет)**

| Pattern group | Источник поведения |
|---------------|-------------------|
| Empty / Loading / Error / Forbidden | `components/ui/*-state`, `STATES-CATALOG.md` |
| Forms (single, wizard, inline, drawer) | blocks + UI form |
| Drawer detail | Sheet / task detail |
| Filters toolbar | `view-toolbar` |
| Bulk actions | future / explicit scope |
| Search / Command | `command-dialog` |

**Путь:** `apps/web/src/stories/patterns/*.stories.tsx`  
**Prefix:** `Patterns/...`

### §8 API Contract — **подготовить (Phase 8 + Phase 3 health test)**

| Артефакт | Путь |
|----------|------|
| Index story | `src/stories/api-contract/index.stories.tsx` |
| Map doc | `docs/design-v3/API-CONTRACT-MAP.md` (создать в Phase 8) |
| Health | `src/__health__/api-contract.health.test.ts` (Phase 3) |

**Колонки карты:** Entity · Fixture · MSW route · Consuming story · `apps/api` type / `apps/web` mirror type.

---

## 5. Миграция Catalog → Primitives + Composites

`Catalog/All Components` — временная витрина Phase 13b. **Не входит в финальные 8 секций.**

| Шаг | Действие |
|-----|----------|
| 1 | Выписать секции каталога → target Primitive vs Composite |
| 2 | Phase 2: domain stories рядом с компонентами |
| 3 | Phase 8: удалить `src/stories/catalog/` из `main.ts` |
| 4 | Health test: запретить `title: "Catalog/*"` в index |

---

## 6. CI и story id (риски миграции)

| Probe / gate | Текущий id | При смене `title` |
|--------------|------------|-------------------|
| Cyrillic preview probe | `foundations-colors--palette` | Обновить URL в `run-storybook-contract-ci.mjs` |
| Copy scan | все ids из `index.json` | Переснять baseline VRT Phase 9 |
| Health tests | grep `UI/`, `Views/Screens` | Обновить на `Primitives/`, `Screens/` |

**Правило:** batch rename roots — один PR + обновление probes + полный `verify:storybook-contract`.

---

## 7. Evidence и git (политика)

| Путь | Git |
|------|-----|
| `apps/web/.storybook-verify-tmp/` | **ignored**; снято с tracking (`git rm --cached`) |
| `apps/web/storybook-static/` | ignored |
| `output/` | ignored |

Локально после `verify:storybook-contract` появляются `batch16-ci-evidence.json`, `batch15c-copy-scan-evidence.json`, `phase0-screen-error-gate.json` — **не коммитить**.

Опционально в CI: upload artifact, не git.

---

## 8. Чеклист «8 секций prepared» vs «implemented»

| Секция | Prepared (этот doc) | Implemented in Storybook |
|--------|---------------------|---------------------------|
| Foundations | ✅ | ✅ |
| Primitives | ✅ | ✅ |
| Composites | ✅ | ✅ |
| Widgets | ✅ | ✅ |
| Screens | ✅ | ✅ (`screens--*` story ids) |
| Flows | ✅ | ✅ |
| Patterns | ✅ | ✅ |
| API Contract | ✅ | ✅ |

**Implemented** = ровно 8 roots; проверка — `storybook-section-roots.health.test.ts`.

---

## 9. Связь с фазами плана

| Phase | Storybook structure work |
|-------|---------------------------|
| 0–1 | Foundations + gate (без rename roots) |
| 2 | Composites stories начинаются (domain) |
| 3 | API contract health + MSW (питает §8) |
| 4 | Patterns content → позже §7 stories |
| 5–7 | Screens polish (§5) |
| **7** | **Screens production pass** — §10: сценарии, плотность, RU copy, 1440px, commits по группам |
| **8** | **Flows + Patterns stories + rename UI→Primitives, Views→Screens + deprecate Catalog** |
| 9 | VRT baseline под финальными ids |

---

## 10. Phase 7 — Product Screens (inventory & ownership)

**Цель:** каждый продуктовый экран в `default` выглядит как готовое приложение на **1440×900**; сценарии `default` / `empty` / `loading` / `error` / `forbidden` согласованы с `ScenarioName` и MSW (`apps/web/src/lib/mock-data/scenarios.ts`).

**Источник маршрутов:** `apps/web/src/shell/navigation-registry.ts` (`SCREEN_ROUTE_BY_ID`).  
**Рендер:** `ScreenView` + block в `apps/web/src/views/blocks/*`.  
**Stories:** `apps/web/src/views/screens/screens.stories.tsx` (+ `screen-story-helpers.tsx`).  
**API/debug:** только `apps/web/src/stories/api-contract/*` (не в product screen stories).

### 10.1 Группы и ответственность (commits 7.2)

| Группа | Owner (слой) | Экраны (`ScreenId`) | Сценарии в SB |
|--------|----------------|---------------------|---------------|
| **Auth / Login** | `login-screen-view.tsx` | `19-login` | default, loading, error, forbidden |
| **Dashboard / My Work** | `dashboard-bento`, `my-work-block` | `01-dashboard`, `02-my-work` | default + empty/loading/error/forbidden; DnD/list — отдельные play |
| **Planning** | `projects-list`, `entity-detail`, project blocks | `07-*`, `07b`, `12–18` | default + 4 state; Gantt widget отдельно |
| **CRM / Funnel** | `deals-block`, `entities-block`, `entity-detail` | `05–06`, `08-*` | default + states; funnel DnD play |
| **Analytics / Control** | `project-kpi`, audit, signals (future) | `16–17`, reports (future) | default + states |
| **Admin / Settings** | `admin-block`, `settings-block`, `avatar-menu` | `09–11` | default + forbidden |
| **Wizard** | `task-create-modal-block` | `04-create-task-modal` | default, steps, validation (product); payload → API Contract |
| **States (shared)** | `state-screen-block` | `state-*` | empty, error, forbidden, loading |

### 10.2 Инвентарь экранов

| ID | Story (RU) | Block | Rail | Сценарии Phase 7 |
|----|------------|-------|------|------------------|
| `00-space-discipline` | 00 Дисциплина отступов | `SpaceDisciplineBlock` | overview | default |
| `01-dashboard` | 01 Дашборд | `DashboardBento` | overview | default, empty, loading, error, forbidden |
| `02-my-work` | 02 Моя работа | `MyWorkBlock` | tasks | default, empty, loading, error, forbidden, list, DnD |
| `03-task-card` | 03 Карточка задачи | `EntityDetailBlock` task | tasks | default, dirty save play |
| `04-create-task-modal` | 04 Модалка создания | `TaskCreateModalBlock` | tasks | default, step1, validation |
| `05-deals` | 05 Сделки | `DealsBlock` | crm | default, DnD |
| `06-deal-card` | 06 Карточка сделки | `EntityDetailBlock` deal | crm | default, dirty |
| `07-projects-list` | 07 Список проектов | `ProjectsListBlock` | projects | default, filter play |
| `07b-project-detail` | 07b Карточка проекта | `EntityDetailBlock` | projects | default |
| `08-entities-*` | 08 Справочники | `EntitiesBlock` | directories | default, search play |
| `09-admin` | 09 Администрирование | `AdminBlock` | settings | default, forbidden |
| `10-settings` | 10 Настройки | `SettingsBlock` | settings | default |
| `11-avatar-menu` | 11 Меню аватара | `AvatarMenuBlock` | overview | default |
| `12-project-gantt` | 12 Гант | `GanttSliceBlock` + widget | projects | default (+ `Widgets/Gantt`) |
| `13-project-resources` | 13 Ресурсы | `ProjectResourcesBlock` + widget | projects | default (+ `Widgets/ResourceMatrix`) |
| `14-project-baseline` | 14 Базовый план | `ProjectBaselineBlock` | projects | default |
| `15-project-scenarios` | 15 Сценарии | `ProjectScenariosBlock` | projects | default |
| `16-project-kpi` | 16 KPI | `ProjectKpiBlock` | projects | default |
| `17-project-audit` | 17 Аудит | `ProjectAuditBlock` | projects | default |
| `18-project-calendars` | 18 Календари | `ProjectCalendarsBlock` | projects | default |
| `19-login` | 19 Вход | `LoginScreenView` | login | default, loading, error, forbidden |
| `state-*` | Состояния L3 | `StateScreenBlock` | tasks | empty, error, forbidden, loading |

### 10.3 API Contract (вне product screens)

| Story | Файл | Назначение |
|-------|------|------------|
| POST CreateTaskBody — превью | `stories/api-contract/task-api.stories.tsx` | JSON + play |
| PATCH UpdateTaskBody — превью | то же | JSON + play |
| Валидация CreateTaskBody | то же | field errors |

Product blocks: `showApiContractPreview` только в API Contract stories.

### 10.4 Верификация Phase 7

```bash
pnpm --filter @kiss-pm/web typecheck
pnpm --filter @kiss-pm/web test
pnpm --filter @kiss-pm/web verify:storybook-contract
```

Скриншоты 1440px: Storybook viewport `desktop1440` (`.storybook/preview.tsx`).

### 10.5 Commits 7.2 (порядок)

1. `docs: define storybook production structure` — этот файл §10  
2. `feat: polish storybook screens auth-login`  
3. `feat: polish storybook screens dashboard-my-work`  
4. `feat: polish storybook screens planning`  
5. `feat: polish storybook screens crm`  
6. `feat: polish storybook screens analytics`  
7. `feat: polish storybook screens admin-settings`  
8. `feat: polish storybook screens project-wizard`  
