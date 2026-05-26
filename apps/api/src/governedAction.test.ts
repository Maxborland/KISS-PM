import { describe, expect, it } from "vitest";

import type { PolicyDecision } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import { runGovernedMutation, writeGovernedDeniedAudit } from "./governedAction";

const actor: TenantUser = {
  accessProfileId: "access-profile-admin",
  id: "user-admin",
  name: "Анна Администратор",
  tenantId: "tenant-alpha"
};

const allowedDecision: PolicyDecision = {
  allowed: true,
  reason: "same_tenant_permission_granted"
};

const deniedDecision: PolicyDecision = {
  allowed: false,
  reason: "permission_missing"
};

const minimalDataSource: ApiTenantDataSource = {
  findTenantById: async () => undefined,
  findUserById: async () => undefined,
  listDevUsers: async () => [],
  listUsersByTenantId: async () => []
};

describe("runGovernedMutation", () => {
  it("writes denied audit through the denied-only helper", async () => {
    const auditEvents: ManagementAuditEventInput[] = [];

    const result = await writeGovernedDeniedAudit({
      actor,
      appendManagementAuditEvent: async (input) => {
        auditEvents.push(input);
        return "audit-denied";
      },
      deniedAudit: {
        actionType: "client.update_denied",
        commandInput: { endpoint: "updateClient", clientId: "client-alpha" },
        sourceEntity: { type: "Client", id: "client-alpha" }
      },
      permissionResult: deniedDecision,
      sourceWorkflow: "crm_foundation"
    });

    expect(result).toEqual({ ok: false, status: 403, error: "permission_missing" });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actionType: "client.update_denied",
        actorUserId: actor.id,
        afterState: null,
        beforeState: null,
        commandInput: { endpoint: "updateClient", clientId: "client-alpha" },
        executionResult: { status: "denied", error: "permission_missing" },
        permissionResult: deniedDecision,
        sourceEntity: { type: "Client", id: "client-alpha" },
        sourceWorkflow: "crm_foundation",
        tenantId: actor.tenantId
      })
    ]);
  });

  it("writes denied audit and skips transaction when permission is denied", async () => {
    const auditEvents: ManagementAuditEventInput[] = [];
    let transactionStarted = false;

    const result = await runGovernedMutation({
      actor,
      appendManagementAuditEvent: async (input) => {
        auditEvents.push(input);
        return "audit-denied";
      },
      deniedAudit: {
        actionType: "client.create_denied",
        commandInput: { endpoint: "createClient" },
        sourceEntity: { type: "Client", id: "unknown" }
      },
      execute: async () => {
        throw new Error("denied mutation should not execute");
      },
      permissionResult: deniedDecision,
      runDataSourceTransaction: async (operation) => {
        transactionStarted = true;
        return operation(minimalDataSource);
      },
      sourceWorkflow: "crm_foundation",
      successAudit: () => ({
        actionType: "client.created",
        afterState: { id: "client-alpha" },
        beforeState: null,
        commandInput: { id: "client-alpha" },
        sourceEntity: { type: "Client", id: "client-alpha" }
      })
    });

    expect(result).toEqual({ ok: false, status: 403, error: "permission_missing" });
    expect(transactionStarted).toBe(false);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actionType: "client.create_denied",
        actorUserId: actor.id,
        afterState: null,
        beforeState: null,
        commandInput: { endpoint: "createClient" },
        executionResult: { status: "denied", error: "permission_missing" },
        permissionResult: deniedDecision,
        sourceEntity: { type: "Client", id: "unknown" },
        sourceWorkflow: "crm_foundation",
        tenantId: actor.tenantId
      })
    ]);
  });

  it("runs mutation and success audit inside the transaction when permission is allowed", async () => {
    const transactionDataSource = minimalDataSource;
    const auditEvents: Array<{
      input: ManagementAuditEventInput;
      auditDataSource: ManagementAuditDataSource | undefined;
    }> = [];
    const events: string[] = [];

    const result = await runGovernedMutation({
      actor,
      appendManagementAuditEvent: async (input, auditDataSource) => {
        auditEvents.push({ input, auditDataSource });
        events.push("audit");
        return "audit-success";
      },
      deniedAudit: {
        actionType: "client.create_denied",
        commandInput: { endpoint: "createClient" },
        sourceEntity: { type: "Client", id: "unknown" }
      },
      execute: async (dataSource) => {
        expect(dataSource).toBe(transactionDataSource);
        events.push("execute");
        return { id: "client-alpha", name: "ООО Альфа" };
      },
      permissionResult: allowedDecision,
      runDataSourceTransaction: async (operation) => {
        events.push("transaction:start");
        const value = await operation(transactionDataSource);
        events.push("transaction:end");
        return value;
      },
      sourceWorkflow: "crm_foundation",
      successAudit: (client) => ({
        actionType: "client.created",
        afterState: client,
        beforeState: null,
        commandInput: { id: client.id },
        sourceEntity: { type: "Client", id: client.id }
      })
    });

    expect(result).toEqual({
      ok: true,
      value: { id: "client-alpha", name: "ООО Альфа" }
    });
    expect(events).toEqual(["transaction:start", "execute", "audit", "transaction:end"]);
    expect(auditEvents).toEqual([
      {
        auditDataSource: transactionDataSource,
        input: expect.objectContaining({
          actionType: "client.created",
          actorUserId: actor.id,
          afterState: { id: "client-alpha", name: "ООО Альфа" },
          beforeState: null,
          commandInput: { id: "client-alpha" },
          permissionResult: allowedDecision,
          sourceEntity: { type: "Client", id: "client-alpha" },
          sourceWorkflow: "crm_foundation",
          tenantId: actor.tenantId
        })
      }
    ]);
  });
});
