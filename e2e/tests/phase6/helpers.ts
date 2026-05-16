import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { getPhase6FixtureSeed } from "@kiss-pm/shared-test-fixtures";

export const phase6Seed = getPhase6FixtureSeed();
export const tenantAOverloadId = phase6Seed.tenantA.overload!.id;
export const tenantALoadBucketId = phase6Seed.tenantA.loadBucket.id;

export type ResourceLoadBucketDto = {
  id: string;
  resourceProfileId: string;
  capacityHours: number;
  assignedHours: number;
  reservedHours: number;
  totalLoadHours: number;
  loadPercent: number;
  severity: "none" | "watch" | "warning" | "critical";
  sourceRefs: string[];
};

export type ResourceLoadProjectionDto = {
  resourceProfiles: Array<{ id: string; label: string; tenantId: string }>;
  capacityCalendars: Array<{ id: string; resourceProfileId: string; defaultDailyCapacityHours: number }>;
  availabilityExceptions: Array<{ id: string; resourceProfileId: string; capacityHoursPerDay?: number }>;
  assignments: Array<{ id: string; projectId: string; taskId: string; resourceProfileId: string; plannedWorkHours: number }>;
  reservations: Array<{ id: string; sourceId: string; resourceProfileId: string; reservedHours: number }>;
  loadBuckets: ResourceLoadBucketDto[];
  overloads: Array<{
    id: string;
    resourceProfileId: string;
    overloadHours: number;
    severity: "none" | "watch" | "warning" | "critical";
    status: string;
    affectedProjectIds: string[];
    affectedTaskIds: string[];
    recommendedActionKeys: string[];
  }>;
};

export type ResourceResolutionPreviewDto = {
  id: string;
  overloadId: string;
  canConfirm: boolean;
  beforeLoadBuckets: ResourceLoadBucketDto[];
  afterLoadBuckets: ResourceLoadBucketDto[];
  requiredPermissions: string[];
};

export type ResourceAuditDto = {
  events: Array<{ actionKey: string; target: { entityId: string }; correlationId: string }>;
  actionExecutions: Array<{
    commandType: string;
    requiredPermission: string;
    status: string;
    source: { entityId: string };
    target?: { entityId: string };
  }>;
};

export function phase6ApiBaseUrl(): string {
  return `http://127.0.0.1:${process.env.PW_API_PORT ?? "4187"}`;
}

function jsonRequest(body: unknown) {
  return {
    headers: { "content-type": "application/json" },
    data: body
  };
}

export async function resetPhase6Fixtures(request: APIRequestContext) {
  const response = await request.post(`${phase6ApiBaseUrl()}/test-fixtures/reset`);
  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: "reset" });
}

export async function openResourceLoadSurface(page: Page, testUser = phase6Seed.tenantA.managerUserId) {
  await page.goto(`/?testUser=${encodeURIComponent(testUser)}`);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("resource-load-surface")).toBeVisible();
  await expect(page.getByTestId("resource-load-status")).toContainText("Нагрузка загружена");
}

export async function getResourceLoad(
  request: APIRequestContext,
  testUser = phase6Seed.tenantA.managerUserId
): Promise<ResourceLoadProjectionDto> {
  const response = await request.get(`${phase6ApiBaseUrl()}/api/resources/load?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();

  return (await response.json()) as ResourceLoadProjectionDto;
}

export async function getLoadBucket(
  request: APIRequestContext,
  bucketId = tenantALoadBucketId,
  testUser = phase6Seed.tenantA.managerUserId
): Promise<ResourceLoadBucketDto> {
  const response = await request.get(
    `${phase6ApiBaseUrl()}/api/resources/load/${encodeURIComponent(bucketId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { bucket: ResourceLoadBucketDto };

  return body.bucket;
}

export async function getOverloadDetail(
  request: APIRequestContext,
  overloadId = tenantAOverloadId,
  testUser = phase6Seed.tenantA.managerUserId
) {
  const response = await request.get(
    `${phase6ApiBaseUrl()}/api/resources/overloads/${encodeURIComponent(overloadId)}?testUser=${encodeURIComponent(testUser)}`
  );
  await expect(response).toBeOK();

  return (await response.json()) as {
    overload: ResourceLoadProjectionDto["overloads"][number] & { explanation: string };
    loadBuckets: ResourceLoadBucketDto[];
    affectedAssignments: ResourceLoadProjectionDto["assignments"];
    affectedReservations: ResourceLoadProjectionDto["reservations"];
  };
}

export async function previewShiftResolution(
  request: APIRequestContext,
  testUser = phase6Seed.tenantA.managerUserId
): Promise<ResourceResolutionPreviewDto> {
  const response = await request.post(
    `${phase6ApiBaseUrl()}/api/resources/overloads/${encodeURIComponent(tenantAOverloadId)}/preview?testUser=${encodeURIComponent(
      testUser
    )}`,
    jsonRequest({
      actionKey: "shift_work",
      assignmentId: phase6Seed.tenantA.overload!.assignmentId,
      shiftDays: 7,
      reason: "Освободить перегруженную неделю"
    })
  );
  await expect(response).toBeOK();
  const body = (await response.json()) as { preview: ResourceResolutionPreviewDto };

  return body.preview;
}

export async function applyPreview(
  request: APIRequestContext,
  previewId: string,
  testUser = phase6Seed.tenantA.managerUserId
) {
  const response = await request.post(
    `${phase6ApiBaseUrl()}/api/resources/overloads/${encodeURIComponent(tenantAOverloadId)}/apply?testUser=${encodeURIComponent(
      testUser
    )}`,
    jsonRequest({ previewId })
  );
  await expect(response).toBeOK();

  return response.json();
}

export async function getResourceAudit(
  request: APIRequestContext,
  testUser = phase6Seed.tenantA.adminUserId
): Promise<ResourceAuditDto> {
  const response = await request.get(`${phase6ApiBaseUrl()}/api/resources/audit?testUser=${encodeURIComponent(testUser)}`);
  await expect(response).toBeOK();

  return (await response.json()) as ResourceAuditDto;
}
