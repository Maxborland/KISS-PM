export const PHASE11_FIXTURE_TIMESTAMP = "2026-05-17T08:03:00.000Z";

export type Phase11TenantIntegrationFixture = {
  tenantId: string;
  adminUserId: string;
  readOnlyUserId: string;
  projectManagerUserId: string;
  adapterId: string;
  connectionId: string;
  validPayloadFixtureKey: "mock-crm-valid";
  invalidPayloadFixtureKey: "mock-crm-invalid";
  importBatchId: string;
  idempotencyBatchId: string;
  idempotencyReplayBatchId: string;
  idempotencyKey: string;
  failureBatchId: string;
  canonicalContinuityBatchId: string;
  diagnosticsBatchId: string;
  importedProjectTitle: string;
  importedTaskTitle: string;
  expectedMappingEntityTypes: string[];
  auditCommands: string[];
};

export type Phase11FixtureSeed = {
  generatedAt: string;
  e2eIds: string[];
  e2ePaths: string[];
  tenantA: Phase11TenantIntegrationFixture;
  tenantB: Phase11TenantIntegrationFixture;
};

const tenantA: Phase11TenantIntegrationFixture = {
  tenantId: "tenant-a",
  adminUserId: "tenant-admin-a",
  readOnlyUserId: "readonly-observer-a",
  projectManagerUserId: "project-manager-a",
  adapterId: "adapter-mock-crm",
  connectionId: "conn-mock-crm-a",
  validPayloadFixtureKey: "mock-crm-valid",
  invalidPayloadFixtureKey: "mock-crm-invalid",
  importBatchId: "batch-e2e-100-p11",
  idempotencyBatchId: "batch-e2e-101-p11",
  idempotencyReplayBatchId: "batch-e2e-101-p11-replay",
  idempotencyKey: "idem-e2e-101-p11",
  failureBatchId: "batch-e2e-102-p11",
  canonicalContinuityBatchId: "batch-e2e-103-p11",
  diagnosticsBatchId: "batch-e2e-104-p11",
  importedProjectTitle: "Импорт: API проект",
  importedTaskTitle: "API imported task",
  expectedMappingEntityTypes: ["account", "contact", "opportunity", "project", "task"],
  auditCommands: ["import_apply", "integration.import.materialize_project"]
};

const tenantB: Phase11TenantIntegrationFixture = {
  tenantId: "tenant-b",
  adminUserId: "tenant-admin-b",
  readOnlyUserId: "user-b",
  projectManagerUserId: "tenant-admin-b",
  adapterId: "adapter-mock-crm",
  connectionId: "conn-mock-crm-b",
  validPayloadFixtureKey: "mock-crm-valid",
  invalidPayloadFixtureKey: "mock-crm-invalid",
  importBatchId: "batch-e2e-100-p11-b",
  idempotencyBatchId: "batch-e2e-101-p11-b",
  idempotencyReplayBatchId: "batch-e2e-101-p11-b-replay",
  idempotencyKey: "idem-e2e-101-p11-b",
  failureBatchId: "batch-e2e-102-p11-b",
  canonicalContinuityBatchId: "batch-e2e-103-p11-b",
  diagnosticsBatchId: "batch-e2e-104-p11-b",
  importedProjectTitle: "Импорт: API проект",
  importedTaskTitle: "API imported task",
  expectedMappingEntityTypes: ["account", "contact", "opportunity", "project", "task"],
  auditCommands: ["import_apply", "integration.import.materialize_project"]
};

function cloneTenant(input: Phase11TenantIntegrationFixture): Phase11TenantIntegrationFixture {
  return {
    ...input,
    expectedMappingEntityTypes: [...input.expectedMappingEntityTypes],
    auditCommands: [...input.auditCommands]
  };
}

export function getPhase11FixtureSeed(): Phase11FixtureSeed {
  return {
    generatedAt: PHASE11_FIXTURE_TIMESTAMP,
    e2eIds: ["E2E-100", "E2E-101", "E2E-102", "E2E-103", "E2E-104"],
    e2ePaths: [
      "e2e/tests/phase11/adapter-import.spec.ts",
      "e2e/tests/phase11/adapter-idempotency.spec.ts",
      "e2e/tests/phase11/adapter-failure.spec.ts",
      "e2e/tests/phase11/imported-project-canonical.spec.ts",
      "e2e/tests/phase11/external-mapping-diagnostics.spec.ts"
    ],
    tenantA: cloneTenant(tenantA),
    tenantB: cloneTenant(tenantB)
  };
}
