import { describe, expect, it } from "vitest";

import {
  createActionCommandBindingRegistry,
  createActionDefinition,
  createActionExecutionLog,
  validateActionDefinition,
  type ActionDefinition
} from "./index";

const correctiveActionDefinition: ActionDefinition = {
  id: "action-create-corrective-task",
  tenantId: "tenant-a",
  key: "create_corrective_action",
  label: "Создать корректирующую задачу",
  description: "Создает каноническую задачу из контрольного сигнала",
  version: 1,
  status: "active",
  targetEntityType: "kpi_signal",
  sourceSurfaceKey: "portfolio.control",
  commandBinding: {
    commandType: "corrective_task.create",
    handlerKey: "project.task.create_corrective",
    targetEntityType: "task",
    resultEntityType: "task"
  },
  requiredPermission: "control.action:write",
  dryRunRequired: false,
  inputSchema: {
    fields: [
      {
        key: "title",
        label: "Название",
        valueType: "text",
        required: true,
        summary: true
      },
      {
        key: "dueDate",
        label: "Срок",
        valueType: "date",
        required: true,
        summary: true
      }
    ]
  },
  auditPolicy: {
    required: true,
    includeInputSummary: true,
    includeBeforeAfter: true
  },
  createdAt: "2026-05-16T14:20:00.000Z",
  updatedAt: "2026-05-16T14:20:00.000Z"
};

describe("action definitions", () => {
  it("creates a tenant-scoped action definition with command binding, input schema, dry-run policy, and audit policy", () => {
    const definition = createActionDefinition(correctiveActionDefinition);

    expect(definition).toMatchObject({
      id: "action-create-corrective-task",
      tenantId: "tenant-a",
      key: "create_corrective_action",
      version: 1,
      status: "active",
      sourceSurfaceKey: "portfolio.control",
      targetEntityType: "kpi_signal",
      requiredPermission: "control.action:write",
      dryRunRequired: false,
      commandBinding: {
        commandType: "corrective_task.create",
        handlerKey: "project.task.create_corrective",
        targetEntityType: "task",
        resultEntityType: "task"
      },
      auditPolicy: {
        required: true,
        includeInputSummary: true,
        includeBeforeAfter: true
      }
    });
    expect(definition.inputSchema.fields).toHaveLength(2);
  });

  it("rejects duplicate input fields and invalid dry-run policy", () => {
    expect(() =>
      createActionDefinition({
        ...correctiveActionDefinition,
        inputSchema: {
          fields: [
            ...correctiveActionDefinition.inputSchema.fields,
            correctiveActionDefinition.inputSchema.fields[0]!
          ]
        }
      })
    ).toThrow("Duplicate action input field key: title");

    expect(() =>
      createActionDefinition({
        ...correctiveActionDefinition,
        key: "accept_risk",
        dryRunRequired: false,
        commandBinding: {
          ...correctiveActionDefinition.commandBinding,
          commandType: "risk.accept"
        },
        auditPolicy: {
          required: true,
          includeInputSummary: true,
          includeBeforeAfter: false
        }
      })
    ).toThrow("risk.accept actions must require dry-run");
  });

  it("validates action definitions without throwing to support verifier-style diagnostics", () => {
    expect(validateActionDefinition(correctiveActionDefinition)).toEqual([]);
    expect(
      validateActionDefinition({
        ...correctiveActionDefinition,
        commandBinding: { ...correctiveActionDefinition.commandBinding, handlerKey: "" }
      })
    ).toEqual(["validation_error: actionDefinition.commandBinding.handlerKey is required"]);
  });

  it("registers and resolves command bindings by handler and command type", () => {
    const registry = createActionCommandBindingRegistry([correctiveActionDefinition.commandBinding]);

    expect(registry.resolveByHandler("project.task.create_corrective")).toEqual(
      correctiveActionDefinition.commandBinding
    );
    expect(registry.resolveByCommandType("corrective_task.create")).toEqual(correctiveActionDefinition.commandBinding);
    expect(registry.validateDefinition(correctiveActionDefinition)).toEqual([]);
    expect(
      registry.validateDefinition({
        ...correctiveActionDefinition,
        commandBinding: {
          ...correctiveActionDefinition.commandBinding,
          handlerKey: "missing.handler"
        }
      })
    ).toEqual(["validation_error: actionDefinition.commandBinding.handlerKey is not registered"]);
  });
});

