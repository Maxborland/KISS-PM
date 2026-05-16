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

async function createOpportunityForClosure(app: ReturnType<typeof createApiApp>, desiredFinishDate = "2026-06-30") {
  const opportunity = await app.request(
    "/api/crm/opportunities?testUser=project-manager-a",
    jsonRequest({
      title: `P9 retrospective source ${desiredFinishDate}`,
      account: {
        displayName: `P9 account ${desiredFinishDate}`
      },
      contacts: [
        {
          displayName: "P9 contact",
          email: "p9-contact@example.test"
        }
      ],
      plannedStartDate: "2026-04-01",
      desiredFinishDate,
      expectedValue: { amount: 1_500_000, currency: "RUB" },
      probability: 0.8,
      categoryKey: "implementation",
      typologyKey: "integration_heavy",
      scopeHints: [{ key: "modules_count", label: "Модули", value: 5 }]
    })
  );
  expect(opportunity.status).toBe(201);
  const opportunityBody = (await readJson(opportunity)) as { opportunity: { id: string } };

  return opportunityBody.opportunity.id;
}

async function createClosableProject(
  app: ReturnType<typeof createApiApp>,
  projectId = "project-phase9-close-a",
  opportunityId = "opportunity-seed-ready"
) {
  const draft = await app.request(
    `/api/crm/opportunities/${opportunityId}/project-draft?testUser=project-manager-a`,
    jsonRequest({})
  );
  expect([201, 409]).toContain(draft.status);
  const draftBody =
    draft.status === 201
      ? ((await readJson(draft)) as { projectDraft: { id: string } })
      : { projectDraft: { id: `project-draft-${opportunityId}` } };

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

async function closeProjectForRetrospectives(
  app: ReturnType<typeof createApiApp>,
  input: { projectId: string; desiredFinishDate?: string; lessonId: string; lessonSeverity?: "positive" | "attention" | "critical" }
) {
  const opportunityId =
    input.desiredFinishDate === undefined
      ? "opportunity-seed-ready"
      : await createOpportunityForClosure(app, input.desiredFinishDate);
  const projectId = await createClosableProject(app, input.projectId, opportunityId);
  const closureData = {
    ...completeClosureData,
    lessonsLearned: [
      {
        id: input.lessonId,
        categoryKey: "process",
        summary: "Поздний старт приемки повторяется в закрытых проектах.",
        recommendation: "Добавить раннюю приемку в будущий шаблон.",
        severity: input.lessonSeverity ?? "attention"
      }
    ]
  };

  const preview = await app.request(
    `/api/projects/${projectId}/closure/preview?testUser=project-manager-a`,
    jsonRequest({ closureData })
  );
  expect(preview.status).toBe(200);
  const previewBody = (await readJson(preview)) as { preview: { id: string } };
  const apply = await app.request(
    `/api/projects/${projectId}/closure/apply?testUser=project-manager-a`,
    jsonRequest({ previewId: previewBody.preview.id })
  );
  expect(apply.status).toBe(200);

  return (await readJson(apply)) as { result: { snapshotId: string } };
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

  it("returns closed portfolio read model with snapshot metrics, allowed actions, filters, and pagination", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    const first = await closeProjectForRetrospectives(app, {
      projectId: "project-phase9-portfolio-a",
      lessonId: "lesson-portfolio-a"
    });
    await closeProjectForRetrospectives(app, {
      projectId: "project-phase9-portfolio-b",
      lessonId: "lesson-portfolio-b"
    });

    const response = await app.request("/api/retrospectives/closed-portfolio?testUser=tenant-admin-a&limit=1&offset=0");
    expect(response.status).toBe(200);
    const body = (await readJson(response)) as {
      rows: Array<{
        entityId: string;
        fieldValues: Record<string, unknown>;
        actions: Array<{ actionDefinitionKey: string; available: boolean; mutationUrl?: string }>;
      }>;
      pagination: { offset: number; limit: number; total: number };
      summary: { totalSnapshots: number; trendSignalCount: number };
    };
    expect(body.pagination).toEqual({ offset: 0, limit: 1, total: 2 });
    expect(body.summary).toMatchObject({ totalSnapshots: 2, trendSignalCount: expect.any(Number) });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      entityId: first.result.snapshotId,
      fieldValues: {
        project_title: expect.any(String),
        planned_work_hours: 20,
        snapshot_id: first.result.snapshotId
      }
    });
    expect(body.rows[0]!.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionDefinitionKey: "template_improvement.prepare", available: true })
      ])
    );
    expect(body.rows[0]!.actions.some((action) => "mutationUrl" in action)).toBe(false);

    const readOnly = await app.request("/api/retrospectives/closed-portfolio?testUser=readonly-observer-a");
    expect(readOnly.status).toBe(200);
    const readOnlyBody = (await readJson(readOnly)) as {
      rows: Array<{ actions: Array<{ actionDefinitionKey: string; available: boolean; unavailableReason?: string; mutationUrl?: string }> }>;
    };
    expect(readOnlyBody.rows[0]!.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionDefinitionKey: "template_improvement.prepare",
          available: false,
          unavailableReason: "permission_denied"
        })
      ])
    );
    expect(readOnlyBody.rows[0]!.actions.some((action) => "mutationUrl" in action)).toBe(false);

    const invalidPagination = await app.request("/api/retrospectives/closed-portfolio?testUser=tenant-admin-a&limit=0");
    expect(invalidPagination.status).toBe(400);
    await expect(readJson(invalidPagination)).resolves.toMatchObject({ code: "validation_error" });

    const filtered = await app.request(
      "/api/retrospectives/closed-portfolio?testUser=tenant-admin-a&templateId=process-template-integrations-tenant-a"
    );
    expect(filtered.status).toBe(200);
    await expect(readJson(filtered)).resolves.toMatchObject({
      pagination: { total: 2 },
      filters: { templateId: "process-template-integrations-tenant-a" }
    });

    const emptyFiltered = await app.request(
      "/api/retrospectives/closed-portfolio?testUser=tenant-admin-a&templateId=missing-template"
    );
    expect(emptyFiltered.status).toBe(200);
    await expect(readJson(emptyFiltered)).resolves.toMatchObject({
      rows: [],
      pagination: { total: 0 },
      summary: { totalSnapshots: 0 }
    });
  });

  it("returns trend and insight readback while preserving tenant isolation and backend mutation denial", async () => {
    const app = createApiApp({ allowTestFixtureReset: true });
    await closeProjectForRetrospectives(app, {
      projectId: "project-phase9-trends-a",
      lessonId: "lesson-trend-a"
    });
    await closeProjectForRetrospectives(app, {
      projectId: "project-phase9-trends-b",
      lessonId: "lesson-trend-b"
    });

    const trends = await app.request("/api/retrospectives/trends?testUser=tenant-admin-a&groupBy=template");
    expect(trends.status).toBe(200);
    const trendsBody = (await readJson(trends)) as {
      trends: Array<{ id: string; trendKey: string; sourceSnapshotIds: string[]; sourceMetricIds: string[] }>;
      insights: Array<{ id: string; sourceTrendId: string; sourceSnapshotIds: string[]; sourceLessonIds: string[] }>;
    };
    expect(trendsBody.trends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trendKey: "schedule_delay",
          sourceSnapshotIds: expect.arrayContaining([expect.stringContaining("project-phase9-trends-a")]),
          sourceMetricIds: expect.arrayContaining([expect.stringContaining("schedule_days")])
        })
      ])
    );
    expect(trendsBody.insights).toEqual([
      expect.objectContaining({
        sourceTrendId: trendsBody.trends[0]!.id,
        sourceSnapshotIds: expect.arrayContaining([expect.stringContaining("project-phase9-trends-a")]),
        sourceLessonIds: expect.arrayContaining([expect.stringContaining("lesson-trend-a")])
      })
    ]);

    const insightId = trendsBody.insights[0]!.id;
    const insight = await app.request(`/api/retrospectives/insights/${encodeURIComponent(insightId)}?testUser=tenant-admin-a`);
    expect(insight.status).toBe(200);
    await expect(readJson(insight)).resolves.toMatchObject({
      insight: {
        id: insightId,
        status: "open",
        sourceTrendId: trendsBody.trends[0]!.id,
        sourceLessons: expect.arrayContaining([expect.objectContaining({ summary: expect.stringContaining("Поздний старт") })])
      },
      allowedActions: [
        expect.objectContaining({
          actionDefinitionKey: "template_improvement.apply",
          available: true,
          dryRunRequired: true
        })
      ]
    });

    const tenantBDenied = await app.request(`/api/retrospectives/insights/${encodeURIComponent(insightId)}?testUser=tenant-admin-b`);
    expect(tenantBDenied.status).toBe(404);
    expect(await tenantBDenied.text()).not.toContain(insightId);

    const readOnlyMutation = await app.request(
      `/api/retrospectives/insights/${encodeURIComponent(insightId)}/template-improvement/apply?testUser=readonly-observer-a`,
      jsonRequest({ previewId: "preview-p9-readonly" })
    );
    expect(readOnlyMutation.status).toBe(403);
    const stillOpen = await app.request(`/api/retrospectives/insights/${encodeURIComponent(insightId)}?testUser=tenant-admin-a`);
    expect(stillOpen.status).toBe(200);
    await expect(readJson(stillOpen)).resolves.toMatchObject({ insight: { status: "open" } });
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
