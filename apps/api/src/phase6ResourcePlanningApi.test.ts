import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

const tenantAOverloadId = "overload:resource-architect-a:2026-06-01:2026-06-05";
const tenantALoadBucketId = "load:resource-architect-a:2026-06-01:2026-06-05";

describe("Phase 6 resource planning API", () => {
  it("returns deterministic resource load buckets, overload severity, and affected entities", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const response = await app.request("/api/resources/load?testUser=resource-manager-a");
    expect(response.status).toBe(200);
    const body = (await readJson(response)) as {
      resourceProfiles: Array<{ id: string; tenantId: string; label: string }>;
      capacityCalendars: Array<{ resourceProfileId: string }>;
      availabilityExceptions: Array<{ id: string }>;
      assignments: Array<{ id: string }>;
      reservations: Array<{ id: string }>;
      loadBuckets: Array<{
        id: string;
        capacityHours: number;
        assignedHours: number;
        reservedHours: number;
        totalLoadHours: number;
        severity: string;
      }>;
      overloads: Array<{
        id: string;
        severity: string;
        overloadHours: number;
        affectedTaskIds: string[];
        affectedProjectIds: string[];
        recommendedActionKeys: string[];
      }>;
    };

    expect(body.resourceProfiles.map((profile) => profile.id)).toEqual([
      "resource-architect-a",
      "resource-engineer-a"
    ]);
    expect(body.capacityCalendars).toHaveLength(2);
    expect(body.availabilityExceptions).toContainEqual(expect.objectContaining({ id: "reduced-architect-a-2026-06-03" }));
    expect(body.assignments).toContainEqual(expect.objectContaining({ id: "assignment-design-architect-a" }));
    expect(body.reservations).toContainEqual(expect.objectContaining({ id: "reservation-draft-architect-a" }));
    expect(body.loadBuckets).toContainEqual(
      expect.objectContaining({
        id: tenantALoadBucketId,
        capacityHours: 36,
        assignedHours: 42,
        reservedHours: 8,
        totalLoadHours: 50,
        severity: "critical"
      })
    );
    expect(body.overloads).toContainEqual(
      expect.objectContaining({
        id: tenantAOverloadId,
        severity: "critical",
        overloadHours: 14,
        affectedTaskIds: ["task-design-a"],
        affectedProjectIds: ["project-alpha-a", "project-draft-alpha-a"],
        recommendedActionKeys: expect.arrayContaining(["shift_work", "split_work", "reassign_resource", "accept_risk"])
      })
    );

    const overloadResponse = await app.request(`/api/resources/overloads/${tenantAOverloadId}?testUser=resource-manager-a`);
    expect(overloadResponse.status).toBe(200);
    await expect(readJson(overloadResponse)).resolves.toMatchObject({
      overload: {
        id: tenantAOverloadId,
        explanation: expect.stringContaining("14")
      },
      affectedAssignments: [expect.objectContaining({ id: "assignment-design-architect-a" })],
      affectedReservations: [expect.objectContaining({ id: "reservation-draft-architect-a" })]
    });
  });

  it("previews shift work without mutation and applies through a governed command with audit evidence", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const before = await app.request(`/api/resources/load/${tenantALoadBucketId}?testUser=resource-manager-a`);
    expect(before.status).toBe(200);
    await expect(readJson(before)).resolves.toMatchObject({
      bucket: { id: tenantALoadBucketId, totalLoadHours: 50, severity: "critical" }
    });

    const preview = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/preview?testUser=resource-manager-a`,
      jsonRequest({
        actionKey: "shift_work",
        assignmentId: "assignment-design-architect-a",
        shiftDays: 7,
        reason: "Освободить перегруженную неделю"
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as {
      preview: {
        id: string;
        canConfirm: boolean;
        beforeLoadBuckets: Array<{ id: string; totalLoadHours: number; severity: string }>;
        afterLoadBuckets: Array<{ id: string; totalLoadHours: number; severity: string }>;
      };
    };
    expect(previewBody.preview).toMatchObject({
      canConfirm: true,
      beforeLoadBuckets: [expect.objectContaining({ id: tenantALoadBucketId, totalLoadHours: 50, severity: "critical" })],
      afterLoadBuckets: [expect.objectContaining({ id: tenantALoadBucketId, totalLoadHours: 8, severity: "none" })]
    });

    const unchangedAfterPreview = await app.request(`/api/resources/load/${tenantALoadBucketId}?testUser=resource-manager-a`);
    expect(unchangedAfterPreview.status).toBe(200);
    await expect(readJson(unchangedAfterPreview)).resolves.toMatchObject({
      bucket: { id: tenantALoadBucketId, totalLoadHours: 50, severity: "critical" }
    });

    const apply = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/apply?testUser=resource-manager-a`,
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(apply.status).toBe(200);
    await expect(readJson(apply)).resolves.toMatchObject({
      result: {
        status: "succeeded",
        actionExecution: {
          commandType: "resource_resolution.shift_work",
          requiredPermission: "resource.write",
          status: "succeeded",
          source: { entityType: "resourceOverload", entityId: tenantAOverloadId },
          target: { entityType: "resourceAssignment", entityId: "assignment-design-architect-a" }
        }
      },
      readback: {
        loadBuckets: [expect.objectContaining({ id: tenantALoadBucketId, totalLoadHours: 8, severity: "none" }), expect.any(Object)],
        overloads: []
      }
    });

    const audit = await app.request("/api/resources/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [expect.objectContaining({ actionKey: "resource_resolution.shift_work" })],
      actionExecutions: [
        expect.objectContaining({
          commandType: "resource_resolution.shift_work",
          source: { entityType: "resourceOverload", entityId: tenantAOverloadId }
        })
      ]
    });
  });

  it("denies read-only apply while allowing read, and hides tenant-private resource data", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyLoad = await app.request("/api/resources/load?testUser=readonly-observer-a");
    expect(readOnlyLoad.status).toBe(200);

    const readOnlyPreview = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/preview?testUser=readonly-observer-a`,
      jsonRequest({ actionKey: "accept_risk", reason: "Наблюдатель не должен применять риск" })
    );
    expect(readOnlyPreview.status).toBe(403);

    const readOnlyApply = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/apply?testUser=readonly-observer-a`,
      jsonRequest({ previewId: "preview-any" })
    );
    expect(readOnlyApply.status).toBe(403);

    const tenantBReadTenantA = await app.request(`/api/resources/load/${tenantALoadBucketId}?testUser=tenant-admin-b`);
    expect(tenantBReadTenantA.status).toBe(404);
    const tenantBReadText = await tenantBReadTenantA.text();
    expect(tenantBReadText).not.toContain("resource-architect-a");

    const tenantBMutateTenantA = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/preview?testUser=tenant-admin-b`,
      jsonRequest({ actionKey: "accept_risk", reason: "Tenant B cannot see Tenant A overload" })
    );
    expect(tenantBMutateTenantA.status).toBe(404);
  });

  it("rejects reserve-capacity as an overload resolution because it would add demand instead of resolving load", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const preview = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/preview?testUser=resource-manager-a`,
      jsonRequest({
        actionKey: "reserve_capacity",
        reservedHours: 2,
        reason: "Зафиксировать дополнительный резерв перед решением комитета"
      })
    );
    expect(preview.status).toBe(409);
    await expect(readJson(preview)).resolves.toMatchObject({
      code: "precondition_failed"
    });

    const unchanged = await app.request(`/api/resources/load/${tenantALoadBucketId}?testUser=resource-manager-a`);
    expect(unchanged.status).toBe(200);
    await expect(readJson(unchanged)).resolves.toMatchObject({
      bucket: { id: tenantALoadBucketId, reservedHours: 8, totalLoadHours: 50 }
    });

    const audit = await app.request("/api/resources/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [],
      actionExecutions: []
    });
  });

  it("rejects stale previews and invalid resolution preconditions without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const invalidPreview = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/preview?testUser=resource-manager-a`,
      jsonRequest({
        actionKey: "reassign_resource",
        assignmentId: "assignment-design-architect-a",
        targetResourceProfileId: "resource-architect-a",
        reason: "Same resource is not a valid reassignment"
      })
    );
    expect(invalidPreview.status).toBe(409);
    await expect(readJson(invalidPreview)).resolves.toMatchObject({
      code: "precondition_failed"
    });

    const createReservation = await app.request(
      "/api/resources/reservations?testUser=resource-manager-a",
      jsonRequest({
        id: "reservation-extra-architect-a",
        sourceType: "project",
        sourceId: "project-alpha-a",
        resourceProfileId: "resource-architect-a",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        reservedHours: 1,
        sourceLabel: "Дополнительный резерв"
      })
    );
    expect(createReservation.status).toBe(201);

    const preview = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/preview?testUser=resource-manager-a`,
      jsonRequest({
        actionKey: "shift_work",
        assignmentId: "assignment-design-architect-a",
        shiftDays: 7,
        reason: "Preview before another mutation"
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const secondReservation = await app.request(
      "/api/resources/reservations?testUser=resource-manager-a",
      jsonRequest({
        id: "reservation-stale-preview-a",
        sourceType: "project",
        sourceId: "project-alpha-a",
        resourceProfileId: "resource-architect-a",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        reservedHours: 1,
        sourceLabel: "Изменение после preview"
      })
    );
    expect(secondReservation.status).toBe(201);

    const staleApply = await app.request(
      `/api/resources/overloads/${tenantAOverloadId}/apply?testUser=resource-manager-a`,
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(staleApply.status).toBe(409);
    await expect(readJson(staleApply)).resolves.toMatchObject({
      code: "stale_preview"
    });

    const after = await app.request(`/api/resources/load/${tenantALoadBucketId}?testUser=resource-manager-a`);
    expect(after.status).toBe(200);
    await expect(readJson(after)).resolves.toMatchObject({
      bucket: { id: tenantALoadBucketId, assignedHours: 42, reservedHours: 10, totalLoadHours: 52 }
    });
  });

  it("keeps reservation source type contract aligned with the resource domain model", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const manualReservation = await app.request(
      "/api/resources/reservations?testUser=resource-manager-a",
      jsonRequest({
        id: "reservation-manual-source-a",
        sourceType: "manual",
        sourceId: "manual-note",
        resourceProfileId: "resource-architect-a",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        reservedHours: 1,
        sourceLabel: "Manual source should be rejected by API contract"
      })
    );
    expect(manualReservation.status).toBe(400);

    const stageReservation = await app.request(
      "/api/resources/reservations?testUser=resource-manager-a",
      jsonRequest({
        id: "reservation-stage-source-a",
        sourceType: "stage",
        sourceId: "project-alpha-a:stage-initiation",
        resourceProfileId: "resource-architect-a",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-05",
        reservedHours: 1,
        sourceLabel: "Stage source matches domain reservation contract"
      })
    );
    expect(stageReservation.status).toBe(201);
    await expect(readJson(stageReservation)).resolves.toMatchObject({
      reservation: {
        id: "reservation-stage-source-a",
        sourceType: "stage",
        status: "active"
      },
      readback: {
        loadBuckets: expect.arrayContaining([
          expect.objectContaining({ id: tenantALoadBucketId, reservedHours: 9, totalLoadHours: 51 })
        ])
      }
    });
  });
});
