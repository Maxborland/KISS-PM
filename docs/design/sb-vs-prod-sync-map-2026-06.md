# Backend↔Frontend sync — карта (по областям)


## resources  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro: title 'Ресурсы · {project}', lead 'Дневная матрица загрузки на месяц.', actions = [Роли filter button, 'Май 2026' month-picker button, Назначить primary button]
- ResourceMatrixStats: 5 KPI items + load progress bar — Ёмкость(capacityHours ч), Назначено(assignedHours ч, accent), Загрузка(loadPct %, warning≥90 danger≥100), Свободно(freeHours ч, danger<500), Сотрудников(employees); bar width = min(loadPct,100)%
- ResourceMatrixLegend: 7 swatches — Свободно / Норма ≤8ч / Высокая >10ч / Перегруз >15ч / Выходной / Отпуск / Праздник
- ResourceMatrix heatmap grid: column headers Сотрудник + % + day headers (1..N) with weekend/holiday/today markers and weekdayShort tooltip (DayHeadCell)
- ResourceMatrix rows: hierarchical (kind workshop|sub|role|person), WBS indent 0..2, collapsible group toggles, person avatar+initials(color c1..c6), percent column with level low|mid|norm|high|over (PercentCell)
- ResourceMatrix per-day cells (DayValueCell): kinds weekend | holiday | vacation | zero | load{hours, level normal|high|over}; load shows hours number, title tooltip '{hours} ч'

**Текущая проводка:** ProjectResourcesRuntime (runtime-screen-view.tsx:509, mounted at app/projects/[id]/resources/page.tsx via RuntimeScreenView id '13-project-resources') fetches usePlanning(id)→/api/workspace/projects/{id}/planning/read-model, useCapacitySummary(monthIso)→/api/workspace/capacity/summary, useCapacityTree(monthIso,id)→/api/workspace/capacity/tree?projectId={id}. But it renders NONE of the Storybook composition: it shows a plain PageIntro (no actions/month-picker), 4 generic MetricTiles (Назначено ч / Участники / Перегрузка count / Перегруз ч), an AssignmentsTable (task·role·resource·plan-hours from planning), and a CapacityRiskPanel that flattens the capacity tree only to list the top-5 overloaded employees. The capacity tree's per-employee per-day load (days[] with workMinutes/capacityMinutes/heat) — the entire point of the heatmap — is fetched and then DISCARDED into a text risk list. ResourceMatrix, ResourceMatrixStats, ResourceMatrixLegend, day headers, month picker, Назначить, Роли filter are all unwired.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/L] Render the day heatmap matrix (ResourceMatrix) from real capacity tree — rows per position(role)/employee(person) with WBS indent + collapsible groups, per-day cells colored by load level
    эндпоинты: GET /api/workspace/capacity/tree?monthIso={YYYY-MM}&projectId={id}
- [endpoint-exists/S] Wire ResourceMatrixStats (Ёмкость/Назначено/Загрузка/Свободно/Сотрудников + load bar) from capacity summary instead of mock
    эндпоинты: GET /api/workspace/capacity/summary?monthIso={YYYY-MM}
- [endpoint-exists/S] Render ResourceMatrixLegend (static 7-swatch legend) above the matrix
    эндпоинты: 
- [endpoint-exists/S] Day headers: mark weekend/holiday/today + weekday labels (Выходной/Праздник legend states) from production calendar (tree carries isFreeDay/hasException, production-calendar is source of truth for working weekdays + holiday exceptions)
    эндпоинты: GET /api/tenant/current/production-calendar
- [endpoint-exists/S] Vacation/absence cells (Отпуск) in the matrix — tree CapacityDayCell.isAbsence already flags them; absences list gives type (vacation|sick_leave|...) and ranges for richer tooltips
    эндпоинты: GET /api/tenant/current/absences
- [endpoint-exists/S] Month picker control ('Май 2026' button) — change monthIso and re-query capacity tree+summary
    эндпоинты: GET /api/workspace/capacity/tree?monthIso=  ·  GET /api/workspace/capacity/summary?monthIso=
- [endpoint-exists/M] Cell-click drilldown popover: which projects/tasks/assignments load a person on a given day
    эндпоинты: GET /api/workspace/capacity/drilldown?monthIso={YYYY-MM}&resourceId={id}&date={YYYY-MM-DD}
- [endpoint-exists/M] Per-resource unified occupancy timeline drawer (assignments + reservations + absences + personal events + meetings + call sessions in one view)
    эндпоинты: GET /api/workspace/occupancy?resourceId={id}&from={date}&to={date}
- [endpoint-exists/L] Per-person personal calendar drawer with event CRUD (manual availability blocks affecting capacity)
    эндпоинты: GET /api/workspace/resources/{resourceId}/personal-calendar?from=&to=  ·  POST /api/workspace/resources/{resourceId}/personal-calendar/events  ·  PATCH /api/workspace/resources/{resourceId}/personal-calendar/events/{eventId}  ·  DELETE /api/workspace/resources/{resourceId}/personal-calendar/events/{eventId}
- [endpoint-exists/M] 'Назначить' action — create/add a resource assignment to a task (planning command)
    эндпоинты: POST /api/workspace/projects/{projectId}/planning/preview-command  ·  POST /api/workspace/projects/{projectId}/planning/apply-command
- [endpoint-exists/M] Absence management ('Назначить отпуск' / mark vacation) creating absence rows that re-color the matrix
    эндпоинты: POST /api/tenant/current/absences  ·  DELETE /api/tenant/current/absences/{id}
- [endpoint-exists/S] 'Роли' filter — filter matrix to role/position rows (client-side over tree; position names available from positions list)
    эндпоинты: GET /api/workspace/positions

**Build plan:**
1. Add a transform module apps/web/src/widgets/resource-matrix/from-capacity.ts: capacityTreeToMatrix(tree: CapacityTreeNode|CapacityTreeNode[], summary: CapacitySummaryResponse, monthIso, productionCalendar?, absences?) -> ResourceMatrixData. Map tree.type direction/unit/team -> kind workshop/sub (indent 0/1, collapsible), position -> kind role (indent 1, percent from sum(workMinutes)/sum(capacityMinutes)), employee -> kind person (indent 2, avatar initials from name). Build DayCell[] per employee from days[] (CapacityDayCell): isFreeDay -> {kind:'weekend'|'holiday' via production-calendar exceptions}, isAbsence -> {kind:'vacation'}, workMinutes===0 -> {kind:'zero'}, else {kind:'load', hours: workMinutes/60, level: heat 'overloaded'->'over' | 'busy'->'high' | 'normal'->'normal'}. Build days header (DayHeader[]) from monthIso days-in-month + productionCalendar.workingWeekdays/exceptions + today.
2. Build stats from summary: capacityHours=totalCapacityMinutes/60, assignedHours=totalWorkMinutes/60, loadPct=round(totalWorkMinutes/totalCapacityMinutes*100), freeHours=totalFreeMinutes/60, employees=count(employee nodes). Wire into ResourceMatrixStats.
3. Add hooks in runtime-screen-view.tsx next to existing useCapacityTree/useCapacitySummary: useProductionCalendar() -> apiFetch<ProductionCalendarResponse>('/api/tenant/current/production-calendar'); useAbsences() -> apiFetch<ResourceAbsencesResponse>('/api/tenant/current/absences'). (CapacityTreeNode/CapacityDay types already declared at runtime-screen-view.tsx:94-96 — extend CapacityDay with isAbsence?/isFreeDay?/hasException? and heat enum free|normal|busy|overloaded.)
4. Rewrite ProjectResourcesRuntime body: keep usePlanning for the Назначения table but replace CapacityRiskPanel-as-only-consumer — render <ResourceMatrixStats stats={...summary}/>, <ResourceMatrixLegend/>, and <ResourceMatrix data={capacityTreeToMatrix(capacityTree.data, capacity.data, monthIso, prodCal.data, absences.data)}/> wrapped in <StateGate state={capacityTree}>. Keep AssignmentsTable as a secondary panel below.
5. Add month state: const [monthIso,setMonthIso]=useState(currentMonthIso()); pass to useCapacitySummary/useCapacityTree; render a MonthPicker control in PageIntro actions (prev/next + label) — re-query is automatic via queryKey [monthIso].
6. Add cell drilldown: useCapacityDrilldown(monthIso,resourceId,date) -> apiFetch<CapacityDrilldownResponse>(`/api/workspace/capacity/drilldown?monthIso=${monthIso}&resourceId=${resourceId}&date=${date}`); make DayValueCell clickable (onSelect prop) opening a Popover listing contributions[] (title + workMinutes/60 ч, grouped by projectId).
7. Add per-resource drawer: useOccupancy(resourceId,from,to) -> apiFetch<OccupancyWindowsResponse>(`/api/workspace/occupancy?resourceId=${id}&from=${from}&to=${to}`) and usePersonalCalendar(resourceId,from,to) -> apiFetch<PersonalCalendarResponse>(`/api/workspace/resources/${id}/personal-calendar?from=${from}&to=${to}`); clicking a person name opens a Drawer with an occupancy timeline tab + personal-calendar tab. Add event CRUD mutations (POST/PATCH/DELETE /api/workspace/resources/{id}/personal-calendar/events) with queryClient.invalidateQueries(['personal-calendar']) and ['capacity-tree'].
8. Wire actions: 'Назначить' opens an assign dialog -> useMutation POST /api/workspace/projects/${id}/planning/apply-command (preview via /planning/preview-command first), invalidate ['capacity-tree','capacity-summary','planning']. Add absence path (POST /api/tenant/current/absences) for marking vacation. 'Роли' button toggles a client-side filter (show only role/person rows) over the transformed rows; optionally label roles from useQuery /api/workspace/positions.
9. No new route/nav needed — surface already mounted at apps/web/src/app/projects/[id]/resources/page.tsx (RuntimeScreenView id '13-project-resources', breadcrumb Проекты > Ресурсы at runtime-screen-view.tsx:1021). All work is enriching ProjectResourcesRuntime + the resource-matrix widget; remove the RESOURCE_MATRIX_MOCK dependency once the transform is wired.

---

## deal-detail  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro header: title + subtitle + actions ("Запланировать" schedule, "Сохранить" save, "..." more-actions menu)
- Stage chip row: stage Chip (tone info/violet/success/warning) + BemAvatarStack of watchers/team with "+N" overflow
- Main "Описание" CardPanel: free-text description/context
- Main "Лента" CardPanel: activity feed list (avatar, author name, timestamp, text) + compose box (Textarea "Написать комментарий…", Paperclip attach IconButton, "Отправить" send Button)
- Aside "Параметры" CardPanel → FormSection "Основное": Field Стадия (Select lead/qual/proposal/deal), Field Срок (DatePicker), Field Сумма (numeric Input)
- Aside "Связи" CardPanel: link-list of related projects/products (Briefcase rows)

**Текущая проводка:** Wired at apps/web/src/app/deals/[id]/page.tsx → RuntimeScreenView id="06-deal-card" → DealDetailRuntime (runtime-screen-view.tsx:318). Today it only: (1) GET /api/workspace/opportunities/{id} → title, lead (clientName + dateRange), an EntityCards "Описание" card and a FactList aside (Клиент, Сумма, Срок, Статус проверки) — all READ-ONLY; (2) POST /api/workspace/opportunities/{id}/feasibility behind "Проверить реализуемость" (perm tenant.resource_feasibility.read); (3) POST /api/workspace/opportunities/{id}/activate behind "Активировать проект" confirm Dialog (perm tenant.project_activation.manage) → routes to /projects/{id}. NOT wired: the entire activity feed (Лента), comment/file compose, follow-up tasks, the editable Параметры form + "Сохранить", quick stage change, finalize (won/lost/cancelled), watchers avatar stack, Связи link-list, and the "Запланировать" schedule action. The Storybook Лента + aside form are 100% mock (FEED const + defaultValue inputs).

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/M] Activity feed (Лента) — render real comments/tasks/files + attachments + system/audit events instead of mock FEED
    эндпоинты: GET /api/workspace/crm/opportunity/{id}/activity
- [endpoint-exists/S] Add comment from compose box ("Написать комментарий…" + Отправить)
    эндпоинты: POST /api/workspace/crm/opportunity/{id}/comments
- [endpoint-exists/M] CRM follow-up tasks in feed: create + toggle todo/done
    эндпоинты: POST /api/workspace/crm/opportunity/{id}/tasks  ·  PATCH /api/workspace/crm/opportunity/{id}/tasks/{activityId}
- [endpoint-exists/M] Attach file/external reference from compose Paperclip + list attachmentItems
    эндпоинты: POST /api/workspace/attachments/files  ·  POST /api/workspace/attachments/external-references  ·  POST /api/workspace/crm/opportunity/{id}/files  ·  GET /api/workspace/attachments  ·  GET /api/workspace/attachments/{attachmentId}/download
- [endpoint-exists/M] Editable Параметры form (Стадия/Срок/Сумма/Описание) + "Сохранить"
    эндпоинты: PATCH /api/workspace/opportunities/{id}  ·  GET /api/workspace/deal-stages
- [endpoint-exists/S] Quick stage change via stage chip/Select
    эндпоинты: PATCH /api/workspace/opportunities/{id}/stage  ·  GET /api/workspace/deal-stages
- [endpoint-exists/S] Finalize deal (won/lost/cancelled + reason) in "..." more-actions menu — backend capability not in prod at all
    эндпоинты: PATCH /api/workspace/opportunities/{id}/finalize
- [partial/M] Связи link-list: resolve clientId/contactId/productId/projectTypeId to names
    эндпоинты: GET /api/workspace/clients  ·  GET /api/workspace/contacts  ·  GET /api/workspace/products  ·  GET /api/workspace/project-types
- [endpoint-exists/S] Watchers / author avatars: resolve authorUserId & assigneeUserId to name+initials for feed avatars and stack
    эндпоинты: GET /api/workspace/users
- [endpoint-exists/M] "Запланировать" schedule action → create a meeting linked to the deal
    эндпоинты: POST /api/workspace/meetings  ·  GET /api/workspace/meetings

