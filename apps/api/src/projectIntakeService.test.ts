import { describe, expect, it } from "vitest";
import { tenantAdminProfile } from "./tenantAdminProfile";
import { createProjectIntakeService } from "./projectIntakeService";
import { isSingleUseActivationError } from "./projectIntakeService/activationErrors";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  OpportunityInput
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
        return {
          ...input,
          ownerUserId: input.ownerUserId ?? null,
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

  it("updates draft opportunity fields, refreshes linked labels and records management audit", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let updatedInput: OpportunityInput | null = null;
    let transactionUsed = false;
    const existingOpportunity = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      customFieldValues: {},
      status: "ready_to_activate",
      feasibilityStatus: "ok",
      feasibilityResult: { rows: [] },
      feasibilityCheckedAt: new Date("2026-05-19T00:00:00.000Z"),
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };

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
        return {
          ...input,
          ownerUserId: input.ownerUserId ?? null,
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

  it("returns conflict instead of throwing when opportunity update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      customFieldValues: {},
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
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

  it("returns conflict instead of throwing when stage update loses a finalization race", async () => {
    const audits: ManagementAuditEventInput[] = [];
    const existingOpportunity = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      customFieldValues: {},
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
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
      async findDealStageById() {
        return {
          id: "deal-stage-next",
          tenantId: "tenant-alpha",
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
    const existingOpportunity = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      customFieldValues: {},
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };
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
    const existingOpportunity = {
      ...opportunityInput,
      ownerUserId: opportunityInput.ownerUserId ?? null,
      customFieldValues: {},
      status: "feasibility",
      feasibilityStatus: null,
      feasibilityResult: null,
      feasibilityCheckedAt: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };

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
