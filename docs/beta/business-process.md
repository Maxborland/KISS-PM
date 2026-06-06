# KISS PM Beta Business Process

KISS PM beta is not a generic task tracker. The beta target is a project operations cockpit for an architecture bureau: sales intake, project planning, execution control, workload visibility, risk recovery, and safe agent-assisted operations.

## Beta North Star

A real architecture bureau team can create a client/deal/project, plan the work, assign people, see schedule and workload risk, recover problem areas, and use the agent as a controlled operations layer without the founder explaining every screen.

## Simplified End-to-End Process

1. Lead and client intake
   - Sales captures a client, lead source, initial request, scope notes, deadlines, and next action.
   - CEO and sales can see whether the incoming work is worth pursuing.

2. Deal qualification
   - Sales tracks stage, probability, budget range, expected start, blockers, responsible person, and next contact.
   - Finance/accounting can see whether commercial terms are clear enough for contract/invoice work when that is in beta scope.

3. Handoff to project
   - A won deal becomes a project with a named project manager, project lead, expected dates, initial scope, and team assumptions.
   - The handoff must preserve context: client, deal notes, commitments, deadlines, and risks.

4. Project kickoff
   - Project manager defines milestones, work packages, task groups, owners, due dates, and first execution plan.
   - Project lead validates technical/project-team feasibility.

5. Execution
   - Line specialists see their tasks, priorities, deadlines, blockers, comments, and materials.
   - Project manager sees progress, overdue work, blocked tasks, owner load, and project timeline.

6. Risk and change control
   - Users can mark blockers, deadline risk, scope change, client decision dependency, and overloaded owners.
   - CEO/project manager can see cross-project attention items and decide what to recover first.

7. Resource and HR visibility
   - HR/resource manager sees people, roles, load, availability, and overload signals.
   - Beta does not need full HRIS, but it must not hide workload risk.

8. Finance and closeout
   - Accountant/finance sees payment/contract/budget status if finance is included in the active slice.
   - Project closeout records final state, unresolved risks, and delivery status.

9. Agent operations
   - Agent reads the same operational context as the current screen/project.
   - Agent can summarize, diagnose, and propose structured actions.
   - Agent never mutates production data without explicit confirmation and visible result/audit trail.

## Core Roles

- CEO / owner: business picture, project risk, revenue/contract/payment visibility, overloaded teams, escalations.
- Sales: leads, clients, deals, next actions, handoff quality.
- Project Manager: project plan, timeline, tasks, statuses, owners, blockers, recovery actions.
- Project Lead / Team Lead: execution feasibility, team quality, technical blockers, specialist coordination.
- Line Specialist: own tasks, due dates, priorities, blockers, comments, materials.
- HR / Resource Manager: people, roles, load, availability, overload and replacement signals.
- Admin / Office: documents, access, organizational tasks, routine coordination.
- Accountant / Finance: invoices, payment statuses, contracts, budgets and financial blockers where in scope.

## Beta Scope Rule

A feature is beta-critical only if it helps at least one of these outcomes:

- manage a real project;
- see risk, deadline, load, or blocker state;
- move work safely through a controlled agent-assisted operation;
- prove that a screen is production-grade through a repeatable readiness gate.

Everything else is parked unless it blocks one of those outcomes.

## Non-Goals for Beta

- Full enterprise ERP.
- Perfect MS Project parity.
- Full HR, accounting, or document management suite.
- Agent autonomy without confirmation.
- Decorative UI polish that does not improve operational clarity.

