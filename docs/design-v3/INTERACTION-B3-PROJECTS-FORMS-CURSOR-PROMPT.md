# Cursor Prompt — Batch B3: Projects List + Task Wizard + Entity Detail + State Screens

Inherit master rules.

## Files in scope

```txt
apps/web/src/views/blocks/projects-list-block.tsx
apps/web/src/views/blocks/task-create-modal-block.tsx
apps/web/src/views/blocks/entity-detail-block.tsx
apps/web/src/views/blocks/state-screen-block.tsx
apps/web/src/components/ui/combobox.tsx          (verify value/onValueChange contract)
apps/web/src/components/ui/form-layout.tsx        (TagsInput add/remove handlers)
apps/web/src/views/screens/screens.stories.tsx   (variants)
```

## P0 (must)

1. `task-create-modal-block.tsx` L56–62 — `Combobox` selection updates trigger label. Either make `Combobox` controlled (`value`+`onValueChange` props from block `useState`) OR fix `combobox.tsx` to render its internal selection.
2. `task-create-modal-block.tsx` L95 «Далее» — currently enabled but does nothing. Wire local `step` state (1→2→3); validate required `Название` before advance.
3. `projects-list-block.tsx` L50–53/L67–106 — when `filter !== "active"` show different dataset (`ARCHIVED_PROJECTS` / `TEMPLATES`) or `EmptyState`, not the same active table.

## P1

4. `projects-list-block.tsx` L25–28 «Проект» → drawer create stub.
5. `projects-list-block.tsx` L43 `SearchPill` → controlled, filters `MOCK_PROJECTS`.
6. `projects-list-block.tsx` L84–86/L102–104 row `IconButton` → `DropdownMenu` (Edit/Archive/Delete with toast).
7. `projects-list-block.tsx` rows L67–106 — clickable → Sheet.
8. `task-create-modal-block.tsx` L24–37 stepper → real `useState(step)`, items clickable to jump back.
9. `task-create-modal-block.tsx` L41/L68 — controlled `Input` for name/duration.
10. `task-create-modal-block.tsx` L84 `TagsInput` controlled + add/remove handlers.
11. `task-create-modal-block.tsx` L92 «Отмена» / L94 «Назад» — wire close/back.
12. `entity-detail-block.tsx` L65–68 «Запланировать» → `onSelect` toast.
13. `entity-detail-block.tsx` L71 «Сохранить» → controlled fields + dirty + toast on save.
14. `entity-detail-block.tsx` L112 textarea controlled; L117–120 «Отправить» appends to local `feed` array.
15. `entity-detail-block.tsx` L114–116 «Прикрепить» → file input stub.
16. `entity-detail-block.tsx` L130–140 stage `Select` controlled; L146 «Сумма» controlled.
17. `entity-detail-block.tsx` L154–159 link list — wrap in `Button variant="link"` with `onOpenProject(id)`.
18. `state-screen-block.tsx` L19 empty CTA → wire to mock create OR `disabled`. L26 `ErrorState` — pass `onRetry`.

## P2

19. `screens.stories.tsx` — `CreateTaskModalStep1`, `CreateTaskModalValidation`, `EntityDetailDirty`, `ProjectsListFiltered`, `StateError` variants.

## Acceptance

- Task wizard: пройти 1→2→3, валидация на name, Combobox показывает выбранное.
- Projects: search фильтрует, segment меняет dataset, row open срабатывает.
- Entity detail: save с dirty indicator, comment send добавляет в фид.

## Verification

Master gate + `interaction-batch-3-evidence.json`.
