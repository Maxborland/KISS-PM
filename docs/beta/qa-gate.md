# KISS PM Beta QA Gate

The beta gate must prove that KISS PM can be used as an operational product, not only that TypeScript compiles. Green checks are meaningful only when they cover the actual runtime surface.

## Gate Levels

### P0: Build and Contract Health

Required before every merge:

- Typecheck passes.
- Unit/contract tests pass for touched packages.
- API/read-model contracts match runtime screen needs.
- No route requires unused catalogs/permissions.
- No generated artifacts or unrelated lockfile churn are included unless required.

### P1: Runtime Smoke

Required for beta-critical runtime changes:

- App and API start from clean commands.
- Core routes load without blank screens.
- Playwright captures unexpected `pageerror`.
- Playwright captures unexpected `console.error`.
- Failed document/script/API responses are treated as failures unless explicitly allowlisted.

### P2: Business Flow Proof

Required before a screen is called beta-ready:

- Create/open/update flow for the primary user story.
- Persisted mutation verified after reload or fresh query.
- Empty/loading/error/permission states covered where relevant.
- Role-specific access behavior verified for restricted data/actions.

### P3: Agent Safety Gate

Required before agent chat is beta-ready:

- Agent receives current entity context and allowed action set.
- Grounded answers reference real app entities.
- Structured proposal is shown before write actions.
- No mutation occurs before explicit confirmation.
- Confirmed mutation changes the entity and creates visible result/audit entry.
- Failure path shows a clear recoverable error.

### P4: Visual Readiness Gate

Required for screens/widgets marked beta-ready:

- Desktop screenshot proof.
- Narrow-width screenshot proof.
- No text/action overlap.
- No sparse demo/landing composition on operational screens.
- No dead enabled controls.
- Reusable components are classified through `component-readiness.md`.

### P5: Call/Media Gate

Required before the communications self-hosted A/V epic (Phase G.4/G.5, `docs/46`/`docs/47`) is allowed near strict-production:

- Join token and TURN credentials are never persisted to DB/audit/log and never cached in the client (response-only ephemeral secrets).
- Internal LiveKit webhook rejects a forged-signature request (fail-closed) with no DB mutation; a test proves rejection.
- Per-track recording attachments are readable only by users with parent-entity/room read; isolation test proves a non-reader cannot read a recording.
- Provider-disabled and reconnecting states render without dead controls (recording/TURN/screen-share controls are hidden or disabled with a real reason, never fake-enabled).
- Call route passes axe with no critical violations; mute/leave reachable by keyboard.

## Recommended Commands

The exact command names should follow the repo scripts. The intended gate shape is:

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm qa:runtime
pnpm verify:storybook-contract
```

If a command does not exist yet, the implementation slice should add the smallest honest script and document its scope. Do not report a missing command as green.

## Minimum Beta Walkthrough

This walkthrough is the manual and automated north star:

1. Start from seeded architecture bureau data.
2. Open dashboard/control surface.
3. Identify one at-risk project.
4. Open project detail.
5. Add or update a task with owner and due date.
6. Mark a blocker.
7. Verify blocker appears in attention/risk surface.
8. Open planning/timeline and verify date/status visibility.
9. Ask agent for a recovery plan.
10. Confirm one proposed safe action.
11. Verify entity changed and audit/result is visible.

## Definition of Done for a Beta Slice

A beta slice is done only when:

- linked user stories are named;
- touched screens pass the screen readiness gate or are explicitly marked as still not beta-ready;
- component choices are classified;
- QA command evidence is fresh;
- screenshots are attached for visual claims;
- unrelated dirty/staged files are not included;
- known exclusions are written down instead of hidden.

## CI Expectations

CI should fail on:

- TypeScript/build/test failure.
- Playwright page errors or unexpected console errors.
- API 4xx/5xx on runtime route load unless explicitly expected.
- Missing screenshots/artifacts for visual smoke where required.
- Storybook contract drift for approved components.
- Agent mutation without confirmation.
- A call join token or TURN/egress credential serialized into client cache, log or audit (P5 Call/Media Gate).

CI may allow as warning during early beta:

- Deferred finance screens.
- Missing full dependency editing.
- Limited mobile layout, if narrow-width core actions remain usable.
- Non-critical visual refinements not affecting workflow clarity.

## Reporting Template

```md
## Beta QA Result
- Branch:
- Commit:
- Slice:
- Stories covered:
- Commands run:
- Screens checked:
- Screenshots:
- Pass/fail:
- Known gaps:
- Next blocking fix:
```