**Build plan:**
No new route/nav needed — apps/web/src/app/deals/[id]/page.tsx + DealDetailRuntime already exist; this is an enrichment of DealDetailRuntime in apps/web/src/views/screens/runtime-screen-view.tsx (entityType is fixed to 'opportunity').
Add TS types mirroring OpenAPI schemas (apps/api/src/apiDocs/schemas/crmProjects.ts): CrmActivityItem {id,type:'comment'|'task'|'file',title,body,status:'todo'|'done'|null,dueDate,assigneeUserId,authorUserId,fileUrl,fileSizeBytes,mimeType,createdAt,updatedAt}, CrmActivityFeedResponse {activities,attachmentItems,systemEvents,canReadRawAudit,auditEvents}, EntityAttachment {kind,fileAsset,externalReference,createdByUserId,createdAt}.
Add hooks: useCrmActivity(id) = useQuery(['crm','opportunity',id,'activity'], () => apiFetch<CrmActivityFeedResponse>(`/api/workspace/crm/opportunity/${id}/activity`)); useWorkspaceUsers() = useQuery(['workspace','users'], () => apiFetch<{users:RuntimeUser[]}>('/api/workspace/users')) for author/assignee name+initials resolution; reuse existing useDealStages().
Build ActivityFeed component (new, in runtime-screen-view or a sibling): map activities into the existing .feed list markup (BemAvatar from resolved user, name, createdAt via existing date helper, body); render file items with download link to /api/workspace/attachments/{attachmentId}/download; show attachmentItems and (when canReadRawAudit) auditEvents. Replace the mock FEED in the design with this.
Comment compose mutation: useMutation(() => apiFetch(`/api/workspace/crm/opportunity/${id}/comments`, {method:'POST', json:{body}})) on Textarea+Отправить; onSuccess invalidate ['crm','opportunity',id,'activity']. Gate with disabledReason(me, PERMISSIONS.manageOpportunities).
Follow-up task: small create panel → POST `/api/workspace/crm/opportunity/${id}/tasks` {title,body?,dueDate?(DatePicker),assigneeUserId?(Select from useWorkspaceUsers)}; in-feed checkbox toggles status via PATCH `/api/workspace/crm/opportunity/${id}/tasks/${activityId}` {status:'todo'|'done'}; invalidate activity query.
Attach action (Paperclip): file picker → POST /api/workspace/attachments/files (multipart) or external-reference dialog → POST /api/workspace/attachments/external-references with entityType='opportunity', entityId=id; invalidate activity query so attachmentItems refresh.
Editable Параметры: replace read-only FactList aside with a real form — Select Стадия from useDealStages(), DatePicker expectedStart/expectedFinish, numeric Input budget, Textarea description; "Сохранить" → useMutation PATCH `/api/workspace/opportunities/${id}` with OpportunityWriteRequest {title,stageId,expectedStart,expectedFinish,budget,plannedHours,description,clientId,contactId,productId,projectTypeId,demand}; quick stage Select also calls PATCH `/.../stage` {stageId}. Gate with PERMISSIONS.manageOpportunities; invalidate ['opportunity',id].
Wire "..." more-actions menu (DropdownMenu) → Finalize items (Выиграна/Проиграна/Отменена) opening a reason Dialog → PATCH `/api/workspace/opportunities/${id}/finalize` {finalAction:'won'|'lost'|'cancelled',reason}; on success invalidate ['opportunity',id] and ['opportunities'].
Связи card: add useClients/useContacts/useProducts/useProjectTypes lookups (GET /api/workspace/clients|contacts|products|project-types) to resolve opportunity.clientId/contactId/productId/projectTypeId into the link-list rows.
Optional "Запланировать": wire to POST /api/workspace/meetings (create meeting referencing the deal) behind a small dialog; list via GET /api/workspace/meetings — defer if meetings UI is out of this area's scope.
Verify with the Storybook contract mock layer (apps/web/.storybook/mocks/) so the enriched runtime renders against in-memory fetchImpl, then run verify:storybook-contract gate.

---

## project-detail  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro: title + subtitle, actions = 'Запланировать' (Calendar) / 'Сохранить' (primary) / overflow IconButton (MoreHorizontal)
- Stage row: Chip (stage label/tone) + BemAvatarStack of assignees ('+2')
- Main / 'Описание' CardPanel: free-text project context paragraph
- Main / 'Лента' CardPanel: activity feed list (BemAvatar + author name + timestamp + text) — currently hardcoded FEED[]
- Main / 'Лента' composer: Textarea 'Написать комментарий…' + Paperclip attach IconButton + 'Отправить' (Send) primary button
- Aside / 'Параметры' CardPanel: FormSection 'Основное' → Stage Select (lead/qual/proposal/deal), 'Срок' DatePicker, 'Сумма' numeric Input — all editable, gated 'владельцу и админу'
- Aside / 'Связи' CardPanel: link-list of related projects/products (Briefcase rows with codes like PRJ-2026-014)

**Текущая проводка:** ProjectDetailRuntime (apps/web/src/views/screens/runtime-screen-view.tsx:395) wires only: useProject(id) → GET /api/workspace/projects/{id} returning {project, tasks}; useTaskStatuses() → GET /api/workspace/task-statuses. Renders PageIntro (title/lead + Гант/Ресурсы links), EntityCards 'Контур проекта' with a read-only FactList (Клиент/Статус/Период/Задач), CreateTaskPanel (POST /api/workspace/projects/{id}/tasks) and TaskTable (with PATCH /api/workspace/projects/{id}/tasks/{taskId}/status + POST /api/workspace/tasks/{taskId}/comments per task). The Storybook 'Лента' activity feed, the comment composer, the file-attach, the editable Параметры aside (Stage/Срок/Сумма + Сохранить), and the 'Связи' relations are NOT wired — no CRM-activity feed exists anywhere in prod (even DealDetailRuntime at :318 omits it). The runtime does not use the entity-grid two-column layout the Storybook block uses.

**Gaps (фича → эндпоинты → данные/усилие):**
- [partial/L] Activity feed ('Лента') — read project-scoped CRM activity (comments/files/tasks + system events)
    эндпоинты: GET /api/workspace/crm/{entityType}/{entityId}/activity
- [partial/M] Comment composer ('Написать комментарий…' + 'Отправить') posting a comment to the feed
    эндпоинты: POST /api/workspace/crm/{entityType}/{entityId}/comments
- [endpoint-exists/M] Attach file from composer (Paperclip) + files list/download/remove on the feed
    эндпоинты: GET /api/workspace/attachments?entityType=project&entityId={id}  ·  POST /api/workspace/attachments/files  ·  POST /api/workspace/attachments/external-references  ·  GET /api/workspace/attachments/{attachmentId}/download  ·  DELETE /api/workspace/attachments/{attachmentId}
- [partial/M] Follow-up task from feed + complete/reopen (CRM task activity)
    эндпоинты: POST /api/workspace/crm/{entityType}/{entityId}/tasks  ·  PATCH /api/workspace/crm/{entityType}/{entityId}/tasks/{activityId}
- [no-endpoint/M] Editable Параметры aside (Stage / Срок / Сумма) + 'Сохранить' button
    эндпоинты: PATCH /api/workspace/projects/{projectId} (does not exist)
- [no-endpoint/S] 'Связи' relations card (linked projects/products/opportunity)
    эндпоинты: GET /api/workspace/opportunities (filter by activated projectId)
- [endpoint-exists/M] Decision log card/tab (unused backend capability)
    эндпоинты: GET /api/workspace/projects/{projectId}/knowledge/decisions  ·  POST /api/workspace/projects/{projectId}/knowledge/decisions  ·  PATCH /api/workspace/projects/{projectId}/knowledge/decisions/{decisionId}
- [endpoint-exists/M] Action items card/tab (unused backend capability)
    эндпоинты: GET /api/workspace/projects/{projectId}/knowledge/action-items  ·  POST /api/workspace/projects/{projectId}/knowledge/action-items  ·  PATCH /api/workspace/projects/{projectId}/knowledge/action-items/{actionItemId}
- [endpoint-exists/M] Project documents card/tab with versions (unused backend capability)
    эндпоинты: GET /api/workspace/projects/{projectId}/knowledge/documents  ·  GET /api/workspace/projects/{projectId}/knowledge/documents/{documentId}  ·  POST /api/workspace/projects/{projectId}/knowledge/documents  ·  POST /api/workspace/projects/{projectId}/knowledge/documents/{documentId}/versions  ·  DELETE /api/workspace/projects/{projectId}/knowledge/documents/{documentId}
- [endpoint-exists/M] Project closure panel (state + preview + close + retrospective lessons)
    эндпоинты: GET /api/workspace/projects/{projectId}/closure  ·  POST /api/workspace/projects/{projectId}/closure/preview  ·  POST /api/workspace/projects/{projectId}/closure/close  ·  POST /api/workspace/projects/{projectId}/closure/lessons
- [endpoint-exists/L] Project control / KPI signals card (read-model + evaluate + corrective actions)
    эндпоинты: GET /api/workspace/projects/{projectId}/control/read-model  ·  POST /api/workspace/projects/{projectId}/control/evaluate  ·  POST /api/workspace/projects/{projectId}/control/signals/{signalId}/status  ·  POST /api/workspace/projects/{projectId}/control/signals/{signalId}/corrective-actions  ·  PATCH /api/workspace/projects/{projectId}/control/corrective-actions/{correctiveActionId}

