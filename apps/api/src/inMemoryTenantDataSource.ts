import { listTenantUsers } from "@kiss-pm/domain";
import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  AuditEventListItem,
  WorkspaceAgentMessageRecord,
  WorkspaceAgentThreadContext
} from "./apiTypes";
import { tenantAdminProfile } from "./tenantAdminProfile";

export function createInMemoryTenantDataSource(): ApiTenantDataSource {
  const demo = createDemoTenantDataset();
  const accessProfiles: AccessProfileRecord[] = demo.tenants.map((tenant) => ({
    id: `access-profile-${tenant.id.replace("tenant-", "")}-admin`,
    tenantId: tenant.id,
    name: "Администратор",
    permissions: tenantAdminProfile.permissions
  }));
  const auditEvents: AuditEventListItem[] = [];
  const workspaceAgentMessages: WorkspaceAgentMessageRecord[] = [];

  return {
    async listDevUsers() {
      return demo.users;
    },
    async findUserById(userId) {
      return demo.users.find((user) => user.id === userId);
    },
    async findTenantById(tenantId) {
      return demo.tenants.find((tenant) => tenant.id === tenantId);
    },
    async findAccessProfileById() {
      return tenantAdminProfile;
    },
    async listUsersByTenantId(tenantId) {
      return listTenantUsers(demo.users, tenantId);
    },
    async listAccessProfilesByTenantId(tenantId) {
      return accessProfiles.filter((profile) => profile.tenantId === tenantId);
    },
    async createAccessProfile(input) {
      accessProfiles.push(input);
      return input;
    },
    async appendAuditEvent(input) {
      auditEvents.unshift({
        ...input,
        sourceSurfaceId: input.sourceSurfaceId ?? null,
        sourceWorkflow: input.sourceWorkflow ?? null
      });
    },
    async listAuditEventsByTenantId(tenantId) {
      return auditEvents.filter((event) => event.tenantId === tenantId);
    },
    async listWorkspaceAgentMessages(input) {
      return workspaceAgentMessages
        .filter(
          (message) =>
            message.tenantId === input.tenantId &&
            workspaceAgentContextKey(message.context) === workspaceAgentContextKey(input.context)
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-(input.limit ?? 100));
    },
    async createWorkspaceAgentMessage(input) {
      workspaceAgentMessages.push(input);
      return input;
    }
  };
}

function workspaceAgentContextKey(context: WorkspaceAgentThreadContext): string {
  if (!context.focus) return "portfolio";
  return `${context.focus.type}:${context.focus.id}`;
}
