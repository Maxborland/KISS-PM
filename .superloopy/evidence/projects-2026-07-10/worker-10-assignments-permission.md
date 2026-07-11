# Worker 10 Assignments permission integration

Status: PASS

- Permission: `tenant.project_resources.manage`, no role hardcode.
- Read-only users retain assignment rows and static inspector data; add/edit/curve/remove controls are absent.
- AddAssigneeDialog now receives the already-loaded resource directory, removing the per-row directory fetch fan-out.
- Focused permission suite: 1 passed.
- Live ADMIN/PLAN E2E: add -> preview -> apply -> readback -> reload -> remove, and PLAN 403/unchanged.
- Evidence: `.superloopy/evidence/projects-2026-07-10/projects-assignments-calendars-resources-permission-playwright.json`.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-10-assignments-permission.md