**Build plan:**
BACKEND PREREQ for the feed: extend CRM activity to projects. In apps/api/src/crmActivityParsers.ts add 'project' to parseCrmActivityEntityType (line 43-52); in apps/api/src/crmActivityRoutes.ts add a 'project' branch to parseCrmEntityRouteParams (parse via a new parseProjectIdParam) and to resolveCrmEntity (findProjectById → CrmEntityContext sourceEntityType 'Project', isLocked from closure state). Without this, GET/POST crm/project/{id}/activity|comments returns 400 crm_entity_type_invalid. (If backend cannot change, fallback: bind feed to the project's source opportunity id — but Project read-model has no opportunityId, so this also needs a backend field.)
Refactor ProjectDetailRuntime (apps/web/src/views/screens/runtime-screen-view.tsx:395) from the EntityCards layout to the entity-grid two-column layout from the Storybook block: <div className='entity-grid'><div className='entity-grid__main'>…feed/description…</div><aside className='entity-grid__aside'>…Параметры (FactList) + Связи…</aside></div>. Keep useProject/useTaskStatuses; move CreateTaskPanel/TaskTable into main column or a 'Задачи' card.
Add type CrmActivityResponse = { activities: CrmActivity[]; attachmentItems: SerializedAttachment[]; systemEvents: { id; actorUserId; actionType; sourceWorkflow; createdAt; executionStatus }[]; canReadRawAudit: boolean; auditEvents: AuditEvent[] | null } and CrmActivity = { id; entityType; entityId; type: 'comment'|'task'|'file'; title: string|null; body: string|null; status: string|null; dueDate: string|null; assigneeUserId: string|null; authorUserId: string; fileUrl: string|null; fileSizeBytes: number|null; mimeType: string|null; createdAt: string; updatedAt: string } (mirrors serializeCrmActivity in crmActivityRoutes.ts:712).
Add hook useCrmActivity(entityType, entityId): useQuery({ queryKey:['crm-activity',entityType,entityId], queryFn: () => apiFetch<CrmActivityResponse>(`/api/workspace/crm/${entityType}/${entityId}/activity`) }). Call as useCrmActivity('project', id).
Add <ActivityFeed> component: render activities + systemEvents merged by createdAt into the 'Лента' CardPanel, reusing BemAvatar + .feed/.feed__item/.feed__head CSS from the block; map authorUserId→name via useWorkspaceUsers(). Wrap in StateGate with FeedSkeleton.
Add <CommentComposer projectId>: useMutation(() => apiFetch(`/api/workspace/crm/project/${id}/comments`, { method:'POST', json:{ body } })) with onSuccess invalidate ['crm-activity','project',id]; render Textarea + Send (primary). Reuse from DealDetailRuntime by extracting a shared <CrmActivityPanel entityType entityId> so deal-card (entityType 'opportunity', already supported) gets the same feed.
Wire Paperclip → file attach: add useMutation for multipart POST /api/workspace/attachments/files (FormData: file, entityType='project', entityId=id) and POST /api/workspace/attachments/external-references (json url); list via useQuery GET /api/workspace/attachments?entityType=project&entityId=${id}; render attachmentItems with download links (GET /api/workspace/attachments/{id}/download) and DELETE control. entityType 'project' already valid (attachmentValidation.ts:53).
Params aside: render read-only FactList today (Клиент/Статус/Период/Сумма contractValue/Plan hours). Keep 'Сохранить' hidden or disabled with title 'Изменение проекта появится после PATCH-эндпоинта' — no PATCH /api/workspace/projects/{id} exists. Do NOT ship a fake editable Select/DatePicker (honesty rule).
Add Knowledge cards (decisions + action-items + documents): hooks useProjectDecisions/useProjectActionItems/useProjectDocuments (GET …/knowledge/decisions|action-items|documents) + create/update mutations (POST/PATCH). Render as collapsible cards or as a new subroute app/projects/[id]/knowledge/page.tsx → RuntimeScreenView id='07c-project-knowledge'; add the RuntimeScreenId + runtimeScreenMeta breadcrumb entry and a nav/tab link from the project header.
Add Closure card: useProjectClosure (GET …/closure) + preview/close/lessons mutations behind a permission gate (reuse disabledReason pattern). Add Control card: useProjectControl (GET …/control/read-model) + evaluate mutation. Either inline on project detail or as subroutes app/projects/[id]/closure/page.tsx and app/projects/[id]/control/page.tsx mirroring the existing resources/ and timeline/ route files (each a thin client page rendering RuntimeScreenView with a new id).
Add a tabbed sub-nav in the project header (Карточка / Гант / Ресурсы / Знания / Контроль / Закрытие) linking the existing and new routes, so the newly-wired capabilities are reachable; update runtimeScreenMeta breadcrumbs for each new id.

---

## deals-list  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro: title 'Сделки' + lead + primary 'Сделка' create button (Plus icon) — decorative in Storybook
- view-toolbar: Segmented mode switch (Канбан / Список / Прогноз)
- view-toolbar: SearchPill placeholder 'Сделки, клиенты…' (free-text search over deals + clients)
- view-toolbar: secondary 'Фильтр' button (disabled demo, 'подключится к API')
- Kanban funnel: one column per stage with count Badge; deal cards show deal id (mono), owner avatar, title, client, stage Chip, amount
- List table: columns Сделка / Клиент / Стадия / Сумма (numeric) / Команда (BemAvatarStack of owners)
- Forecast mode: placeholder text only (no real number in Storybook)

**Текущая проводка:** DealsRuntime (apps/web/src/views/screens/runtime-screen-view.tsx:298) IS wired on real data: useOpportunities → GET /api/workspace/opportunities (line 1007), useDealStages → GET /api/workspace/deal-stages (line 1008), Segmented with all 3 modes, StateGate + TableSkeleton. DealsFunnel (L859) renders per-stage columns filtered by deal.stageId===stage.id with live counts; cards Link to /deals/{id}. DealsTable (L860) renders Сделка/Клиент/Стадия/Сумма + DealAdvanceButton (PATCH /api/workspace/opportunities/{id}/stage, forward-to-next-stage only, gated by PERMISSIONS.manageOpportunities). ForecastPanel (L895) computes a REAL probability-weighted total (exceeds Storybook). DealDetailRuntime (/deals/{id}, L318) wires GET /api/workspace/opportunities/{id}, feasibility (POST .../feasibility) and activate-project (POST .../activate, gated by manageProjectActivation). NOT wired: the 'Сделка' create button (DealsRuntime PageIntro has no actions prop), the SearchPill, the Фильтр button, finalize (won/lost), opportunity edit, deal-stage CRUD, and the CRM activity timeline. Two binding bugs in DealsFunnel: the card-head id span renders {stage.name} instead of a deal identifier, and BemAvatar is hardcoded initials='ИИ' color='c1' so owner is never bound. The Storybook list 'Команда' avatar column is dropped in prod (owner not surfaced).

**Gaps (фича → эндпоинты → данные/усилие):**
- [partial/S] Funnel card binding bug: card-head shows {stage.name} (redundant) instead of deal identifier, and owner avatar is hardcoded 'ИИ'/c1
    эндпоинты: GET /api/workspace/opportunities  ·  GET /api/workspace/users
- [partial/M] Owner binding on list/funnel ('Команда' column): FE `type Opportunity` lacks ownerUserId/ownerName though backend OpportunityRecord carries ownerUserId — needs surfacing + name resolution
    эндпоинты: GET /api/workspace/opportunities  ·  GET /api/workspace/users
- [endpoint-exists/L] Create deal flow (Storybook 'Сделка' button → real create dialog). Body needs clientId, primaryContactId, projectTypeId, stageId, title, clientName, contactName, contractValue, plannedHourlyRate, probability, plannedStart, plannedFinish, optional ownerUserId
    эндпоинты: POST /api/workspace/opportunities  ·  GET /api/workspace/clients  ·  GET /api/workspace/contacts  ·  GET /api/workspace/project-types  ·  GET /api/workspace/deal-stages  ·  GET /api/workspace/users
- [endpoint-exists/S] Search (SearchPill) — filter deals by title/client/contact
    эндпоинты: GET /api/workspace/search
- [no-endpoint/S] Фильтр button — filter funnel/table by stage / owner / probability (client-side over loaded list)
    эндпоинты: 
- [endpoint-exists/M] Finalize deal (mark won/lost with reason) — not wired anywhere
    эндпоинты: PATCH /api/workspace/opportunities/{id}/finalize
- [endpoint-exists/M] Edit opportunity (update title/value/probability/dates/stage) — not wired
    эндпоинты: PATCH /api/workspace/opportunities/{id}
- [endpoint-exists/M] CRM activity timeline on deal detail (comments + follow-up tasks) — entityType 'opportunity' is supported but unused by FE
    эндпоинты: GET /api/workspace/crm/opportunity/{id}/activity  ·  POST /api/workspace/crm/opportunity/{id}/comments  ·  POST /api/workspace/crm/opportunity/{id}/tasks  ·  PATCH /api/workspace/crm/opportunity/{id}/tasks/{activityId}
- [endpoint-exists/M] Deal-stage management (add/rename/reorder funnel columns) — CRUD endpoints exist but no UI
    эндпоинты: POST /api/workspace/deal-stages  ·  PATCH /api/workspace/deal-stages/{id}
- [endpoint-exists/M] Kanban drag-to-stage / backward stage moves (today only forward via DealAdvanceButton)
    эндпоинты: PATCH /api/workspace/opportunities/{id}/stage

**Build plan:**
1. Fix funnel binding bug in DealsFunnel (runtime-screen-view.tsx ~L859): replace `<span className='deal-card__id mono'>{stage.name}` with a real deal identifier (deal id short-code or deal.contactName), and replace the hardcoded `<BemAvatar initials='ИИ' color='c1'>` with an owner-derived avatar.
2. Surface owner: extend FE `type Opportunity` (L51) with `ownerUserId?: string | null` (already present in backend OpportunityRecord at packages/persistence/src/projectIntakeRepository.ts:37 — verify mapOpportunityRecord serializes it ~L652). Add `useWorkspaceUsers()` (already at L1030) lookup to map ownerUserId→initials/color; reuse for both DealsFunnel cards and a restored 'Команда' avatar column in DealsTable.
3. Add client-side search: lift `const [query,setQuery]=useState('')` in DealsRuntime (L298); render <SearchPill placeholder='Сделки, клиенты…' value/onChange> in a new view-toolbar filter group; compute `filtered = items.filter` on title/clientName/contactName and pass `filtered` to DealsFunnel/DealsTable/ForecastPanel. (Optionally back with apiFetch('/api/workspace/search?targetEntity=opportunity&q=…').)
4. Add Фильтр control: a Popover next to SearchPill with stage/owner/probability selects, applied client-side to the same `filtered` array.
5. Add create hooks beside useOpportunities (~L1007): `useClients()`→apiFetch<{clients:Client[]}>('/api/workspace/clients'), `useContacts()`→('/api/workspace/contacts'), `useProjectTypes()`→('/api/workspace/project-types'). Reuse existing useDealStages + useWorkspaceUsers.
6. Build `CreateDealDialog` component (model after the activate Dialog at L355 + CreateTaskPanel at L812): fields title, clientId(select clients), primaryContactId(select contacts), projectTypeId(select project-types), stageId(select deal-stages), clientName, contactName, contractValue, plannedHourlyRate, probability, plannedStart, plannedFinish, ownerUserId(select users); useMutation → apiFetch('/api/workspace/opportunities',{method:'POST',json:{…}}); onSuccess invalidate ['opportunities'] + toast. Gate via disabledReason(me, PERMISSIONS.manageOpportunities).
7. Wire CreateDealDialog into DealsRuntime PageIntro `actions` (L306) so the Storybook 'Сделка' button becomes functional; pass `me` into DealsRuntime (already available).
8. Finalize: in DealDetailRuntime (L318) add a 'Закрыть сделку' Dialog with won/lost radio + reason → apiFetch('/api/workspace/opportunities/${id}/finalize',{method:'PATCH',json:{status,reason}}); invalidate ['opportunity',id] + ['opportunities'].
9. Edit: in DealDetailRuntime add an edit form → apiFetch('/api/workspace/opportunities/${id}',{method:'PATCH',json:{…}}).
10. CRM timeline: add `DealActivityPanel({id})` in DealDetailRuntime — useQuery GET /api/workspace/crm/opportunity/${id}/activity; comment box → POST .../comments; follow-up → POST .../tasks; complete-toggle → PATCH .../tasks/${activityId}.
11. (Optional) Stage admin dialog: POST/PATCH /api/workspace/deal-stages, invalidate ['deal-stages']. (Optional) Kanban DnD via PATCH /stage with arbitrary stageId.
Routes/nav: NONE to create — apps/web/src/app/deals/page.tsx and deals/[id]/page.tsx already mount RuntimeScreenView ('05-deals'); 'Сделки' is already in nav. All new work is dialogs/panels inside the existing DealsRuntime/DealDetailRuntime.

---

## projects-list  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro: title "Проекты", lead with counts (14 активных / 3 на ревью / 2 финал), primary action button "Проект" (create, no handler)
- Toolbar (view-toolbar): Segmented filter active|archive|archive — Активные/Архив/Шаблоны (client state only)
- Toolbar: SearchPill placeholder "Код или название" (no handler)
- Toolbar: secondary "Фильтр" button (disabled, demo: "подключится к API")
- Filter-state hint paragraph for archive/templates tabs
- Projects table — columns: Название (CellStack name + code subtitle PRJ-2026-014, Folder icon), Клиент, Ответственный (Avatar initials + manager name), Статус (semantic Badge via STATUS_TONE), Срок (numeric date), Действия (row dropdown)
- STATUS_TONE semantic map: В работе→secondary, На ревью→info, Завершён→success, Просрочено→danger
- Archived rows rendered at opacity-60
- Row actions dropdown: Открыть, Дублировать, В архив, separator, Удалить (destructive)

**Текущая проводка:** Wired. Route apps/web/src/app/projects/page.tsx renders RuntimeScreenView id="07-projects-list" → ProjectsRuntime (runtime-screen-view.tsx:383). It calls useProjects() (line 1010) = apiFetch<{ projects: Project[] }>("/api/workspace/projects") which the backend hard-filters to status==="active" (projectIntakeRoutes.ts:261). PageIntro shows title + count lead only (NO create button/actions). StateGate → ProjectsTable (line 897) with 4 visible columns: Название (CellStack name + dateRange subtitle, NOT code), Клиент (clientName), Статус (always Badge variant="secondary" via businessStatus(project.status) — no semantic tone), Срок (formatDate plannedFinish). Row dropdown = Открыть проект / План-график / Ресурсы (NOT Дублировать/В архив/Удалить). MISSING vs Storybook: toolbar (Segmented/Search/Filter), Ответственный column, semantic status tones + overdue, code subtitle, create button, Архив/Шаблоны tabs.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/S] Toolbar Segmented "Активные" tab (active projects list)
    эндпоинты: GET /api/workspace/projects
- [endpoint-exists/S] Toolbar Segmented "Шаблоны" tab — list project templates
    эндпоинты: GET /api/workspace/config/project-templates
- [partial/M] Toolbar Segmented "Архив" tab — list archived/closed projects
    эндпоинты: GET /api/workspace/projects
- [endpoint-exists/S] SearchPill "Код или название" — filter projects by title/client
    эндпоинты: GET /api/workspace/projects  ·  GET /api/workspace/search
- [endpoint-exists/M] "Фильтр" button — facet filter by project type
    эндпоинты: GET /api/workspace/project-types
- [endpoint-exists/S] Semantic status badge tone + derived "Просрочено" (overdue from plannedFinish)
    эндпоинты: GET /api/workspace/projects
- [no-endpoint/M] "Ответственный" column (avatar + responsible/manager name)
    эндпоинты: GET /api/workspace/projects  ·  GET /api/workspace/users  ·  GET /api/workspace/projects/{projectId}/planning/read-model
- [no-endpoint/S] Code column subtitle (PRJ-2026-014)
    эндпоинты: 
- [partial/L] Create flow — primary "Проект" button (no direct manual create; only opportunity activation, with type/template selectors)
    эндпоинты: POST /api/workspace/opportunities/{opportunityId}/activate  ·  POST /api/workspace/opportunities  ·  GET /api/workspace/project-types  ·  GET /api/workspace/config/project-templates
- [partial/M] Row action "В архив" → close project (no true archive endpoint; closure is nearest)
    эндпоинты: POST /api/workspace/projects/{projectId}/closure/preview  ·  POST /api/workspace/projects/{projectId}/closure/close
- [no-endpoint/M] Row action "Дублировать" (duplicate project)
    эндпоинты: 
- [no-endpoint/S] Row action "Удалить" (delete project)
    эндпоинты: 
- [endpoint-exists/L] Шаблоны management — create/edit templates + retrospective insights (admin enrichment of templates tab)
    эндпоинты: POST /api/workspace/config/project-templates  ·  PATCH /api/workspace/config/project-templates/{templateId}  ·  GET /api/tenant/current/project-templates/{templateId}/retrospective-insights
- [endpoint-exists/M] Project-types management (config surface backing the type facet/create selector)
    эндпоинты: GET /api/workspace/project-types  ·  POST /api/workspace/project-types  ·  PATCH /api/workspace/project-types/{projectTypeId}

**Build plan:**
Add hooks in runtime-screen-view.tsx next to useProjects(): useProjectTypes() = apiFetch<{ projectTypes: ProjectType[] }>("/api/workspace/project-types"); useProjectTemplates() = apiFetch<{ projectTemplates: ProjectTemplateConfig[] }>("/api/workspace/config/project-templates"). Add local types ProjectType {id,tenantId,name,description,status} and ProjectTemplateConfig {id,tenantId,systemKey,tenantLabel,description,status} mirroring apiDocs/schemas (crmProjects.ts ProjectType, workspace.ts ProjectTemplateConfig).
Refactor ProjectsRuntime: add useState filter 'active'|'archive'|'templates'; render a view-toolbar with Segmented (options Активные/Архив/Шаблоны), SearchPill (controlled query state), and a Filter dropdown bound to useProjectTypes() (facet by projectTypeId). Move the count lead to derive from real projects array.
Enrich ProjectsTable: (a) add semantic STATUS_TONE map and a statusTone(project) helper that maps Project.status enum to Badge variant AND derives 'overdue' when plannedFinish < now → danger (replaces the always-secondary Badge at line 924); (b) add an "Ответственный" column — initial pass derives from clientName/owner or '—' placeholder until backend exposes responsibleUserId, optionally hydrate via useWorkspaceUsers() map; (c) apply client-side title/clientName filter from SearchPill query and projectType facet.
Wire row actions to real endpoints: keep Открыть/План-график/Ресурсы Links; add "В архив" as a useMutation → apiFetch(`/api/workspace/projects/${id}/closure/preview`, {method:'POST'}) then closure/close with confirm dialog + invalidate ['projects']; gate Дублировать/Удалить behind a disabled state with title "нет эндпоинта" (no backend support).
Implement Архив tab: since GET /api/workspace/projects hard-filters status==='active' server-side (projectIntakeRoutes.ts:261), add a backend query param (?status=archived|all) to projectIntakeRoutes list handler, then useProjects(status) keyed by status; until then render an explicit "архив недоступен (бэкенд фильтрует active)" empty state.
Implement Шаблоны tab: new TemplatesTable component rendering useProjectTemplates() (columns: tenantLabel, systemKey, description, status badge). Optional drill-in to GET /api/tenant/current/project-templates/{templateId}/retrospective-insights.
Wire create flow: add primary "Проект" button to PageIntro actions opening a CreateProjectDialog. Because there is NO POST /api/workspace/projects, the dialog routes to the opportunity path — either deep-link to /deals (create opportunity) or, when an opportunity is selected, call POST /api/workspace/opportunities/{id}/activate (reuse the activation mutation from DealRuntime). Populate type/template selectors from useProjectTypes()/useProjectTemplates().
No new route file or nav change needed (apps/web/src/app/projects/page.tsx + 'Проекты' nav already exist). If a dedicated templates/types admin surface is desired, add a sub-route under apps/web/src/app/admin/ rendering project-types/project-templates management (POST/PATCH project-types, POST/PATCH config/project-templates).
Backend follow-ups to unblock no-endpoint gaps: add status filter param to GET /api/workspace/projects (archive tab); add responsibleUserId to ProjectRecord + listProjects projection (Ответственный column); add a project code field or POST /api/workspace/projects (manual create) + duplicate/delete routes if those actions must be real.

---

## my-work  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro "Моя работа" with lead
- view-toolbar Segmented toggle: Канбан / Список
- List mode = static placeholder text only ("Список задач (демо переключения режима)")
- Kanban mode: KanbanBoard with 3 hardcoded columns — Бэклог (count 24), В работе (count 4), Готово (count 13)
- KanbanCard fields: id (e.g. MDS-39), title, PriorityFlag (urgent/low) + label, meta chips (название/срок)
- KanbanCard assignees = BemAvatarStack with FAKE initials+color (ИИ c1 / КБ c4 + МД c5)
- KanbanCard comments = MessageSquare + integer count (13, 7)
- KanbanCard date (DD.MM.YYYY) and highlight flag on the Sales deck card
- Готово column shows empty-state text

**Текущая проводка:** MyWorkRuntime (runtime-screen-view.tsx:215) is fully wired to real data and is AHEAD of the Storybook block on several axes. useMyWork() -> GET /api/workspace/my-work returns Task[] (read-model serialization of TaskRecord incl. participants[{userId,role}], statusId/Name/Category, priority, plannedStart/Finish, plannedWork, progress, description). useTaskStatuses() -> GET /api/workspace/task-statuses. Segmented Канбан/Список over a StateGate. List = TaskTable (real: Задача cell opening TaskDetailSheet, Срок, Статус Badge, Прогресс, per-row TaskAdvanceButton + TaskCommentForm). Kanban = TaskKanban: 4 columns grouped by statusCategory (new/in_progress/review/done), real title/priority/status/date. TaskAdvanceButton -> PATCH /api/workspace/projects/{projectId}/tasks/{taskId}/status (next status). TaskCommentForm -> POST /api/workspace/tasks/{taskId}/comments (+ optional blocker: PATCH status to a 'waiting' status). TaskDetailSheet is read-only and renders ONLY the list Task object (status, priority, срок, progress, plannedWork, participants.length, description) — it does NOT fetch task detail. KNOWN FAKES/GAPS in prod: (1) KanbanCard assignees are HARDCODED `[{initials:'ИИ',color:'c1'}]` (line 679) — fake avatar, ignores task.participants; (2) KanbanCard comments prop is OMITTED entirely (no count shown); (3) card id is synthetic `Задача N`, not a real task ref; (4) detail sheet never calls GET tasks/{id} or the activity timeline.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/S] Real assignee avatar on kanban card + detail sheet (replace hardcoded ИИ)
    эндпоинты: GET /api/workspace/my-work  ·  GET /api/workspace/users
