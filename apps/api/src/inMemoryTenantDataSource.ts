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
      const filtered = auditEvents.filter(
        (event) =>
          event.tenantId === tenantId &&
          (!options?.projectId ||
            (event.sourceEntity.type === "Project" &&
              event.sourceEntity.id === options.projectId)) &&
          auditEventMatchesSourceEntities(event, options?.sourceEntities) &&
          (!options?.requiresAttention || auditEventRequiresAttention(event))
      );
      const ordered = options?.requiresAttention
        ? [...filtered].sort(compareAttentionAuditEvents)
        : filtered;
      return ordered.slice(0, options?.limit);
    }
  };
}

function auditEventMatchesSourceEntities(
  event: { sourceEntity: Record<string, unknown> },
  sourceEntities: Array<{ type: string; ids: string[] }> | undefined
) {
  if (!sourceEntities?.length) return true;
  const type = typeof event.sourceEntity.type === "string" ? event.sourceEntity.type : undefined;
  const id = typeof event.sourceEntity.id === "string" ? event.sourceEntity.id : undefined;
  if (!type || !id) return false;
  return sourceEntities.some((sourceEntity) =>
    sourceEntity.type === type && sourceEntity.ids.includes(id)
  );
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

function compareAttentionAuditEvents(
  left: { id: string; actionType: string; executionResult: Record<string, unknown>; createdAt: Date },
  right: { id: string; actionType: string; executionResult: Record<string, unknown>; createdAt: Date }
) {
  return auditEventSeverityRank(left) - auditEventSeverityRank(right) ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    right.id.localeCompare(left.id);
}

function auditEventSeverityRank(event: { actionType: string; executionResult: Record<string, unknown> }) {
  const status = typeof event.executionResult.status === "string" ? event.executionResult.status : null;
  return status === "failed" || hasAuditActionSuffix(event.actionType, "failed") ? 0 : 1;
}
function hasAuditActionSuffix(actionType: string, suffix: "failed" | "denied" | "conflict") {
  return actionType.endsWith(`_${suffix}`) || actionType.endsWith(`.${suffix}`);
}
