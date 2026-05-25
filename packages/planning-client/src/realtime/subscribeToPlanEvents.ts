import type { PlanRealtimeEvent } from "./planRealtimeEvents";

export type PlanEventSubscription = {
  unsubscribe(): void;
};

export function subscribeToPlanEvents(
  apiOrigin: string,
  projectId: string,
  callback: (event: PlanRealtimeEvent) => void
): PlanEventSubscription {
  if (typeof EventSource === "undefined") {
    return { unsubscribe() {} };
  }

  const source = new EventSource(
    `${apiOrigin}/api/workspace/projects/${encodeURIComponent(projectId)}/planning/events`,
    { withCredentials: true }
  );

  const onPlanVersionChanged = (message: MessageEvent<string>) => {
    try {
      const event = JSON.parse(message.data) as PlanRealtimeEvent;
      callback(event);
    } catch {
      // ignore malformed payloads
    }
  };

  source.addEventListener("planVersionChanged", onPlanVersionChanged);
  source.addEventListener("planSnapshotInvalidated", onPlanVersionChanged);

  return {
    unsubscribe() {
      source.removeEventListener("planVersionChanged", onPlanVersionChanged);
      source.removeEventListener("planSnapshotInvalidated", onPlanVersionChanged);
      source.close();
    }
  };
}