- [partial/M] Real comment count badge on kanban cards (KanbanCard comments prop)
    эндпоинты: GET /api/workspace/tasks/{taskId}/activity
- [endpoint-exists/M] Task detail sheet wired to full detail (activity/comment timeline + attachments), currently shows only list fields
    эндпоинты: GET /api/workspace/tasks/{taskId}  ·  GET /api/workspace/tasks/{taskId}/activity  ·  GET /api/workspace/attachments/{attachmentId}/download
- [endpoint-exists/M] Edit task from detail sheet (description, priority, owner, participants, requiresAcceptance)
    эндпоинты: PATCH /api/workspace/tasks/{taskId}
- [endpoint-exists/S] Archive/delete task action from my-work
    эндпоинты: DELETE /api/workspace/tasks/{taskId}
- [endpoint-exists/L] Attach files / external references inside task detail
    эндпоинты: POST /api/workspace/attachments/files  ·  POST /api/workspace/attachments/external-references  ·  GET /api/workspace/attachments
- [endpoint-exists/S] Create a projectless/inbox task directly from my-work (no CreateTaskPanel here today)
    эндпоинты: POST /api/workspace/tasks
- [endpoint-exists/S] Real task reference id on card instead of synthetic 'Задача N'
    эндпоинты: GET /api/workspace/my-work
- [partial/S] Storybook block list mode is a placeholder; bring Storybook fixture to parity with prod TaskTable (Storybook-side only)
    эндпоинты: 

**Build plan:**
No new route/nav needed — my-work is already mounted (screen 02-my-work -> MyWorkRuntime, nav link /my-work). This is enrichment of an existing wired surface.
Assignee resolution: in MyWorkRuntime call existing useWorkspaceUsers() (line 1030, GET /api/workspace/users -> {users: RuntimeUser[]}); build Map<userId,RuntimeUser>. Add helper assigneeFor(task: Task) picking participants.find(p=>p.role==='executor') ?? participants[0], plus initialsFromName(name) and a stable color from userId hash.
In TaskKanban (line 675) replace hardcoded `assignees={[{initials:'ИИ',color:'c1'}]}` with the resolved assignee initials/color; pass users map down as a prop. Apply the same real avatar in TaskDetailSheet header (currently no avatar) for consistency.
Add hook useTaskActivity(taskId): useQuery(['task-activity',taskId], ()=>apiFetch<{activities: TaskActivity[]; attachmentItems: Attachment[]}>(`/api/workspace/tasks/${taskId}/activity`)). Type TaskActivity = {id;type:'comment'|'file'|'system';body:string|null;title:string|null;fileUrl:string|null;authorUserId:string;createdAt:string} (mirrors backend TaskActivityRecord).
Kanban comment count: render `comments={count}` on KanbanCard by deriving activities.filter(a=>a.type==='comment').length from a per-card useTaskActivity({enabled:visible}). Note N+1 caveat — recommend a follow-up backend enrich of GET /api/workspace/my-work to include commentCount to avoid per-card fetch (mark that backend item separately).
Add hook useTaskDetail(taskId): useQuery(['task-detail',taskId], ()=>apiFetch<{task: Task; activities: TaskActivity[]; attachmentItems: Attachment[]}>(`/api/workspace/tasks/${taskId}`), {enabled: sheetOpen}). Refactor TaskDetailSheet to lift open state, call useTaskDetail, and render: full description, an activity/comment timeline (author name via users map + createdAt), attachmentItems with <a href=`/api/workspace/attachments/${id}/download`>, and the existing TaskCommentForm moved inside the sheet body.
Make the sheet editable behind PERMISSIONS.editTasks: add an edit form -> useMutation PATCH /api/workspace/tasks/${task.id} with {description, priority, ownerUserId, requiresAcceptance, participants}; invalidate ['my-work'] and ['task-detail',id] onSuccess; reuse DisabledReason for permission gating.
Add archive action in the sheet/table row -> useMutation DELETE /api/workspace/tasks/${task.id} inside a confirm Dialog, gated by PERMISSIONS.editTasks; invalidate ['my-work'] onSuccess + toast.
Add an inbox CreateTaskPanel variant for my-work -> useMutation POST /api/workspace/tasks (projectless container) with title/priority/dates; surface in the view-toolbar next to the Segmented toggle, gated by PERMISSIONS.createTasks.
Optional polish: replace synthetic KanbanCard id `Задача N` with a real short ref derived from task.id.
Storybook parity (separate, Storybook-only): flesh out my-work-block.tsx list mode to a representative TaskTable-shaped fixture so the design block matches the now-richer prod surface.

---

## admin  [wired-surface]  effort=L
**Storybook composition:**
- PageIntro "Администрирование" (lead "Пользователи, роли и политики рабочей области.") with primary action button "Пригласить" (UserPlus)
- CardPanel "Пользователи" (subtitle "N активных", flush) — Table columns: Имя (BemAvatar + name + email via CellStack), Роль (Badge variant=info), Активен (Badge success "Активен" / secondary "Заблокирован"), and a per-row Действия column (IconButton MoreHorizontal menu)
- CardPanel "Политики безопасности" (subtitle "Рабочая область · <project>") with ghost action "Аудит" (ShieldCheck) — SwitchRowList with 4 toggles: "2FA обязательна" (defaultChecked), "Сессии — 8 часов" (defaultChecked), "SSO (SAML)", "Domain allowlist"

**Текущая проводка:** AdminRuntime (apps/web/src/views/screens/runtime-screen-view.tsx:593) renders one of three read-only sections chosen by entityId from the route (RuntimeScreenContent line 139: id \"09-admin\" → section users/roles/audit). users → UsersTable (line 971) over useWorkspaceUsers() = GET /api/workspace/users, columns Имя/Email/Должность/Статус only — NO role column, NO Активен toggle, NO per-row Действия menu, NO \"Пригласить\". roles → RolesPanel (line 1001) over useAccessProfiles() = GET /api/tenant/current/access-profiles, a read-only <ul> \"name · N прав\" (lead explicitly says \"изменение ролей отключено\"). audit → AuditPanel (line 966) over useAuditEvents(12) = GET /api/tenant/current/audit-events?limit=12. The Storybook \"Политики безопасности\" card is NOT rendered anywhere in prod. Routes exist: apps/web/src/app/admin/{page,users,roles,audit}/page.tsx all delegate to RuntimeScreenView id=\"09-admin\". Sidebar (views/config/sidebar-nav.ts:38) has a single \"Пользователи\" → /admin entry; no sub-nav for roles/audit/positions/security. access-roles, positions, org-structure, control-surfaces endpoints are not referenced anywhere in apps/web/src.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/M] "Пригласить" — invite/create a workspace user (dialog with name/email/position/role) ; prod has no invite button at all
    эндпоинты: POST /api/workspace/users
- [endpoint-exists/M] Per-row "Действия" menu — Edit user (name/email/position) via a sheet/dialog
    эндпоинты: PATCH /api/workspace/users/{userId}
- [endpoint-exists/S] "Активен" toggle — block/unblock a user (status active↔blocked) shown as success/secondary Badge in Storybook
    эндпоинты: PATCH /api/workspace/users/{userId}
- [endpoint-exists/S] Archive/delete user from the row actions menu
    эндпоинты: DELETE /api/workspace/users/{userId}
- [endpoint-exists/M] "Роль" column on the users table + assign-role control (Storybook shows a Role Badge per user; prod table omits it)
    эндпоинты: GET /api/workspace/access-roles  ·  PATCH /api/workspace/users/{userId}
- [endpoint-exists/L] Roles management — make the read-only RolesPanel editable: rename/edit role permissions, archive role, and create a new access profile
    эндпоинты: GET /api/workspace/access-roles  ·  PATCH /api/workspace/access-roles/{roleId}  ·  DELETE /api/workspace/access-roles/{roleId}  ·  POST /api/tenant/current/access-profiles
- [partial/L] "Политики безопасности" card — 2FA / session-timeout / SSO(SAML) / domain-allowlist toggles persisted as a tenant control surface (draft → publish, with rollback)
    эндпоинты: GET /api/tenant/current/control-surfaces  ·  GET /api/tenant/current/control-surfaces/presets  ·  POST /api/tenant/current/control-surfaces  ·  POST /api/tenant/current/control-surfaces/{surfaceId}/preview  ·  POST /api/tenant/current/control-surfaces/{surfaceId}/publish  ·  POST /api/tenant/current/control-surfaces/{surfaceId}/rollback
- [endpoint-exists/S] "Аудит" action on the policies card — link/scroll to the full audit log (prod already has AuditPanel but it is a separate route, not surfaced from policies)
    эндпоинты: GET /api/tenant/current/audit-events
- [endpoint-exists/M] Positions management — backend CRUD entirely unused by FE (user.positionName is only displayed, never managed)
    эндпоинты: GET /api/workspace/positions  ·  POST /api/workspace/positions  ·  PATCH /api/workspace/positions/{positionId}  ·  DELETE /api/workspace/positions/{positionId}
- [endpoint-exists/L] Org-structure view/edit — backend unused by FE; read tree + replace
    эндпоинты: GET /api/tenant/current/org-structure  ·  PUT /api/tenant/current/org-structure

**Build plan:**
Add admin permission keys to the PERMISSIONS const (runtime-screen-view.tsx:100) — e.g. manageUsers/manageRoles/manageWorkspace (confirm exact tenant.* strings from GET /api/auth/me permissions). Gate every new mutation button with disabledReason(me, PERMISSIONS.x) like TaskAdvanceButton (line 763).
Add read hooks next to useWorkspaceUsers (line 1030): useAccessRoles() → apiFetch<{accessRoles: AccessRole[]}>("/api/workspace/access-roles"); usePositions() → apiFetch<{positions: Position[]}>("/api/workspace/positions"); useControlSurfaces() → apiFetch("/api/tenant/current/control-surfaces"); useOrgStructure() → apiFetch("/api/tenant/current/org-structure"). Define matching types near RuntimeUser/AccessProfile/AuditEvent (lines 50/82/93).
Build InviteUserDialog: a Dialog/Sheet (reuse Sheet pattern from TaskDetailSheet line 689) with Field+Input for name/email + a Select bound to usePositions()/useAccessRoles(); on submit useMutation(() => apiFetch("/api/workspace/users",{method:"POST",json:{...}})) then queryClient.invalidateQueries(["workspace-users"]) + toast. Wire it into AdminRuntime's PageIntro actions slot for section==="users".
Extend UsersTable (line 971): add a "Роль" column (Badge from user role joined via useAccessRoles) and replace the static Статус badge with an active/blocked control; add a trailing actions cell using a DropdownMenu on an IconButton MoreHorizontal (mirror Storybook) with items Редактировать / Заблокировать|Разблокировать / Архивировать.
Add user mutations: useUpdateUser(userId) → PATCH /api/workspace/users/{userId} (json name/email/positionId/roleId/status); useArchiveUser(userId) → DELETE /api/workspace/users/{userId}. Block/unblock is a status PATCH. Each invalidates ["workspace-users"]; archive needs an AlertDialog confirm.
Upgrade RolesPanel (line 1001) into an editable RolesManager over useAccessRoles(): list roles with permission counts, an edit sheet that PATCHes /api/workspace/access-roles/{roleId}, an archive action DELETE /api/workspace/access-roles/{roleId}, and a "Создать роль" button POST /api/tenant/current/access-profiles. Update the section lead (line 598) to drop "изменение ролей отключено". Resolve the access-roles vs access-profiles duality (roles read from /workspace/access-roles, profiles from /tenant/current/access-profiles) — pick access-roles as the editable source.
Build SecurityPoliciesCard component (port admin-block.tsx lines 73-89 SwitchRowList): hydrate switch state from useControlSurfaces()/presets, and on toggle run the draft→publish flow (POST /control-surfaces to create draft, POST /{surfaceId}/preview to validate, POST /{surfaceId}/publish to apply, with a rollback action). Render it in AdminRuntime under the users/new "security" section. NOTE: control-surfaces is a generic config surface — confirm with backend that 2FA/session/SSO/allowlist map onto a control-surface schema; otherwise flag as no-endpoint for a dedicated security-policy resource.
Add new route files under apps/web/src/app/admin/: positions/page.tsx and security/page.tsx (and optionally org/page.tsx), each "use client" returning <RuntimeScreenView id="09-admin" entityId="positions|security|org"/>. Extend RuntimeScreenContent (line 139) and AdminRuntime's section union (line 593) to accept positions/security/org, and add cases in runtimeScreenMeta (line 1022) for breadcrumbs.
Build PositionsManager (table over usePositions with create POST /api/workspace/positions, edit PATCH /{positionId}, archive DELETE /{positionId}) and, if org is in scope, OrgStructureView (tree over GET /api/tenant/current/org-structure with a PUT replace save).
Update nav (apps/web/src/views/config/sidebar-nav.ts:35-41): expand the single "Пользователи"→/admin entry into an "Администрирование" group with sub-items Пользователи /admin/users, Роли /admin/roles, Должности /admin/positions, Безопасность /admin/security, Аудит /admin/audit (gate by permissions). Wire the Storybook "Аудит" card action to navigate to /admin/audit.
Verify against real data: run the web app on the dev stack, confirm GET /api/workspace/access-roles, /positions, /tenant/current/control-surfaces, /org-structure return shapes matching the new types (read from OpenAPI / GET /api/openapi.json), then exercise invite/edit/block/archive and a control-surface publish/rollback end-to-end.

---

## settings  [wired-surface]  effort=M
**Storybook composition:**
- PageIntro 'Настройки рабочей области' with a single 'Сохранить' primary button (not wired to any tab)
- Segmented tab switcher with 4 tabs: Профиль / Уведомления / Интеграции / Оплата (local useState only)
- Profile tab (FormSection 'Профиль'): Field Name (Input, default 'Камил Б.'), Field Email (Input type=email, default 'kamil@kiss.pm'), Field Locale (Select ru/en), Field Timezone (Select Europe/Moscow / UTC) — all uncontrolled defaultValue stubs
- Notifications tab (FormSection 'Уведомления'): SwitchRowList with 3 SwitchRows — 'Email — упоминания' (defaultChecked), 'Email — дайджест по понедельникам' (defaultChecked), 'Slack — control signals' (off)
- Integrations tab: demo placeholder text only, no controls
- Billing tab (Оплата): demo placeholder text only, no controls

**Текущая проводка:** Route apps/web/src/app/settings/page.tsx renders RuntimeScreenView id="10-settings" -> SettingsRuntime (apps/web/src/views/screens/runtime-screen-view.tsx:609). SettingsRuntime is READ-ONLY: it does one useQuery on apiFetch<AuthMe>("/api/auth/me") and renders PageIntro + a static EntityCards profile card (name, email, permission count) with a FactList ([Рабочая область, Текущая], [Права, N]). No tabs, no editable inputs, no Save button, no notification prefs, no theme/appearance. None of the writable settings endpoints are wired anywhere in web (grep for /api/profile, notification-preferences, accentColor in apps/web returns no callers).

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/M] Editable profile: name (+ backend-only phone & telegram fields the Storybook block never exposes)
    эндпоинты: PATCH /api/profile  ·  GET /api/auth/me
