# Microsoft Project internals: a complete reimplementation specification

**This document is a comprehensive technical specification of how Microsoft Project handles tasks internally**, covering every formula, recalculation rule, behavioral nuance, and edge case needed to reimplement MS Project's core scheduling engine in code. It consolidates data from Microsoft's official documentation, XML schema definitions, MVP technical analyses, and the MPXJ open-source library.

---

## 1. Task data model and field reference

Every task in MS Project is a record with approximately **130+ built-in fields** plus custom fields. Below are all core fields grouped by category, with data types, defaults, and editability.

### Identity and structure fields

| Field | Data Type | Default | Editable | Notes |
|-------|-----------|---------|----------|-------|
| **UID** (Unique ID) | Integer | Auto-increment | Read-only | Monotonically increasing; never reused after deletion |
| **ID** | Integer | Sequential (1,2,3…) | Read-only | Position-based; renumbers on insert/delete/move |
| **Name** | String (max 512) | Empty | Yes | Task name |
| **Type** | Enum (0,1,2) | 0 (Fixed Units) | Yes | 0=Fixed Units, 1=Fixed Duration, 2=Fixed Work |
| **WBS** | String | Auto ("1.2.3") | With custom codes | Work Breakdown Structure code |
| **OutlineNumber** | String | Auto-calculated | Read-only | Always reflects current hierarchy position |
| **OutlineLevel** | Integer | 1 | Via indent/outdent | 0=Project Summary Task, 1+=task levels |
| **Priority** | Integer (0–1000) | 500 | Yes | 0=lowest, 1000=Do Not Level |
| **Active** | Boolean | true | Yes | Project 2010+; inactive tasks excluded from scheduling |
| **Summary** | Boolean | false | Read-only | true when task has indented children |
| **Milestone** | Boolean | false | Calculated/manual | true when Duration=0; can also be manually forced |
| **Critical** | Boolean | Calculated | Read-only | true when TotalSlack ≤ criticalSlackThreshold |

### Scheduling and date fields

| Field | Data Type | Default | Editable | Notes |
|-------|-----------|---------|----------|-------|
| **Start** | DateTime | Project Start Date | Calculated (auto) / Yes (manual) | Setting this on auto-scheduled task creates SNET constraint |
| **Finish** | DateTime | Calculated | Calculated (auto) / Yes (manual) | Setting this creates FNET constraint |
| **Duration** | Duration (stored as minutes) | "1d?" (estimated) | Yes | PT8H0M0S = 1 day at 8h/day in XML |
| **DurationFormat** | Enum | 7 (days) | Yes | 3=min, 5=hr, 7=day, 9=wk, 11=mo; estimated variants 35–44 |
| **EarlyStart/EarlyFinish** | DateTime | Calculated | Read-only | CPM forward pass results |
| **LateStart/LateFinish** | DateTime | Calculated | Read-only | CPM backward pass results |
| **Deadline** | DateTime | null | Yes | Advisory target; does not constrain but affects slack |
| **ConstraintType** | Enum (0–7) | 0 (ASAP) | Yes | 0=ASAP,1=ALAP,2=MSO,3=MFO,4=SNET,5=SNLT,6=FNET,7=FNLT |
| **ConstraintDate** | DateTime | null | Yes | Date for constraint types that require one |
| **Estimated** | Boolean | true | Yes | "?" suffix on duration display |
| **LevelingDelay** | Integer | 0 | Auto (leveling) | Stored in tenths of minutes |

### Work, cost, and progress fields

| Field | Data Type | Default | Editable | Notes |
|-------|-----------|---------|----------|-------|
| **Work** | Duration | 0h | Calculated from assignments | Total person-hours across all assignments |
| **ActualWork** | Duration | 0h | Yes | Work completed |
| **RemainingWork** | Duration | =Work | Calculated | Work − ActualWork |
| **ActualDuration** | Duration | 0 | Yes | Duration completed |
| **RemainingDuration** | Duration | =Duration | Calculated | Duration − ActualDuration |
| **PercentComplete** | Integer (0–100) | 0 | Yes | Duration-based: ActualDuration/Duration × 100 |
| **PercentWorkComplete** | Integer (0–100) | 0 | Yes | Work-based: ActualWork/Work × 100 |
| **PhysicalPercentComplete** | Integer (0–100) | 0 | Yes | Manual; used for earned value |
| **Cost** | Decimal | 0.00 | Calculated | Total projected cost |
| **ActualCost** | Decimal | 0.00 | Calculated | Costs incurred |
| **FixedCost** | Float | 0.00 | Yes | Task-level fixed cost independent of resources |
| **FixedCostAccrual** | Enum | 2 (Prorated) | Yes | 1=Start, 2=Prorated, 3=End |

### Baseline fields (×11 baselines)

Each of the 11 baselines (Baseline, Baseline1–10) stores: **Start**, **Finish**, **Duration**, **Work**, **Cost**, **BCWS**, **BCWP**, and **FixedCost**.

### Predecessor links (repeating element per task)

| Field | Type | Notes |
|-------|------|-------|
| **PredecessorUID** | Integer | UID of predecessor task |
| **Type** | Enum | 0=FF, 1=FS, 2=SF, 3=SS |
| **LinkLag** | Integer | Lag in tenths of minutes (4800 = 1 day at 8h) |
| **LagFormat** | Enum | Same as DurationFormat |
| **CrossProject** | Boolean | External dependency flag |

