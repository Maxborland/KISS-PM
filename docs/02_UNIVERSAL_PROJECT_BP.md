# KISS PM — Universalized Project Business Process

## 1. Purpose

This document converts the current company-specific project-management business processes into a universal, configurable project-delivery lifecycle suitable for a SaaS platform.

The goal is not to remove domain expertise. The goal is to package it into reusable templates that a tenant can rename, reorder, disable, extend, and tune without code changes.

## 2. Core concept

A project lifecycle is a configurable process template. Each tenant can define its own labels, roles, stage gates, artifacts, KPI thresholds, and management actions.

The universal lifecycle is:

```txt
S0 CRM Opportunity / Intake
S1 Contract / Project Authorization
S2 Project Startup and Preparation
S3 Discovery / Briefing
S4 Concept / Preliminary Design
S5 Design Development / Visualization / Estimate
S6 Detailed Production / Working Documentation
S7 Parallel Discipline Packages
S8 Delivery, Closure, and Retrospective

Cross-cutting process: KPI, resource, risk, quality, and decision control
```

For an architecture/design tenant, these stages may be labeled with familiar names such as contract, preparation, briefing, concept/GZMPK, sketch, RDP, GP, completion. For another tenant, the same stage templates may display different names.

## 3. Universal terminology

| Universal term | Meaning | Tenant-specific example |
|---|---|---|
| Tenant | Client organization using the SaaS | Studio, bureau, project office |
| Opportunity | Potential project before authorization | CRM deal, lead, proposal |
| Project Intake | Controlled process of turning opportunity into project | Deal analysis, startup request |
| Project Principal | Accountable project leader | ГАП, Project Lead, Principal Architect |
| Project Manager | Coordination and client/project administration role | ПМ |
| Resource Manager | Capacity/resource control role | РМ |
| Stage Lead | Lead responsible for a stage or discipline | РКГ, РПГ, Discipline Lead |
| Specialist | Executor role | Architect, designer, engineer, visualizer, estimator |
| Control Surface | Interactive management instrument | Portfolio, resource load, KPI deviations |
| Control Signal | Detected risk/deviation/decision point | Overload, KPI breach, late stage |
| Management Action | Governed action from a control surface | Reassign, shift, create task, escalate |
| Corrective Action | Tracked action to close a deviation | Fix task, replan action |
| Artifact | Deliverable or document | Album, estimate, brief, drawing package |
| Stage Gate | Entry/exit control for a stage | Approval, checklist, acceptance |

## 4. Role template model

Roles are templates, not hardcoded job titles.

| Role template | Universal responsibility | Possible labels |
|---|---|---|
| Business Development / Sales | Commercial opportunity and client negotiation before project start | Sales Manager, МП |
| Project Manager | Client communication, documents, commitments, dates, coordination | ПМ |
| Project Principal | Overall project quality, team decisions, stage ownership, escalation | ГАП, Lead Architect |
| Resource Manager | Capacity, overloads, forecasts, resource conflicts, feasibility | РМ, Operations Manager |
| Stage Lead | Plans and accepts work for a stage or discipline | РКГ, РПГ, Discipline Lead |
| Quality Lead | Controls quality criteria and acceptance | QA Lead, РКГ |
| Specialist | Performs work packages | Architect, engineer, designer, visualizer |
| Estimator / Analyst | Cost, estimate, commercial/technical calculations | Сметчик |
| Client Representative | Reviews and accepts client-facing deliverables | Client |
| Tenant Admin | Configures system, access, templates, fields, KPI | Admin |

A tenant may rename these roles or create additional role templates. Core domain logic must use stable system keys and not the displayed label.

## 5. Universal lifecycle overview

```txt
Opportunity created
  -> intake readiness check
  -> demand/capacity assessment
  -> commercial/project authorization
  -> project draft
  -> startup plan and baseline
  -> discovery/brief
  -> concept/preliminary work
  -> design development
  -> detailed production
  -> parallel packages if needed
  -> delivery and closure
  -> retrospective snapshot
  -> template/process improvement
```