- [partial/S] Email field editable in Profile tab — NOT self-editable: PATCH /api/profile ignores email (only name/phone/telegram). Email change requires admin via PATCH /api/workspace/users/{userId}. Render email read-only.
    эндпоинты: PATCH /api/workspace/users/{userId}
- [no-endpoint/S] Locale (ru/en) and Timezone selects in Profile tab
    эндпоинты: 
- [endpoint-exists/M] Notification preferences matrix replacing the 3 demo switches (channel x notificationType + per-row digest). Note 'Slack' in the design must map to channel 'telegram' — backend channels are in_app/email/telegram only; 'control_signal' notificationType already exists.
    эндпоинты: GET /api/workspace/notification-preferences  ·  PUT /api/workspace/notification-preferences
- [endpoint-exists/M] Appearance/theme settings (backend capability absent from Storybook): theme light|dark + accentColor hex — should be wired as a new section/tab
    эндпоинты: PATCH /api/profile/theme  ·  GET /api/auth/me
- [no-endpoint/S] Integrations tab content
    эндпоинты: 
- [no-endpoint/S] Billing/Оплата tab content
    эндпоинты: 

**Build plan:**
Types: in runtime-screen-view.tsx extend RuntimeUser / add types: `type ProfileUser = { id; name; email?; phone?: string|null; telegram?: string|null; theme?: 'light'|'dark'; accentColor?: string }` and `type NotificationPreference = { channel: 'in_app'|'email'|'telegram'; notificationType: 'mention'|'assignment_changed'|'deadline_risk'|'control_signal'|'meeting_invite'|'meeting_action_item'; enabled: boolean; digestFrequency: 'none'|'hourly'|'daily' }` (mirrors apps/api/src/apiDocs/schemas/schemaPrimitives.ts + NotificationPreferenceInput).
Rewrite SettingsRuntime (runtime-screen-view.tsx:609) to mirror SettingsBlock shell: keep useQuery(['auth','me'], apiFetch<AuthMe>('/api/auth/me')), add a Segmented tab state ('profile'|'notifications'|'appearance') reusing @/components/ui/segmented, @/components/domain/form-layout (Field/FormGrid/FormSection), @/components/domain/switch-row, @/components/domain/card-panel; wrap each tab body in <StateGate>.
Profile tab component <ProfileSettingsForm me={me.data}>: controlled useState seeded from me.data.user for name/phone/telegram; render Field+Input for Имя (name), Телефон (phone), Telegram (telegram); render Email as read-only (disabled Input) with note 'меняется администратором'; drop or disable Locale/Timezone (no endpoint). useMutation(() => apiFetch('/api/profile', { method:'PATCH', json:{ name, phone, telegram } })), onSuccess invalidate ['auth','me'] + toast.success; bind to a per-tab Save button (replace the inert global PageIntro Save).
Notifications tab component <NotificationPrefsForm>: const prefs = useQuery(['notification-preferences'], () => apiFetch<{preferences: NotificationPreference[]}>('/api/workspace/notification-preferences')); render SwitchRowList rows per (notificationType x channel) with enabled toggle + a digestFrequency Select (none/hourly/daily) per row, seeded from prefs.data; useMutation(() => apiFetch('/api/workspace/notification-preferences', { method:'PUT', json:{ preferences } })) sending the full NotificationPreferenceInput[] array, onSuccess invalidate ['notification-preferences'] + toast. Map design's 'Slack — control signals' -> channel:'telegram', notificationType:'control_signal'.
Appearance tab component <AppearanceSettings> (new, surfaces PATCH /api/profile/theme): Segmented theme light|dark + accentColor picker (Input type=color or hex Select, validated /^#[0-9a-fA-F]{6}$/); useMutation(() => apiFetch('/api/profile/theme', { method:'PATCH', json:{ theme, accentColor } })), onSuccess invalidate ['auth','me'] + toast; optionally push theme into next-themes setTheme so the live shell updates.
Keep the existing permissions/workspace FactList from me.permissions as a read-only sidebar/footer in the Profile tab.
No new route or nav needed: apps/web/src/app/settings/page.tsx already mounts id='10-settings' and nav already links /settings — this is an enrichment of SettingsRuntime, not a new surface. Integrations/Billing tabs stay as labelled placeholders (no backend) or are omitted from the prod tab list until endpoints exist.

---

## entities (CRM reference data: Клиенты / Контакты / Продукты)  [new-surface]  effort=L
**Storybook composition:**
- PageIntro — per-kind title + lead (Клиенты, Контакты, Продукты)
- Header action: «Импорт» button (Upload icon)
- Header action: «Добавить» button (Plus icon)
- view-toolbar: SearchPill (placeholder «Поиск в «{title}»») + «Фильтр» button
- Table — clients columns: Клиент (name+code), Менеджер (avatar+name), Сегмент (Badge), Сделок (numeric), Сумма (numeric mono)
- Table — contacts columns: Контакт (name+code), Компания, Должность, Email, Активность («12 событий · сегодня»)
- Table — products columns: Продукт (name+sku), Категория (Badge), Цена (numeric mono), Активных сделок (numeric), Статус (Badge Активен/Черновик)
- Per-row actions: MoreHorizontal IconButton (ghost)

**Текущая проводка:** Not wired at all — no prod route exists. The block is Storybook-only: screen-view.tsx maps ids 08-entities-clients / 08-entities-contacts / 08-entities-products to <EntitiesBlock kind=...> with mock COPY (apps/web/src/views/blocks/entities-block.tsx). runtime-screen-view.tsx has NO entities branch (RuntimeScreenId union and RuntimeScreenContent switch lack any entity id; no useClients/useContacts/useProducts hook). sidebar-nav.ts (SIDEBAR_GROUPS) has no Клиенты/Контакты/Продукты links, so there is no nav entry and no app/ route directory. Backend CRUD is fully implemented (apps/api/src/crmRoutes.ts) but unused by web. The mock columns Менеджер, Сегмент, Сделок, Сумма (clients), Активность (contacts), Категория-as-named/Активных сделок (products) have NO backing fields on the real records.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/S] Clients list table from real ClientRecord {id,name,description,status}
    эндпоинты: GET /api/workspace/clients
- [endpoint-exists/S] Contacts list table from ContactRecord {id,clientId,name,email,phone,telegram,role,status}; column Компания needs join to clients by clientId
    эндпоинты: GET /api/workspace/contacts  ·  GET /api/workspace/clients
- [endpoint-exists/S] Products list table from ProductRecord {id,name,sku,type,unit,price,description,status}
    эндпоинты: GET /api/workspace/products
- [endpoint-exists/M] «Добавить» — create client/contact/product via dialog form (gated by tenant.*.manage)
    эндпоинты: POST /api/workspace/clients  ·  POST /api/workspace/contacts  ·  POST /api/workspace/products
- [endpoint-exists/M] Row actions: edit (PATCH) + archive (PATCH status='archived'; no DELETE route for these CRM entities)
    эндпоинты: PATCH /api/workspace/clients/{clientId}  ·  PATCH /api/workspace/contacts/{contactId}  ·  PATCH /api/workspace/products/{productId}
- [partial/M] Contacts «Активность» column — per-entity CRM activity feed; needs count/aggregation per contact
    эндпоинты: GET /api/workspace/crm/{entityType}/{entityId}/activity
- [partial/M] Clients «Сделок» + «Сумма» columns — count/sum of opportunities per client; Opportunity exposes clientName not clientId, needs name-join or backend aggregation
    эндпоинты: GET /api/workspace/opportunities
- [no-endpoint/M] Products «Активных сделок» column — no product→opportunity link endpoint exists
    эндпоинты: 
- [no-endpoint/M] Clients «Менеджер» + «Сегмент» columns — mock-only; no fields on ClientRecord, no endpoint
    эндпоинты: 
- [partial/M] Products «Категория» named taxonomy — model only has type service|goods; could map via custom-fields
    эндпоинты: GET /api/workspace/config/custom-fields
- [no-endpoint/S] «Импорт» bulk CSV/file import button — no bulk-import endpoint
    эндпоинты: 
- [partial/S] «Фильтр» button + SearchPill — no query params on list endpoints; client-side filter, or wire unified search
    эндпоинты: GET /api/workspace/search

**Build plan:**
1. Add runtime types in apps/web/src/views/screens/runtime-screen-view.tsx mirroring backend records: Client {id;name;description:string|null;status:'active'|'archived'}; Contact {id;clientId;name;email:string|null;phone:string|null;telegram:string|null;role:string|null;status}; Product {id;name;sku:string|null;type:'service'|'goods';unit:string;price:number;description:string|null;status}.
2. Add three react-query hooks next to useOpportunities/useProjects: useClients() -> apiFetch<{clients:Client[]}>('/api/workspace/clients'); useContacts() -> apiFetch<{contacts:Contact[]}>('/api/workspace/contacts'); useProducts() -> apiFetch<{products:Product[]}>('/api/workspace/products'). Envelopes are {clients}/{contacts}/{products} per crmRoutes.ts.
3. Extend PERMISSIONS const with manageClients:'tenant.clients.manage', manageContacts:'tenant.contacts.manage', manageProducts:'tenant.products.manage'; reuse disabledReason() to gate Добавить/edit/archive (read perms enforced server-side).
4. Build EntitiesRuntime({kind}) (clone DealsRuntime/ProjectsRuntime): PageIntro per kind, view-toolbar with SearchPill (local useState filter) + Фильтр (disabled with title until wired), Добавить opening a create Dialog, rows wrapped in <StateGate>. Build ClientsTable/ContactsTable/ProductsTable mirroring DealsTable/ProjectsTable (CellStack + Badge + money() for product price; contacts join clients map by clientId for Компания). Omit or disable columns lacking data (Менеджер/Сегмент/Сделок/Сумма/Активность/Активных сделок) per honesty discipline — no fake values.
5. Add create dialogs (CreateClientPanel/CreateContactPanel/CreateProductPanel) using Dialog + useMutation -> apiFetch POST, invalidate the matching query key on success; contact form needs a client <select> sourced from useClients.
6. Add row MoreHorizontal DropdownMenu (copy ProjectsTable pattern): Edit -> PATCH /api/workspace/{kind}/{id}; Archive -> same PATCH with {status:'archived'} (no DELETE route).
7. Extend RuntimeScreenId union with '08-entities-clients' | '08-entities-contacts' | '08-entities-products' (ids already in SCREEN_META/catalog.ts) and add RuntimeScreenContent branches returning <EntitiesRuntime kind=...>.
8. Add runtimeScreenMeta() branches: activeNav Клиенты/Контакты/Продукты, breadcrumb [{label:'Справочники'},{label:title,current:true}].
9. Create route files: apps/web/src/app/clients/page.tsx, apps/web/src/app/contacts/page.tsx, apps/web/src/app/products/page.tsx — each 'use client' default export returning <RuntimeScreenView id='08-entities-clients|contacts|products' /> (same shape as apps/web/src/app/deals/page.tsx).
10. Nav: in apps/web/src/views/config/sidebar-nav.ts add a SIDEBAR_GROUPS group { title:'Справочники', items:[{label:'Клиенты',href:'/clients'},{label:'Контакты',href:'/contacts'},{label:'Продукты',href:'/products'}] }. NAV_LINKS (command palette) is derived automatically.
11. Run codegraph sync + the verify:storybook-contract gate (it scans the nav tree) and lint after wiring; reconcile catalog meta if the gate cross-checks routes.

---

## comms-chat  [new-surface]  effort=L
**Storybook composition:**
- 3-pane ChatWidget shell (apps/web/src/widgets/chat/chat-widget.tsx): ChannelList rail + ConversationView + MessageComposer, rendered in 3 story variants (ChatChannelsBlock = channels+full thread, ChatThreadBlock = task-scoped conversation, ChatComposerBlock = empty conversation+composer), all with disabled + 'Превью — бэкенд не подключён' banner
- ChannelList rail (channel-list.tsx): channel search input ('Поиск канала…'), list of channels/DMs with Hash icon vs PresenceDot (online/away presence), unread count Badge, active/aria-current state, onSelect(channelId) callback
- ConversationView (conversation-view.tsx): header with title + subtitle ('Команда внедрения · 8 участников'), scrollable message list, empty state ('Пока нет сообщений. Начните обсуждение.'), MessageBubble per message
- MessageBubble (components/domain/message-bubble.tsx): avatar (initials+color) for others / 'Вы' for own, author name, time, message text, pinned indicator (Pin), edited indicator (Pencil), ReactionBar (emoji + count + reactedByMe) with onToggleReaction(messageId, emoji)
- MessageComposer (message-composer.tsx): message textarea, @-mention IconButton, sticker (Smile) IconButton, attach (Paperclip) IconButton, 'Отправить' Send button, onSend(text) callback
- View-model contract (widgets/chat/types.ts): ConversationView {title, subtitle?, messages: MessageView[]}; ChannelView {id,name,kind:'channel'|'dm',unread?,active?,presence?}; MessageView {id,authorName,authorInitials,authorColor,time,text,own?,pinned?,edited?,reactions?}

**Текущая проводка:** Not wired as a standalone surface. apps/web/src/views/config/sidebar-nav.ts 'Общение' group has { label: 'Чаты', soon: true } — disabled, rendered as «скоро» badge, NOT navigable (NAV_LINKS filters out soon items so it is absent from the command palette). No /chat route exists under apps/web/src/app/. apps/web/src/lib/featureFlags.ts lists 'chat' in UI_ONLY_PREVIEW_SURFACES, so ChatWidget shows the preview banner when disabled. IMPORTANT: the same pure chat widgets (ChatWidget/ConversationView/MessageComposer) are ALREADY wired live inside the in-call chat (apps/web/src/views/screens/call-runtime-view.tsx), and apps/web/src/lib/call/call-client.ts already wraps the conversation endpoints (resolveEntityConversationId → GET /api/workspace/conversations?entityType&entityId, persistCallMessage → POST /api/workspace/conversations/{id}/messages, listing via GET /api/workspace/conversations/{id}/messages). So the data layer + widget reuse pattern is proven; only the dedicated full-screen chat surface (route + container + channel rail wiring + nav) is missing.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/L] Chat route + auth-gated runtime container (the whole surface does not exist in prod)
    эндпоинты: GET /api/auth/me  ·  GET /api/workspace/communication-channels  ·  GET /api/workspace/communication-channels/{channelId}/conversation  ·  GET /api/workspace/conversations/{conversationId}/messages
- [endpoint-exists/M] Channel rail: list channels/DMs with active state + unread counts
    эндпоинты: GET /api/workspace/communication-channels  ·  POST /api/workspace/conversations/{conversationId}/read-state
- [endpoint-exists/M] Open a channel → resolve its conversation → stream messages with header (title/subtitle/participant count)
    эндпоинты: GET /api/workspace/communication-channels/{channelId}  ·  GET /api/workspace/communication-channels/{channelId}/conversation  ·  GET /api/workspace/conversations/{conversationId}/messages  ·  GET /api/auth/me
- [endpoint-exists/S] Send message (MessageComposer onSend)
    эндпоинты: POST /api/workspace/conversations/{conversationId}/messages
