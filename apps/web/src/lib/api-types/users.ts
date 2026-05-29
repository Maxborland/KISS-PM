import type { IsoDateTime, TenantId, UserId } from "./common";

export type Permission = string;

export type AccessProfile = {
  id: string;
  tenantId: TenantId;
  name: string;
  permissions: Permission[];
};

export type WorkspaceUser = {
  id: UserId;
  tenantId: TenantId;
  name: string;
  accessProfileId: string;
  email: string;
  positionId: string | null;
  positionName: string | null;
  phone: string | null;
  telegram: string | null;
  status: string;
  theme: string;
  accentColor: string;
};

export type Position = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
};

export type PublicSession = {
  id: string;
  userId: UserId;
  device: string;
  statusLabel: string;
  lastSeenAt: IsoDateTime;
};
