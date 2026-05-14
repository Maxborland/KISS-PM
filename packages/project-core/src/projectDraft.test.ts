import { describe, expect, it } from "vitest";

import { createProjectDraftFromOpportunity } from "./index";

describe("project draft from CRM opportunity", () => {
  it("creates a tenant-owned draft linked to the source opportunity and template assumptions", () => {
    const draft = createProjectDraftFromOpportunity({
      id: "project-draft-1",
      tenantId: "tenant-a",
      title: "Внедрение портала АКМЕ",
      createdBy: "user-project-manager-a",
      createdAt: "2026-05-14T21:10:00.000Z",
      correlationId: "corr-project-draft-opportunity-seed-ready",
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
    });

    expect(draft).toMatchObject({
      id: "project-draft-1",
      tenantId: "tenant-a",
      status: "draft",
      sourceOpportunity: {
        type: "crm_opportunity",
        opportunityId: "opportunity-seed-ready"
      },
      processTemplate: {
        key: "implementation.integration_heavy",
        version: 2
      },
      feasibility: {
        status: "fit",
        severity: "warning"
      },
      correlationId: "corr-project-draft-opportunity-seed-ready"
    });
    expect(draft.demand.stageRoleDemands).toHaveLength(1);
  });

  it("rejects cross-tenant source snapshots before creating a draft", () => {
    expect(() =>
      createProjectDraftFromOpportunity({
        id: "project-draft-cross",
        tenantId: "tenant-a",
        title: "Cross tenant",
        createdBy: "user-project-manager-a",
        createdAt: "2026-05-14T21:10:00.000Z",
        correlationId: "corr-project-draft-cross",
        sourceOpportunity: {
          tenantId: "tenant-b",
          type: "crm_opportunity",
          opportunityId: "opportunity-b-private",
          title: "Tenant B private opportunity",
          contactIds: [],
          plannedStartDate: "2026-06-01",
          desiredFinishDate: "2026-06-30"
        },
        processTemplate: {
          tenantId: "tenant-a",
          templateId: "template-a",
          key: "implementation.integration_heavy",
          label: "Template",
          version: 1,
          matchConfidence: 0.8,
          assumptions: []
        },
        demand: {
          tenantId: "tenant-a",
          totalPlannedWorkHours: 1,
          scenarioKey: "baseline",
          scenarioLabel: "Базовый сценарий",
          formulaKey: "phase3.template_scope_linear",
          formulaVersion: 1,
          confidence: 0.8,
          stageRoleDemands: []
        },
        feasibility: {
          tenantId: "tenant-a",
          status: "fit",
          severity: "none",
          expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
          blockerCodes: []
        }
      })
    ).toThrow(/tenant/i);
  });
});
