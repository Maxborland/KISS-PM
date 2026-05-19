import { createAccessProfile } from "@kiss-pm/access-control";

export const tenantAdminProfile = createAccessProfile({
  id: "tenant-admin",
  permissions: [
    "tenant.users.read",
    "tenant.users.manage",
    "tenant.access_profiles.read",
    "tenant.access_profiles.manage",
    "tenant.positions.read",
    "tenant.positions.manage",
    "tenant.workspace_config.read",
    "tenant.workspace_config.manage",
    "tenant.opportunities.read",
    "tenant.opportunities.manage",
    "tenant.projects.read",
    "tenant.projects.manage",
    "tenant.project_activation.manage",
    "tenant.resource_feasibility.read",
    "profile.read",
    "profile.update",
    "workspace.theme.manage",
    "tenant.audit_events.read"
  ]
});
