export type PlanRealtimeEvent =
  | { type: "planVersionChanged"; projectId: string; planVersion: number }
  | { type: "planSnapshotInvalidated"; projectId: string; reason: string };

type Listener = (event: PlanRealtimeEvent) => void;

const listenersByProject = new Map<string, Set<Listener>>();

export function subscribePlanningEvents(projectId: string, listener: Listener): () => void {
  const bucket = listenersByProject.get(projectId) ?? new Set<Listener>();
  bucket.add(listener);
  listenersByProject.set(projectId, bucket);
  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) listenersByProject.delete(projectId);
  };
}

export function emitPlanningEvent(event: PlanRealtimeEvent): void {
  const bucket = listenersByProject.get(event.projectId);
  if (!bucket) return;
  for (const listener of bucket) listener(event);
}

export function notifyPlanVersionChanged(projectId: string, planVersion: number): void {
  emitPlanningEvent({ type: "planVersionChanged", projectId, planVersion });
}
