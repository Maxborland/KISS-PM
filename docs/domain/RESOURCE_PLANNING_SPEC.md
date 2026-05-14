# Resource Planning Spec

## 1. Purpose

Resource planning forecasts capacity, detects overloads, supports reservations, and enables governed resolution actions. It connects CRM intake, scheduling, tasks, control signals, and management actions.

## 2. Core responsibilities

- Define resource profiles and capacity.
- Model calendars and availability exceptions.
- Create assignments and reservations.
- Calculate load by period.
- Detect overloads and insufficient role capacity.
- Provide resolution previews.
- Execute approved resolution actions through the action engine/application layer.

## 3. Entity model

```txt
ResourceProfile
- id
- tenantId
- type: person | role | team | placeholder
- userId
- roleKeys[]
- skillTags[]
- calendarId
- active

ResourceCapacity
- resourceProfileId
- periodStart
- periodEnd
- availableHours

ResourceReservation
- id
- tenantId
- sourceType: opportunity | project | stage
- sourceId
- roleKey
- periodStart
- periodEnd
- reservedHours
- status

ResourceAssignment
- id
- tenantId
- taskId
- resourceProfileId
- roleKey
- plannedWorkHours
- periodStart
- periodEnd
```

## 4. Load bucket model

```txt
ResourceLoadBucket
- tenantId
- resourceProfileId
- periodStart
- periodEnd
- capacityHours
- assignedHours
- reservedHours
- loadPercent
- severity
- sourceRefs[]
```

## 5. Overload model

```txt
ResourceOverload
- id
- tenantId
- resourceProfileId or roleKey
- periodStart
- periodEnd
- severity
- overloadHours
- sourceRefs[]
- recommendedActionKeys[]
- status
```

## 6. Resolution actions

Initial resolution actions:

- shift task dates;
- split planned work;
- reassign resource;
- reserve capacity;
- reduce/adjust assignment;
- escalate;
- accept risk with reason.

Risky resolution actions require dry-run preview.

## 7. Dry-run preview

```txt
ResolutionPreview
- actionKey
- targetRefs[]
- beforeLoadBuckets[]
- afterLoadBuckets[]
- scheduleEffects[]
- warnings[]
- blockers[]
- auditSummary
- canConfirm
```

## 8. Invariants

- Load calculations are deterministic.
- Assignments reference canonical tasks.
- Reservations can originate from CRM intake or project planning.
- Applying a resolution writes audit/action logs.
- Accepted overload/risk links to the source signal and reason.
- Resource planning does not create a separate task model.

