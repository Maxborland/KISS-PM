export type PlanRealtimeEvent =
  | { type: "planVersionChanged"; projectId: string; planVersion: number }
  | { type: "planSnapshotInvalidated"; projectId: string; reason: string };

export type PlanningEventListener = (event: PlanRealtimeEvent) => void;

export interface PlanningEventPublisher {
  publish(event: PlanRealtimeEvent): void;
  subscribe(projectId: string, listener: PlanningEventListener): () => void;
}

export class InMemoryPlanningEventPublisher implements PlanningEventPublisher {
  private readonly listenersByProject = new Map<string, Set<PlanningEventListener>>();

  subscribe(projectId: string, listener: PlanningEventListener): () => void {
    const bucket = this.listenersByProject.get(projectId) ?? new Set<PlanningEventListener>();
    bucket.add(listener);
    this.listenersByProject.set(projectId, bucket);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) this.listenersByProject.delete(projectId);
    };
  }

  publish(event: PlanRealtimeEvent): void {
    const bucket = this.listenersByProject.get(event.projectId);
    if (!bucket) return;
    for (const listener of bucket) listener(event);
  }
}

let publisher: PlanningEventPublisher | null = null;

export function createPlanningEventPublisher(): PlanningEventPublisher {
  const backend = process.env.PLANNING_EVENTS_BACKEND ?? "memory";
  if (backend === "memory") {
    return new InMemoryPlanningEventPublisher();
  }
  if (backend === "redis") {
    return new InMemoryPlanningEventPublisher();
  }
  throw new Error(`unsupported_planning_events_backend:${backend}`);
}

/** Async factory used at server boot when Redis is configured. */
export async function bootstrapPlanningEventPublisher(): Promise<PlanningEventPublisher> {
  const backend = process.env.PLANNING_EVENTS_BACKEND ?? "memory";
  const memory = new InMemoryPlanningEventPublisher();
  if (backend === "redis") {
    const { createRedisPlanningEventPublisher } = await import("./planningRedisEventBus.js");
    const redis = await createRedisPlanningEventPublisher(memory);
    if (redis) return redis;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[planning-events] Redis unavailable, falling back to in-memory publisher"
      );
    }
  }
  return memory;
}

export function setPlanningEventPublisher(next: PlanningEventPublisher): void {
  publisher = next;
}

function getPlanningEventPublisher(): PlanningEventPublisher {
  if (!publisher) {
    publisher = createPlanningEventPublisher();
  }
  return publisher;
}

export function subscribePlanningEvents(
  projectId: string,
  listener: PlanningEventListener
): () => void {
  return getPlanningEventPublisher().subscribe(projectId, listener);
}

export function emitPlanningEvent(event: PlanRealtimeEvent): void {
  getPlanningEventPublisher().publish(event);
}

export function notifyPlanVersionChanged(projectId: string, planVersion: number): void {
  emitPlanningEvent({ type: "planVersionChanged", projectId, planVersion });
}
