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

async function createClosableProject(app: ReturnType<typeof createApiApp>, projectId = "project-phase9-close-a") {
  const draft = await app.request(
    "/api/crm/opportunities/opportunity-seed-ready/project-draft?testUser=project-manager-a",
    jsonRequest({})
  );
  expect(draft.status).toBe(201);
  const draftBody = (await readJson(draft)) as { projectDraft: { id: string } };

  const created = await app.request(
    "/api/projects/from-template?testUser=project-manager-a",
    jsonRequest({ projectDraftId: draftBody.projectDraft.id, projectId })
  );
  expect(created.status).toBe(201);
  const project = (await readJson(created)) as { project: { currentStageId: string } };
  const initiationStageId = project.project.currentStageId;

  const artifact = await app.request(
    `/api/projects/${projectId}/stages/${initiationStageId}/artifacts?testUser=project-manager-a`,
    jsonRequest({
      templateId: "artifact-charter",
      templateKey: "project_charter",
      status: "accepted",
      evidenceRef: "closure-api-charter"
    })
  );
  expect(artifact.status).toBe(201);

  const approval = await app.request(
    `/api/projects/${projectId}/stages/${initiationStageId}/approvals?testUser=project-manager-a`,
    jsonRequest({
      templateId: "approval-charter",
      templateKey: "charter_approval",
      decision: "approved"
    })
  );
  expect(approval.status).toBe(201);

  const advanced = await app.request(
    `/api/projects/${projectId}/stages/${initiationStageId}/transition?testUser=project-manager-a`,
    jsonRequest({ transition: "advance_stage" })
  );
  expect(advanced.status).toBe(200);
  const advancedBody = (await readJson(advanced)) as { project: { currentStageId: string } };

  const task = await app.request(
    `/api/projects/${projectId}/tasks?testUser=project-manager-a`,
    jsonRequest({
      id: `${projectId}:delivery-task`,
      stageId: advancedBody.project.currentStageId,
      taskTemplateId: "task-template-delivery",
      taskTemplateKey: "delivery_work",
      dueDate: "2026-06-30",
      plannedWorkHours: 20
    })
  );
  expect(task.status).toBe(201);

  const done = await app.request(
    `/api/tasks/${projectId}:delivery-task/status?testUser=project-manager-a`,
    jsonRequest({ toStatus: "done" }, "PATCH")
  );
  expect(done.status).toBe(200);

  return projectId;
}

const completeClosureData = {
  finalKpiSummary: "Проект закрыт в рамках допустимых KPI.",
  qualityScore: 5,
  clientSatisfactionScore: 4,
  closingSummary: "Поставка завершена, документы и уроки зафиксированы.",
  lessonsLearned: [
    {
      id: "lesson-phase9-api",
      categoryKey: "process",
      summary: "Раннее согласование приемки снизило риск задержки.",
      recommendation: "Добавить чек приемки в будущий шаблон.",
      severity: "attention"
    }
  ]
};

