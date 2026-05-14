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

describe("Phase 3 project draft API", () => {
  it("creates an audited project draft from a qualified opportunity", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const createDraft = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=project-manager-a",
      jsonRequest({})
    );

    expect(createDraft.status).toBe(201);
    const createBody = (await readJson(createDraft)) as {
      correlationId: string;
      projectDraft: { id: string; tenantId: string; sourceOpportunity: { opportunityId: string } };
      actionExecution: { status: string; requiredPermission: string; before: null; after: unknown };
    };
    expect(createBody).toMatchObject({
      correlationId: "corr-project-draft-opportunity-seed-ready",
      projectDraft: {
        id: "project-draft-opportunity-seed-ready",
        tenantId: "tenant-a",
        sourceOpportunity: {
          opportunityId: "opportunity-seed-ready"
        }
      },
      actionExecution: {
        status: "succeeded",
        requiredPermission: "project_draft.create",
        before: null
      }
    });

    const readDraft = await app.request(`/api/projects/${createBody.projectDraft.id}?testUser=project-manager-a`);
    expect(readDraft.status).toBe(200);
    await expect(readJson(readDraft)).resolves.toMatchObject({
      projectDraft: {
        id: createBody.projectDraft.id,
        status: "draft",
        sourceOpportunity: {
          type: "crm_opportunity",
          opportunityId: "opportunity-seed-ready"
        }
      }
    });

    const audit = await app.request(
      "/api/audit?testUser=tenant-admin-a&targetType=opportunity&targetId=opportunity-seed-ready"
    );
    expect(audit.status).toBe(200);
    const auditBody = (await readJson(audit)) as {
      events: Array<{
        actionKey: string;
        correlationId: string;
        target: { entityType: string; entityId: string };
        details?: {
          after?: {
            processTemplate?: {
              templateId: string;
              key: string;
              version: number;
              matchConfidence: number;
              assumptions: Array<{ code: string; message: string }>;
            };
          };
        };
      }>;
    };
    expect(auditBody.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionKey: "project_draft.create_from_opportunity",
          correlationId: "corr-project-draft-opportunity-seed-ready",
          target: {
            entityType: "opportunity",
            entityId: "opportunity-seed-ready"
          },
          details: expect.objectContaining({
            after: expect.objectContaining({
              processTemplate: expect.objectContaining({
                templateId: "process-template-integrations-tenant-a",
                key: "implementation.integration_heavy",
                version: 2,
                matchConfidence: expect.any(Number),
                assumptions: expect.arrayContaining([
                  { code: "integration_delivery", message: "Учтены интеграционные работы." }
                ])
              })
            })
          })
        })
      ])
    );
  });

  it("denies unauthorized and cross-tenant project draft creation without leaking private data", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const denied = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=readonly-observer-a",
      jsonRequest({})
    );
    expect(denied.status).toBe(403);

    const crossTenant = await app.request(
      "/api/crm/opportunities/opportunity-b-private/project-draft?testUser=project-manager-a",
      jsonRequest({})
    );
    expect(crossTenant.status).toBe(404);
    const crossTenantText = await crossTenant.text();
    expect(crossTenantText).not.toContain("Tenant B");
    expect(crossTenantText).not.toContain("opportunity-b-private");
  });

  it("does not create duplicate drafts for the same opportunity", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const firstCreate = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=project-manager-a",
      jsonRequest({})
    );
    expect(firstCreate.status).toBe(201);

    const secondCreate = await app.request(
      "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=project-manager-a",
      jsonRequest({})
    );
    expect(secondCreate.status).toBe(409);
    await expect(readJson(secondCreate)).resolves.toMatchObject({ code: "conflict" });
  });

  it("rejects project draft creation when readiness preconditions are not satisfied", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const opportunity = await app.request(
      "/api/crm/opportunities?testUser=project-manager-a",
      jsonRequest({
        title: "Неполная возможность",
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: { amount: 100_000, currency: "RUB" },
        probability: 0.5,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: []
      })
    );
    const opportunityBody = (await readJson(opportunity)) as { opportunity: { id: string } };

    const createDraft = await app.request(
      `/api/crm/opportunities/${opportunityBody.opportunity.id}/project-draft?testUser=project-manager-a`,
      jsonRequest({})
    );

    expect(createDraft.status).toBe(409);
    await expect(readJson(createDraft)).resolves.toMatchObject({ code: "precondition_failed" });
  });
});
