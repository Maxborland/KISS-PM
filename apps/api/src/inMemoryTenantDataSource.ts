import { listTenantUsers } from "@kiss-pm/domain";
import { createDemoTenantDataset } from "@kiss-pm/test-fixtures";
import type {
  AccessProfileRecord,
  ApiTenantDataSource,
  AuditEventListItem,
  WorkspaceAgentActionProposalRecord,
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
  const workspaceAgentProposals: WorkspaceAgentActionProposalRecord[] = [];

  const dataSource: ApiTenantDataSource = {
    async withTransaction(operation) {
      const accessProfileSnapshot = accessProfiles.map((profile) => ({ ...profile }));
      const auditEventSnapshot = auditEvents.map((event) => ({ ...event }));
      const messageSnapshot = workspaceAgentMessages.map((message) => ({ ...message }));
      const proposalSnapshot = workspaceAgentProposals.map((proposal) => ({ ...proposal }));
      try {
        return await operation(dataSource);
      } catch (error) {
        accessProfiles.splice(0, accessProfiles.length, ...accessProfileSnapshot);
        auditEvents.splice(0, auditEvents.length, ...auditEventSnapshot);
        workspaceAgentMessages.splice(0, workspaceAgentMessages.length, ...messageSnapshot);
        workspaceAgentProposals.splice(0, workspaceAgentProposals.length, ...proposalSnapshot);
        throw error;
      }
    },
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
    },
    async listWorkspaceAgentProposals(input) {
      return workspaceAgentProposals
        .filter(
          (proposal) =>
            proposal.tenantId === input.tenantId &&
            workspaceAgentContextKey(proposal.context) === workspaceAgentContextKey(input.context)
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-(input.limit ?? 20));
    },
    async createWorkspaceAgentProposal(input) {
      workspaceAgentProposals.push(input);
      return input;
    },
    async findWorkspaceAgentProposal(tenantId, proposalId) {
      return workspaceAgentProposals.find((proposal) => proposal.tenantId === tenantId && proposal.id === proposalId);
    },
    async updateWorkspaceAgentProposalStatus(input) {
      const index = workspaceAgentProposals.findIndex(
        (proposal) => proposal.tenantId === input.tenantId && proposal.id === input.proposalId
      );
      if (index < 0) return undefined;
      const current = workspaceAgentProposals[index];
      if (!current) return undefined;
      if (input.expectedStatus && current.status !== input.expectedStatus) return undefined;
      const updated = {
        ...current,
        status: input.status,
        auditEventId: input.auditEventId,
        resolvedAt: input.resolvedAt
      };
      workspaceAgentProposals[index] = updated;
      return updated;
    }
  };
  return dataSource;
}

function workspaceAgentContextKey(context: WorkspaceAgentThreadContext): string {
  if (!context.focus) return "portfolio";
  return `${context.focus.type}:${context.focus.id}`;
}
