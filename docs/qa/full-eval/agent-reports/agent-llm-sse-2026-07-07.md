# RISK-AGENT-REAL-LLM-SSE / BUG-SHELL-12 — configured-provider and SSE behavior

Date: 2026-07-07
Workspace: E:\KISS-PM
Status: DONE - integrated by orchestrator

## Scope

Inspected and verified only the agent LLM/SSE surface:

- `apps/api/src/agent/llmProvider.ts`
- `apps/api/src/agent/openRouterProvider.ts`
- `apps/api/src/agent/agentLoop.ts`
- `apps/api/src/agent/agentRoutes.ts`
- `apps/api/src/agent/agentProviderDegraded.test.ts`
- `apps/api/src/agent/openRouterProvider.test.ts`
- `apps/api/src/agent/agentLoop.test.ts`
- `apps/web/src/workspace/agent/agent-client.ts`
- `apps/web/src/workspace/agent/use-agent.ts`
- `apps/web/src/workspace/agent/agent-stream.test.ts`
- `apps/web/src/workspace/agent/agent-surface.test.tsx`

Did not touch CRM/media/comms/auth-reset-route batches or the shared reconciliation matrix.

## CodeGraph entry

Commands/evidence:

- `codegraph sync` → already up to date.
- `codegraph_status` before work → 2163 indexed files, 23850 nodes, 51890 edges.
- `codegraph_files apps/api/src/agent` → 17 agent API files indexed.
- `codegraph_files apps/web/src/workspace/agent` → 7 web agent files indexed.
- `codegraph_context` / `codegraph_explore` used to enter agent route/provider/SSE/web stream context before file reads.

Note: CodeGraph also surfaced duplicate symbols from `.claude/worktrees/full-eval-uiux`; source reads were restricted to real workspace paths under `apps/api/src/agent` and `apps/web/src/workspace/agent`.

## Current behavior evidenced

### No-provider degraded mode

Current API behavior is explicit, not silent mock success:

- `GET /api/workspace/agent/tools` returns provider status. With no keys it reports `{ model: "mock-llm", live: false, configured: false }`.
- `POST /api/workspace/agent/propose` returns `503 { error: "agent_provider_not_configured", provider: ... }` when provider is not configured.
- `POST /api/workspace/agent/propose/stream` returns the same `503` JSON before opening SSE.
- Web `AgentSurface` blocks send when `provider.configured === false` and shows a degraded message instead of presenting fake LLM output as real.

Covered by `apps/api/src/agent/agentProviderDegraded.test.ts`.

### Configured provider / OpenRouter

Current OpenRouter adapter behavior:

- Translates internal messages to OpenAI-compatible `system`/`user`/`assistant tool_calls`/`tool` roles.
- Translates `tool_calls` back into internal `tool_use` blocks.
- Preserves usage as `{ inputTokens, outputTokens }`.
- Sends `tool_choice: "auto"` and fails non-2xx responses with `openrouter_<status>`.

Covered by `apps/api/src/agent/openRouterProvider.test.ts` using an injected fetch implementation, not a live key.

### Agent loop and SSE events

Current loop behavior:

- Analyze tools execute live through `executeAnalyze`.
- Mutation tools are only recorded as `proposedActions`; they are not applied during propose.
- Loop emits `reasoning`, `analyze`, and `proposal` events for SSE/CoT trace.
- Token budget/deadline/max-iterations stops are explicit.

Current SSE behavior:

- API stream writes event frames for `reasoning`/`analyze`/`proposal` and a final `done` event with the full result.
- Web client parses chunked SSE frames, normalizes CRLF, handles `event: error`, and fails incomplete streams with `stream_incomplete`.

Covered by `apps/api/src/agent/agentLoop.test.ts` and `apps/web/src/workspace/agent/agent-stream.test.ts`.

### Apply/reject UX

Existing production code already filters actions before execute:

- rejected changes (`status === "отклонено"`) are excluded;
- permission-blocked changes (`status === "требует прав"`) are excluded;
- already applied changes are excluded;
- only selected changes mapped through `actionMap` are sent to `execute`.

Added targeted evidence in `apps/web/src/workspace/agent/agent-surface.test.tsx`: two proposed actions are rendered, the first is rejected, then apply sends only the second action to `execute`.

## Changes made

Changed:

- `apps/web/src/workspace/agent/agent-surface.test.tsx`
  - Added `does not execute rejected actions` test for apply/reject payload filtering.

Added:

- `docs/qa/full-eval/agent-reports/agent-llm-sse-2026-07-07.md`

No production code changes were required: bounded defect found was a missing targeted UX evidence test, not runtime behavior.

## Verification commands and results

Initial `pnpm vitest ...` attempts failed before tests because the pnpm wrapper attempted install and hit ignored build scripts:

- `pnpm vitest run apps/api/src/agent/agentProviderDegraded.test.ts apps/api/src/agent/openRouterProvider.test.ts apps/api/src/agent/agentLoop.test.ts`
  - Result: blocked before Vitest by `ERR_PNPM_IGNORED_BUILDS`.
