# Phase 3.1 ledger: CRM foundation, сделки и intake UX

## Scope

- `Client`, `Contact`, `ProjectType`, `DealStage`.
- Сделка как UI-label для `Opportunity`.
- Связи сделки с клиентом, основным контактом, типом проекта и этапом.
- Детальная страница сделки `/opportunities/:id`.
- Views сделок: список и kanban.
- Context-aware `Quick Create` только там, где есть реальные действия.
- UI/UX cleanup перед проектным контуром.

## Decisions

- Code/API identifier `Opportunity` сохраняется в Phase 3.1; UI использует “Сделка”.
- Детали сделки делаем отдельной Next.js page, не slider, чтобы получить deep link, reload и E2E-friendly navigation.
- Kanban без drag-and-drop в Phase 3.1; смена этапа через явное действие.
- Этапы сделок и типы проектов являются tenant-scoped сущностями, а не React constants.

## Red / Green evidence

| Блок | RED | GREEN |
| --- | --- | --- |
| Spec/docs | `docs/23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md` отсутствовал | Документ создан с AC1-AC10 и traceable test plan |

## Review cycle

- Block A Bug Hunt: проверены placeholder/TODO, fake promises и противоречия с Phase 3; подтвержденных дефектов в spec/docs нет.
- Block A Code Review: spec содержит AC1-AC10, non-goals и traceable test plan; Critical/Important замечаний нет.
- Block A Security Review: код не менялся; security-relevant требования зафиксированы в AC9 и test plan.

## Fresh verification

- Block A `Test-Path docs/23_PHASE_3_1_CRM_FOUNDATION_DEAL_UX.md`: passed, exit 0.
- Block A `Test-Path docs/status/phase3-1-crm-foundation-deal-ux-ledger.md`: passed, exit 0.
- Block A `rg -n "23_PHASE_3_1|Phase 3\.1|AC10|TODO|TBD" ...`: passed, exit 0; новых `TODO`/`TBD` нет.
- Block A `git diff --check -- docs/...`: passed, exit 0.

## Remaining follow-up after Phase 3.1

- Drag-and-drop kanban.
- External CRM/intake connectors.
- Full resource matrix.
- Gantt/WBS/tasks.
