# KISS-PM Web → Full Storybook Fidelity + Backend Wiring — Master Roadmap

## 1. Summary table

| Area | Kind | Effort | `endpoint-exists` gaps | Headline |
|---|---|---|---|---|
| resources | wired | L | 12 | Heatmap is fetched then **discarded into a text risk list** — render the real day-matrix + stats + month picker. |
| deal-detail | wired | L | 9 | Read-only deal card needs the whole Лента feed, editable Параметры, finalize, and relation/author lookups. |
| project-detail | wired | L | 6 | Same feed/params enrichment as deals **plus** a large unused knowledge/closure/control backend; feed needs a backend `project` entity-type branch first. |
| deals-list | wired | L | 7 | Already live on real data; fix two funnel binding bugs, add create-deal dialog, search, finalize/edit, CRM timeline. |
| projects-list | wired | L | 7 | Add toolbar (tabs/search/filter) + semantic status tones; archive/manager/code/create blocked on backend. |
| my-work | wired | L | 7 | Ahead of Storybook but ships **hardcoded `ИИ` avatars** and no comment counts — resolve real assignees + wire the detail sheet. |
| admin | wired | L | 9 | Read-only today; add invite/edit/block/role mgmt + the missing «Политики безопасности» card. |
| settings | wired | M | 3 | Read-only profile card → real tabbed Профиль/Уведомления/Оформление forms. |
| entities (Клиенты/Контакты/Продукты) | **new** | L | 5 | Brand-new CRM reference surface; backend CRUD fully exists, build routes + nav + tables + create dialogs. |
| comms-chat | **new** | L | 13 | Chat widgets are **already live in-call**; only the full-screen `/chat` route + channel rail + nav flip are missing. |
| comms-meetings-notifications | **new** | L | 5 | Notifications fully wireable; meetings constrained by entity-scoped list + create-only (no GET) endpoints. |
| calls | wired | L | 6 | A full LiveKit runtime **already exists but is orphaned** — add nav, calls list, launch, recordings, end-session. |
| project-planning-tabs | **new** | XL | 11 | Largest net-new: 5 project sub-tabs (baseline/scenarios/kpi/calendars/audit) over mostly-existing control/planning endpoints. |
| search-and-palette | wired | M | 4 | `/api/workspace/search` is **100% unused** — rewire the palette to live debounced cross-entity results. |

---

## 2. Wave plan (ordered by value ÷ effort)

### Wave 0 — Shared scaffolding (build once, reused everywhere)
Do these first; every later wave depends on them and the single-file constraint makes duplication expensive.

- **User-resolution map** — promote the existing `useWorkspaceUsers()` (runtime-screen-view.tsx:1030) into a shared `Map<userId, RuntimeUser>` + `initialsFromName()` + stable `colorFromUserId()` helper. Consumers: my-work avatars, deals owner, deal/project feeds, admin role column.
- **`<CrmActivityPanel entityType entityId>`** — one shared feed + composer + attach + follow-up-task component. Backend already supports `entityType='opportunity'`; extract it from deal-detail so project-detail/entities reuse it verbatim.
- **Attachment helpers** — `uploadFile` (multipart POST `/attachments/files`), `addExternalRef`, `listAttachments`, download URL builder. Reused by deal/project/task/chat.
- **Permission gating** — extend the `PERMISSIONS` const (L100) with the new `tenant.*` keys (manageUsers/manageRoles/manageClients/manageOpportunities/…) and keep using `disabledReason(me, PERMISSIONS.x)` (TaskAdvanceButton pattern, L763) on every new mutation button.

### Wave 1 — Quick wiring wins on existing surfaces (highest value/effort)
No new routes, no nav. Pure enrichment of `runtime-screen-view.tsx`.

