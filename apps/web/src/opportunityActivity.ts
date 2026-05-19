import type { OpportunityActivity, OpportunitySystemEvent } from "./api";

export type ActivityTab = "feed" | "chat" | "tasks" | "audit";

export type OpportunityFeedItem =
  | { kind: "activity"; activity: OpportunityActivity; createdAt: string }
  | { kind: "system"; event: OpportunitySystemEvent; createdAt: string };

export function composeOpportunityFeedItems(
  activities: OpportunityActivity[],
  systemEvents: OpportunitySystemEvent[]
): OpportunityFeedItem[] {
  return [
    ...activities.map((activity) => ({
      kind: "activity" as const,
      activity,
      createdAt: activity.createdAt
    })),
    ...systemEvents.map((event) => ({
      kind: "system" as const,
      event,
      createdAt: event.createdAt
    }))
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}
