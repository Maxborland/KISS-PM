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
    opportunities: ["workspace", "opportunities"] as const,
    dealStages: ["workspace", "deal-stages"] as const
  }
} as const;
