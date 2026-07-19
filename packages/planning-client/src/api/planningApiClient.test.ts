import { describe, expect, it, vi } from "vitest";

import { createPlanningApiClient, PlanningApiError } from "./planningApiClient";

describe("planning API client batch preview", () => {
  it("posts the complete batch to preview-command-batch without applying it", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({
          before: {},
          after: {},
          planDelta: {
            changedTaskIds: ["task-1"],
            changedAssignmentIds: [],
            changedDependencyIds: []
          },
          validationIssues: []
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const client = createPlanningApiClient({
      apiOrigin: "https://kiss-pm.test",
      fetchImpl: fetchImpl as typeof fetch
    });
    const input = {
      clientPlanVersion: 7,
      commands: [
        {
          type: "task.update_progress" as const,
          payload: { taskId: "task-1", percentComplete: 50 }
        }
      ]
    };

    await client.previewCommandBatch("project/alpha", input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = calls[0]!;
    expect(url).toBe(
      "https://kiss-pm.test/api/workspace/projects/project%2Falpha/planning/preview-command-batch"
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });
});

describe("planning API client auto-solver", () => {
  const runPayload = {
    runId: "planning-auto-solver-1",
    mode: "schedule",
    clientPlanVersion: 7,
    engineVersion: "planning-core-v1",
    targetDeadline: null,
    proposalPayloadHash: "hash-1",
    expiresAt: "2026-07-19T12:00:00.000Z",
    appliedProposalId: null,
    proposals: []
  };

  it("creates a persisted solver run via POST auto-solver-runs", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response(JSON.stringify(runPayload), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const client = createPlanningApiClient({
      apiOrigin: "https://kiss-pm.test",
      fetchImpl: fetchImpl as typeof fetch
    });

    const run = await client.createAutoSolverRun("project/alpha", {
      mode: "schedule",
      clientPlanVersion: 7,
      targetDeadline: null
    });

    const [url, init] = calls[0]!;
    expect(url).toBe(
      "https://kiss-pm.test/api/workspace/projects/project%2Falpha/planning/auto-solver-runs"
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      mode: "schedule",
      clientPlanVersion: 7,
      targetDeadline: null
    });
    expect(run.runId).toBe("planning-auto-solver-1");
    expect(run.expiresAt).toBe("2026-07-19T12:00:00.000Z");
  });

  it("applies a proposal via POST .../proposals/:proposalId/apply with plan-version guard payload", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({
          applied: { changedTaskIds: ["task-1"], changedAssignmentIds: [], changedDependencyIds: [] },
          newPlanVersion: 8,
          auditEventId: "audit-8",
          readModel: {}
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const client = createPlanningApiClient({
      apiOrigin: "https://kiss-pm.test",
      fetchImpl: fetchImpl as typeof fetch
    });

    const res = await client.applyAutoSolverProposal("project-1", "run/1", "proposal-1", {
      clientPlanVersion: 7,
      acceptedRiskReason: "согласовано с РП"
    });

    const [url, init] = calls[0]!;
    expect(url).toBe(
      "https://kiss-pm.test/api/workspace/projects/project-1/planning/auto-solver-runs/run%2F1/proposals/proposal-1/apply"
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      clientPlanVersion: 7,
      acceptedRiskReason: "согласовано с РП"
    });
    expect(res.newPlanVersion).toBe(8);
    expect(res.auditEventId).toBe("audit-8");
  });

  it("surfaces 409 guard codes (already applied / expired) as typed PlanningApiError", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "planning_solver_run_already_applied" }), {
        status: 409,
        headers: { "content-type": "application/json" }
      })
    );
    const client = createPlanningApiClient({
      apiOrigin: "https://kiss-pm.test",
      fetchImpl: fetchImpl as typeof fetch
    });

    await expect(
      client.applyAutoSolverProposal("project-1", "run-1", "proposal-1", { clientPlanVersion: 7 })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(PlanningApiError);
      const apiError = error as PlanningApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.code).toBe("planning_solver_run_already_applied");
      return true;
    });
  });

  it("reads a persisted run via GET auto-solver-runs/:runId", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({ ...runPayload, inputSnapshotMetadata: {}, appliedAt: null }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const client = createPlanningApiClient({
      apiOrigin: "https://kiss-pm.test",
      fetchImpl: fetchImpl as typeof fetch
    });

    const run = await client.getAutoSolverRun("project-1", "planning-auto-solver-1");

    const [url, init] = calls[0]!;
    expect(url).toBe(
      "https://kiss-pm.test/api/workspace/projects/project-1/planning/auto-solver-runs/planning-auto-solver-1"
    );
    expect(init?.method).toBeUndefined();
    expect(run.appliedAt).toBeNull();
  });
});