### Custom fields

MS Project provides **~130 custom fields per entity type** (Task, Resource, Assignment): Text1–30, Number1–20, Cost1–10, Date1–10, Start1–10, Finish1–10, Duration1–10, Flag1–20, OutlineCode1–10. Each supports **renaming**, **lookup tables**, **formulas** (using `[FieldName]`, `IIf()`, `Switch()`, date/math functions), **graphical indicators**, and **summary rollup** (Sum, Average, Max, Min, Count). Formula fields become read-only. In XML, custom fields are stored as `<ExtendedAttribute>` elements with a numeric FieldID.

### Auto-scheduled vs manually scheduled tasks

**Auto-scheduled** (default before 2010; configurable since 2010): The scheduling engine fully calculates Start, Finish from Duration, dependencies, constraints, and calendars. Duration defaults to "1d?". Uses CPM for forward/backward pass. Effort-driven scheduling applies.

**Manually scheduled** (default since 2010): Duration, Start, Finish are **entirely user-controlled**. Blank fields and free-text values ("TBD", "First Quarter") are permitted. Dependencies are not enforced by default. No CPM calculation occurs. Constraints have no effect. Resource calendars are ignored.

**Switching modes**: Manual→Auto snaps undefined dates to Project Start Date, enforces dependencies, applies constraints. Auto→Manual freezes current calculated dates. **Manually scheduled tasks are never marked Critical** and have no Early/Late dates or Slack.

---

## 2. The core formula: Work = Duration × Units

The fundamental scheduling equation in MS Project operates **at the assignment level**:

```
Assignment_Work = Task_Duration × Assignment_Units
```

Where **Duration** is working time in hours (e.g., 1 day = 8h), **Units** is the resource allocation decimal (100% = 1.0), and **Work** is person-hours. Task-level Work is the **sum of all assignment work values**: `Task_Work = Σ(Assignment_Work_i)`.

### Conversion factors (configurable per project)

| Unit | Default | Internal Storage |
|------|---------|-----------------|
| Minutes | 1 min | Base unit (all durations stored as minutes) |
| Hours | 60 min | 1h = 60m |
| **Days** | **8 hours** | 1d = 480m |
| Weeks | 40 hours | 1w = 2400m |
| Months | 20 days | 1mo = 9600m |
| Elapsed Day | 24 hours (fixed) | 1ed = 1440m |
| Elapsed Week | 7 days (fixed) | 1ew = 10080m |
| Elapsed Month | 30 days (fixed) | 1emo = 43200m |

Elapsed durations ignore all calendars and use fixed 24h/day, 7d/week, 30d/month conversions.

---

## 3. Task types and the complete recalculation matrix

### Which variable recalculates when you edit a field

The **task type** determines which variable the engine holds constant. The default is **Fixed Units**.

| Task Type | You Change Duration | You Change Work | You Change Units |
|-----------|-------------------|-----------------|-----------------|
| **Fixed Units** | Work recalculated | Duration recalculated | Duration recalculated |
| **Fixed Work** | Units recalculated | Duration recalculated | Duration recalculated |
| **Fixed Duration** | Work recalculated | Units recalculated | Work recalculated |

```python
# Pseudocode: Core recalculation logic
def recalculate(task, changed_field):
    if task.type == FIXED_UNITS:
        if changed_field == "Duration":  task.work = task.duration * task.units
        elif changed_field == "Work":    task.duration = task.work / task.units
        elif changed_field == "Units":   task.duration = task.work / task.units

    elif task.type == FIXED_WORK:
        if changed_field == "Duration":  task.units = task.work / task.duration
        elif changed_field == "Work":    task.duration = task.work / task.units
        elif changed_field == "Units":   task.duration = task.work / task.units

    elif task.type == FIXED_DURATION:
        if changed_field == "Duration":  task.work = task.duration * task.units
        elif changed_field == "Work":    task.units = task.work / task.duration
        elif changed_field == "Units":   task.work = task.duration * task.units
```

### Effort-driven scheduling: what happens when resources are added or removed

The **Effort Driven** boolean is a separate flag that **only governs what happens when resources are added to or removed from a task that already has ≥1 resource**. It has **no effect** on manual edits to Duration, Work, or Units fields. Fixed Work tasks are **always effort-driven** (checkbox forced on and grayed out).

**Critical rules**: (1) The first resource assignment to a task never triggers effort-driven behavior — it always computes Work = Duration × Units. (2) Effort-driven only activates on the second and subsequent resource assignments.

### Complete truth table: all 5 valid combinations × all 5 actions

There are 5 valid combinations (Fixed Work + Non-Effort-Driven is impossible):

| # | Task Type | Effort Driven | Change Duration | Change Work | Change Units | Add Resource | Remove Resource |
|---|-----------|---------------|-----------------|-------------|-------------|-------------|----------------|
| 1 | Fixed Units | Yes | W recalc | D recalc | D recalc | **W constant, D decreases** | W constant, D increases |
| 2 | Fixed Units | No | W recalc | D recalc | D recalc | **W increases, D same** | W decreases, D same |
| 3 | Fixed Duration | Yes | W recalc | U recalc | W recalc | **W constant, D same, U/resource ↓** | W constant, D same, U/resource ↑ |
| 4 | Fixed Duration | No | W recalc | U recalc | W recalc | **W increases, D same** | W decreases, D same |
| 5 | Fixed Work | Yes (always) | U recalc | D recalc | D recalc | **W constant, D decreases** | W constant, D increases |

