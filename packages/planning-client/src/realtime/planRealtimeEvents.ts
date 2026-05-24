export type PlanRealtimeEvent =
  | { type: "planVersionChanged"; projectId: string; planVersion: number }
  | { type: "planSnapshotInvalidated"; projectId: string; reason: string };
