import { afterEach, describe, expect, it, vi } from "vitest";

import { DomainApiError } from "../../lib/domain-client";

import { createDeliveryPlanningClient } from "./planning-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createDeliveryPlanningClient live getCommits", () => {
  it("preserves DomainApiError evidence for a 403 audit response", async () => {
    const body = {
      error: "audit_events_forbidden",
      permission: "tenant.audit_events.read"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(body), {
          status: 403,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const error = await rejectionOf(
      createDeliveryPlanningClient(true).getCommits("project/forbidden", null)
    );

    expect(error).toBeInstanceOf(DomainApiError);
    expect(error).toMatchObject({
      status: 403,
      code: "audit_events_forbidden",
      body
    });
  });

  it("keeps successful audit event mapping unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            auditEvents: [
              {
                id: "audit-2",
                actionType: "planning.command.applied",
                sourceWorkflow: "planning",
                commandType: "task.update_schedule",
                afterState: { planVersion: 2, changedTaskIds: ["task-2"], hasCompensatingCommands: false },
                executionStatus: "succeeded",
                createdAt: "2026-07-10T09:00:00.000Z"
              },
              {
                id: "audit-4",
                actionType: "planning.custom.applied",
                sourceWorkflow: "planning",
                commandType: "custom.command",
                afterState: {
                  planVersion: 4,
                  changedTaskIds: [],
                  hasCompensatingCommands: true
                },
                executionStatus: "succeeded",
                createdAt: "2026-07-10T11:00:00.000Z"
              },
              {
                id: "audit-other",
                actionType: "workspace.updated",
                sourceWorkflow: "workspace",
                commandType: null,
                afterState: { planVersion: 8, changedTaskIds: [], hasCompensatingCommands: false },
                executionStatus: "succeeded",
                createdAt: "2026-07-10T12:00:00.000Z"
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await createDeliveryPlanningClient(true).getCommits("project-1", null);

    expect(result).toEqual({
      commits: [
        {
          version: 4,
          actionType: "planning.custom.applied",
          summary: "planning.custom.applied",
          changedTaskIds: [],
          auditEventId: "audit-4",
          at: "2026-07-10T11:00:00.000Z",
          revertible: true
        },
        {
          version: 2,
          actionType: "planning.command.applied",
          summary: "\u0421\u0434\u0432\u0438\u043d\u0443\u0442\u044b \u0441\u0440\u043e\u043a\u0438 \u0437\u0430\u0434\u0430\u0447\u0438",
          changedTaskIds: ["task-2"],
          auditEventId: "audit-2",
          at: "2026-07-10T09:00:00.000Z",
          revertible: false
        }
      ],
      latestRevert: {
        auditEventId: "audit-4"
      }
    });
  });

  it("rejects a non-domain transport failure instead of returning empty history", async () => {
    const networkError = new TypeError("network unavailable");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(networkError)));

    await expect(
      createDeliveryPlanningClient(true).getCommits("project-1", null)
    ).rejects.toBe(networkError);
  });
});

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw new Error("expected promise to reject");
  } catch (error) {
    return error;
  }
}