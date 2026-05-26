export type PlanningGanttTaskType = "fixed_units" | "fixed_work" | "fixed_duration";
export type PlanningGanttSchedulingMode = "auto" | "manual";
export type PlanningGanttDependencyType = "FS" | "SS" | "FF" | "SF";
export type PlanningGanttValidationSeverity = "info" | "warning" | "error";

export type PlanningGanttTaskRow = {
  id: string;
  parentTaskId: string | null;
  wbsCode: string;
  title: string;
  statusId: string;
  schedulingMode: PlanningGanttSchedulingMode;
  taskType: PlanningGanttTaskType;
  effortDriven: boolean;
  plannedStart: string | null;
  plannedFinish: string | null;
  durationMinutes: number | null;
  workMinutes: number;
  percentComplete: number;
  baselineStart: string | null;
  baselineFinish: string | null;
  baselineWorkMinutes: number | null;
  startVarianceDays: number | null;
  finishVarianceDays: number | null;
  workVarianceMinutes: number | null;
  isSummary: boolean;
  isMilestone: boolean;
  isCritical: boolean;
  slackMinutes: number | null;
  validationIssueIds: string[];
};

export type PlanningGanttDependencyRow = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: PlanningGanttDependencyType;
  lagMinutes: number;
  valid: boolean;
  issueCodes: string[];
};

export type PlanningGanttBaselineRow = {
  baselineId: string;
  capturedAt: string;
  taskId: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  workMinutes: number | null;
};

export type PlanningGanttValidationIssue = {
  id: string;
  code: string;
  severity: PlanningGanttValidationSeverity;
  message: string;
  entity: { type: string; id: string } | null;
};

export type PlanningGanttResourceLoadBucket = {
  id: string;
  resourceId: string;
  resourceName: string;
  bucketStart: string;
  bucketFinish: string;
  granularity: "day" | "week" | "month";
  plannedMinutes: number;
  availableMinutes: number;
  reservedMinutes: number;
  freeMinutes: number;
  overloadMinutes: number;
  taskIds: string[];
};

export type PlanningGanttViewModel = {
  project: {
    id: string;
    plannedStart: string;
    plannedFinish: string;
    deadline: string | null;
    calendarId: string | null;
  };
  tasks: PlanningGanttTaskRow[];
  dependencies: PlanningGanttDependencyRow[];
  baselines: PlanningGanttBaselineRow[];
  validationIssues: PlanningGanttValidationIssue[];
  resourceLoadBuckets: PlanningGanttResourceLoadBucket[];
  planVersion: number;
  engineVersion: string;
};
