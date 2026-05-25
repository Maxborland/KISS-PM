# Storybook — подготовка 8 секций (production-grade)

**Статус:** подготовлено 2026-05-26. **Не внедрено в sidebar** — реализация по фазам плана (rename roots, новые каталоги, `storySort`) в **Phase 8** и смежных фазах.

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

| Сейчас в sidebar | Файлы | Целевая секция |
|------------------|-------|----------------|
| `Foundations/*` | `src/stories/foundations/**` | §1 Foundations |
| `UI/*` | `src/components/ui/**/*.stories.tsx` (~43 stems) | §2 Primitives |
| `Catalog/All Components` | `src/stories/catalog/ComponentCatalog.stories.tsx` | Распределить → §2–§3, затем **удалить** root Catalog |
| `Widgets/*` | `src/widgets/{gantt,kanban,funnel}/**` | §4 Widgets |
| `Views/Screens` | `src/views/screens/screens.stories.tsx` | §5 Screens |
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

**Инвентарь screens (из `screens.stories.tsx`):** 19 base + state + interaction variants (~39 story ids с префиксом `views-screens--`).

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
| Foundations | ✅ | ✅ частично |
| Primitives | ✅ (inventory) | ⚠️ как `UI/*` |
| Composites | ✅ (список) | ❌ |
| Widgets | ✅ | ✅ (без ResourceMatrix story) |
| Screens | ✅ | ⚠️ как `Views/Screens` |
| Flows | ✅ (6 flows) | ❌ |
| Patterns | ✅ (группы) | ❌ |
| API Contract | ✅ (структура) | ❌ |

**Implemented** = целевые sidebar roots + globs + storySort — **Phase 8**.

---

## 9. Связь с фазами плана

| Phase | Storybook structure work |
|-------|---------------------------|
| 0–1 | Foundations + gate (без rename roots) |
| 2 | Composites stories начинаются (domain) |
| 3 | API contract health + MSW (питает §8) |
| 4 | Patterns content → позже §7 stories |
| 5–7 | Screens polish (§5) |
| **8** | **Flows + Patterns + API Contract stories + rename UI→Primitives, Views→Screens + deprecate Catalog** |
| 9 | VRT baseline под финальными ids |
