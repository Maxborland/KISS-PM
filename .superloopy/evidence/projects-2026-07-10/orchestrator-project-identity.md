# Project identity/detail closure

## Verdict

PASS. Product, focused, live browser, matrix and code-review evidence are green.

## Scope

- PROJ-005: live identity in all 9 Project Delivery headers.
- PROJ-015: selector and canonical URL remain synchronized through reload, Back and Forward.
- PROJ-016: invalid project id stays in the URL and renders explicit 404/not-found without substitution.
- PROJ-021: loading/error/forbidden/empty remain distinct and Retry repeats the same project.

## Product changes

- `useProjectBase` fetches the active-project identity for the requested `projectId`.
- Identity state is instance-local and keyed by `projectId`; there is no module cache that can cross tenant/auth boundaries.
- A changed id immediately renders neutral identity until fresh readback, so the previous project's title cannot flash.
- Non-OK detail responses remain neutral and cannot reuse a prior same-id identity.
- The status contract is explicitly active-only, matching the real detail endpoint.

## Harness corrections

Two intermediate E2E runs failed closed and were not used as final evidence:

1. Playwright native `selectOption` waited indefinitely for a Next transition because action timeout was inherited from the whole test.
2. The first bounded retry exposed two assertion mismatches: locator-bound change dispatch and treating the empty title as a semantic heading.

The final harness uses a real browser DOM `change` event, 20-second action timeout, exact visible empty text, exact 404/403 API statuses, unique screenshot rows, and hard final failure assertions.

## Fresh verification

- Focused Vitest: 2 files, 8/8 PASS.
- Web typecheck: PASS.
- Live Playwright: 16/16 PASS, 0 FAIL.
- Screenshots: 16/16, one-to-one with JSON rows.
- Delivery headers: 9/9.
- Canonical sequences: admin and planReader.
- Invalid 404: admin, planReader and beta.
- Forbidden 403: resourceReader.
- Matrix: 10/10 promoted; pass 80 / fail 46.
- Independent code recheck: APPROVE.
- Independent matrix gate: APPROVE.
- Superseding browser freshness lane timed out without an artifact and is recorded as inconclusive, not as approval. Completion rests on the existing independent in-app browser audit plus fresh post-source 16/16 E2E and fresh code APPROVE.

## Evidence

- `.superloopy/evidence/projects-2026-07-10/projects-detail-identity.json`
- `.superloopy/evidence/projects-2026-07-10/project-detail-identity/screenshots/`
- `.superloopy/evidence/projects-2026-07-10/qa-project-identity-code-review.md`
- `.superloopy/evidence/projects-2026-07-10/qa-project-identity-matrix-audit.md`

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/orchestrator-project-identity.md
