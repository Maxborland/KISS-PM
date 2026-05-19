import { describe, expect, it } from "vitest";
import { tenantAdminProfile } from "./tenantAdminProfile";
import { createProjectIntakeService } from "./projectIntakeService";
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
  demand: [{ positionId: "position-analyst", requiredHours: 160 }]
};

describe("project intake application service", () => {
  it("creates opportunities with linked snapshot labels and management audit inside a transaction", async () => {
    const audits: ManagementAuditEventInput[] = [];
    let createdInput: OpportunityInput | null = null;
    let transactionUsed = false;

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
});
