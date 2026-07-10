# PROJ-005/015/016/021 matrix/docs audit

Verdict: **APPROVE**

Date: 2026-07-10
Scope: final read-only matrix/docs gate for PROJ-005, PROJ-015, PROJ-016 and PROJ-021.

## Matrix gate

- Exact target set: 10 rows, all `pass`.
- Role split is exact: PROJ-005 = A/PR/RR (3), PROJ-015 = A/PR (2), PROJ-016 = A/PR (2), PROJ-021 = A/PR/RR (3).
- Global summary is internally consistent: `pass=80`, `fail=46`; all summary buckets sum to `expandedMatrixRowCount=223`.
- The four inventory rows exist exactly once, carry the same role scope and behavior, and are marked fixed/pass.

## Code and bug-note consistency

- BUG-PROJ-04's 2026-07-10 fix note matches the current implementation: all nine delivery surfaces call `useProjectBase`; the focused hook tests cover mock/live identity, closed/draft status mapping and fail-closed identity reset during a project-id change.
- BUG-PROJ-10's 2026-07-10 fix note matches `ProjectDetailSurface` and current evidence: selection pushes the canonical `/projects/:id` URL, an unknown URL is not replaced with the first project, forbidden remains distinct, and retry reloads the same requested project.
- Inventory wording for 9/9 headers, canonical selector navigation, explicit 404, 403 separation and retry is supported by the current focused tests plus the saved browser evidence.

## Browser evidence audit

Artifact: `.superloopy/evidence/projects-2026-07-10/projects-detail-identity.json`

- Summary is exact: 16 total, 16 PASS, 0 FAIL, empty failures list.
- Uniqueness is exact: 16/16 unique `check` values and 16/16 unique screenshot paths.
- Role coverage is exact: admin 11, planReader 2, resourceReader 1, beta 2; no unexpected roles.
- Check coverage is exact: admin/planReader canonical selector sequences, admin/planReader/beta invalid-id checks, resourceReader forbidden, beta empty list, and all nine admin delivery headers.
- Header slugs are exact 9/9: overview, schedule, resources, assignments, calendars, scenarios, baseline, commits and settings.
- Every screenshot path is under the expected evidence root, its basename matches the check id, and all 16 files exist and are non-empty.

This read-only gate validated the current JSON and screenshot artifacts; it did not rerun the live Playwright scenario.

## Focused test claim

Fresh command:

```text
pnpm vitest run apps/web/src/delivery/lib/project-chrome.test.tsx apps/web/src/workspace/project-detail/project-detail-identity.test.tsx
```

Result: 2/2 files passed, 7/7 tests passed (3 `useProjectBase` tests + 4 `ProjectDetailSurface` tests).

## Gate decision

APPROVE the requested matrix/docs promotion for these exact 10 rows. No discrepancy was found in the requested totals, inventory/bug notes, evidence uniqueness, role/check coverage, screenshot paths or focused 7/7 claim.

SUPERLOOPY_AUDIT: .superloopy/evidence/projects-2026-07-10/qa-project-identity-matrix-audit.md