- `pnpm vitest run apps/web/src/workspace/agent/agent-stream.test.ts apps/web/src/workspace/agent/agent-surface.test.tsx`
  - Result: blocked before Vitest by `ERR_PNPM_IGNORED_BUILDS`.

Direct sandboxed Vitest also failed before tests because esbuild could not spawn under sandbox:

- `.\node_modules\.bin\vitest.CMD run ...`
  - Result: `Error: spawn EPERM` while loading `vitest.config.ts`.

Escalated direct Vitest passed:

- `.\node_modules\.bin\vitest.CMD run apps/api/src/agent/agentProviderDegraded.test.ts apps/api/src/agent/openRouterProvider.test.ts apps/api/src/agent/agentLoop.test.ts`
  - Result: 3 files passed, 15 tests passed.
  - Note: Vite emitted an unrelated duplicate-case warning in `packages/domain/src/planning/commandReducer.ts`.
- `.\node_modules\.bin\vitest.CMD run apps/web/src/workspace/agent/agent-stream.test.ts apps/web/src/workspace/agent/agent-surface.test.tsx`
  - Result: 2 files passed, 6 tests passed.

## Live provider/API SSE smoke

Updated after credentials were supplied in local ignored env:

- `.env.local` / process env provided `OPENROUTER_API_KEY` without writing the secret to evidence.
- API was started on `http://127.0.0.1:4108` with `KISS_PM_AGENT_PROVIDER=openrouter`, model `anthropic/claude-sonnet-4.6`, `KISS_PM_AGENT_MAX_TOKENS=128`, and `KISS_PM_AGENT_MAX_ITERATIONS=1`.
- Authenticated smoke covered `GET /api/workspace/agent/tools` and `POST /api/workspace/agent/propose/stream`.
- `/tools` returned provider `{ model: "anthropic/claude-sonnet-4.6", live: true, configured: true }`.
- `/propose/stream` returned `text/event-stream`, emitted `reasoning` and `done`, completed in 1 iteration, and produced no error event.

Evidence: `docs/qa/full-eval/evidence/reconciliation-2026-07-07/risk-agent-live-openrouter-api-sse-2026-07-07.json`.

## Remaining concerns

- Live provider behavior is only covered through adapter tests with injected fetch and degraded-mode tests. A real network/key smoke remains blocked until `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` is available in the API runtime environment.
- `pnpm vitest` currently triggers an install/status path that fails with `ERR_PNPM_IGNORED_BUILDS`; direct `node_modules` Vitest was used for targeted verification.
- Unrelated Vite warning remains in `packages/domain/src/planning/commandReducer.ts` duplicate `assignment.delete` case; not touched in this slice.

## Post-change CodeGraph sync / change index

Post-change commands/evidence:

- `codegraph sync` after edits → synced 1 changed file; reported `Modified: 1 - 2 nodes`.
- `codegraph_status` after sync → 2164 indexed files, 23852 nodes, 51895 edges.

Before → after global index:

- files: 2163 → 2164
- nodes: 23850 → 23852
- edges: 51890 → 51895

Touched-by-this-slice change index:

- `apps/web/src/workspace/agent/agent-surface.test.tsx`
  - Added targeted Vitest case: `does not execute rejected actions`.
  - Symbol/edge effect: test file modified; CodeGraph sync reported 2 node changes in the synced file.
- `docs/qa/full-eval/agent-reports/agent-llm-sse-2026-07-07.md`
  - Added QA report; markdown report is not part of the TypeScript symbol graph.

Caveat: the workspace is concurrently dirty with unrelated auth/e2e/marketing files. The global CodeGraph file-count delta may include that existing workspace drift; the only source file changed by this slice is the agent surface test above.
## Final disposition

DONE_WITH_CONCERNS: configured-provider degraded behavior, OpenRouter adapter translation, agent loop/SSE parsing, apply/reject filtering, live OpenRouter direct provider smoke, and authenticated API SSE smoke are covered. Browser UI proposal/apply traversal remains open.
## Orchestrator verification after integration

- `cmd /c "node_modules\.bin\vitest.cmd run apps/api/src/agent/agentProviderDegraded.test.ts apps/api/src/agent/openRouterProvider.test.ts apps/api/src/agent/agentLoop.test.ts"`
  - Result: passed; 3 files passed; 15 tests passed.
- `cmd /c "node_modules\.bin\vitest.cmd run apps/web/src/workspace/agent/agent-stream.test.ts apps/web/src/workspace/agent/agent-surface.test.tsx"`
  - Result: passed; 2 files passed; 6 tests passed.
- `corepack pnpm --filter @kiss-pm/web typecheck`
  - Result: passed.
- Provider env/API SSE check after credentials were supplied:
  - OpenRouter secret loaded from ignored env; value not written to evidence.
  - /api/workspace/agent/tools provider status: live/configured, model anthropic/claude-sonnet-4.6.
  - /api/workspace/agent/propose/stream: reasoning + done, no error event.

Updated final status: local degraded/provider-adapter/loop/SSE/parser/apply-filter evidence is complete for this bounded slice. Real provider smoke and authenticated API SSE now pass with supplied OpenRouter env; live browser SSE proposal/apply traversal remains open and is not counted as passed.