describe("Phase 9 closure and snapshot API", () => {
  it("previews and applies project closure with audit evidence, readback, and immutable snapshot", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createClosableProject(app);

    const closure = await app.request(`/api/projects/${projectId}/closure?testUser=project-manager-a`);
    expect(closure.status).toBe(200);
    await expect(readJson(closure)).resolves.toMatchObject({
      project: { id: projectId, lifecycleStatus: "active" },
      readiness: { ok: false },
      checklist: {
        requirements: expect.arrayContaining([
          expect.objectContaining({ field: "final_kpi_summary", required: true }),
          expect.objectContaining({ field: "lessons_learned", required: true })
        ])
      }
    });

    const preview = await app.request(
      `/api/projects/${projectId}/closure/preview?testUser=project-manager-a`,
      jsonRequest({ closureData: completeClosureData })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as {
      preview: { id: string; mutatesState: boolean; snapshotSummary: { projectId: string; plannedWorkHours: number } };
    };
    expect(previewBody.preview).toMatchObject({
      mutatesState: false,
      snapshotSummary: { projectId, plannedWorkHours: 20 }
    });

    const unchangedAfterPreview = await app.request(`/api/projects/${projectId}/closure?testUser=project-manager-a`);
    expect(unchangedAfterPreview.status).toBe(200);
    await expect(readJson(unchangedAfterPreview)).resolves.toMatchObject({
      project: { lifecycleStatus: "active" },
      snapshots: []
    });

    const apply = await app.request(
      `/api/projects/${projectId}/closure/apply?testUser=project-manager-a`,
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(apply.status).toBe(200);
    const applyBody = (await readJson(apply)) as {
      result: { snapshotId: string; actionExecution: { id: string; commandType: string; auditEventIds: string[] } };
    };
    expect(applyBody.result).toMatchObject({
      snapshotId: expect.stringContaining(projectId),
      actionExecution: {
        commandType: "project.closure.apply",
        auditEventIds: [expect.stringContaining("audit-")]
      }
    });

    const readback = await app.request(`/api/projects/${projectId}/closure?testUser=project-manager-a`);
    expect(readback.status).toBe(200);
    await expect(readJson(readback)).resolves.toMatchObject({
      project: { lifecycleStatus: "completed", currentStageId: null },
      latestSnapshot: { id: applyBody.result.snapshotId, metrics: { plannedWorkHours: 20 } }
    });

    const snapshot = await app.request(`/api/retrospectives/snapshots/${applyBody.result.snapshotId}?testUser=project-manager-a`);
    expect(snapshot.status).toBe(200);
    await expect(readJson(snapshot)).resolves.toMatchObject({
      snapshot: {
        id: applyBody.result.snapshotId,
        projectId,
        project: { lifecycleStatus: "completed" },
        closure: { finalKpiSummary: completeClosureData.finalKpiSummary }
      }
    });

    const mutateSnapshot = await app.request(
      `/api/retrospectives/snapshots/${applyBody.result.snapshotId}?testUser=project-manager-a`,
      jsonRequest({ project: { title: "mutated" } }, "PATCH")
    );
    expect(mutateSnapshot.status).toBe(405);

    const audit = await app.request("/api/retrospectives/audit?testUser=tenant-admin-a");
    expect(audit.status).toBe(200);
    await expect(readJson(audit)).resolves.toMatchObject({
      events: [expect.objectContaining({ actionKey: "project.closure.apply" })],
      actionExecutions: [
        expect.objectContaining({
          id: applyBody.result.actionExecution.id,
          commandType: "project.closure.apply",
          target: { entityType: "closedProjectSnapshot", entityId: applyBody.result.snapshotId }
        })
      ]
    });
  });

  it("requires preview before apply and denies read-only or cross-tenant mutation without partial closure", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createClosableProject(app, "project-phase9-permissions-a");

    const readOnlyClosure = await app.request(`/api/projects/${projectId}/closure?testUser=readonly-observer-a`);
    expect(readOnlyClosure.status).toBe(200);

    const readOnlyPreview = await app.request(
      `/api/projects/${projectId}/closure/preview?testUser=readonly-observer-a`,
      jsonRequest({ closureData: completeClosureData })
    );
    expect(readOnlyPreview.status).toBe(403);

    const directApply = await app.request(
      `/api/projects/${projectId}/closure/apply?testUser=project-manager-a`,
      jsonRequest({ closureData: completeClosureData })
    );
    expect(directApply.status).toBe(409);
    await expect(readJson(directApply)).resolves.toMatchObject({ code: "dry_run_required" });

    const tenantBRead = await app.request(`/api/projects/${projectId}/closure?testUser=tenant-admin-b`);
    expect(tenantBRead.status).toBe(404);
    const tenantBText = await tenantBRead.text();
    expect(tenantBText).not.toContain(projectId);

    const tenantBPreview = await app.request(
      `/api/projects/${projectId}/closure/preview?testUser=tenant-admin-b`,
      jsonRequest({ closureData: completeClosureData })
    );
    expect(tenantBPreview.status).toBe(404);

    const afterDenied = await app.request(`/api/projects/${projectId}/closure?testUser=project-manager-a`);
    expect(afterDenied.status).toBe(200);
    await expect(readJson(afterDenied)).resolves.toMatchObject({
      project: { lifecycleStatus: "active" },
      snapshots: []
    });

    const auditAfterDenied = await app.request("/api/retrospectives/audit?testUser=tenant-admin-a");
    expect(auditAfterDenied.status).toBe(200);
    await expect(readJson(auditAfterDenied)).resolves.toMatchObject({
      events: [],
      actionExecutions: []
    });
  });

  it("rejects stale previews and missing closure requirements without partial snapshot creation", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const projectId = await createClosableProject(app, "project-phase9-stale-a");

    const missingPreview = await app.request(
      `/api/projects/${projectId}/closure/preview?testUser=project-manager-a`,
      jsonRequest({ closureData: { lessonsLearned: [] } })
    );
    expect(missingPreview.status).toBe(409);
    await expect(readJson(missingPreview)).resolves.toMatchObject({
      code: "precondition_failed",
      blockers: expect.arrayContaining([expect.objectContaining({ code: "missing_closure_requirement" })])
    });

    const preview = await app.request(
      `/api/projects/${projectId}/closure/preview?testUser=project-manager-a`,
      jsonRequest({ closureData: completeClosureData })
    );
    expect(preview.status).toBe(200);
    const previewBody = (await readJson(preview)) as { preview: { id: string } };

    const schedulePatch = await app.request(
      `/api/projects/${projectId}/schedule/tasks/${projectId}:delivery-task?testUser=project-manager-a`,
      jsonRequest(
        {
          plannedStartDate: "2026-06-01",
          plannedFinishDate: "2026-06-30",
          plannedWorkHours: 25,
          progressPercent: 100
        },
        "PATCH"
      )
    );
    expect(schedulePatch.status).toBe(200);

    const stillClosablePreview = await app.request(
      `/api/projects/${projectId}/closure/preview?testUser=project-manager-a`,
      jsonRequest({
        closureData: completeClosureData
      })
    );
    expect(stillClosablePreview.status).toBe(200);

    const staleApply = await app.request(
      `/api/projects/${projectId}/closure/apply?testUser=project-manager-a`,
      jsonRequest({ previewId: previewBody.preview.id })
    );
    expect(staleApply.status).toBe(409);
    await expect(readJson(staleApply)).resolves.toMatchObject({ code: "stale_preview" });

    const snapshots = await app.request("/api/retrospectives/snapshots?testUser=project-manager-a");
    expect(snapshots.status).toBe(200);
    await expect(readJson(snapshots)).resolves.toMatchObject({ snapshots: [] });

    const auditAfterStale = await app.request("/api/retrospectives/audit?testUser=tenant-admin-a");
    expect(auditAfterStale.status).toBe(200);
    await expect(readJson(auditAfterStale)).resolves.toMatchObject({
      events: [],
      actionExecutions: []
    });
  });
});
