export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const
  },
  workspace: {
    root: ["workspace"] as const,
    users: ["workspace", "users"] as const,
    positions: ["workspace", "positions"] as const,
    accessRoles: ["workspace", "access-roles"] as const,
    customFields: ["workspace", "config", "custom-fields"] as const,
    projects: ["workspace", "projects"] as const,
    projectTemplates: ["workspace", "config", "project-templates"] as const,
    operationsCockpit: ["workspace", "operations-cockpit"] as const,
    myWork: (userId: string) => ["workspace", "my-work", userId] as const,
    workspaceAgentThread: ["workspace", "agent-thread"] as const,
    opportunities: ["workspace", "opportunities"] as const,
    dealStages: ["workspace", "deal-stages"] as const
  },
  tenant: {
    currentScheduledTasksRoot: ["tenant", "current", "scheduled-tasks"] as const,
    currentScheduledTasks: (assigneeUserId: string, fromDate: string, toDate: string) =>
      ["tenant", "current", "scheduled-tasks", assigneeUserId, fromDate, toDate] as const
  }
} as const;
