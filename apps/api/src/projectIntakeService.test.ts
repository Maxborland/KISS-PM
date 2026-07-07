import { ensureCompleteDataSource } from "./dataSourceCompletion";
import { describe, expect, it } from "vitest";
import { tenantAdminProfile } from "./tenantAdminProfile";
import { createProjectIntakeService } from "./projectIntakeService";
import { isSingleUseActivationError } from "./projectIntakeService/activationErrors";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  OpportunityInput,
  OpportunityRecord,
  ProjectRecord
} from "./apiTypes";
import type { TenantUser } from "@kiss-pm/domain";

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

describe("project intake application service", () => {
  it("treats finalized source opportunity draft race as activation conflict", () => {
    expect(
      isSingleUseActivationError(new Error("source_opportunity_not_draftable"))
    ).toBe(true);
  });

  it("keeps opportunity activation single-use when a duplicate submit repeats the write flow", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const projects: ProjectRecord[] = [];
    let opportunityStatus: OpportunityRecord["status"] = "ready_to_activate";
    let createDraftCalls = 0;
    let activateDraftCalls = 0;
    const existingOpportunity = (): OpportunityRecord => ({
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: null,
      customFieldValues: {},
      status: opportunityStatus,
      feasibilityStatus: "ok",
      feasibilityResult: { rows: [] },
      feasibilityCheckedAt: new Date("2026-05-19T00:00:00.000Z"),
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    });

    const dataSource = ensureCompleteDataSource({
      async findOpportunityById() {
        return existingOpportunity();
      },
      async listPositions() {
        return [
          {
            id: "position-analyst",
            tenantId: "tenant-alpha",
            name: "Аналитик",
            description: null,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          }
        ];
      },
      async listWorkspaceUsers() {
        return [
          {
            id: "user-analyst",
            tenantId: "tenant-alpha",
            email: "analyst@example.test",
            name: "Алексей Аналитик",
            accessProfileId: "tenant-admin",
            positionId: "position-analyst",
            positionName: "Аналитик",
            phone: null,
            telegram: null,
            status: "active",
            theme: "system",
            accentColor: "#2563eb",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          }
        ];
      },
      async listProjects() {
        return projects;
      },
      async lockTenantResourcePlanning() {
        return undefined;
      },
      async createProjectDraftFromOpportunity(input) {
        createDraftCalls += 1;
        const project: ProjectRecord = {
          ...input,
          sourceType: "opportunity",
          sourceOpportunityId: input.sourceOpportunityId,
          createdAt: new Date("2026-05-19T00:00:00.000Z"),
          activatedAt: null,
          closedAt: null
        };
        projects.push(project);
        return project;
      },
      async activateProjectDraft(input) {
        activateDraftCalls += 1;
        const project = projects.find((item) => item.id === input.projectId);
        if (!project || project.status !== "draft") {
          throw new Error("project_draft_not_activatable");
        }
        opportunityStatus = "won_closed";
        const activatedProject: ProjectRecord = {
          ...project,
          status: "active",
          activatedAt: new Date("2026-05-19T00:00:00.000Z")
        };
        projects.splice(projects.indexOf(project), 1, activatedProject);
        return activatedProject;
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });
    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const first = await service.activateProjectFromOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      activation: { id: "project-from-opportunity" }
    });
    const duplicate = await service.activateProjectFromOpportunity({
      actor,
      opportunityId: opportunityInput.id,
      activation: { id: "project-from-opportunity-duplicate" }
    });

    expect(first).toMatchObject({
      ok: true,
      status: 201,
      project: {
        id: "project-from-opportunity",
        status: "active",
        sourceOpportunityId: opportunityInput.id
      }
    });
    expect(duplicate).toEqual({
      ok: false,
      status: 409,
      error: "opportunity_not_activatable"
    });
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: "project-from-opportunity",
      status: "active"
    });
    expect(createDraftCalls).toBe(1);
    expect(activateDraftCalls).toBe(1);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actionType: "project.activated",
      commandInput: {
        opportunityId: opportunityInput.id,
        projectId: "project-from-opportunity"
      }
    });
  });

  it("creates opportunities with linked snapshot labels and management audit inside a transaction", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let createdInput: OpportunityInput | null = null;
    let transactionUsed = false;

    const dataSource = ensureCompleteDataSource({
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
          // Legacy-кейс: стадия без воронки. Канонический контракт уже string,
          // тест сохраняет старое runtime-значение null для толерантных путей сервиса.
          pipelineId: null as unknown as string,
          name: "Квалификация",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async createOpportunity(input) {
        createdInput = input;
        return {
          ...input,
          ownerUserId: input.ownerUserId ?? null,
          pipelineId: null,
          customFieldValues: input.customFieldValues ?? {},
          feasibilityStatus: null,
          feasibilityResult: null,
          feasibilityCheckedAt: null,
          createdAt: new Date("2026-05-19T00:00:00.000Z"),
          updatedAt: new Date("2026-05-19T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        transactionUsed = true;
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });

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

  it("updates draft opportunity fields, refreshes linked labels and records management audit", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    let transactionUsed = false;
    const existingOpportunity: OpportunityRecord = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: null,
      customFieldValues: {},
      status: "ready_to_activate",
      feasibilityStatus: "ok",
      feasibilityResult: { rows: [] },
      feasibilityCheckedAt: new Date("2026-05-19T00:00:00.000Z"),
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };

    const dataSource = ensureCompleteDataSource({
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
          // Legacy-кейс: стадия без воронки. Канонический контракт уже string,
          // тест сохраняет старое runtime-значение null для толерантных путей сервиса.
          pipelineId: null as unknown as string,
          name: "Квалификация",
          sortOrder: 10,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunity(input) {
        updatedInput = input;
        return {
          ...input,
          ownerUserId: input.ownerUserId ?? null,
          pipelineId: null,
          customFieldValues: input.customFieldValues ?? {},
          feasibilityStatus: null,
          feasibilityResult: null,
          feasibilityCheckedAt: null,
          createdAt: existingOpportunity.createdAt,
          updatedAt: new Date("2026-05-20T00:00:00.000Z")
        };
      },
      async withTransaction(operation) {
        transactionUsed = true;
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });

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

  it("returns conflict instead of throwing when opportunity update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity: OpportunityRecord = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: null,
      customFieldValues: {},
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
    const dataSource = ensureCompleteDataSource({
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
          // Legacy-кейс: стадия без воронки. Канонический контракт уже string,
          // тест сохраняет старое runtime-значение null для толерантных путей сервиса.
          pipelineId: null as unknown as string,
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
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });
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

  it("returns conflict instead of throwing when stage update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity: OpportunityRecord = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: null,
      customFieldValues: {},
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
    const dataSource = ensureCompleteDataSource({
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
      async findDealStageById() {
        return {
          id: "deal-stage-next",
          tenantId: "tenant-alpha",
          // Legacy-кейс: см. комментарий выше у deal-stage-alpha.
          pipelineId: null as unknown as string,
          name: "Следующий этап",
          sortOrder: 20,
          status: "active",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async updateOpportunityStage() {
        return undefined;
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });
    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.changeOpportunityStage({
      actor,
      opportunityId: opportunityInput.id,
      stageId: "deal-stage-next"
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "opportunity_stage_locked"
    });
    expect(audits).toEqual([]);
  });

  it("returns conflict instead of throwing when feasibility update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity: OpportunityRecord = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: null,
      customFieldValues: {},
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
    const dataSource = ensureCompleteDataSource({
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
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });
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

  it("blocks a stage transition with 422 when the probability guard is not met", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let stageUpdateCalled = false;
    const existingOpportunity: OpportunityRecord = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: "pipeline-sales",
      customFieldValues: {},
      probability: 30,
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
    const dataSource = ensureCompleteDataSource({
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
      async findDealStageById(_tenantId, stageId) {
        return {
          id: stageId,
          tenantId: "tenant-alpha",
          pipelineId: "pipeline-sales",
          name: stageId === "deal-stage-alpha" ? "Квалификация" : "Согласование",
          sortOrder: stageId === "deal-stage-alpha" ? 10 : 20,
          status: "active" as const,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-01T00:00:00.000Z")
        };
      },
      async listStageTransitions() {
        return [
          {
            id: "stage-transition-approve",
            tenantId: "tenant-alpha",
            pipelineId: "pipeline-sales",
            fromStageId: "deal-stage-alpha",
            toStageId: "deal-stage-approve",
            requireFeasibilityOk: false,
            minProbability: 70,
            guardNote: null,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            updatedAt: new Date("2026-05-01T00:00:00.000Z")
          }
        ];
      },
      async updateOpportunityStage() {
        stageUpdateCalled = true;
        return undefined;
      },
      async withTransaction(operation) {
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });
    const service = createProjectIntakeService({
      dataSource,
      getActorProfile: async () => tenantAdminProfile,
      runDataSourceTransaction: (operation) => dataSource.withTransaction!(operation),
      appendManagementAuditEvent: async (input) => {
        audits.push(input);
        return `audit-test-${audits.length}`;
      }
    });

    const result = await service.changeOpportunityStage({
      actor,
      opportunityId: opportunityInput.id,
      stageId: "deal-stage-approve"
    });

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: "condition_probability"
    });
    expect(stageUpdateCalled).toBe(false);
    expect(audits).toEqual([]);
  });

  it("finalizes an opportunity through a governed close/reject action and records management audit", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let finalizedInput: { tenantId: string; opportunityId: string; status: string } | null =
      null;
    const existingOpportunity: OpportunityRecord = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      pipelineId: null,
      customFieldValues: {},
      status: "feasibility",
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };

    const dataSource = ensureCompleteDataSource({
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
        return operation(dataSource as ApiTenantDataSource);
      },
      async appendAuditEvent() {
        throw new Error("service test uses appendManagementAuditEvent dependency");
      }
    });

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
