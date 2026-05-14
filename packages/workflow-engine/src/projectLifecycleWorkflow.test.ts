import { describe, expect, it } from "vitest";

import {
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity
} from "@kiss-pm/project-core";

import { evaluateProjectLifecycleTransition } from "./index";

describe("workflow-engine project lifecycle integration", () => {
  it("delegates deterministic lifecycle transitions without mutating project-core state", () => {
    const tenantId = "tenant-a";
    const processTemplate = createProcessTemplate({
      id: "process-template-tenant-a-implementation",
      tenantId,
      key: "implementation.standard",
      label: "Стандартное внедрение",
      active: true,
      version: 1,
      updatedAt: "2026-05-15T03:50:00+07:00",
      stages: [
        {
          id: "stage-initiation",
          tenantId,
          key: "initiation",
          label: "Инициация",
          sortOrder: 10,
          active: true,
          version: 1,
          updatedAt: "2026-05-15T03:50:00+07:00",
          requiredArtifactTemplates: [],
          approvalTemplates: [],
          taskTemplates: []
        }
      ]
    });
    const draft = createProjectDraftFromOpportunity({
      id: "project-draft-1",
      tenantId,
      title: "Внедрение портала АКМЕ",
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-14T21:10:00.000Z",
      correlationId: "corr-project-draft-opportunity-seed-ready",
      sourceOpportunity: {
        tenantId,
        type: "crm_opportunity",
        opportunityId: "opportunity-seed-ready",
        title: "Внедрение портала АКМЕ",
        contactIds: [],
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30"
      },
      processTemplate: {
        tenantId,
        templateId: "process-template-tenant-a-implementation",
        key: "implementation.standard",
        label: "Стандартное внедрение",
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
      id: "project-managed-1",
      draft,
      processTemplate,
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-15T03:51:00+07:00",
      correlationId: "corr-managed-project-1"
    });

    const result = evaluateProjectLifecycleTransition(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:52:00+07:00",
      correlationId: "corr-complete-project",
      transition: "complete_project",
      currentStageId: "project-managed-1:stage-initiation"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected workflow transition to succeed");
    expect(result.project.lifecycleStatus).toBe("completed");
    expect(project.lifecycleStatus).toBe("active");
  });
});
