# Project identity/detail browser audit

## Verdict

**APPROVE**

Bounded independent audit of `.superloopy/evidence/projects-2026-07-10/projects-detail-identity.json`, its 16 referenced screenshots, and the required live risk checks at `http://127.0.0.1:3180`.

## Artifact integrity

- JSON summary is internally consistent: 16 total, 16 PASS, 0 FAIL, and no failure entries.
- All 16 screenshot paths exist and are non-empty. The set is one-to-one with the 16 JSON rows; no duplicate path or missing row was found.
- Every screenshot was inspected at original resolution, not sampled. Each image matches its row's role, route/state, and expected project identity or permission result.
- The nine admin delivery screenshots consistently show `Портал подрядчиков Вектор`, status `В работе`, and the corresponding active delivery tab. No screenshot substitutes the unrelated `Производственный портал · Релиз 2` identity.
- Canonical-flow screenshots end on `Миграция данных Горсеть`, invalid-ID screenshots show `Проект не найден`, the resource-reader screenshot shows `Доступ ограничен`, and the beta list screenshot shows `Нет проектов`.
- The resource-reader and beta-invalid captures contain dark/transparent peripheral regions, but their asserted route identity, selector value, and forbidden/not-found state remain visible and unambiguous. This does not create evidence substitution.

## Independent in-app browser checks

- **Canonical selector/reload/back/forward:** started at `/projects/project-vektor-portal`; selecting `Миграция данных Горсеть` changed the canonical URL to `/projects/project-gorset-migration`. Reload preserved both URL and selected project. Back restored `/projects/project-vektor-portal` with the Vektor heading; forward restored `/projects/project-gorset-migration` with the Gorset heading.
- **Invalid ID / no substitution:** `/projects/project-does-not-exist` produced `GET /api/workspace/projects/project-does-not-exist` = `404`, retained the invalid canonical path, and rendered `Проект не найден`. Reload reproduced the `404`; neither Vektor nor Gorset project content was substituted.
- **Delivery header:** `/projects/project-vektor-portal/overview` rendered the level-1 heading `Портал подрядчиков Вектор`, status, plan version, deadline/finish metadata, and all nine delivery tabs: overview, schedule, resources, assignments, calendars, scenarios, baseline, commits, and settings.
- **resourceReader forbidden:** under `resource-reader@kiss-pm.local`, `/projects/project-vektor-portal` produced `GET /api/workspace/projects/project-vektor-portal` = `403`, retained the requested path, rendered `Доступ ограничен`, and did not expose the project heading/content.

## Decision basis

No sampling, row substitution, project-identity substitution, invalid-ID fallback, or permission bypass was observed. The fresh JSON, all 16 screenshots, and independent live browser evidence agree on the bounded project identity/detail behavior.

SUPERLOOPY_AUDIT: .superloopy/evidence/projects-2026-07-10/qa-project-identity-browser-audit.md
