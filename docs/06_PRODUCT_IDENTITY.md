# 06 — Product Identity: KISS PM

## 1. Product name

The product name is **KISS PM**.

Working expansion:

```txt
KISS PM — Keep It Simple, "Sonny" Project Manager
```

The name is not only branding. It is a product design rule.

KISS PM must help organizations run complex project-control work without forcing users to think like system administrators, BI developers, schedulers, or software engineers.

## 2. Meaning of the name

**Keep It Simple** means that the user experience must stay direct, guided, and operational even when the underlying system is powerful.

A user should not need to understand the internal architecture of KPI engines, scheduling algorithms, resource-capacity calculations, workflow templates, action engines, or integration adapters to make a good management decision.

The product should feel like:

```txt
I see what requires attention.
I understand why it matters.
I can open the relevant context.
I can choose a governed action.
I can verify that the action worked.
```

## 3. Simplicity does not mean primitive

KISS PM is allowed to have deep internal capability:

- CRM intake and feasibility analysis;
- configurable project lifecycle templates;
- Gantt planning;
- resource capacity planning;
- KPI evaluation;
- control signals;
- management actions;
- audit trails;
- closed-project retrospectives;
- no-code customization;
- integration adapters.

But this complexity must be organized behind simple concepts and progressive disclosure.

The system must not expose configuration complexity to ordinary users unless they are explicitly in an admin, builder, or advanced planning context.

## 4. Product personality

KISS PM should behave like a pragmatic project-control assistant:

- it shows the next meaningful thing to do;
- it avoids decorative dashboards that do not support action;
- it explains risks in operational language;
- it prefers guided decisions over raw configuration screens;
- it makes advanced planning available without making every user live inside advanced planning;
- it keeps state changes auditable;
- it turns lessons from closed projects into better future planning.

## 5. KISS product laws

### 5.1 One signal should lead to one understandable action path

When a screen shows a risk, deviation, conflict, opportunity, or bottleneck, it should offer a clear set of relevant actions.

Example:

```txt
Resource overload detected
  -> open affected work
  -> preview shift/split/reassign options
  -> confirm governed action
  -> audit decision
  -> re-evaluate load
```

### 5.2 Do not make users build what the product can infer

If the system can infer a useful default from templates, history, tenant configuration, or context, it should offer that default and allow adjustment.

### 5.3 Configuration should be constrained and safe

KISS PM is configurable, but it is not an unrestricted scripting platform.

No-code customization must be safe, validated, reversible where practical, and testable.

### 5.4 Every builder surface must have preview and validation

KPI builder, control-surface builder, process builder, action builder, role builder, and custom-field builder must support preview, validation, and rollback/versioning where practical.

### 5.5 Operational workflows must be E2E-proven

If the user can perform a management workflow through the UI, there must be an E2E scenario proving it.

## 6. Naming implications

Prefer names that match the product identity:

```txt
Control Surface     instead of static Report
Management Action   instead of table button
Control Signal      instead of dashboard alert
Intake Control      instead of incoming deals report
Resource Control    instead of resource report
Retrospective       instead of closed projects report
```

The word `report` may still appear in technical compatibility or user-facing legacy terminology, but it must not become the primary domain concept.

## 7. Final product promise

KISS PM should become a market-ready SaaS platform where a client can configure its project process, CRM intake, KPI, resources, Gantt planning, control surfaces, roles, and actions — while the day-to-day user still experiences the system as a simple operational project manager.
