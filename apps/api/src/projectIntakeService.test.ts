import { describe, expect, it } from "vitest";
import { tenantAdminProfile } from "./tenantAdminProfile";
import { createProjectIntakeService } from "./projectIntakeService";
import { isSingleUseActivationError } from "./projectIntakeService/activationErrors";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  OpportunityInput,
  OpportunityRecord,
  ProjectInput,
  ProjectRecord
} from "./apiTypes";
import type { CrmPipelineStage, TenantUser } from "@kiss-pm/domain";

const actor: TenantUser = {
  id: "user-admin",
  tenantId: "tenant-alpha",
  name: "Анна Администратор",
  accessProfileId: "tenant-admin"
};

const opportunityInput: OpportunityInput = {
  id: "opportunity-service",
  tenantId: "tenant-alpha",
  clientId: "client-alpha",
  primaryContactId: "contact-alpha",
  ownerUserId: "user-admin",
  projectTypeId: "project-type-alpha",
  stageId: "deal-stage-alpha",
  clientName: "",
  contactName: "",
  title: "Сервисный проект",
  projectType: "",
  description: null,
  plannedStart: new Date("2026-06-01T00:00:00.000Z"),
  plannedFinish: new Date("2026-06-30T00:00:00.000Z"),
  contractValue: 1_000_000,
  plannedHourlyRate: 2_500,
  plannedHours: 400,
  probability: 70,
  status: "intake",
  templateId: null,
  customFieldValues: {},
  demand: [{ positionId: "position-analyst", requiredHours: 160 }]
};

function createOpportunityRecord(
  input: OpportunityInput,
  overrides: Partial<OpportunityRecord> = {}
): OpportunityRecord {
  return {
    id: input.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    primaryContactId: input.primaryContactId,
    ownerUserId: input.ownerUserId ?? null,
    projectTypeId: input.projectTypeId,
    stageId: input.stageId,
    crmPipelineId: input.crmPipelineId ?? null,
    crmPipelineStageId: input.crmPipelineStageId ?? null,
    crmPipelineStateUpdatedAt:
      input.crmPipelineId && input.crmPipelineStageId
        ? new Date("2026-05-19T00:00:00.000Z")
        : null,
    clientName: input.clientName,
    contactName: input.contactName,
    title: input.title,
    projectType: input.projectType,
    description: input.description,
    plannedStart: input.plannedStart,
    plannedFinish: input.plannedFinish,
    contractValue: input.contractValue,
    plannedHourlyRate: input.plannedHourlyRate,
    plannedHours: input.plannedHours,
    probability: input.probability,
    status: input.status,
    templateId: input.templateId,
    customFieldValues: input.customFieldValues ?? {},
    demand: input.demand,
    feasibilityStatus: null,
    feasibilityResult: null,
    feasibilityCheckedAt: null,
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
    updatedAt: new Date("2026-05-19T00:00:00.000Z"),
    ...overrides
  };
}

function createProjectRecord(
  input: ProjectInput,
  overrides: Partial<ProjectRecord> = {}
): ProjectRecord {
  return {
    id: input.id,
    tenantId: input.tenantId,
    sourceType: "opportunity",
    sourceOpportunityId: input.sourceOpportunityId,
    clientId: input.clientId,
    projectTypeId: input.projectTypeId,
    title: input.title,
    clientName: input.clientName,
    status: input.status,
    plannedStart: input.plannedStart,
    plannedFinish: input.plannedFinish,
    contractValue: input.contractValue,
    plannedHours: input.plannedHours,
    templateId: input.templateId,
    createdAt: new Date("2026-05-20T00:00:00.000Z"),
    activatedAt: null,
    closedAt: null,
    demand: input.demand,
    ...overrides
  };
}

function createCrmPipelineStage(
  overrides: Partial<CrmPipelineStage> = {}
): CrmPipelineStage {
  return {
    id: "pipeline-stage-current",
    tenantId: "tenant-alpha",
    pipelineId: "pipeline-sales",
    name: "Current stage",
    sortOrder: 30,
    status: "active",
    lifecycleState: "won_closed",
    isFinal: true,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides
  };
}

