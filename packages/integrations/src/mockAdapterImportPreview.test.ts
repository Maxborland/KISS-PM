import { describe, expect, it } from "vitest";

import { createAccount, createContact, createOpportunity, createOpportunityStage } from "@kiss-pm/crm-core";
import { createProjectDraftFromOpportunity } from "@kiss-pm/project-core";

import {
  createExternalMapping,
  createMockAdapterImportPreview,
  type MockAdapterCanonicalImportPayload
} from "./index";

const basePayload: MockAdapterCanonicalImportPayload = {
  opportunity: {
    externalId: "mock-opp-100",
    title: "Импорт: внедрение портала",
    account: {
      externalId: "mock-account-100",
      displayName: "АКМЕ Импорт"
    },
    contacts: [
      {
        externalId: "mock-contact-100",
        displayName: "Анна Импорт",
        email: "anna.import@example.test"
      }
    ],
    plannedStartDate: "2026-08-03",
    desiredFinishDate: "2026-09-11",
    expectedValue: { amount: 1800000, currency: "RUB" },
    probability: 0.72,
    categoryKey: "implementation",
    typologyKey: "portal",
    scopeHints: [{ key: "integration_count", label: "Интеграции", value: 3 }]
  },
  project: {
    externalId: "mock-project-100",
    title: "Импорт: внедрение портала",
    template: {
      templateId: "process-template-integrations-tenant-a",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 2,
      matchConfidence: 0.9,
      assumptions: [{ code: "mock_adapter_match", message: "Шаблон выбран по данным mock adapter." }]
    },
    demand: {
      totalPlannedWorkHours: 204,
      scenarioKey: "baseline",
      scenarioLabel: "Базовый сценарий",
      formulaKey: "phase11.mock_adapter_linear",
      formulaVersion: 1,
      confidence: 0.84,
      stageRoleDemands: [
        {
          stageKey: "initiation",
          stageLabel: "Инициация",
          roleKey: "project_manager",
          roleLabel: "Руководитель проекта",
          plannedWorkHours: 64
        }
      ]
    },
    feasibility: {
      status: "fit",
      severity: "warning",
      blockerCodes: ["external_calendar_not_synced"]
    }
  },
  tasks: [
    {
      externalId: "mock-task-100",
      title: "Согласовать импортированные требования",
      stageKey: "initiation",
      plannedWorkHours: 24,
      dueDate: "2026-08-14",
      participantRoleKeys: ["project_manager"]
    }
  ]
};