describe("action execution log foundation", () => {
  it("records source surface refs, input summaries, permission/precondition traces, audit ids, and before/after state", () => {
    const log = createActionExecutionLog({
      actor: {
        tenantId: "tenant-a",
        actorId: "user-project-manager-a",
        accessProfileId: "profile-project-manager-a",
        correlationId: "corr-p8-corrective-action"
      },
      commandType: "corrective_task.create",
      requiredPermission: "control.action:write",
      status: "succeeded",
      source: { entityType: "kpiSignal", entityId: "signal-kpi-schedule-variance-a" },
      target: { entityType: "task", entityId: "task-corrective-schedule-a" },
      sourceSurface: {
        surfaceId: "portfolio-control",
        surfaceKey: "portfolio.control",
        rowId: "row-kpi-signal-kpi-schedule-variance-a",
        actionSlotKey: "create_corrective_action"
      },
      inputSummary: {
        title: "Стабилизировать график",
        dueDate: "2026-06-12"
      },
      auditEventIds: ["audit-p8-corrective-action"],
      permissionTrace: ["policy:permission_present", "policy:allowed scope=tenant"],
      preconditionTrace: ["precondition:signal open", "precondition:no duplicate corrective task"],
      before: { signalStatus: "open" },
      after: { taskId: "task-corrective-schedule-a", signalActionState: "executed" },
      timestamp: "2026-05-16T14:30:00.000Z",
      trace: ["action:definition create_corrective_action@1", "action:command corrective_task.create succeeded"]
    });

    expect(log).toMatchObject({
      tenantId: "tenant-a",
      actorId: "user-project-manager-a",
      commandType: "corrective_task.create",
      sourceSurface: {
        surfaceKey: "portfolio.control",
        rowId: "row-kpi-signal-kpi-schedule-variance-a"
      },
      inputSummary: {
        title: "Стабилизировать график"
      },
      auditEventIds: ["audit-p8-corrective-action"],
      permissionTrace: ["policy:permission_present", "policy:allowed scope=tenant"],
      preconditionTrace: ["precondition:signal open", "precondition:no duplicate corrective task"]
    });
  });

  it("rejects P8 source-surface logs without permission/precondition traces or audit ids", () => {
    expect(() =>
      createActionExecutionLog({
        actor: {
          tenantId: "tenant-a",
          actorId: "readonly-a",
          correlationId: "corr-denied-without-trace"
        },
        commandType: "risk.accept",
        requiredPermission: "risk:accept",
        status: "denied",
        source: { entityType: "kpiSignal", entityId: "signal-kpi-schedule-variance-a" },
        before: null,
        after: null,
        timestamp: "2026-05-16T14:31:00.000Z",
        trace: ["action:denied"]
      })
    ).toThrow("actionExecution.permissionTrace must not be empty for denied actions");

    expect(() =>
      createActionExecutionLog({
        actor: {
          tenantId: "tenant-a",
          actorId: "user-project-manager-a",
          correlationId: "corr-success-without-audit"
        },
        commandType: "corrective_task.create",
        requiredPermission: "control.action:write",
        status: "succeeded",
        source: { entityType: "kpiSignal", entityId: "signal-kpi-schedule-variance-a" },
        target: { entityType: "task", entityId: "task-corrective-schedule-a" },
        sourceSurface: {
          surfaceId: "portfolio-control",
          surfaceKey: "portfolio.control",
          rowId: "row-kpi-signal-kpi-schedule-variance-a",
          actionSlotKey: "create_corrective_action"
        },
        before: null,
        after: { taskId: "task-corrective-schedule-a" },
        permissionTrace: ["policy:allowed scope=tenant"],
        preconditionTrace: ["precondition:signal open"],
        timestamp: "2026-05-16T14:32:00.000Z",
        trace: ["action:succeeded"]
      })
    ).toThrow("actionExecution.auditEventIds must not be empty for state-changing succeeded actions");

    expect(() =>
      createActionExecutionLog({
        actor: {
          tenantId: "tenant-a",
          actorId: "user-project-manager-a",
          correlationId: "corr-success-without-policy-trace"
        },
        commandType: "corrective_task.create",
        requiredPermission: "control.action:write",
        status: "succeeded",
        source: { entityType: "kpiSignal", entityId: "signal-kpi-schedule-variance-a" },
        target: { entityType: "task", entityId: "task-corrective-schedule-a" },
        sourceSurface: {
          surfaceId: "portfolio-control",
          surfaceKey: "portfolio.control",
          rowId: "row-kpi-signal-kpi-schedule-variance-a",
          actionSlotKey: "create_corrective_action"
        },
        auditEventIds: ["audit-p8-corrective-action"],
        before: null,
        after: { taskId: "task-corrective-schedule-a" },
        timestamp: "2026-05-16T14:33:00.000Z",
        trace: ["action:succeeded"]
      })
    ).toThrow("actionExecution.permissionTrace must not be empty for source-surface actions");
  });
});
