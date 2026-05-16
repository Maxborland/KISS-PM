# Task: 0001-verify-agent-bus - Verify agent coordination system

Status: backlog
Priority: high
Owner / claimed by: unclaimed

## Goal

Verify that the `.agent-bus/` coordination system is understandable, versionable, and safe for future concurrent Codex agents.

## Context

The repository may be worked on by multiple Codex instances in parallel. The coordination system must help agents read project state, claim work, lock risky files, hand off progress, and avoid breaking existing KISS PM phase discipline.

Relevant files:

- `AGENTS.md`
- `.agent-bus/README.md`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/tasks/TEMPLATE.md`
- `.agent-bus/claims/EXAMPLE.claim.json.template`
- `.agent-bus/handoff/TEMPLATE.md`
- `.gitignore`

## Scope

- Read the `.agent-bus/` protocol from a fresh-agent perspective.
- Confirm startup, task claim, lock, handoff, event, and completion routines are documented.
- Confirm runtime files are ignored and durable files are not ignored.
- Confirm existing project rules in `AGENTS.md` remain intact.
- Document any unclear parts as follow-up tasks or open questions.

## Out Of Scope

- Implementing Phase 4 product functionality.
- Refactoring application code.
- Introducing external coordination services or dependencies.
- Building a full agent framework.

## Acceptance Criteria

- [ ] A future agent can identify what to read first.
- [ ] Task claiming is documented and includes stale-claim policy.
- [ ] Risky-file locking is documented and recommends atomic directory creation.
- [ ] Handoff format is documented.
- [ ] Event logging format is documented.
- [ ] `.gitignore` ignores runtime coordination files but preserves durable docs/templates.
- [ ] No existing KISS PM product, phase, or verification rules were removed.
- [ ] Verification commands and results are recorded in the handoff note or task update.

## Files Likely Affected

- `.agent-bus/**`
- `AGENTS.md`
- `.gitignore`

## Required Tests

- `git status --short`
- `git check-ignore -v .agent-bus/claims/example.claim.json`
- `git check-ignore -v .agent-bus/events/events.jsonl`
- `git check-ignore -v .agent-bus/README.md` should return no ignore rule
- Markdown readability spot checks with `sed` or equivalent

## Risks

- Existing uncommitted Phase 4 work could be confused with agent-bus setup.
- Runtime ignore rules could accidentally hide durable templates.
- Future agents may skip the protocol unless `AGENTS.md` is explicit.

## Handoff Notes

Unclaimed. First verifier should create `.agent-bus/claims/0001-verify-agent-bus.claim.json` before making any follow-up edits.
