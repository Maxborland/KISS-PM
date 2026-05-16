import { describe, expect, it } from "vitest";

import {
  applyMockAdapterImportPreview,
  createMockAdapterImportPreview,
  type MockAdapterCanonicalImportPayload
} from "./index";

const payload: MockAdapterCanonicalImportPayload = {
  opportunity: {
    externalId: "apply-opp-100",
    title: "Импорт: применяемая сделка",
    account: { externalId: "apply-account-100", displayName: "АКМЕ Apply" },
    contacts: [{ externalId: "apply-contact-100", displayName: "Анна Apply" }],
    plannedStartDate: "2026-09-01",
    desiredFinishDate: "2026-09-30",
    expectedValue: { amount: 1000000, currency: "RUB" },
    probability: 0.8,
    categoryKey: "implementation",
    typologyKey: "portal"
  },
  project: {
    externalId: "apply-project-100",
    title: "Импорт: применяемый проект",
    template: {
      templateId: "template-apply",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 1,
      matchConfidence: 0.9,
      assumptions: []
    },
    demand: {
      totalPlannedWorkHours: 120,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase11.apply",
      formulaVersion: 1,
      confidence: 0.8,
      stageRoleDemands: []
    },
    feasibility: {
      status: "fit",
      severity: "none",
      blockerCodes: []
    }
  },
  tasks: [
    {
      externalId: "apply-task-100",
      title: "Проверить импорт",
      stageKey: "initiation",
      plannedWorkHours: 16,
      dueDate: "2026-09-15",
      participantRoleKeys: ["project_manager"]
    }
  ]
};

function makePreview() {
  return createMockAdapterImportPreview({
    id: "preview-apply-100",
    tenantId: "tenant-a",
    adapterId: "adapter-mock-crm",
    connectionId: "conn-mock-crm-a",
    sourceSystem: "mock-crm",
    payloadFingerprint: "fingerprint-apply-100-v1",
    receivedAt: "2026-05-17T06:33:00+07:00",
    previewedAt: "2026-05-17T06:34:00+07:00",
    payload
  });
}

describe("mock adapter import apply", () => {
  it("persists mappings, batch, canonical refs, and sync audit from a fresh preview", () => {
    const preview = makePreview();

    const result = applyMockAdapterImportPreview({
      preview,
      actorId: "integration-admin-a",
      batchId: "batch-apply-100",
      idempotencyKey: "idem-apply-100",
      appliedAt: "2026-05-17T06:35:00+07:00",
      auditEventId: "audit-apply-100",
      confirmed: true
    });

    expect(result).toMatchObject({
      status: "applied",
      idempotentReplay: false,
      batch: {
        id: "batch-apply-100",
        tenantId: "tenant-a",
        idempotencyKey: "idem-apply-100",
        previewId: "preview-apply-100",
        resultStatus: "applied"
      },
      audit: {
        id: "audit-apply-100",
        tenantId: "tenant-a",
        actorId: "integration-admin-a",
        command: "import_apply",
        result: "success"
      }
    });
    expect(result.mappings).toHaveLength(preview.mappingPreview.length);
    expect(result.mappings.every((mapping) => mapping.lastSyncStatus === "synced")).toBe(true);
    expect(result.mappings.map((mapping) => mapping.mappingKey)).toEqual(preview.mappingPreview.map((mapping) => mapping.mappingKey));
    expect(result.canonicalEntityRefs).toEqual(preview.affectedCanonicalEntities);
    expect(result.audit.details).toMatchObject({
      previewId: "preview-apply-100",
      idempotencyKey: "idem-apply-100",
      mappingCount: preview.mappingPreview.length
    });
  });

  it("returns an idempotent replay without duplicate mappings or audit when the key already exists", () => {
    const first = applyMockAdapterImportPreview({
      preview: makePreview(),
      actorId: "integration-admin-a",
      batchId: "batch-apply-100",
      idempotencyKey: "idem-apply-100",
      appliedAt: "2026-05-17T06:35:00+07:00",
      auditEventId: "audit-apply-100",
      confirmed: true
    });

    const replay = applyMockAdapterImportPreview({
      preview: makePreview(),
      actorId: "integration-admin-a",
      batchId: "batch-apply-duplicate",
      idempotencyKey: "idem-apply-100",
      appliedAt: "2026-05-17T06:36:00+07:00",
      auditEventId: "audit-apply-duplicate",
      confirmed: true,
      existingBatches: [first.batch],
      existingMappings: first.mappings,
      existingAuditEvents: [first.audit]
    });

    expect(replay.status).toBe("idempotent_replay");
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.batch).toEqual(first.batch);
    expect(replay.mappings).toEqual(first.mappings);
    expect(replay.audit).toEqual(first.audit);
  });

  it("rejects conflicting batch or audit identifiers without treating them as idempotent replay", () => {
    const first = applyMockAdapterImportPreview({
      preview: makePreview(),
      actorId: "integration-admin-a",
      batchId: "batch-apply-100",
      idempotencyKey: "idem-apply-100",
      appliedAt: "2026-05-17T06:35:00+07:00",
      auditEventId: "audit-apply-100",
      confirmed: true
    });

    expect(() =>
      applyMockAdapterImportPreview({
        preview: makePreview(),
        actorId: "integration-admin-a",
        batchId: first.batch.id,
        idempotencyKey: "idem-apply-200",
        appliedAt: "2026-05-17T06:36:00+07:00",
        auditEventId: "audit-apply-200",
        confirmed: true,
        existingBatches: [first.batch],
        existingMappings: first.mappings,
        existingAuditEvents: [first.audit]
      })
    ).toThrow("import batch id already exists with another idempotency key");

    expect(() =>
      applyMockAdapterImportPreview({
        preview: makePreview(),
        actorId: "integration-admin-a",
        batchId: "batch-apply-200",
        idempotencyKey: "idem-apply-200",
        appliedAt: "2026-05-17T06:36:00+07:00",
        auditEventId: first.audit.id,
        confirmed: true,
        existingBatches: [first.batch],
        existingMappings: first.mappings,
        existingAuditEvents: [first.audit]
      })
    ).toThrow("import audit id already exists with another target");
  });

  it("rejects unconfirmed, invalid, or tenant-mismatched apply without partial mappings", () => {
    expect(() =>
      applyMockAdapterImportPreview({
        preview: makePreview(),
        actorId: "integration-admin-a",
        batchId: "batch-unconfirmed",
        idempotencyKey: "idem-unconfirmed",
        appliedAt: "2026-05-17T06:37:00+07:00",
        auditEventId: "audit-unconfirmed",
        confirmed: false
      })
    ).toThrow("import apply requires confirmation");

    expect(() =>
      applyMockAdapterImportPreview({
        preview: { ...makePreview(), tenantId: "tenant-b" },
        actorId: "integration-admin-a",
        batchId: "batch-tenant-mismatch",
        idempotencyKey: "idem-tenant-mismatch",
        appliedAt: "2026-05-17T06:38:00+07:00",
        auditEventId: "audit-tenant-mismatch",
        confirmed: true,
        expectedTenantId: "tenant-a"
      })
    ).toThrow("import preview tenant mismatch");
  });
});