Each stage has:

- entry criteria;
- responsible roles;
- activities;
- artifacts;
- KPI/control checks;
- available management actions;
- exit criteria.

## 6. S0 — CRM Opportunity / Intake

### Objective

Capture a potential project, determine whether it is ready for analysis, estimate delivery demand, and decide whether the organization can commit capacity and timing.

### Entry criteria

- Opportunity exists.
- Client/account/contact is identified or intentionally marked unknown.
- Project type, category, expected value, desired dates, and scope hints are captured where available.

### Responsible roles

- Business Development / Sales.
- Project Manager or intake coordinator.
- Resource Manager for capacity feasibility.
- Project Principal or Stage Lead for professional validation when needed.

### Activities

1. Register opportunity.
2. Collect minimum intake fields.
3. Match opportunity to process/project template.
4. Estimate demand by stage and role.
5. Check delivery capacity for expected date window.
6. Identify blockers and missing data.
7. Decide: request more data, reserve capacity, create project draft, defer, reject, or accept risk.

### Artifacts

- Opportunity card.
- Intake checklist.
- Demand projection.
- Capacity feasibility result.
- Intake decision.
- Optional commercial proposal or preliminary estimate.

### Control surfaces

- CRM Intake Control.
- Capacity Feasibility Control.
- Opportunity Blockers Control.

### Management actions

- Request missing data.
- Run demand estimate.
- Run capacity check.
- Reserve capacity.
- Create project draft.
- Assign Project Principal.
- Defer opportunity.
- Accept risk with reason.

### Exit criteria

- Opportunity has a decision.
- If project proceeds, project draft exists and is linked to opportunity.
- Capacity assumptions and risks are recorded.

## 7. S1 — Contract / Project Authorization

### Objective

Convert a qualified commercial opportunity into an authorized project commitment.

### Entry criteria

- Opportunity is qualified.
- Commercial scope and expected obligations are sufficiently clear.
- Capacity feasibility is reviewed or risk is accepted.

### Responsible roles

- Business Development / Sales.
- Project Manager.
- Project Principal.
- Resource Manager where capacity is constrained.
- Client Representative where applicable.

### Activities

1. Confirm scope, commercial terms, and planned dates.
2. Confirm process template and project type.
3. Confirm key roles.
4. Record contract/authorization status.
5. Create project draft or activate existing draft.
6. Start project startup stage.

### Artifacts

- Contract or project authorization record.
- Commercial scope summary.
- Project charter/startup card.
- Initial role assignments.

### Control surfaces

- Contract / Authorization Control.
- CRM Intake Control.
- Portfolio Drafts Control.

### Management actions

- Create active project.
- Assign key roles.
- Link or upload contract/authorization artifact.
- Create startup tasks.
- Re-run capacity feasibility.
- Flag commercial/delivery risk.

### Exit criteria

- Project is authorized or explicitly rejected/deferred.
- If authorized, project has owner/principal, manager/coordinator, process template, and initial timeline assumptions.

## 8. S2 — Project Startup and Preparation

### Objective

Prepare the project for controlled execution: clarify input data, define initial plan, create baseline draft, allocate roles, and validate resources.

### Entry criteria

- Project is authorized or approved as a draft for planning.
- Project template is selected.
- Key roles are assigned or intentionally pending.

### Responsible roles

- Project Principal.
- Project Manager.
- Resource Manager.
- Stage Leads.

### Activities

1. Verify initial project data and constraints.
2. Create or refine project plan/Gantt draft.
3. Define WBS/stage tasks from templates.
4. Assign roles and initial resources.
5. Validate planned dates, work, and capacity.
6. Set initial KPI targets and thresholds.
7. Create baseline draft when plan is accepted.

### Artifacts

