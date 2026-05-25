import type { IsoDate, IsoDateTime, TenantId, UnknownRecord } from "./common";

export type PlanProjectSourceType = "opportunity" | "workspace_inbox" | "manual";
export type SchedulingMode = "auto" | "manual";
export type TaskType = "fixed_units" | "fixed_work" | "fixed_duration";
export type DependencyType = "FS" | "SS" | "FF" | "SF";

export type PlanProject = {
  id: string;
  sourceType: PlanProjectSourceType;
  sourceOpportunityId: string | null;
  plannedStart: IsoDate;
  plannedFinish: IsoDate;
  deadline: IsoDate | null;
  calendarId: string | null;
};

export type PlanConstraint = {
  id: string;
  taskId: string;
  type:
    | "as_soon_as_possible"
    | "start_no_earlier_than"
    | "finish_no_later_than"
    | "must_start_on"
    | "must_finish_on";
  date: IsoDate | null;
};

export type PlanTask = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  title: string;
  statusId: string;
  schedulingMode: SchedulingMode;
  taskType: TaskType;
  effortDriven: boolean;
  plannedStart: IsoDate | null;
  plannedFinish: IsoDate | null;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  calendarId: string | null;
  customFields?: UnknownRecord;
  constraint: PlanConstraint | null;
};

export type PlanAssignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: "executor" | "co_executor" | "controller" | "approver" | "observer";
  unitsPermille: number;
  workMinutes: number | null;
  calendarId: string | null;
};

export type PlanDependency = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: DependencyType;
  lagMinutes: number;
};

export type PlanBaseline = {
  id: string;
  capturedAt: IsoDateTime;
  tasks: Array<{
    taskId: string;
    plannedStart: IsoDate | null;
    plannedFinish: IsoDate | null;
    workMinutes: number;
  }>;
};

export type PlanCalendar = {
  id: string;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
};

export type PlanCalendarException = {
  id: string;
  calendarId: string;
  resourceId: string | null;
  date: IsoDate;
  workingMinutes: number;
  reason: string | null;
};

export type PlanResource = {
  id: string;
  userId: string | null;
  positionId: string | null;
  teamId: string | null;
  name: string;
  calendarId: string | null;
};

export type PlanSnapshot = {
  tenantId: TenantId;
  projectId: string;
  planVersion: number;
  project: PlanProject;
  tasks: PlanTask[];
  assignments: PlanAssignment[];
  dependencies: PlanDependency[];
  baselines: PlanBaseline[];
  calendars: PlanCalendar[];
  calendarExceptions: PlanCalendarException[];
  resources: PlanResource[];
  reservations: Array<{
    id: string;
    resourceId: string;
    projectId: string;
    start: IsoDate;
    finish: IsoDate;
    workMinutes: number;
    reason: string | null;
  }>;
  constraints: PlanConstraint[];
  capturedAt: IsoDateTime;
};
