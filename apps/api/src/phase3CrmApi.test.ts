import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

describe("Phase 3 CRM intake API", () => {
  it("creates, lists, and reads tenant-scoped accounts and contacts", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const accountCreated = await app.request(
      "/api/crm/accounts?testUser=project-manager-a",
      jsonRequest({
        displayName: "Новый заказчик"
      })
    );
    expect(accountCreated.status).toBe(201);
    const accountBody = (await readJson(accountCreated)) as { account: { id: string } };
    expect(accountBody).toMatchObject({
      account: {
        tenantId: "tenant-a",
        displayName: "Новый заказчик"
      }
    });
    expect(accountBody.account.id).toMatch(/^account-tenant-a-/);

    const contactCreated = await app.request(
      "/api/crm/contacts?testUser=project-manager-a",
      jsonRequest({
        accountId: accountBody.account.id,
        displayName: "Ольга Петрова",
        email: "olga@example.test"
      })
    );
    expect(contactCreated.status).toBe(201);
    const contactBody = (await readJson(contactCreated)) as { contact: { id: string } };
    expect(contactBody).toMatchObject({
      contact: {
        tenantId: "tenant-a",
        accountId: accountBody.account.id,
        displayName: "Ольга Петрова"
      }
    });
    expect(contactBody.contact.id).toMatch(/^contact-tenant-a-/);

    const accounts = await app.request("/api/crm/accounts?testUser=project-manager-a");
    expect(accounts.status).toBe(200);
    const accountsBody = (await readJson(accounts)) as { accounts: Array<{ id: string; tenantId: string }> };
    expect(accountsBody.accounts.map((account) => account.id)).toContain(accountBody.account.id);
    expect(accountsBody.accounts.every((account) => account.tenantId === "tenant-a")).toBe(true);

    const contactRead = await app.request(`/api/crm/contacts/${contactBody.contact.id}?testUser=project-manager-a`);
    expect(contactRead.status).toBe(200);
    await expect(readJson(contactRead)).resolves.toMatchObject({
      contact: {
        id: contactBody.contact.id,
        displayName: "Ольга Петрова"
      }
    });
  });

  it("creates, lists, and reads tenant-scoped opportunities without external CRM fields", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const created = await app.request(
      "/api/crm/opportunities?testUser=project-manager-a",
      jsonRequest({
        title: "Портал клиента",
        account: {
          displayName: "АКМЕ"
        },
        contacts: [
          {
            displayName: "Анна Иванова",
            email: "anna@example.test",
            roleLabel: "Куратор"
          }
        ],
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 1_500_000, currency: "RUB" },
        probability: 0.75,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: [
          { key: "integrations_count", label: "Количество интеграций", value: 3 },
          { key: "modules_count", label: "Количество модулей", value: 5 }
        ]
      })
    );

    expect(created.status).toBe(201);
    const createdBody = (await readJson(created)) as {
      opportunity: { id: string; accountId: string; contactIds: string[] };
    };
    expect(createdBody).toMatchObject({
      opportunity: {
        tenantId: "tenant-a",
        title: "Портал клиента",
        source: { type: "manual" }
      }
    });
    expect(createdBody.opportunity.id).toMatch(/^opportunity-tenant-a-/);
    expect(createdBody.opportunity.accountId).toMatch(/^account-tenant-a-/);
    expect(createdBody.opportunity.contactIds).toHaveLength(1);

    const list = await app.request("/api/crm/opportunities?testUser=project-manager-a");
    expect(list.status).toBe(200);
    const listBody = (await readJson(list)) as { opportunities: Array<{ id: string; tenantId: string }> };
    expect(listBody.opportunities.map((opportunity) => opportunity.id)).toContain(createdBody.opportunity.id);
    expect(listBody.opportunities.every((opportunity) => opportunity.tenantId === "tenant-a")).toBe(true);

    const read = await app.request(`/api/crm/opportunities/${createdBody.opportunity.id}?testUser=project-manager-a`);
    expect(read.status).toBe(200);
    await expect(readJson(read)).resolves.toMatchObject({
      opportunity: {
        id: createdBody.opportunity.id,
        title: "Портал клиента",
        scopeHints: [
          { key: "integrations_count", label: "Количество интеграций", value: 3 },
          { key: "modules_count", label: "Количество модулей", value: 5 }
        ]
      }
    });
  });

  it("links an opportunity to existing tenant account and contact records", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const accountResponse = await app.request(
      "/api/crm/accounts?testUser=project-manager-a",
      jsonRequest({ displayName: "Заказчик для связи" })
    );
    const accountBody = (await readJson(accountResponse)) as { account: { id: string } };

    const contactResponse = await app.request(
      "/api/crm/contacts?testUser=project-manager-a",
      jsonRequest({ accountId: accountBody.account.id, displayName: "Контакт для связи" })
    );
    const contactBody = (await readJson(contactResponse)) as { contact: { id: string } };

    const opportunityResponse = await app.request(
      "/api/crm/opportunities?testUser=project-manager-a",
      jsonRequest({
        title: "Связанная возможность",
        accountId: accountBody.account.id,
        contactIds: [contactBody.contact.id],
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 1_000_000, currency: "RUB" },
        probability: 0.65,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: [
          { key: "integrations_count", label: "Количество интеграций", value: 1 },
          { key: "modules_count", label: "Количество модулей", value: 2 }
        ]
      })
    );

    expect(opportunityResponse.status).toBe(201);
    await expect(readJson(opportunityResponse)).resolves.toMatchObject({
      opportunity: {
        title: "Связанная возможность",
        accountId: accountBody.account.id,
        contactIds: [contactBody.contact.id]
      }
    });
  });

  it("runs readiness, template-match, and feasibility with stable trace and correlation ids", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readiness = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/readiness?testUser=project-manager-a",
      jsonRequest({})
    );
    expect(readiness.status).toBe(200);
    await expect(readJson(readiness)).resolves.toMatchObject({
      correlationId: expect.stringMatching(/^corr-/),
      readiness: {
        ready: true,
        nextAction: "run_feasibility",
        trace: expect.arrayContaining(["readiness:ready"])
      }
    });

    const templateMatch = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/template-match?testUser=project-manager-a",
      jsonRequest({})
    );
    expect(templateMatch.status).toBe(200);
    await expect(readJson(templateMatch)).resolves.toMatchObject({
      templateMatch: {
        matched: true,
        template: {
          key: "implementation.integration_heavy",
          version: 2
        },
        trace: expect.arrayContaining(["process_template_match:selected:implementation.integration_heavy"])
      }
    });

    const feasibility = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/feasibility?testUser=resource-manager-a",
      jsonRequest({})
    );
    expect(feasibility.status).toBe(200);
    await expect(readJson(feasibility)).resolves.toMatchObject({
      correlationId: expect.stringMatching(/^corr-/),
      demandEstimate: {
        totalPlannedWorkHours: 204,
        trace: expect.arrayContaining(["demand_estimate:stage_role_demands:2"])
      },
      feasibility: {
        status: "fit",
        severity: "warning",
        trace: expect.arrayContaining(["capacity_feasibility:status:fit"]),
        blockers: [
          {
            code: "conflicting_reservation",
            severity: "warning",
            roleKey: "solution_architect"
          }
        ]
      }
    });
  });

  it("denies read-only mutations and hides cross-tenant opportunities", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const deniedCreate = await app.request(
      "/api/crm/opportunities?testUser=readonly-observer-a",
      jsonRequest({
        title: "Запрещенная возможность",
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 1, currency: "RUB" },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: []
      })
    );
    expect(deniedCreate.status).toBe(403);
    await expect(readJson(deniedCreate)).resolves.toMatchObject({ code: "permission_denied" });

    const crossRead = await app.request("/api/crm/opportunities/opportunity-b-private?testUser=project-manager-a");
    expect(crossRead.status).toBe(404);
    const crossText = await crossRead.text();
    expect(crossText).toContain("not_found");
    expect(crossText).not.toContain("Tenant B");
    expect(crossText).not.toContain("opportunity-b-private");

    const crossAccount = await app.request("/api/crm/accounts/account-opportunity-b-private?testUser=project-manager-a");
    expect(crossAccount.status).toBe(404);
    const crossAccountText = await crossAccount.text();
    expect(crossAccountText).not.toContain("Tenant B");

    const foreignAccountContact = await app.request(
      "/api/crm/contacts?testUser=project-manager-a",
      jsonRequest({
        accountId: "account-opportunity-b-private",
        displayName: "Чужой контакт"
      })
    );
    expect(foreignAccountContact.status).toBe(400);
    const foreignAccountText = await foreignAccountContact.text();
    expect(foreignAccountText).not.toContain("Tenant B");

    const foreignContactOpportunity = await app.request(
      "/api/crm/opportunities?testUser=project-manager-a",
      jsonRequest({
        title: "Связь с чужим контактом",
        contactIds: ["contact-opportunity-b-private"],
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 1_000_000, currency: "RUB" },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: [
          { key: "integrations_count", label: "Количество интеграций", value: 1 },
          { key: "modules_count", label: "Количество модулей", value: 1 }
        ]
      })
    );
    expect(foreignContactOpportunity.status).toBe(400);
    const nonexistentContactOpportunity = await app.request(
      "/api/crm/opportunities?testUser=project-manager-a",
      jsonRequest({
        title: "Связь с неизвестным контактом",
        contactIds: ["contact-never-created"],
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 1_000_000, currency: "RUB" },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: [
          { key: "integrations_count", label: "Количество интеграций", value: 1 },
          { key: "modules_count", label: "Количество модулей", value: 1 }
        ]
      })
    );
    expect(nonexistentContactOpportunity.status).toBe(400);
    expect(await foreignContactOpportunity.text()).toBe(await nonexistentContactOpportunity.text());

    const deniedFeasibility = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/feasibility?testUser=readonly-observer-a",
      jsonRequest({})
    );
    expect(deniedFeasibility.status).toBe(403);
    await expect(readJson(deniedFeasibility)).resolves.toMatchObject({ code: "permission_denied" });
  });

  it("rejects unknown CRM payload fields and non-empty command bodies", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const externalPayload = await app.request(
      "/api/crm/opportunities?testUser=project-manager-a",
      jsonRequest({
        title: "Портал клиента",
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 1_500_000, currency: "RUB" },
        probability: 0.75,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        bitrixDealId: "DEAL-1"
      })
    );
    expect(externalPayload.status).toBe(400);
    await expect(readJson(externalPayload)).resolves.toMatchObject({ code: "validation_error" });

    const nonEmptyCommand = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/readiness?testUser=project-manager-a",
      jsonRequest({ force: true })
    );
    expect(nonEmptyCommand.status).toBe(400);
    await expect(readJson(nonEmptyCommand)).resolves.toMatchObject({ code: "validation_error" });

    const clientProvidedId = await app.request(
      "/api/crm/accounts?testUser=project-manager-a",
      jsonRequest({
        id: "account-opportunity-b-private",
        displayName: "Попытка задать внешний ID"
      })
    );
    expect(clientProvidedId.status).toBe(400);
    await expect(readJson(clientProvidedId)).resolves.toMatchObject({ code: "validation_error" });
  });

  it("keeps the project-draft command entrypoint permission checked after P3-008 implementation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const denied = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=readonly-observer-a",
      jsonRequest({})
    );
    expect(denied.status).toBe(403);

    const acceptedBoundary = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=project-manager-a",
      jsonRequest({})
    );
    expect(acceptedBoundary.status).toBe(201);
    await expect(readJson(acceptedBoundary)).resolves.toMatchObject({
      projectDraft: {
        sourceOpportunity: {
          opportunityId: "opportunity-seed-ready"
        }
      },
      actionExecution: {
        requiredPermission: "project_draft.create",
        status: "succeeded"
      }
    });
  });
});
