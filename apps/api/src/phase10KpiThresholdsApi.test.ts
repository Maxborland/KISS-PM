import { describe, expect, it } from "vitest";

import { createApiApp } from "./app";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

const thresholdRules = [
  {
    id: "schedule-variance-critical",
    severity: "critical",
    condition: { operator: "lte", value: -30 },
    explanation: "Критическое отклонение после настройки P10",
    recommendedActionKeys: ["create_corrective_action", "escalate"]
  },
  {
    id: "schedule-variance-warning",
    severity: "warning",
    condition: { operator: "lte", value: -10 },
    explanation: "Предупреждение после настройки P10",
    recommendedActionKeys: ["request_explanation"]
  }
] as const;

describe("Phase 10 KPI threshold builder API", () => {
  it("previews and publishes future KPI threshold impact while preserving historical evaluations", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const initial = await app.request("/api/tenant/kpi-thresholds?testUser=tenant-admin-a");
    expect(initial.status).toBe(200);
    await expect(readJson(initial)).resolves.toMatchObject({
      thresholds: [
        expect.objectContaining({
          definitionId: "kpi-schedule-variance-a",
          thresholdRuleSet: expect.objectContaining({ version: 1 })
        })
      ],
      latestEvaluation: expect.objectContaining({
        thresholdRuleSetVersion: 1
      })
    });

    const preview = await app.request(
      "/api/tenant/kpi-thresholds/preview?testUser=tenant-admin-a",
      jsonRequest({
        definitionId: "kpi-schedule-variance-a",
        expectedVersion: 1,
        rules: thresholdRules,
        sampleValue: -25,
        affectedRuntimeSurfaces: ["kpi.deviation.control"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      before: { version: 1, severity: "critical" },
      after: { version: 2, severity: "warning" }
    });

    const unchanged = await app.request("/api/tenant/kpi-thresholds?testUser=tenant-admin-a");
    await expect(readJson(unchanged)).resolves.toMatchObject({
      thresholds: [expect.objectContaining({ thresholdRuleSet: expect.objectContaining({ version: 1 }) })],
      latestEvaluation: expect.objectContaining({ thresholdRuleSetVersion: 1 })
    });

    const publish = await app.request(
      "/api/tenant/kpi-thresholds/publish?testUser=tenant-admin-a",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(publish.status).toBe(200);
    await expect(readJson(publish)).resolves.toMatchObject({
      result: {
        audit: {
          commandType: "kpi_threshold.publish",
          beforeVersion: 1,
          afterVersion: 2
        },
        actionExecution: {
          commandType: "kpi_threshold.publish",
          requiredPermission: "kpi.config:write"
        }
      },
      readback: {
        thresholdRuleSet: expect.objectContaining({ version: 2 })
      }
    });

    const futureRun = await app.request(
      "/api/kpi/evaluations/run?testUser=project-manager-a",
      jsonRequest({
        definitionId: "kpi-schedule-variance-a",
        entity: { type: "project", id: "project-alpha-a" },
        period: { start: "2026-06-08", end: "2026-06-14" }
      })
    );
    expect(futureRun.status).toBe(200);
    await expect(readJson(futureRun)).resolves.toMatchObject({
      evaluation: {
        severity: "warning",
        thresholdRuleSetVersion: 2,
        matchedThresholdRuleId: "schedule-variance-warning"
      }
    });

    const historical = await app.request("/api/kpi/evaluations/eval-kpi-schedule-variance-a-1?testUser=tenant-admin-a");
    expect(historical.status).toBe(200);
    await expect(readJson(historical)).resolves.toMatchObject({
      evaluation: {
        severity: "critical",
        thresholdRuleSetVersion: 1,
        matchedThresholdRuleId: "schedule-variance-critical"
      }
    });

    const audit = await app.request("/api/tenant/configuration/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "kpi_threshold.publish" })]),
      actionExecutions: expect.arrayContaining([expect.objectContaining({ commandType: "kpi_threshold.publish" })])
    });
  });

  it("denies read-only and Tenant B commands without leaking or mutating threshold state", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyPreview = await app.request(
      "/api/tenant/kpi-thresholds/preview?testUser=readonly-observer-a",
      jsonRequest({
        definitionId: "kpi-schedule-variance-a",
        expectedVersion: 1,
        rules: thresholdRules,
        sampleValue: -25,
        affectedRuntimeSurfaces: ["kpi.deviation.control"]
      })
    );
    expect(readOnlyPreview.status).toBe(403);

    const preview = await app.request(
      "/api/tenant/kpi-thresholds/preview?testUser=tenant-admin-a",
      jsonRequest({
        definitionId: "kpi-schedule-variance-a",
        expectedVersion: 1,
        rules: thresholdRules,
        sampleValue: -25,
        affectedRuntimeSurfaces: ["kpi.deviation.control"]
      })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const tenantBPublish = await app.request(
      "/api/tenant/kpi-thresholds/publish?testUser=tenant-admin-b",
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(tenantBPublish.status).toBe(409);
    expect(await tenantBPublish.text()).not.toContain(previewBody.preview.id);

    const invalidPreview = await app.request(
      "/api/tenant/kpi-thresholds/preview?testUser=tenant-admin-a",
      jsonRequest({
        definitionId: "kpi-schedule-variance-a",
        expectedVersion: 1,
        rules: [
          {
            id: "bad-range",
            severity: "warning",
            condition: { operator: "between", min: 10, max: -10 },
            explanation: "Неверный диапазон",
            recommendedActionKeys: ["request_explanation"]
          }
        ],
        sampleValue: -25,
        affectedRuntimeSurfaces: ["kpi.deviation.control"]
      })
    );
    expect(invalidPreview.status).toBe(400);

    const readback = await app.request("/api/tenant/kpi-thresholds?testUser=tenant-admin-a");
    await expect(readJson(readback)).resolves.toMatchObject({
      thresholds: [expect.objectContaining({ thresholdRuleSet: expect.objectContaining({ version: 1 }) })]
    });
  });
});
