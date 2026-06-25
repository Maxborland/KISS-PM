# KISS PM — Going Live: Phased Migration Plan (Storybook Contract-Mock → Real Next App on Real API)

> Подготовлено: 2026-06-25. Контекст: весь Storybook-слой построен по контракт-мок-паттерну
> с инвариантом **«переключение на боевой = смена `apiOrigin` + удаление `fetchImpl`, без правок UI»**.
> Этот документ проверяет, насколько инвариант реален, и описывает конкретный путь вывода
> 34 функциональных поверхностей (6 доменов) в реальное Next-приложение на боевом `apps/api`.

## Вердикт по инварианту
- **ИСТИНА для транспортного слоя.** Все 6 хуков используют одинаковую форму
  `createMock<X>Fetch()` + `create<X>Client({ apiOrigin: "", fetchImpl })`; каждый клиент по умолчанию
  `credentials:"include"` и `fetchImpl ?? fetch`. Удаление `fetchImpl` при `apiOrigin:""` работает,
  т.к. `next.config.ts` rewrite'ит `/api/*` на боевой Hono same-origin. CORS/cookie менять не нужно.
- **ЛОЖЬ/неполно для всего вокруг.** Поверхности **не смонтированы ни в один роут** (`app/page.tsx` —
  статичная заглушка). Нет шелла в приложении, нет навигации, нет auth-гейта, нет выбора проекта
  (хардкод `MOCK_PROJECT_ID`). Моки пропускают 401/403/RBAC и ряд валидаций боевого API; один путь
  (`/planning/commits`) вообще без клиентского метода. Итог: swap транспорта — ~10% работы; монтаж +
  auth + снятие костылей + закрытие контракт-разрывов — остальные 90%.

---

## Фаза 0 — Готовность инфраструктуры и API (блокирующее предусловие; без UI)
1. **Postgres + миграции до 0042.** Дефолтный `createInMemoryTenantDataSource()` не имеет
   `findCredentialByEmail`/`createSession` → `/api/auth/login` отдаёт `501 auth_not_configured`. Задать
   `DATABASE_URL`, прогнать `packages/persistence/scripts/migrate.mjs` (файловый аппликатор — источник
   истины; drizzle `meta/_journal.json` устарел и игнорируется). Подтвердить применение
   `0041_phase_h2_multi_funnel.sql` (pipelines, `opportunities.pipeline_id`) и
   `0042_phase_i_auth_password_reset.sql` (`password_reset_tokens`).
2. **Бамп readiness-гейта.** `apps/api/src/serverReadiness.ts:9` хардкодит
   `expectedDatabaseMigrationTag = "0040_..."` → поменять на `0042_...`, чтобы `GET /api/health/ready`
   падал на устаревшей схеме (сейчас READY даже без 0041/0042).
3. **Prod-env, падающий на старте при ошибке** (`serverConfig.ts`/`runtimeSecurityConfig.ts`):
   `DATABASE_URL` (required), `KISS_PM_SECURE_COOKIES` ≠ `false`, auth rate-limit = `redis` (memory в prod
   запрещён) + secure `REDIS_URL`, `KISS_PM_TRUST_PROXY_HEADERS=true` за прокси,
   `KISS_PM_TRUSTED_MUTATION_ORIGINS` с боевым web-origin только при split-origin.
4. **Топология.** Рекомендуется **same-origin + Next rewrite**: задать `KISS_PM_API_ORIGIN`
   (`apps/web/next.config.ts:5`) на боевой хост API; браузер шлёт относительные `/api/*` → ни CORS, ни
   смены cookie `SameSite`. Split-origin = большой объём (CORS + Allow-Credentials + SameSite=None) — для v1 избегать.
5. **Засеять реальный credential** (через регистрацию или seed-скрипт), чтобы первый логин работал.

**Проверка:** `GET /api/health/ready` = 200 только после 0042; `POST /api/auth/login` сидовыми кредами →
200 + `Set-Cookie: kiss_pm_session`.

---

