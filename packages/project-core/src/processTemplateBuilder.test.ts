import { describe, expect, it } from "vitest";

import {
  createManagedProjectFromDraft,
  createProcessTemplate,
  previewProcessTemplatePublish,
  publishProcessTemplatePreview
} from "./index";
import type { ProcessTemplate, ProjectDraft } from "./index";

function makeTemplate(version = 2): ProcessTemplate {
  return createProcessTemplate({
    id: "process-template-integrations-tenant-a",
    tenantId: "tenant-a",
    key: "implementation.integration_heavy",
    label: "Внедрение с интеграциями",
    active: true,
    version,
    updatedAt: "2026-08-01T00:00:00.000Z",
    stages: [
      {
        id: "stage-initiation",
        tenantId: "tenant-a",
        key: "initiation",
        label: "Инициация",
        sortOrder: 10,
        active: true,
        version: 1,
        updatedAt: "2026-08-01T00:00:00.000Z",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: [
          {
            id: "task-template-kickoff",
            tenantId: "tenant-a",
            key: "kickoff",
            label: "Провести старт проекта",
            defaultParticipantRoleKeys: ["executor", "controller"],
            required: true
          }
        ]
      },
      {
        id: "stage-delivery",
        tenantId: "tenant-a",
        key: "delivery",
        label: "Исполнение",
        sortOrder: 20,
        active: true,
        version: 1,
        updatedAt: "2026-08-01T00:00:00.000Z",
        requiredArtifactTemplates: [],
        approvalTemplates: [],
        taskTemplates: [
          {
            id: "task-template-delivery",
            tenantId: "tenant-a",
            key: "delivery_work",
            label: "Выполнить поставку",
            defaultParticipantRoleKeys: ["executor"],
            required: true
          }
        ]
      }
    ]
  });
}

function makeDraft(template: ProcessTemplate): ProjectDraft {
  return {
    id: "draft-template-stability",
    tenantId: "tenant-a",
    title: "Проект со старой версией",
    status: "draft",
    sourceOpportunity: {
      type: "crm_opportunity",
      tenantId: "tenant-a",
      opportunityId: "opp-a",
      title: "CRM opportunity",
      contactIds: [],
      plannedStartDate: "2026-08-03",
      desiredFinishDate: "2026-08-14"
    },
    processTemplate: {
      tenantId: "tenant-a",
      templateId: template.id,
      key: template.key,
      label: template.label,
      version: template.version,
      matchConfidence: 0.9,
      assumptions: []
    },
    demand: {
      tenantId: "tenant-a",
      totalPlannedWorkHours: 40,
      scenarioKey: "standard",
      scenarioLabel: "Стандарт",
      formulaKey: "phase3.template_scope_linear",
      formulaVersion: 1,
      confidence: 0.9,
      stageRoleDemands: []
    },
    feasibility: {
      tenantId: "tenant-a",
      status: "fit",
      severity: "none",
      expectedWindow: { startDate: "2026-08-03", endDate: "2026-08-14" },
      blockerCodes: []
    },
    createdBy: "tenant-admin-a",
    createdAt: "2026-08-01T00:00:00.000Z",
    correlationId: "corr-template-stability"
  };
}