- **Resources heatmap (biggest fidelity leak).** Add `apps/web/src/widgets/resource-matrix/from-capacity.ts` (`capacityTreeToMatrix(...)`); render `<ResourceMatrixStats>` (from `/capacity/summary`), `<ResourceMatrixLegend>`, `<ResourceMatrix>` (from `/capacity/tree`), day headers from `/tenant/current/production-calendar`, vacation cells from `/tenant/current/absences`, and a month picker driving `monthIso` query keys. Drop the `RESOURCE_MATRIX_MOCK`. *(12 endpoint-exists gaps; deliver matrix+stats+legend+headers+month-picker this wave, defer drilldown/occupancy/personal-calendar drawers to Wave 1b.)*
- **My-work truth-up.** Replace hardcoded `assignees=[{initials:'ИИ',color:'c1'}]` (L679) with resolved assignee; add real task ref id; wire `useTaskDetail(taskId)` + activity timeline into `TaskDetailSheet`; add edit (PATCH), archive (DELETE), inbox-create (POST `/tasks`). *(Comment-count badge = flag a backend enrich on `/my-work` to avoid N+1.)*
- **Settings tabs.** Rewrite `SettingsRuntime` (L609) into Segmented Профиль/Уведомления/Оформление: editable name/phone/telegram → PATCH `/api/profile` (email **read-only** — backend ignores it); notification matrix → GET/PUT `/notification-preferences`; theme/accent → PATCH `/api/profile/theme`. Per-tab Save replaces the inert global one.
- **Admin write actions.** Add InviteUserDialog (POST `/users`), per-row Действия menu (PATCH/DELETE `/users/{id}` for edit/block/archive), a Роль column (GET `/access-roles`), editable RolesManager, and the «Политики безопасности» card via control-surfaces (draft→preview→publish→rollback). *(Confirm 2FA/SSO/allowlist map onto a control-surface schema before building the toggles.)*
- **Deal-detail feed + params.** Mount the shared `<CrmActivityPanel entityType="opportunity">`; make Параметры editable (PATCH `/opportunities/{id}`, quick stage via `/stage`); finalize via `…/finalize`; resolve Связи (clients/contacts/products/project-types) and feed authors (`/users`).
- **Search palette.** Add `lib/search-client.ts` + debounced `useWorkspaceSearch` (≥2 chars, AbortController); rewrite `shell/command-palette.tsx` to compose `Command shouldFilter={false}` with live type-grouped results. **v1 scope routes to `project` only (+ remap `opportunity → /deals/{id}`)** so rows don't 404.

### Wave 2 — List/create flows + the new Entities surface
- **Deals-list.** Fix the two `DealsFunnel` binding bugs (card-id shows `{stage.name}`; avatar hardcoded `ИИ`/c1); surface `ownerUserId` on `type Opportunity`; restore the «Команда» column; add `CreateDealDialog` wired to the PageIntro «Сделка» button; client-side SearchPill + Фильтр; finalize/edit in detail.
- **Projects-list.** Add view-toolbar (Segmented Активные/Архив/Шаблоны + SearchPill + type Фильтр), semantic `STATUS_TONE` + derived «Просрочено», Шаблоны tab (`/config/project-templates`). Create flow routes through opportunity activation (no manual POST projects).
- **Entities (new-surface).** New routes `app/clients|contacts|products/page.tsx` → `RuntimeScreenView` ids `08-entities-*`; add `EntitiesRuntime({kind})` + Clients/Contacts/Products tables + create dialogs (POST) + row edit/archive (PATCH `status:'archived'`); add the «Справочники» group to `sidebar-nav.ts`. **Omit fake columns** (Менеджер/Сегмент/Сделок/Сумма/Активных сделок) — no backing fields.

### Wave 3 — New Communications section (nav flip + 3 surfaces)
The widgets/data layer are proven (chat runs in-call; meetings/notifications endpoints exist). This wave is mostly routes + nav + featureFlag removal.

