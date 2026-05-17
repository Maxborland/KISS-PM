# 0003 - Clean-Room BR2 Control Surface Pattern Transfer

Date: 2026-05-17

## Status

Accepted for Release 2 product/design specification.

## Context

KISS PM needs Release 2 control surfaces that preserve the product law: operational data must lead to governed action, audit, and readback. A supplied ZIP package, `docs/bitrixreports_surfaces_kisspm_transfer_package.zip`, contains sanitized product/design material describing strong interaction patterns from BitrixReports2.0 surfaces.

BitrixReports2.0 is treated as reference experience, not a code source and not a target architecture.

## Decision

Use the supplied ZIP as clean-room input to define generic KISS PM interaction patterns in `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md`.

Accepted patterns:

- `ControlSurfaceShell` for dense management instruments.
- `OperationalDataGrid` for persisted column layout, grouped headers, row actions, drilldowns, and saved views.
- `CapacityMatrix` for resource load, feasibility, free capacity, and schedule overlays.
- `KPIStrip` for compact decision summaries with deltas and source explanation.
- `DrilldownDetailSheet` for row/cell/card/task source context.
- `PreviewBeforeApplyPanel` and `ActionAuditPreview` for risky commands.
- Free capacity / CRM feasibility decision support.
- Custom Project Gantt planning workspace over canonical task/schedule/assignment models.
- Retrospective surfaces over immutable snapshots.

## Clean-Room Boundaries

No BitrixReports2.0 source code, proprietary implementation snippets, Bitrix-specific routes, Bitrix24 fields, company-specific roles/stages/labels, customer data, credentials, or closed screenshots are copied.

KISS PM remains a SaaS project-control platform. Report-like screens are specified as `ControlSurface` / `ManagementInstrument` surfaces that call governed application actions. The word "report" may appear only as a legacy or compatibility label, not as the domain model.

The supplied HTML/PNG atlas is not committed because it contains legacy-style sample labels. The accepted reusable contract is captured in Markdown with generic KISS PM language.

## Not Transferred Directly

- Bitrix24 adapter behavior.
- Portal/user local-storage key semantics as architecture.
- Ant Design component implementation.
- Proprietary or tenant-specific naming.
- Packaged Gantt widget architecture.
- Arbitrary report builder semantics.

## Consequences

Release 2 implementation agents should use `CONTROL_SURFACE_INTERACTION_PATTERNS.md` together with the domain specs, Release 2 screen specs, and E2E truth contract when designing or implementing control surfaces.

Future implementation tasks must still create finite phase/backlog contracts, matrix rows, fixtures, and E2E evidence. This decision does not authorize production UI/API/domain code changes by itself.

## Removal Or Upgrade Conditions

Revise this decision if:

- Release 2 adopts a different design-system architecture.
- A stricter legal review rejects any reference-derived artifact.
- A future control-surface engine spec supersedes these interaction contracts with a verified implementation contract.
- Product leadership explicitly narrows Release 2 away from matrix/Gantt/resource control depth.
