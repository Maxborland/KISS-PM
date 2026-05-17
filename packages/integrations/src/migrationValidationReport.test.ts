import { describe, expect, it } from "vitest";

import {
  createExternalMapping,
  createImportDryRunSummary,
  createMigrationValidationReport,
  createMockAdapterImportPreview,
  IntegrationDomainError,
  type MockAdapterCanonicalImportPayload
} from "./index";

const payload: MockAdapterCanonicalImportPayload = {
  opportunity: {
    externalId: "report-opp-100",
    title: "Импорт: отчет валидации",
    account: {
      externalId: "report-account-100",
      displayName: "Report account"
    },
    contacts: [{ externalId: "report-contact-100", displayName: "Report contact" }],
    plannedStartDate: "2026-11-01",
    desiredFinishDate: "2026-11-30",
    expectedValue: { amount: 1500000, currency: "RUB" },
    probability: 0.68,
    categoryKey: "implementation",
    typologyKey: "portal"
  },
  project: {
    externalId: "report-project-100",
    title: "Импорт: проект отчета",
    template: {
      templateId: "report-template",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 1,
      matchConfidence: 0.86,
      assumptions: []
    },
    demand: {
      totalPlannedWorkHours: 96,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase11.report",
      formulaVersion: 1,
      confidence: 0.82,
      stageRoleDemands: []
    },
    feasibility: {
      status: "fit",
      severity: "warning",
      blockerCodes: ["external_calendar_not_synced"]
    }
  },
  tasks: [
    {
      externalId: "report-task-100",
      title: "Проверить imported scope",
      stageKey: "initiation",
      plannedWorkHours: 20,
      dueDate: "2026-11-12",
      participantRoleKeys: ["project_manager"]
    },
    {
      externalId: "report-task-101",
      title: "Согласовать миграцию",
      stageKey: "planning",
      plannedWorkHours: 28,
      dueDate: "2026-12-05",
      participantRoleKeys: ["project_manager"]
    }
  ]
};

describe("migration validation report and dry-run summary", () => {
  it("summarizes creates, updates, skips, warnings, canonical refs, and mapping samples without mutating preview", () => {
    const existingMappings = [
      createExternalMapping({
        id: "mapping-report-project-existing",
        tenantId: "tenant-a",
        sourceSystem: "mock-crm",
        connectionId: "conn-mock-crm-a",
        externalEntityType: "project",
        externalEntityId: "report-project-100",
        canonicalEntityType: "project",
        canonicalEntityId: "project-existing",
        lastBatchId: "batch-existing",
        lastSyncStatus: "synced",
        lastSyncedAt: "2026-05-17T08:00:00+07:00",
        safeMetadata: { payloadFingerprint: "fingerprint-old" }
      }),
      createExternalMapping({
        id: "mapping-report-task-existing",
        tenantId: "tenant-a",
        sourceSystem: "mock-crm",
        connectionId: "conn-mock-crm-a",
        externalEntityType: "task",
        externalEntityId: "report-task-100",
        canonicalEntityType: "task",
        canonicalEntityId: "task-existing",
        lastBatchId: "batch-existing",
        lastSyncStatus: "synced",
        lastSyncedAt: "2026-05-17T08:00:00+07:00",
        safeMetadata: { payloadFingerprint: "fingerprint-report-v1" }
      })
    ];
    const preview = createMockAdapterImportPreview({
      id: "preview-report-100",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-report-v1",
      receivedAt: "2026-05-17T08:01:00+07:00",
      previewedAt: "2026-05-17T08:02:00+07:00",
      payload,
      existingMappings
    });
    const before = structuredClone(preview);

    const report = createMigrationValidationReport({
      preview,
      generatedAt: "2026-05-17T08:03:00+07:00",
      sampleLimit: 3
    });

    expect(report).toMatchObject({
      id: "validation-report-preview-report-100",
      tenantId: "tenant-a",
      previewId: "preview-report-100",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      generatedAt: "2026-05-17T08:03:00+07:00",
      mutatesState: false,
      safeToApply: true,
      summary: {
        creates: 4,
        updates: 1,
        skips: 1,
        errors: 0,
        totalAffected: 6,
        blockingIssues: 0,
        warningIssues: 1
      }
    });
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: "task_due_date_outside_project_window",
        fieldPath: "tasks.report-task-101.dueDate",
        recoveryText: expect.any(String)
      })
    ]);
    expect(report.sampleMappings).toHaveLength(3);
    expect(report.affectedCanonicalEntities).toHaveLength(preview.affectedCanonicalEntities.length);
    expect(report.recoveryActions).toEqual([
      expect.objectContaining({
        code: "task_due_date_outside_project_window",
        fieldPath: "tasks.report-task-101.dueDate"
      })
    ]);
    expect(report).not.toHaveProperty("canonical");
    expect(report).not.toHaveProperty("payload");
    expect(preview).toEqual(before);
  });

  it("marks blocking previews unsafe and returns recovery blockers without canonical payload leakage", () => {
    const preview = createMockAdapterImportPreview({
      id: "preview-report-invalid",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-report-invalid",
      receivedAt: "2026-05-17T08:04:00+07:00",
      previewedAt: "2026-05-17T08:05:00+07:00",
      payload: {
        ...payload,
        opportunity: {
          ...payload.opportunity,
          title: "",
          desiredFinishDate: "2026-10-01"
        }
      }
    });

    const report = createMigrationValidationReport({
      preview,
      generatedAt: "2026-05-17T08:06:00+07:00"
    });
    const dryRun = createImportDryRunSummary({
      preview,
      generatedAt: "2026-05-17T08:06:30+07:00"
    });

    expect(report.safeToApply).toBe(false);
    expect(report.summary).toMatchObject({
      creates: 0,
      updates: 0,
      skips: 0,
      totalAffected: 0,
      blockingIssues: 2
    });
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "canonical_title_missing", severity: "blocking" }),
        expect.objectContaining({ code: "date_window_invalid", severity: "blocking" })
      ])
    );
    expect(report.sampleMappings).toEqual([]);
    expect(report.affectedCanonicalEntities).toEqual([]);
    expect(dryRun).toMatchObject({
      previewId: "preview-report-invalid",
      mutatesState: false,
      canApply: false,
      expectedCreates: 0,
      expectedUpdates: 0,
      expectedSkips: 0,
      expectedErrors: 2
    });
    expect(JSON.stringify(report)).not.toContain('"canonical":');
    expect(JSON.stringify(report)).not.toContain("expectedValue");
  });

  it("rejects invalid sample limits instead of silently returning misleading evidence", () => {
    const preview = createMockAdapterImportPreview({
      id: "preview-report-limit",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-report-limit",
      receivedAt: "2026-05-17T08:07:00+07:00",
      previewedAt: "2026-05-17T08:08:00+07:00",
      payload
    });

    expect(() =>
      createMigrationValidationReport({
        preview,
        generatedAt: "2026-05-17T08:09:00+07:00",
        sampleLimit: 0
      })
    ).toThrow(IntegrationDomainError);
  });
});
