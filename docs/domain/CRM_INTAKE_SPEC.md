# CRM Intake Spec

## 1. Purpose

CRM intake is the start of the KISS PM project-control lifecycle. It is not a separate sales-only module. It converts opportunity information into delivery feasibility, project drafts, capacity reservations, and controlled decisions.

## 2. Core responsibilities

- Manage client accounts and contacts.
- Manage opportunities with tenant-configurable stages and fields.
- Check intake readiness.
- Match opportunity to process/project template candidates.
- Estimate demand by stage, role, period, and confidence.
- Run capacity feasibility using resource planning contracts.
- Record blockers and decisions.
- Create project drafts and reservations through governed commands.

## 3. Entity model

```txt
Opportunity
- id
- tenantId
- clientAccountId
- primaryContactId
- stageKey
- title
- expectedValue
- probability
- plannedStart
- desiredFinish
- categoryKey
- scopeHints
- customFields
- externalMappingRefs[]
- createdAt
- updatedAt

ProjectIntake
- id
- tenantId
- opportunityId
- readinessStatus
- templateCandidateRefs[]
- demandProjectionId
- capacityAssessmentId
- blockers[]
- decisions[]
- status
```

## 4. Readiness blockers

Initial blocker categories:

- missing required client/contact data;
- missing planned dates;
- missing category/typology;
- missing scope hints;
- no matching process template;
- insufficient confidence for demand estimate;
- insufficient role capacity;
- conflicting reservation;
- unrealistic date window;
- permission required for risk acceptance.

## 5. Demand projection

Demand projection should be expressible as:

```txt
DemandProjection
- opportunityId
- processTemplateVersion
- scenario: p50 | p75 | manual
- stageDemands[]
- roleDemands[]
- periodBuckets[]
- assumptions[]
- confidence
```

Demand estimates can come from tenant templates, historical retrospectives, or manual input in later phases. Phase 3 may use deterministic template-based estimates.

## 6. Capacity feasibility

Capacity assessment uses resource planning contracts. It should not embed resource-load algorithms in CRM code.

```txt
CapacityAssessment
- demandProjectionId
- period
- roleCapacityResults[]
- resourceConflicts[]
- reservationOptions[]
- severity
- explanation
```

## 7. Governed decisions

Allowed intake decisions:

- request more data;
- run demand estimate;
- run capacity check;
- reserve capacity;
- create project draft;
- defer opportunity;
- reject opportunity;
- accept risk with reason;
- convert approved/won opportunity into active project.

Risk acceptance, reservation, and project creation are state-changing management actions and must route through the action/application layer.

## 8. Invariants

- Project created from opportunity references the opportunity but remains valid without a live CRM adapter.
- External CRM stages and fields map to canonical opportunity fields through adapters/mappings.
- Tenant-specific stage labels live in configuration.
- Intake decisions are auditable.
- Readiness and feasibility are explainable to users.

