import { describe, expect, it } from "vitest";
import type { AccessProfile } from "@kiss-pm/access-control";
import type { ControlSignal, TenantUser } from "@kiss-pm/domain";

import type { ControlSignalCommandDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import { executeUpdateControlSignalStatus } from "./controlSignalCommandHandlers";

const actor: TenantUser = {
  id: "user-admin",
  tenantId: "tenant-alpha",
  name: "Admin",
  accessProfileId: "profile-admin"
};

const deniedProfile: AccessProfile = {
  id: "profile-denied",
  permissions: []
};

const managerProfile: AccessProfile = {
  id: "profile-manager",
  permissions: ["tenant.control_signals.manage"]
};

const signal: ControlSignal = {
  id: "signal-alpha",
  tenantId: "tenant-alpha",
  projectId: "project-alpha",
  sourceEntity: { type: "KpiDefinition", id: "kpi-alpha" },
  sourceMetric: "schedule_variance_days",
  evaluationId: "evaluation-alpha",
  severity: "warning",
  explanation: "Schedule drift",
  ownerUserId: null,
  allowedActions: ["create_corrective_action"],
  scenarioProposals: [],
  status: "open",
  createdAt: "2026-05-25T00:00:00.000Z",
  updatedAt: "2026-05-25T00:00:00.000Z"
};

describe("executeUpdateControlSignalStatus", () => {
  it("writes denied audit when actor cannot manage control signals", async () => {
    const auditEvents: ManagementAuditEventInput[] = [];
    const auditDataSource: ManagementAuditDataSource = {
      appendAuditEvent: async () => undefined
    };

    const result = await executeUpdateControlSignalStatus({
      actor,
      profile: deniedProfile,
      projectId: "project-alpha",
      signalId: "signal-alpha",
      body: { status: "acknowledged" },
      deps: {
        auditDataSource,
        appendManagementAuditEvent: async (event, dataSource) => {
          expect(dataSource).toBe(auditDataSource);
          auditEvents.push(event);
          return "audit-denied";
        },
        runDataSourceTransaction: async () => {
          throw new Error("transaction_must_not_run");
        }
      }
    });

    expect(result).toEqual({ ok: false, status: 403, error: "permission_missing" });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actionType: "control_signal.status_change_denied",
        sourceWorkflow: "control",
        sourceEntity: { type: "ControlSignal", id: "signal-alpha" },
        commandInput: {
          projectId: "project-alpha",
          signalId: "signal-alpha",
          status: "acknowledged"
        },
        executionResult: {
          status: "denied",
          error: "permission_missing"
        }
      })
    ]);
  });

  it("writes success audit through the transaction data source", async () => {
    const transactionDataSource: ControlSignalCommandDataPort = {
      appendAuditEvent: async () => undefined,
      listControlSignals: async () => [signal],
      upsertControlSignal: async (input) => input
    };
    let auditDataSourceUsed: ManagementAuditDataSource | undefined;

    const result = await executeUpdateControlSignalStatus({
      actor,
      profile: managerProfile,
      projectId: "project-alpha",
      signalId: "signal-alpha",
      body: {
        status: "accepted_risk",
        acceptedRiskReason: "Business owner accepted the delivery risk"
      },
      deps: {
        auditDataSource: { appendAuditEvent: async () => undefined },
        appendManagementAuditEvent: async (event, dataSource) => {
          auditDataSourceUsed = dataSource;
          expect(event).toMatchObject({
            actionType: "control_signal.risk_accepted",
            sourceWorkflow: "control",
            sourceEntity: { type: "ControlSignal", id: "signal-alpha" },
            commandInput: {
              status: "accepted_risk",
              acceptedRiskReason: "Business owner accepted the delivery risk"
            },
            executionResult: { status: "succeeded" }
          });
          return "audit-success";
        },
        runDataSourceTransaction: async (operation) => operation(transactionDataSource)
      }
    });

    expect(result).toMatchObject({
      ok: true,
      auditEventId: "audit-success",
      signal: { id: "signal-alpha", status: "accepted_risk" }
    });
    expect(auditDataSourceUsed).toBe(transactionDataSource);
  });
});