describe("mock adapter canonical import preview", () => {
  it("maps mock adapter payload into canonical opportunity, project draft, task previews, and mapping previews", () => {
    const preview = createMockAdapterImportPreview({
      id: "preview-mock-100",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-mock-100-v1",
      receivedAt: "2026-05-17T06:22:00+07:00",
      previewedAt: "2026-05-17T06:23:00+07:00",
      payload: basePayload
    });

    expect(preview).toMatchObject({
      id: "preview-mock-100",
      tenantId: "tenant-a",
      mutatesState: false,
      report: {
        creates: 5,
        updates: 0,
        skips: 0,
        errors: 0
      }
    });
    expect(preview.validationIssues).toEqual([]);
    expect(preview.affectedCanonicalEntities.map((entity) => entity.entityType)).toEqual([
      "account",
      "contact",
      "opportunity",
      "project",
      "task"
    ]);
    expect(preview.affectedCanonicalEntities.map((entity) => entity.entityId).join(" ")).not.toContain("mock-opp-100");
    expect(preview.affectedCanonicalEntities.map((entity) => entity.entityId).join(" ")).not.toContain("mock-project-100");
    expect(preview.affectedCanonicalEntities.map((entity) => entity.entityId).join(" ")).not.toContain("mock-task-100");
    expect(preview.mappingPreview.map((mapping) => mapping.action)).toEqual(["create", "create", "create", "create", "create"]);

    const stage = createOpportunityStage({
      id: "stage-qualified",
      tenantId: "tenant-a",
      systemKey: "qualified",
      label: "Квалифицировано",
      sortOrder: 1,
      active: true
    });
    const account = createAccount({
      ...preview.canonical.account!,
      createdAt: "2026-05-17T06:24:00+07:00"
    });
    const contact = createContact(preview.canonical.contacts[0]);
    const opportunity = createOpportunity({
      ...preview.canonical.opportunity!,
      stage,
      account,
      contacts: [contact],
      createdAt: "2026-05-17T06:24:00+07:00"
    });
    const draft = createProjectDraftFromOpportunity({
      ...preview.canonical.projectDraft!,
      createdBy: "integration-admin-a",
      createdAt: "2026-05-17T06:24:00+07:00",
      correlationId: "corr-preview-mock-100"
    });

    expect(opportunity.id).toMatch(/^imported-opportunity-/);
    expect(opportunity.id).not.toContain("mock-opp-100");
    expect(draft.id).toMatch(/^imported-draft-/);
    expect(draft.id).not.toContain("mock-project-100");
    expect(draft.sourceOpportunity.opportunityId).toBe(opportunity.id);
    expect(draft.demand.totalPlannedWorkHours).toBe(204);
  });

  it("uses existing tenant mappings to report updates and skips without mutating inputs", () => {
    const existingMappings = [
      createExternalMapping({
        id: "mapping-opportunity-existing",
        tenantId: "tenant-a",
        sourceSystem: "mock-crm",
        connectionId: "conn-mock-crm-a",
        externalEntityType: "opportunity",
        externalEntityId: "mock-opp-100",
        canonicalEntityType: "opportunity",
        canonicalEntityId: "opportunity-existing",
        lastBatchId: "batch-existing",
        lastSyncStatus: "synced",
        lastSyncedAt: "2026-05-16T10:00:00+07:00",
        safeMetadata: { payloadFingerprint: "fingerprint-old" }
      }),
      createExternalMapping({
        id: "mapping-task-existing",
        tenantId: "tenant-a",
        sourceSystem: "mock-crm",
        connectionId: "conn-mock-crm-a",
        externalEntityType: "task",
        externalEntityId: "mock-task-100",
        canonicalEntityType: "task",
        canonicalEntityId: "task-existing",
        lastBatchId: "batch-existing",
        lastSyncStatus: "synced",
        lastSyncedAt: "2026-05-16T10:00:00+07:00",
        safeMetadata: { payloadFingerprint: "fingerprint-mock-100-v1" }
      })
    ];
    const originalMappings = structuredClone(existingMappings);

    const preview = createMockAdapterImportPreview({
      id: "preview-mock-100-repeat",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-mock-100-v1",
      receivedAt: "2026-05-17T06:25:00+07:00",
      previewedAt: "2026-05-17T06:26:00+07:00",
      payload: basePayload,
      existingMappings
    });

    expect(preview.report).toMatchObject({
      creates: 3,
      updates: 1,
      skips: 1,
      errors: 0
    });
    expect(preview.mappingPreview.find((mapping) => mapping.externalEntityId === "mock-opp-100")).toMatchObject({
      action: "update",
      canonicalEntityId: "opportunity-existing"
    });
    expect(preview.mappingPreview.find((mapping) => mapping.externalEntityId === "mock-task-100")).toMatchObject({
      action: "skip",
      canonicalEntityId: "task-existing"
    });
    expect(existingMappings).toEqual(originalMappings);
  });

  it("returns typed validation issues and no canonical previews for unsafe payloads", () => {
    const preview = createMockAdapterImportPreview({
      id: "preview-invalid",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-invalid",
      receivedAt: "2026-05-17T06:27:00+07:00",
      previewedAt: "2026-05-17T06:28:00+07:00",
      payload: {
        ...basePayload,
        opportunity: {
          ...basePayload.opportunity,
          title: "",
          desiredFinishDate: "2026-07-01"
        }
      }
    });

    expect(preview.mutatesState).toBe(false);
    expect(preview.report).toMatchObject({
      creates: 0,
      updates: 0,
      skips: 0
    });
    expect(preview.report.errors).toBeGreaterThanOrEqual(2);
    expect(preview.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "canonical_title_missing",
          severity: "blocking",
          fieldPath: "opportunity.title"
        }),
        expect.objectContaining({
          code: "date_window_invalid",
          severity: "blocking",
          fieldPath: "opportunity.desiredFinishDate"
        })
      ])
    );
    expect(preview.canonical.contacts).toEqual([]);
    expect(preview.canonical.tasks).toEqual([]);
    expect(preview.canonical.account).toBeUndefined();
    expect(preview.canonical.opportunity).toBeUndefined();
    expect(preview.canonical.projectDraft).toBeUndefined();
    expect(preview.mappingPreview).toEqual([]);
  });

  it("reports malformed dates and missing nested external ids instead of throwing", () => {
    const preview = createMockAdapterImportPreview({
      id: "preview-malformed",
      tenantId: "tenant-a",
      adapterId: "adapter-mock-crm",
      connectionId: "conn-mock-crm-a",
      sourceSystem: "mock-crm",
      payloadFingerprint: "fingerprint-malformed",
      receivedAt: "2026-05-17T06:29:00+07:00",
      previewedAt: "2026-05-17T06:30:00+07:00",
      payload: {
        ...basePayload,
        opportunity: {
          ...basePayload.opportunity,
          plannedStartDate: "bad-date",
          account: {
            externalId: "",
            displayName: "АКМЕ Импорт"
          },
          contacts: [
            {
              externalId: "",
              displayName: "Анна Импорт"
            }
          ]
        }
      }
    });

    expect(preview.report.errors).toBeGreaterThan(0);
    expect(preview.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "date_window_invalid",
          fieldPath: "opportunity.plannedStartDate"
        }),
        expect.objectContaining({
          code: "external_id_missing",
          fieldPath: "opportunity.account.externalId"
        }),
        expect.objectContaining({
          code: "external_id_missing",
          fieldPath: "opportunity.contacts[].externalId"
        })
      ])
    );
    expect(preview.mappingPreview).toEqual([]);
  });
});