function createActivationFixture(input: {
  crmStage?: Partial<CrmPipelineStage> | null;
  opportunityOverrides?: Partial<OpportunityRecord>;
  activeProjects?: ProjectRecord[];
} = {}) {
  const audits: ManagementAuditEventInput[] = [];
  const createdDrafts: ProjectInput[] = [];
  const stageLookups: Array<{ pipelineId: string; stageId: string }> = [];
  const crmStage = input.crmStage === null
    ? null
    : createCrmPipelineStage(input.crmStage);
  const currentOpportunity = createOpportunityRecord(
    {
      ...opportunityInput,
      ...(crmStage
        ? { crmPipelineId: crmStage.pipelineId, crmPipelineStageId: crmStage.id }
        : {})
    },
    {
      status: "ready_to_activate",
      feasibilityStatus: "ok",
      feasibilityResult: { rows: [] },
      feasibilityCheckedAt: new Date("2026-05-19T00:00:00.000Z"),
      ...input.opportunityOverrides
    }
  );

  const dataSource: ApiTenantDataSource = {
    async listDevUsers() {
      return [];
    },
    async findUserById(userId) {
      return userId === actor.id ? actor : undefined;
    },
    async findTenantById() {
      return undefined;
    },
    async listUsersByTenantId() {
      return [];
    },
    async findOpportunityById() {
      return currentOpportunity;
    },
    async listPositions() {
      return [{ id: "position-analyst", tenantId: "tenant-alpha", name: "Analyst", description: null }];
    },
    async listWorkspaceUsers() {
      return [
        {
          ...actor,
          email: "admin@example.test",
          positionId: "position-analyst",
          positionName: "Analyst",
          phone: null,
          telegram: null,
          status: "active",
          theme: "light",
          accentColor: "#2563eb"
        }
      ];
    },
    async listProjects() {
      return input.activeProjects ?? [];
    },
    async lockTenantResourcePlanning() {},
    async createProjectDraftFromOpportunity(projectInput) {
      createdDrafts.push(projectInput);
      return createProjectRecord(projectInput);
    },
    async activateProjectDraft({ projectId }) {
      const draft = createdDrafts.find((item) => item.id === projectId);
      if (!draft) throw new Error("draft_not_found");
      return createProjectRecord(draft, {
        status: "active",
        activatedAt: new Date("2026-05-20T00:00:00.000Z")
      });
    },
    ...(crmStage
      ? {
          async findCrmPipelineStageById(_tenantId: string, pipelineId: string, stageId: string) {
            stageLookups.push({ pipelineId, stageId });
            return crmStage;
          }
        }
      : {}),
    async withTransaction(operation) {
      return operation(dataSource);
    },
    async appendAuditEvent() {
      throw new Error("service test uses appendManagementAuditEvent dependency");
    }
  };

  return {
    audits,
    createdDrafts,
    currentOpportunity,
    stageLookups,
    service: createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (auditInput) => {
        audits.push(auditInput);
        return `audit-test-${audits.length}`;
      }
    })
  };
}

