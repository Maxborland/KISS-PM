# 36. Phase C.4 — Project Audit + Settings

## Решения

- **Audit filter:** `GET /api/tenant/current/audit-events?projectId=` (sourceEntity Project).
- **Advanced drawer:** Radix dialog с raw JSON.
- **Settings:** MVP — отображение `calendarId`, изменение календаря через `calendar.exception.upsert` / будущий `project.settings.update` (Phase D для полного REST).
- **Integrations:** placeholder disabled «Phase D».
