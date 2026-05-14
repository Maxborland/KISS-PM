# Phase <N> — <Name>

## 1. Phase objective

Describe the concrete outcome of this phase in one paragraph.

## 2. Source documents

List the source-of-truth docs for this phase.

## 2.1 Scope lock

State whether the phase scope is `draft`, `frozen`, or `changed-by-decision`. Implementation may start only after scope is frozen. Any later scope change must reference a decision record.

## 2.2 KISS PM simplicity target

Describe how this phase keeps the user workflow simple while preserving strict domain rules, verification, and audit.

## 3. Functional scope

Closed scope only. No vague tasks.

| ID | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification |
|---|---|---|---|---|---|
| P<N>-001 |  |  |  |  |  |

## 4. Non-scope

List what must not be implemented in this phase.

## 5. Domain model changes

List entities, value objects, commands, events, DTOs, invariants.

## 6. API contracts

List endpoints, request/response DTOs, permissions, errors.

## 7. UI surfaces

List pages/components, user roles, states, empty/error/loading states.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E- |  |  |  |  | planned |

## 9. Unit and integration tests

List required non-E2E tests for domain algorithms, API behavior, permissions, and data integrity.

## 10. Test data and fixtures

Describe deterministic seed data and reset rules.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope implemented.
- [ ] Mandatory E2E scenarios implemented and passing.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Permissions enforced at backend/application layer.
- [ ] Audit trail added for management actions.
- [ ] Docs updated.
- [ ] Risks and follow-ups recorded.

## 12. Risks and decisions

Record assumptions, tradeoffs, and decision records.
