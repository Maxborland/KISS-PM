import { describe, expect, it, vi } from "vitest";

import { createPlanningApiClient } from "./planningApiClient";

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
