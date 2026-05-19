import type {
  OpportunityFeasibilityAssessment,
  OpportunityFeasibilityStatus,
  WorkspaceConfigFieldType,
  WorkspaceConfigStatus
} from "@kiss-pm/domain";

export type ApiHealth = {
  status: string;
  product: string;
};

export type WorkspaceUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  accessProfileId: string;
  positionId: string | null;
  positionName: string | null;
  phone: string | null;
  telegram: string | null;
  status: string;
  theme: string;
  accentColor: string;
};

export type Position = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
};

export type AccessRole = {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
};

export type AuthMeResponse = {
  user: WorkspaceUser;
  permissions: string[];
  workspace: {
    id: string;
  };
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  actorUserId: string;
  actionType: string;
  sourceWorkflow?: string | null;
  sourceEntity?: {
    type: string;
    id: string;
  };
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  correlationId: string;
  createdAt: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly path: string;
  readonly status: number;

  constructor(path: string, status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.path = path;
    this.status = status;
    this.code = code;
  }
}

export type CustomFieldDefinition = {
  id: string;
  tenantId: string;
  systemKey: string;
  tenantLabel: string;
  targetEntity: "project" | "opportunity";
  fieldType: WorkspaceConfigFieldType;
  required: boolean;
  status: WorkspaceConfigStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTemplate = {
  id: string;
  tenantId: string;
  systemKey: string;
  tenantLabel: string;
  description: string | null;
  status: WorkspaceConfigStatus;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldInput = Omit<
  CustomFieldDefinition,
  "tenantId" | "createdAt" | "updatedAt"
>;

export type ProjectTemplateInput = Omit<
  ProjectTemplate,
  "tenantId" | "createdAt" | "updatedAt"
>;

export type CrmEntityStatus = "active" | "archived";

export type Client = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  tenantId: string;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  role: string | null;
  status: CrmEntityStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectType = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: string;
  updatedAt: string;
};

export type DealStage = {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientInput = Pick<Client, "id" | "name" | "description">;
export type ClientUpdateInput = Pick<Client, "name" | "description" | "status">;
export type ContactInput = Pick<
  Contact,
  "id" | "clientId" | "name" | "email" | "phone" | "telegram" | "role"
>;
export type ContactUpdateInput = Pick<
  Contact,
  "clientId" | "name" | "email" | "phone" | "telegram" | "role" | "status"
>;
export type ProjectTypeInput = Pick<ProjectType, "id" | "name" | "description">;
export type ProjectTypeUpdateInput = Pick<ProjectType, "name" | "description" | "status">;
export type DealStageInput = Pick<DealStage, "id" | "name" | "sortOrder">;
export type DealStageUpdateInput = Pick<DealStage, "name" | "sortOrder" | "status">;

export type PositionDemand = {
  positionId: string;
  requiredHours: number;
};

export type OpportunityStatus =
  | "new"
  | "intake"
  | "feasibility"
  | "ready_to_activate"
  | "won_closed"
  | "lost_rejected";

export type OpportunityFinalStatus = "won_closed" | "lost_rejected";

export type ProjectStatus = "draft" | "active" | "paused" | "closed" | "cancelled";

export type Opportunity = {
  id: string;
  tenantId: string;
  clientId: string | null;
  primaryContactId: string | null;
  projectTypeId: string | null;
  stageId: string | null;
  clientName: string;
  contactName: string;
  title: string;
  projectType: string;
  description: string | null;
  plannedStart: string;
  plannedFinish: string;
  contractValue: number;
  plannedHourlyRate: number;
  plannedHours: number;
  probability: number;
  status: OpportunityStatus;
  templateId: string | null;
  feasibilityStatus: OpportunityFeasibilityStatus | null;
  feasibilityResult: OpportunityFeasibilityAssessment | null;
  feasibilityCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  demand: PositionDemand[];
  customFieldValues: Record<string, string>;
};

export type Project = {
  id: string;
  tenantId: string;
  sourceOpportunityId: string;
  clientId: string | null;
  projectTypeId: string | null;
  title: string;
  clientName: string;
  status: ProjectStatus;
  plannedStart: string;
  plannedFinish: string;
  contractValue: number;
  plannedHours: number;
  templateId: string | null;
  createdAt: string;
  activatedAt: string | null;
  demand: PositionDemand[];
};

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskParticipantRole =
  | "executor"
  | "co_executor"
  | "requester"
  | "controller"
  | "approver"
  | "observer";

export type TaskParticipant = {
  userId: string;
  role: TaskParticipantRole;
};

export type Task = {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  plannedStart: string;
  plannedFinish: string;
  plannedWork: number;
  actualWork: number;
  progress: number;
  source: "manual";
  createdAt: string;
  updatedAt: string;
  participants: TaskParticipant[];
};

export type TaskInput = {
  id?: string | undefined;
  title: string;
  description: string;
  priority: TaskPriority;
  plannedStart: string;
  plannedFinish: string;
  plannedWork: number;
  participants: TaskParticipant[];
};

export type OpportunityInput = {
  id?: string;
  clientId: string;
  primaryContactId: string;
  projectTypeId: string;
  stageId: string;
  title: string;
  description: string;
  plannedStart: string;
  plannedFinish: string;
  contractValue: number;
  plannedHourlyRate: number;
  probability: number;
  templateId: string | null;
  demand: PositionDemand[];
  customFieldValues?: Record<string, string>;
};
export type OpportunityUpdateInput = Omit<OpportunityInput, "id">;

export type OpportunityStageInput = {
  stageId: string;
};

export type OpportunityFinalActionInput = {
  status: OpportunityFinalStatus;
  reason: string;
};

export type OpportunityActivityType = "comment" | "task";
export type OpportunityActivityStatus = "todo" | "done";

export type OpportunityActivity = {
  id: string;
  tenantId: string;
  opportunityId: string;
  type: OpportunityActivityType;
  title: string | null;
  body: string | null;
  status: OpportunityActivityStatus | null;
  dueDate: string | null;
  assigneeUserId: string | null;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type OpportunitySystemEvent = {
  id: string;
  actorUserId: string;
  actionType: string;
  sourceWorkflow: string | null;
  createdAt: string;
  executionStatus: unknown;
};

export type OpportunityActivityFeed = {
  activities: OpportunityActivity[];
  systemEvents: OpportunitySystemEvent[];
  canReadRawAudit: boolean;
  auditEvents: AuditEvent[] | null;
};

export type OpportunityCommentInput = {
  body: string;
};

export type OpportunityTaskInput = {
  title: string;
  body?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
};

export type OpportunityTaskUpdateInput = {
  status: OpportunityActivityStatus;
};

export async function fetchApiHealth(): Promise<ApiHealth> {
  return requestJson("/health");
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthMeResponse> {
  await requestJson("/api/auth/login", {
    method: "POST",
    body: input
  });
  return fetchMe();
}

export async function logout(): Promise<void> {
  await requestJson("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<AuthMeResponse> {
  return requestJson("/api/auth/me");
}

export async function fetchUsers(): Promise<{ users: WorkspaceUser[] }> {
  return requestJson("/api/workspace/users");
}

export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  accessProfileId: string;
  positionId: string | null;
  password: string;
}): Promise<{ user: WorkspaceUser }> {
  return requestJson("/api/workspace/users", {
    method: "POST",
    body: input
  });
}

export async function updateUser(
  userId: string,
  input: {
    email: string;
    name: string;
    accessProfileId: string;
    positionId: string | null;
    status: string;
  }
): Promise<{ user: WorkspaceUser }> {
  return requestJson(`/api/workspace/users/${encodePathSegment(userId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function deleteUser(userId: string): Promise<{ status: string }> {
  return requestJson(`/api/workspace/users/${encodePathSegment(userId)}`, {
    method: "DELETE"
  });
}

export async function fetchPositions(): Promise<{ positions: Position[] }> {
  return requestJson("/api/workspace/positions");
}

export async function createPosition(input: {
  id: string;
  name: string;
  description: string;
}): Promise<{ position: Position }> {
  return requestJson("/api/workspace/positions", {
    method: "POST",
    body: input
  });
}

export async function updatePosition(
  positionId: string,
  input: {
    name: string;
    description: string;
  }
): Promise<{ position: Position }> {
  return requestJson(`/api/workspace/positions/${encodePathSegment(positionId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function deletePosition(positionId: string): Promise<{ status: string }> {
  return requestJson(`/api/workspace/positions/${encodePathSegment(positionId)}`, {
    method: "DELETE"
  });
}

export async function fetchAccessRoles(): Promise<{ accessRoles: AccessRole[] }> {
  return requestJson("/api/workspace/access-roles");
}

export async function createAccessRole(input: {
  id: string;
  name: string;
  permissions: string[];
}): Promise<{ accessProfile: AccessRole }> {
  return requestJson("/api/tenant/current/access-profiles", {
    method: "POST",
    body: input
  });
}

export async function updateAccessRole(
  roleId: string,
  input: {
    name: string;
    permissions: string[];
  }
): Promise<{ accessRole: AccessRole }> {
  return requestJson(`/api/workspace/access-roles/${encodePathSegment(roleId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function deleteAccessRole(roleId: string): Promise<{ status: string }> {
  return requestJson(`/api/workspace/access-roles/${encodePathSegment(roleId)}`, {
    method: "DELETE"
  });
}

export async function updateProfile(input: {
  name: string;
  phone: string;
  telegram: string;
}): Promise<{ user: WorkspaceUser }> {
  return requestJson("/api/profile", {
    method: "PATCH",
    body: input
  });
}

export async function updateTheme(input: {
  theme: string;
  accentColor: string;
}): Promise<{ user: WorkspaceUser }> {
  return requestJson("/api/profile/theme", {
    method: "PATCH",
    body: input
  });
}

export async function fetchAuditEvents(): Promise<{ auditEvents: AuditEvent[] }> {
  return requestJson("/api/tenant/current/audit-events");
}

export async function fetchCustomFields(): Promise<{
  customFields: CustomFieldDefinition[];
}> {
  return requestJson("/api/workspace/config/custom-fields");
}

export async function createCustomField(
  input: CustomFieldInput
): Promise<{ customField: CustomFieldDefinition }> {
  return requestJson("/api/workspace/config/custom-fields", {
    method: "POST",
    body: input
  });
}

export async function updateCustomField(
  fieldId: string,
  input: Omit<CustomFieldInput, "id">
): Promise<{ customField: CustomFieldDefinition }> {
  return requestJson(
    `/api/workspace/config/custom-fields/${encodePathSegment(fieldId)}`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function fetchProjectTemplates(): Promise<{
  projectTemplates: ProjectTemplate[];
}> {
  return requestJson("/api/workspace/config/project-templates");
}

export async function createProjectTemplate(
  input: ProjectTemplateInput
): Promise<{ projectTemplate: ProjectTemplate }> {
  return requestJson("/api/workspace/config/project-templates", {
    method: "POST",
    body: input
  });
}

export async function updateProjectTemplate(
  templateId: string,
  input: Omit<ProjectTemplateInput, "id">
): Promise<{ projectTemplate: ProjectTemplate }> {
  return requestJson(
    `/api/workspace/config/project-templates/${encodePathSegment(templateId)}`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function fetchClients(): Promise<{ clients: Client[] }> {
  return requestJson("/api/workspace/clients");
}

export async function createClient(input: ClientInput): Promise<{ client: Client }> {
  return requestJson("/api/workspace/clients", {
    method: "POST",
    body: input
  });
}

export async function updateClient(
  clientId: string,
  input: ClientUpdateInput
): Promise<{ client: Client }> {
  return requestJson(`/api/workspace/clients/${encodePathSegment(clientId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function fetchContacts(): Promise<{ contacts: Contact[] }> {
  return requestJson("/api/workspace/contacts");
}

export async function createContact(input: ContactInput): Promise<{ contact: Contact }> {
  return requestJson("/api/workspace/contacts", {
    method: "POST",
    body: input
  });
}

export async function updateContact(
  contactId: string,
  input: ContactUpdateInput
): Promise<{ contact: Contact }> {
  return requestJson(`/api/workspace/contacts/${encodePathSegment(contactId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function fetchProjectTypes(): Promise<{ projectTypes: ProjectType[] }> {
  return requestJson("/api/workspace/project-types");
}

export async function createProjectType(
  input: ProjectTypeInput
): Promise<{ projectType: ProjectType }> {
  return requestJson("/api/workspace/project-types", {
    method: "POST",
    body: input
  });
}

export async function updateProjectType(
  projectTypeId: string,
  input: ProjectTypeUpdateInput
): Promise<{ projectType: ProjectType }> {
  return requestJson(
    `/api/workspace/project-types/${encodePathSegment(projectTypeId)}`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function fetchDealStages(): Promise<{ dealStages: DealStage[] }> {
  return requestJson("/api/workspace/deal-stages");
}

export async function createDealStage(
  input: DealStageInput
): Promise<{ dealStage: DealStage }> {
  return requestJson("/api/workspace/deal-stages", {
    method: "POST",
    body: input
  });
}

export async function updateDealStage(
  stageId: string,
  input: DealStageUpdateInput
): Promise<{ dealStage: DealStage }> {
  return requestJson(`/api/workspace/deal-stages/${encodePathSegment(stageId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function fetchOpportunities(): Promise<{ opportunities: Opportunity[] }> {
  return requestJson("/api/workspace/opportunities");
}

export async function fetchOpportunity(
  opportunityId: string
): Promise<{ opportunity: Opportunity }> {
  return requestJson(`/api/workspace/opportunities/${encodePathSegment(opportunityId)}`);
}

export async function createOpportunity(
  input: OpportunityInput
): Promise<{ opportunity: Opportunity }> {
  return requestJson("/api/workspace/opportunities", {
    method: "POST",
    body: input
  });
}

export async function updateOpportunity(
  opportunityId: string,
  input: OpportunityUpdateInput
): Promise<{ opportunity: Opportunity }> {
  return requestJson(`/api/workspace/opportunities/${encodePathSegment(opportunityId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function checkOpportunityFeasibility(
  opportunityId: string
): Promise<{ opportunity: Opportunity; assessment: OpportunityFeasibilityAssessment }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/feasibility`,
    {
      method: "POST"
    }
  );
}

export async function updateOpportunityStage(
  opportunityId: string,
  input: OpportunityStageInput
): Promise<{ opportunity: Opportunity }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/stage`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function finalizeOpportunity(
  opportunityId: string,
  input: OpportunityFinalActionInput
): Promise<{ opportunity: Opportunity }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/finalize`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function activateOpportunityProject(
  opportunityId: string,
  input: { id?: string; acceptedRiskReason: string | null }
): Promise<{ project: Project }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/activate`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function fetchOpportunityActivity(
  opportunityId: string
): Promise<OpportunityActivityFeed> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/activity`
  );
}

export async function createOpportunityComment(
  opportunityId: string,
  input: OpportunityCommentInput
): Promise<{ activity: OpportunityActivity }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/comments`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function createOpportunityTask(
  opportunityId: string,
  input: OpportunityTaskInput
): Promise<{ activity: OpportunityActivity }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/tasks`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function updateOpportunityTask(
  opportunityId: string,
  activityId: string,
  input: OpportunityTaskUpdateInput
): Promise<{ activity: OpportunityActivity }> {
  return requestJson(
    `/api/workspace/opportunities/${encodePathSegment(opportunityId)}/tasks/${encodePathSegment(activityId)}`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function fetchProjects(): Promise<{ projects: Project[] }> {
  return requestJson("/api/workspace/projects");
}

export async function fetchProjectDetail(
  projectId: string
): Promise<{ project: Project; tasks: Task[] }> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}`);
}

export async function fetchProjectTasks(
  projectId: string
): Promise<{ tasks: Task[] }> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}/tasks`);
}

export async function fetchMyWork(): Promise<{ tasks: Task[] }> {
  return requestJson("/api/workspace/my-work");
}

export async function createProjectTask(
  projectId: string,
  input: TaskInput
): Promise<{ task: Task }> {
  return requestJson(`/api/workspace/projects/${encodePathSegment(projectId)}/tasks`, {
    method: "POST",
    body: input
  });
}

async function requestJson<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "same-origin"
  };

  if (options.body !== undefined) {
    init.headers = {
      "content-type": "application/json",
      "x-kiss-pm-action": "same-origin"
    };
    init.body = JSON.stringify(options.body);
  } else if (init.method && init.method !== "GET") {
    init.headers = {
      "x-kiss-pm-action": "same-origin"
    };
  }

  const response = await fetch(path, init);

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const errorCode =
      errorPayload &&
      typeof errorPayload === "object" &&
      "error" in errorPayload &&
      typeof errorPayload.error === "string"
        ? errorPayload.error
        : `${path} failed: ${response.status}`;

    throw new ApiError(path, response.status, errorCode);
  }

  return response.json() as Promise<T>;
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
