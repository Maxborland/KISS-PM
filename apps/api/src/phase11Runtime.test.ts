import { describe, expect, it } from "vitest";

import { createPhase11RuntimeState } from "./phase11Runtime";
import type { MockAdapterCanonicalImportPayload } from "@kiss-pm/integrations";

const payload: MockAdapterCanonicalImportPayload = {
  opportunity: {
    externalId: "runtime-opp-100",
    title: "Импорт: runtime сделка",
    account: { externalId: "runtime-account-100", displayName: "Runtime account" },
    contacts: [{ externalId: "runtime-contact-100", displayName: "Runtime contact" }],
    plannedStartDate: "2026-10-01",
    desiredFinishDate: "2026-10-31",
    expectedValue: { amount: 2000000, currency: "RUB" },
    probability: 0.77,
    categoryKey: "implementation",
    typologyKey: "portal"
  },
  project: {
    externalId: "runtime-project-100",
    title: "Импорт: runtime проект",
    template: {
      templateId: "runtime-template",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 1,
      matchConfidence: 0.9,
      assumptions: []
    },
    demand: {
      totalPlannedWorkHours: 80,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase11.runtime",
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
      externalId: "runtime-task-100",
      title: "Runtime task",
      stageKey: "initiation",
      plannedWorkHours: 12,
      dueDate: "2026-10-15",
      participantRoleKeys: ["project_manager"]
    }
  ]
};

describe("phase11 integration runtime", () => {
  it("applies a fresh preview once and replays the same idempotency key without duplicate mappings, batches, or audit", () => {
    const runtime = createPhase11RuntimeState();
    const preview = runtime.previewMockImport({
      id: "preview-runtime-100",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-100-v1",
      receivedAt: "2026-05-17T06:39:00+07:00",
      previewedAt: "2026-05-17T06:40:00+07:00",
      payload
    });

    const first = runtime.applyImport({
      tenantId: "tenant-a",
      actorId: "integration-admin-a",
      previewId: preview.id,
      batchId: "batch-runtime-100",
      idempotencyKey: "idem-runtime-100",
      auditEventId: "audit-runtime-100",
      appliedAt: "2026-05-17T06:41:00+07:00",
      confirmed: true
    });
    const replay = runtime.applyImport({
      tenantId: "tenant-a",
      actorId: "integration-admin-a",
      previewId: preview.id,
      batchId: "batch-runtime-duplicate",
      idempotencyKey: "idem-runtime-100",
      auditEventId: "audit-runtime-duplicate",
      appliedAt: "2026-05-17T06:42:00+07:00",
      confirmed: true
    });

    expect(first.status).toBe("applied");
    expect(replay.status).toBe("idempotent_replay");
    expect(runtime.listImportBatches("tenant-a")).toHaveLength(1);
    expect(runtime.listMappings("tenant-a")).toHaveLength(preview.mappingPreview.length);
    expect(runtime.listSyncAudit("tenant-a")).toHaveLength(1);
    expect(runtime.listMappings("tenant-b")).toEqual([]);
  });

  it("rejects stale previews and cross-tenant apply without partial mutation", () => {
    const runtime = createPhase11RuntimeState();
    const stalePreview = runtime.previewMockImport({
      id: "preview-runtime-stale",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-stale-v1",
      receivedAt: "2026-05-17T06:43:00+07:00",
      previewedAt: "2026-05-17T06:44:00+07:00",
      payload
    });
    runtime.previewMockImport({
      id: "preview-runtime-newer",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-newer-v1",
      receivedAt: "2026-05-17T06:45:00+07:00",
      previewedAt: "2026-05-17T06:46:00+07:00",
      payload
    });

    expect(() =>
      runtime.applyImport({
        tenantId: "tenant-a",
        actorId: "integration-admin-a",
        previewId: stalePreview.id,
        batchId: "batch-stale",
        idempotencyKey: "idem-stale",
        auditEventId: "audit-stale",
        appliedAt: "2026-05-17T06:47:00+07:00",
        confirmed: true
      })
    ).toThrow("import preview is stale");
    expect(() =>
      runtime.applyImport({
        tenantId: "tenant-b",
        actorId: "integration-admin-b",
        previewId: "preview-runtime-newer",
        batchId: "batch-cross",
        idempotencyKey: "idem-cross",
        auditEventId: "audit-cross",
        appliedAt: "2026-05-17T06:48:00+07:00",
        confirmed: true
      })
    ).toThrow("import preview tenant mismatch");
    expect(runtime.listImportBatches("tenant-a")).toEqual([]);
    expect(runtime.listMappings("tenant-a")).toEqual([]);
    expect(runtime.listSyncAudit("tenant-a")).toEqual([]);
  });

  it("keeps stale-preview versions and storage isolated by tenant", () => {
    const runtime = createPhase11RuntimeState();
    const tenantAPreview = runtime.previewMockImport({
      id: "preview-shared",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-tenant-a",
      receivedAt: "2026-05-17T06:49:00+07:00",
      previewedAt: "2026-05-17T06:50:00+07:00",
      payload
    });
    runtime.previewMockImport({
      id: "preview-shared",
      tenantId: "tenant-b",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-b",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-tenant-b",
      receivedAt: "2026-05-17T06:51:00+07:00",
      previewedAt: "2026-05-17T06:52:00+07:00",
      payload: {
        ...payload,
        opportunity: { ...payload.opportunity, externalId: "runtime-opp-b" },
        project: { ...payload.project, externalId: "runtime-project-b" }
      }
    });

    const tenantAResult = runtime.applyImport({
      tenantId: "tenant-a",
      actorId: "integration-admin-a",
      previewId: tenantAPreview.id,
      batchId: "batch-shared",
      idempotencyKey: "idem-shared",
      auditEventId: "audit-shared",
      appliedAt: "2026-05-17T06:53:00+07:00",
      confirmed: true
    });
    const tenantBResult = runtime.applyImport({
      tenantId: "tenant-b",
      actorId: "integration-admin-b",
      previewId: "preview-shared",
      batchId: "batch-shared",
      idempotencyKey: "idem-shared",
      auditEventId: "audit-shared",
      appliedAt: "2026-05-17T06:54:00+07:00",
      confirmed: true
    });

    expect(tenantAResult.batch.tenantId).toBe("tenant-a");
    expect(tenantBResult.batch.tenantId).toBe("tenant-b");
    expect(runtime.listImportBatches("tenant-a")).toHaveLength(1);
    expect(runtime.listImportBatches("tenant-b")).toHaveLength(1);
    expect(runtime.listSyncAudit("tenant-a")).toHaveLength(1);
    expect(runtime.listSyncAudit("tenant-b")).toHaveLength(1);
  });
});