## Фаза 1 — Swap клиентов (та самая «инвариантная» правка), env-driven; Storybook остаётся на моках
**1a. Единый env-driven, dev-only селектор мок-транспорта.** Сейчас `NEXT_PUBLIC_API_ORIGIN` нет и
`process.env.*` в `apps/web/src` не читается нигде. Новый `apps/web/src/lib/api-transport.ts`:
```ts
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";
export function resolveFetchImpl(domain: string): typeof fetch | undefined {
  const reg = (globalThis as any).__KISS_PM_MOCKS__ as Record<string, () => typeof fetch> | undefined;
  return reg?.[domain]?.();
}
```
Каждая приватная фабрика клиента в хуке:
```ts
const fetchImpl = resolveFetchImpl("workspace"); // undefined в боевом приложении
clientRef.current = createWorkspaceClient({ apiOrigin: API_ORIGIN, ...(fetchImpl ? { fetchImpl } : {}) });
```
Идентичная правка во всех шести: `delivery/lib/use-planning.ts` (40-46, "planning"),
`crm/lib/use-crm.ts` (35-38, "crm"), `communications/lib/use-comms.ts` (`useCommsClient`, "comms"),
`auth/lib/use-auth.ts` (`useAuthClient`, "auth"), `workspace/lib/use-workspace.ts` (`useWorkspaceClient`,
"workspace"), `admin/lib/use-admin.ts` (30-33, "admin"). `credentials` менять не нужно (везде дефолт
`"include"`); `x-kiss-pm-action: same-origin` уже шлётся (удовлетворяет `app.ts` guard).

**1b. Storybook — на моках (рекомендуется).** Глобальный декоратор в `.storybook/preview.tsx` кладёт в
`globalThis.__KISS_PM_MOCKS__` шесть `createMock<X>Fetch` до рендера стори. Боевое приложение этот
глобал не ставит → реальный `fetch`. `mock-*-backend.ts` + их тесты остаются **контракт-ораклом** для
Фазы 6 — не удалять.

**1c. Единственный неоднородный путь.** `usePlanning` бьёт в мок напрямую на `use-planning.ts:173`
(`/planning/commits` — мок-онли, без клиентского метода). На боевом история проекта — из
`/api/tenant/current/audit-events`. Добавить метод в `@kiss-pm/planning-client`
(`getProjectAuditEvents(projectId)`), переписать `loadCommits`. До этого `commits-surface.tsx` держать под прототип-флагом.

**Проверка:** без `NEXT_PUBLIC_API_ORIGIN` и без моков временная страница с `<MyWorkSurface/>` шлёт
реальный `GET /api/workspace/my-work` (виден в devtools) → 401 (нет сессии). Storybook рендерит на моке.

---

## Фаза 2 — Auth: реальный session-гейт (вместо авто-входа демо-кредами)
1. **Боевой login-роут.** `app/(auth)/login/page.tsx` рендерит существующий `LoginSurface` (уже делает
   реальный `POST /api/auth/login`); demo-prefill убрать за dev-флаг. Так же смонтировать
   register/reset-request/reset-confirm под `(auth)/`.
2. **Server-side гейт через middleware.** `apps/web/src/middleware.ts`: читает HttpOnly-cookie
   `kiss_pm_session`; нет на защищённом роуте → `redirect('/login')`. Важно: форма пользователя из
   `/login` (усечённый `TenantUser` — id/tenantId/name/accessProfileId) ≠ из `/api/auth/me` (полный
   `WorkspaceUser` с email/phone/theme). UI гидрируется из `me()` (уже так в `useAuth.refresh`).
3. **Убрать три авто-входа** (заменить на «аноним → редирект на login», что surface уже моделируют через
   `SurfaceState` forbidden / 401→anonymous): `auth/profile/profile-surface.tsx:65-79` (+ DEMO-консты
   52-54), `auth/avatar-menu/avatar-menu-surface.tsx:49-50,62-70`,
   `workspace/settings/settings-surface.tsx:39-40,74-94` (ProfileTab).
4. **Убрать DEMO-креды и «Демо»-баннеры** автологина. Сидовый креденшл мока + его тест остаются (Storybook).
5. **401/403/RBAC теперь нагружены.** Мок workspace-бэкенда auth/RBAC не делает; боевой
   `projectWorkRoutes.ts` гейтит всё (401 + per-action `preflight*` 403). Хуки уже ветвятся на
   401/403/forbidden → Фаза 6 должна прогнать каждую поверхность под сессией БЕЗ права (путь 403, который мок не давал).

**Проверка:** `/delivery/...` анонимно → 302 на `/login`; логин → cookie → `me()` → рендер; logout → `me()` 401 → аноним.

---

## Фаза 3 — Роутинг/монтаж: реальный App Router с шеллом и навигацией
`app/` плоский (только `/`, not-found, error). Шелл (`shell/app-shell.tsx`, `app-sidebar`, `app-topbar`),
доменные фреймы (`*/ui/*-frame.tsx`), `WorkspaceShell`, `WorkspaceChrome`, `ScreenView` существуют, но
импортируются только стори/тестами. Смонтировать.

