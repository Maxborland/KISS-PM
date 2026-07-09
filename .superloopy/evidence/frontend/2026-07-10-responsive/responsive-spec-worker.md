# Responsive shell regression spec evidence

- Date: 2026-07-10
- Status: **RED as expected** for the two currently reproducible defects; the tablet paint regression passed on the live runtime.
- Scope: only `e2e/a11y/responsive-shell.spec.ts` and this report.
- Runtime: existing web `http://127.0.0.1:3180`, API `http://127.0.0.1:4180`.
- Auth: seeded admin via the existing `loginToWorkspace` helper and password `admin12345`.

## Coverage added

1. `CURRENT-RESP-01` at `390x844`: requires an accessible navigation toggle, closed/open states, permitted admin links, focus inside the open sidebar, Escape close, and focus restoration.
2. `CURRENT-RESP-02` at `768x1024`: checks the workspace sidebar logo/group labels and all seeded-admin links with accessibility locators, viewport visibility, trial hit-testing, and in-memory screenshot pixel variance so a solid obscuring band fails.
3. `CURRENT-RESP-03` at `768x1024`: measures representative avatar, primary create-user, icon-only edit-user, and sidebar navigation hit areas against the `44x44` threshold. Soft assertions preserve all measurements in one red result.

The spec uses condition waits only and contains no `waitForTimeout`.

## Verification

Parse/list command:

```text
pnpm exec playwright test e2e/a11y/responsive-shell.spec.ts --project=chromium --list
```

Result: pass; Playwright discovered exactly 3 tests in 1 file.

The default-port execution could not start because another `next dev` process already owned this repository's `.next` lock. No process was stopped. The focused spec was rerun against the already-running responsive QA services:

```text
$env:E2E_WEB_PORT='3180'; $env:E2E_API_PORT='4180'; pnpm exec playwright test e2e/a11y/responsive-shell.spec.ts --project=chromium
```

Final result: **2 failed, 1 passed (15.9s)**.

- **FAIL `CURRENT-RESP-01`**: no button matching accessible name `/навигацию/i` exists at `390x844`; failure is at the first required visible navigation-trigger assertion.
- **PASS `CURRENT-RESP-02`**: communications workspace sidebar labels and links were visibly painted and hit-testable at `768x1024` in this run. The previously captured black-band issue did not reproduce on the live headless runtime.
- **FAIL `CURRENT-RESP-03`** with complete soft-assert measurements:
  - avatar: `32x32`;
  - primary create-user control: height `28`;
  - icon-only edit-user control: `32x28`;
  - sidebar administration link: height `34`.

Failure traces are under the ignored Playwright `test-results/` directory for the `CURRENT-RESP-01` and `CURRENT-RESP-03` cases.

## CodeGraph change index

Before: 2,169 indexed files, 23,974 nodes, 51,774 edges.

After spec indexing: 2,170 indexed files, 23,986 nodes, 51,792 edges.

Delta: **+1 file, +12 nodes, +18 edges**. Added nodes comprise 3 constants, 3 imports, 4 functions, 1 type-alias node, and 1 file node. The added named helpers are `loginAsSeededAdmin`, `expectVisiblyPainted`, and `expectTouchTarget`; the fourth function node is the decoded screenshot evaluator. No existing symbols or edges were removed or changed.

Files touched:

- `e2e/a11y/responsive-shell.spec.ts` — new focused regression suite.
- `.superloopy/evidence/frontend/2026-07-10-responsive/responsive-spec-worker.md` — this execution report.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/2026-07-10-responsive/responsive-spec-worker.md
