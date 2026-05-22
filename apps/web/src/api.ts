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

export type ProductType = "service" | "goods";

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  sku: string | null;
  type: ProductType;
  unit: string;
  price: number;
  description: string | null;
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
export type ProductInput = Pick<
  Product,
  "id" | "name" | "sku" | "type" | "unit" | "price" | "description"
>;
export type ProductUpdateInput = Pick<
  Product,
  "name" | "sku" | "type" | "unit" | "price" | "description" | "status"
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
  ownerUserId: string | null;
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

export type TaskStatus = "new" | "waiting" | "in_progress" | "review" | "done";
export type TaskStatusDefinitionStatus = "active" | "archived";
export type TaskStatusDefinition = {
  id: string;
  tenantId: string;
  name: string;
  category: TaskStatus;
  sortOrder: number;
  status: TaskStatusDefinitionStatus;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};
export type TaskStatusDefinitionInput = {
  id?: string;
  name: string;
  category: TaskStatus;
  sortOrder: number;
  status?: TaskStatusDefinitionStatus;
};
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
  statusId: string;
  statusName: string;
  statusCategory: TaskStatus;
  priority: TaskPriority;
  requesterUserId: string;
  ownerUserId: string;
  plannedStart: string;
  plannedFinish: string;
  durationWorkingDays: number;
  plannedWork: number;
  actualWork: number;
  progress: number;
  requiresAcceptance: boolean;
  source: "manual";
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  participants: TaskParticipant[];
};

export type TaskInput = {
  id?: string | undefined;
  title: string;
  description: string;
  priority: TaskPriority;
  plannedStart: string;
  plannedFinish: string;
  statusId?: string;
  durationWorkingDays: number;
  plannedWork: number;
  requiresAcceptance: boolean;
  participants: TaskParticipant[];
};
export type TaskUpdateInput = Omit<TaskInput, "id"> & {
  statusId: string;
  clientUpdatedAt: string;
};

export type TaskStatusInput = {
  statusId: string;
};

export type TaskActivity = {
  id: string;
  tenantId: string;
  taskId: string;
  type: "comment" | "file" | "system";
  body: string | null;
  title: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  authorUserId: string;
  createdAt: string;
};

