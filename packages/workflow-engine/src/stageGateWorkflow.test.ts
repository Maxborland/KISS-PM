import { describe, expect, it } from "vitest";

import {
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity
} from "@kiss-pm/project-core";

import { evaluateProjectStageGate } from "./index";

describe("workflow-engine stage gate integration", () => {
  it("exposes project-core gate blockers as workflow validation output", () => {
    const tenantId = "tenant-a";
    const processTemplate = createProcessTemplate({
      id: "process-template-gated",
      tenantId,
      key: "implementation.gated",
      label: "Процесс с воротами",
      active: true,
      version: 1,
      updatedAt: "2026-05-15T03:41:00+07:00",
      stages: [
        {
          id: "stage-initiation",
          tenantId,
          key: "initiation",
          label: "Инициация",
          sortOrder: 10,
          active: true,
          version: 1,
          updatedAt: "2026-05-15T03:41:00+07:00",
          requiredArtifactTemplates: [
            {
              id: "artifact-charter",
              tenantId,
              key: "project_charter",
              label: "Паспорт проекта",
              required: true
            }
          ],
          approvalTemplates: [],
          taskTemplates: []
        }
      ]
    });
    const draft = createProjectDraftFromOpportunity({
      id: "project-draft-gated",
      tenantId,
      title: "Проект с обязательным этапом",
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:40:00+07:00",
      correlationId: "corr-draft-gated",
      sourceOpportunity: {
        tenantId,
        type: "crm_opportunity",
        opportunityId: "opportunity-gated",
        title: "Проект с обязательным этапом",
        contactIds: [],
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30"
      },
      processTemplate: {
        tenantId,
        templateId: "process-template-gated",
        key: "implementation.gated",
        label: "Процесс с воротами",
        version: 1,
        matchConfidence: 1,
        assumptions: []
      },
      demand: {
        tenantId,
        totalPlannedWorkHours: 0,
        scenarioKey: "baseline",
        scenarioLabel: "Базовый сценарий",
        formulaKey: "phase3.template_scope_linear",
        formulaVersion: 1,
        confidence: 1,
        stageRoleDemands: []
      },
      feasibility: {
        tenantId,
        status: "fit",
        severity: "none",
        expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
        blockerCodes: []
      }
    });
    const project = createManagedProjectFromDraft({
      id: "project-gated",
      draft,
      processTemplate,
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:42:00+07:00",
      correlationId: "corr-project-gated"
    });

    expect(evaluateProjectStageGate(project, "project-gated:stage-initiation")).toMatchObject({
      ok: false,
      blockers: [
        {
          code: "missing_required_artifact",
          message: "Требуется артефакт: Паспорт проекта"
        }
      ]
    });
  });
});
