import { describe, expect, it } from "vitest";

import {
  advanceManagedProjectLifecycle,
  approveStageApprovalRequest,
  createManagedProjectFromDraft,
  createProcessTemplate,
  createProjectDraftFromOpportunity,
  createStageApprovalRequest,
  evaluateStageGate,
  recordProjectArtifactEvidence
} from "./index";

const tenantId = "tenant-a";

function makeDraft() {
  return createProjectDraftFromOpportunity({
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
}

function makeProcessTemplate() {
  return createProcessTemplate({
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
        approvalTemplates: [
          {
            id: "approval-charter",
            tenantId,
            key: "charter_approval",
            label: "Согласование паспорта",
            approverRoleKey: "project_principal",
            required: true
          }
        ],
        taskTemplates: []
      },
      {
        id: "stage-delivery",
        tenantId,
        key: "delivery",
        label: "Исполнение",
        sortOrder: 20,
        active: true,
        version: 1,
        updatedAt: "2026-05-15T03:41:00+07:00",
        requiredArtifactTemplates: [],
        approvalTemplates: [
          {
            id: "approval-delivery-ready",
            tenantId,
            key: "delivery_ready",
            label: "Готовность к исполнению",
            approverRoleKey: "project_principal",
            required: false
          }
        ],
        taskTemplates: []
      }
    ]
  });
}

function makeProject() {
  return createManagedProjectFromDraft({
    id: "project-gated",
    draft: makeDraft(),
    processTemplate: makeProcessTemplate(),
    createdBy: "user-project-manager-a",
    createdAt: "2026-05-15T03:42:00+07:00",
    correlationId: "corr-project-gated"
  });
}

