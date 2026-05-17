# R2-MOCK-001 Project Gantt Mockup Handoff

Status: accepted

Completed at: 2026-05-17T13:27:45+07:00

## Scope

Delivered the full-function Project Gantt mockup requested by `docs/design-mockups/project-gantt-goal.md`.

No production application code was changed. Scope stayed in design/mock artifacts plus agent-bus coordination.

## Artifacts

- Mock: `.superpowers/brainstorm/visual-r2-20260517121053/content/project-gantt-planner-v5.html`
- Verification script: `.superpowers/brainstorm/visual-r2-20260517121053/verify-project-gantt-mock.mjs`
- Goal: `docs/design-mockups/project-gantt-goal.md`
- Acceptance matrix: `docs/design-mockups/project-gantt-mock-acceptance-matrix.json`
- Design notes: `docs/design-mockups/project-gantt-design-notes.md`
- Browser report: `docs/design-mockups/artifacts/project-gantt-v5/browser-verification-report.json`
- Screenshots:
  - `docs/design-mockups/artifacts/project-gantt-v5/desktop-initial.png`
  - `docs/design-mockups/artifacts/project-gantt-v5/desktop-after-apply.png`
  - `docs/design-mockups/artifacts/project-gantt-v5/narrow-1024.png`
  - `docs/design-mockups/artifacts/project-gantt-v5/playwright-mcp-final-desktop.png`
  - `docs/design-mockups/artifacts/project-gantt-v5/playwright-mcp-final-narrow.png`

## Verification

- `Invoke-WebRequest -Uri http://localhost:64986 -UseBasicParsing`: exit 0, server returns Project Gantt Planner v5.
- `node .superpowers/brainstorm/visual-r2-20260517121053/verify-project-gantt-mock.mjs --url http://localhost:64986`: exit 0, 20/20 browser interaction checks pass.
- `node -e "<matrix/report/artifact validation>"`: exit 0, 10 matrix rows, 20 browser rows, 5 screenshots, 0 console errors.
- `git diff --check`: exit 0.
- `node scripts/agent-bus-guard.mjs --task R2-MOCK-001-project-gantt-goal-contract --once`: run during completion.

## Review Findings

- Bug-hunt: column popover intercepted the Hide Gantt toolbar action after a column toggle. Fixed by moving the popover below the toolbar and closing it on outside toolbar actions.
- Bug-hunt: predecessor validation falsely flagged valid links because self-link validation used the globally active task instead of the task being validated. Fixed by passing current task id into `parsePred`.
- Code-review: verifier could previously pass an object containing `changed: false`. Fixed with recursive truthy-flag assertion for `ok`, `created`, `changed`, `unchanged`, and `applyEnabled`.

## Next Recommended Work

Review the v5 mock with the user, then either:

- iterate one design pass on this mock, or
- create a production Release 2 implementation task for the accepted Project Gantt interaction model.
