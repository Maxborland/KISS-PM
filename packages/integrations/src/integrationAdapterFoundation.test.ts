import { describe, expect, it } from "vitest";

import {
  IntegrationDomainError,
  buildExternalMappingKey,
  buildImportIdempotencyKey,
  createAdapterFailure,
  createAdapterHealthStatus,
  createExternalMapping,
  createExternalMappingDiagnostic,
  createExternalPayloadEnvelope,
  createIntegrationAdapterDefinition,
  createIntegrationConnection,
  createRateLimitPolicy,
  createRetryPolicy,
  createSyncAuditEvent
} from "./index";

describe("integration adapter foundation", () => {
  it("creates tenant-owned adapter definitions and connections with validated capabilities", () => {
    const adapter = createIntegrationAdapterDefinition({
      id: "adapter-mock-crm",
      tenantId: "tenant-a",
      systemKey: "mock_crm",
      label: "Mock CRM",
      sourceSystem: "mock-crm",
      capabilities: ["import_preview", "import_apply", "health_check", "mapping_diagnostics"],
      active: true
    });

    const connection = createIntegrationConnection({
      id: "conn-mock-crm-a",
      tenantId: "tenant-a",
      adapterId: adapter.id,
      label: "Mock CRM tenant A",
      sourceSystem: adapter.sourceSystem,
      status: "healthy",
      configuredAt: "2026-05-17T06:10:00+07:00",
      healthCheckedAt: "2026-05-17T06:11:00+07:00"
    });

    expect(adapter.capabilities).toEqual(["import_preview", "import_apply", "health_check", "mapping_diagnostics"]);
    expect(connection).toMatchObject({
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      status: "healthy",
      sourceSystem: "mock-crm"
    });
  });

  it("wraps external payloads without leaking mutable payload references", () => {
    const sourcePayload = {
      id: "EXT-100",
      title: "Imported project",
      secretToken: "must not be logged"
    };

    const envelope = createExternalPayloadEnvelope({
      id: "payload-1",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      externalEntityType: "project",
      externalEntityId: "EXT-100",
      payloadFingerprint: "fingerprint-project-100-v1",
      receivedAt: "2026-05-17T06:12:00+07:00",
      payload: sourcePayload
    });

    sourcePayload.title = "Mutated outside";

    expect(envelope.payload).toMatchObject({
      id: "EXT-100",
      title: "Imported project"
    });
    expect(envelope.payload).not.toBe(sourcePayload);
  });

  it("creates tenant-scoped ExternalMapping keys and deterministic import idempotency keys", () => {
    const mapping = createExternalMapping({
      id: "mapping-project-100",
      tenantId: "tenant-a",
      sourceSystem: "mock-crm",
      connectionId: "conn-mock-crm-a",
      externalEntityType: "project",
      externalEntityId: "EXT-100",
      canonicalEntityType: "project",
      canonicalEntityId: "project-100",
      lastBatchId: "batch-1",
      lastSyncStatus: "synced",
      lastSyncedAt: "2026-05-17T06:13:00+07:00",
      safeMetadata: {
        sourceLabel: "Mock project"
      }
    });

    expect(mapping.mappingKey).toBe("tenant-a|mock-crm|project|EXT-100|project");
    expect(buildExternalMappingKey(mapping)).toBe(mapping.mappingKey);
    expect(
      buildImportIdempotencyKey({
        tenantId: "tenant-a",
        connectionId: "conn-mock-crm-a",
        sourceSystem: "mock-crm",
        operation: "import_apply",
        externalEntityType: "project",
        externalEntityId: "EXT-100",
        payloadFingerprint: "fingerprint-project-100-v1"
      })
    ).toBe(
      buildImportIdempotencyKey({
        tenantId: "tenant-a",
        connectionId: "conn-mock-crm-a",
        sourceSystem: "mock-crm",
        operation: "import_apply",
        externalEntityType: "project",
        externalEntityId: "EXT-100",
        payloadFingerprint: "fingerprint-project-100-v1"
      })
    );
  });

  it("redacts secret-looking metadata in mapping diagnostics", () => {
    const mapping = createExternalMapping({
      id: "mapping-opportunity-1",
      tenantId: "tenant-a",
      sourceSystem: "mock-crm",
      connectionId: "conn-mock-crm-a",
      externalEntityType: "opportunity",
      externalEntityId: "OPP-1",
      canonicalEntityType: "opportunity",
      canonicalEntityId: "opportunity-1",
      lastBatchId: "batch-1",
      lastSyncStatus: "synced",
      lastSyncedAt: "2026-05-17T06:14:00+07:00",
      safeMetadata: {
        displayName: "Opportunity 1",
        accessToken: "secret",
        nested: {
          password: "secret",
          visible: "ok"
        }
      }
    });

    expect(createExternalMappingDiagnostic(mapping)).toEqual({
      id: "mapping-opportunity-1",
      tenantId: "tenant-a",
      sourceSystem: "mock-crm",
      connectionId: "conn-mock-crm-a",
      externalEntityType: "opportunity",
      externalEntityId: "OPP-1",
      canonicalEntityType: "opportunity",
      canonicalEntityId: "opportunity-1",
      mappingKey: "tenant-a|mock-crm|opportunity|OPP-1|opportunity",
      lastBatchId: "batch-1",
      lastSyncStatus: "synced",
      lastSyncedAt: "2026-05-17T06:14:00+07:00",
      safeMetadata: {
        displayName: "Opportunity 1",
        accessToken: "[redacted]",
        nested: {
          password: "[redacted]",
          visible: "ok"
        }
      }
    });
  });

  it("creates typed adapter failures and sync audit events", () => {
    const failure = createAdapterFailure({
      code: "adapter_rate_limited",
      message: "Mock adapter rate limited",
      retryable: true,
      retryAfterSeconds: 30,
      occurredAt: "2026-05-17T06:15:00+07:00"
    });
    const audit = createSyncAuditEvent({
      id: "sync-audit-1",
      tenantId: "tenant-a",
      actorId: "integration-admin-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      command: "import_preview",
      result: "failed",
      target: {
        entityType: "import_batch",
        entityId: "batch-1"
      },
      timestamp: "2026-05-17T06:16:00+07:00",
      correlationId: "corr-import-1",
      failure
    });

    expect(audit.failure).toMatchObject({
      code: "adapter_rate_limited",
      retryable: true,
      retryAfterSeconds: 30
    });
    expect(audit).toMatchObject({
      tenantId: "tenant-a",
      command: "import_preview",
      result: "failed"
    });
  });

  it("creates retry/rate-limit policies and adapter health status without leaking failure secrets", () => {
    const retryPolicy = createRetryPolicy({
      maxAttempts: 3,
      backoff: "exponential",
      retryableFailureCodes: ["adapter_rate_limited", "adapter_unavailable"]
    });
    const rateLimitPolicy = createRateLimitPolicy({
      windowSeconds: 60,
      maxRequests: 30,
      retryAfterSeconds: 45
    });
    const health = createAdapterHealthStatus({
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      status: "rate_limited",
      checkedAt: "2026-05-17T06:52:00+07:00",
      failure: {
        code: "adapter_rate_limited",
        message: "Rate limited with token secret-token",
        retryable: true,
        retryAfterSeconds: 45,
        occurredAt: "2026-05-17T06:52:00+07:00"
      },
      retryPolicy,
      rateLimitPolicy
    });

    expect(health).toMatchObject({
      tenantId: "tenant-a",
      status: "rate_limited",
      retryPolicy: {
        maxAttempts: 3,
        backoff: "exponential",
        retryableFailureCodes: ["adapter_rate_limited", "adapter_unavailable"]
      },
      rateLimitPolicy: {
        windowSeconds: 60,
        maxRequests: 30,
        retryAfterSeconds: 45
      },
      failure: {
        code: "adapter_rate_limited",
        retryable: true,
        retryAfterSeconds: 45
      }
    });
    expect(health.failure?.message).not.toContain("secret-token");
  });

  it("redacts secret-looking sync audit details before they can reach diagnostics", () => {
    const audit = createSyncAuditEvent({
      id: "sync-audit-secret",
      tenantId: "tenant-a",
      actorId: "integration-admin-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      command: "mapping_diagnostic",
      result: "success",
      target: {
        entityType: "external_mapping",
        entityId: "mapping-1"
      },
      timestamp: "2026-05-17T06:16:00+07:00",
      correlationId: "corr-import-2",
      details: {
        publicStatus: "visible",
        credentialSecret: "must-not-leak",
        nested: {
          apiKey: "must-not-leak",
          batchId: "batch-1"
        }
      }
    });

    expect(audit.details).toEqual({
      publicStatus: "visible",
      credentialSecret: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        batchId: "batch-1"
      }
    });
  });

  it("throws typed errors for invalid tenant ownership or unsafe inputs", () => {
    expect(() =>
      createIntegrationAdapterDefinition({
        id: "adapter-broken",
        tenantId: "",
        systemKey: "broken",
        label: "Broken",
        sourceSystem: "mock-crm",
        capabilities: ["import_preview"],
        active: true
      })
    ).toThrow("tenantId is required");

    expect(() =>
      createAdapterFailure({
        code: "adapter_rate_limited",
        message: "Broken",
        retryable: true,
        retryAfterSeconds: 0,
        occurredAt: "2026-05-17T06:15:00+07:00"
      })
    ).toThrow("retryAfterSeconds must be a positive integer");

    try {
      createIntegrationConnection({
        id: "conn-broken",
        tenantId: "tenant-a",
        adapterId: "adapter-mock-crm",
        label: "Broken",
        sourceSystem: "mock-crm",
        status: "offline" as never,
        configuredAt: "not-a-date"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationDomainError);
      expect((error as IntegrationDomainError).code).toBe("validation_error");
    }
  });
});
