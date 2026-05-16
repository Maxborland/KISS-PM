import type { AuditEventDto } from "./phase2ApiClient";

export type ScheduleDependencyDto = {
  id: string;
  tenantId: string;
  projectId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: "finish_to_start";
};

export type ScheduleWbsNodeDto = {
  id: string;
  tenantId: string;
  projectId: string;
  parentId?: string;
  taskId?: string;
  stageId?: string;
  sortOrder: number;
  schedule?: {
    plannedStartDate?: string;
    plannedFinishDate?: string;
    durationDays?: number;
  };
  plannedWorkHours?: number;
  progressPercent?: number;
};

export type ScheduleValidationIssueDto = {
  code: string;
  severity: "warning" | "blocking";
  message: string;
  nodeId?: string;
  dependencyId?: string;
  fieldRefs: string[];
};

export type SchedulePlanDto = {
  id: string;
  tenantId: string;
  projectId: string;
  version: number;
  baselineId?: string;
  status: "draft" | "active" | "archived";
  wbsNodes: ScheduleWbsNodeDto[];
  dependencies: ScheduleDependencyDto[];
};

export type ScheduleBaselineDto = {
  id: string;
  tenantId: string;
  projectId: string;
  schedulePlanId: string;
  createdBy: string;
  createdAt: string;
  taskBaselineValues: Array<{
    taskId: string;
    plannedStartDate?: string;
    plannedFinishDate?: string;
    durationDays?: number;
    progressPercent?: number;
  }>;
};

