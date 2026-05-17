import { describe, expect, it } from "vitest";

import { createPhase11RuntimeState } from "./phase11Runtime";
import { IntegrationDomainError, type MockAdapterCanonicalImportPayload } from "@kiss-pm/integrations";

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
    expect(runtime.listSyncAudit("tenant-a")).toEqual([
      expect.objectContaining({
        id: "audit-stale",
        command: "import_apply",
        result: "failed",
        failure: expect.objectContaining({ code: "stale_preview" })
      })
    ]);
    expect(runtime.listSyncAudit("tenant-b")).toEqual([
      expect.objectContaining({
        id: "audit-cross",
        command: "import_apply",
        result: "failed",
        failure: expect.objectContaining({ code: "tenant_mismatch" })
      })
    ]);
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

  it("records rate-limited adapter failure with retry metadata without storing preview or import state", () => {
    const runtime = createPhase11RuntimeState();
    runtime.setConnectionFailureMode({
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      failure: {
        code: "adapter_rate_limited",
        message: "Mock adapter rate limited",
        retryable: true,
        retryAfterSeconds: 45,
        occurredAt: "2026-05-17T06:55:00+07:00"
      }
    });

    expect(() =>
      runtime.previewMockImport({
        id: "preview-rate-limited",
        tenantId: "tenant-a",
        adapterId: "adapter-mock-crm",
        connectionId: "conn-mock-crm-a",
        sourceSystem: "mock-crm",
        payloadFingerprint: "fingerprint-rate-limited",
        receivedAt: "2026-05-17T06:55:00+07:00",
        previewedAt: "2026-05-17T06:56:00+07:00",
        payload
      })
    ).toThrow("Mock adapter rate limited");

    const audit = runtime.listSyncAudit("tenant-a");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      tenantId: "tenant-a",
      command: "import_preview",
      result: "failed",
      failure: {
        code: "adapter_rate_limited",
        retryable: true,
        retryAfterSeconds: 45
      },
      details: {
        previewId: "preview-rate-limited",
        retryAfterSeconds: 45
      }
    });
    expect(runtime.listImportBatches("tenant-a")).toEqual([]);
    expect(runtime.listMappings("tenant-a")).toEqual([]);
    expect(runtime.listSyncAudit("tenant-b")).toEqual([]);

    runtime.clearConnectionFailureMode({ tenantId: "tenant-a", connectionId: "conn-mock-crm-a" });
    const recoveredPreview = runtime.previewMockImport({
      id: "preview-after-rate-limit",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-after-rate-limit",
      receivedAt: "2026-05-17T06:57:00+07:00",
      previewedAt: "2026-05-17T06:58:00+07:00",
      payload
    });
    expect(recoveredPreview.validationIssues).toEqual([]);
  });

  it("records invalid payload diagnostics without batches or mappings and recovers after a corrected preview", () => {
    const runtime = createPhase11RuntimeState();
    const invalidPreview = runtime.previewMockImport({
      id: "preview-invalid-runtime",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-invalid-runtime",
      receivedAt: "2026-05-17T06:57:00+07:00",
      previewedAt: "2026-05-17T06:58:00+07:00",
      payload: {
        ...payload,
        opportunity: {
          ...payload.opportunity,
          title: ""
        }
      }
    });

    expect(invalidPreview.validationIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "canonical_title_missing", severity: "blocking" })])
    );
    expect(runtime.listImportBatches("tenant-a")).toEqual([]);
    expect(runtime.listMappings("tenant-a")).toEqual([]);
    expect(runtime.listSyncAudit("tenant-a")).toEqual([
      expect.objectContaining({
        command: "import_preview",
        result: "failed",
        failure: expect.objectContaining({ code: "invalid_payload", retryable: false }),
        details: expect.objectContaining({ previewId: "preview-invalid-runtime", validationIssueCount: 1 })
      })
    ]);

    const recovered = runtime.previewMockImport({
      id: "preview-recovered-runtime",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-recovered-runtime",
      receivedAt: "2026-05-17T06:59:00+07:00",
      previewedAt: "2026-05-17T07:00:00+07:00",
      payload
    });

    expect(recovered.validationIssues).toEqual([]);
    expect(recovered.mutatesState).toBe(false);
  });

  it("records failed apply audit without partial mappings or batches when preconditions reject", () => {
    const runtime = createPhase11RuntimeState();
    const stalePreview = runtime.previewMockImport({
      id: "preview-stale-apply-audit",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-stale-apply-v1",
      receivedAt: "2026-05-17T07:01:00+07:00",
      previewedAt: "2026-05-17T07:02:00+07:00",
      payload
    });
    runtime.previewMockImport({
      id: "preview-stale-apply-newer",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-stale-apply-v2",
      receivedAt: "2026-05-17T07:03:00+07:00",
      previewedAt: "2026-05-17T07:04:00+07:00",
      payload
    });

    expect(() =>
      runtime.applyImport({
        tenantId: "tenant-a",
        actorId: "integration-admin-a",
        previewId: stalePreview.id,
        batchId: "batch-stale-apply",
        idempotencyKey: "idem-stale-apply",
        auditEventId: "audit-stale-apply",
        appliedAt: "2026-05-17T07:05:00+07:00",
        confirmed: true
      })
    ).toThrow(IntegrationDomainError);

    expect(runtime.listImportBatches("tenant-a")).toEqual([]);
    expect(runtime.listMappings("tenant-a")).toEqual([]);
    expect(runtime.listSyncAudit("tenant-a")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "audit-stale-apply",
          command: "import_apply",
          result: "failed",
          target: {
            entityType: "import_batch",
            entityId: "batch-stale-apply"
          },
          failure: expect.objectContaining({ code: "stale_preview", retryable: true })
        })
      ])
    );
  });

  it("does not overwrite successful audit evidence when a failed apply reuses an audit id", () => {
    const runtime = createPhase11RuntimeState();
    const preview = runtime.previewMockImport({
      id: "preview-audit-collision",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-audit-collision",
      receivedAt: "2026-05-17T07:06:00+07:00",
      previewedAt: "2026-05-17T07:07:00+07:00",
      payload
    });
    const first = runtime.applyImport({
      tenantId: "tenant-a",
      actorId: "integration-admin-a",
      previewId: preview.id,
      batchId: "batch-audit-collision",
      idempotencyKey: "idem-audit-collision",
      auditEventId: "audit-audit-collision",
      appliedAt: "2026-05-17T07:08:00+07:00",
      confirmed: true
    });

    expect(() =>
      runtime.applyImport({
        tenantId: "tenant-a",
        actorId: "integration-admin-a",
        previewId: preview.id,
        batchId: "batch-audit-collision-2",
        idempotencyKey: "idem-audit-collision-2",
        auditEventId: first.audit.id,
        appliedAt: "2026-05-17T07:09:00+07:00",
        confirmed: true
      })
    ).toThrow("import audit id already exists with another target");

    const audit = runtime.listSyncAudit("tenant-a");
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.audit.id,
          result: "success",
          target: {
            entityType: "import_batch",
            entityId: first.batch.id
          }
        }),
        expect.objectContaining({
          id: "audit-batch-audit-collision-2-failure",
          result: "failed",
          failure: expect.objectContaining({ code: "idempotency_conflict" })
        })
      ])
    );
    expect(runtime.listImportBatches("tenant-a")).toHaveLength(1);
  });

  it("returns tenant-scoped migration validation report and dry-run summary without mutating import state", () => {
    const runtime = createPhase11RuntimeState();
    const preview = runtime.previewMockImport({
      id: "preview-runtime-report",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-report",
      receivedAt: "2026-05-17T07:10:00+07:00",
      previewedAt: "2026-05-17T07:11:00+07:00",
      payload
    });

    const report = runtime.getMigrationValidationReport({
      tenantId: "tenant-a",
      previewId: preview.id,
      generatedAt: "2026-05-17T07:12:00+07:00"
    });
    const dryRun = runtime.getImportDryRunSummary({
      tenantId: "tenant-a",
      previewId: preview.id,
      generatedAt: "2026-05-17T07:12:30+07:00"
    });

    expect(report).toMatchObject({
      tenantId: "tenant-a",
      previewId: preview.id,
      mutatesState: false,
      safeToApply: true,
      summary: {
        creates: preview.report.creates,
        updates: preview.report.updates,
        skips: preview.report.skips,
        errors: 0
      }
    });
    expect(dryRun).toMatchObject({
      tenantId: "tenant-a",
      previewId: preview.id,
      mutatesState: false,
      canApply: true,
      expectedCreates: preview.report.creates
    });
    expect(runtime.listImportBatches("tenant-a")).toEqual([]);
    expect(runtime.listMappings("tenant-a")).toEqual([]);
  });

  it("denies cross-tenant migration validation report lookup without leaking report details", () => {
    const runtime = createPhase11RuntimeState();
    const preview = runtime.previewMockImport({
      id: "preview-runtime-report-cross",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-report-cross",
      receivedAt: "2026-05-17T07:13:00+07:00",
      previewedAt: "2026-05-17T07:14:00+07:00",
      payload
    });

    expect(() =>
      runtime.getMigrationValidationReport({
        tenantId: "tenant-b",
        previewId: preview.id,
        generatedAt: "2026-05-17T07:15:00+07:00"
      })
    ).toThrow("import preview tenant mismatch");
    expect(() =>
      runtime.getImportDryRunSummary({
        tenantId: "tenant-b",
        previewId: "missing-preview",
        generatedAt: "2026-05-17T07:16:00+07:00"
      })
    ).toThrow("import preview is missing");
    expect(runtime.listImportBatches("tenant-b")).toEqual([]);
    expect(runtime.listMappings("tenant-b")).toEqual([]);
    expect(runtime.listSyncAudit("tenant-b")).toEqual([]);
  });

  it("rejects stale migration validation reports so dry-run evidence cannot greenlight an unapplyable preview", () => {
    const runtime = createPhase11RuntimeState();
    const stalePreview = runtime.previewMockImport({
      id: "preview-runtime-report-stale",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-report-stale",
      receivedAt: "2026-05-17T07:17:00+07:00",
      previewedAt: "2026-05-17T07:18:00+07:00",
      payload
    });
    runtime.previewMockImport({
      id: "preview-runtime-report-fresh",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-runtime-report-fresh",
      receivedAt: "2026-05-17T07:19:00+07:00",
      previewedAt: "2026-05-17T07:20:00+07:00",
      payload
    });

    expect(() =>
      runtime.getMigrationValidationReport({
        tenantId: "tenant-a",
        previewId: stalePreview.id,
        generatedAt: "2026-05-17T07:21:00+07:00"
      })
    ).toThrow("import preview is stale");
    expect(() =>
      runtime.getImportDryRunSummary({
        tenantId: "tenant-a",
        previewId: stalePreview.id,
        generatedAt: "2026-05-17T07:21:30+07:00"
      })
    ).toThrow("import preview is stale");
    expect(runtime.listImportBatches("tenant-a")).toEqual([]);
    expect(runtime.listMappings("tenant-a")).toEqual([]);
  });
});
