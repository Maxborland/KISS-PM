import type { IsoDateTime, TenantId } from "./common";

export type CrmEntityStatus = "active" | "archived";

export type Client = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Contact = {
  id: string;
  tenantId: TenantId;
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  role: string | null;
  status: CrmEntityStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type ProductType = "service" | "goods";

export type Product = {
  id: string;
  tenantId: TenantId;
  name: string;
  sku: string | null;
  type: ProductType;
  unit: string;
  price: number;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type ProjectType = {
  id: string;
  tenantId: TenantId;
  name: string;
  description: string | null;
  status: CrmEntityStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type DealStage = {
  id: string;
  tenantId: TenantId;
  name: string;
  sortOrder: number;
  status: CrmEntityStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type CrmActivityEntityType = "opportunity" | "client" | "contact" | "product";
export type CrmActivityType = "comment" | "task" | "file";
export type CrmActivityStatus = "todo" | "done";

export type CrmActivity = {
  id: string;
  tenantId: TenantId;
  entityType: CrmActivityEntityType;
  entityId: string;
  type: CrmActivityType;
  title: string | null;
  body: string | null;
  status: CrmActivityStatus | null;
  dueDate: IsoDateTime | null;
  assigneeUserId: string | null;
  authorUserId: string;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
