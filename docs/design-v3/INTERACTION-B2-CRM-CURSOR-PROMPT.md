# Cursor Prompt — Batch B2: CRM (Deals + Entities + Funnel widget)

Inherit master rules.

## Files in scope

```txt
apps/web/src/views/blocks/deals-block.tsx
apps/web/src/views/blocks/entities-block.tsx
apps/web/src/widgets/funnel/*                (NEW — extract from deals-block)
apps/web/src/widgets/funnel/funnel.stories.tsx (NEW)
apps/web/src/views/screens/screens.stories.tsx (variants only)
```

## P0 (must)

1. `entities-block.tsx` L55–58 «Импорт», L59–62 «Добавить», L68–71 «Фильтр» (NB: enabled, regression vs deals pattern), L125–127 row action `IconButton` — fix per universal contract (`disabled title="Демо…"` OR local Drawer stub / `DropdownMenu`).

## P1

2. `entities-block.tsx` — controlled `query` state filters `c.rows`; rows clickable → `Sheet` with entity name.
3. `deals-block.tsx` L42–45 «Сделка» → drawer stub appending to local deals state.
4. `deals-block.tsx` L60 `SearchPill` → controlled, filters `DEALS`.
5. `deals-block.tsx` L77–88 card and L112–128 row click → open Sheet.
6. Extract funnel UI L67–93 → new `apps/web/src/widgets/funnel/funnel-board.tsx` + `deal-card.tsx` + `use-funnel-state.ts`:
   - `FunnelBoard` accepts `stages`, `deals`, `onMoveDeal(dealId, toStageId)`, `onOpenDeal(id)`.
   - Implements DnD via `@dnd-kit/core` (same lib as kanban).
   - `deals-block.tsx` composes `<FunnelBoard … />`.
7. `deals-block.tsx` forecast mode L134–136 — either render simple stat cards or `disabled` tab with title.

## P2

8. `funnel.stories.tsx` — variants: `Default`, `Dragging`, `Filtered`, `EmptyStage`.
9. `screens.stories.tsx` — add `DealsFunnelDragging`, `EntitiesClientsFiltered`.

## Acceptance

- `widgets/funnel/` exists with at least 3 files + stories.
- Deals search filters; entities search filters.
- All enabled toolbar buttons either work or `disabled+title`.
- DnD: drag deal A→B updates stage count badge live.

## Verification

Master gate + `interaction-batch-2-evidence.json`.
