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

const tenantADefinitionId = "kpi-schedule-variance-a";
const tenantAEvaluationId = "eval-kpi-schedule-variance-a-1";
const tenantASignalId = "signal-kpi-schedule-variance-a";

const draftDefinitionPayload = {
  id: "kpi-api-draft-a",
  systemKey: "api_draft_variance",
  label: "Отклонение API",
  entityType: "project",
  ownerRoleKey: "project_manager",
  unit: "percent",
  evaluationCadence: "weekly",
  formula: {
    id: "formula-api-draft-a",
    expression: "((plannedWorkHours - actualWorkHours) / plannedWorkHours) * 100",
    sourceBindings: [
      {
        key: "plannedWorkHours",
        label: "Плановые часы",
        sourceType: "schedule",
        sourceField: "plannedWorkHours",
        valueType: "number"
      },
      {
        key: "actualWorkHours",
        label: "Фактические часы",
        sourceType: "worklog",
        sourceField: "actualWorkHours",
        valueType: "number"
      }
    ]
  },
  thresholdRuleSet: {
    id: "threshold-api-draft-a",
    rules: [
      {
        id: "api-draft-critical",
        severity: "critical",
        condition: { operator: "lte", value: -25 },
        explanation: "Отклонение API критическое",
        recommendedActionKeys: ["create_corrective_action"]
      }
    ]
  }
};