**3a. Общий authenticated-layout** `app/(app)/layout.tsx` (Client) с `AppShell` (sidebar+topbar+контент,
off-canvas drawer уже есть). `WorkspaceChrome` как обёртка-шапка экрана. В `app-sidebar.tsx:44-67` пункты
сейчас неинтерактивные `<span>` (`DEMO_NAV_TITLE`) → заменить на `next/link` + `usePathname()` active.
Убрать `PROTOTYPE_LABEL` chip за dev-флаг.

**3b. Роуты (под `(app)/`) → поверхность:** `/dashboard`→dashboard; `/my-work`→my-work;
`/projects`→projects-list; `/projects/[projectId]`→project-detail; `/projects/[projectId]/{schedule,
assignments,resources,baseline,calendars,scenarios,commits,settings}`→соответствующие delivery-surface
(overview на корне делёвери); task-inspector — drawer внутри schedule/detail, не отдельный роут;
`/crm/{deals,deals/[dealId],clients,contacts,products}`; `/comms/{chat,channels,calls,meetings,
notifications}`; `/admin/{users,roles}`; `/settings`; `/profile`. Каждый роут — тонкая обёртка,
рендерящая surface (surface уже `"use client"`). `globals.css` грузится один раз в `app/layout.tsx`.

**3c. Выбор проекта вместо `MOCK_PROJECT_ID`.** `mock-workspace-backend.ts:46,49` хардкодят
`CURRENT_USER_ID`/`MOCK_PROJECT_ID`; `mock-planning-backend.ts` — соответствующий `PROJECT_ID`. Surface,
импортирующие эти константы напрямую, берут `projectId` из route-param (`useParams()`), источник —
реальный `GET /api/workspace/projects`. `usePlanning(projectId)` уже принимает параметр. `CURRENT_USER_ID`
→ актор сессии из `me()`.

---

## Фаза 4 — Снятие костылей (чек-лист по поверхностям)
Централизовать dev-флаг: `SHOW_PROTOTYPE_CHROME = process.env.NEXT_PUBLIC_SHOW_PROTOTYPE === "1"` в
`views/lib/demo.ts`; гейтить за ним баннеры/чипы.
- **a) «Прототип»-баннеры** (утверждают «in-memory / swap=apiOrigin» — оба ложны на боевом) — обернуть в
  `SHOW_PROTOTYPE_CHROME && (...)` во всех surface + шелл-чипы.
- **b) «Демо»-баннеры автологина** — удалить с Фазой 2. **devToken-панель** (`reset-request-surface.tsx`)
  — убрать (боевой возвращает только `{status:"ok"}`), оставить нейтральное anti-enumeration подтверждение.
- **c) `demoAction()`-аффордансы** — триаж: *включить (сделать реальными)* — кнопка создания задачи +
  PrototypeDialog-формы, nav-пункты аватар-меню (`next/link`), Notifications в топбаре, инспектор
  «Открыть в Gantt»/«Удалить»/вложения-упоминания-эмодзи, schedule Baseline/Фильтры/Колонки, collapse в
  виджетах; *осознанно отложить (честное «coming soon», без фейк-persist)* — settings
  Интеграции/Оплата (нет API), аватар-меню «активные устройства», calls «Подключиться» (нет реального WebRTC).
- **d) Уже реальное — оставить, только репойнт транспорта:** login/register/reset, `PATCH
  /api/profile[/theme]`, переключение темы + logout, `my-work` updateTaskStatus, schedule apply/undo, chat
  postMessage, calls start/end/participant-state, pin/react.
- **e) Без бэкенда — держать под флагом (не фейкать):** revert коммита (audit append-only), unpin,
  mark-all-read/typing/presence/search, ресурсные ставки/стоимость (нет в схеме), baseline restore.

---

## Фаза 5 — Закрытие контракт-разрывов (до go-live по поверхности)
1. **Миграции 0041/0042 + бамп readiness** (Фаза 0). *Проверка:* password-reset round-trip на боевой БД.
2. **Create/update/comment/delete задач — только боевые.** Мок workspace делает лишь GET + PATCH status
   (POST create НЕТ). Боевой `projectWorkParsers.ts:88` валидирует title 3-160 + `isSafeSingleLineText`,
   даты, `durationWorkingDays 1-1000`, `plannedWork 1-10000`, priority-enum, ≥1 executor, ≤20 участников.
   *Проверка:* граничные вводы против боевого, UI показывает 400.
