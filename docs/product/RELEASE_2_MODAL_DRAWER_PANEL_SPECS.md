# Release 2 Modal, Drawer, And Panel Specs

Updated: 2026-05-17

## 1. Rules

Use shadcn/ui and Radix primitives as the base interaction layer:

- `Dialog` for focused low-risk forms.
- `AlertDialog` for irreversible or risk-acceptance decisions.
- `Sheet` for object detail, task detail, Gantt detail, audit preview, and multi-field side work.
- `Popover` for filters, date helpers, and compact contextual controls.
- `Command` for scoped search/action launcher.

Every modal, drawer, or panel must define trigger, permission, input validation, cancel behavior, preview/dry-run, apply behavior, result evidence, stale-preview handling, retry/refetch behavior, and reload expectations.

## 2. Shared Panels

### PreviewBeforeApplyPanel

- Used by: schedule shifts, resource resolutions, project activation, baseline capture, closure, tenant config publish, import apply.
- Shows: source signal, command type, before state, after state, affected entities, expected reduction/impact, blockers, warnings.
- Required states: idle, calculating, ready, stale, blocked, applying, applied, failed.
- Apply rule: apply button is enabled only for a fresh preview id and authorized actor.
- Evidence: command result id, audit id, refreshed projection timestamp.

### AuditTrailPreview

- Used by: every management plane after action result and from action/audit drill-down.
- Shows: actor, tenant, permission decision, source surface, source signal, target entity, command, before/after, result, timestamp.
- Permission: users without audit permission see compact result without sensitive before/after details.
- Reload: audit entry must be fetched from API, never inferred from local UI state.

### PermissionDeniedInline

- Used by: disabled action buttons, read-only toolbars, denied direct entry screens.
- Shows: unavailable action, missing permission or role, allowed read-only path, who can perform the action if known.
- Rule: hidden-only permission behavior is not accepted; disabled/denied state must be explainable.

### ObjectDetailSheet

- Used by: opportunity, project, task, artifact, package, KPI signal, resource bucket, retrospective insight.
- Shows: compact object context, current state, linked signals, related actions, audit summary.
- Behavior: selection persists while list/grid refetches; stale object shows recovery/refetch path.

## 3. Domain-Specific Dialogs And Sheets

### IntakeDecisionDialog

- Trigger: CRM Intake Control action.
- Actions: request data, defer, reject, accept risk, create draft.
- Preview: create draft and accept risk require consequence preview.
- Result: opportunity decision and audit id.

### CapacityReservationDialog

- Trigger: feasibility/resource/load surfaces.
- Inputs: role/resource, period, hours, source opportunity/project, reason.
- Preview: before/after load buckets and conflict severity.
- Result: reservation id, refreshed load, audit id.

### ProjectActivationPreviewDialog

- Trigger: Contract Authorization Control.
- Inputs: process template, key roles, authorization artifact, planned start.
- Preview: generated project/stages/tasks, capacity assumptions, startup blockers.
- Result: active project id, startup task ids, audit id.

### GanttTaskDetailSheet

- Trigger: WBS row or timeline bar.
- Inputs: canonical task fields, schedule fields, participants, dependencies.
- Preview: date/dependency changes with conflict detection.
- Result: task readback, schedule readback, related-view refresh, audit id.

### BaselineCaptureDialog

- Trigger: Gantt toolbar.
- Preview: current schedule snapshot and differences from previous baseline.
- Result: baseline id, immutable baseline readback, audit id.

### StageGateDecisionDialog

- Trigger: briefing/stage/production controls.
- Actions: approve, reject, request artifact, accept risk.
- Preview: affected next stage, blocked tasks, required approvals.
- Result: stage gate status and audit id.

### ArtifactReviewSheet

- Trigger: artifact row/card.
- Inputs: review decision, comments, rework owner, due date.
- Preview: artifact approval/rejection consequence and rework task effect.
- Result: artifact status, rework task, audit id.

### OverloadResolutionDialog

- Trigger: Resource Load Control or Portfolio Control overload action.
- Actions: shift, split, reassign, reserve capacity, accept overload.
- Preview: before/after utilization, affected tasks/projects, remaining overload.
- Result: refreshed load bucket, schedule/portfolio refresh, audit id.

### CorrectiveActionDialog

- Trigger: KPI/Portfolio/Stage signal action.
- Inputs: owner, due date, target entity, expected result.
- Preview: source signal and projected handling state.
- Result: corrective action/task id, source signal handled/readback, audit id.

### AcceptRiskAlertDialog

- Trigger: KPI/Portfolio/Feasibility/Closure signal action.
- Inputs: reason, expiry/review date, owner.
- Preview: consequence, affected controls, unresolved condition.
- Result: accepted-risk record, audit id, refreshed signal state.

### TemplateImpactPreviewSheet

- Trigger: tenant configuration publish or retrospective improvement.
- Shows: affected future templates, active-project history policy, impacted screens/actions, validation blockers.
- Result: configuration version id, audit id, runtime readback.

### ImportPreviewDialog

- Trigger: Integration Import Control.
- Shows: create/update/skip/error counts, mappings, conflicts, idempotency key.
- Result: import batch id, external mapping, canonical readback, audit id.

### ClosureSnapshotPreviewDialog

- Trigger: Closure Control.
- Shows: final KPI, open blockers, closure checklist, immutable snapshot content.
- Result: closed project snapshot id, closed portfolio link, audit id.

## 4. Rejection Criteria

A modal/panel spec is rejected when:

- it mutates without preview for risky changes;
- result is a toast only;
- permission is hidden instead of explained;
- stale preview can be applied;
- reload/readback is not specified;
- it uses generic CRUD copy instead of a management decision context.