describe("Phase 7 KPI API and governed commands", () => {
  it("returns deterministic KPI definitions, deviations, and tenant-scoped read models", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const definitions = await app.request("/api/kpi/definitions?testUser=tenant-admin-a");
    expect(definitions.status).toBe(200);
    await expect(readJson(definitions)).resolves.toMatchObject({
      definitions: [
        expect.objectContaining({
          id: tenantADefinitionId,
          tenantId: "tenant-a",
          active: true,
          formula: expect.objectContaining({ expression: expect.stringContaining("plannedWorkHours") }),
          thresholdRuleSet: expect.objectContaining({
            rules: expect.arrayContaining([expect.objectContaining({ severity: "critical" })])
          })
        })
      ]
    });

    const detail = await app.request(`/api/kpi/definitions/${tenantADefinitionId}?testUser=tenant-admin-a`);
    expect(detail.status).toBe(200);
    await expect(readJson(detail)).resolves.toMatchObject({
      definition: { id: tenantADefinitionId, version: 1 },
      formula: { id: "formula-schedule-variance-a-v1", version: 1 },
      thresholdRuleSet: { id: "threshold-schedule-variance-a-v1", version: 1 }
    });

    const tenantBReadTenantA = await app.request(`/api/kpi/definitions/${tenantADefinitionId}?testUser=tenant-admin-b`);
    expect(tenantBReadTenantA.status).toBe(404);
    expect(await tenantBReadTenantA.text()).not.toContain("schedule-variance-a");

    const deviations = await app.request("/api/kpi/deviations?testUser=project-manager-a");
    expect(deviations.status).toBe(200);
    await expect(readJson(deviations)).resolves.toMatchObject({
      signals: expect.arrayContaining([
        expect.objectContaining({
          id: tenantASignalId,
          severity: "critical",
          sourceEvaluationId: tenantAEvaluationId,
          recommendedActionKeys: expect.arrayContaining(["create_corrective_action"])
        }),
        expect.objectContaining({
          id: "signal-kpi-schedule-variance-a-warning",
          severity: "warning",
          sourceEvaluationId: "eval-kpi-schedule-variance-a-warning-1",
          recommendedActionKeys: expect.arrayContaining(["request_explanation"])
        })
      ])
    });
  });

  it("previews KPI definition config without mutation, then creates and publishes with audit evidence", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const preview = await app.request(
      "/api/kpi/definitions/preview?testUser=tenant-admin-a",
      jsonRequest({
        ...draftDefinitionPayload,
        sampleValues: { plannedWorkHours: 80, actualWorkHours: 100 }
      })
    );
    expect(preview.status).toBe(200);
    await expect(readJson(preview)).resolves.toMatchObject({
      preview: {
        mutatesState: false,
        value: -25,
        severity: "critical",
        formulaTrace: expect.arrayContaining(["result:-25"])
      }
    });

    const auditAfterPreview = await app.request("/api/kpi/audit?testUser=tenant-admin-a");
    expect(auditAfterPreview.status).toBe(200);
    await expect(readJson(auditAfterPreview)).resolves.toMatchObject({
      events: [],
      actionExecutions: []
    });

    const create = await app.request("/api/kpi/definitions?testUser=tenant-admin-a", jsonRequest(draftDefinitionPayload));
    expect(create.status).toBe(201);
    await expect(readJson(create)).resolves.toMatchObject({
      definition: { id: "kpi-api-draft-a", active: false, version: 1 },
      readback: {
        definitions: expect.arrayContaining([expect.objectContaining({ id: "kpi-api-draft-a", active: false })])
      }
    });

    const publish = await app.request(
      "/api/kpi/definitions/kpi-api-draft-a/publish?testUser=tenant-admin-a",
      jsonRequest({ expectedVersion: 1 })
    );
    expect(publish.status).toBe(200);
    await expect(readJson(publish)).resolves.toMatchObject({
      result: {
        actionExecution: {
          commandType: "kpi.definition.publish",
          requiredPermission: "kpi.config:write",
          status: "succeeded",
          target: { entityType: "kpiDefinition", entityId: "kpi-api-draft-a" }
        }
      },
      readback: {
        definition: { id: "kpi-api-draft-a", active: true, version: 1 }
      }
    });

    const audit = await app.request("/api/kpi/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: expect.arrayContaining([expect.objectContaining({ actionKey: "kpi.definition.publish" })]),
      actionExecutions: expect.arrayContaining([
        expect.objectContaining({ commandType: "kpi.definition.publish", status: "succeeded" })
      ])
    });
  });

  it("runs KPI evaluation through governed command, creates deviation, and preserves API readback", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const run = await app.request(
      "/api/kpi/evaluations/run?testUser=project-manager-a",
      jsonRequest({
        definitionId: tenantADefinitionId,
        entity: { type: "project", id: "project-alpha-a" },
        period: { start: "2026-06-01", end: "2026-06-07" }
      })
    );
    expect(run.status).toBe(200);
    const runBody = (await readJson(run)) as {
      evaluation: { id: string; value: number; severity: string };
      signal: { id: string; sourceEvaluationId: string; severity: string };
      actionExecution: { commandType: string; requiredPermission: string; status: string };
    };
    expect(runBody).toMatchObject({
      evaluation: { value: -25, severity: "critical" },
      signal: { severity: "critical" },
      actionExecution: {
        commandType: "kpi.evaluation.run",
        requiredPermission: "kpi.evaluate:execute",
        status: "succeeded"
      }
    });

    const evaluationReadback = await app.request(`/api/kpi/evaluations/${runBody.evaluation.id}?testUser=project-manager-a`);
    expect(evaluationReadback.status).toBe(200);
    await expect(readJson(evaluationReadback)).resolves.toMatchObject({
      evaluation: {
        id: runBody.evaluation.id,
        formulaTrace: expect.arrayContaining(["result:-25"]),
        thresholdTrace: expect.arrayContaining(["matched:schedule-variance-critical:critical"])
      }
    });

    const deviationReadback = await app.request(`/api/kpi/deviations/${runBody.signal.id}?testUser=project-manager-a`);
    expect(deviationReadback.status).toBe(200);
    await expect(readJson(deviationReadback)).resolves.toMatchObject({
      signal: {
        id: runBody.signal.id,
        sourceEvaluationId: runBody.evaluation.id,
        actionExecutionState: "not_executed"
      },
      evaluation: { id: runBody.evaluation.id, severity: "critical" }
    });
  });

  it("denies read-only mutations and out-of-tenant reads or commands without partial mutation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const readOnlyDefinitions = await app.request("/api/kpi/definitions?testUser=readonly-observer-a");
    expect(readOnlyDefinitions.status).toBe(200);

    const readOnlyCreate = await app.request(
      "/api/kpi/definitions?testUser=readonly-observer-a",
      jsonRequest(draftDefinitionPayload)
    );
    expect(readOnlyCreate.status).toBe(403);

    const readOnlyRun = await app.request(
      "/api/kpi/evaluations/run?testUser=readonly-observer-a",
      jsonRequest({
        definitionId: tenantADefinitionId,
        entity: { type: "project", id: "project-alpha-a" },
        period: { start: "2026-06-01", end: "2026-06-07" }
      })
    );
    expect(readOnlyRun.status).toBe(403);

    const tenantBRunTenantA = await app.request(
      "/api/kpi/evaluations/run?testUser=tenant-admin-b",
      jsonRequest({
        definitionId: tenantADefinitionId,
        entity: { type: "project", id: "project-alpha-a" },
        period: { start: "2026-06-01", end: "2026-06-07" }
      })
    );
    expect(tenantBRunTenantA.status).toBe(404);
    expect(await tenantBRunTenantA.text()).not.toContain("project-alpha-a");

    const mismatchedSourceEntity = await app.request(
      "/api/kpi/evaluations/run?testUser=project-manager-a",
      jsonRequest({
        definitionId: tenantADefinitionId,
        entity: { type: "project", id: "project-alpha-a" },
        period: { start: "2026-06-01", end: "2026-06-07" },
        sourceValues: [
          {
            tenantId: "tenant-a",
            bindingKey: "plannedWorkHours",
            value: 80,
            sourceEntityType: "project",
            sourceEntityId: "project-shadow-a",
            sourceField: "plannedWorkHours",
            observedAt: "2026-06-08T08:00:00.000Z"
          },
          {
            tenantId: "tenant-a",
            bindingKey: "actualWorkHours",
            value: 100,
            sourceEntityType: "project",
            sourceEntityId: "project-shadow-a",
            sourceField: "actualWorkHours",
            observedAt: "2026-06-08T08:00:00.000Z"
          }
        ]
      })
    );
    expect(mismatchedSourceEntity.status).toBe(409);

    const malformedPreview = await app.request(
      "/api/kpi/definitions/preview?testUser=tenant-admin-a",
      jsonRequest({
        ...draftDefinitionPayload,
        formula: { ...draftDefinitionPayload.formula, expression: "globalThis.process.exit(1)" },
        sampleValues: { plannedWorkHours: 80, actualWorkHours: 100 }
      })
    );
    expect(malformedPreview.status).toBe(400);

    const definitionsAfterDeniedAndInvalid = await app.request("/api/kpi/definitions?testUser=tenant-admin-a");
    expect(definitionsAfterDeniedAndInvalid.status).toBe(200);
    await expect(readJson(definitionsAfterDeniedAndInvalid)).resolves.toMatchObject({
      definitions: expect.not.arrayContaining([expect.objectContaining({ id: "kpi-api-draft-a" })])
    });

    const audit = await app.request("/api/kpi/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [],
      actionExecutions: []
    });
  });

  it("rejects version conflicts and retires published definitions through governed command", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });

    const create = await app.request("/api/kpi/definitions?testUser=tenant-admin-a", jsonRequest(draftDefinitionPayload));
    expect(create.status).toBe(201);

    const conflict = await app.request(
      "/api/kpi/definitions/kpi-api-draft-a/publish?testUser=tenant-admin-a",
      jsonRequest({ expectedVersion: 99 })
    );
    expect(conflict.status).toBe(409);
    await expect(readJson(conflict)).resolves.toMatchObject({ code: "conflict" });

    const publish = await app.request(
      "/api/kpi/definitions/kpi-api-draft-a/publish?testUser=tenant-admin-a",
      jsonRequest({ expectedVersion: 1 })
    );
    expect(publish.status).toBe(200);

    const retire = await app.request(
      "/api/kpi/definitions/kpi-api-draft-a/retire?testUser=tenant-admin-a",
      jsonRequest({ expectedVersion: 1, reason: "Заменено новой метрикой" })
    );
    expect(retire.status).toBe(200);
    await expect(readJson(retire)).resolves.toMatchObject({
      result: {
        actionExecution: {
          commandType: "kpi.definition.retire",
          requiredPermission: "kpi.config:write",
          status: "succeeded"
        }
      },
      readback: { definition: { id: "kpi-api-draft-a", active: false } }
    });
  });
});
