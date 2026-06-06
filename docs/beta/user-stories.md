# KISS PM Beta User Stories

Each user story is accepted only when its screen, data contract, visible states, permissions, and QA proof are named. Stories are intentionally business-process-first, not route-first.

## CEO / Owner

### CEO-01: Portfolio risk overview

As a CEO, I need to see which active projects are late, blocked, overloaded, or financially risky, so I can intervene before the client escalation.

Acceptance criteria:
- Screen: portfolio/dashboard or control surface.
- Data: active projects, milestone dates, overdue tasks, blockers, owner/team load, financial status if available.
- States: empty portfolio, no risks, loading, API error, permission denied.
- Actions: open project, filter by risk type, assign/review recovery action.
- QA proof: Playwright smoke verifies at-risk project appears after seeded risk data.

### CEO-02: Business pipeline clarity

As a CEO, I need to see deal pipeline state and likely project starts, so I can understand future workload and revenue pressure.

Acceptance criteria:
- Screen: deals/pipeline.
- Data: deal stage, probability, expected start, client, owner, budget range if available.
- Actions: open deal, move stage if allowed, inspect handoff readiness.
- QA proof: contract test verifies deals read model does not require unused catalogs.

### CEO-03: Agent summary of urgent attention

As a CEO, I need to ask the agent what needs attention today, so I can get a prioritized operational view without manually opening every project.

Acceptance criteria:
- Agent context: current workspace and accessible projects.
- Output: grounded list with project links, reason, severity, and proposed next action.
- Safety: no mutation without confirmation.
- QA proof: mocked agent/tool test verifies grounded answer and no write call.

## Sales

### SALES-01: Lead and client capture

As a sales user, I need to create a client and deal with request notes and next action, so the opportunity is not lost in chat or memory.

Acceptance criteria:
- Screen: clients/deals create flow.
- Required fields: client name, deal title, owner, stage, next action.
- States: validation errors, duplicate client hint, save error.
- QA proof: Playwright create deal flow.

### SALES-02: Deal stage management

As a sales user, I need to move a deal across stages and keep next action visible, so pipeline status remains operational.

Acceptance criteria:
- Screen: deals board/list.
- Actions: change stage, update next action/date, open details.
- Data: persisted stage and activity/audit entry.
- QA proof: Playwright stage change persists after reload.

### SALES-03: Handoff to project

As a sales user, I need to hand off a won deal into a project with context preserved, so project managers do not restart discovery from zero.

Acceptance criteria:
- Screen: deal detail / create project from deal.
- Data carried: client, scope notes, dates, commitments, risks, contacts.
- QA proof: API/read-model test verifies project has handoff context.

## Project Manager

### PM-01: Create a project plan

As a project manager, I need to create milestones and tasks with owners and due dates, so the team has a working plan.

Acceptance criteria:
- Screen: project detail/planning workspace.
- Actions: add milestone, add task, assign owner, set date, set status.
- States: empty project, validation errors, save error.
- QA proof: Playwright create project -> add tasks -> reload -> verify state.

### PM-02: Recover overdue work

As a project manager, I need to see overdue tasks and blocked milestones in one place, so I can recover schedule before escalation.

Acceptance criteria:
- Screen: project attention panel or dashboard.
- Data: overdue tasks, blocked tasks, milestone impact.
- Actions: open task, change owner/date/status, ask agent for recovery plan.
- QA proof: seeded overdue task appears in attention view.

### PM-03: Timeline and dependencies

As a project manager, I need a timeline/Gantt-like view of tasks and milestones, so I can understand schedule structure.

Acceptance criteria:
- Screen: planning/timeline.
- Data: tasks, milestones, dates, status, blockers/dependencies where supported.
- Interaction: date/status changes update project state.
- QA proof: timeline smoke verifies task renders in correct date range and state updates.

### PM-04: Agent-assisted weekly plan

As a project manager, I need the agent to propose a weekly plan from current project data, so I can turn project state into action.

