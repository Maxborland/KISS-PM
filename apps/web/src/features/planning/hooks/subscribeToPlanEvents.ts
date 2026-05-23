import {
  subscribeToPlanEvents as subscribeClient,
  type PlanEventSubscription,
  type PlanRealtimeEvent
} from "@kiss-pm/planning-client";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export type { PlanRealtimeEvent, PlanEventSubscription };

export function subscribeToPlanEvents(
  projectId: string,
  callback: (event: PlanRealtimeEvent) => void
): PlanEventSubscription {
  return subscribeClient(apiOrigin, projectId, callback);
}
