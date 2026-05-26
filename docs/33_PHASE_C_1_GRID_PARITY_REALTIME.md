# 33. Phase C.1 — Grid parity + Realtime

## Transport

- **SSE** `GET /api/workspace/projects/:projectId/planning/events` (`text/event-stream`).
- In-memory `planningEventBus` / `PlanningEventPublisher` (PubSub по `projectId`). Ограничение multi-instance — [decisions/planning-realtime-sse.md](decisions/planning-realtime-sse.md).
- События: `planVersionChanged`, `planSnapshotInvalidated`.
- Heartbeat каждые 15 с.

## Compensating undo

- Без серверного `compensate` endpoint.
- После `apply` клиент сохраняет `{ command, beforeReadModel }`.
- Ctrl+Shift+Z строит обратные команды из diff `before`/`after` для: `task.update_identity`, `task.update_schedule`, `task.update_work_model`, `task.update_progress`, `task.update_status`, `dependency.upsert`, `dependency.delete`, `assignment.upsert`, `assignment.delete`.
- `task.delete_or_archive` — undo disabled с reason.

## UI primitives

- Context menu: `@radix-ui/react-dropdown-menu` (trigger on right-click).
- Confirm delete: `@radix-ui/react-dialog`.
- Gantt zoom: Radix-based select wrapper.

## Drag-fill

- `detectFillSeries` в `@kiss-pm/planning-client`: date day increment, number +1, text repeat.

## Paste

- TSV: strip BOM, normalize CRLF, batch `apply-command-batch`.
