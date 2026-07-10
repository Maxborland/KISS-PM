import { describe, expect, it } from "vitest";

import { validateCommandDataSourcePreconditions } from "./planningRouteHelpers";

describe("planning route helpers", () => {
  it.each(["missing-date", "resource:", ":2026-06-02", "resource:2026-02-30"])(
    "rejects malformed accepted overload id %s before persistence",
    async (overloadId) => {
      const issues = await validateCommandDataSourcePreconditions(
        {
          getPlanSnapshot: async () => undefined,
          listTaskStatuses: async () => [],
          listWorkspaceUsers: async () => []
        },
        "tenant-alpha",
        {
          type: "risk.accept_overload",
          payload: { overloadId, acceptedRiskReason: "invalid" }
        }
      );

      expect(issues).toContainEqual(
        expect.objectContaining({
          code: "planning_command_invalid",
          severity: "error"
        })
      );
    }
  );

  it("validates the resource embedded in an accepted overload id", async () => {
    const issues = await validateCommandDataSourcePreconditions(
      {
        getPlanSnapshot: async () => undefined,
        listTaskStatuses: async () => [],
        listWorkspaceUsers: async () => []
      },
      "tenant-alpha",
      {
        type: "risk.accept_overload",
        payload: {
          overloadId: "missing-resource:2026-06-02",
          acceptedRiskReason: "accepted"
        }
      }
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "planning_command_invalid",
        severity: "error",
        message: "Команда ссылается на неизвестный или неактивный ресурс"
      })
    );
  });
});