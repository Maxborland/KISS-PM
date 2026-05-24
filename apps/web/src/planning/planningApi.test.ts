import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyPlanningCommand,
  applyPlanningScenarioProposal,
  fetchPlanningReadModel,
  previewPlanningCommand,
  previewPlanningScenarioProposals
} from "./planningApi";

describe("planning API helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses encoded planning endpoints and same-origin mutation headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }));
    const commandEnvelope = {
      command: {
        type: "task.update_identity" as const,
        payload: { taskId: "task-a", title: "Новое имя" }
      },
      clientPlanVersion: 7
    };

    await fetchPlanningReadModel("project/unsafe");
    await previewPlanningCommand("project/unsafe", commandEnvelope);
    await applyPlanningCommand("project/unsafe", commandEnvelope);
    await previewPlanningScenarioProposals("project/unsafe", {
      clientPlanVersion: 7,
      target: {
        type: "resource_overload",
        resourceId: "user-alpha",
        date: "2026-06-01",
        overloadMinutes: 120,
        taskIds: ["task-a"]
      }
    });
    await applyPlanningScenarioProposal("project/unsafe", "scenario/unsafe", {
      clientPlanVersion: 7,
      acceptedRiskReason: "Согласовано ресурсным комитетом"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspace/projects/project%2Funsafe/planning/read-model",
      expect.objectContaining({ method: "GET", credentials: "same-origin" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/projects/project%2Funsafe/planning/preview-command",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kiss-pm-action": "same-origin"
        }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/workspace/projects/project%2Funsafe/planning/apply-command",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/workspace/projects/project%2Funsafe/planning/scenario-proposals",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/workspace/projects/project%2Funsafe/planning/scenario-proposals/scenario%2Funsafe/apply",
      expect.objectContaining({ method: "POST" })
    );
  });
});