*(W=Work, D=Duration, U=Units)*

```python
def add_resource(task, new_resource, new_units):
    if task.effort_driven:
        original_work = task.work  # Preserve total work
        total_units = sum(a.units for a in task.assignments) + new_units
        if task.type == FIXED_UNITS or task.type == FIXED_WORK:
            task.duration = original_work / total_units
            for a in task.assignments:
                a.work = a.units * task.duration
            new_assignment.work = new_units * task.duration
        elif task.type == FIXED_DURATION:
            for a in task.assignments:
                a.work = original_work * (a.units / total_units)
                a.units = a.work / task.duration
            new_assignment.work = original_work * (new_units / total_units)
    else:  # Non-effort-driven
        new_assignment.work = new_units * task.duration
        task.work += new_assignment.work  # Total work increases
```

---

## 4. Scheduling engine

### Forward scheduling algorithm

MS Project defaults to forward scheduling from a Project Start Date. Tasks default to the **ASAP** constraint. The engine performs a CPM forward pass, then a backward pass.

**Priority order for date calculation**: (1) Actual dates ("actuals trump everything"), (2) Constraints (when "honor constraint dates" is on), (3) Dependencies, (4) Calendar working time, (5) Leveling delay.

```pseudocode
FUNCTION scheduleProject(project):
    // Phase 0: Validate — detect circular dependencies
    sortedTasks = topologicalSort(project.autoScheduledTasks)

    // Phase 1: Forward Pass
    FOR each task T in sortedTasks:
        IF T has no predecessors:
            T.ES = project.startDate
        ELSE:
            T.ES = max(candidate dates from all predecessor links)
        T.ES = applyConstraint(T, T.ES)
        T.ES = snapToWorkingTime(T.ES, T.calendar)
        T.EF = addWorkingDuration(T.ES, T.duration, T.calendar)
        T.start = T.ES; T.finish = T.EF

    // Phase 2: Backward Pass
    projectFinish = max(T.EF for all terminal tasks)
    FOR each task T in reverse(sortedTasks):
        IF T has no successors:
            T.LF = projectFinish  // or T.EF if "multiple critical paths" is on
        ELSE:
            T.LF = min(candidate dates from all successor links)
        IF T.deadline AND T.deadline < T.LF:
            T.LF = T.deadline
        T.LF = applyLateConstraint(T, T.LF)
        T.LS = subtractWorkingDuration(T.LF, T.duration, T.calendar)

    // Phase 3: Slack and Critical Path
    FOR each task T:
        T.totalSlack = T.LS - T.ES
        T.freeSlack = min(successor ES values considering link types) - T.EF
        T.critical = (T.totalSlack <= criticalSlackThreshold)
```

### Backward scheduling

When configured to schedule from a Project Finish Date, all new tasks default to **ALAP** constraint. The engine calculates Late dates first. Entering dates manually creates "No Later Than" constraints instead of "No Earlier Than."

### Calendar-aware date arithmetic

Duration counts **only working time**. The core subroutine for adding duration to a start date:

```pseudocode
FUNCTION addWorkingDuration(startDate, durationMinutes, calendar):
    current = startDate
    remaining = durationMinutes
    WHILE remaining > 0:
        available = getWorkingMinutesRemaining(current, calendar)
        IF available >= remaining:
            RETURN advanceByMinutes(current, remaining)
        remaining -= available
        current = nextWorkingPeriodStart(current, calendar)
    RETURN current
```

### Duration parsing rules

MS Project accepts these input formats for duration entry:

```
"5d", "5 days", "5day"       → 5 working days
"2w", "2 wks", "2 weeks"     → 2 working weeks
"4h", "4 hrs", "4 hours"     → 4 hours
"30m", "30 min", "30 mins"   → 30 minutes
"2mo", "2 mon", "2 months"   → 2 months
"5ed", "5 edays"             → 5 elapsed days (24h/day)
"5d?"                        → 5 days, estimated
"5ed?"                       → 5 elapsed days, estimated
```

The `?` suffix sets the Estimated flag (purely informational — no scheduling impact). The `e` prefix makes duration elapsed (ignores all calendars). Both combine: `5ed?`.

---

## 5. Task dependencies and link types

### The four link types with exact formulas

For all formulas: Pred = predecessor, Succ = successor, Lag = lag value (positive = delay, negative = lead).

| Link Type | Forward Pass Formula | Backward Pass Formula | Notation |
|-----------|---------------------|----------------------|----------|
| **FS** (Finish-to-Start) | `Succ.ES = Pred.EF + Lag` | `Pred.LF = Succ.LS - Lag` | `3FS` or just `3` |
| **SS** (Start-to-Start) | `Succ.ES = Pred.ES + Lag` | `Pred.LS = Succ.LS - Lag` |  `3SS` |
| **FF** (Finish-to-Finish) | `Succ.EF = Pred.EF + Lag` → `Succ.ES = Succ.EF - Succ.Duration` | `Pred.LF = Succ.LF - Lag` | `3FF` |
| **SF** (Start-to-Finish) | `Succ.EF = Pred.ES + Lag` → `Succ.ES = Succ.EF - Succ.Duration` | `Pred.LS = Succ.LF - Lag` | `3SF` |