export type ScheduleActionExecutionDto = {
  id: string;
  tenantId: string;
  actorId: string;
  commandType: string;
  requiredPermission: string;
  status: string;
  source: { entityType: string; entityId: string };
  target?: { entityType: string; entityId: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  correlationId: string;
  trace: string[];
};

export type ProjectScheduleDto = {
  schedulePlan: SchedulePlanDto;
  validationIssues: ScheduleValidationIssueDto[];
  baseline?: ScheduleBaselineDto;
};

export type ProjectScheduleAuditDto = {
  events: AuditEventDto[];
  actionExecutions: ScheduleActionExecutionDto[];
};

export type CreateScheduleTaskRequestDto = {
  id?: string;
  stageId: string;
  taskTemplateId: string;
  taskTemplateKey: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  plannedWorkHours: number;
  progressPercent: number;
};

export type UpdateScheduleTaskRequestDto = {
  plannedStartDate: string;
  plannedFinishDate: string;
  plannedWorkHours: number;
  progressPercent: number;
};

export type CreateScheduleDependencyRequestDto = {
  id?: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: "finish_to_start";
};

export type CaptureScheduleBaselineRequestDto = {
  id?: string;
};

export type ScheduleCommandResultDto = ProjectScheduleDto & {
  task?: {
    id: string;
    projectId: string;
    dueDate?: string;
    plannedWorkHours?: number;
  };
  dependency?: ScheduleDependencyDto;
  actionExecution: ScheduleActionExecutionDto;
};

export type GanttRowViewDto = {
  id: string;
  taskId?: string;
  label: string;
  level: number;
  plannedStartDate?: string;
  plannedFinishDate?: string;
  durationDays?: number;
  plannedWorkHours?: number;
  progressPercent?: number;
  baselineLabel: string;
  validationLabel: string;
  bar?: {
    offsetPercent: number;
    widthPercent: number;
  };
};

export type ProjectScheduleGanttViewDto = {
  rows: GanttRowViewDto[];
  timelineStartDate?: string;
  timelineFinishDate?: string;
};

export type Phase5ScheduleApiClient = {
  getProjectSchedule(testUser: string, projectId: string): Promise<ProjectScheduleDto>;
  getProjectScheduleAudit(testUser: string, projectId: string): Promise<ProjectScheduleAuditDto>;
  createScheduleTask(
    testUser: string,
    projectId: string,
    request: CreateScheduleTaskRequestDto
  ): Promise<ScheduleCommandResultDto>;
  updateScheduleTask(
    testUser: string,
    projectId: string,
    taskId: string,
    request: UpdateScheduleTaskRequestDto
  ): Promise<ScheduleCommandResultDto>;
  createFinishToStartDependency(
    testUser: string,
    projectId: string,
    request: CreateScheduleDependencyRequestDto
  ): Promise<ScheduleCommandResultDto>;
  captureBaseline(
    testUser: string,
    projectId: string,
    request: CaptureScheduleBaselineRequestDto
  ): Promise<ScheduleCommandResultDto>;
};

type ApiErrorDto = {
  code: string;
  message: string;
  validationIssues?: ScheduleValidationIssueDto[];
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as T | ApiErrorDto;

  if (!response.ok) {
    const errorBody = body as ApiErrorDto;
    throw Object.assign(new Error(errorBody.message), errorBody);
  }

  return body as T;
}

function jsonBody(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function withUser(path: string, testUser: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}testUser=${encodeURIComponent(testUser)}`;
}

function scheduleIssueMessage(issue: ScheduleValidationIssueDto): string {
  const labels: Record<string, string> = {
    finish_to_start_conflict: "Последователь начинается раньше завершения предшественника",
    missing_planned_start: "Не заполнена плановая дата старта",
    missing_planned_finish: "Не заполнена плановая дата финиша",
    invalid_date_range: "Плановый финиш раньше старта",
    missing_planned_work: "Не заполнена плановая работа",
    invalid_planned_work: "Плановая работа должна быть неотрицательной",
    missing_progress: "Не заполнен прогресс",
    invalid_progress: "Прогресс должен быть от 0 до 100",
    duplicate_wbs_node: "Дубликат WBS-узла",
    unknown_dependency_endpoint: "Связь указывает на неизвестную задачу",
    duplicate_dependency: "Дубликат связи расписания",
    dependency_cycle: "Обнаружен цикл зависимостей",
    cross_project_dependency: "Связь выходит за пределы проекта",
    cross_tenant_dependency: "Связь выходит за пределы тенанта"
  };

  return labels[issue.code] ?? issue.message;
}

export function scheduleValidationIssueLabel(issue: ScheduleValidationIssueDto): string {
  const severityLabel = issue.severity === "blocking" ? "Блокер" : "Предупреждение";

  return `${severityLabel}: ${scheduleIssueMessage(issue)} (${issue.code})`;
}

function baselineLabel(baseline: ScheduleBaselineDto | undefined, taskId: string | undefined): string {
  if (taskId === undefined) return "—";
  const baselineValue = baseline?.taskBaselineValues.find((value) => value.taskId === taskId);
  if (baselineValue === undefined) return "—";

  return [
    baselineValue.plannedStartDate ?? "—",
    baselineValue.plannedFinishDate ?? "—",
    baselineValue.durationDays ?? "—",
    baselineValue.progressPercent !== undefined ? `${baselineValue.progressPercent}%` : "—"
  ].join(" / ");
}

function daysBetween(startDate: string, finishDate: string): number {
  const startTime = Date.parse(`${startDate}T00:00:00.000Z`);
  const finishTime = Date.parse(`${finishDate}T00:00:00.000Z`);

  return Math.max(1, Math.floor((finishTime - startTime) / 86_400_000) + 1);
}

function nodeLevel(node: ScheduleWbsNodeDto, byId: Map<string, ScheduleWbsNodeDto>): number {
  let level = 0;
  let nextParentId = node.parentId;
  while (nextParentId !== undefined) {
    const parent = byId.get(nextParentId);
    if (parent === undefined) break;
    level += 1;
    nextParentId = parent.parentId;
  }

  return level;
}

export function buildProjectScheduleGanttView(schedule: ProjectScheduleDto): ProjectScheduleGanttViewDto {
  const nodes = [...schedule.schedulePlan.wbsNodes].sort((left, right) => left.sortOrder - right.sortOrder);
  const datedNodes = nodes.filter(
    (node) => node.schedule?.plannedStartDate !== undefined && node.schedule.plannedFinishDate !== undefined
  );
  const timelineStartDate = datedNodes
    .map((node) => node.schedule?.plannedStartDate)
    .filter((value): value is string => value !== undefined)
    .reduce<string | undefined>((left, right) => (left === undefined || right < left ? right : left), undefined);
  const timelineFinishDate = datedNodes
    .map((node) => node.schedule?.plannedFinishDate)
    .filter((value): value is string => value !== undefined)
    .reduce<string | undefined>((left, right) => (left === undefined || right > left ? right : left), undefined);
  const totalDays =
    timelineStartDate !== undefined && timelineFinishDate !== undefined ? daysBetween(timelineStartDate, timelineFinishDate) : 1;
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return {
    ...(timelineStartDate !== undefined ? { timelineStartDate } : {}),
    ...(timelineFinishDate !== undefined ? { timelineFinishDate } : {}),
    rows: nodes.map((node) => {
      const nodeIssues = schedule.validationIssues.filter((issue) => issue.nodeId === node.id);
      const plannedStartDate = node.schedule?.plannedStartDate;
      const plannedFinishDate = node.schedule?.plannedFinishDate;
      const hasBar = plannedStartDate !== undefined && plannedFinishDate !== undefined && timelineStartDate !== undefined;
      const durationDays = node.schedule?.durationDays ?? (hasBar ? daysBetween(plannedStartDate, plannedFinishDate) : undefined);

      return {
        id: node.id,
        ...(node.taskId !== undefined ? { taskId: node.taskId } : {}),
        label: node.taskId ?? node.stageId ?? node.id,
        level: nodeLevel(node, byId),
        ...(plannedStartDate !== undefined ? { plannedStartDate } : {}),
        ...(plannedFinishDate !== undefined ? { plannedFinishDate } : {}),
        ...(durationDays !== undefined ? { durationDays } : {}),
        ...(node.plannedWorkHours !== undefined ? { plannedWorkHours: node.plannedWorkHours } : {}),
        ...(node.progressPercent !== undefined ? { progressPercent: node.progressPercent } : {}),
        baselineLabel: baselineLabel(schedule.baseline, node.taskId),
        validationLabel: nodeIssues.length > 0 ? nodeIssues.map(scheduleValidationIssueLabel).join("; ") : "Без предупреждений",
        ...(hasBar
          ? {
              bar: {
                offsetPercent: ((daysBetween(timelineStartDate, plannedStartDate) - 1) / totalDays) * 100,
                widthPercent: Math.max(8, (durationDays ?? daysBetween(plannedStartDate, plannedFinishDate)) / totalDays * 100)
              }
            }
          : {})
      };
    })
  };
}

export function createPhase5ScheduleApiClient(basePath = "/api/api"): Phase5ScheduleApiClient {
  return {
    getProjectSchedule(testUser, projectId) {
      return requestJson<ProjectScheduleDto>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/schedule`, testUser)
      );
    },
    getProjectScheduleAudit(testUser, projectId) {
      return requestJson<ProjectScheduleAuditDto>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/schedule/audit`, testUser)
      );
    },
    createScheduleTask(testUser, projectId, request) {
      return requestJson<ScheduleCommandResultDto>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/schedule/tasks`, testUser),
        jsonBody(request)
      );
    },
    updateScheduleTask(testUser, projectId, taskId, request) {
      return requestJson<ScheduleCommandResultDto>(
        withUser(
          `${basePath}/projects/${encodeURIComponent(projectId)}/schedule/tasks/${encodeURIComponent(taskId)}`,
          testUser
        ),
        jsonBody(request, "PATCH")
      );
    },
    createFinishToStartDependency(testUser, projectId, request) {
      return requestJson<ScheduleCommandResultDto>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/schedule/dependencies`, testUser),
        jsonBody(request)
      );
    },
    captureBaseline(testUser, projectId, request) {
      return requestJson<ScheduleCommandResultDto>(
        withUser(`${basePath}/projects/${encodeURIComponent(projectId)}/schedule/baseline`, testUser),
        jsonBody(request)
      );
    }
  };
}