3. **409 `task_acceptance_required`** — мок пропускает; боевой `transitionTaskStatus` требует для
   `requiresAcceptance`. *Проверка:* перевод в done не-акцептором → 409 в UI.
4. **401/403/RBAC** — мок не отдаёт. *Проверка:* роут без права → 403 → forbidden-`SurfaceState`.
5. **`/planning/commits` → audit-events** (Фаза 1c). *Проверка:* commits рендерит реальную историю.
6. **login vs me shape** — UI не читает email/phone из ответа login, только из `me()`.
7. **Optimistic-concurrency под реальной задержкой.** `schedule-surface.tsx` оптимистично патчит до
   `apply()`; WBS-нумерация/критпуть/каскад авторитетны только от бэка (провизорный `wbsCode "…"` будет
   «прыгать»). *Проверка:* API с инъекцией задержки; откат при reject, reload на `plan_version_conflict`.

---

## Фаза 6 — Верификация (доказать паритет)
1. **Mock-as-oracle diff-тест.** Оставить `mock-*-backend.ts` + тесты; добавить conformance-сьют,
   гоняющий один набор запросов против мока и реального `apps/api` (с эквивалентными данными), сверяя
   статусы/формы happy-path — конкретное доказательство «мок зеркалил боевой».
2. **E2E против живого `apps/api`** (Playwright MCP): login→cookie→каждый роут→1 реальное чтение + 1
   реальная мутация на домен. Это гейт «UI не менялся».
3. **Per-surface smoke-матрица** по каждому роуту: (i) грузится под сессией, (ii) forbidden без права,
   (iii) основное действие round-trip, (iv) отложенные аффордансы честно disabled, (v) без
   «Прототип»/«Демо» при выключенном `NEXT_PUBLIC_SHOW_PROTOTYPE`.
4. **Негатив-покрытие** (мок не давал): 401, 403, 409, 429 (rate-limit логина), 400-валидации.
5. **Обновить health-тест** `__health__/storybook-contract.health.test.ts` — контракт стори/шелла
   держится с моками через декоратор, не инлайн.

---

## Порядок, риски, инкрементальный выкат
**Порядок:** Фаза 0 → 1 (swap + Storybook-мок-декоратор) → 2 (auth-гейт) → 3 (роуты + nav + выбор проекта)
→ 4 (снятие костылей) → 5 (разрывы) → 6 (верификация). Фазы 4-5 идут частично параллельно **по доменам** после 0-3.

**Самые рискованные:**
1. **Auth-гейт (Фаза 2)** — наивысший риск: расхождение login/me, HttpOnly-cookie (не читается из JS),
   корректность middleware-редиректа, и полное отсутствие 401/403 в моке → боевые failure-режимы вообще не обкатаны.
2. **Same-origin vs split-origin (0.4)** — split ломает инвариант «без правок UI» (CORS + SameSite=None). Держать same-origin.
3. **Выбор проекта (3c)** — `MOCK_PROJECT_ID` импортится delivery-поверхностями напрямую; пропуск одной → surface привязана к несуществующему проекту (404/forbidden).
4. **Optimistic под задержкой (5.7)** — «мгновенность» мок-производная; гонки на planning-слайсе — вероятный источник странного UI.
5. **Create/RBAC-пути (5.2-5.4)** — только боевые, моком не покрыты; первый контакт — с продом.

**Инкрементально:** после Фаз 0-3 — сначала read-only **Project Delivery + Workspace** (совпадает с
направлением «Project Delivery first»), мутации под гейтом; затем CRM, Communications, Admin — каждый со
своим go-live после верификации его разрывов Фазы 5. Storybook-мок-декоратор (1b) сохраняет дизайн-ревью
во время выката.

**Ключевые файлы:** swap — шесть `*/lib/use-*.ts` + новый `apps/web/src/lib/api-transport.ts`; роутинг —
новый `app/(app)/layout.tsx` + ~28 роут-файлов, `shell/app-sidebar.tsx` (реальные ссылки),
`views/layout/workspace-chrome.tsx`; auth — новый `middleware.ts`, роуты `(auth)/login|register|
password-reset`, surface profile/avatar-menu/settings (убрать автологин); костыли — `views/lib/demo.ts`
(dev-флаг) + баннеры/`demoAction` каждой surface; разрывы — `apps/api/src/serverReadiness.ts` (бамп тега),
`@kiss-pm/planning-client` (audit-events метод), `use-planning.ts:173`; конфиг — `next.config.ts:5`
(`KISS_PM_API_ORIGIN`).
