import type { IsoDateTime, TenantId } from "./common";

export type CustomFieldDefinition = {
  id: string;
  tenantId: TenantId;
  systemKey: string;
  tenantLabel: string;
  targetEntity: string;
  fieldType: string;
  required: boolean;
  status: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
