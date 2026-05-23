import type { PlanningCommand } from "@kiss-pm/domain";
import type { PlanningPreviewResponse, PlanningReadModel } from "@kiss-pm/planning-client";

export type ApplyBarState =
  | "idle"
  | "preview-pending"
  | "preview-ready"
  | "applying"
  | "applied"
  | "error"
  | "conflict";

export type PendingPreview = {
  command: PlanningCommand;
  preview: PlanningPreviewResponse;
  overlayReadModel: PlanningReadModel;
};

export type PlanMutationStore = {
  applyBarState: ApplyBarState;
  pendingPreview: PendingPreview | null;
  undoStack: PendingPreview[];
  redoStack: PendingPreview[];
  errorMessage: string | null;
};

export const initialPlanMutationStore: PlanMutationStore = {
  applyBarState: "idle",
  pendingPreview: null,
  undoStack: [],
  redoStack: [],
  errorMessage: null
};
