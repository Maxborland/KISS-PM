import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase12FixtureSeed } from "@kiss-pm/shared-test-fixtures";

export const phase12Seed = getPhase12FixtureSeed();
export const tenantA = phase12Seed.tenantA;
export const tenantB = phase12Seed.tenantB;
export const phase12Users = {
  operatorAdmin: tenantA.roles.operatorAdmin.userId,
  tenantAdmin: tenantA.roles.tenantAdmin.userId,
  projectManager: tenantA.roles.projectManager.userId,
  resourceManager: tenantA.roles.resourceManager.userId,
  integrationAdmin: tenantA.roles.integrationAdmin.userId,
  readonlyObserver: tenantA.roles.readonlyObserver.userId
};

export function phase12ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

export function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export async function resetPhase12Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase12ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openKissPm(page: Page, testUser = phase12Users.operatorAdmin) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function getDeploymentReadback(request: APIRequestContext) {
  const response = await request.get(`${phase12ApiBaseUrl()}/health/deployment`);
  await expect(response).toBeOK();
  return (await response.json()) as {
    status: string;
    checks: Array<{ id: string; status: string; actual: string }>;
  };
}

export async function getOpsAudit(request: APIRequestContext, testUser = phase12Users.operatorAdmin) {
  const response = await request.get(`${phase12ApiBaseUrl()}/api/ops/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as {
    events: Array<{ actionKey: string; target: { entityId: string } }>;
  };
}

export async function getApiJson<T>(request: APIRequestContext, path: string, testUser = phase12Users.operatorAdmin): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const response = await request.get(`${phase12ApiBaseUrl()}${path}${separator}testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();
  return (await response.json()) as T;
}