- Startup checklist.
- Initial Gantt/project plan.
- Resource allocation/reservation.
- Baseline draft.
- Risk list.
- KPI target set.

### Control surfaces

- Project Startup Control.
- Resource Load Control.
- Portfolio Control.
- KPI Setup Control.

### Management actions

- Generate stage tasks from template.
- Adjust dates.
- Assign or reserve resources.
- Create risk/corrective task.
- Approve baseline draft.
- Request missing input data.

### Exit criteria

- Plan is feasible or risks are accepted.
- Required startup artifacts are present.
- Project can enter discovery/briefing or equivalent first delivery stage.

## 9. S3 — Discovery / Briefing

### Objective

Collect and approve the project brief, requirements, constraints, and decision context needed for delivery.

### Entry criteria

- Startup plan exists.
- Client and internal stakeholders are identified.
- Required source materials are available or missing data is tracked.

### Responsible roles

- Project Manager.
- Project Principal.
- Client Representative.
- Stage Lead if applicable.

### Activities

1. Transfer source materials to the project team.
2. Correct or enrich source materials where needed.
3. Conduct internal briefing.
4. Conduct client briefing where applicable.
5. Record decisions and constraints.
6. Produce project brief/technical assignment.
7. Approve brief internally and/or with client.

### Artifacts

- Briefing notes.
- Project brief / technical assignment.
- Source data register.
- Decision log.
- Approval record.

### Control surfaces

- Briefing Readiness Control.
- Project Delivery Control.
- Artifact Control.

### Management actions

- Request missing source data.
- Create follow-up task.
- Create approval request.
- Assign owner for unresolved requirement.
- Mark blocker.
- Approve stage gate.

### Exit criteria

- Brief/requirements are approved or risks are accepted.
- All critical missing data is resolved or tracked.
- Next delivery stage can start.

## 10. S4 — Concept / Preliminary Design

### Objective

Produce the first structured solution concept or preliminary design package and validate direction before detailed development.

### Entry criteria

- Brief/requirements are approved.
- Concept-stage tasks and responsible roles are created.
- Required source materials exist.

### Responsible roles

- Stage Lead.
- Project Principal.
- Specialists.
- Quality Lead where applicable.

### Activities

1. Plan stage work.
2. Assign analysis/research tasks.
3. Create concept materials.
4. Review concept internally.
5. Revise if needed.
6. Prepare concept/preliminary package.
7. Approve package internally and/or with client.

### Artifacts

- Concept board / preliminary package.
- Analysis materials.
- Internal review record.
- Client presentation/approval where applicable.

### Control surfaces

- Stage Control.
- Portfolio Control.
- KPI Deviation Control.
- Artifact Control.

### Management actions

- Create rework task.
- Approve/reject artifact.
- Escalate quality conflict.
- Open project Gantt.
- Adjust plan.
- Request client decision.

### Exit criteria

- Concept/preliminary package is accepted.
- Rework is closed or accepted as risk.
- Stage KPI and artifact requirements are met.

## 11. S5 — Design Development / Visualization / Estimate

### Objective

Develop the approved concept into a more detailed client-facing or internally accepted project package, including visualization, estimates, and quality validation where relevant.

### Entry criteria

- Concept/preliminary direction is accepted.
- Stage plan and resource assignments exist.
- Inputs for development, visualization, estimate, or analysis are present.

### Responsible roles

- Stage Lead.
- Project Principal.
- Specialists.
- Estimator/Analyst.
- Client Representative where applicable.

### Activities

1. Create detailed stage tasks.
2. Prepare creative/technical assignments.
3. Produce design or analytical outputs.
4. Produce visualizations or supporting materials where applicable.
5. Produce preliminary estimate or cost model where applicable.
6. Assemble stage package.
7. Review and approve package.

### Artifacts

- Developed design/stage package.
- Visual materials where applicable.
- Estimate/cost model where applicable.
- Review comments and approvals.

### Control surfaces