**FS is the default** and accounts for ~90% of links. When a task has multiple predecessors, the **latest (most restrictive) candidate date wins** in the forward pass; the **earliest wins** in the backward pass.

### Lag and lead time

**Positive lag** delays the successor: `3FS+5d` → successor starts 5 working days after predecessor finishes. **Negative lag** (lead) creates overlap: `3FS-2d` → successor starts 2 working days before predecessor finishes.

**Percentage lag** uses the **predecessor's duration as the 100% base**: `3FS+50%` → Lag = 50% × Pred.Duration in hours, then mapped onto the successor's calendar. This can produce surprising results when different calendars are involved.

**Predecessor column syntax**: `[TaskID][LinkType][+/-][LagValue][LagUnit]` — examples: `3`, `3FS`, `3FS+2d`, `3SS-1d`, `3FF+50%`, `5SS+3d,7FF-2d`.

### Circular dependency detection

MS Project validates at link-creation time using a **depth-first search** on the successor graph:

```pseudocode
FUNCTION canCreateLink(predecessor, successor):
    visited = Set()
    stack = [successor]
    WHILE stack not empty:
        current = stack.pop()
        IF current == predecessor: RETURN false  // Cycle detected
        IF current not in visited:
            visited.add(current)
            FOR each succTask of current: stack.push(succTask)
    RETURN true  // Safe
```

When a circular reference exists, the **entire scheduling engine halts** — no calculations proceed until resolved. The most common cause is linking summary tasks whose subtasks already have conflicting links.

---

## 6. Task constraints

### All 8 constraint types

| Constraint | Category | Forward Pass Effect | Backward Pass Effect |
|------------|----------|--------------------|--------------------|
| **ASAP** | Flexible | No effect (schedule as early as possible) | No effect |
| **ALAP** | Flexible | No effect | Schedule as late as possible |
| **SNET** | Semi-flexible | `ES = max(ES, constraintDate)` | No direct effect |
| **SNLT** | Semi-flexible | No direct effect | `LS = min(LS, constraintDate)` |
| **FNET** | Semi-flexible | `EF = max(EF, constraintDate)` | No direct effect |
| **FNLT** | Semi-flexible | No direct effect | `LF = min(LF, constraintDate)` |
| **MSO** | Inflexible | `ES = constraintDate` (pinned) | `LS = constraintDate` |
| **MFO** | Inflexible | `EF = constraintDate` (pinned) | `LF = constraintDate` |

### Constraint vs dependency conflict resolution

The setting **"Tasks will always honor their constraint dates"** (Options → Schedule) controls behavior:
- **ON (default)**: Inflexible constraints (MSO, MFO) and semi-flexible "no later than" constraints override dependencies. This can create **negative slack**.
- **OFF**: Dependencies take priority. Constraints only affect Late dates. Negative slack is displayed as a warning.

### Automatic constraint triggers

In forward-scheduled projects, entering a **Start date** manually sets an **SNET** constraint; entering a **Finish date** sets an **FNET** constraint. Dragging Gantt bars has the same effect.

### Deadline dates vs constraints

**Deadlines do not affect scheduling** — they never move tasks. However, deadlines **do affect Total Slack**: `if task.deadline < task.LF: task.LF = task.deadline`, which reduces slack and can make a task critical. Missed deadlines show a red exclamation icon. For ALAP tasks, the deadline becomes the scheduling target.

---

## 7. Critical Path Method implementation

### Forward and backward pass algorithm

MS Project uses the **Precedence Diagramming Method (PDM)** variant of CPM with Activity-on-Node representation. The Start field equals Early Start; the Finish field equals Early Finish.

```pseudocode
// FORWARD PASS
FOR each task T in topological order:
    FOR each predecessor link (P, type, lag):
        SWITCH type:
            FS: candidateES = P.EF + lag
            SS: candidateES = P.ES + lag
            FF: candidateEF = P.EF + lag; candidateES = candidateEF - T.duration
            SF: candidateEF = P.ES + lag; candidateES = candidateEF - T.duration
    T.ES = max(all candidateES, applyConstraint(T))
    T.EF = T.ES + T.duration

// BACKWARD PASS
FOR each task T in reverse topological order:
    FOR each successor link (S, type, lag):
        SWITCH type:
            FS: candidateLF = S.LS - lag
            SS: candidateLS = S.LS - lag; candidateLF = candidateLS + T.duration
            FF: candidateLF = S.LF - lag
            SF: candidateLS = S.LF - lag; candidateLF = candidateLS + T.duration
    T.LF = min(all candidateLF, deadline, lateConstraint)
    T.LS = T.LF - T.duration
```

### Slack calculations

```
Total Slack = LS - ES = LF - EF
Free Slack  = min(ES of immediate successors adjusted for link type) - EF
```

**Negative slack** occurs when constraints or deadlines require completion before the calculated Early Finish. A task with `EF = Day 15` but constraint `LF = Day 12` has Total Slack = **-3 days**, meaning the schedule is infeasible.

### Critical task identification

A task is marked **Critical = true** if **any** of these conditions hold:

- Total Slack ≤ configured threshold (default **0 days**, configurable in Options → Advanced)
- Has **MSO** or **MFO** constraint
- Has **ALAP** constraint in a forward-scheduled project
- Has **SNLT** constraint where start ≥ constraint date
- Finish date equals or exceeds its deadline date
- **Exception**: 100% complete tasks are never critical; manually scheduled tasks are never critical

### Multiple critical paths

The setting **"Calculate multiple critical paths"** (Options → Advanced) changes how the backward pass initializes terminal tasks: **OFF** (default) sets `LF = projectFinish` for all tasks without successors, giving dangling tasks positive slack. **ON** sets `LF = EF` for tasks without successors, making each disconnected chain independently critical.

---

## 8. Resource assignment and leveling

### The assignment entity

An **Assignment** connects a Resource to a Task. Each has its own Work, Units, Cost, Start, Finish, Delay, and Work Contour fields. The assignment-level formula: `Assignment.Work = Task.Duration × Assignment.Units`. Task-level Work = Σ(Assignment.Work).

### Three resource types

**Work resources** (people/equipment): Affect scheduling via Duration/Work/Units formula. Have calendars, standard/overtime rates, max units. Subject to overallocation detection and leveling.

**Material resources** (consumables): Units represent quantity or consumption rate (e.g., "20/h"). `Cost = Quantity × StandardRate + PerUseCost`. No calendar. Not subject to leveling.

**Cost resources** (expenses): No scheduling impact. Cost entered directly per assignment. No rates, calendar, or units.

### Overallocation detection

```pseudocode
isOverallocated(resource, period) =
    SumOfAssignedWork(resource, period) > resource.getAvailableHours(period)
```

Checked at configurable granularity (Minute, Hour, Day, Week, Month). A resource at **100% max units** working 8h/day is overallocated if assigned **>8h on any single day** (at day granularity).

### Resource leveling algorithm

MS Project's leveling engine is proprietary but well-characterized. It resolves overallocations through two mechanisms: **adding Leveling Delay** (pushes task start forward, stored in elapsed days) and **splitting tasks** (when enabled). Leveling **never** changes assignments, rearranges logic, or moves tasks earlier.

**Leveling order options**:
- **ID Only**: Higher ID numbers delayed first
- **Standard** (default): Weighs slack (dominant factor), predecessors, dates, priority, constraints. Tasks with most slack are delayed first
- **Priority, Standard**: Priority field (0–1000) is the dominant factor

**Tasks that cannot be delayed**: MSO/MFO constraints, Priority = 1000 (Do Not Level), tasks with actual start dates (already in progress), ALAP tasks in forward scheduling.

**Post-leveling caveat**: Resource leveling **breaks traditional critical path analysis**. Total Slack becomes unreliable for identifying the true resource-constrained critical path because leveling adds delays without creating formal logic links.

### Cost formulas

```
Work Resource:  Cost = (Work × StdRate) + (OvertimeWork × OTRate) + PerUseCost
Material:       Cost = Quantity × StdRate + PerUseCost
Cost Resource:  Cost = DirectlyEnteredValue
Task Total:     Cost = Σ(AssignmentCosts) + FixedCost
```

**Cost accrual**: Start (full cost at task start), End (full cost at completion), or **Prorated** (default — cost accrued proportionally as work completes). Each work/material resource has **5 cost rate tables (A–E)** with effective dates for rate changes over time.

---

## 9. Summary tasks and roll-up behavior

Summary tasks are **always Fixed Duration** type. Their fields are calculated from children — not independently editable on auto-scheduled summary tasks.

### Roll-up formulas

| Field | Formula |
|-------|---------|
| **Start** | `MIN(child.Start for all children)` |
| **Finish** | `MAX(child.Finish for all children)` |
| **Duration** | Working time between Start and Finish per project calendar (**not** the sum of child durations) |
| **Work** | `SUM(child.Work)` — additive across all descendants |
| **Cost** | `SUM(child.Cost)` — Fixed Cost does **not** roll up from children |
| **% Complete** | `SUM(child.ActualDuration) / SUM(child.Duration) × 100` — **duration-weighted average** |
| **% Work Complete** | `SUM(child.ActualWork) / SUM(child.Work) × 100` |
| **Actual Duration** | `Summary.Duration × Summary.%Complete` |

**Nested roll-up cascades correctly** because the duration-weighted formula is mathematically equivalent across levels. **Summary task resource assignments are technically allowed but strongly discouraged** — they add work on top of the subtask roll-up and cause double-counting.

**Manually scheduled summary tasks** do not roll up — they keep user-entered values. Project shows warning indicators when dates don't match subtask ranges.

---

## 10. WBS and outline structure

### Indent/outdent mechanics

**Indenting** (Alt+Shift+Right) makes a task a child of the nearest preceding task at a higher outline level, which automatically becomes a summary task. **Outdenting** (Alt+Shift+Left) removes the task from its parent. Constraints: cannot indent the first task (no preceding parent available), cannot outdent beyond level 1. Maximum outline levels are **virtually unlimited**.

### WBS code generation