describe("process template builder publish lifecycle", () => {
  it("previews safe process template edits without mutating current template", () => {
    const current = makeTemplate();
    const preview = previewProcessTemplatePublish(current, {
      id: "preview-process-template-1",
      actorId: "tenant-admin-a",
      expectedTemplateVersion: 2,
      draft: {
        label: "Внедрение enterprise",
        stages: [
          {
            id: "stage-delivery",
            label: "Поставка",
            sortOrder: 10,
            active: true,
            taskTemplates: [
              {
                id: "task-template-delivery",
                label: "Поставить результат",
                defaultParticipantRoleKeys: ["executor", "controller"],
                required: true
              }
            ]
          },
          {
            id: "stage-initiation",
            label: "Старт",
            sortOrder: 20,
            active: true,
            taskTemplates: [
              {
                id: "task-template-kickoff",
                label: "Провести старт проекта",
                defaultParticipantRoleKeys: ["executor"],
                required: true
              }
            ]
          }
        ]
      },
      activeProjectTemplateVersions: [2],
      affectedRuntimeSurfaces: ["project.create_from_template", "project.stage.header"],
      createdAt: "2026-08-01T00:05:00.000Z"
    });

    expect(preview).toMatchObject({
      mutatesState: false,
      before: { templateVersion: 2, label: "Внедрение с интеграциями" },
      after: { templateVersion: 3, label: "Внедрение enterprise" },
      affectedRuntimeSurfaces: ["project.create_from_template", "project.stage.header"]
    });
    expect(preview.stageChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stageId: "stage-delivery", beforeSortOrder: 20, afterSortOrder: 10 }),
        expect.objectContaining({ stageId: "stage-initiation", beforeLabel: "Инициация", afterLabel: "Старт" })
      ])
    );
    expect(preview.taskTemplateChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskTemplateId: "task-template-delivery",
          beforeDefaultParticipantRoleKeys: ["executor"],
          afterDefaultParticipantRoleKeys: ["executor", "controller"]
        })
      ])
    );
    expect(current.version).toBe(2);
    expect(current.stages.map((stage) => stage.key)).toEqual(["initiation", "delivery"]);
  });

  it("publishes a fresh preview as a future template version and keeps existing project snapshots stable", () => {
    const current = makeTemplate();
    const projectBefore = createManagedProjectFromDraft({
      id: "project-old-template",
      draft: makeDraft(current),
      processTemplate: current,
      createdBy: "tenant-admin-a",
      createdAt: "2026-08-01T00:10:00.000Z",
      correlationId: "corr-project-old-template"
    });
    const preview = previewProcessTemplatePublish(current, {
      id: "preview-process-template-1",
      actorId: "tenant-admin-a",
      expectedTemplateVersion: 2,
      draft: {
        label: "Внедрение enterprise",
        stages: [
          { id: "stage-initiation", label: "Старт", sortOrder: 10, active: true },
          { id: "stage-delivery", label: "Поставка", sortOrder: 20, active: true }
        ]
      },
      activeProjectTemplateVersions: [projectBefore.processTemplateSnapshot.version],
      affectedRuntimeSurfaces: ["project.create_from_template"],
      createdAt: "2026-08-01T00:11:00.000Z"
    });

    const result = publishProcessTemplatePreview(current, {
      preview,
      expectedTemplateVersion: 2,
      auditEventId: "audit-p10-process-template-tenant-a-3",
      publishedAt: "2026-08-01T00:12:00.000Z"
    });

    expect(result.template).toMatchObject({
      id: current.id,
      version: 3,
      label: "Внедрение enterprise"
    });
    expect(result.audit).toMatchObject({
      commandType: "process_template.publish",
      beforeTemplateVersion: 2,
      afterTemplateVersion: 3,
      auditEventId: "audit-p10-process-template-tenant-a-3"
    });
    expect(projectBefore.processTemplateSnapshot).toMatchObject({
      templateId: current.id,
      version: 2,
      label: "Внедрение с интеграциями"
    });
  });

  it("rejects unsafe or stale process template previews without partial mutation", () => {
    const current = makeTemplate();
    expect(() =>
      previewProcessTemplatePublish(current, {
        id: "preview-no-active-stage",
        actorId: "tenant-admin-a",
        expectedTemplateVersion: 2,
        draft: {
          stages: [
            { id: "stage-initiation", active: false },
            { id: "stage-delivery", active: false }
          ]
        },
        activeProjectTemplateVersions: [2],
        affectedRuntimeSurfaces: ["project.create_from_template"],
        createdAt: "2026-08-01T00:15:00.000Z"
      })
    ).toThrow("process template must keep at least one active stage");

    const preview = previewProcessTemplatePublish(current, {
      id: "preview-process-template-stale",
      actorId: "tenant-admin-a",
      expectedTemplateVersion: 2,
      draft: { label: "Внедрение enterprise" },
      activeProjectTemplateVersions: [],
      affectedRuntimeSurfaces: ["project.create_from_template"],
      createdAt: "2026-08-01T00:16:00.000Z"
    });

    expect(() =>
      publishProcessTemplatePreview(makeTemplate(3), {
        preview,
        expectedTemplateVersion: 3,
        auditEventId: "audit-p10-process-template-tenant-a-4",
        publishedAt: "2026-08-01T00:17:00.000Z"
      })
    ).toThrow("process template preview is stale");
    expect(current.version).toBe(2);
  });
});