- Stage Delivery Control.
- Resource Load Control.
- KPI Deviation Control.
- Artifact Control.

### Management actions

- Reassign overloaded specialist.
- Split/shift work.
- Create estimate task.
- Create review task.
- Approve/reject deliverable.
- Escalate blocker.

### Exit criteria

- Stage package is approved.
- Estimate/cost constraints are checked where applicable.
- KPI deviations are closed, accepted, or escalated.

## 12. S6 — Detailed Production / Working Documentation

### Objective

Produce detailed project deliverables, documentation, or work packages required for final delivery.

### Entry criteria

- Previous stage package is accepted.
- Production tasks and responsibilities are defined.
- Required standards/checklists are available.

### Responsible roles

- Stage Lead / Discipline Lead.
- Project Principal.
- Specialists.
- Quality Lead.
- Estimator/Analyst where applicable.

### Activities

1. Present project context to production team.
2. Create production task packages.
3. Accept tasks into work by responsible specialists.
4. Track progress through Kanban/Gantt.
5. Review task results.
6. Assemble detailed package.
7. Produce final estimate/analysis where applicable.
8. Approve package internally and/or with client.

### Artifacts

- Detailed production package.
- Task review records.
- Final estimate/analysis.
- Quality checklist.
- Approval records.

### Control surfaces

- Project Delivery Control.
- My Work Control.
- Resource Load Control.
- KPI Deviation Control.

### Management actions

- Create/reassign production task.
- Mark task for rework.
- Open Gantt and adjust dependencies.
- Resolve overload.
- Request approval.
- Escalate quality issue.

### Exit criteria

- Detailed package is accepted.
- Required approvals and quality checks are complete.
- Project is ready for delivery/closure or parallel package completion.

## 13. S7 — Parallel Discipline Packages

### Objective

Manage additional discipline-specific or parallel workstreams that may run during several stages.

### Entry criteria

- Project template or project decision requires parallel packages.
- Package owners and dependencies are defined.

### Responsible roles

- Discipline Lead / Stage Lead.
- Project Principal.
- Specialists.
- Quality Lead.

### Activities

1. Determine whether package is required.
2. Create package tasks and dependencies.
3. Execute package work.
4. Review and approve package outputs.
5. Integrate package with main project deliverables.

### Artifacts

- Discipline package.
- Integration checklist.
- Review/approval record.

### Control surfaces

- Parallel Package Control.
- Project Gantt.
- Resource Load Control.

### Management actions

- Create package tasks.
- Adjust dependencies.
- Assign/reassign discipline lead.
- Approve/reject package.
- Escalate integration blocker.

### Exit criteria

- Required packages are complete or accepted as not applicable.
- Dependencies to main project stages are satisfied.

## 14. S8 — Delivery, Closure, and Retrospective

### Objective

Deliver final outputs, complete commercial/administrative closure, capture project results, and feed lessons into future templates.

### Entry criteria

- Required project deliverables are complete.
- Open critical tasks/blockers are closed or accepted.
- Final approval path is known.

### Responsible roles

- Project Manager.
- Project Principal.
- Resource Manager.
- Stage Leads.
- Client Representative.
- Tenant leadership where required.

### Activities

1. Present or deliver final package.
2. Collect client/internal feedback.
3. Resolve final comments or rework.
4. Complete closing documents, approvals, payments, or administrative tasks where applicable.
5. Verify final KPI values.
6. Capture quality and client satisfaction metrics.
7. Create project snapshot.
8. Run retrospective analysis.
9. Create lessons learned or template-improvement actions.

### Artifacts

- Final delivery package.
- Client/internal acceptance record.
- Closure checklist.
- Final KPI values.
- Client satisfaction/quality score.
- Closed-project snapshot.
- Retrospective notes.
- Improvement actions.

### Control surfaces

- Closure Control.
- Closed Projects Retrospective.
- KPI Deviation Control.
- Portfolio Control.