- **Chat.** `lib/chat/chat-client.ts` + `chat-view-model.ts` + `views/screens/chat-runtime-view.tsx`; routes `app/chat/page.tsx` and `app/chat/[channelId]/page.tsx`; flip `{label:'Чаты', soon:true}` → `href:'/chat'`; remove `'chat'` from `UI_ONLY_PREVIEW_SURFACES`. Channel rail + send/reactions/pin/edit/delete + stickers + attachments + read-state. Realtime = **poll** `useMessages` (no SSE).
- **Notifications.** `14-notifications` runtime + `app/notifications/page.tsx`; feed from `/workspace/notifications`, mark-read POST, click-through `notification.route`. Flip nav + remove preview flag.
- **Meetings.** `15-meetings` runtime + `app/meetings/page.tsx`; **project-selector-driven** list (no global meetings endpoint — fan-out per project), create (POST `/meetings`), status transition (PATCH). Meeting **detail deferred** (see §3 — notes/action-items/external-links are create-only).

### Wave 4 — Project planning tabs (XL, the big net-new)
- **Shell:** `views/layout/project-tabs.tsx` tab strip (Обзор/Гант/Ресурсы/Базовый план/Сценарии/KPI/Календари/Аудит) rendered under PageIntro in every project runtime.
- **5 routes** `app/projects/[id]/{baseline,scenarios,kpi,calendars,audit}/page.tsx` → ids `14-…18-project-*`; extend `RuntimeScreenId`, `RuntimeScreenContent`, `runtimeScreenMeta`.
- **Runtimes:** Baseline (list + create snapshot via `apply-command`), Scenarios (`scenarios/preview` + apply with plan-version 409 guard), KPI (`control/read-model` tiles + signals + `control/evaluate` + signal actions), Calendars (production-calendar exceptions via `/bulk`), Audit (merge `control/read-model.auditEvents` + tenant `/audit-events`).
- **Stretch (same wave or 4b):** Knowledge (decisions/action-items/documents), Closure, Control corrective-actions, Auto-solver runs, Saved-views — all endpoint-exists, additive tabs.
- **Note:** this also unblocks the project-detail Wave-1 deferrals (knowledge/closure/control cards can live as tabs here instead of inline).

### Wave 5 — Calls (de-orphan the existing runtime)
- Flip `{label:'Звонки', soon:true}` → `href:'/calls'`.
- Extend `lib/call/call-client.ts` with list/create/events/end/recordings wrappers.
- New `app/calls/page.tsx` + `calls-list-view.tsx` (rooms list with active-session badge, deep-link to `/calls/{roomId}`).
- «Начать звонок» launcher (POST `/call-rooms` → redirect); end-session (`…/sessions/{id}/end`) as host «Завершить для всех»; recordings start/stop/list; call-events history panel.
- Pure-view polish (no endpoint): speaker `setSinkId`, screen-share spotlight layout, in-call device-settings sheet.

---

## 3. Truly missing / no backend (stay honestly disabled or client-side only)

**A. Genuinely blocked — needs new backend before it can be real (render disabled with an honest reason):**
- **project-detail:** editable Параметры — **no `PATCH /api/workspace/projects/{id}`**; «Связи» — no way to filter opportunities by activated `projectId` (Project read-model has no `opportunityId`).
- **projects-list:** «Ответственный» (no `responsibleUserId` on `ProjectRecord`), code subtitle (no code field), «Дублировать», «Удалить» (no routes); «Архив» tab needs a `?status=` param (GET projects hard-filters `active`).
- **settings:** Locale/Timezone (no endpoint), Интеграции tab, Оплата tab (no backend).
- **entities:** Products «Активных сделок» (no product→opportunity link), Clients «Менеджер»/«Сегмент» (no fields), «Импорт» bulk CSV (no endpoint).
- **comms-meetings:** meeting **Заметки / Задачи встречи / Ссылки** are **create-only — no GET to list them back**; also **no GET single meeting** (agenda only readable from the entity-scoped list payload). → Meeting detail can POST with optimistic UI but must be marked "cannot reload" until read endpoints land. Add `GET …/notes|action-items|external-links` + `GET /meetings/{id}` to unblock.
- **project-planning-tabs:** weekly working-pattern/template persistence (the `/production-calendar/bulk` route only handles date exceptions, not weekday hours); baseline per-task plan/Δ columns (baselines GET returns only `id/capturedAt/taskCount`).