- [endpoint-exists/S] Reactions: toggle emoji on a message (ReactionBar)
    эндпоинты: POST /api/workspace/conversations/{conversationId}/messages/{messageId}/reactions  ·  DELETE /api/workspace/conversations/{conversationId}/messages/{messageId}/reactions/{reactionId}
- [endpoint-exists/S] Pin / unpin message (MessageBubble pinned indicator is read-only in Storybook)
    эндпоинты: POST /api/workspace/conversations/{conversationId}/messages/{messageId}/pin
- [endpoint-exists/S] Edit / delete message (edited indicator is read-only in Storybook)
    эндпоинты: PATCH /api/workspace/conversations/{conversationId}/messages/{messageId}  ·  DELETE /api/workspace/conversations/{conversationId}/messages/{messageId}
- [endpoint-exists/M] Sticker picker (composer Smile button is decorative today)
    эндпоинты: GET /api/workspace/sticker-packs  ·  GET /api/workspace/sticker-packs/{packId}/stickers  ·  GET /api/workspace/stickers/{stickerId}/download  ·  POST /api/workspace/conversations/{conversationId}/messages
- [endpoint-exists/M] Attachments (composer Paperclip button is decorative today)
    эндпоинты: POST /api/workspace/attachments/files  ·  POST /api/workspace/attachments/external-references  ·  GET /api/workspace/attachments
- [partial/S] @-mentions picker (composer AtSign button is decorative today)
    эндпоинты: GET /api/workspace/users
- [endpoint-exists/M] Channel / message search (rail search input is inert)
    эндпоинты: GET /api/workspace/search
- [endpoint-exists/M] Channel management: create channel + add/remove members
    эндпоинты: POST /api/workspace/communication-channels  ·  PATCH /api/workspace/communication-channels/{channelId}  ·  POST /api/workspace/communication-channels/{channelId}/members  ·  DELETE /api/workspace/communication-channels/{channelId}/members/{userId}  ·  GET /api/workspace/users
- [endpoint-exists/S] Unread badge + read-state sync (mark conversation read on open)
    эндпоинты: POST /api/workspace/conversations/{conversationId}/read-state  ·  GET /api/workspace/conversations
- [partial/M] DM presence dots (online/away in channel rail)
    эндпоинты: GET /api/workspace/occupancy  ·  GET /api/workspace/users
- [no-endpoint/M] Realtime message updates (Storybook is static; live needs push or poll)
    эндпоинты: GET /api/workspace/conversations/{conversationId}/messages
- [endpoint-exists/S] Enable nav entry + remove preview banner flag
    эндпоинты: 

**Build plan:**
1. Create apps/web/src/lib/chat/chat-client.ts mirroring apps/web/src/lib/call/call-client.ts (uses apiFetch from @/lib/api). Functions + server DTOs: listChannels() → GET /api/workspace/communication-channels (ChannelDto{id,name,kind,memberCount,unreadCount?,lastReadAt?}); readChannel(channelId) → GET /api/workspace/communication-channels/{channelId}; resolveChannelConversation(channelId) → GET /api/workspace/communication-channels/{channelId}/conversation (ConversationDto{id,title?,participantCount?}); listMessages(conversationId) → GET /api/workspace/conversations/{conversationId}/messages (MessageDto{id,authorId,authorName,body,createdAt,editedAt?,pinned?,reactions:{id,emoji,count,reactedByMe}[]}); sendMessage(conversationId,body) → POST .../messages; editMessage/deleteMessage → PATCH/DELETE .../messages/{id}; pinMessage → POST .../messages/{id}/pin; addReaction/deleteReaction → POST/DELETE .../reactions[/{id}]; updateReadState(conversationId) → POST .../read-state; listStickerPacks/listStickers → GET /sticker-packs, /sticker-packs/{packId}/stickers.
2. Create apps/web/src/lib/chat/chat-view-model.ts with mappers to the existing widget contracts (widgets/chat/types.ts): toChannelListView(ChannelDto[]) → ChannelListView (map kind, unread, presence, active=selectedId); toConversationView(ConversationDto, MessageDto[], meId) → ConversationView; toMessageView(MessageDto, meId) → MessageView (own = authorId===meId, authorInitials from name, authorColor hashed to BemAvatarColor c1..c5, time = HH:mm from createdAt, edited = Boolean(editedAt), reactions mapped to ReactionView).
3. Create apps/web/src/views/screens/chat-runtime-view.tsx (copy the auth/me + WorkspaceChrome + StateGate pattern from runtime-screen-view.tsx). Hooks via @tanstack/react-query + apiFetch: useChannels() queryKey ['chat','channels']; useChannelConversation(channelId) queryKey ['chat','conversation',channelId]; useMessages(conversationId) queryKey ['chat','messages',conversationId]. Mutations: sendMessage / toggleReaction / pinMessage — each invalidates ['chat','messages',conversationId]; mark read on channel open via updateReadState then invalidate ['chat','channels']. Gate with me=useQuery(['auth','me']) → AppPreloader / RuntimeLogin like runtime-screen-view.
4. ChatRuntimeView owns selectedChannelId useState (default first channel), derives conversationId from useChannelConversation, renders WorkspaceChrome meta {breadcrumb:[{label:'Чаты',current:true}], activeNav:'Чаты'} wrapping <ChatWidget channels={toChannelListView(...)} conversation={toConversationView(...)} onSelectChannel={setSelectedChannelId} onSend={sendMutation.mutate} onToggleReaction={toggleMutation.mutate} /> — NO disabled prop, so the preview banner is suppressed for the live surface.
5. Extend the widgets to expose the actions the Storybook twin only shows decoratively (additive optional props so the disabled Storybook variants keep compiling): MessageComposer (message-composer.tsx) gains onSticker/onAttach handlers + a sticker popover (listStickerPacks/listStickers) and a hidden file input wired to POST /api/workspace/attachments/files; MessageBubble/ConversationView gain optional onPin(messageId)/onEdit/onDelete; ChannelList search input wired to GET /api/workspace/search (debounced) or local filter.
6. Create route file apps/web/src/app/chat/page.tsx: 'use client'; export default ChatPage() => <ChatRuntimeView />. Add apps/web/src/app/chat/[channelId]/page.tsx (use(params) → <ChatRuntimeView initialChannelId={channelId} />) for deep-linkable channels, mirroring app/projects/[id] structure.
7. Enable nav in apps/web/src/views/config/sidebar-nav.ts: change { label: 'Чаты', soon: true } → { label: 'Чаты', href: '/chat' } (NAV_LINKS then auto-includes it for the command palette via the existing flatMap filter).
8. Update apps/web/src/lib/featureFlags.ts: remove 'chat' from UI_ONLY_PREVIEW_SURFACES so the live surface never shows 'Превью — бэкенд не подключён' (the Storybook twins pass disabled and can keep a story-local banner if still desired).
9. Add a channel-management dialog (create channel + add/remove member) using POST/PATCH /communication-channels and /members, with the member picker fed by GET /api/workspace/users — model the Dialog/Sheet usage on runtime-screen-view.tsx CreateTaskPanel.
10. (Deferred/optional) realtime: no chat SSE endpoint exists (only GET /planning/events), so poll useMessages with refetchInterval on the active conversation, or add a backend stream later; keep this isolated behind the chat-client so the UI is unchanged when push lands.

---

## comms-meetings-notifications  [new-surface]  effort=L
**Storybook composition:**
- NotificationsBlock (catalog comms-notifications, story '23 Уведомления'): feed of comms-row items — Icon (AtSign/Video/CalendarClock/CheckCircle2), title, meta (source · relative time), kind Chip (Упоминание/Звонок/Встреча/Задача) tones violet/info/warning/success, unread highlight via comms-row--unread
- MeetingsListBlock (catalog comms-meetings, story '24 Встречи'): meeting rows — Video icon, title, when (date · time), BemAvatarStack of participants (+N), status Chip (Запланирована=info / Завершена=success), disabled 'Открыть' button (DEMO_TITLE: media off)
- MeetingDetailBlock (catalog comms-meeting-detail): 4 CardPanels — Повестка (agenda <li> list), Заметки (notes feed: BemAvatar + author + time + body), Задачи встречи (action items 'title — owner'), Ссылки (external links list)

**Текущая проводка:** not wired at all — no Next route under apps/web/src/app/. apps/web/src/views/config/sidebar-nav.ts group 'Общение' has { label: 'Встречи', soon: true } and { label: 'Уведомления', soon: true } (disabled, no href). apps/web/src/lib/featureFlags.ts UI_ONLY_PREVIEW_SURFACES includes 'meetings' and 'notifications'. Blocks render only in Storybook via catalog ids comms-notifications/comms-meetings/comms-meeting-detail. No apiFetch hook, no runtime component, no prod nav link.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/M] Notifications feed (list, unread state, kind/tone chips, relative time, source meta) — NotificationsBlock; type UserNotification {id,userId,notificationType: mention|assignment_changed|deadline_risk|control_signal|meeting_invite|meeting_action_item, sourceEntityType,sourceEntityId,title,body,route,createdAt,readAt,archivedAt}
    эндпоинты: GET /api/workspace/notifications?status=unread|read&limit=50
- [endpoint-exists/S] Mark notification read + click-through (route field = in-app nav target; unread = readAt===null)
    эндпоинты: POST /api/workspace/notifications/{notificationId}/read
- [endpoint-exists/M] Notification preferences settings (channel in_app|email|telegram, notificationType, enabled, digestFrequency none|hourly|daily) — backend capability NOT in Storybook block; surface as /settings sub-tab
    эндпоинты: GET /api/workspace/notification-preferences  ·  PUT /api/workspace/notification-preferences
- [partial/L] Meetings list standalone page (MeetingsListBlock). Meeting {id,entityType,entityId,title,agenda,scheduledStart,scheduledFinish,status: scheduled|completed|cancelled,...}. BLOCKER: GET /api/workspace/meetings is entity-scoped (requires entityType+entityId of project|task|opportunity|communication_channel) — no global 'all meetings' endpoint. FE must add a project selector or fan-out: GET /api/workspace/projects then loop GET meetings per project.
    эндпоинты: GET /api/workspace/meetings?entityType=project&entityId={projectId}  ·  GET /api/workspace/projects
- [endpoint-exists/M] Create meeting (title, agenda, scheduledStart/Finish, participants[] role organizer|required|optional, entityType+entityId scope)
    эндпоинты: POST /api/workspace/meetings
- [endpoint-exists/S] Meeting status transition (scheduled→completed/cancelled) and edit title/agenda/times — backend PATCH not represented by SB chip
    эндпоинты: PATCH /api/workspace/meetings/{meetingId}
- [partial/S] Meeting detail — Повестка (agenda). Agenda is a field on Meeting; readable only from the entity-scoped list payload (no GET single meeting).
    эндпоинты: GET /api/workspace/meetings?entityType=..&entityId=.. (agenda field)
- [no-endpoint/M] Meeting detail — Заметки (notes feed). MeetingNote {authorUserId,body,createdAt,editedAt}. Create works but there is NO GET to list notes back; reload loses them.
    эндпоинты: POST /api/workspace/meetings/{meetingId}/notes
- [no-endpoint/M] Meeting detail — Задачи встречи (action items). MeetingActionItem {title,ownerUserId,dueDate,targetEntityType,targetEntityId,status: open|done|cancelled}. Create-only; NO GET list endpoint.
    эндпоинты: POST /api/workspace/meetings/{meetingId}/action-items
- [no-endpoint/S] Meeting detail — Ссылки (external links). MeetingExternalLink {provider manual|google_meet|microsoft_teams|zoom|other,url,title}. Create-only; NO GET list endpoint.
    эндпоинты: POST /api/workspace/meetings/{meetingId}/external-links

**Build plan:**
1. Flip nav: in apps/web/src/views/config/sidebar-nav.ts change { label: 'Уведомления', soon: true } → { label: 'Уведомления', href: '/notifications' } and { label: 'Встречи', soon: true } → { label: 'Встречи', href: '/meetings' }. They auto-join NAV_LINKS (command palette) since they are no longer soon.
2. Remove 'meetings' and 'notifications' from UI_ONLY_PREVIEW_SURFACES in apps/web/src/lib/featureFlags.ts so the preview banner stops firing for the now-real surfaces.
3. Extend runtime registry in apps/web/src/views/screens/runtime-screen-view.tsx: add '14-notifications' and '15-meetings' to the RuntimeScreenId union; add branches in RuntimeScreenContent (return <NotificationsRuntime me={me}/> and <MeetingsRuntime me={me}/>); add runtimeScreenMeta entries (activeNav 'Уведомления' / 'Встречи', breadcrumb [{label, current:true}]).
4. Add route files: apps/web/src/app/notifications/page.tsx → 'use client'; export default () => <RuntimeScreenView id="14-notifications"/>; and apps/web/src/app/meetings/page.tsx → <RuntimeScreenView id="15-meetings"/>. Mirror apps/web/src/app/my-work/page.tsx exactly.
5. Notifications hooks (in runtime-screen-view.tsx, same style as useMyWork): function useNotifications(status?: 'unread'|'read') { useQuery(['notifications',status], () => apiFetch<{notifications: UserNotification[]}>(`/api/workspace/notifications?limit=50${status?`&status=${status}`:''}`)); }. Mark-read mutation: useMutation(() => apiFetch(`/api/workspace/notifications/${id}/read`, { method: 'POST' })) → invalidate ['notifications']; row onClick router.push(notification.route).
6. NotificationsRuntime component: PageIntro + Segmented filter (Все/Непрочитанные → status undefined|'unread') + StateGate, reuse comms-list/comms-row markup from comms-collab-blocks.tsx; map notificationType→{Icon,tone,kind label} (mention=AtSign/violet/Упоминание, meeting_invite=Video/info/Звонок, deadline_risk=CalendarClock/warning, assignment_changed|meeting_action_item=CheckCircle2/success); unread = readAt===null → comms-row--unread; trailing 'Прочитать' Button (mark-read mutation).
7. Meetings hooks: function useProjects() already exists. Add useProjectMeetings(projectId) = useQuery(['meetings',projectId], () => apiFetch<{meetings: Meeting[]}>(`/api/workspace/meetings?entityType=project&entityId=${projectId}`), { enabled: Boolean(projectId) }). MeetingsRuntime: a project Segmented/selector (from useProjects) drives the entity-scoped list (documents the no-global-list constraint honestly). Create-meeting Dialog → useMutation(() => apiFetch<{meeting,participants}>(`/api/workspace/meetings`, { method:'POST', json:{ entityType:'project', entityId, title, scheduledStart, scheduledFinish, agenda } })) gated by disabledReason(me, permission); invalidate ['meetings',projectId].
8. MeetingsRuntime render: reuse MeetingsListBlock layout via comms-list/comms-row — title, when=dateRange(scheduledStart,scheduledFinish), status Chip via meetingStatus→tone (scheduled=info, completed=success, cancelled=secondary). Replace disabled 'Открыть' with a status-transition Button → PATCH /api/workspace/meetings/{id} { status } (gated).
9. Meeting detail (deferred / create-only until read endpoints land): optionally apps/web/src/app/meetings/[id]/page.tsx + '16-meeting-detail' runtime. Agenda renders from the list payload's Meeting.agenda. Notes/action-items/external-links can be CREATED (POST) with optimistic UI + toast, but mark in-code (ponytail comment) that they cannot be listed back — needs new GET /api/workspace/meetings/{id}/notes|action-items|external-links + GET single meeting before the detail surface is real. Do NOT fake-render a static feed.
10. Verify: storybook-contract gate still green (no EN_DEV words in new titles), pnpm --filter web typecheck, and that NAV_LINKS now contains /meetings + /notifications for the command palette.

