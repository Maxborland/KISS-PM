import { listTenantUsers } from "@kiss-pm/domain";
import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import type { PostgresTenantDataSource } from "@kiss-pm/persistence";

import type { AccessProfileRecord, AuditEventListItem } from "./apiTypes";
import { tenantAdminProfile } from "./tenantAdminProfile";

export function createInMemoryTenantDataSource(): Partial<PostgresTenantDataSource> {
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
      const executionStatus = (event: AuditEventListItem): string | undefined => {
        const status = (event.executionResult as { status?: unknown }).status;
        return typeof status === "string" ? status : undefined;
      };
      return auditEvents
        .filter((event) => event.tenantId === tenantId)
        .filter(
          (event) =>
            !options?.projectId ||
            (event.sourceEntity.type === "Project" && event.sourceEntity.id === options.projectId)
        )
        .filter((event) => !options?.actorUserId || event.actorUserId === options.actorUserId)
        .filter((event) => !options?.actionType || event.actionType === options.actionType)
        .filter(
          (event) => !options?.executionResult || executionStatus(event) === options.executionResult
        )
        .filter((event) => !options?.fromDate || event.createdAt.getTime() >= options.fromDate.getTime())
        .filter((event) => !options?.toDate || event.createdAt.getTime() <= options.toDate.getTime())
        .sort((a, b) =>
          a.createdAt.getTime() === b.createdAt.getTime()
            ? a.id < b.id
              ? 1
              : a.id > b.id
                ? -1
                : 0
            : b.createdAt.getTime() - a.createdAt.getTime()
        )
        .filter((event) => {
          if (!options?.cursor) return true;
          const cursorTime = options.cursor.createdAt.getTime();
          const eventTime = event.createdAt.getTime();
          if (eventTime !== cursorTime) return eventTime < cursorTime;
          return event.id < options.cursor.id;
        })
        .slice(0, options?.limit);
    }
  };
}