**B. No endpoint but fully achievable client-side / on-device (build them, just don't expect a server call):**
- deals-list & projects-list **Фильтр** (client-side over the loaded array).
- calls **speaker select** (`HTMLMediaElement.setSinkId`), **screen-share spotlight** (pure CSS/view-model off `CallStageView`), **in-call device-settings panel** (reuses the existing device hook + `backgroundRef.setMode`).
- chat **realtime** (poll `refetchInterval`; isolate behind chat-client so a future push doesn't change UI).
- search **navigation** — only `/projects/{id}` resolves today; remap `opportunity→/deals/{id}`, gate the rest until detail pages exist.

---

## 4. Risks & sequencing notes

1. **Single-file serialization risk.** Every wired surface lives in the one 1100-line `apps/web/src/views/screens/runtime-screen-view.tsx`. Wired-surface edits (Waves 1–2, the planning runtimes, deal/project) **cannot be parallelized cleanly** without merge pain. Mitigation: Wave 0 extracts the shared `CrmActivityPanel`, user-map, attachment helpers, and `PERMISSIONS` *first*; then start carving runtimes into sibling files (e.g. `screens/deal-detail-runtime.tsx`) as they're touched, so later waves stop editing the monolith. New-surface areas (entities, chat, meetings/notifications, calls, planning tabs) get their own files and are safe to parallelize.
2. **CRM feed backend prerequisite.** project-detail's «Лента» needs a backend change first: add `'project'` to `parseCrmActivityEntityType` + `resolveCrmEntity` (apps/api `crmActivityParsers.ts` / `crmActivityRoutes.ts`). Until then `GET/POST crm/project/{id}/*` returns `400 crm_entity_type_invalid`. **Deal feed (`opportunity`) ships in Wave 1; project feed waits on that PR.** This is why the shared `CrmActivityPanel` is built against `opportunity` first.
3. **Nav enabling is a one-line gate per comms surface** (`soon:true → href`) **plus** removing the id from `UI_ONLY_PREVIEW_SURFACES` in `lib/featureFlags.ts` — forgetting the second leaves the live surface showing «Превью — бэкенд не подключён». Applies to chat, meetings, notifications, calls.
4. **New-route scaffolding checklist** (entities, comms, planning tabs, calls list): (a) `app/<x>/page.tsx` `"use client"` → `RuntimeScreenView id=…`; (b) extend `RuntimeScreenId` union + `RuntimeScreenContent` switch; (c) `runtimeScreenMeta` breadcrumb/activeNav entry; (d) `sidebar-nav.ts` link (palette `NAV_LINKS` derives automatically); (e) reconcile `SCREEN_META`/`catalog.ts` if ids are new.
5. **`verify:storybook-contract` gate scans the nav tree, not previews — and EN_DEV words in story *titles* break the whole gate** (per MEMORY). Keep all new story titles Russian; run the gate after every nav change.
6. **Honesty discipline (AGENTS.md).** For every §3-A gap, render the control disabled with a visible reason (e.g. "появится после PATCH-эндпоинта") rather than a fake editable input — explicitly called out in the project's prototype-vs-real rule. No mock columns on the entities tables.
7. **CodeGraph change index** is mandatory in each PR's final report (run `codegraph sync`, list files/symbols/nodes before→after) — bake it into each wave's definition-of-done.
8. **Effort reality:** Wave 4 (project-planning-tabs, XL) dominates total cost and overlaps project-detail's unused-backend gaps (knowledge/closure/control). Sequence project-detail's heavy cards *into* Wave 4 as tabs to avoid building them twice.