describe("stage gates, artifacts, and approval basics", () => {
  it("blocks closing the current stage when required artifact and approval evidence are missing", () => {
    const project = makeProject();
    const evaluation = evaluateStageGate(project, "project-gated:stage-initiation");

    expect(evaluation).toEqual({
      ok: false,
      stageId: "project-gated:stage-initiation",
      blockers: [
        {
          code: "missing_required_artifact",
          message: "Требуется артефакт: Паспорт проекта",
          stageId: "project-gated:stage-initiation",
          templateId: "artifact-charter",
          templateKey: "project_charter",
          templateLabel: "Паспорт проекта"
        },
        {
          code: "required_approval_not_approved",
          message: "Требуется согласование: Согласование паспорта",
          stageId: "project-gated:stage-initiation",
          templateId: "approval-charter",
          templateKey: "charter_approval",
          templateLabel: "Согласование паспорта"
        }
      ]
    });

    const result = advanceManagedProjectLifecycle(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:50:00+07:00",
      correlationId: "corr-blocked-gate",
      transition: "advance_stage",
      currentStageId: "project-gated:stage-initiation"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected gate blockers");
    expect(result.error.code).toBe("stage_gate_blocked");
    expect(result.error.blockers).toEqual(evaluation.blockers);
    expect(project.currentStageId).toBe("project-gated:stage-initiation");
  });

  it("allows stage transition after required artifact is accepted and required approval is approved", () => {
    const project = makeProject();
    const withArtifact = recordProjectArtifactEvidence(project, {
      id: "artifact-instance-charter",
      tenantId,
      stageId: "project-gated:stage-initiation",
      templateId: "artifact-charter",
      templateKey: "project_charter",
      status: "accepted",
      evidenceRef: "artifact://project-gated/charter",
      actorId: "user-project-manager-a",
      occurredAt: "2026-05-15T03:45:00+07:00"
    });
    const withApprovalRequest = createStageApprovalRequest(withArtifact, {
      id: "approval-request-charter",
      tenantId,
      stageId: "project-gated:stage-initiation",
      templateId: "approval-charter",
      templateKey: "charter_approval",
      requestedBy: "user-project-manager-a",
      requestedAt: "2026-05-15T03:46:00+07:00"
    });
    const readyProject = approveStageApprovalRequest(withApprovalRequest, {
      tenantId,
      approvalRequestId: "approval-request-charter",
      decidedBy: "user-project-principal-a",
      decidedAt: "2026-05-15T03:47:00+07:00"
    });

    expect(evaluateStageGate(readyProject, "project-gated:stage-initiation")).toEqual({
      ok: true,
      stageId: "project-gated:stage-initiation",
      blockers: []
    });

    const result = advanceManagedProjectLifecycle(readyProject, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:50:00+07:00",
      correlationId: "corr-open-delivery",
      transition: "advance_stage",
      currentStageId: "project-gated:stage-initiation"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected transition to pass");
    expect(result.project.currentStageId).toBe("project-gated:stage-delivery");
    expect(result.project.artifacts).toHaveLength(1);
    expect(result.project.approvalRequests).toHaveLength(1);
  });

  it("rejects cross-stage and cross-template evidence before gate evaluation", () => {
    const project = makeProject();

    expect(() =>
      recordProjectArtifactEvidence(project, {
        id: "artifact-wrong-stage",
        tenantId,
        stageId: "project-gated:stage-delivery",
        templateId: "artifact-charter",
        templateKey: "project_charter",
        status: "accepted",
        actorId: "user-project-manager-a",
        occurredAt: "2026-05-15T03:45:00+07:00"
      })
    ).toThrow("projectArtifact template is not valid for stage");

    expect(() =>
      createStageApprovalRequest(project, {
        id: "approval-wrong-template",
        tenantId,
        stageId: "project-gated:stage-initiation",
        templateId: "approval-unknown",
        templateKey: "charter_approval",
        requestedBy: "user-project-manager-a",
        requestedAt: "2026-05-15T03:46:00+07:00"
      })
    ).toThrow("approvalRequest template is not valid for stage");
  });

  it("does not satisfy a required approval with mismatched approver role evidence", () => {
    const project = makeProject();
    const forgedApprovalProject = {
      ...project,
      approvalRequests: [
        {
          id: "approval-forged",
          tenantId,
          projectId: "project-gated",
          stageId: "project-gated:stage-initiation",
          templateId: "approval-charter",
          templateKey: "charter_approval",
          templateVersion: 1,
          label: "Согласование паспорта",
          approverRoleKey: "wrong_role",
          status: "approved",
          requestedBy: "user-project-manager-a",
          requestedAt: "2026-05-15T03:46:00+07:00",
          decidedBy: "user-project-principal-a",
          decidedAt: "2026-05-15T03:47:00+07:00"
        }
      ]
    } as never;

    expect(evaluateStageGate(forgedApprovalProject, "project-gated:stage-initiation").blockers).toEqual([
      {
        code: "missing_required_artifact",
        message: "Требуется артефакт: Паспорт проекта",
        stageId: "project-gated:stage-initiation",
        templateId: "artifact-charter",
        templateKey: "project_charter",
        templateLabel: "Паспорт проекта"
      },
      {
        code: "required_approval_not_approved",
        message: "Требуется согласование: Согласование паспорта",
        stageId: "project-gated:stage-initiation",
        templateId: "approval-charter",
        templateKey: "charter_approval",
        templateLabel: "Согласование паспорта"
      }
    ]);
  });

  it("does not satisfy required gates with stale template-version evidence", () => {
    const project = makeProject();
    const staleEvidenceProject = {
      ...project,
      artifacts: [
        {
          id: "artifact-stale",
          tenantId,
          projectId: "project-gated",
          stageId: "project-gated:stage-initiation",
          templateId: "artifact-charter",
          templateKey: "project_charter",
          templateVersion: 99,
          label: "Паспорт проекта",
          status: "accepted",
          actorId: "user-project-manager-a",
          occurredAt: "2026-05-15T03:45:00+07:00"
        }
      ],
      approvalRequests: [
        {
          id: "approval-stale",
          tenantId,
          projectId: "project-gated",
          stageId: "project-gated:stage-initiation",
          templateId: "approval-charter",
          templateKey: "charter_approval",
          templateVersion: 99,
          label: "Согласование паспорта",
          approverRoleKey: "project_principal",
          status: "approved",
          requestedBy: "user-project-manager-a",
          requestedAt: "2026-05-15T03:46:00+07:00",
          decidedBy: "user-project-principal-a",
          decidedAt: "2026-05-15T03:47:00+07:00"
        }
      ]
    } as never;

    expect(evaluateStageGate(staleEvidenceProject, "project-gated:stage-initiation").ok).toBe(false);
  });

  it("validates malformed artifact and approval snapshot items before gate evaluation", () => {
    const project = makeProject();

    expect(() =>
      evaluateStageGate(
        {
          ...project,
          processTemplateSnapshot: {
            ...project.processTemplateSnapshot,
            stageTemplates: [
              {
                ...project.processTemplateSnapshot.stageTemplates[0]!,
                requiredArtifactTemplates: [null]
              }
            ]
          }
        } as never,
        "project-gated:stage-initiation"
      )
    ).toThrow("managedProject.processTemplateSnapshot.stageTemplate.requiredArtifactTemplate must be an object");

    expect(() =>
      evaluateStageGate(
        {
          ...project,
          processTemplateSnapshot: {
            ...project.processTemplateSnapshot,
            stageTemplates: [
              {
                ...project.processTemplateSnapshot.stageTemplates[0]!,
                approvalTemplates: [{ id: "approval-charter", key: "charter_approval", label: "Bad", required: true }]
              }
            ]
          }
        } as never,
        "project-gated:stage-initiation"
      )
    ).toThrow("managedProject.processTemplateSnapshot.stageTemplate.approvalTemplate.approverRoleKey is required");
  });

  it("returns transition_not_allowed before checking missing gate evidence for impossible transitions", () => {
    const project = makeProject();

    const result = advanceManagedProjectLifecycle(project, {
      tenantId,
      actorId: "user-project-principal-a",
      occurredAt: "2026-05-15T03:50:00+07:00",
      correlationId: "corr-invalid-complete",
      transition: "complete_project",
      currentStageId: "project-gated:stage-initiation"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid transition");
    expect(result.error.code).toBe("transition_not_allowed");
  });

  it("rejects gate evidence recorded outside active stage chronology", () => {
    const project = makeProject();

    expect(() =>
      recordProjectArtifactEvidence(project, {
        id: "artifact-backdated",
        tenantId,
        stageId: "project-gated:stage-initiation",
        templateId: "artifact-charter",
        templateKey: "project_charter",
        status: "accepted",
        actorId: "user-project-manager-a",
        occurredAt: "2026-05-15T03:41:59+07:00"
      })
    ).toThrow("projectArtifact timestamp cannot be earlier than project or stage state");

    expect(() =>
      createStageApprovalRequest(project, {
        id: "approval-future-stage",
        tenantId,
        stageId: "project-gated:stage-delivery",
        templateId: "approval-delivery-ready",
        templateKey: "delivery_ready",
        requestedBy: "user-project-manager-a",
        requestedAt: "2026-05-15T03:46:00+07:00"
      })
    ).toThrow("approvalRequest stage must be active");

    const withApprovalRequest = createStageApprovalRequest(project, {
      id: "approval-request-charter",
      tenantId,
      stageId: "project-gated:stage-initiation",
      templateId: "approval-charter",
      templateKey: "charter_approval",
      requestedBy: "user-project-manager-a",
      requestedAt: "2026-05-15T03:46:00+07:00"
    });

    expect(() =>
      approveStageApprovalRequest(withApprovalRequest, {
        tenantId,
        approvalRequestId: "approval-request-charter",
        decidedBy: "user-project-principal-a",
        decidedAt: "2026-05-15T03:45:59+07:00"
      })
    ).toThrow("approvalRequest decision timestamp cannot be earlier than request timestamp");
  });
});