export type OpportunityInput = {
  id?: string;
  clientId: string;
  primaryContactId: string;
  ownerUserId?: string | null;
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

export type CrmActivityEntityType = "opportunity" | "client" | "contact" | "product";
export type CrmActivityType = "comment" | "task" | "file";
export type CrmActivityStatus = "todo" | "done";

export type CrmActivity = {
  id: string;
  tenantId: string;
  entityType: CrmActivityEntityType;
  entityId: string;
  type: CrmActivityType;
  title: string | null;
  body: string | null;
  status: CrmActivityStatus | null;
  dueDate: string | null;
  assigneeUserId: string | null;
  authorUserId: string;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmSystemEvent = {
  id: string;
  actorUserId: string;
  actionType: string;
  sourceWorkflow: string | null;
  createdAt: string;
  executionStatus: unknown;
};

export type CrmActivityFeed = {
  activities: CrmActivity[];
  systemEvents: CrmSystemEvent[];
  canReadRawAudit: boolean;
  auditEvents: AuditEvent[] | null;
};

export type CrmCommentInput = {
  body: string;
};

export type CrmTaskInput = {
  title: string;
  body?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
};

export type CrmFileInput = {
  title: string;
  fileUrl: string;
  body?: string | null;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
};

export type CrmTaskUpdateInput = {
  status: CrmActivityStatus;
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

export async function fetchProducts(): Promise<{ products: Product[] }> {
  return requestJson("/api/workspace/products");
}

export async function createProduct(input: ProductInput): Promise<{ product: Product }> {
  return requestJson("/api/workspace/products", {
    method: "POST",
    body: input
  });
}

export async function updateProduct(
  productId: string,
  input: ProductUpdateInput
): Promise<{ product: Product }> {
  return requestJson(`/api/workspace/products/${encodePathSegment(productId)}`, {
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

export async function fetchCrmActivity(
  entityType: CrmActivityEntityType,
  entityId: string
): Promise<CrmActivityFeed> {
  return requestJson(
    `/api/workspace/crm/${encodePathSegment(entityType)}/${encodePathSegment(entityId)}/activity`
  );
}

export async function createCrmComment(
  entityType: CrmActivityEntityType,
  entityId: string,
  input: CrmCommentInput
): Promise<{ activity: CrmActivity }> {
  return requestJson(
    `/api/workspace/crm/${encodePathSegment(entityType)}/${encodePathSegment(entityId)}/comments`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function createCrmTask(
  entityType: CrmActivityEntityType,
  entityId: string,
  input: CrmTaskInput
): Promise<{ activity: CrmActivity }> {
  return requestJson(
    `/api/workspace/crm/${encodePathSegment(entityType)}/${encodePathSegment(entityId)}/tasks`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function createCrmFile(
  entityType: CrmActivityEntityType,
  entityId: string,
  input: CrmFileInput
): Promise<{ activity: CrmActivity }> {
  return requestJson(
    `/api/workspace/crm/${encodePathSegment(entityType)}/${encodePathSegment(entityId)}/files`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function updateCrmTask(
  entityType: CrmActivityEntityType,
  entityId: string,
  activityId: string,
  input: CrmTaskUpdateInput
): Promise<{ activity: CrmActivity }> {
  return requestJson(
    `/api/workspace/crm/${encodePathSegment(entityType)}/${encodePathSegment(entityId)}/tasks/${encodePathSegment(activityId)}`,
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

export async function fetchTaskStatuses(): Promise<{
  taskStatuses: TaskStatusDefinition[];
}> {
  return requestJson("/api/workspace/task-statuses");
}

export async function createTaskStatus(
  input: TaskStatusDefinitionInput
): Promise<{ taskStatus: TaskStatusDefinition }> {
  return requestJson("/api/workspace/task-statuses", {
    method: "POST",
    body: input
  });
}

export async function updateTaskStatusDefinition(
  statusId: string,
  input: TaskStatusDefinitionInput
): Promise<{ taskStatus: TaskStatusDefinition }> {
  return requestJson(
    `/api/workspace/task-statuses/${encodePathSegment(statusId)}`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function archiveTaskStatus(
  statusId: string
): Promise<{ taskStatus: TaskStatusDefinition }> {
  return requestJson(`/api/workspace/task-statuses/${encodePathSegment(statusId)}`, {
    method: "DELETE"
  });
}

export async function fetchTaskDetail(
  taskId: string
): Promise<{ task: Task; activities: TaskActivity[] }> {
  return requestJson(`/api/workspace/tasks/${encodePathSegment(taskId)}`);
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

export async function updateProjectTask(
  taskId: string,
  input: TaskUpdateInput
): Promise<{ task: Task }> {
  return requestJson(`/api/workspace/tasks/${encodePathSegment(taskId)}`, {
    method: "PATCH",
    body: input
  });
}

export async function archiveTask(taskId: string): Promise<{ task: Task }> {
  return requestJson(`/api/workspace/tasks/${encodePathSegment(taskId)}`, {
    method: "DELETE"
  });
}

export async function updateProjectTaskStatus(
  projectId: string,
  taskId: string,
  input: TaskStatusInput
): Promise<{ task: Task }> {
  return requestJson(
    `/api/workspace/projects/${encodePathSegment(projectId)}/tasks/${encodePathSegment(taskId)}/status`,
    {
      method: "PATCH",
      body: input
    }
  );
}

export async function fetchTaskActivity(
  taskId: string
): Promise<{ activities: TaskActivity[] }> {
  return requestJson(`/api/workspace/tasks/${encodePathSegment(taskId)}/activity`);
}

export async function createTaskComment(
  taskId: string,
  input: { body: string }
): Promise<{ activity: TaskActivity }> {
  return requestJson(`/api/workspace/tasks/${encodePathSegment(taskId)}/comments`, {
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
