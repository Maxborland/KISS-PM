# Browser core traversal - 2026-07-07

Status: partial-pass for RISK-FULL-BROWSER-TRAVERSAL, not full closure.

Checked:
- Admin login, dashboard shell/sidebar, CRM deals/clients/contacts/products, admin users surface.
- Admin CRM deal write/readback: create opportunity through API, move stage in UI list, API readback, reload persistence, kanban readback.
- Limited profile.read user login, restricted nav, direct forbidden CRM/admin routes, API 403 read checks.

Fresh evidence:
- risk-full-browser-core-traversal-2026-07-07.json
- Playwright command passed 2/2 tests in 6.8s on API 4102, web 3102, DB 55433 after fresh seed and API restart.

Still not verified:
- Literal every role x every route x every action.
- Mobile/responsive traversal.
- Live media provider behavior.
- Real LLM provider SSE.
- Live email mailbox reset token extraction.
