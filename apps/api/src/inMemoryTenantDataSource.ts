import { listTenantUsers } from "@kiss-pm/domain";
import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  AuditEventListItem
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
    async listAuditEventsByTenantId(tenantId, options) {
      return auditEvents
        .filter(
          (event) =>
            event.tenantId === tenantId &&
            (!options?.projectId ||
              (event.sourceEntity.type === "Project" &&
                event.sourceEntity.id === options.projectId)) &&
            (!options?.requiresAttention || auditEventRequiresAttention(event))
        )
        .slice(0, options?.limit);
    }
  };
}


function auditEventRequiresAttention(event: { actionType: string; executionResult: Record<string, unknown> }) {
  const status = typeof event.executionResult.status === "string" ? event.executionResult.status : null;
  return status === "failed" ||
    status === "denied" ||
    status === "conflict" ||
    hasAuditActionSuffix(event.actionType, "failed") ||
    hasAuditActionSuffix(event.actionType, "denied") ||
    hasAuditActionSuffix(event.actionType, "conflict");
}

function hasAuditActionSuffix(actionType: string, suffix: "failed" | "denied" | "conflict") {
  return actionType.endsWith(`_${suffix}`) || actionType.endsWith(`.${suffix}`);
}
