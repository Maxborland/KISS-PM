import type { IsoDateTime, TenantId, UserId } from "./common";

export type TaskStatusCategory = "new" | "waiting" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskSource = "manual";
export type TaskParticipantRole =
  | "executor"
  | "co_executor"
  | "requester"
  | "controller"
  | "approver"
  | "observer";

export type TaskParticipant = {
  userId: UserId;
  role: TaskParticipantRole;
};

export type Task = {
  id: string;
  tenantId: TenantId;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatusCategory;
  statusId: string;
  statusName: string;
  statusCategory: TaskStatusCategory;
  priority: TaskPriority;
  requesterUserId: UserId;
  ownerUserId: UserId;
  plannedStart: IsoDateTime;
  plannedFinish: IsoDateTime;
  durationWorkingDays: number;
  plannedWork: number;
  actualWork: number;
  progress: number;
  requiresAcceptance: boolean;
  source: TaskSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  archivedAt: IsoDateTime | null;
  participants: TaskParticipant[];
};

export type TaskStatus = {
  id: string;
  tenantId: TenantId;
  name: string;
  category: TaskStatusCategory;
  sortOrder: number;
  status: "active" | "archived";
  isSystem: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type TaskActivity = {
  id: string;
  tenantId: TenantId;
  taskId: string;
  type: "comment" | "file" | "system";
  body: string | null;
  title: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  authorUserId: UserId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type ScheduledTask = {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  plannedStart: IsoDateTime;
  plannedFinish: IsoDateTime;
  workMinutes: number;
  createdAt: IsoDateTime;
  statusId: string;
};