Acceptance criteria:
- Agent context: current project, tasks, owners, dates, blockers.
- Output: structured proposal with tasks/actions.
- Safety: user confirms before creating/updating tasks.
- Audit: accepted changes are visible in activity log.
- QA proof: Playwright agent proposal -> confirm -> entity changed -> audit visible.

## Project Lead / Team Lead

### LEAD-01: Team execution view

As a project lead, I need to see team tasks, blockers, and overloaded specialists, so I can coordinate execution quality.

Acceptance criteria:
- Screen: project team/workload view.
- Data: specialists, tasks, due dates, blockers, load hints.
- Actions: filter by person/status, open task, mark blocker.
- QA proof: seeded overloaded specialist appears with clear signal.

### LEAD-02: Feasibility check during kickoff

As a project lead, I need to review project scope, milestones, and resource assumptions during kickoff, so unrealistic plans are caught early.

Acceptance criteria:
- Screen: project kickoff/planning.
- Actions: comment, flag risk, adjust milestone/task assumptions if allowed.
- QA proof: risk flag persists and appears in PM/CEO attention surfaces.

## Line Specialist

### SPEC-01: My work

As a line specialist, I need to see my assigned tasks with priorities, due dates, blockers, and comments, so I know what to do next.

Acceptance criteria:
- Screen: my work.
- Data: assigned tasks, status, due date, project, priority/blocker.
- Actions: update status, add comment, mark blocker.
- QA proof: Playwright verifies assigned task appears and status update persists.

### SPEC-02: Blocker reporting

As a line specialist, I need to mark a task blocked with a reason, so project leadership sees the risk early.

Acceptance criteria:
- Screen: task detail/my work.
- Required fields: blocker reason.
- Visibility: blocker appears in project and attention views.
- QA proof: blocker created by specialist appears for PM.

## HR / Resource Manager

### HR-01: Workload visibility

As an HR/resource manager, I need to see people load and availability, so staffing risks are visible before deadlines fail.

Acceptance criteria:
- Screen: resources/workload.
- Data: people, roles, active task count or effort/load signal, availability if available.
- States: no people, missing availability data, loading/error.
- QA proof: seeded overload appears with person and linked projects.

### HR-02: Role coverage

As an HR/resource manager, I need to see projects missing key roles, so staffing gaps can be fixed.

Acceptance criteria:
- Screen: project/resources view.
- Data: required roles, assigned people, missing roles.
- QA proof: missing role appears in project attention state.

## Admin / Office

### ADMIN-01: Operational task support

As an admin, I need to track organizational tasks connected to projects, so documents, accesses, meetings, and routine coordination do not disappear.

Acceptance criteria:
- Screen: project tasks or admin work queue.
- Data: project, task type, owner, due date, status.
- QA proof: admin task can be created and filtered.

## Accountant / Finance

### FIN-01: Payment and contract status visibility

As an accountant, I need to see contract/payment status connected to projects or deals, so financial blockers are visible to project leadership.

Acceptance criteria:
- Screen: deal/project finance section if finance is in scope.
- Data: contract status, invoice/payment status, budget range or amount if available.
- Permissions: finance fields hidden or read-only for roles without access.
- QA proof: permission test verifies unauthorized role cannot see restricted finance data.

## Cross-Role Agent Stories

### AGENT-01: Context-grounded answer

As any user, I need the agent to answer from the current screen/project context, so it does not produce generic advice disconnected from app data.

Acceptance criteria:
- Agent receives current entity id, route, role, visible read model, and allowed actions.
- Answer cites concrete app entities by name/link.
- QA proof: mocked context test rejects answer without entity references.

### AGENT-02: Confirmed mutation

As any user, I need every agent write action to require confirmation, so production data cannot be changed accidentally.

Acceptance criteria:
- Agent proposes action as structured diff.
- User confirms explicitly.
- Mutation runs only after confirmation.
- Result and audit entry are visible.
- QA proof: negative test proves no mutation before confirmation.