### Management actions

- Create final rework task.
- Close project.
- Capture final KPI.
- Create retrospective action.
- Update process/KPI/template recommendation.
- Archive project.

### Exit criteria

- Closure checklist is complete.
- Final snapshot exists.
- Retrospective outcome is recorded.
- Project is moved to closed portfolio.

## 15. Cross-cutting process — KPI, resource, quality, and decision control

This process runs across all stages.

### Objective

Detect deviations early, support management decisions, execute governed actions, and verify whether the action corrected the condition.

### Control loop

```txt
Measure
  -> evaluate KPI/resource/schedule/status condition
  -> create control signal if threshold/rule is triggered
  -> expose signal in relevant control surface
  -> authorized user selects management action
  -> system validates and previews where needed
  -> action executes as governed command
  -> audit/event/projection update
  -> repeat measurement
```

### Controlled dimensions

- Schedule: planned vs actual dates, stage delay, critical deadlines.
- Work: planned vs actual work, workload forecast, progress vs plan.
- Resource: utilization, overloads, too many concurrent projects, role shortages.
- Financial/economic: target rate, cost, margin, budget deviation.
- Quality: artifact acceptance, rework, quality score, client satisfaction.
- Process: missing approvals, overdue stage gates, missing source data.
- CRM intake: readiness, capacity feasibility, missing fields, unrealistic promised dates.

### Severity model

Default severity:

```txt
normal     — condition is acceptable
attention  — user should review or plan corrective action
critical   — action or explicit accepted risk is required
```

Tenants may rename severity labels and tune thresholds.

### Allowed management actions

- Create task.
- Create corrective action.
- Open project Gantt.
- Adjust task dates.
- Split work.
- Reassign participant/resource.
- Reserve capacity.
- Request explanation.
- Request approval.
- Escalate.
- Accept deviation/risk with reason.
- Change stage status.
- Update template/KPI recommendation.

### Exit criteria for each control signal

A control signal is complete only when:

- condition returned to normal; or
- corrective action is closed and verified; or
- authorized user accepted the risk/deviation with reason; or
- signal was superseded by a newer signal with traceability.

## 16. Universal stage template schema

Every stage template should be expressible as data:

```txt
StageTemplate
- id
- tenantId
- processTemplateId
- systemKey
- defaultLabel
- tenantLabel
- description
- sequenceMode: sequential | parallel | optional | conditional
- entryCriteria[]
- exitCriteria[]
- requiredRoleTemplates[]
- requiredArtifactTemplates[]
- taskTemplates[]
- approvalTemplates[]
- defaultKpiDefinitions[]
- availableActions[]
- controlSurfaceRefs[]
- estimatedDurationRule
- estimatedWorkRule
- dependencies[]
- active
- version
```

## 17. Universal process-template rules

- A tenant can rename stages without changing system keys.
- A tenant can disable optional stages.
- A tenant can add custom stages.
- A tenant can change required artifacts and approvals.
- A tenant can tune KPI thresholds per stage.
- A tenant can define who can perform actions at a stage.
- Runtime projects should keep a reference to the template version used at project creation.
- Updating a template must not silently rewrite active project history unless an explicit migration/action is run.

## 18. Mapping from current process language to universal process language

| Current process | Universal stage/process |
|---|---|
| Заключение контракта | Contract / Project Authorization |
| Подготовительная стадия | Project Startup and Preparation |
| Брифинг | Discovery / Briefing |
| ГЗМПК | Concept / Preliminary Design |
| Эскиз | Design Development / Visualization / Estimate |
| РДП | Detailed Production / Working Documentation |
| ГП / Схемы + Ведомости | Parallel Discipline Packages |
| Завершение проекта | Delivery, Closure, and Retrospective |
| Контроль показателей | Cross-cutting KPI/resource/quality/decision control |

This mapping is a seed template only. It must not be hardcoded as the only supported lifecycle.
