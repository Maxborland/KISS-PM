import { describe, expect, it } from "vitest";

import type { OpportunityActivity, OpportunitySystemEvent } from "./api";
import { composeOpportunityFeedItems } from "./opportunityActivity";

describe("opportunity activity helpers", () => {
  it("combines persisted activity and system events from newest to oldest", () => {
    const activities = [
      {
        id: "activity-old",
        opportunityId: "opportunity-1",
        tenantId: "tenant-1",
        type: "comment",
        title: null,
        body: "Старый комментарий",
        status: null,
        dueDate: null,
        assigneeUserId: null,
        authorUserId: "user-1",
        createdAt: "2026-05-20T08:00:00.000Z",
        updatedAt: "2026-05-20T08:00:00.000Z"
      },
      {
        id: "activity-new",
        opportunityId: "opportunity-1",
        tenantId: "tenant-1",
        type: "task",
        title: "Новая задача",
        body: null,
        status: "todo",
        dueDate: null,
        assigneeUserId: null,
        authorUserId: "user-1",
        createdAt: "2026-05-20T10:00:00.000Z",
        updatedAt: "2026-05-20T10:00:00.000Z"
      }
    ] satisfies OpportunityActivity[];
    const systemEvents = [
      {
        id: "audit-mid",
        actionType: "opportunity.stage.updated",
        actorUserId: "user-1",
        executionStatus: "success",
        sourceWorkflow: "opportunity",
        createdAt: "2026-05-20T09:00:00.000Z"
      }
    ] satisfies OpportunitySystemEvent[];

    expect(composeOpportunityFeedItems(activities, systemEvents).map((item) => item.createdAt)).toEqual([
      "2026-05-20T10:00:00.000Z",
      "2026-05-20T09:00:00.000Z",
      "2026-05-20T08:00:00.000Z"
    ]);
  });
});
