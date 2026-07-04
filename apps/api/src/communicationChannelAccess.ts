import {
  canManageCommunications,
  canReadProjects,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { CommunicationChannel, TenantUser } from "@kiss-pm/domain";

import type { ApiTenantDataSource } from "./apiTypes";

export type CommunicationChannelAccessDataSource = Pick<
  ApiTenantDataSource,
  "listCommunicationChannelMembers" | "listProjects"
>;

export type CommunicationChannelAccess = {
  readDecision: PolicyDecision;
  manageDecision: PolicyDecision;
};

const grantedDecision: PolicyDecision = {
  allowed: true,
  reason: "same_tenant_permission_granted"
};

const missingDecision: PolicyDecision = {
  allowed: false,
  reason: "permission_missing"
};

export async function resolveCommunicationChannelAccess(input: {
  actor: TenantUser;
  channel: CommunicationChannel;
  dataSource: CommunicationChannelAccessDataSource;
  profile: AccessProfile;
}): Promise<CommunicationChannelAccess> {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  const managerDecision = canManageCommunications(policyInput);
  const members = await input.dataSource.listCommunicationChannelMembers?.({
    tenantId: input.actor.tenantId,
    channelId: input.channel.id
  }) ?? [];
  const membership = members.find((member) => member.userId === input.actor.id);
  const scopedProjectRead = await canReadScopedProjectChannel(input, policyInput);
  const isProjectGeneral = input.channel.channelType === "project_general";
  const membershipManage =
    !isProjectGeneral && (membership?.role === "owner" || membership?.role === "moderator");
  const policyManage = managerDecision.allowed && (!isProjectGeneral || scopedProjectRead);
  const canManage = policyManage || membershipManage;
  const canRead = input.channel.channelType === "workspace_general" ||
    (isProjectGeneral ? scopedProjectRead : Boolean(membership) || canManage);

  return {
    readDecision: canRead ? grantedDecision : missingDecision,
    manageDecision: canManage ? grantedDecision : managerDecision
  };
}

async function canReadScopedProjectChannel(
  input: {
    actor: TenantUser;
    channel: CommunicationChannel;
    dataSource: CommunicationChannelAccessDataSource;
  },
  policyInput: Parameters<typeof canReadProjects>[0]
): Promise<boolean> {
  if (
    input.channel.channelType !== "project_general" ||
    input.channel.scopeEntityType !== "project" ||
    !input.channel.scopeEntityId
  ) {
    return false;
  }
  const projectRead = canReadProjects(policyInput);
  if (!projectRead.allowed) return false;
  const projects = await input.dataSource.listProjects?.(input.actor.tenantId) ?? [];
  return projects.some((project) => project.id === input.channel.scopeEntityId);
}
