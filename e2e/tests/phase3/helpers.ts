import { expect, type APIRequestContext, type Page } from "@playwright/test";

export function phase3ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

export async function resetPhase3Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase3ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openCrmIntakeSurface(page: Page, testUser: string) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("crm-intake-surface")).toBeVisible();
  await expect(page.getByTestId("crm-intake-status")).toContainText(/CRM-приемка загружена|Готово/);
}

export async function listOpportunities(request: APIRequestContext, testUser: string) {
  const response = await request.get(`${phase3ApiBaseUrl()}/api/crm/opportunities?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as {
    opportunities: Array<{
      id: string;
      tenantId: string;
      title: string;
      contactIds: string[];
      scopeHints: Array<{ key: string; value: string | number | boolean }>;
    }>;
  };
}

export async function getProjectDraft(request: APIRequestContext, testUser: string, projectDraftId: string) {
  const response = await request.get(
    `${phase3ApiBaseUrl()}/api/projects/${encodeURIComponent(projectDraftId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  return (await response.json()) as {
    projectDraft: {
      id: string;
      tenantId: string;
      title: string;
      status: string;
      sourceOpportunity: {
        type: "crm_opportunity";
        opportunityId: string;
        title: string;
      };
      processTemplate: {
        key: string;
        assumptions: Array<{ code: string; message: string }>;
      };
      demand: {
        totalPlannedWorkHours: number;
      };
      feasibility: {
        status: string;
      };
      correlationId: string;
    };
  };
}

export async function getOpportunityAudit(request: APIRequestContext, testUser: string, opportunityId: string) {
  const response = await request.get(
    `${phase3ApiBaseUrl()}/api/audit?targetType=opportunity&targetId=${encodeURIComponent(
      opportunityId
    )}&testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  return (await response.json()) as {
    events: Array<{
      tenantId: string;
      actorId: string;
      actionKey: string;
      target: { entityType: string; entityId: string };
      result: string;
      correlationId: string;
      details?: {
        after?: {
          projectDraftId?: string;
          processTemplate?: {
            assumptions?: Array<{ code: string; message: string }>;
          };
        };
      };
    }>;
  };
}
