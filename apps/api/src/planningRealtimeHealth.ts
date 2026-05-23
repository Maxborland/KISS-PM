export type PlanningRealtimeStatus = {
  backend: "memory" | "redis";
  connected: boolean;
  redisConfigured: boolean;
};

let statusProvider: (() => PlanningRealtimeStatus) | null = null;

export function setPlanningRealtimeStatusProvider(provider: () => PlanningRealtimeStatus) {
  statusProvider = provider;
}

export function getPlanningRealtimeStatus(): PlanningRealtimeStatus {
  if (statusProvider) return statusProvider();
  const backend = process.env.PLANNING_EVENTS_BACKEND === "redis" ? "redis" : "memory";
  const redisConfigured = Boolean(process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL);
  return {
    backend,
    connected: backend === "memory",
    redisConfigured
  };
}
