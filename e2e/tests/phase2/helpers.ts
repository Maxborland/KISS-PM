import { expect, type APIRequestContext, type Page } from "@playwright/test";

export function phase2ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4183"}`;
}

export async function openPhase2Surface(page: Page, testUser: string) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("phase2-admin-surface")).toBeVisible();
}

export async function resetPhase2Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase2ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function getAuditEvents(request: APIRequestContext, testUser: string) {
  const response = await request.get(`${phase2ApiBaseUrl()}/audit/events?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as {
    events: Array<{
      id: string;
      tenantId: string;
      actorId: string;
      actionKey: string;
      target: { entityType: string; entityId: string };
      result: string;
      timestamp: string;
      correlationId: string;
      details?: Record<string, unknown>;
    }>;
  };
}
