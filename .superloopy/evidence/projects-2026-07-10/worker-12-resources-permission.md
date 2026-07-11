# Worker 12 Resources permission integration

Status: PASS

- Permission: `tenant.project_resources.manage` for absences/assignment load edits and `tenant.project_plan.manage` for accepted overload risk.
- Task create/edit controls require both plan and resource management, matching the compound backend command policy.
- Read-only matrix navigation and filters remain available; write callbacks and modal are absent.
- Focused permission suite: 1 passed.
- Live ADMIN/PLAN E2E: absence batch preview -> apply -> readback -> reload -> remove, and PLAN 403/unchanged.
- Evidence: `.superloopy/evidence/projects-2026-07-10/projects-assignments-calendars-resources-permission-playwright.json`.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-12-resources-permission.md
