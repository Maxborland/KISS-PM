export type PlanDate = string;
export type PlanDateTime = string;

export type WorkingInstant = {
  date: PlanDate;
  minuteOfDay: number;
};

export type TaskType = "fixed_units" | "fixed_work" | "fixed_duration";
export type SchedulingMode = "auto" | "manual";
export type DependencyType = "FS" | "SS" | "FF" | "SF";
export type BucketGranularity = "day" | "week" | "month";
export type ScenarioProfile = "aggressive" | "balanced" | "resilient";
export type ValidationSeverity = "info" | "warning" | "error";
export type ProjectSourceType = "opportunity" | "workspace_inbox" | "manual";

export type PlanProject = {
  id: string;
  sourceType: ProjectSourceType;
  sourceOpportunityId: string | null;
  plannedStart: PlanDate;
  plannedFinish: PlanDate;
  deadline: PlanDate | null;
  calendarId: string | null;
};

export type PlanConstraintType =
  | "as_soon_as_possible"
  | "start_no_earlier_than"
  | "finish_no_later_than"
  | "must_start_on"
  | "must_finish_on";

export type PlanConstraint = {
  id: string;
  taskId: string;
  type: PlanConstraintType;
  date: PlanDate | null;
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
  plannedStart: PlanDate | null;
  plannedFinish: PlanDate | null;
  plannedStartInstant?: WorkingInstant | null;
  plannedFinishInstant?: WorkingInstant | null;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  calendarId: string | null;
  customFields?: Record<string, unknown>;
  constraint: PlanConstraint | null;
};

export type PlanAssignmentRole =
  | "executor"
  | "co_executor"
  | "controller"
  | "approver"
  | "observer";

export type PlanAssignment = {
  id: string;
  taskId: string;
  resourceId: string;
  role: PlanAssignmentRole;
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

export type PlanCalendar = {
  id: string;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
};

export type PlanCalendarException = {
  id: string;
  calendarId: string;
  resourceId: string | null;
  date: PlanDate;
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

export type PlanReservation = {
  id: string;
  resourceId: string;
  projectId: string;
  start: PlanDate;
  finish: PlanDate;
  workMinutes: number;
  reason: string | null;
};

export type PlanBaseline = {
  id: string;
  capturedAt: PlanDateTime;
  tasks: Array<{
    taskId: string;
    plannedStart: PlanDate | null;
    plannedFinish: PlanDate | null;
    workMinutes: number;
  }>;
};

export type PlanSnapshot = {
  tenantId: string;
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
  reservations: PlanReservation[];
  constraints: PlanConstraint[];
  capturedAt: PlanDateTime;
};

export type ValidationIssueCode =
  | "dependency_cycle_detected"
  | "calendar_has_no_working_time"
  | "constraint_impossible"
  | "assignment_without_resource"
  | "schedule_outside_project_bounds"
  | "invalid_work_model"
  | "planning_command_invalid";

export type ValidationIssue = {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
  entity: { type: string; id: string } | null;
};

export type CalculatedTask = PlanTask & {
  calculatedStart: PlanDate | null;
  calculatedFinish: PlanDate | null;
  calculatedStartInstant: WorkingInstant | null;
  calculatedFinishInstant: WorkingInstant | null;
  earliestStart: PlanDate | null;
  earliestFinish: PlanDate | null;
  earliestStartInstant: WorkingInstant | null;
  earliestFinishInstant: WorkingInstant | null;
  latestStart: PlanDate | null;
  latestFinish: PlanDate | null;
  latestStartInstant: WorkingInstant | null;
  latestFinishInstant: WorkingInstant | null;
  totalSlackMinutes: number | null;
  isCritical: boolean;
};

export type CalculatedDependency = PlanDependency & {
  valid: boolean;
  issueCodes: string[];
};

export type CriticalPathResult = {
  taskIds: string[];
};

export type ScheduleTraceEntry = {
  taskId: string;
  calendarId: string;
  authoredStart: WorkingInstant | null;
  dependencyStart: WorkingInstant | null;
  earliestStart: WorkingInstant | null;
  earliestFinish: WorkingInstant | null;
  latestStart: WorkingInstant | null;
  latestFinish: WorkingInstant | null;
  durationMinutes: number | null;
  appliedConstraintType: PlanConstraintType | null;
  issueCodes: ValidationIssueCode[];
};

export type CalculatedPlan = {
  tenantId: string;
  projectId: string;
  planVersion: number;
  engineVersion: string;
  calculatedAt: PlanDateTime;
  tasks: CalculatedTask[];
  dependencies: CalculatedDependency[];
  projectFinish: PlanDate | null;
  criticalPathTaskIds: string[];
  criticalPath: CriticalPathResult;
  scheduleTrace: ScheduleTraceEntry[];
  validationIssues: ValidationIssue[];
};