**Default WBS** = OutlineNumber (e.g., "1.2.3"), auto-renumbers on structural changes. **Custom WBS codes** are defined via a code mask with per-level settings: sequence type (Numbers/Letters/Characters), length (1–10 or Any), separator (./-/+//). Custom codes do **not** auto-renumber — require manual renumbering via Project → WBS → Renumber.

### Data structure reconstruction from flat list

Tasks are stored as a **flat ordered list** with an OutlineLevel field. Parent-child relationships are reconstructed algorithmically:

```pseudocode
stack = []
FOR each task in ordered list:
    WHILE stack not empty AND stack.top.level >= task.outlineLevel:
        stack.pop()
    IF stack not empty:
        task.parent = stack.top.task
        stack.top.task.children.add(task)
    stack.push({task, task.outlineLevel})
```

---

## 11. Progress tracking

### Three progress metrics

**% Complete** (duration-based): `ActualDuration / Duration × 100`. Setting this auto-calculates ActualDuration and RemainingDuration. If >0% and no Actual Start, sets `ActualStart = Start`. At 100%, sets `ActualFinish = Finish`.

**% Work Complete** (effort-based): `ActualWork / Work × 100`. Diverges from % Complete when work is unevenly distributed across multiple resources.

**Physical % Complete**: Manually entered, independent of all other fields. Used as an alternative basis for earned value calculation. Does not roll up to summary tasks.

### Entering % Complete: cascade logic

```pseudocode
FUNCTION setPercentComplete(task, pct):
    task.actualDuration = task.duration × (pct / 100)
    task.remainingDuration = task.duration × ((100 - pct) / 100)
    IF pct > 0 AND task.actualStart is NULL:
        task.actualStart = task.start
    IF pct == 100:
        task.actualFinish = task.finish
        task.remainingDuration = 0
    ELSE:
        task.actualFinish = NULL
    // If "Updating task status updates resource status" is ON (default):
    task.actualWork = task.work × (pct / 100)
    task.remainingWork = task.work - task.actualWork
```

### Status Date

The project's "as-of" date, set via Project → Status Date. Falls back to Current Date if unset. Effects: (1) determines BCWS cutoff for earned value, (2) controls how timephased actuals distribute, (3) progress lines are drawn relative to it, (4) options exist to move completed/remaining parts to align with the status date.

### Earned value formulas

| Metric | Formula |
|--------|---------|
| **BCWS** (Planned Value) | Cumulative timephased baseline costs from project start through Status Date |
| **BCWP** (Earned Value) | `% Complete (or Physical %) × Baseline Cost` — uses timephased baseline mapping |
| **ACWP** (Actual Cost) | `task.actualCost` |
| **BAC** | `task.baselineCost` |
| **SV** | `BCWP - BCWS` |
| **CV** | `BCWP - ACWP` |
| **SPI** | `BCWP / BCWS` |
| **CPI** | `BCWP / ACWP` |
| **EAC** | `ACWP + (BAC - BCWP) / CPI` — MS Project uses the "BAC/CPI" variant |
| **VAC** | `BAC - EAC` |
| **TCPI** | `(BAC - BCWP) / (BAC - ACWP)` |

The earned value method (% Complete vs Physical % Complete) is configurable per-task and as a project-wide default.

---

## 12. Calendar system

### Calendar hierarchy and precedence

MS Project has four calendar levels: **Base calendars** (Standard, 24 Hours, Night Shift — templates), **Project calendar** (default for all tasks), **Resource calendars** (individual availability), and **Task calendars** (per-task overrides).

**Precedence rule**: The applicable calendar is the **intersection (most restrictive)** of all relevant calendars:
- Without task calendar: `ProjectCalendar ∩ ResourceCalendar`
- With task calendar: `TaskCalendar ∩ ResourceCalendar`
- With "Scheduling ignores resource calendars" checked: `TaskCalendar` only

If **any** applicable calendar marks a period as non-working, that period is non-working for the task.

### Standard calendar defaults

**Standard**: Mon–Fri, 8:00 AM–12:00 PM and 1:00 PM–5:00 PM (8 hrs/day, 40 hrs/week). **24 Hours**: All 7 days, no breaks (24 hrs/day). **Night Shift**: Mon night–Sat morning, 11:00 PM–8:00 AM with 30-min break.

### Calendar exceptions

Exceptions **override** the normal weekly schedule for specific dates. Configurable as one-time (holidays) or **recurring** (daily, weekly, monthly, yearly patterns). Exceptions take priority over Work Weeks definitions. Multiple named Work Week patterns can define different schedules for different date ranges.

**Key implementation constant**: Project allows only **one definition of hours/day, hours/week, days/month** per project file. Even with multiple task calendars having different working hours, the Duration field always converts using the global setting.

### Working time algorithm

```pseudocode
FUNCTION getWorkingMinutes(date, calendar):
    IF date has exception in calendar: use exception working times
    ELSE: use WorkWeek definition for this date range
    FOR each working time slot on this day: sum minutes
    RETURN totalMinutes
```

---

## 13. Edge cases and special behaviors

### Milestones (zero-duration tasks)

Start = Finish (single point in time). Displayed as diamond (◆). Work/Cost can still be assigned. Participate normally in CPM. Automatically flagged when Duration = 0; can also be manually marked as milestone with non-zero duration.

### Split tasks

A split interrupts a task, creating a gap shown as a dotted line. Resources have zero work during the split. The **"Split in-progress tasks"** option controls whether the engine automatically splits tasks when out-of-sequence progress occurs. **"Leveling can create splits"** allows the leveling engine to split remaining work. Tasks can have any number of split segments.

### Inactive tasks (Project Professional 2010+)

Excluded from scheduling but remain visible (grayed, strikethrough text). In **MSP 2013+**, the engine inserts a hidden FS link between the inactive task's predecessors and successors — the inactive task is treated as zero-duration for forward pass. This can produce incorrect dates with non-FS link types. Reactivation restores all properties.

### Recurring tasks

Created as a **summary task** (parent) with individual **occurrence tasks** (children). Each occurrence gets a date constraint matching its scheduled date. Recurrence patterns: Daily, Weekly, Monthly, Yearly. Assigning a resource to the summary assigns it to all occurrences. Recurring tasks get highest leveling priority.

### External dependencies (cross-project links)

Created with `ProjectFileName\TaskID` syntax. **Ghost tasks** (grayed, read-only mirrors) appear in each project. Changes propagate via the "Links Between Projects" dialog on file open. Ghost tasks are path-dependent — renaming/moving the external file breaks the link.

### Negative lag longer than predecessor duration

MS Project **allows** this. For FS with lag = -10d on a 5d predecessor, the successor starts 5 days before the predecessor starts. This is logically questionable but technically valid.

---

## 14. Grid UX and editing behavior

### Edit mode and recalculation triggers

- **F2** activates edit mode; typing directly enters overtype mode
- **ESC** cancels without recalculation
- **Enter** commits and moves down; **Tab** commits and moves right
- **Recalculation fires on cell commit** (Enter, Tab, or clicking another cell)
- **Ctrl+F9** toggles auto-calculate on/off

### Navigation patterns

| Action | Key |
|--------|-----|
| Next cell right | Tab |
| Previous cell left | Shift+Tab |
| Next row down | Enter |
| Previous row up | Shift+Enter |
| First row | Ctrl+Up |
| Last row | Ctrl+Down |
| Select entire row | Shift+Spacebar |
| Multi-row contiguous | Shift+Click on row ID |
| Multi-row non-contiguous | Ctrl+Click on row ID |

### New task creation

Typing in the blank bottom row creates a new task. **Insert key** inserts above current selection. Defaults: Duration = "1d?", Start = Project Start Date, Priority = 500, Type = Fixed Units, Constraint = ASAP.

### Undo/redo

**Ctrl+Z / Ctrl+Y** with **up to 100 levels**. Undoable: cell edits, task insert/delete, indent/outdent, link/unlink, column changes. Non-undoable: file save, VBA macro execution (clears undo stack), resource leveling.

### Gantt Chart bar interactions

- **Drag bar center**: Moves task (changes Start/Finish, preserves Duration) — creates constraint
- **Drag bar right edge**: Extends/shortens duration
- **Drag bar left edge**: Updates % Complete (progress)
- **Drag between bars**: Creates FS dependency link

### Gantt rendering logic

The Gantt chart maps dates to pixel positions linearly: `barLeft_px = (taskStart - timelineStart) × pixelsPerTimeUnit`. Up to **3 timescale tiers** (Top/Middle/Bottom), each independently configurable. Bar styles are layered in order from the Bar Styles dialog — later items draw on top.

| Bar Type | Visual | Filter |
|----------|--------|--------|
| Normal Task | Blue bar | Normal, non-summary |
| Summary | Black bracket with down-arrows | Summary tasks |
| Milestone | Black diamond | Duration = 0 |
| Critical Task | Red bar | Critical flag = true |
| Progress | Thin dark bar inside task bar | % Complete > 0 |
| Baseline | Gray bar (narrower, below) | Baseline set |
| Manually Scheduled | Teal bar with rough edges | Task mode = Manual |
| Split | Dotted line connecting segments | Split tasks |

Link lines are drawn as **right-angle arrows** between bars (FS: right edge → left edge; SS: left → left; FF: right → right; SF: left → right).

---

## 15. Views architecture

Every MS Project view is composed of: **Table** (column layout), **Format** (display type), **Filter** (row visibility), and **Group** (row organization). Key views:

- **Gantt Chart**: Dual-pane (grid + timeline). Primary planning view
- **Tracking Gantt**: Dual bars per task (current + baseline) showing slippage
- **Task Usage**: Tasks expandable to show assignments, with timephased data grid
- **Resource Usage**: Resources expandable to show task assignments, with timephased data
- **Network Diagram**: Flowchart of task boxes with dependency arrows
- **Team Planner**: Timeline organized by resource (drag to reassign/reschedule)
- **Calendar View**: Monthly calendar with task bars spanning duration days
- **Resource Graph**: Bar chart of resource allocation over time
- **Timeline View**: Simplified horizontal summary bar (for executive reporting)

---

## 16. File format and data structures

### MPP file format

The native `.mpp` format is a **binary OLE2 Compound Document** (same container as older Office formats). Internal structure contains tables for Tasks, Resources, Assignments, Calendars, and project-level metadata. The format is proprietary and undocumented by Microsoft. The **MPXJ library** (mpxj.org, open-source, Java/C#) is the definitive tool for reading/writing MPP files — it reverse-engineers the binary structure and exposes a clean object model with classes `ProjectFile`, `Task`, `Resource`, `ResourceAssignment`, `ProjectCalendar`.

### MS Project XML format (MSPDI)

The official XML interchange format uses namespace `http://schemas.microsoft.com/project`. Key element hierarchy:

```xml
<Project>
  <Name>, <StartDate>, <FinishDate>, <ScheduleFromStart>,
  <DefaultStartTime>, <DefaultFinishTime>,
  <MinutesPerDay>, <MinutesPerWeek>, <DaysPerMonth>
  
  <Calendars>
    <Calendar>
      <UID>, <Name>, <IsBaseCalendar>
      <WeekDays><WeekDay><DayType>, <DayWorking>, <WorkingTimes/></WeekDay></WeekDays>
      <Exceptions><Exception><Name>, <Type>, <Start>, <Finish/></Exception></Exceptions>
    </Calendar>
  </Calendars>
  
  <Tasks>
    <Task>
      <UID>, <ID>, <Name>, <Type>, <IsNull>,
      <OutlineLevel>, <OutlineNumber>, <WBS>,
      <Start>, <Finish>, <Duration>, <DurationFormat>,
      <Work>, <Cost>, <FixedCost>,
      <PercentComplete>, <PercentWorkComplete>,
      <Priority>, <ConstraintType>, <ConstraintDate>,
      <Deadline>, <Summary>, <Milestone>, <Critical>,
      <EarlyStart>, <EarlyFinish>, <LateStart>, <LateFinish>,
      <FreeSlack>, <TotalSlack>,
      <EffortDriven>, <Active>, <Estimated>,
      <CalendarUID>, <LevelingDelay>, <LevelingDelayFormat>,
      <PredecessorLink>
        <PredecessorUID>, <Type>, <LinkLag>, <LagFormat>
      </PredecessorLink>
      <ExtendedAttribute>
        <FieldID>, <Value>
      </ExtendedAttribute>
      <Baseline><Number>, <Start>, <Finish>, <Duration>, <Work>, <Cost></Baseline>
    </Task>
  </Tasks>
  
  <Resources>
    <Resource>
      <UID>, <ID>, <Name>, <Type>, <MaxUnits>,
      <StandardRate>, <OvertimeRate>, <CostPerUse>,
      <CalendarUID>, <AccrueAt>
    </Resource>
  </Resources>
  
  <Assignments>
    <Assignment>
      <UID>, <TaskUID>, <ResourceUID>,
      <Units>, <Work>, <ActualWork>, <RemainingWork>,
      <Cost>, <ActualCost>,
      <Start>, <Finish>, <Delay>,
      <WorkContour>, <CostRateTable>
    </Assignment>
  </Assignments>
  
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>, <FieldName>, <Alias>, <Formula>,
      <ValueList><Value><ID>, <Value>, <Description></Value></ValueList>
    </ExtendedAttribute>
  </ExtendedAttributes>
</Project>
```

**Duration storage in XML**: ISO 8601 format (e.g., `PT8H0M0S` = 8 hours = 1 day). **Lag storage**: tenths of minutes (e.g., 4800 = 480 minutes = 1 day at 8h). **DurationFormat enum**: 3=minutes, 5=hours, 7=days, 9=weeks, 11=months; add 32 for estimated variants.

### Key data structures for reimplementation

```
TaskTable:     [UID, ID, Name, OutlineLevel, Type, Duration, Start, Finish,
                Work, Cost, ConstraintType, ConstraintDate, Deadline,
                Priority, EffortDriven, Active, CalendarUID, ...]
ResourceTable: [UID, ID, Name, Type, MaxUnits, StdRate, OTRate, CostPerUse,
                CalendarUID, AccrueAt]
AssignmentTable: [UID, TaskUID, ResourceUID, Units, Work, Cost, Start,
                  Finish, Delay, WorkContour, CostRateTable]
LinkTable:     [PredecessorUID, SuccessorUID, LinkType, Lag, LagFormat]
CalendarTable: [UID, Name, IsBase, WeekDays[], Exceptions[], WorkWeeks[]]
```

The parent-child hierarchy is reconstructed from the flat task list using OutlineLevel (see Section 10). IDs are position-based and renumber; UIDs are stable and permanent.

---

## Conclusion: key architectural decisions for reimplementation

The MS Project scheduling engine is built on **five interlocking subsystems** that any reimplementation must handle correctly. First, the **Work = Duration × Units formula** with its task-type-dependent recalculation and effort-driven resource redistribution forms the foundation of all scheduling math. Second, the **CPM engine** with its forward/backward passes, calendar-aware date arithmetic, and constraint resolution determines every task date. Third, the **calendar system** with its intersection-based precedence rules is the most complex subsystem to implement correctly — every date calculation must traverse working/non-working periods. Fourth, the **outline hierarchy** with its roll-up formulas drives summary task behavior. Fifth, the **resource leveling engine** with its priority-based delay insertion resolves overallocations but intentionally degrades CPM accuracy.

The most subtle implementation challenge is **calendar-aware date arithmetic** — adding 5 working days to a date requires stepping through each calendar day, checking exceptions, and accumulating working minutes. The second most subtle is the **interaction between constraints and dependencies** — the "honor constraint dates" setting fundamentally changes whether constraints or logic drive the schedule. A correct reimplementation must treat these as first-class concerns rather than edge cases.