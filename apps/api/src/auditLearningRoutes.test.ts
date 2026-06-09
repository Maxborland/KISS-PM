import { describe, expect, it, vi } from "vitest";

import type { AccessProfile } from "@kiss-pm/access-control";
import type { ControlSignal, CorrectiveAction } from "@kiss-pm/domain";
import type { TaskRecord } from "@kiss-pm/persistence";

import { createApp } from "./app";
import type { ApiTenantDataSource, AuditEventListItem, ProjectRecord } from "./apiTypes";

const sessionCookie =
  "kiss_pm_session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const auditLearningPermissions: AccessProfile["permissions"] = [
  "tenant.audit_events.read",
  "tenant.control_signals.read",
  "tenant.projects.read"
];

describe("audit learning inputs API", () => {
  it("returns an empty list when there are no attention events or signals", async () => {
    const fixture = createAuditLearningFixture({});
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("returns 403 when actor lacks audit read permission", async () => {
    const fixture = createAuditLearningFixture({
      permissions: ["tenant.control_signals.read", "tenant.projects.read"]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("permission_missing");
  });

  it("returns 403 when actor lacks control signal read permission", async () => {
    const fixture = createAuditLearningFixture({
      permissions: ["tenant.audit_events.read", "tenant.projects.read"]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("permission_missing");
  });

  it("returns 403 when actor lacks project read permission", async () => {
    const fixture = createAuditLearningFixture({
      permissions: ["tenant.audit_events.read", "tenant.control_signals.read"]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("permission_missing");
  });

  it("includes audit attention inputs for failed and denied events", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        }),
        createAuditEvent("audit-denied", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.denied",
          executionResult: { status: "denied" },
          createdAt: new Date("2026-06-08T11:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toHaveLength(2);

    const failedInput = body.items.find((i) => i.id === "audit-attention:audit-failed");
    expect(failedInput).toBeDefined();
    expect(failedInput!.inputKind).toBe("audit_attention");
    expect(failedInput!.sourceWorkflow).toBe("control");
    expect(failedInput!.sourceEntity).toEqual({ type: "Project", id: project.id });
    expect(failedInput!.severity).toBe("critical");
    expect(failedInput!.status).toBe("failed");
    expect(failedInput!.occurredAt).toBe("2026-06-08T10:00:00.000Z");
    expect(failedInput!.deterministicReason).toBe("audit_event_requires_attention");
    expect(failedInput!.evidence).toMatchObject({
      auditEventId: "audit-failed",
      sourceWorkflow: "control",
      sourceEntity: { type: "Project", id: project.id },
      executionResult: { status: "failed" }
    });
    expect(failedInput!.eligibleRuleFamilies).toContain("permission_policy");

    const deniedInput = body.items.find((i) => i.id === "audit-attention:audit-denied");
    expect(deniedInput).toBeDefined();
    expect(deniedInput!.inputKind).toBe("audit_attention");
    expect(deniedInput!.severity).toBe("warning");
    expect(deniedInput!.status).toBe("denied");
  });

  it("excludes successful audit events from learning inputs", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-succeeded", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.applied",
          executionResult: { status: "succeeded" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        }),
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T11:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.id).toBe("audit-attention:audit-failed");
  });

  it("ranks failed audit attention inputs before denied and conflict", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-denied", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.denied",
          executionResult: { status: "denied" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        }),
        createAuditEvent("audit-conflict", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.conflict",
          executionResult: { status: "conflict" },
          createdAt: new Date("2026-06-08T09:00:00.000Z")
        }),
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T08:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items.map((i) => i.id)).toEqual([
      "audit-attention:audit-failed",
      "audit-attention:audit-denied",
      "audit-attention:audit-conflict"
    ]);
  });

  it("prioritizes newer equal-severity learning inputs before input kind", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      tasksByProject: {
        [project.id]: [
          createTask("task-critical-overdue", project.id, {
            priority: "critical",
            plannedFinish: new Date("2026-06-01T00:00:00.000Z"),
            updatedAt: new Date("2026-06-08T09:00:00.000Z")
          })
        ]
      },
      auditEvents: [
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T08:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=2",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: AuditLearningInput[] };
    expect(body.items.map((item) => item.id)).toEqual([
      "operational-queue:task-overdue:project-alpha:task-critical-overdue",
      "audit-attention:audit-failed"
    ]);
  });

  it("includes control signal outcomes as learning inputs", async () => {
    const project = createProject("project-alpha");
    const openSignal = createSignal("signal-open", project.id, {
      status: "open",
      severity: "warning"
    });
    const acceptedRiskSignal = createSignal("signal-accepted", project.id, {
      status: "accepted_risk",
      severity: "critical",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-08T12:00:00.000Z"
    });
    const resolvedSignal = createSignal("signal-resolved", project.id, {
      status: "resolved",
      severity: "warning"
    });
    const fixture = createAuditLearningFixture({
      projects: [project],
      signalsByProject: {
        [project.id]: [openSignal, acceptedRiskSignal, resolvedSignal]
      }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    const signalInputs = body.items.filter((i) => i.inputKind === "control_signal_outcome");
    expect(signalInputs).toHaveLength(3);

    const acceptedRiskInput = signalInputs.find(
      (i) => i.id === "control-signal-outcome:signal-accepted"
    );
    expect(acceptedRiskInput).toBeDefined();
    expect(acceptedRiskInput!.status).toBe("accepted_risk");
    expect(acceptedRiskInput!.severity).toBe("critical");
    expect(acceptedRiskInput!.occurredAt).toBe("2026-06-08T12:00:00.000Z");
    expect(acceptedRiskInput!.deterministicReason).toBe("control_signal_accepted_risk");
    expect(acceptedRiskInput!.sourceWorkflow).toBe("control");
    expect(acceptedRiskInput!.eligibleRuleFamilies).toContain("planning_control");

    const openInput = signalInputs.find(
      (i) => i.id === "control-signal-outcome:signal-open"
    );
    expect(openInput).toBeDefined();
    expect(openInput!.status).toBe("open");
    expect(openInput!.deterministicReason).toBe("control_signal_open");

    const resolvedInput = signalInputs.find(
      (i) => i.id === "control-signal-outcome:signal-resolved"
    );
    expect(resolvedInput).toBeDefined();
    expect(resolvedInput!.status).toBe("resolved");
    expect(resolvedInput!.deterministicReason).toBe("control_signal_resolved");
  });

  it("includes projectId in learning inputs when the source project is known", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.projectId).toBe(project.id);
  });

  it("uses date-only overdue checks for operational project learning inputs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T15:00:00.000Z"));
    try {
      const project = createProject("project-alpha", {
        plannedFinish: new Date("2026-06-09T00:00:00.000Z")
      });
      const fixture = createAuditLearningFixture({ projects: [project] });
      const app = createApp({ dataSource: fixture.dataSource });

      const response = await app.request(
        "/api/tenant/current/audit-learning-inputs?limit=10",
        { headers: authHeaders() }
      );

      expect(response.status).toBe(200);
      const body = await response.json() as { items: AuditLearningInput[] };
      expect(body.items.map((item) => item.id)).not.toContain(
        "operational-queue:project-overdue:project-alpha"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves audit attention projectId from known related entities", async () => {
    const project = createProject("project-alpha");
    const task = createTask("task-alpha", project.id);
    const signal = createSignal("signal-alpha", project.id);
    const action = createCorrectiveAction("action-alpha", project.id, signal.id);
    const fixture = createAuditLearningFixture({
      projects: [project],
      tasksByProject: { [project.id]: [task] },
      signalsByProject: { [project.id]: [signal] },
      correctiveActionsByProject: { [project.id]: [action] },
      auditEvents: [
        createAuditEvent("audit-task-denied", {
          sourceEntity: { type: "Task", id: task.id },
          actionType: "project_work.update_denied",
          executionResult: { status: "denied" }
        }),
        createAuditEvent("audit-signal-denied", {
          sourceEntity: { type: "ControlSignal", id: signal.id },
          actionType: "control.signal_denied",
          executionResult: { status: "denied" }
        }),
        createAuditEvent("audit-action-denied", {
          sourceEntity: { type: "CorrectiveAction", id: action.id },
          actionType: "corrective_action.update_denied",
          executionResult: { status: "denied" }
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    const projectIdByInputId = new Map(
      body.items
        .filter((item) => item.inputKind === "audit_attention")
        .map((item) => [item.id, item.projectId])
    );
    expect(projectIdByInputId).toEqual(new Map([
      ["audit-attention:audit-task-denied", project.id],
      ["audit-attention:audit-signal-denied", project.id],
      ["audit-attention:audit-action-denied", project.id]
    ]));
  });

  it("resolves tenant-wide audit attention projectId from related entities outside operational projects", async () => {
    const closedProject = createProject("project-closed", { status: "closed" });
    const task = createTask("task-closed", closedProject.id);
    const signal = createSignal("signal-closed", closedProject.id);
    const action = createCorrectiveAction("action-closed", closedProject.id, signal.id);
    const fixture = createAuditLearningFixture({
      projects: [closedProject],
      tasksByProject: { [closedProject.id]: [task] },
      signalsByProject: { [closedProject.id]: [signal] },
      correctiveActionsByProject: { [closedProject.id]: [action] },
      auditEvents: [
        createAuditEvent("audit-closed-task-denied", {
          sourceEntity: { type: "Task", id: task.id },
          actionType: "project_work.update_denied",
          executionResult: { status: "denied" }
        }),
        createAuditEvent("audit-closed-signal-denied", {
          sourceEntity: { type: "ControlSignal", id: signal.id },
          actionType: "control.signal_denied",
          executionResult: { status: "denied" }
        }),
        createAuditEvent("audit-closed-action-denied", {
          sourceEntity: { type: "CorrectiveAction", id: action.id },
          actionType: "corrective_action.update_denied",
          executionResult: { status: "denied" }
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    const projectIdByInputId = new Map(
      body.items
        .filter((item) => item.inputKind === "audit_attention")
        .map((item) => [item.id, item.projectId])
    );
    expect(projectIdByInputId).toEqual(new Map([
      ["audit-attention:audit-closed-task-denied", closedProject.id],
      ["audit-attention:audit-closed-signal-denied", closedProject.id],
      ["audit-attention:audit-closed-action-denied", closedProject.id]
    ]));
  });

  it("includes operational queue items from overdue projects, waiting tasks, open signals, and corrective actions", async () => {
    const project = createProject("project-alpha", {
      plannedFinish: new Date("2026-06-01T00:00:00.000Z")
    });
    const task = createTask("task-waiting", project.id, {
      status: "waiting",
      statusCategory: "waiting",
      priority: "high",
      plannedFinish: new Date("2026-06-01T00:00:00.000Z")
    });
    const signal = createSignal("signal-open", project.id, {
      status: "open",
      severity: "critical"
    });
    const action = createCorrectiveAction("action-open", project.id, signal.id, {
      status: "open",
      dueDate: "2026-06-01"
    });
    const fixture = createAuditLearningFixture({
      projects: [project],
      tasksByProject: { [project.id]: [task] },
      signalsByProject: { [project.id]: [signal] },
      correctiveActionsByProject: { [project.id]: [action] }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    const operationalInputs = body.items.filter((item) => item.inputKind === "operational_queue_item");

    expect(operationalInputs.map((item) => item.id)).toEqual(expect.arrayContaining([
      "operational-queue:project-overdue:project-alpha",
      "operational-queue:task-overdue:project-alpha:task-waiting",
      "operational-queue:task-status:project-alpha:task-waiting",
      "operational-queue:control-signal:project-alpha:signal-open",
      "operational-queue:corrective-action:project-alpha:action-open"
    ]));
    expect(operationalInputs).toHaveLength(5);
    expect(operationalInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        deterministicReason: "operational_queue_project_overdue",
        sourceEntity: { type: "Project", id: project.id },
        projectId: project.id
      }),
      expect.objectContaining({
        deterministicReason: "operational_queue_task_overdue",
        sourceEntity: { type: "Task", id: task.id },
        severity: "critical"
      }),
      expect.objectContaining({
        deterministicReason: "operational_queue_task_waiting",
        sourceEntity: { type: "Task", id: task.id }
      }),
      expect.objectContaining({
        deterministicReason: "operational_queue_control_signal_open",
        sourceEntity: { type: "ControlSignal", id: signal.id },
        severity: "critical"
      }),
      expect.objectContaining({
        deterministicReason: "operational_queue_corrective_action_overdue",
        sourceEntity: { type: "CorrectiveAction", id: action.id },
        severity: "critical"
      })
    ]));
  });

  it("preserves linked control signal severity for overdue corrective action queue inputs", async () => {
    const project = createProject("project-alpha");
    const signal = createSignal("signal-warning", project.id, {
      status: "open",
      severity: "warning"
    });
    const action = createCorrectiveAction("action-overdue", project.id, signal.id, {
      status: "open",
      dueDate: "2026-06-01"
    });
    const fixture = createAuditLearningFixture({
      projects: [project],
      signalsByProject: { [project.id]: [signal] },
      correctiveActionsByProject: { [project.id]: [action] }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        deterministicReason: "operational_queue_corrective_action_overdue",
        sourceEntity: { type: "CorrectiveAction", id: action.id },
        severity: "warning"
      })
    ]));
  });

  it("uses overdue severity fallback for corrective action queue inputs without linked signals", async () => {
    const project = createProject("project-alpha");
    const action = createCorrectiveAction("action-overdue-no-signal", project.id, "signal-missing", {
      status: "open",
      dueDate: "2026-06-01"
    });
    const fixture = createAuditLearningFixture({
      projects: [project],
      correctiveActionsByProject: { [project.id]: [action] }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        deterministicReason: "operational_queue_corrective_action_overdue",
        sourceEntity: { type: "CorrectiveAction", id: action.id },
        severity: "critical"
      })
    ]));
  });

  it("limits results by the limit query parameter", async () => {
    const project = createProject("project-alpha");
    const auditEvents = Array.from({ length: 10 }, (_, i) =>
      createAuditEvent(`audit-failed-${i}`, {
        sourceEntity: { type: "Project", id: project.id },
        actionType: "management_action.failed",
        executionResult: { status: "failed" },
        createdAt: new Date(`2026-06-08T${String(10 + i).padStart(2, "0")}:00:00.000Z`)
      })
    );
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=3",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toHaveLength(3);
  });

  it("returns 400 for invalid limit", async () => {
    const fixture = createAuditLearningFixture({});
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=0",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(400);
  });

  it("does not include any forbidden AI/suggestion field names", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-failed", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        })
      ],
      signalsByProject: {
        [project.id]: [createSignal("signal-open", project.id)]
      }
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    const forbiddenFields = [
      "suggestion", "suggestions", "recommendation", "recommendations",
      "prompt", "model", "generated", "confidence"
    ];
    for (const item of body.items) {
      for (const field of forbiddenFields) {
        expect((item as Record<string, unknown>)[field]).toBeUndefined();
      }
    }
  });

  it("includes conflict audit events as warning-severity learning inputs", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-conflict", {
          sourceEntity: { type: "Project", id: project.id },
          actionType: "management_action.conflict",
          executionResult: { status: "conflict" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.severity).toBe("warning");
    expect(body.items[0]!.status).toBe("conflict");
  });

  it("isolates learning inputs to the actor tenant", async () => {
    const ownProject = createProject("project-alpha");
    const otherProject = createProject("project-beta", { tenantId: "tenant-other" });
    const fixture = createAuditLearningFixture({
      projects: [ownProject, otherProject],
      auditEvents: [
        createAuditEvent("audit-own-failed", {
          sourceEntity: { type: "Project", id: ownProject.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        }),
        createAuditEvent("audit-other-failed", {
          tenantId: "tenant-other",
          sourceEntity: { type: "Project", id: otherProject.id },
          actionType: "management_action.failed",
          executionResult: { status: "failed" },
          createdAt: new Date("2026-06-08T11:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items.every((i) => i.tenantId === "tenant-control")).toBe(true);
  });

  it("maps eligible rule families from source workflow and event action type", async () => {
    const project = createProject("project-alpha");
    const fixture = createAuditLearningFixture({
      projects: [project],
      auditEvents: [
        createAuditEvent("audit-planning-denied", {
          sourceEntity: { type: "Project", id: project.id },
          sourceWorkflow: "planning",
          actionType: "planning.apply_denied",
          executionResult: { status: "denied" },
          createdAt: new Date("2026-06-08T10:00:00.000Z")
        })
      ]
    });
    const app = createApp({ dataSource: fixture.dataSource });

    const response = await app.request(
      "/api/tenant/current/audit-learning-inputs?limit=10",
      { headers: authHeaders() }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { items: AuditLearningInput[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.eligibleRuleFamilies).toContain("planning_control");
    expect(body.items[0]!.sourceWorkflow).toBe("planning");
  });

  it("documents the audit learning inputs route in OpenAPI", async () => {
    const app = createApp();

    const response = await app.request("/api/openapi.json");

    expect(response.status).toBe(200);
    const document = await response.json() as {
      paths: Record<string, Record<string, unknown>>;
    };
    const route = document.paths["/api/tenant/current/audit-learning-inputs"];

    expect(route).toBeDefined();
    expect(route?.get).toMatchObject({
      summary: "List audit learning inputs"
    });
  });
});

type AuditLearningInput = {
  id: string;
  tenantId: string;
  inputKind: string;
  sourceWorkflow: string;
  sourceEntity: Record<string, unknown>;
  projectId: string | null;
  severity: string;
  status: string;
  occurredAt: string;
  deterministicReason: string;
  evidence: Record<string, unknown>;
  eligibleRuleFamilies: string[];
};

type AuditLearningFixtureInput = {
  permissions?: AccessProfile["permissions"];
  projects?: ProjectRecord[];
  tasksByProject?: Record<string, TaskRecord[]>;
  signalsByProject?: Record<string, ControlSignal[]>;
  correctiveActionsByProject?: Record<string, CorrectiveAction[]>;
  auditEvents?: AuditEventListItem[];
};

function authHeaders() {
  return { cookie: sessionCookie };
}

function createAuditLearningFixture(input: AuditLearningFixtureInput) {
  const dataSource: Partial<ApiTenantDataSource> = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId: string) {
      return userId === "user-control"
        ? {
            id: "user-control",
            tenantId: "tenant-control",
            name: "Control User",
            accessProfileId: "control-profile"
          }
        : undefined;
    },
    async findAccessProfileById() {
      return {
        id: "control-profile",
        permissions: input.permissions ?? auditLearningPermissions
      };
    },
    async findSessionByTokenHash() {
      return {
        id: "session-control",
        tenantId: "tenant-control",
        userId: "user-control",
        tokenHash: "ignored",
        expiresAt: new Date("2026-07-01T00:00:00.000Z")
      };
    },
    async listOperationalQueueProjects(tenantId: string, options: { statuses: Array<"active" | "paused">; limit: number }) {
      return (input.projects ?? [])
        .filter((project) => project.tenantId === tenantId)
        .filter((project) => options.statuses.includes(project.status as "active" | "paused"))
        .slice(0, options.limit);
    },
    async listProjectTasksForProjects(_tenantId: string, projectIds: string[]) {
      return projectIds.flatMap((projectId) => input.tasksByProject?.[projectId] ?? []);
    },
    async listControlSignalsForProjects(_tenantId: string, projectIds: string[]) {
      return projectIds.flatMap((projectId) => input.signalsByProject?.[projectId] ?? []);
    },
    async listCorrectiveActionsForProjects(_tenantId: string, projectIds: string[]) {
      return projectIds.flatMap((projectId) => input.correctiveActionsByProject?.[projectId] ?? []);
    },
    async listAuditEventsByTenantId(tenantId: string, options?: { limit?: number; requiresAttention?: boolean; sourceEntities?: Array<{ type: string; ids: string[] }> }) {
      const events = (input.auditEvents ?? []).filter((event) => event.tenantId === tenantId);
      if (options?.requiresAttention) {
        const filtered = events.filter((event) => {
          const status = typeof event.executionResult.status === "string" ? event.executionResult.status : null;
          return status === "failed" ||
            status === "denied" ||
            status === "conflict" ||
            /(?:_|\.)(?:failed|denied|conflict)$/.test(event.actionType);
        });
        const sorted = [...filtered].sort(compareAttentionAuditEvents);
        return sorted.slice(0, options?.limit);
      }
      return events.slice(0, options?.limit);
    },
    async listProjects(tenantId: string) {
      return (input.projects ?? []).filter((project) => project.tenantId === tenantId);
    }
  };

  return { dataSource: dataSource as ApiTenantDataSource };
}

function createProject(id: string, overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id,
    tenantId: "tenant-control",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: null,
    projectTypeId: null,
    title: `Project ${id}`,
    clientName: "Control client",
    status: "active",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    contractValue: 0,
    plannedHours: 0,
    templateId: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    activatedAt: new Date("2026-06-01T00:00:00.000Z"),
    closedAt: null,
    demand: [],
    ...overrides
  };
}

function createSignal(id: string, projectId: string, overrides: Partial<ControlSignal> = {}): ControlSignal {
  return {
    id,
    tenantId: "tenant-control",
    projectId,
    sourceEntity: { type: "Project", id: projectId },
    sourceMetric: "deadline_delta_days",
    evaluationId: null,
    severity: "warning",
    explanation: `Signal ${id}`,
    ownerUserId: null,
    allowedActions: ["create_corrective_action"],
    scenarioProposals: [],
    status: "open",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides
  };
}

function createTask(id: string, projectId: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    tenantId: "tenant-control",
    projectId,
    stageId: null,
    title: `Task ${id}`,
    description: null,
    status: "in_progress",
    statusId: "task-status-in-progress",
    statusName: "In progress",
    statusCategory: "in_progress",
    priority: "normal",
    requesterUserId: "user-control",
    ownerUserId: "user-control",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
    durationWorkingDays: 1,
    plannedWork: 1,
    actualWork: 0,
    progress: 0,
    requiresAcceptance: false,
    source: "manual",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    archivedAt: null,
    participants: [],
    ...overrides
  };
}

function createCorrectiveAction(
  id: string,
  projectId: string,
  controlSignalId: string,
  overrides: Partial<CorrectiveAction> = {}
): CorrectiveAction {
  return {
    id,
    tenantId: "tenant-control",
    projectId,
    controlSignalId,
    title: `Action ${id}`,
    description: null,
    responsibleUserId: null,
    dueDate: null,
    status: "open",
    result: null,
    ...overrides
  };
}

function createAuditEvent(id: string, overrides: Partial<AuditEventListItem> = {}): AuditEventListItem {
  return {
    id,
    tenantId: "tenant-control",
    actorUserId: "user-control",
    actionType: "control.action_denied",
    sourceSurfaceId: null,
    sourceWorkflow: "control",
    sourceEntity: { type: "Project", id: "project-alpha" },
    input: {},
    beforeState: null,
    afterState: null,
    permissionResult: { allowed: false, reason: "permission_missing" },
    executionResult: { status: "denied" },
    correlationId: `correlation-${id}`,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides
  };
}

function compareAttentionAuditEvents(left: AuditEventListItem, right: AuditEventListItem) {
  return auditEventSeverityRank(left) - auditEventSeverityRank(right) ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    left.id.localeCompare(right.id);
}

function auditEventSeverityRank(event: AuditEventListItem) {
  const status = typeof event.executionResult.status === "string" ? event.executionResult.status : null;
  return status === "failed" || /(?:_|\.)failed$/.test(event.actionType) ? 0 : 1;
}
