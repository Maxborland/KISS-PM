# P5-009 integration unblocker handoff

- Task: P5-009 — Deterministic Phase 5 fixtures and E2E suite
- Agent: codex-p5-block-lead
- Branch/worktree: `codex/p5-010-exit-gate` at `C:\tmp\kiss-pm-worktrees\p5-010-exit-gate`
- Status: ready for P5-010 rerun from clean worktree after commit

## Why this block was reopened

P5-010 clean-worktree verification proved committed HEAD lacked earlier P5 scheduling-engine exports while P5-010 forbids `packages/**`. P5-009 has the broad P5 write scope needed to commit the missing foundation artifacts without violating P5-010 scope.

## Changed files

- `AGENTS.md`
- `.gitignore`
- `.agent-bus/README.md`
- `.agent-bus/ownership.json`
- `.agent-bus/runbooks/*`
- `.agent-bus/orchestration/README.md`
- `.agent-bus/orchestration/TEMPLATE.json`
- `.agent-bus/tasks/TEMPLATE.md`
- `.agent-bus/tasks/backlog/0001-verify-agent-bus.md`
- `.agent-bus/handoff/TEMPLATE.md`
- `.agent-bus/claims/EXAMPLE.claim.json.template`
- `docs/phases/PHASE_5_SCHEDULING_GANTT_FOUNDATION.md`
- `docs/status/phase5-contract-matrix.json`
- `packages/scheduling-engine/src/index.ts`
- `packages/scheduling-engine/src/schedulePrimitives.test.ts`
- `packages/scheduling-engine/src/wbsProjection.test.ts`
- `scripts/verify-requirements-matrix.mjs`
- `scripts/verify-requirements-matrix.test.ts`
- `scripts/agent-bus-guard.mjs`
- `scripts/agent-bus-guard.test.mjs`
- `scripts/agent-bus-orchestration-check.mjs`
- `scripts/agent-bus-orchestration-check.test.mjs`
- `scripts/agent-bus-status.mjs`
- `scripts/agent-bus-status.test.ts`

## Review findings and fixes

- Bug Hunt / code review Critical: Phase 5 contract matrix referenced a missing Phase 5 brief in the clean worktree. Fixed by adding `docs/phases/PHASE_5_SCHEDULING_GANTT_FOUNDATION.md` and adding a verifier regression for missing literal `owned_scope` paths.
- Code review Important: duplicate canonical `taskId` values could appear in multiple WBS task nodes, making dependency readback order-dependent. Fixed by rejecting duplicate task-backed WBS task ids in `createSchedulePlan` and `validateSchedulePlan`, with regression tests.
- Code review Important: suggested rejecting baseline capture for active plans/existing baseline ids. Verified against API integration and E2E: Phase 5 uses `POST /schedule/baseline` as the explicit draft snapshot replacement command over an active schedule plan. The stricter change broke baseline API/E2E, so it was not kept.
- Verification process finding: matrix unit tests and E2E both write under `test-results`; running them in parallel caused a fixture race. Reran verifier tests separately and they passed.

## Commands and exit codes

- `npm test -- packages/scheduling-engine` -> exit 0; 2 files, 25 tests passed after review fixes.
- `npm test -- scripts/verify-requirements-matrix.test.ts` -> exit 0; 36 tests passed after isolated rerun.
- `node --test scripts/agent-bus-guard.test.mjs scripts/agent-bus-orchestration-check.test.mjs` -> exit 0; 5 tests passed.
- `npm test -- scripts/agent-bus-status.test.ts` -> exit 0; 3 tests passed.
- `npm run test:integration` -> exit 0; 7 files, 33 tests passed.
- `npm run test:e2e:phase -- --phase=5` -> exit 0; E2E-040..044 passed.
- `npm run typecheck -- --pretty false` -> exit 0.
- `npm run lint` -> exit 0.
- `npm run verify:matrix -- docs/status/phase5-contract-matrix.json` -> exit 0.
- `npm run verify:matrix -- --allow-blocked docs/status/phase5-requirements-matrix.json` -> exit 0.
- `AGENT_BUS_ROOT=E:\KISS-PM\.agent-bus node scripts/agent-bus-guard.mjs --task P5-009 --once` -> exit 0.
- `git diff --check -- AGENTS.md .gitignore docs/phases/PHASE_5_SCHEDULING_GANTT_FOUNDATION.md docs/status/phase5-contract-matrix.json packages/scheduling-engine scripts .agent-bus` -> exit 0.

## Risks / follow-up

- P5-010 still needs strict final matrix verification without `--allow-blocked` after this commit.
- Main checkout remains dirty with unrelated docs/status work; continue from the clean `codex/p5-010-exit-gate` worktree to avoid staging unrelated files.
