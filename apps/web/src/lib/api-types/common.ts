export type TenantId = string;
export type UserId = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type AvatarColor = "c1" | "c2" | "c3" | "c4" | "c5";

export type UserAvatar = {
  initials: string;
  color: AvatarColor;
};

export type EntityRef = {
  type: string;
  id: string;
};

export type UnknownRecord = Record<string, unknown>;

export type Tenant = {
  id: TenantId;
  name: string;
};
