# 34. Phase C.2 — Resources, Assignments, Calendars

## Решения

- **Resource drilldown:** `PlanningReadModel.resourceLoad` + список уникальных `resourceId` из assignments.
- **Assignment matrix:** табличный MVP с inline edit `unitsPermille` → `assignment.upsert` через preview bar.
- **Calendars:** `calendar.exception.upsert` через Radix dialog; ICS import — Phase D.
- **Routing:** вкладки `/projects/:id/{schedule|resources|assignments|calendars}` через Next `[tab]` + `PlanningWorkspace.activeTab`.

## Out of scope

- ICS import, canvas matrix 50×90 (virtualizer — follow-up при профилировании).
