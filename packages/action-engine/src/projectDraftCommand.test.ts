import { describe, expect, it } from "vitest";

import { executeCreateProjectDraftFromOpportunity } from "./index";
import type { CreateProjectDraftFromOpportunityCommandInput } from "./index";

const baseInput: CreateProjectDraftFromOpportunityCommandInput = {
  actor: {
    tenantId: "tenant-a",
    actorId: "user-project-manager-a",
    accessProfileId: "profile-project-manager-a",
    correlationId: "corr-project-draft-opportunity-seed-ready"
  },
  requiredPermission: "project_draft.create",
  now: "2026-05-14T21:15:00.000Z",
  readiness: {
    ready: true,
    nextAction: "run_feasibility",
    trace: ["readiness:ready"]
  },
  sourceOpportunity: {
    tenantId: "tenant-a",
    type: "crm_opportunity",
    opportunityId: "opportunity-seed-ready",
    title: "Внедрение портала АКМЕ",
    accountId: "account-opportunity-seed-ready",
    contactIds: ["contact-opportunity-seed-ready"],
    plannedStartDate: "2026-06-01",
    desiredFinishDate: "2026-06-30"
  },
  processTemplate: {
    tenantId: "tenant-a",
    templateId: "process-template-integrations-tenant-a",
    key: "implementation.integration_heavy",
    label: "Внедрение с интеграциями",
    version: 2,
    matchConfidence: 0.9,
    assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }]
  },
  demand: {
    tenantId: "tenant-a",
    totalPlannedWorkHours: 204,
    scenarioKey: "baseline",
    scenarioLabel: "Базовый сценарий",
    formulaKey: "phase3.template_scope_linear",
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
    tenantId: "tenant-a",
    status: "fit",
    severity: "warning",
    expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
    blockerCodes: ["conflicting_reservation"]
  }
};

describe("project draft governed command", () => {
  it("creates a project draft and action execution evidence", () => {
    const result = executeCreateProjectDraftFromOpportunity(baseInput);

    expect(result.projectDraft).toMatchObject({
      id: "project-draft-opportunity-seed-ready",
      tenantId: "tenant-a",
      status: "draft",
      sourceOpportunity: {
        opportunityId: "opportunity-seed-ready"
      }
    });
    expect(result.actionExecution).toMatchObject({
      tenantId: "tenant-a",
      actorId: "user-project-manager-a",
      commandType: "project_draft.create_from_opportunity",
      requiredPermission: "project_draft.create",
      status: "succeeded",
      correlationId: "corr-project-draft-opportunity-seed-ready",
      source: {
        entityType: "opportunity",
        entityId: "opportunity-seed-ready"
      },
      target: {
        entityType: "projectDraft",
        entityId: "project-draft-opportunity-seed-ready"
      }
    });
    expect(result.actionExecution.before).toEqual(null);
    expect(result.actionExecution.after).toMatchObject({
      projectDraftId: "project-draft-opportunity-seed-ready",
      status: "draft",
      processTemplate: {
        templateId: "process-template-integrations-tenant-a",
        key: "implementation.integration_heavy",
        version: 2,
        matchConfidence: 0.9,
        assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }]
      }
    });
  });

  it("rejects unready or overloaded opportunities before project draft creation", () => {
    expect(() =>
      executeCreateProjectDraftFromOpportunity({
        ...baseInput,
        readiness: {
          ready: false,
          nextAction: "resolve_blockers",
          trace: ["readiness:blockers:1"]
        }
      })
    ).toThrow(/readiness/i);

    expect(() =>
      executeCreateProjectDraftFromOpportunity({
        ...baseInput,
        feasibility: {
          ...baseInput.feasibility,
          status: "overloaded",
          severity: "critical",
          blockerCodes: ["role_capacity_gap"]
        }
      })
    ).toThrow(/feasibility/i);
  });
});
