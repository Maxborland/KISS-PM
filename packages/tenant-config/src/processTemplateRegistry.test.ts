import { describe, expect, it } from "vitest";

import {
  applyProcessTemplateImprovementPreview,
  createProcessTemplateConfigurationRegistry,
  createProcessTemplateConfigurationRef,
  previewProcessTemplateImprovement
} from "./index";

describe("process template configuration registry", () => {
  it("registers active versioned process template references for one tenant", () => {
    const templateRef = createProcessTemplateConfigurationRef({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 3,
      active: true
    });
    const registry = createProcessTemplateConfigurationRegistry({
      tenantId: "tenant-a",
      version: 2,
      processTemplates: [templateRef],
      updatedAt: "2026-05-15T02:45:00+07:00"
    });

    expect(registry).toEqual({
      tenantId: "tenant-a",
      version: 2,
      processTemplates: [
        {
          id: "process-template-tenant-a-implementation",
          tenantId: "tenant-a",
          key: "implementation.standard",
          label: "Стандартное внедрение",
          version: 3,
          active: true
        }
      ],
      updatedAt: "2026-05-15T02:45:00+07:00"
    });
  });

  it("rejects duplicate active process template keys in tenant configuration", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-05-15T02:46:00+07:00",
        processTemplates: [
          {
            id: "process-template-1",
            tenantId: "tenant-a",
            key: "implementation.standard",
            label: "Стандартное внедрение",
            version: 1,
            active: true
          },
          {
            id: "process-template-2",
            tenantId: "tenant-a",
            key: "implementation.standard",
            label: "Стандартное внедрение v2",
            version: 2,
            active: true
          }
        ]
      })
    ).toThrow("Duplicate active process template key: implementation.standard");
  });

  it("rejects duplicate active process template ids in tenant configuration", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-05-15T02:46:00+07:00",
        processTemplates: [
          {
            id: "process-template-same-id",
            tenantId: "tenant-a",
            key: "implementation.standard",
            label: "Стандартное внедрение",
            version: 1,
            active: true
          },
          {
            id: "process-template-same-id",
            tenantId: "tenant-a",
            key: "implementation.quick_start",
            label: "Быстрый старт",
            version: 1,
            active: true
          }
        ]
      })
    ).toThrow("Duplicate active process template id: process-template-same-id");
  });

  it("rejects cross-tenant process template refs before building the registry", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-05-15T02:47:00+07:00",
        processTemplates: [
          {
            id: "process-template-b",
            tenantId: "tenant-b",
            key: "implementation.standard",
            label: "Tenant B template",
            version: 1,
            active: true
          }
        ]
      })
    ).toThrow("Process template configuration tenant mismatch: process-template-b");
  });

  it("rejects invalid calendar timestamps instead of accepting Date.parse rollover", () => {
    expect(() =>
      createProcessTemplateConfigurationRegistry({
        tenantId: "tenant-a",
        version: 1,
        updatedAt: "2026-02-30T02:47:00+07:00",
        processTemplates: []
      })
    ).toThrow("processTemplateConfigurationRegistry.updatedAt must be a valid timestamp");
  });

  it("previews and applies a governed template improvement as a future version only", () => {
    const templateRef = createProcessTemplateConfigurationRef({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 3,
      active: true
    });

    const preview = previewProcessTemplateImprovement({
      id: "preview-template-improvement-1",
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      sourceInsightId: "insight-template-delay",
      sourceTrendId: "tenant-a:template:implementation.standard:schedule_delay",
      sourceSnapshotIds: ["snapshot-a", "snapshot-b"],
      sourceMetricIds: ["snapshot-a:schedule_days"],
      currentTemplate: templateRef,
      improvementKey: "add_acceptance_checkpoint",
      reason: "Повторяющаяся задержка приемки",
      stateVersion: 7,
      createdAt: "2026-07-15T00:05:00.000Z"
    });

    expect(preview).toMatchObject({
      mutatesState: false,
      sourceInsightId: "insight-template-delay",
      sourceSnapshotIds: ["snapshot-a", "snapshot-b"],
      template: { id: templateRef.id, currentVersion: 3, nextVersion: 4 },
      before: { templateVersion: 3 },
      after: { templateVersion: 4, addedChecklistItemKey: "add_acceptance_checkpoint" }
    });
    expect(templateRef.version).toBe(3);

    const result = applyProcessTemplateImprovementPreview(templateRef, {
      preview,
      expectedStateVersion: 7,
      appliedAt: "2026-07-15T00:06:00.000Z"
    });

    expect(result).toMatchObject({
      previousVersion: 3,
      template: {
        id: templateRef.id,
        version: 4,
        improvementSourceInsightId: "insight-template-delay",
        improvementKey: "add_acceptance_checkpoint"
      }
    });
    expect(templateRef.version).toBe(3);
  });

  it("rejects stale or cross-tenant template improvement previews", () => {
    const templateRef = createProcessTemplateConfigurationRef({
      id: "process-template-tenant-a-implementation",
      tenantId: "tenant-a",
      key: "implementation.standard",
      label: "Стандартное внедрение",
      version: 1,
      active: true
    });
    const preview = previewProcessTemplateImprovement({
      id: "preview-template-improvement-1",
      tenantId: "tenant-a",
      actorId: "tenant-admin-a",
      sourceInsightId: "insight-template-delay",
      sourceTrendId: "tenant-a:template:implementation.standard:schedule_delay",
      sourceSnapshotIds: ["snapshot-a"],
      sourceMetricIds: ["snapshot-a:schedule_days"],
      currentTemplate: templateRef,
      improvementKey: "add_acceptance_checkpoint",
      reason: "Повторяющаяся задержка приемки",
      stateVersion: 1,
      createdAt: "2026-07-15T00:05:00.000Z"
    });

    expect(() =>
      applyProcessTemplateImprovementPreview(templateRef, {
        preview,
        expectedStateVersion: 2,
        appliedAt: "2026-07-15T00:06:00.000Z"
      })
    ).toThrow("Process template improvement preview is stale");

    expect(() =>
      previewProcessTemplateImprovement({
        id: "preview-template-improvement-cross-tenant",
        tenantId: "tenant-b",
        actorId: "tenant-admin-b",
        sourceInsightId: "insight-template-delay",
        sourceTrendId: "tenant-a:template:implementation.standard:schedule_delay",
        sourceSnapshotIds: ["snapshot-a"],
        sourceMetricIds: ["snapshot-a:schedule_days"],
        currentTemplate: templateRef,
        improvementKey: "add_acceptance_checkpoint",
        reason: "cross tenant",
        stateVersion: 1,
        createdAt: "2026-07-15T00:05:00.000Z"
      })
    ).toThrow("Process template improvement tenant mismatch");
  });
});