describe("project intake application service", () => {
  it("treats finalized source opportunity draft race as activation conflict", () => {
    expect(
      isSingleUseActivationError(new Error("source_opportunity_not_draftable"))
    ).toBe(true);
  });

  it("creates opportunities with linked snapshot labels and management audit inside a transaction", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let createdInput: OpportunityInput | null = null;
    let transactionUsed = false;

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listOpportunities() {
        return [];
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Ромашка",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Ирина Заказчик",
          email: "irina@example.test",
          phone: null,
          telegram: null,
          role: "спонсор",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Внедрение",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Квалификация",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async createOpportunity(input) {
        createdInput = input;
        return createOpportunityRecord(input);
      },
      async withTransaction(operation) {
        transactionUsed = true;
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.createOpportunity({ actor, input: opportunityInput });

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      opportunity: {
        id: "opportunity-service",
        clientName: "Ромашка",
        contactName: "Ирина Заказчик",
        projectType: "Внедрение"
      }
    });
    expect(transactionUsed).toBe(true);
    expect(createdInput).toMatchObject({
      clientName: "Ромашка",
      contactName: "Ирина Заказчик",
      projectType: "Внедрение"
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      tenantId: "tenant-alpha",
      actorUserId: "user-admin",
      actionType: "opportunity.created",
      sourceWorkflow: "crm_intake",
      sourceEntity: {
        type: "Opportunity",
        id: "opportunity-service"
      },
      commandInput: {
        clientName: "Ромашка",
        contactName: "Ирина Заказчик",
        projectType: "Внедрение"
      },
      beforeState: null,
      permissionResult: {
        allowed: true
      }
    });
  });

  it("validates initial CRM pipeline state before creating an opportunity", async () => {
    const createdInputs: OpportunityInput[] = [];
    const makeService = (input: {
      pipelineStatus: "active" | "archived";
      stageStatus: "active" | "archived";
      initialStageId?: string;
    }) => {
      const dataSource: ApiTenantDataSource = {
        async listDevUsers() {
          return [];
        },
        async findUserById(userId) {
          return userId === actor.id ? actor : undefined;
        },
        async findTenantById() {
          return undefined;
        },
        async listUsersByTenantId() {
          return [];
        },
        async listOpportunities() {
          return [];
        },
        async findClientById() {
          return {
            id: "client-alpha",
            tenantId: "tenant-alpha",
            name: "Client Alpha",
            description: null,
            status: "active",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          };
        },
        async findContactById() {
          return {
            id: "contact-alpha",
            tenantId: "tenant-alpha",
            clientId: "client-alpha",
            name: "Contact Alpha",
            email: "contact@example.test",
            phone: null,
            telegram: null,
            role: "Sponsor",
            status: "active",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          };
        },
        async findProjectTypeById() {
          return {
            id: "project-type-alpha",
            tenantId: "tenant-alpha",
            name: "Implementation",
            description: null,
            status: "active",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          };
        },
        async findDealStageById() {
          return {
            id: "deal-stage-alpha",
            tenantId: "tenant-alpha",
            name: "Intake",
            sortOrder: 10,
            status: "active",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          };
        },
        async findCrmPipelineById() {
          return {
            id: "pipeline-sales",
            tenantId: "tenant-alpha",
            name: "Sales",
            status: input.pipelineStatus,
            lifecycleGraphMetadata: {
              pipelineId: "pipeline-sales",
              initialStageId: input.initialStageId ?? "pipeline-stage-intake",
              finalStageIds: [],
              stages: [],
              transitions: []
            },
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          };
        },
        async findCrmPipelineStageById(_tenantId, _pipelineId, stageId) {
          return {
            id: stageId,
            tenantId: "tenant-alpha",
            pipelineId: "pipeline-sales",
            name: "Intake",
            sortOrder: 10,
            status: input.stageStatus,
            lifecycleState: "open",
            isFinal: false,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          };
        },
        async createOpportunity(input) {
          createdInputs.push(input);
          return createOpportunityRecord(input);
        },
        async withTransaction(operation) {
          return operation(dataSource);
        },
        async appendAuditEvent() {
          throw new Error("service test uses appendManagementAuditEvent dependency");
        }
      };

      return createProjectIntakeService({
        dataSource,
        getActorProfile: async () => tenantAdminProfile,
        runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
        appendManagementAuditEvent: async () => "audit-test"
      });
    };

    const baseInput: OpportunityInput = {
      ...opportunityInput,
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-intake"
    };

    await expect(
      makeService({ pipelineStatus: "archived", stageStatus: "active" }).createOpportunity({
        actor,
        input: { ...baseInput, id: "opportunity-archived-pipeline" }
      })
    ).resolves.toEqual({ ok: false, status: 404, error: "crm_pipeline_not_found" });
    await expect(
      makeService({ pipelineStatus: "active", stageStatus: "archived" }).createOpportunity({
        actor,
        input: { ...baseInput, id: "opportunity-archived-pipeline-stage" }
      })
    ).resolves.toEqual({ ok: false, status: 404, error: "crm_pipeline_stage_not_found" });
    expect(createdInputs).toEqual([]);

    await expect(
      makeService({ pipelineStatus: "active", stageStatus: "active" }).createOpportunity({
        actor,
        input: {
          ...baseInput,
          id: "opportunity-later-pipeline-stage",
          crmPipelineStageId: "pipeline-stage-qualified"
        }
      })
    ).resolves.toEqual({
      ok: false,
      status: 409,
      error: "crm_pipeline_initial_stage_required"
    });

    expect(createdInputs).toHaveLength(0);

    await expect(
      makeService({
        pipelineStatus: "active",
        stageStatus: "active",
        initialStageId: "pipeline-stage-qualified"
      }).createOpportunity({
        actor,
        input: {
          ...baseInput,
          id: "opportunity-initial-pipeline-stage",
          crmPipelineStageId: "pipeline-stage-qualified"
        }
      })
    ).resolves.toMatchObject({ ok: true, status: 201 });
    expect(createdInputs).toHaveLength(1);
  });

  it("activates initialized CRM opportunities from an active final won stage", async () => {
    const fixture = createActivationFixture({
      crmStage: { lifecycleState: "won_closed", isFinal: true }
    });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-activated", acceptedRiskReason: null }
    });

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      project: {
        id: "project-activated",
        status: "active",
        sourceOpportunityId: fixture.currentOpportunity.id
      }
    });
    expect(fixture.stageLookups).toEqual([
      { pipelineId: "pipeline-sales", stageId: "pipeline-stage-current" }
    ]);
    expect(fixture.createdDrafts).toHaveLength(1);
    expect(fixture.audits).toHaveLength(1);
  });

  it("rejects initialized CRM opportunities from an open non-final stage", async () => {
    const fixture = createActivationFixture({
      crmStage: { lifecycleState: "open", isFinal: false }
    });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-open-stage", acceptedRiskReason: null }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "crm_pipeline_won_stage_required"
    });
    expect(fixture.stageLookups).toHaveLength(1);
    expect(fixture.createdDrafts).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("rejects initialized CRM opportunities from a final lost stage", async () => {
    const fixture = createActivationFixture({
      crmStage: { lifecycleState: "lost_rejected", isFinal: true }
    });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-lost-stage", acceptedRiskReason: null }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "crm_pipeline_won_stage_required"
    });
    expect(fixture.stageLookups).toHaveLength(1);
    expect(fixture.createdDrafts).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("preserves legacy uninitialized opportunity activation", async () => {
    const fixture = createActivationFixture({ crmStage: null });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-legacy", acceptedRiskReason: null }
    });

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      project: {
        id: "project-legacy",
        status: "active",
        sourceOpportunityId: fixture.currentOpportunity.id
      }
    });
    expect(fixture.stageLookups).toEqual([]);
    expect(fixture.createdDrafts).toHaveLength(1);
  });

  it("still requires accepted risk reason for conflicting activation capacity", async () => {
    const existingReservation = createProjectRecord(
      {
        id: "project-existing-active",
        tenantId: "tenant-alpha",
        sourceOpportunityId: "opportunity-existing",
        clientId: "client-alpha",
        projectTypeId: "project-type-alpha",
        title: "Existing active project",
        clientName: "Client Alpha",
        status: "active",
        plannedStart: opportunityInput.plannedStart,
        plannedFinish: opportunityInput.plannedFinish,
        contractValue: 500_000,
        plannedHours: 170,
        templateId: null,
        demand: [{ positionId: "position-analyst", requiredHours: 170 }]
      },
      { activatedAt: new Date("2026-05-10T00:00:00.000Z") }
    );
    const fixture = createActivationFixture({
      crmStage: null,
      activeProjects: [existingReservation]
    });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-conflict", acceptedRiskReason: null }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "risk_acceptance_required"
    });
    expect(fixture.createdDrafts).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("requires accepted risk reason when paused project reservation conflicts", async () => {
    const existingReservation = createProjectRecord(
      {
        id: "project-existing-paused",
        tenantId: "tenant-alpha",
        sourceOpportunityId: "opportunity-existing",
        clientId: "client-alpha",
        projectTypeId: "project-type-alpha",
        title: "Existing paused project",
        clientName: "Client Alpha",
        status: "paused",
        plannedStart: opportunityInput.plannedStart,
        plannedFinish: opportunityInput.plannedFinish,
        contractValue: 500_000,
        plannedHours: 170,
        templateId: null,
        demand: [{ positionId: "position-analyst", requiredHours: 170 }]
      },
      { activatedAt: new Date("2026-05-10T00:00:00.000Z") }
    );
    const fixture = createActivationFixture({
      crmStage: null,
      activeProjects: [existingReservation]
    });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-paused-conflict", acceptedRiskReason: null }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "risk_acceptance_required"
    });
    expect(fixture.createdDrafts).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("does not accept risk for blocked feasibility activation", async () => {
    const fixture = createActivationFixture({
      crmStage: null,
      opportunityOverrides: {
        demand: [{ positionId: "position-unstaffed", requiredHours: 40 }]
      }
    });

    const result = await fixture.service.activateProjectFromOpportunity({
      actor,
      opportunityId: fixture.currentOpportunity.id,
      activation: { id: "project-blocked", acceptedRiskReason: "Proceed anyway" }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "opportunity_not_activatable"
    });
    expect(fixture.createdDrafts).toEqual([]);
    expect(fixture.audits).toEqual([]);
  });

  it("updates draft opportunity fields, refreshes linked labels and records management audit", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    let transactionUsed = false;
    const existingOpportunity = createOpportunityRecord(opportunityInput, {
      status: "ready_to_activate",
      feasibilityStatus: "ok",
      feasibilityResult: { rows: [] },
      feasibilityCheckedAt: new Date("2026-05-19T00:00:00.000Z"),
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listOpportunities() {
        return [existingOpportunity];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Ромашка обновленная",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Ирина Обновленная",
          email: "irina@example.test",
          phone: null,
          telegram: null,
          role: "спонсор",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Внедрение обновленное",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Квалификация",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity(input) {
        updatedInput = input;
        return createOpportunityRecord(input, {
          feasibilityStatus: null,
          feasibilityResult: null,
          feasibilityCheckedAt: null,
          createdAt: existingOpportunity.createdAt,
          updatedAt: new Date("2026-05-20T00:00:00.000Z")
        });
      },
      async withTransaction(operation) {
        transactionUsed = true;
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        title: "Сервисный проект обновлен",
        contractValue: 1_200_000,
        plannedHourlyRate: 6_000,
        plannedHours: 200,
        demand: [{ positionId: "position-analyst", requiredHours: 200 }]
      }
    });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      opportunity: {
        id: "opportunity-service",
        title: "Сервисный проект обновлен",
        clientName: "Ромашка обновленная",
        contactName: "Ирина Обновленная",
        projectType: "Внедрение обновленное",
        feasibilityStatus: null,
        plannedHours: 200
      }
    });
    expect(transactionUsed).toBe(true);
    expect(updatedInput).toMatchObject({
      clientName: "Ромашка обновленная",
      contactName: "Ирина Обновленная",
      projectType: "Внедрение обновленное",
      plannedHours: 200
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actionType: "opportunity.updated",
      sourceWorkflow: "crm_intake",
      beforeState: expect.objectContaining({
        id: "opportunity-service",
        feasibilityStatus: "ok"
      }),
      afterState: expect.objectContaining({
        id: "opportunity-service",
        feasibilityStatus: null,
        plannedHours: 200
      }),
      permissionResult: {
        allowed: true
      }
    });
  });

  it("rejects CRM pipeline clears and direct stage changes for initialized opportunities", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    const existingOpportunity = createOpportunityRecord(
      {
        ...opportunityInput,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake"
      },
      {
        createdAt: new Date("2026-05-18T00:00:00.000Z"),
        updatedAt: new Date("2026-05-19T00:00:00.000Z")
      }
    );

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listOpportunities() {
        return [existingOpportunity];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Client Alpha",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Contact Alpha",
          email: "contact@example.test",
          phone: null,
          telegram: null,
          role: "Sponsor",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Implementation",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Intake",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineById() {
        return {
          id: "pipeline-sales",
          tenantId: "tenant-alpha",
          name: "Sales",
          status: "active",
          lifecycleGraphMetadata: {
            pipelineId: "pipeline-sales",
            initialStageId: "pipeline-stage-intake",
            finalStageIds: ["pipeline-stage-won"],
            stages: [],
            transitions: []
          },
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineStageById(_tenantId, _pipelineId, stageId) {
        return {
          id: stageId,
          tenantId: "tenant-alpha",
          pipelineId: "pipeline-sales",
          name: stageId === "pipeline-stage-won" ? "Won" : "Qualified",
          sortOrder: stageId === "pipeline-stage-won" ? 30 : 20,
          status: "active",
          lifecycleState:
            stageId === "pipeline-stage-won" ? "won_closed" : "open",
          isFinal: stageId === "pipeline-stage-won",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity(input) {
        updatedInput = input;
        return createOpportunityRecord(input);
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const partialClear = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        crmPipelineId: null
      }
    });

    expect(partialClear).toEqual({
      ok: false,
      status: 400,
      error: "invalid_crm_pipeline_state"
    });
    expect(updatedInput).toBeNull();

    const pairedClear = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        crmPipelineId: null,
        crmPipelineStageId: null
      }
    });

    expect(pairedClear).toEqual({
      ok: false,
      status: 409,
      error: "crm_pipeline_transition_required"
    });
    expect(updatedInput).toBeNull();

    const result = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-won"
      }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "crm_pipeline_transition_required"
    });
    expect(updatedInput).toBeNull();
    expect(audits).toEqual([]);
  });

  it("preserves CRM pipeline timestamp when update echoes the current pipeline state", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    const existingPipelineStateUpdatedAt = new Date("2026-05-17T12:00:00.000Z");
    const existingOpportunity = createOpportunityRecord(
      {
        ...opportunityInput,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake"
      },
      {
        crmPipelineStateUpdatedAt: existingPipelineStateUpdatedAt,
        createdAt: new Date("2026-05-16T00:00:00.000Z"),
        updatedAt: new Date("2026-05-19T00:00:00.000Z")
      }
    );

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listOpportunities() {
        return [existingOpportunity];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Client Alpha",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Contact Alpha",
          email: "contact@example.test",
          phone: null,
          telegram: null,
          role: "Sponsor",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Implementation",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Intake",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineById() {
        return {
          id: "pipeline-sales",
          tenantId: "tenant-alpha",
          name: "Sales",
          status: "active",
          lifecycleGraphMetadata: {
            pipelineId: "pipeline-sales",
            initialStageId: "pipeline-stage-intake",
            finalStageIds: [],
            stages: [],
            transitions: []
          },
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineStageById() {
        return {
          id: "pipeline-stage-intake",
          tenantId: "tenant-alpha",
          pipelineId: "pipeline-sales",
          name: "Intake",
          sortOrder: 10,
          status: "active",
          lifecycleState: "open",
          isFinal: false,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity(input) {
        updatedInput = input;
        const persistenceInput = input as OpportunityInput & {
          crmPipelineStateUpdatedAt?: Date | null;
        };
        return createOpportunityRecord(input, {
          crmPipelineStateUpdatedAt:
            persistenceInput.crmPipelineStateUpdatedAt ??
            new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z")
        });
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake",
        title: "Updated title",
        contractValue: 1_250_000
      }
    });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      opportunity: {
        title: "Updated title",
        contractValue: 1_250_000,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-intake",
        crmPipelineStateUpdatedAt: existingPipelineStateUpdatedAt
      }
    });
    expect(updatedInput).toMatchObject({
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-intake",
      crmPipelineStateUpdatedAt: existingPipelineStateUpdatedAt
    });
    expect(audits[0]?.afterState).toMatchObject({
      crmPipelineStateUpdatedAt: existingPipelineStateUpdatedAt
    });
  });

  it("rejects direct CRM pipeline seeding to a non-initial stage", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    const existingOpportunity = createOpportunityRecord(opportunityInput, {
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listOpportunities() {
        return [existingOpportunity];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Client Alpha",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Contact Alpha",
          email: "contact@example.test",
          phone: null,
          telegram: null,
          role: "Sponsor",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Implementation",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Intake",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineById() {
        return {
          id: "pipeline-sales",
          tenantId: "tenant-alpha",
          name: "Sales",
          status: "active",
          lifecycleGraphMetadata: {
            pipelineId: "pipeline-sales",
            initialStageId: "pipeline-stage-intake",
            finalStageIds: [],
            stages: [],
            transitions: []
          },
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineStageById(_tenantId, _pipelineId, stageId) {
        return {
          id: stageId,
          tenantId: "tenant-alpha",
          pipelineId: "pipeline-sales",
          name: stageId === "pipeline-stage-intake" ? "Intake" : "Qualified",
          sortOrder: stageId === "pipeline-stage-intake" ? 10 : 20,
          status: "active",
          lifecycleState: "open",
          isFinal: false,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity(input) {
        updatedInput = input;
        return createOpportunityRecord(input);
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-qualified"
      }
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "crm_pipeline_initial_stage_required"
    });
    expect(updatedInput).toBeNull();
    expect(audits).toEqual([]);
  });

  it("allows direct CRM pipeline seeding to the initial stage for uninitialized opportunities", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    const existingOpportunity = createOpportunityRecord(opportunityInput, {
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listOpportunities() {
        return [existingOpportunity];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Client Alpha",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Contact Alpha",
          email: "contact@example.test",
          phone: null,
          telegram: null,
          role: "Sponsor",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Implementation",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Intake",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineById() {
        return {
          id: "pipeline-sales",
          tenantId: "tenant-alpha",
          name: "Sales",
          status: "active",
          lifecycleGraphMetadata: {
            pipelineId: "pipeline-sales",
            initialStageId: "pipeline-stage-qualified",
            finalStageIds: [],
            stages: [],
            transitions: []
          },
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findCrmPipelineStageById(_tenantId, _pipelineId, stageId) {
        return {
          id: stageId,
          tenantId: "tenant-alpha",
          pipelineId: "pipeline-sales",
          name: stageId === "pipeline-stage-qualified" ? "Qualified" : "Intake",
          sortOrder: stageId === "pipeline-stage-qualified" ? 20 : 10,
          status: stageId === "pipeline-stage-qualified" ? "active" : "archived",
          lifecycleState: "open",
          isFinal: false,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity(input) {
        updatedInput = input;
        return createOpportunityRecord(input, {
          createdAt: existingOpportunity.createdAt,
          updatedAt: new Date("2026-05-20T00:00:00.000Z")
        });
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    await expect(
      service.updateOpportunity({
        actor,
        opportunityId: opportunityInput.id,
        input: {
          ...opportunityInput,
          crmPipelineId: "pipeline-sales",
          crmPipelineStageId: "pipeline-stage-intake"
        }
      })
    ).resolves.toEqual({
      ok: false,
      status: 404,
      error: "crm_pipeline_stage_not_found"
    });
    expect(updatedInput).toBeNull();
    expect(audits).toHaveLength(0);

    const result = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: {
        ...opportunityInput,
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-qualified"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      opportunity: {
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-qualified"
      }
    });
    expect(updatedInput).toMatchObject({
      crmPipelineId: "pipeline-sales",
      crmPipelineStageId: "pipeline-stage-qualified"
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actionType: "opportunity.updated",
      beforeState: expect.objectContaining({
        crmPipelineId: null,
        crmPipelineStageId: null
      }),
      afterState: expect.objectContaining({
        crmPipelineId: "pipeline-sales",
        crmPipelineStageId: "pipeline-stage-qualified"
      })
    });
  });

  it("returns conflict instead of throwing when opportunity update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity = createOpportunityRecord(opportunityInput, {
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });
    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async findClientById() {
        return {
          id: "client-alpha",
          tenantId: "tenant-alpha",
          name: "Ромашка",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findContactById() {
        return {
          id: "contact-alpha",
          tenantId: "tenant-alpha",
          clientId: "client-alpha",
          name: "Ирина Заказчик",
          email: "irina@example.test",
          phone: null,
          telegram: null,
          role: "спонсор",
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findProjectTypeById() {
        return {
          id: "project-type-alpha",
          tenantId: "tenant-alpha",
          name: "Внедрение",
          description: null,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async findDealStageById() {
        return {
          id: "deal-stage-alpha",
          tenantId: "tenant-alpha",
          name: "Квалификация",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity() {
        return undefined;
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };
    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.updateOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      input: opportunityInput
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "opportunity_update_locked"
    });
    expect(audits).toEqual([]);
  });

  it("returns conflict instead of throwing when feasibility update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity = createOpportunityRecord(opportunityInput, {
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });
    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById(userId) {
        return userId === actor.id ? actor : undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async listPositions() {
        return [];
      },
      async listWorkspaceUsers() {
        return [];
      },
      async listProjects() {
        return [];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async updateOpportunityFeasibility() {
        return undefined;
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };
    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.checkOpportunityFeasibility({
      actor,
      opportunityId: opportunityInput.id
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "opportunity_not_feasible"
    });
    expect(audits).toEqual([]);
  });

  it("finalizes an opportunity through a governed close/reject action and records management audit", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let finalizedInput: { tenantId: string; opportunityId: string; status: string } | null =
      null;
    const existingOpportunity = createOpportunityRecord(opportunityInput, {
      status: "feasibility",
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });

    const dataSource: ApiTenantDataSource = {
      async listDevUsers() {
        return [];
      },
      async findUserById() {
        return undefined;
      },
      async findTenantById() {
        return undefined;
      },
      async listUsersByTenantId() {
        return [];
      },
      async findOpportunityById() {
        return existingOpportunity;
      },
      async finalizeOpportunity(input) {
        finalizedInput = input;
        return {
          ...existingOpportunity,
          status: input.status,
          customFieldValues: existingOpportunity.customFieldValues,
          updatedAt: new Date("2026-05-20T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        return operation(dataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    };

    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.finalizeOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      finalAction: {
        status: "lost_rejected",
        reason: "Клиент заморозил бюджет"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      opportunity: {
        id: "opportunity-service",
        status: "lost_rejected"
      }
    });
    expect(finalizedInput).toMatchObject({
      tenantId: "tenant-alpha",
      opportunityId: "opportunity-service",
      status: "lost_rejected"
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actionType: "opportunity.lost_rejected",
      commandInput: {
        opportunityId: "opportunity-service",
        reason: "Клиент заморозил бюджет"
      },
      beforeState: expect.objectContaining({ status: "feasibility" }),
      afterState: expect.objectContaining({ status: "lost_rejected" }),
      permissionResult: {
        allowed: true
      }
    });
  });
});
