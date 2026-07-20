type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type RouteDoc = {
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth?: "public" | "session" | "dev";
  body?: "json" | "multipart" | "none";
  response?: "json" | "file" | "event-stream";
  requestSchema?: string;
  successSchema?: string;
  errorSchema?: string;
  successStatus?: 200 | 201 | 202;
  queryParameters?: Array<Record<string, unknown>>;
  availability?: "always" | "test-hooks";
  /** Route-specific non-default error responses (e.g. 429/503) merged over the shared error set. */
  additionalResponses?: Record<string, { description: string; schema: string }>;
};

const routeDocs: RouteDoc[] = [
  { method: "get", path: "/api/openapi.json", tag: "API docs", summary: "OpenAPI 3.1 document", auth: "public" },
  { method: "get", path: "/api/docs", tag: "API docs", summary: "Scalar API reference", auth: "public" },
  { method: "get", path: "/health", tag: "Health", summary: "Public health probe", auth: "public" },
  { method: "get", path: "/health/live", tag: "Health", summary: "Public liveness probe", auth: "public" },
  { method: "get", path: "/health/ready", tag: "Health", summary: "Public readiness probe", auth: "public" },
  { method: "get", path: "/api/health/live", tag: "Health", summary: "API liveness probe", auth: "public" },
  { method: "get", path: "/api/health/ready", tag: "Health", summary: "API readiness probe", auth: "public" },
  { method: "get", path: "/api/health/realtime", tag: "Health", summary: "Realtime planning readiness", auth: "public" },
  { method: "post", path: "/api/auth/login", tag: "Auth", summary: "Create browser session", auth: "public", requestSchema: "LoginRequest", successSchema: "AuthSessionResponse" },
  { method: "post", path: "/api/auth/register", tag: "Auth", summary: "Register new tenant and owner", auth: "public", requestSchema: "RegisterRequest", successSchema: "AuthSessionResponse", successStatus: 201 },
  { method: "post", path: "/api/auth/password-reset/request", tag: "Auth", summary: "Request password reset", auth: "public", requestSchema: "PasswordResetRequest", successSchema: "OkResponse", successStatus: 202 },
  { method: "post", path: "/api/auth/password-reset/confirm", tag: "Auth", summary: "Confirm password reset", auth: "public", requestSchema: "PasswordResetConfirmRequest", successSchema: "OkResponse" },
  { method: "post", path: "/api/auth/invitation/accept", tag: "Auth", summary: "Accept a workspace invitation and set the initial password", description: "Public invitation acceptance: the invited employee sets their own password with the raw invitation token (same token contract as password-reset/confirm) and activates the inactive account created by POST /api/workspace/invitations.", auth: "public", requestSchema: "WorkspaceInvitationAcceptRequest", successSchema: "OkResponse" },
  { method: "post", path: "/api/auth/logout", tag: "Auth", summary: "Delete browser session", successSchema: "OkResponse" },
  { method: "get", path: "/api/auth/me", tag: "Auth", summary: "Current authenticated user", successSchema: "AuthMeResponse" },
  { method: "get", path: "/api/auth/sessions", tag: "Auth", summary: "List active sessions for current user" },
  { method: "delete", path: "/api/auth/sessions/:sessionId", tag: "Auth", summary: "Revoke a session of current user" },
  { method: "get", path: "/api/session/dev-users", tag: "Dev session", summary: "List deterministic dev users", auth: "dev", successSchema: "DevUsersResponse" },
  { method: "get", path: "/api/session/dev-login", tag: "Dev session", summary: "Create dev session", auth: "dev" },
  { method: "get", path: "/api/tenant/current", tag: "Tenant", summary: "Current tenant and dev user", auth: "dev", successSchema: "CurrentTenantResponse" },
  { method: "get", path: "/api/tenant/:tenantId/users", tag: "Tenant", summary: "Tenant users for dev route", auth: "dev", successSchema: "TenantUsersResponse" },
  { method: "get", path: "/api/tenant/current/access-profiles", tag: "Access control", summary: "List access profiles", successSchema: "AccessProfilesResponse" },
  { method: "post", path: "/api/tenant/current/access-profiles", tag: "Access control", summary: "Create access profile", requestSchema: "AccessProfileWriteRequest", successSchema: "AccessProfileResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/access-roles", tag: "Access control", summary: "List workspace access roles", successSchema: "AccessProfilesResponse" },
  { method: "get", path: "/api/workspace/permission-catalog", tag: "Access control", summary: "List assignable permission catalog" },
  { method: "patch", path: "/api/workspace/access-roles/:roleId", tag: "Access control", summary: "Update workspace access role", requestSchema: "AccessProfileWriteRequest", successSchema: "AccessProfileResponse" },
  { method: "delete", path: "/api/workspace/access-roles/:roleId", tag: "Access control", summary: "Archive workspace access role", body: "none", successSchema: "OkResponse" },
  { method: "get", path: "/api/tenant/current/audit-events", tag: "Audit", summary: "List tenant audit events", successSchema: "AuditEventsResponse", queryParameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } }] },
  { method: "get", path: "/api/tenant/current/audit-events/:auditEventId", tag: "Audit", summary: "Read a single tenant audit event by id (addressable agent receipts do not depend on the list window)" },
  { method: "get", path: "/api/workspace/users", tag: "Workspace users", summary: "List workspace users", successSchema: "WorkspaceUsersResponse" },
  { method: "post", path: "/api/workspace/users", tag: "Workspace users", summary: "Create workspace user", requestSchema: "WorkspaceUserCreateRequest", successSchema: "WorkspaceUserResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/users/:userId", tag: "Workspace users", summary: "Update workspace user", requestSchema: "WorkspaceUserPatchRequest", successSchema: "WorkspaceUserResponse" },
  { method: "post", path: "/api/workspace/users/:userId/password-reset-token", tag: "Workspace users", summary: "Issue password reset token for a workspace user", description: "Admin-issued password reset token for installations without email delivery. The raw token is returned exactly once in this response; only its hash is persisted and the audit trail records issuance without the token. Requires an authenticated KISS PM browser session. Browser mutations must also send `x-kiss-pm-action: same-origin` from a trusted origin.", body: "none", successSchema: "WorkspaceUserResetTokenResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/users/:userId", tag: "Workspace users", summary: "Archive workspace user", body: "none" },
  { method: "post", path: "/api/workspace/invitations", tag: "Workspace users", summary: "Invite a workspace user", description: "Creates an inactive workspace user and issues a single-use invitation token. When installation email delivery is configured the token is emailed (delivery:\"email\"); otherwise the raw token is returned exactly once (delivery:\"none\") so an admin can hand it over. Only the token hash is persisted and the audit trail records the invitation without the raw token. Requires an authenticated KISS PM browser session with `x-kiss-pm-action: same-origin`.", requestSchema: "WorkspaceInvitationRequest", successSchema: "WorkspaceInvitationResponse", successStatus: 201 },
  { method: "patch", path: "/api/profile", tag: "Profile", summary: "Update current profile", requestSchema: "ProfilePatchRequest", successSchema: "WorkspaceUserResponse" },
  { method: "patch", path: "/api/profile/theme", tag: "Profile", summary: "Update current theme preference", requestSchema: "ProfileThemePatchRequest", successSchema: "WorkspaceUserResponse" },
  { method: "post", path: "/api/profile/deactivation-request", tag: "Profile", summary: "Record current profile deactivation request", body: "none", successSchema: "ProfileDeactivationRequestResponse", successStatus: 202 },
  { method: "get", path: "/api/workspace/positions", tag: "Org structure", summary: "List positions", successSchema: "PositionsResponse" },
  { method: "post", path: "/api/workspace/positions", tag: "Org structure", summary: "Create position", requestSchema: "PositionWriteRequest", successSchema: "PositionResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/positions/:positionId", tag: "Org structure", summary: "Update position", requestSchema: "PositionWriteRequest", successSchema: "PositionResponse" },
  { method: "delete", path: "/api/workspace/positions/:positionId", tag: "Org structure", summary: "Archive position", body: "none" },
  { method: "get", path: "/api/tenant/current/org-structure", tag: "Org structure", summary: "Read tenant org structure", successSchema: "TenantOrgStructureResponse" },
  { method: "put", path: "/api/tenant/current/org-structure", tag: "Org structure", summary: "Replace tenant org structure", requestSchema: "TenantOrgStructureReplaceRequest", successSchema: "TenantOrgStructureResponse" },
  { method: "get", path: "/api/workspace/config/custom-fields", tag: "Workspace config", summary: "List custom fields", successSchema: "CustomFieldsResponse" },
  { method: "post", path: "/api/workspace/config/custom-fields", tag: "Workspace config", summary: "Create custom field", requestSchema: "CustomFieldWriteRequest", successSchema: "CustomFieldResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/config/custom-fields/:fieldId", tag: "Workspace config", summary: "Update custom field", requestSchema: "CustomFieldWriteRequest", successSchema: "CustomFieldResponse" },
  { method: "delete", path: "/api/workspace/config/custom-fields/:fieldId", tag: "Workspace config", summary: "Delete custom field", body: "none" },
  { method: "get", path: "/api/workspace/config/project-templates", tag: "Workspace config", summary: "List project templates", successSchema: "ProjectTemplatesResponse" },
  { method: "post", path: "/api/workspace/config/project-templates", tag: "Workspace config", summary: "Create project template", requestSchema: "ProjectTemplateWriteRequest", successSchema: "ProjectTemplateResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/config/project-templates/:templateId", tag: "Workspace config", summary: "Update project template", requestSchema: "ProjectTemplateWriteRequest", successSchema: "ProjectTemplateResponse" },
  { method: "get", path: "/api/tenant/current/security-policy", tag: "Workspace config", summary: "Read tenant security policy" },
  { method: "put", path: "/api/tenant/current/security-policy", tag: "Workspace config", summary: "Replace tenant security policy" },
  { method: "get", path: "/api/workspace/clients", tag: "CRM", summary: "List clients", successSchema: "ClientsResponse" },
  { method: "post", path: "/api/workspace/clients", tag: "CRM", summary: "Create client", requestSchema: "ClientWriteRequest", successSchema: "ClientResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/clients/:clientId", tag: "CRM", summary: "Update client", requestSchema: "ClientWriteRequest", successSchema: "ClientResponse" },
  { method: "get", path: "/api/workspace/contacts", tag: "CRM", summary: "List contacts", successSchema: "ContactsResponse" },
  { method: "post", path: "/api/workspace/contacts", tag: "CRM", summary: "Create contact", requestSchema: "ContactWriteRequest", successSchema: "ContactResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/contacts/:contactId", tag: "CRM", summary: "Update contact", requestSchema: "ContactWriteRequest", successSchema: "ContactResponse" },
  { method: "get", path: "/api/workspace/products", tag: "CRM", summary: "List products and services", successSchema: "ProductsResponse" },
  { method: "post", path: "/api/workspace/products", tag: "CRM", summary: "Create product or service", requestSchema: "ProductWriteRequest", successSchema: "ProductResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/products/:productId", tag: "CRM", summary: "Update product or service", requestSchema: "ProductWriteRequest", successSchema: "ProductResponse" },
  { method: "get", path: "/api/workspace/project-types", tag: "CRM", summary: "List project types", successSchema: "ProjectTypesResponse" },
  { method: "post", path: "/api/workspace/project-types", tag: "CRM", summary: "Create project type", requestSchema: "ProjectTypeWriteRequest", successSchema: "ProjectTypeResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/project-types/:projectTypeId", tag: "CRM", summary: "Update project type", requestSchema: "ProjectTypeWriteRequest", successSchema: "ProjectTypeResponse" },
  { method: "get", path: "/api/workspace/deal-stages", tag: "CRM", summary: "List deal stages", successSchema: "DealStagesResponse" },
  { method: "post", path: "/api/workspace/deal-stages", tag: "CRM", summary: "Create deal stage", requestSchema: "DealStageWriteRequest", successSchema: "DealStageResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/deal-stages/:stageId", tag: "CRM", summary: "Update deal stage", requestSchema: "DealStageWriteRequest", successSchema: "DealStageResponse" },
  { method: "get", path: "/api/workspace/pipelines", tag: "CRM", summary: "List pipelines", successSchema: "PipelinesResponse" },
  { method: "post", path: "/api/workspace/pipelines", tag: "CRM", summary: "Create pipeline", requestSchema: "PipelineWriteRequest", successSchema: "PipelineResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/pipelines/:pipelineId", tag: "CRM", summary: "Update pipeline", requestSchema: "PipelineWriteRequest", successSchema: "PipelineResponse" },
  { method: "get", path: "/api/workspace/pipelines/:pipelineId/stage-transitions", tag: "CRM", summary: "List pipeline stage transitions", successSchema: "StageTransitionsResponse" },
  { method: "post", path: "/api/workspace/pipelines/:pipelineId/stage-transitions", tag: "CRM", summary: "Create pipeline stage transition", requestSchema: "StageTransitionWriteRequest", successSchema: "StageTransitionResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/pipelines/:pipelineId/stage-transitions/:transitionId", tag: "CRM", summary: "Delete pipeline stage transition", body: "none", successSchema: "OkResponse" },
  { method: "get", path: "/api/workspace/crm/pipelines", tag: "CRM", summary: "List CRM pipelines", successSchema: "CrmPipelinesResponse" },
  { method: "post", path: "/api/workspace/crm/pipelines", tag: "CRM", summary: "Create CRM pipeline", requestSchema: "CrmPipelineWriteRequest", successSchema: "CrmPipelineResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/crm/pipelines/:pipelineId", tag: "CRM", summary: "Update CRM pipeline", requestSchema: "CrmPipelinePatchRequest", successSchema: "CrmPipelineResponse" },
  { method: "get", path: "/api/workspace/crm/pipelines/:pipelineId/stages", tag: "CRM", summary: "List CRM pipeline stages", successSchema: "CrmPipelineStagesResponse" },
  { method: "post", path: "/api/workspace/crm/pipelines/:pipelineId/stages", tag: "CRM", summary: "Create CRM pipeline stage", requestSchema: "CrmPipelineStageWriteRequest", successSchema: "CrmPipelineStageResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/crm/pipelines/:pipelineId/stages/:stageId", tag: "CRM", summary: "Update CRM pipeline stage", requestSchema: "CrmPipelineStagePatchRequest", successSchema: "CrmPipelineStageResponse" },
  { method: "get", path: "/api/workspace/crm/pipelines/:pipelineId/transition-rules", tag: "CRM", summary: "List CRM pipeline transition rules", successSchema: "CrmPipelineTransitionRulesResponse" },
  { method: "post", path: "/api/workspace/crm/pipelines/:pipelineId/transition-rules", tag: "CRM", summary: "Create CRM pipeline transition rule", requestSchema: "CrmPipelineTransitionRuleWriteRequest", successSchema: "CrmPipelineTransitionRuleResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/crm/pipelines/:pipelineId/transition-rules/:ruleId", tag: "CRM", summary: "Update CRM pipeline transition rule", requestSchema: "CrmPipelineTransitionRulePatchRequest", successSchema: "CrmPipelineTransitionRuleResponse" },
  { method: "get", path: "/api/workspace/crm/pipelines/:pipelineId/automations", tag: "CRM", summary: "List CRM pipeline stage automations", successSchema: "CrmPipelineStageAutomationsResponse" },
  { method: "post", path: "/api/workspace/crm/pipelines/:pipelineId/automations", tag: "CRM", summary: "Create CRM pipeline stage automation", requestSchema: "CrmPipelineStageAutomationWriteRequest", successSchema: "CrmPipelineStageAutomationResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/crm/pipelines/:pipelineId/automations/:automationId", tag: "CRM", summary: "Update CRM pipeline stage automation", requestSchema: "CrmPipelineStageAutomationPatchRequest", successSchema: "CrmPipelineStageAutomationResponse" },
  { method: "get", path: "/api/workspace/opportunities", tag: "Project intake", summary: "List opportunities", successSchema: "OpportunitiesResponse" },
  { method: "get", path: "/api/workspace/opportunities/:opportunityId", tag: "Project intake", summary: "Read opportunity", successSchema: "OpportunityResponse" },
  { method: "post", path: "/api/workspace/opportunities", tag: "Project intake", summary: "Create opportunity", requestSchema: "OpportunityWriteRequest", successSchema: "OpportunityResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/opportunities/:opportunityId", tag: "Project intake", summary: "Update opportunity", requestSchema: "OpportunityWriteRequest", successSchema: "OpportunityResponse" },
  { method: "patch", path: "/api/workspace/opportunities/:opportunityId/stage", tag: "Project intake", summary: "Move opportunity stage", requestSchema: "OpportunityStagePatchRequest", successSchema: "OpportunityResponse" },
  { method: "patch", path: "/api/workspace/opportunities/:opportunityId/pipeline", tag: "Project intake", summary: "Move opportunity to another pipeline", requestSchema: "OpportunityPipelinePatchRequest", successSchema: "OpportunityResponse" },
  { method: "patch", path: "/api/workspace/opportunities/:opportunityId/finalize", tag: "Project intake", summary: "Finalize opportunity", requestSchema: "OpportunityFinalizeRequest", successSchema: "OpportunityResponse" },
  { method: "post", path: "/api/workspace/opportunities/:opportunityId/feasibility", tag: "Project intake", summary: "Preview resource feasibility", successSchema: "OpportunityFeasibilityResponse" },
  { method: "post", path: "/api/workspace/opportunities/:opportunityId/activate", tag: "Project intake", summary: "Activate project from opportunity", requestSchema: "ProjectActivationRequest", successSchema: "ProjectActivationResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/projects", tag: "Projects and tasks", summary: "List projects", successSchema: "ProjectsResponse", queryParameters: [{ name: "status", in: "query", required: false, schema: { type: "string", enum: ["active", "closed", "paused", "all"], default: "active" } }] },
  { method: "post", path: "/api/workspace/projects", tag: "Projects and tasks", summary: "Create internal project without an opportunity", requestSchema: "ProjectCreateRequest", successSchema: "ProjectActivationResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/projects/:projectId", tag: "Projects and tasks", summary: "Update project settings (title/type/template/calendar)", requestSchema: "ProjectUpdateRequest", successSchema: "ProjectActivationResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/reopen", tag: "Projects and tasks", summary: "Reopen a closed project", body: "none", successSchema: "ProjectActivationResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/pause", tag: "Projects and tasks", summary: "Pause an active project", body: "none", successSchema: "ProjectActivationResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/resume", tag: "Projects and tasks", summary: "Resume a paused project", body: "none", successSchema: "ProjectActivationResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId", tag: "Projects and tasks", summary: "Read project detail", successSchema: "ProjectDetailResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/tasks", tag: "Projects and tasks", summary: "List project tasks", successSchema: "TasksResponse" },
  { method: "get", path: "/api/workspace/my-work", tag: "Projects and tasks", summary: "List current user's work", successSchema: "TasksResponse" },
  { method: "get", path: "/api/workspace/tasks/:taskId", tag: "Projects and tasks", summary: "Read task", successSchema: "TaskDetailResponse" },
  { method: "post", path: "/api/workspace/tasks", tag: "Projects and tasks", summary: "Create task in default/projectless container", requestSchema: "TaskCreateRequest", successSchema: "TaskResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/projects/:projectId/tasks", tag: "Projects and tasks", summary: "Create project task", requestSchema: "TaskCreateRequest", successSchema: "TaskResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/tasks/:taskId", tag: "Projects and tasks", summary: "Update task", requestSchema: "TaskUpdateRequest", successSchema: "TaskResponse" },
  { method: "delete", path: "/api/workspace/tasks/:taskId", tag: "Projects and tasks", summary: "Archive task", body: "none", successSchema: "TaskResponse" },
  { method: "patch", path: "/api/workspace/projects/:projectId/tasks/:taskId/status", tag: "Projects and tasks", summary: "Transition task status", requestSchema: "TaskStatusTransitionRequest", successSchema: "TaskResponse" },
  { method: "get", path: "/api/workspace/tasks/:taskId/activity", tag: "Projects and tasks", summary: "List task activity", successSchema: "TaskActivityResponse" },
  { method: "post", path: "/api/workspace/tasks/:taskId/comments", tag: "Projects and tasks", summary: "Create task comment", requestSchema: "TaskCommentCreateRequest", successSchema: "TaskActivityItemResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/task-statuses", tag: "Projects and tasks", summary: "List task statuses", successSchema: "TaskStatusesResponse" },
  { method: "post", path: "/api/workspace/task-statuses", tag: "Projects and tasks", summary: "Create task status", requestSchema: "TaskStatusWriteRequest", successSchema: "TaskStatusResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/task-statuses/:statusId", tag: "Projects and tasks", summary: "Update task status", requestSchema: "TaskStatusWriteRequest", successSchema: "TaskStatusResponse" },
  { method: "delete", path: "/api/workspace/task-statuses/:statusId", tag: "Projects and tasks", summary: "Archive task status", body: "none", successSchema: "TaskStatusResponse" },
  { method: "get", path: "/api/workspace/crm/:entityType/:entityId/activity", tag: "Activity", summary: "List CRM entity activity", successSchema: "CrmActivityFeedResponse" },
  { method: "post", path: "/api/workspace/crm/:entityType/:entityId/comments", tag: "Activity", summary: "Create CRM comment", requestSchema: "CrmCommentCreateRequest", successSchema: "CrmActivityItemResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/crm/:entityType/:entityId/tasks", tag: "Activity", summary: "Create CRM follow-up task", requestSchema: "CrmTaskCreateRequest", successSchema: "CrmActivityItemResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/crm/:entityType/:entityId/files", tag: "Activity", summary: "Create legacy CRM file activity", requestSchema: "CrmFileActivityCreateRequest", successSchema: "CrmActivityItemResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/crm/:entityType/:entityId/tasks/:activityId", tag: "Activity", summary: "Update CRM activity task", requestSchema: "CrmTaskStatusPatchRequest", successSchema: "CrmActivityItemResponse" },
  { method: "get", path: "/api/workspace/attachments", tag: "Storage and search", summary: "List entity attachments", successSchema: "AttachmentsResponse", queryParameters: [{ name: "entityType", in: "query", required: true, schema: { $ref: "#/components/schemas/AttachmentEntityType" } }, { name: "entityId", in: "query", required: true, schema: { type: "string", minLength: 1 } }] },
  { method: "post", path: "/api/workspace/attachments/external-references", tag: "Storage and search", summary: "Attach external reference", requestSchema: "ExternalReferenceAttachRequest", successSchema: "AttachmentResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/attachments/files", tag: "Storage and search", summary: "Attach uploaded file", body: "multipart", requestSchema: "FileAttachmentMultipartRequest", successSchema: "AttachmentResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/attachments/:attachmentId", tag: "Storage and search", summary: "Archive attachment", body: "none", successSchema: "AttachmentResponse" },
  { method: "get", path: "/api/workspace/attachments/:attachmentId/download", tag: "Storage and search", summary: "Download attachment", response: "file" },
  { method: "get", path: "/api/workspace/search", tag: "Storage and search", summary: "Unified metadata search", successSchema: "WorkspaceSearchResponse", queryParameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 120 } }, { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 20, default: 20 } }, { name: "types", in: "query", required: false, schema: { type: "string", description: "Comma-separated SearchResultType values." } }] },
  { method: "get", path: "/api/workspace/projects/:projectId/planning/read-model", tag: "Planning", summary: "Read planning model", successSchema: "PlanningReadModelResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/preview-command", tag: "Planning", summary: "Preview planning command", requestSchema: "PlanningCommandEnvelope", successSchema: "PlanningCommandPreviewResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/preview-command-batch", tag: "Planning", summary: "Preview planning command batch", requestSchema: "PlanningCommandBatchEnvelope", successSchema: "PlanningCommandPreviewResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/apply-command", tag: "Planning", summary: "Apply planning command", requestSchema: "PlanningCommandEnvelope", successSchema: "PlanningApplyResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/apply-command-batch", tag: "Planning", summary: "Apply planning command batch", requestSchema: "PlanningCommandBatchEnvelope", successSchema: "PlanningApplyResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/revert-last", tag: "Planning", summary: "Revert a specific planning commit", requestSchema: "PlanningRevertRequest", successSchema: "PlanningRevertResponse", errorSchema: "PlanningRevertErrorResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/test/bump-plan-version", tag: "Planning", summary: "Test-only plan version bump", auth: "dev", successSchema: "PlanningPlanVersionBumpResponse", availability: "test-hooks" },
  { method: "get", path: "/api/workspace/projects/:projectId/planning/baselines", tag: "Planning", summary: "List planning baselines", successSchema: "PlanningBaselinesResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/scenarios/preview", tag: "Planning", summary: "Preview planning scenario", requestSchema: "PlanningScenarioPreviewRequest", successSchema: "PlanningScenarioPreviewResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/scenario-proposals", tag: "Planning", summary: "Create planning scenario proposal", requestSchema: "PlanningScenarioPreviewRequest", successSchema: "PlanningScenarioPreviewResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/scenarios/:scenarioId/apply", tag: "Planning", summary: "Apply planning scenario", requestSchema: "PlanningScenarioApplyRequest", successSchema: "PlanningScenarioApplyResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/scenario-proposals/:proposalId/apply", tag: "Planning", summary: "Apply planning scenario proposal", requestSchema: "PlanningScenarioApplyRequest", successSchema: "PlanningScenarioApplyResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/scenarios/:scenarioId/reject", tag: "Planning", summary: "Reject planning scenario", requestSchema: "PlanningScenarioRejectRequest", successSchema: "PlanningScenarioRejectResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/planning/events", tag: "Planning", summary: "Planning realtime event stream", response: "event-stream" },
  { method: "get", path: "/api/workspace/projects/:projectId/planning/commits", tag: "Planning", summary: "List project planning commits", successSchema: "PlanningCommitsResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/planning/saved-views", tag: "Planning", summary: "List planning saved views", successSchema: "PlanningSavedViewsResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/saved-views", tag: "Planning", summary: "Create planning saved view", requestSchema: "PlanningSavedViewCreateRequest", successSchema: "PlanningSavedViewResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/projects/:projectId/planning/saved-views/:viewId", tag: "Planning", summary: "Rename planning saved view", requestSchema: "PlanningSavedViewRenameRequest", successSchema: "PlanningSavedViewResponse" },
  { method: "delete", path: "/api/workspace/projects/:projectId/planning/saved-views/:viewId", tag: "Planning", summary: "Delete planning saved view", requestSchema: "PlanningSavedViewDeleteRequest", successSchema: "OkResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/auto-solver-runs", tag: "Planning", summary: "Create auto-solver run", requestSchema: "PlanningAutoSolverRunCreateRequest", successSchema: "PlanningAutoSolverRunResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId", tag: "Planning", summary: "Read auto-solver run", successSchema: "PlanningAutoSolverRunDetailResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId/proposals/:proposalId/apply", tag: "Planning", summary: "Apply persisted auto-solver proposal", requestSchema: "PlanningScenarioApplyRequest", successSchema: "PlanningApplyResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/planning/auto-solver-runs/:runId/reject", tag: "Planning", summary: "Reject persisted auto-solver run", requestSchema: "PlanningAutoSolverRunRejectRequest", successSchema: "PlanningAutoSolverRunRejectResponse" },
  { method: "get", path: "/api/workspace/capacity/tree", tag: "Capacity", summary: "Tenant resource load tree", successSchema: "CapacityTreeResponse", queryParameters: [{ name: "monthIso", in: "query", required: true, schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" } }, { name: "projectId", in: "query", required: false, schema: { type: "string", minLength: 1 } }] },
  { method: "get", path: "/api/workspace/capacity/summary", tag: "Capacity", summary: "Tenant resource load summary", successSchema: "CapacitySummaryResponse", queryParameters: [{ name: "monthIso", in: "query", required: true, schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" } }] },
  { method: "get", path: "/api/workspace/capacity/drilldown", tag: "Capacity", summary: "Employee day capacity drilldown", successSchema: "CapacityDrilldownResponse", queryParameters: [{ name: "monthIso", in: "query", required: true, schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" } }, { name: "resourceId", in: "query", required: true, schema: { type: "string", minLength: 1 } }, { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } }] },
  { method: "get", path: "/api/tenant/current/production-calendar", tag: "Calendars and occupancy", summary: "Read production calendar", successSchema: "ProductionCalendarResponse", queryParameters: [{ name: "year", in: "query", required: false, schema: { type: "integer", minimum: 2000, maximum: 2100 } }] },
  { method: "post", path: "/api/tenant/current/production-calendar/bulk", tag: "Calendars and occupancy", summary: "Bulk update production calendar", requestSchema: "ProductionCalendarBulkRequest", successSchema: "ProductionCalendarResponse" },
  { method: "patch", path: "/api/tenant/current/production-calendar", tag: "Calendars and occupancy", summary: "Update production calendar base mode (working weekdays and minutes)", requestSchema: "ProductionCalendarBaseModeRequest", successSchema: "ProductionCalendarResponse" },
  { method: "delete", path: "/api/tenant/current/production-calendar/exceptions/:id", tag: "Calendars and occupancy", summary: "Delete a production calendar exception", successSchema: "ProductionCalendarResponse" },
  { method: "get", path: "/api/tenant/current/absences", tag: "Calendars and occupancy", summary: "List resource absences", successSchema: "ResourceAbsencesResponse", queryParameters: [{ name: "fromDate", in: "query", required: true, schema: { type: "string", format: "date" } }, { name: "toDate", in: "query", required: true, schema: { type: "string", format: "date" } }, { name: "userId", in: "query", required: false, schema: { type: "string", minLength: 1 } }] },
  { method: "post", path: "/api/tenant/current/absences", tag: "Calendars and occupancy", summary: "Create resource absence", requestSchema: "ResourceAbsenceCreateRequest", successSchema: "ResourceAbsenceResponse", successStatus: 201 },
  { method: "delete", path: "/api/tenant/current/absences/:id", tag: "Calendars and occupancy", summary: "Delete resource absence", body: "none", successSchema: "OkResponse" },
  { method: "get", path: "/api/workspace/resources/:resourceId/personal-calendar", tag: "Calendars and occupancy", summary: "Read personal calendar", successSchema: "PersonalCalendarResponse", queryParameters: [{ name: "from", in: "query", required: true, schema: { type: "string", format: "date-time" } }, { name: "to", in: "query", required: true, schema: { type: "string", format: "date-time" } }] },
  { method: "post", path: "/api/workspace/resources/:resourceId/personal-calendar/events", tag: "Calendars and occupancy", summary: "Create personal calendar event", requestSchema: "PersonalCalendarEventWriteRequest", successSchema: "PersonalCalendarEventResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/resources/:resourceId/personal-calendar/events/:eventId", tag: "Calendars and occupancy", summary: "Update personal calendar event", requestSchema: "PersonalCalendarEventWriteRequest", successSchema: "PersonalCalendarEventResponse" },
  { method: "delete", path: "/api/workspace/resources/:resourceId/personal-calendar/events/:eventId", tag: "Calendars and occupancy", summary: "Archive personal calendar event", body: "none", successSchema: "OkResponse" },
  { method: "get", path: "/api/workspace/occupancy", tag: "Calendars and occupancy", summary: "Read unified occupancy timeline", successSchema: "OccupancyWindowsResponse", queryParameters: [{ name: "resourceId", in: "query", required: false, schema: { type: "string", minLength: 1 } }, { name: "from", in: "query", required: true, schema: { type: "string", format: "date-time" } }, { name: "to", in: "query", required: true, schema: { type: "string", format: "date-time" } }] },
  { method: "get", path: "/api/tenant/current/kpi-definitions", tag: "KPI and control", summary: "List KPI definitions", successSchema: "KpiDefinitionsResponse" },
  { method: "post", path: "/api/tenant/current/kpi-definitions", tag: "KPI and control", summary: "Create KPI definition", requestSchema: "KpiDefinitionWriteRequest", successSchema: "KpiDefinitionResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/control/read-model", tag: "KPI and control", summary: "Read project control model", successSchema: "ControlReadModelResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/control/evaluate", tag: "KPI and control", summary: "Evaluate project KPI/control signals", successSchema: "ControlEvaluateResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/control/signals/:signalId/actions/:actionId/preview", tag: "KPI and control", summary: "Preview management action", successSchema: "ManagementActionPreviewResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/control/signals/:signalId/actions/:actionId/apply", tag: "KPI and control", summary: "Apply management action", requestSchema: "ManagementActionApplyRequest", successSchema: "ManagementActionApplyResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/control/signals/:signalId/status", tag: "KPI and control", summary: "Update control signal status", requestSchema: "ControlSignalStatusRequest", successSchema: "ControlSignalResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/control/signals/:signalId/corrective-actions", tag: "KPI and control", summary: "Create corrective action", requestSchema: "CorrectiveActionCreateRequest", successSchema: "CorrectiveActionResponse" },
  { method: "patch", path: "/api/workspace/projects/:projectId/control/corrective-actions/:correctiveActionId", tag: "KPI and control", summary: "Update corrective action", requestSchema: "CorrectiveActionPatchRequest", successSchema: "CorrectiveActionResponse" },
  { method: "get", path: "/api/tenant/current/control-surfaces", tag: "Control surfaces", summary: "List control surfaces", successSchema: "ControlSurfacesResponse", queryParameters: [{ name: "includeArchived", in: "query", required: false, schema: { type: "boolean", default: false } }] },
  { method: "get", path: "/api/tenant/current/control-surfaces/presets", tag: "Control surfaces", summary: "List control surface presets", successSchema: "ControlSurfacePresetsResponse" },
  { method: "get", path: "/api/tenant/current/control-surfaces/:surfaceId", tag: "Control surfaces", summary: "Read control surface", successSchema: "ControlSurfaceDetailResponse" },
  { method: "post", path: "/api/tenant/current/control-surfaces", tag: "Control surfaces", summary: "Create control surface draft", requestSchema: "ControlSurfaceDraftSaveRequest", successSchema: "ControlSurfaceDraftSaveResponse", successStatus: 201 },
  { method: "post", path: "/api/tenant/current/control-surfaces/:surfaceId/preview", tag: "Control surfaces", summary: "Preview control surface", requestSchema: "ControlSurfacePreviewRequest", successSchema: "ControlSurfacePreviewResponse" },
  { method: "post", path: "/api/tenant/current/control-surfaces/:surfaceId/publish", tag: "Control surfaces", summary: "Publish control surface", successSchema: "ControlSurfacePublishResponse" },
  { method: "post", path: "/api/tenant/current/control-surfaces/:surfaceId/rollback", tag: "Control surfaces", summary: "Rollback control surface", requestSchema: "ControlSurfaceRollbackRequest", successSchema: "ControlSurfacePublishResponse" },
  { method: "delete", path: "/api/tenant/current/control-surfaces/:surfaceId", tag: "Control surfaces", summary: "Archive control surface", body: "none", successSchema: "ControlSurfaceArchiveResponse" },
  { method: "get", path: "/api/workspace/conversations", tag: "Collaboration", summary: "List conversations", successSchema: "ConversationsResponse", queryParameters: [{ name: "entityType", in: "query", required: true, schema: { $ref: "#/components/schemas/CollaborationEntityType" } }, { name: "entityId", in: "query", required: true, schema: { type: "string", minLength: 1 } }] },
  { method: "get", path: "/api/workspace/conversations/direct", tag: "Collaboration", summary: "List direct (DM) conversations of current user" },
  { method: "post", path: "/api/workspace/conversations/direct", tag: "Collaboration", summary: "Open or get a direct (DM) conversation", successStatus: 201 },
  { method: "get", path: "/api/workspace/conversations/:conversationId/messages", tag: "Collaboration", summary: "List conversation messages", successSchema: "ConversationMessagesResponse", queryParameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }, { name: "cursor", in: "query", required: false, schema: { type: "string", minLength: 1 } }] },
  { method: "post", path: "/api/workspace/conversations/:conversationId/messages", tag: "Collaboration", summary: "Create conversation message", requestSchema: "ConversationMessageCreateRequest", successSchema: "ConversationMessageCreateResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/conversations/:conversationId/messages/:messageId/reactions", tag: "Collaboration", summary: "Create message reaction", requestSchema: "MessageReactionCreateRequest", successSchema: "MessageReactionResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/conversations/:conversationId/messages/:messageId/reactions/:reactionId", tag: "Collaboration", summary: "Delete message reaction", body: "none", successSchema: "MessageReactionResponse" },
  { method: "patch", path: "/api/workspace/conversations/:conversationId/messages/:messageId", tag: "Collaboration", summary: "Edit message", requestSchema: "ConversationMessagePatchRequest", successSchema: "ConversationMessageResponse" },
  { method: "post", path: "/api/workspace/conversations/:conversationId/messages/:messageId/pin", tag: "Collaboration", summary: "Pin message", successSchema: "ConversationMessageResponse" },
  { method: "delete", path: "/api/workspace/conversations/:conversationId/messages/:messageId/pin", tag: "Collaboration", summary: "Unpin message", successSchema: "ConversationMessageResponse" },
  { method: "delete", path: "/api/workspace/conversations/:conversationId/messages/:messageId", tag: "Collaboration", summary: "Delete message", body: "none", successSchema: "ConversationMessageResponse" },
  { method: "post", path: "/api/workspace/conversations/:conversationId/read-state", tag: "Collaboration", summary: "Update conversation read state", successSchema: "ConversationReadStateResponse" },
  { method: "get", path: "/api/workspace/notifications", tag: "Collaboration", summary: "List notifications", successSchema: "NotificationsResponse", queryParameters: [{ name: "status", in: "query", required: false, schema: { type: "string", enum: ["read", "unread"] } }, { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }] },
  { method: "get", path: "/api/workspace/unread-summary", tag: "Collaboration", summary: "Unread summary (notifications + conversation messages)" },
  { method: "post", path: "/api/workspace/notifications/:notificationId/read", tag: "Collaboration", summary: "Mark notification read", successSchema: "NotificationResponse" },
  { method: "get", path: "/api/workspace/agent/tools", tag: "Agent", summary: "List agent tools available to the current user", successSchema: "AgentToolsResponse" },
  { method: "get", path: "/api/workspace/agent/thread", tag: "Agent", summary: "Create-or-get the current user's persistent agent thread (membership-scoped; messages are read via GET /api/workspace/conversations/{conversationId}/messages; client writes are rejected as agent_conversation_readonly)", successSchema: "AgentThreadResponse", additionalResponses: { "501": { description: "Collaboration persistence is not configured (collaboration_not_configured).", schema: "ApiError" } } },
  { method: "post", path: "/api/workspace/agent/propose", tag: "Agent", summary: "Run the agent loop and return proposed actions (no mutation)", requestSchema: "AgentProposeRequest", successSchema: "AgentProposeResponse", additionalResponses: { "403": { description: "threadId is not an agent thread owned by the caller (agent_thread_forbidden), or the mutation guard denied the request.", schema: "ApiError" }, "429": { description: "Concurrent agent runs limit per user reached (agent_busy).", schema: "ApiError" }, "503": { description: "No LLM provider is configured (agent_provider_not_configured).", schema: "AgentProviderNotConfiguredResponse" } } },
  { method: "post", path: "/api/workspace/agent/propose/stream", tag: "Agent", summary: "Run the agent loop and stream reasoning/tool/proposal events (SSE); terminal `done` event carries the full propose result, `error` carries an error payload", response: "event-stream", requestSchema: "AgentProposeRequest", successSchema: "AgentProposeStreamEvent", additionalResponses: { "403": { description: "threadId is not an agent thread owned by the caller (agent_thread_forbidden), or the mutation guard denied the request.", schema: "ApiError" }, "429": { description: "Concurrent agent runs limit per user reached (agent_busy).", schema: "ApiError" }, "503": { description: "No LLM provider is configured (agent_provider_not_configured); returned as JSON before the stream starts.", schema: "AgentProviderNotConfiguredResponse" } } },
  { method: "post", path: "/api/workspace/agent/execute", tag: "Agent", summary: "Apply confirmed agent actions via governed commands; per-item outcomes applied/denied/conflict/failed with audit receipt (correlationId, auditEventId, planningAuditEventId for plan-affecting actions); apply_* actions require explicit clientPlanVersion", requestSchema: "AgentExecuteRequest", successSchema: "AgentExecuteResponse", additionalResponses: { "400": { description: "actions is missing, empty, or longer than 20 items (invalid_actions); item-level validation errors are reported per item with HTTP 200.", schema: "ApiError" } } },
  { method: "get", path: "/api/workspace/realtime/events", tag: "Collaboration", summary: "Workspace realtime event stream (SSE)", response: "event-stream" },
  { method: "get", path: "/api/workspace/presence", tag: "Collaboration", summary: "Presence snapshot of tenant users" },
  { method: "get", path: "/api/workspace/notification-preferences", tag: "Collaboration", summary: "Read notification preferences", successSchema: "NotificationPreferencesResponse" },
  { method: "put", path: "/api/workspace/notification-preferences", tag: "Collaboration", summary: "Replace notification preferences", requestSchema: "NotificationPreferencesReplaceRequest", successSchema: "NotificationPreferencesResponse" },
  { method: "get", path: "/api/workspace/meetings", tag: "Meetings", summary: "List meetings", successSchema: "MeetingsResponse", queryParameters: [{ name: "entityType", in: "query", required: true, schema: { $ref: "#/components/schemas/CollaborationEntityType" } }, { name: "entityId", in: "query", required: true, schema: { type: "string", minLength: 1 } }] },
  { method: "post", path: "/api/workspace/meetings", tag: "Meetings", summary: "Create meeting", requestSchema: "MeetingCreateRequest", successSchema: "MeetingCreateResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/meetings/:meetingId", tag: "Meetings", summary: "Update meeting", requestSchema: "MeetingPatchRequest", successSchema: "MeetingResponse" },
  { method: "get", path: "/api/workspace/meetings/:meetingId", tag: "Meetings", summary: "Read meeting detail (participants, notes, action items, external links)" },
  { method: "post", path: "/api/workspace/meetings/:meetingId/external-links", tag: "Meetings", summary: "Attach external meeting link", requestSchema: "MeetingExternalLinkCreateRequest", successSchema: "MeetingExternalLinkResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/meetings/:meetingId/notes", tag: "Meetings", summary: "Create meeting notes", requestSchema: "MeetingNoteCreateRequest", successSchema: "MeetingNoteResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/meetings/:meetingId/action-items", tag: "Meetings", summary: "Create meeting action item", requestSchema: "MeetingActionItemCreateRequest", successSchema: "MeetingActionItemResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/meetings/:meetingId/action-items/:actionItemId", tag: "Meetings", summary: "Update meeting action item status", successSchema: "MeetingActionItemResponse" },
  { method: "get", path: "/api/workspace/communication-channels", tag: "Communication channels", summary: "List communication channels", successSchema: "CommunicationChannelsResponse", queryParameters: [{ name: "type", in: "query", required: false, schema: { $ref: "#/components/schemas/CommunicationChannelType" } }] },
  { method: "post", path: "/api/workspace/communication-channels", tag: "Communication channels", summary: "Create communication channel", requestSchema: "CommunicationChannelCreateRequest", successSchema: "CommunicationChannelResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/communication-channels/:channelId", tag: "Communication channels", summary: "Read communication channel", successSchema: "CommunicationChannelDetailResponse" },
  { method: "patch", path: "/api/workspace/communication-channels/:channelId", tag: "Communication channels", summary: "Update communication channel", requestSchema: "CommunicationChannelPatchRequest", successSchema: "CommunicationChannelResponse" },
  { method: "delete", path: "/api/workspace/communication-channels/:channelId", tag: "Communication channels", summary: "Archive communication channel", body: "none", successSchema: "CommunicationChannelResponse" },
  { method: "get", path: "/api/workspace/communication-channels/:channelId/conversation", tag: "Communication channels", summary: "Read channel conversation", successSchema: "CommunicationChannelConversationResponse" },
  { method: "post", path: "/api/workspace/communication-channels/:channelId/members", tag: "Communication channels", summary: "Add channel member", requestSchema: "CommunicationChannelMemberUpsertRequest", successSchema: "CommunicationChannelMemberResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/communication-channels/:channelId/members/:userId", tag: "Communication channels", summary: "Remove channel member", body: "none", successSchema: "CommunicationChannelMemberResponse" },
  { method: "get", path: "/api/workspace/sticker-packs", tag: "Stickers", summary: "List sticker packs", successSchema: "StickerPacksResponse" },
  { method: "get", path: "/api/workspace/sticker-packs/:packId/stickers", tag: "Stickers", summary: "List stickers in pack", successSchema: "StickerPackStickersResponse" },
  { method: "post", path: "/api/workspace/sticker-packs", tag: "Stickers", summary: "Create sticker pack", requestSchema: "StickerPackCreateRequest", successSchema: "StickerPackResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/sticker-packs/:packId/import", tag: "Stickers", summary: "Import stickers into pack", body: "multipart", requestSchema: "StickerImportMultipartRequest", successSchema: "StickerResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/sticker-packs/:packId", tag: "Stickers", summary: "Archive sticker pack", body: "none", successSchema: "StickerPackResponse" },
  { method: "get", path: "/api/workspace/stickers/:stickerId/download", tag: "Stickers", summary: "Download sticker image", response: "file" },
  { method: "delete", path: "/api/workspace/stickers/:stickerId", tag: "Stickers", summary: "Archive sticker", body: "none", successSchema: "StickerResponse" },
  { method: "get", path: "/api/workspace/call-rooms", tag: "Calls", summary: "List call rooms", successSchema: "CallRoomsResponse", queryParameters: [{ name: "entityType", in: "query", required: true, schema: { $ref: "#/components/schemas/CollaborationEntityType" } }, { name: "entityId", in: "query", required: true, schema: { type: "string", minLength: 1 } }] },
  { method: "post", path: "/api/workspace/call-rooms", tag: "Calls", summary: "Create call room", requestSchema: "CallRoomCreateRequest", successSchema: "CallRoomCreateResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/call-rooms/:roomId", tag: "Calls", summary: "Read call room", successSchema: "CallRoomDetailResponse" },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/sessions/start", tag: "Calls", summary: "Start call session", successSchema: "CallSessionStartResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/sessions/:sessionId/join-token", tag: "Calls", summary: "Create call join token", successSchema: "CallJoinTokenResponse" },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/sessions/:sessionId/participant-state", tag: "Calls", summary: "Update call participant state", requestSchema: "CallParticipantStateRequest", successSchema: "CallParticipantStateResponse" },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/sessions/:sessionId/end", tag: "Calls", summary: "End call session", successSchema: "CallSessionEndResponse" },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/recordings", tag: "Calls", summary: "Register call recording", requestSchema: "CallRecordingCreateRequest", successSchema: "CallRecordingResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/call-rooms/:roomId/events", tag: "Calls", summary: "List call events", successSchema: "CallEventsResponse", queryParameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }] },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/sessions/:sessionId/turn-credentials", tag: "Calls", summary: "Issue TURN credentials" },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/sessions/:sessionId/recordings/start", tag: "Calls", summary: "Start call recording", successStatus: 201 },
  { method: "post", path: "/api/workspace/call-rooms/:roomId/recordings/groups/:groupId/stop", tag: "Calls", summary: "Stop call recording group" },
  { method: "post", path: "/integrations/livekit/webhook", tag: "Integrations", summary: "LiveKit Egress webhook", auth: "public", body: "json" },
  { method: "get", path: "/api/workspace/projects/:projectId/knowledge/documents", tag: "Knowledge", summary: "List project documents", successSchema: "KnowledgeDocumentsResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/knowledge/documents", tag: "Knowledge", summary: "Create project document", requestSchema: "KnowledgeDocumentCreateRequest", successSchema: "KnowledgeDocumentVersionResponse", successStatus: 201 },
  { method: "get", path: "/api/workspace/projects/:projectId/knowledge/documents/:documentId", tag: "Knowledge", summary: "Read project document", successSchema: "KnowledgeDocumentDetailResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/knowledge/documents/:documentId/versions", tag: "Knowledge", summary: "Create project document version", requestSchema: "KnowledgeDocumentVersionCreateRequest", successSchema: "KnowledgeDocumentVersionResponse", successStatus: 201 },
  { method: "delete", path: "/api/workspace/projects/:projectId/knowledge/documents/:documentId", tag: "Knowledge", summary: "Archive project document", body: "none", successSchema: "KnowledgeDocumentResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/knowledge/decisions", tag: "Knowledge", summary: "List decision log entries", successSchema: "KnowledgeDecisionsResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/knowledge/decisions", tag: "Knowledge", summary: "Create decision log entry", requestSchema: "KnowledgeDecisionCreateRequest", successSchema: "KnowledgeDecisionResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/projects/:projectId/knowledge/decisions/:decisionId", tag: "Knowledge", summary: "Update decision log entry", requestSchema: "KnowledgeDecisionUpdateRequest", successSchema: "KnowledgeDecisionResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/knowledge/action-items", tag: "Knowledge", summary: "List knowledge action items", successSchema: "KnowledgeActionItemsResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/knowledge/action-items", tag: "Knowledge", summary: "Create knowledge action item", requestSchema: "KnowledgeActionItemCreateRequest", successSchema: "KnowledgeActionItemResponse", successStatus: 201 },
  { method: "patch", path: "/api/workspace/projects/:projectId/knowledge/action-items/:actionItemId", tag: "Knowledge", summary: "Update knowledge action item", requestSchema: "KnowledgeActionItemUpdateRequest", successSchema: "KnowledgeActionItemResponse" },
  { method: "get", path: "/api/workspace/projects/:projectId/closure", tag: "Closure", summary: "Read project closure state", successSchema: "ClosureReadModelResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/closure/preview", tag: "Closure", summary: "Preview project closure", successSchema: "ClosurePreviewResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/closure/close", tag: "Closure", summary: "Close project", requestSchema: "ClosureCloseRequest", successSchema: "ClosureCloseResponse" },
  { method: "post", path: "/api/workspace/projects/:projectId/closure/lessons", tag: "Closure", summary: "Create retrospective lesson", requestSchema: "RetrospectiveLessonCreateRequest", successSchema: "RetrospectiveLessonResponse", successStatus: 201 },
  { method: "post", path: "/api/workspace/projects/:projectId/closure/template-improvement-actions/:actionId/apply", tag: "Closure", summary: "Apply template improvement action", successSchema: "TemplateImprovementActionResponse" },
  { method: "get", path: "/api/tenant/current/project-templates/:templateId/retrospective-insights", tag: "Closure", summary: "Read template retrospective insights", successSchema: "RetrospectiveInsightsResponse" },
  { method: "get", path: "/api/tenant/current/scheduled-tasks", tag: "Scheduled tasks", summary: "List scheduled tasks", successSchema: "ScheduledTasksResponse", queryParameters: [{ name: "assigneeUserId", in: "query", required: true, schema: { type: "string", minLength: 1 } }, { name: "fromDate", in: "query", required: true, schema: { type: "string", format: "date" } }, { name: "toDate", in: "query", required: true, schema: { type: "string", format: "date" } }] },
  { method: "get", path: "/api/workspace/background-jobs/runs", tag: "Background jobs", summary: "List background job runs", successSchema: "BackgroundJobRunsResponse", queryParameters: [{ name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/BackgroundJobStatus" } }, { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }] },
  { method: "get", path: "/api/workspace/background-jobs/runs/:runId/events", tag: "Background jobs", summary: "List background job run events", successSchema: "BackgroundJobEventsResponse" },
  { method: "post", path: "/api/workspace/background-jobs/runs", tag: "Background jobs", summary: "Enqueue background job run", requestSchema: "BackgroundJobEnqueueRequest", successSchema: "BackgroundJobRunResponse", successStatus: 201 }
];

import { openApiSchemas } from "./schemas";

export function createKissPmOpenApiDocument() {
  const documentedRoutes = publicDocumentRoutes();
  return {
    openapi: "3.1.0",
    info: {
      title: "KISS PM Backend API",
      version: "2026-05-27",
      description:
        "Frontend-facing contract for the KISS PM backend. The current document intentionally covers every implemented route as an integration inventory; module-specific request and response schemas are deepened incrementally without changing the Scalar/OpenAPI surface."
    },
    servers: [{ url: "/", description: "Current API origin" }],
    tags: [...new Set(documentedRoutes.map((route) => route.tag))]
      .sort()
      .map((name) => ({ name })),
    paths: buildPaths(documentedRoutes),
    components: {
      securitySchemes: {
        cookieSession: {
          type: "apiKey",
          in: "cookie",
          name: "kiss_pm_session",
          description: "Browser session cookie created by POST /api/auth/login."
        },
        sameOriginAction: {
          type: "apiKey",
          in: "header",
          name: "x-kiss-pm-action",
          description:
            "Required with value `same-origin` for browser mutations except POST /api/auth/login."
        }
      },
      schemas: openApiSchemas
    }
  };
}

export function listDocumentedApiRoutes() {
  return publicDocumentRoutes().map((route) => ({ ...route }));
}

export function listAllKnownApiRoutes() {
  return routeDocs.map((route) => ({ ...route }));
}

function publicDocumentRoutes() {
  return routeDocs.filter((route) => route.availability !== "test-hooks" && route.auth !== "dev");
}

function buildPaths(routes: RouteDoc[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const openApiPath = toOpenApiPath(route.path);
    paths[openApiPath] ??= {};
    paths[openApiPath][route.method] = buildOperation(route);
  }
  return paths;
}

function buildOperation(route: RouteDoc) {
  const mutation = !["get", "delete"].includes(route.method) || route.method === "delete";
  const requestBody = requestBodyFor(route);
  return {
    tags: [route.tag],
    summary: route.summary,
    description: route.description ?? defaultRouteDescription(route, mutation),
    operationId: operationIdFor(route),
    security: route.auth === "public" || route.auth === "dev" ? [] : [{ cookieSession: [] }],
    parameters: [
      ...pathParameters(route.path),
      ...(route.queryParameters ?? []),
      ...(mutation && route.path !== "/api/auth/login" ? [sameOriginActionParameter()] : [])
    ],
    ...(requestBody ? { requestBody } : {}),
    responses: responsesFor(route)
  };
}

function requestBodyFor(route: RouteDoc) {
  const body = route.body ?? (route.requestSchema ? "json" : "none");
  if (body === "none") return undefined;
  if (body === "multipart") {
    return {
      required: true,
      content: {
        "multipart/form-data": {
          schema: schemaRef(route.requestSchema ?? "AnyJsonObject")
        }
      }
    };
  }
  return {
    required: true,
    content: {
      "application/json": {
        schema: schemaRef(route.requestSchema ?? "AnyJsonObject")
      }
    }
  };
}

function responsesFor(route: RouteDoc) {
  const errorSchema = route.errorSchema ?? "ApiError";
  const successContent =
    route.response === "file"
      ? {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" }
          }
        }
      : route.response === "event-stream"
        ? {
            "text/event-stream": {
              // successSchema, if given, describes the JSON payload of each SSE `data:` frame.
              schema: route.successSchema ? schemaRef(route.successSchema) : { type: "string" }
            }
          }
        : {
            "application/json": {
              schema: schemaRef(route.successSchema ?? "AnyJsonObject")
            }
          };

  return {
    [String(route.successStatus ?? 200)]: {
      description:
        route.response === "file"
          ? "File stream."
          : route.successStatus === 201
            ? "Created."
            : "Successful response.",
      content: successContent
    },
    "400": errorResponse("Invalid input or malformed route/query parameter.", errorSchema),
    "401": errorResponse("Session is required or invalid.", errorSchema),
    "403": errorResponse("Permission or same-origin mutation guard denied the request.", errorSchema),
    "404": errorResponse("Entity or route was not found.", errorSchema),
    "409": errorResponse("Optimistic concurrency, lifecycle, or uniqueness conflict.", errorSchema),
    "413": errorResponse("Request body exceeds route limits.", errorSchema),
    "415": errorResponse("Request media type is not supported.", errorSchema),
    "501": errorResponse("Persistence/provider capability is not configured.", errorSchema),
    ...Object.fromEntries(
      Object.entries(route.additionalResponses ?? {}).map(([status, extra]) => [
        status,
        errorResponse(extra.description, extra.schema)
      ])
    )
  };
}

function schemaRef(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function errorResponse(description: string, schemaName: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: schemaRef(schemaName)
      }
    }
  };
}

function sameOriginActionParameter() {
  return {
    name: "x-kiss-pm-action",
    in: "header",
    required: true,
    schema: { type: "string", const: "same-origin" },
    description: "Required for browser mutations. Must equal `same-origin`."
  };
}

function pathParameters(path: string) {
  return [...path.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string", minLength: 1 },
    description: `Route identifier \`${match[1]}\`.`
  }));
}

function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
}

function operationIdFor(route: RouteDoc) {
  const pathName = route.path
    .replace(/^\//, "")
    .replace(/[:{}]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${route.method}_${pathName || "root"}`;
}

function defaultRouteDescription(route: RouteDoc, mutation: boolean) {
  const auth =
    route.auth === "public"
      ? "Public route."
      : route.auth === "dev"
        ? "Development-only route; disabled unless dev routes are explicitly enabled."
        : "Requires an authenticated KISS PM browser session.";
  const guard =
    mutation && route.path !== "/api/auth/login"
      ? " Browser mutations must also send `x-kiss-pm-action: same-origin` from a trusted origin."
      : "";
  return `${auth}${guard}`;
}