---

## calls  [wired-surface]  effort=L
**Storybook composition:**
- CallActiveBlock — participant grid (CallStage) + control bar: mic / camera / screen-share / background / leave (all disabled in SB)
- CallReconnectingBlock — same stage with phase="reconnecting" overlay label
- CallLobbyBlock — pre-join: self preview tile (avatar) + Камера/Микрофон Select + Микрофон/Камера toggles + Присоединиться
- CallScreenShareBlock — dedicated SPOTLIGHT layout: large focused shared screen (call-share__stage) + horizontal participant strip (call-share__strip)
- CallInChatBlock — call stage + side chat panel (ConversationView titled 'Чат звонка')
- CallDeviceSettingsBlock — Камера / Микрофон / ДИНАМИКИ (speaker) selects + virtual-background THUMBNAIL picker (Без фона / Размытие / Офис)

**Текущая проводка:** A FULL LiveKit runtime ALREADY EXISTS and is wired to real backend + real media — the task's "NEW surface / not wired" note is stale. Route: apps/web/src/app/calls/[roomId]/page.tsx (next/dynamic ssr:false) → views/screens/call-runtime-view.tsx. It wires: access check via GET /call-rooms/{roomId} (fetchCallRoomEntity, fail-closed); lobby device enumeration + live camera preview (lib/call/use-lobby-preview.ts, livekit createLocalVideoTrack); session join-or-start (POST .../sessions/start + GET active session); POST .../sessions/{sessionId}/join-token (LiveKit JWT); POST .../sessions/{sessionId}/turn-credentials (TURN ICE); POST .../sessions/{sessionId}/participant-state (joined/left presence); in-call chat over LiveKit DataChannel WITH durable persistence (resolve conversation via GET /conversations?entityType&entityId → POST /conversations/{id}/messages); mic/camera/SCREEN-SHARE toggles; virtual-background blur/image CYCLE (lib/call/call-background.ts, self-hosted MediaPipe). The engine (lib/call/call-engine.ts) is the only livekit-client importer; widgets/call/* and views/blocks/call-screen-blocks.tsx stay SDK-free off the shared lib/call/types.ts view-model. PROBLEM: the route is fully ORPHANED — sidebar 'Звонки' is soon:true (views/config/sidebar-nav.ts), grep finds ZERO links to /calls/ anywhere, no calls list, no create/launch affordance, and these backend capabilities are NEVER called: GET /call-rooms (list), POST /call-rooms (create), GET /call-rooms/{roomId}/events, POST .../sessions/{sessionId}/end, and ALL three recordings endpoints.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/S] Entry point: enable 'Звонки' nav + reach the runtime (today the runtime is unreachable — soon:true, no link)
    эндпоинты: GET /api/workspace/call-rooms
- [endpoint-exists/M] Calls index/list surface (rooms with active-session badge, entity context, deep-link into /calls/{roomId})
    эндпоинты: GET /api/workspace/call-rooms  ·  GET /api/workspace/call-rooms/{roomId}
- [endpoint-exists/M] Create / launch a call (no UI calls POST today) — 'Начать звонок' from a project/deal/conversation/channel context + redirect into the room
    эндпоинты: POST /api/workspace/call-rooms
- [endpoint-exists/L] Recordings: start/stop + register + recordings list (no record button, no recordings UI at all)
    эндпоинты: POST /api/workspace/call-rooms/{roomId}/sessions/{sessionId}/recordings/start  ·  POST /api/workspace/call-rooms/{roomId}/recordings/groups/{groupId}/stop  ·  POST /api/workspace/call-rooms/{roomId}/recordings
- [endpoint-exists/M] Call events / history timeline (joined/left/recording events per room — no surface)
    эндпоинты: GET /api/workspace/call-rooms/{roomId}/events
- [endpoint-exists/S] End session (host 'Завершить для всех') — onLeave only posts participant-state 'left' + disconnects; the session is never ended server-side
    эндпоинты: POST /api/workspace/call-rooms/{roomId}/sessions/{sessionId}/end
- [no-endpoint/M] Speaker / audio-output selection (Storybook 'Динамики') — engine attaches remote audio to hidden <audio> but never lets the user pick the output device (setSinkId)
    эндпоинты: 
- [no-endpoint/M] Screen-share SPOTLIGHT layout (Storybook CallScreenShareBlock) — prod renders a shared screen as a normal grid tile, no focused stage + strip
    эндпоинты: 
- [no-endpoint/M] In-call device-settings panel + background THUMBNAIL picker (Storybook CallDeviceSettingsBlock) — prod has only a single background CYCLE button and no in-call camera/mic re-selection
    эндпоинты: 

**Build plan:**
STEP 1 (nav, S): in apps/web/src/views/config/sidebar-nav.ts change the 'Общение' item { label: 'Звонки', soon: true } → { label: 'Звонки', href: '/calls' }; it auto-joins NAV_LINKS + command palette.
STEP 2 (client, S): extend apps/web/src/lib/call/call-client.ts with typed apiFetch wrappers reusing the existing pattern (apiFetch<T>(path, { method, json })): listCallRooms() → GET /api/workspace/call-rooms returning { callRooms: CallRoomSummary[] } (CallRoomSummary = { id; entityType; entityId; title?; activeSession: CallSessionRef | null }); createCallRoom(input) → POST /api/workspace/call-rooms; listCallEvents(roomId) → GET /api/workspace/call-rooms/{roomId}/events; endCallSession(roomId, sessionId) → POST .../sessions/{sessionId}/end; startRecording(roomId, sessionId) / stopRecordingGroup(roomId, groupId) / registerRecording(roomId, body) for the three recordings endpoints. Confirm exact response shapes against the OpenAPI (apps/api openapi) before locking field names.
STEP 3 (index route, M): create apps/web/src/app/calls/page.tsx ("use client") rendering a new views/screens/calls-list-view.tsx that follows the runtime-screen-view.tsx pattern — WorkspaceChrome + PageIntro + CardPanel/Table, useQuery(['call-rooms'], listCallRooms), AppPreloader/TableSkeleton + ErrorState; each row deep-links to /calls/{roomId}; show an 'идёт звонок' Badge when activeSession != null.
STEP 4 (launch, M): add a 'Начать звонок' Button (Dialog from components/ui/dialog) on the calls list AND a contextual launcher from project/deal/conversation surfaces; on submit useMutation(createCallRoom) then router.push(`/calls/${room.id}`). Reuse the existing toast (sonner) + useQueryClient invalidate(['call-rooms']).
STEP 5 (end session, S): in apps/web/src/lib/call/call-engine.ts handlers.onLeave, after postParticipantState(...,'left'), call endCallSession(roomId, sessionId) when the local participant is the host/last (gate on a canEnd flag from GET /call-rooms/{roomId}); add an 'Завершить для всех' affordance distinct from the existing per-user leave in widgets/call/call-stage.tsx.
STEP 6 (recordings, L): add a record toggle to call-stage.tsx controls (new optional handler in CallControlHandlers in lib/call/types.ts, keep widget SDK-free); wire in call-engine.ts to startRecording/stopRecordingGroup (track groupId from the start response); surface recordings + their state on the call-events/recordings panel. Note backend egress completion arrives via POST /integrations/livekit/webhook (server-side) — FE must poll GET /call-rooms/{roomId}/events or refetch for final recording status.
STEP 7 (events/history, M): add a 'История звонка' panel/tab in calls-list-view (or the room view) using useQuery(listCallEvents(roomId)) → GET /api/workspace/call-rooms/{roomId}/events, rendered with CellStack/timeline; join/left/recording events.
STEP 8 (speaker select, M): extend lib/call/use-lobby-preview.ts + call-engine.ts to enumerate audiooutput (Room.getLocalDevices('audiooutput')) and apply via HTMLMediaElement.setSinkId on the engine-owned hidden <audio> elements (audioElementsRef); add the 'Динамики' Select to widgets/call/call-lobby.tsx (LobbySelection gets audioOutputDeviceId) so the lobby matches CallDeviceSettingsBlock.
STEP 9 (screen-share spotlight, M): give widgets/call/call-stage.tsx a focused layout when any participant.sharingScreen — render the shared track large (call-share__stage) with the rest as a strip (call-share__strip), matching CallScreenShareBlock; pure view-model change off CallStageView (tileFor already exposes the screen track), no SDK/endpoint work.
STEP 10 (device-settings panel, M): build an in-call settings panel (Sheet from components/ui/sheet) mirroring CallDeviceSettingsBlock — camera/mic/speaker re-selection (reuse the device hook) + a background THUMBNAIL picker that calls backgroundRef.setMode('none'|'blur'|'image') directly instead of the single cycle button; replace the cycle 'Фон' control with the picker.

---

## project-planning-tabs  [new-surface]  effort=XL
**Storybook composition:**
- project-baseline-block: PageIntro 'Базовый план' (actions 'Создать снимок' / 'Сравнить') + CardPanel 'Базовый план v2 · дата' with plan-vs-actual Table (Задача, План, Факт, Δ days, Статus badge В графике/Опережение/Отклонение)
- project-scenarios-block: PageIntro 'Сценарии' (action 'Принять сценарий') + CardPanel 'Сравнение' with what-if Table (Сценарий, Срок, Бюджет, Риск badge, SPI, recommended row 'Рекомендуем' vs 'Принять' button)
- project-kpi-block: PageIntro 'KPI' (action 'Открыть управленческую поверхность') + bento of 4 KPI tiles (SPI, CPI, Загрузка, Просрочено with deltas) + CardPanel 'Сигналы контроля' signal-list (warning/danger/info icon, title, body, Action/Review chip)
- project-calendars-block: PageIntro 'Календари' (actions 'Шаблоны' / 'Сохранить') + grid-2: CardPanel 'Рабочая неделя' (template select ru-5x8/ru-4x10/custom + 7 weekday SwitchRows with hours) and CardPanel 'Исключения' (add date+kind form + exception-list with date/reason/kind chip/remove ×)
- project-audit-block: PageIntro 'Аудит' + view-toolbar (SearchPill 'Поиск по аудиту' + Filter button) + CardPanel 'Журнал событий' audit-list (avatar, actor name, action chip, body, mono timestamp)

**Текущая проводка:** Not wired at all as sub-tabs. Prod project routes that exist: apps/web/src/app/projects/[id]/page.tsx (07b-project-detail), .../timeline/page.tsx (12-project-gantt), .../resources/page.tsx (13-project-resources) — all render RuntimeScreenView. ProjectDetailRuntime exposes only two link-buttons (Гант, Ресурсы); there is NO project sub-tab strip, and NO baseline/scenarios/kpi/calendars/audit routes, runtimes, or hooks. The only planning data wired today is usePlanning(id) → GET /planning/read-model and capacity. Control (read-model/evaluate/signals), KPI definitions, planning/baselines, scenario-proposals, production-calendar, knowledge, closure, saved-views, auto-solver are 100% unconsumed by the web app. The 5 Storybook blocks are pure mock arrays (ROWS/SCENARIOS/KPI/SIGNALS/WEEKDAYS/EXCEPTIONS/ENTRIES) with no apiFetch.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/M] Project sub-tab navigation shell (tab strip + 5 new routes + screen meta/breadcrumbs) so baseline/scenarios/kpi/calendars/audit are reachable in the project context
    эндпоинты: GET /api/workspace/projects/{projectId}/planning/read-model
- [partial/M] Baseline list + plan-vs-baseline comparison table (Задача/План/Факт/Δ/Статус)
    эндпоинты: GET /api/workspace/projects/{projectId}/planning/baselines  ·  GET /api/workspace/projects/{projectId}/planning/read-model
- [endpoint-exists/S] Create baseline snapshot ('Создать снимок')
    эндпоинты: POST /api/workspace/projects/{projectId}/planning/apply-command
- [partial/M] Scenario what-if comparison list (Срок/Риск/SPI/recommended) — driven by a target resource overload
    эндпоинты: POST /api/workspace/projects/{projectId}/planning/scenarios/preview  ·  POST /api/workspace/projects/{projectId}/planning/scenario-proposals
- [endpoint-exists/S] Apply scenario ('Принять сценарий') with plan-version guard
    эндпоинты: POST /api/workspace/projects/{projectId}/planning/scenario-proposals/{proposalId}/apply  ·  POST /api/workspace/projects/{projectId}/planning/scenarios/{scenarioId}/apply
- [endpoint-exists/M] Auto-solver runs (backend capability absent from Storybook — generate+apply persisted solution proposals)
    эндпоинты: POST /api/workspace/projects/{projectId}/planning/auto-solver-runs  ·  GET /api/workspace/projects/{projectId}/planning/auto-solver-runs/{runId}  ·  POST /api/workspace/projects/{projectId}/planning/auto-solver-runs/{runId}/proposals/{proposalId}/apply
- [endpoint-exists/M] KPI tiles (SPI/CPI/Загрузка/Просрочено) + control signals list ('Сигналы контроля')
    эндпоинты: GET /api/workspace/projects/{projectId}/control/read-model  ·  GET /api/tenant/current/kpi-definitions
- [endpoint-exists/S] Recompute KPIs / re-evaluate control signals
    эндпоинты: POST /api/workspace/projects/{projectId}/control/evaluate
- [endpoint-exists/M] Signal management actions (Action/Review chip → preview+apply), acknowledge/resolve/accept-risk, corrective actions
    эндпоинты: POST /api/workspace/projects/{projectId}/control/signals/{signalId}/actions/{actionId}/preview  ·  POST /api/workspace/projects/{projectId}/control/signals/{signalId}/actions/{actionId}/apply  ·  POST /api/workspace/projects/{projectId}/control/signals/{signalId}/status  ·  POST /api/workspace/projects/{projectId}/control/signals/{signalId}/corrective-actions  ·  PATCH /api/workspace/projects/{projectId}/control/corrective-actions/{correctiveActionId}
- [partial/S] Calendars: exceptions list + add/remove (date/reason/kind)
    эндпоинты: GET /api/tenant/current/production-calendar  ·  POST /api/tenant/current/production-calendar/bulk
- [no-endpoint/M] Calendars: weekly working pattern edit (weekday on/off, hours, template ru-5x8/ru-4x10) persistence
    эндпоинты: GET /api/tenant/current/production-calendar
- [endpoint-exists/S] Audit journal (project management events) feed
    эндпоинты: GET /api/workspace/projects/{projectId}/control/read-model  ·  GET /api/tenant/current/audit-events
- [partial/S] Audit search + filter controls
    эндпоинты: GET /api/tenant/current/audit-events  ·  GET /api/workspace/search
- [endpoint-exists/M] Knowledge layer wiring (decision log / action items / documents) — backend capability not surfaced by these blocks; natural fit as a 'Решения' tab or audit enrichment
    эндпоинты: GET /api/workspace/projects/{projectId}/knowledge/decisions  ·  POST /api/workspace/projects/{projectId}/knowledge/decisions  ·  GET /api/workspace/projects/{projectId}/knowledge/action-items  ·  POST /api/workspace/projects/{projectId}/knowledge/action-items  ·  GET /api/workspace/projects/{projectId}/knowledge/documents
- [endpoint-exists/L] Closure layer wiring (project closeout/retrospective) — backend capability with no FE; future 'Закрытие' tab
    эндпоинты: GET /api/workspace/projects/{projectId}/closure  ·  POST /api/workspace/projects/{projectId}/closure/preview  ·  POST /api/workspace/projects/{projectId}/closure/close  ·  POST /api/workspace/projects/{projectId}/closure/lessons  ·  POST /api/workspace/projects/{projectId}/closure/template-improvement-actions/{actionId}/apply
- [endpoint-exists/S] Planning saved views (persist baseline/Gantt/scenario view config) — backend capability unused
    эндпоинты: GET /api/workspace/projects/{projectId}/planning/saved-views  ·  POST /api/workspace/projects/{projectId}/planning/saved-views  ·  DELETE /api/workspace/projects/{projectId}/planning/saved-views/{viewId}

**Build plan:**
1. Shell: create apps/web/src/views/layout/project-tabs.tsx (ProjectTabs) — a tab strip rendering Link items active-by-pathname: Обзор /projects/[id], Гант /projects/[id]/timeline, Ресурсы /projects/[id]/resources, Базовый план /projects/[id]/baseline, Сценарии /projects/[id]/scenarios, KPI /projects/[id]/kpi, Календари /projects/[id]/calendars, Аудит /projects/[id]/audit. Render it inside each project runtime under PageIntro (and add to ProjectDetailRuntime/ProjectGanttRuntime/ProjectResourcesRuntime to replace the ad-hoc link-buttons).
2. Routes: add 5 Next route files, each a 'use client' page using `use(params)` then <RuntimeScreenView id=... entityId={id}/> (mirror apps/web/src/app/projects/[id]/timeline/page.tsx): apps/web/src/app/projects/[id]/baseline/page.tsx (id '14-project-baseline'), .../scenarios/page.tsx ('15-project-scenarios'), .../kpi/page.tsx ('16-project-kpi'), .../calendars/page.tsx ('17-project-calendars'), .../audit/page.tsx ('18-project-audit').
3. Wiring: in apps/web/src/views/screens/runtime-screen-view.tsx extend RuntimeScreenId union with the 5 ids, add branches in RuntimeScreenContent (entityId-guarded, like 12/13), and add runtimeScreenMeta entries (activeNav 'Проекты', breadcrumb [{label:'Проекты',href:'/projects'},{label:'Базовый план'|'Сценарии'|'KPI'|'Календари'|'Аудит',current:true}]). SCREEN_META has no entries for these ids — supply meta inline in runtimeScreenMeta.
4. Add TS response types near PlanningReadModel: type BaselineSummary={id:string;capturedAt:string;taskCount:number}; type KpiEvaluation={id:string;definitionId:string;code:string;value:number;severity:'ok'|'warning'|'critical';unit:string}; type ControlSignal={id:string;code:string;title:string;severity:'warning'|'critical';status:'open'|'acknowledged'|'resolved'|'accepted_risk';scenarioProposals:ManagementActionCandidate[]}; type ControlReadModel={definitions:KpiDefinition[];evaluations:KpiEvaluation[];signals:ControlSignal[];correctiveActions:CorrectiveAction[];actionExecutions:unknown[];auditEvents:AuditEvent[]}; type ScenarioProposal={id:string;profile:'aggressive'|'balanced'|'resilient';conflictEffect:'accepted'|'reduced'|'removed';planDelta:{commands:unknown[]};explainability:{finishDate:string|null;deadlineDeltaDays:number;overloadMinutes:number;overloadedResourceIds:string[];riskScore:number;requiredApprovals:string[]}}; type ProductionCalendar={calendarId:string;year:number;workingWeekdays:number[];workingMinutesPerDay:number;exceptions:Array<{id:string;date:string;workingMinutes:number;reason:string|null;resourceId:string|null}>}.
5. Hooks (useQuery, mirror usePlanning): useBaselines(id) → apiFetch<{baselines:BaselineSummary[]}>(`/api/workspace/projects/${id}/planning/baselines`); useControlReadModel(id) → apiFetch<ControlReadModel>(`/api/workspace/projects/${id}/control/read-model`); useKpiDefinitions() → apiFetch<{definitions:KpiDefinition[]}>(`/api/tenant/current/kpi-definitions`); useProductionCalendar(year) → apiFetch<ProductionCalendar>(`/api/tenant/current/production-calendar?year=${year}`). Reuse existing usePlanning(id) for planVersion + read-model and useAuditEvents(limit) for the tenant audit feed.
6. ProjectBaselineRuntime: reuse usePlanning(id)+useBaselines(id). Render PageIntro + baseline picker (list from useBaselines). 'Создать снимок' = useMutation POST `/api/workspace/projects/${id}/planning/apply-command` json {command:{type:'baseline.capture',payload:{baselineId:`baseline-${crypto.randomUUID()}`,label}},clientPlanVersion:planVersion,idempotencyKey:...} (gate on perm tenant.project_baselines.manage via disabledReason). Comparison table built from planning.authored.tasks (Факт/current); honestly mark План/Δ columns 'partial' until baselines GET exposes per-task baseline dates (today it returns only id/capturedAt/taskCount) — keep the disabled 'Сравнить' contract used in ProjectGanttRuntime.
7. ProjectScenariosRuntime: derive a target overload (resourceId+date) from useControlReadModel/capacity; previewScenarios = useMutation POST `/api/workspace/projects/${id}/planning/scenarios/preview` json {target:{resourceId,date},clientPlanVersion}. Map proposals→rows: Сценарий=profile label, Срок=explainability.finishDate, Риск=bucket(riskScore), recommended=conflictEffect==='removed'. Budget/SPI columns have no backing field → render '—' or pull SPI from control evaluations (mark partial). 'Принять' = useMutation POST `/api/workspace/projects/${id}/planning/scenario-proposals/${proposalId}/apply` json {clientPlanVersion}; invalidate ['planning',id]; handle 409 plan_version_conflict like ProjectGanttRuntime.
8. ProjectKpiRuntime: useControlReadModel(id)+useKpiDefinitions(). Build 4 bento tiles by matching evaluations.code (spi,cpi,utilization,overdue) to definitions; tone by evaluation.severity. 'Сигналы контроля' from signals (icon by severity, chip Action when scenarioProposals.length>0 else Review). Wire signal actions: applyAction = POST `/control/signals/${sid}/actions/${aid}/apply` json {clientPlanVersion}; setStatus = POST `/control/signals/${sid}/status` json {status,acceptedRiskReason?}; createCorrective = POST `/control/signals/${sid}/corrective-actions`. 'Открыть управленческую поверхность' action + 'Пересчитать' = POST `/control/evaluate`. Gate via perms tenant.control_signals.manage / tenant.management_actions.execute.
9. ProjectCalendarsRuntime: useProductionCalendar(currentYear). Render weekday SwitchRows from workingWeekdays + workingMinutesPerDay (read-only initially) and exceptions list from response. 'Добавить'/'Сохранить' exceptions = useMutation POST `/api/tenant/current/production-calendar/bulk` json [{id,date,workingMinutes,reason,resourceId}]; remove = bulk upsert resetting workingMinutes (no per-row DELETE — mark partial). Weekly-pattern + template editing has NO persistence endpoint (bulk only handles exceptions) → render the controls but disable Save-for-pattern with an honest reason, like the Gantt edit-toolbar pattern. Gate via tenant.workspace_config.manage.
10. ProjectAuditRuntime: merge useControlReadModel(id).auditEvents (control workflow) with useAuditEvents(limit) tenant feed; render audit-list with businessStatus(actionType) labels (extend the businessStatus map for planning./control./kpi. action types). Search/Filter = client-side filter over the merged list (audit-events endpoint takes only ?limit, no text param; GET /api/workspace/search is metadata-only) → mark partial.
11. Stretch (backend-capability-into-FE, not in Storybook): add a 'Решения' panel/tab on knowledge/decisions+action-items, a 'Закрытие' tab on closure/*, and persist Gantt/baseline view config via planning/saved-views — each is a new runtime + hooks following the same apiFetch+useQuery/useMutation pattern; add nav entries to project-tabs.tsx.
12. Nav/sidebar: no SIDEBAR_GROUPS change needed (these live under Проекты); ensure project-tabs.tsx is the single source of the in-project tab list and update verify:storybook-contract copy-scan expectations if new EN words enter story titles.

---

## search-and-palette  [wired-surface]  effort=M
**Storybook composition:**
- CommandPaletteShowcase (apps/web/src/stories/showcases/demos.tsx:471, registry key 'command-palette') renders a bordered Command container
- CommandInput with placeholder 'Поиск…'
- CommandList scroll area
- CommandEmpty: 'Ничего не найдено'
- Single CommandGroup heading 'Навигация' with static CommandItems (Дашборд, Проекты)
- Story wrapper apps/web/src/components/ui/command-dialog.stories.tsx (title 'UI/CommandDialog'): DesignV2 'Витрина' renders the showcase; 'Variants' via createVariantsStory('command-dialog')
- NOTE: the Storybook design itself only shows nav + empty + input — it does NOT yet depict real cross-entity result groups; product owner wants live search wired beyond what the block draws

**Текущая проводка:** Prod runtime EXISTS as an overlay (no route): apps/web/src/shell/command-palette.tsx is mounted in apps/web/src/shell/app-topbar.tsx (app-shell topbar, alongside the disabled Bell). Behavior: a readOnly SearchPill ('Поиск задач, проектов, людей…') opens a CommandDialog; Ctrl/⌘K toggles it. Inside, the only group is 'Навигация' built from static NAV_LINKS (apps/web/src/views/config/sidebar-nav.ts — flat list of non-'soon' SIDEBAR_GROUPS items: /dashboard, /my-work, /projects, /deals, /agent, /admin, /settings). cmdk does CLIENT-SIDE fuzzy filtering over those labels only. No apiFetch, no debounce, no server results. GET /api/workspace/search is completely unused by the frontend. The prod CommandDialog wrapper (apps/web/src/components/ui/command-dialog.tsx) bakes in its own CommandInput and does not expose onValueChange/shouldFilter, so it cannot drive server search as-is.

**Gaps (фича → эндпоинты → данные/усилие):**
- [endpoint-exists/M] Live cross-entity search results (replace/augment static NAV_LINKS with real hits from the unified search endpoint as the user types)
    эндпоинты: GET /api/workspace/search?q={q}&types={csv}&limit={1-20}
- [endpoint-exists/S] Debounced server query wired to the input (set Command shouldFilter=false, drive CommandInput value/onValueChange, ~200ms debounce, enforce server min-2-char guard, abort stale requests) with loading + error + empty states (SearchPill/Command already have loading + 'Ничего не найдено')
    эндпоинты: GET /api/workspace/search
- [endpoint-exists/M] Type-grouped results with rich rows (title + subtitle + snippet + per-type icon) for projects/tasks/opportunities/clients/contacts/products/files/external refs/knowledge documents/decisions/action-items — Storybook shows one flat 'Навигация' group; design intent is entity groups
    эндпоинты: GET /api/workspace/search (SearchResult fields: type,title,subtitle,snippet,entityType,entityId,route,updatedAt,source — see apps/api/src/search/searchTypes.ts)
- [partial/S] Navigate to selected result via result.route. CAVEAT: server emits routes (/tasks/{id}, /opportunities/{id}, /clients/{id}, /contacts/{id}, /products/{id}, /knowledge/...) for which NO prod page exists — only /projects/{id} resolves (prod has /deals/[id], not /opportunities/{id}). Must scope v1 to resolvable types and/or remap opportunity->deals, or those rows 404
    эндпоинты: GET /api/workspace/search (route field, mapping in apps/api/src/search/searchRouting.ts)
- [partial/L] Missing entity detail pages so the remaining search types actually land somewhere (task/opportunity/client/contact/product/knowledge-document/decision/action-item detail routes under apps/web/src/app/)
    эндпоинты: GET /api/workspace/tasks/{taskId}  ·  GET /api/workspace/opportunities/{opportunityId}  ·  GET /api/workspace/projects/{projectId}/knowledge/documents/{documentId}  ·  GET /api/workspace/clients (list-only, no GET by id)  ·  GET /api/workspace/contacts (list-only)  ·  GET /api/workspace/products (list-only)
- [endpoint-exists/S] Empty-query default suggestions ('Моя работа' / recents) so the open palette is useful before typing — backend capability currently unused by FE
    эндпоинты: GET /api/workspace/my-work

**Build plan:**
1. Add typed search client apps/web/src/lib/search-client.ts: export type WorkspaceSearchResult mirroring apps/api/src/search/searchTypes.ts SearchResult {id,type,title,subtitle,snippet,entityType,entityId,route,updatedAt,score,source}; export async function searchWorkspace(q: string, opts?: {types?: string[]; limit?: number}) that builds URLSearchParams and calls apiFetch<{ results: WorkspaceSearchResult[] }>(`/api/workspace/search?` + params) from @/lib/api. Default limit 20 (server max), default types omitted (all).
2. Add hook apps/web/src/shell/use-workspace-search.ts (or apps/web/src/lib/hooks/): useWorkspaceSearch(query: string) — debounce ~200ms, skip when normalized query length < 2 (matches server search_query_too_short), AbortController to cancel stale requests, swallow ApiError('unauthorized'/'network_error') into an error flag; returns { results, loading, error }.
3. Rewrite apps/web/src/shell/command-palette.tsx to compose primitives directly from @/components/ui/command (Command shouldFilter={false}, CommandInput value/onValueChange, CommandList, CommandEmpty, CommandGroup, CommandItem) inside @/components/ui/dialog (Dialog/DialogContent) instead of the closed CommandDialog wrapper — so the input drives server search. Keep the Ctrl/⌘K useEffect toggle and the readOnly SearchPill trigger.
4. Render logic: query.length < 2 -> show 'Навигация' group (NAV_LINKS, existing behavior) plus optional 'Моя работа' group from GET /api/workspace/my-work; query.length >= 2 -> render server results grouped by result.type (headings: Проекты/Задачи/Сделки/Клиенты/Контакты/Товары/Файлы/Знания), each CommandItem showing title + subtitle/snippet + a lucide icon per type; show loading via SearchPill loading / a SkeletonRow, CommandEmpty 'Ничего не найдено' when results empty, inline ErrorState text on error.
5. On CommandItem select: setOpen(false) + router.push(result.route). For v1 correctness, pass types=['project'] to searchWorkspace (only /projects/{id} resolves) OR add a route remap (opportunity -> /deals/{id}) and gate other types until their pages exist; document the unresolved-route caveat in code.
6. (Optional, cleaner) instead of step 3 full rewrite, extend apps/web/src/components/ui/command-dialog.tsx to forward value/onValueChange/shouldFilter/loading to its inner Command/CommandInput, then keep command-palette.tsx using the wrapper.
7. No new Next route file is needed — the palette is an overlay already mounted in app-topbar.tsx; the only nav touch is keeping NAV_LINKS as the empty-query fallback group. (If product owner wants a dedicated /search results page later, add apps/web/src/app/search/page.tsx reusing search-client.ts.)
8. Add a Storybook variant in apps/web/src/components/ui/command-dialog.stories.tsx (or the showcase) that renders grouped live-result rows using the contract-mock fetchImpl pattern (.storybook/mocks) so the design block reflects the real result layout; keep all story titles in Russian to satisfy verify:storybook-contract copy-scan.

---
