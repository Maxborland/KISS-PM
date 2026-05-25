import type { IsoDateTime, TenantId } from "./common";
import type { PositionDemand } from "./deals";

export type ProjectSourceType = "opportunity" | "workspace_inbox" | "manual";

export type Project = {
  id: string;
  tenantId: TenantId;
  sourceType: ProjectSourceType;
  sourceOpportunityId: string | null;
  clientId: string | null;
  projectTypeId: string | null;
  title: string;
  clientName: string;
  status: string;
  plannedStart: IsoDateTime;
  plannedFinish: IsoDateTime;
  contractValue: number;
  plannedHours: number;
  templateId: string | null;
  createdAt: IsoDateTime;
  activatedAt: IsoDateTime | null;
  demand: PositionDemand[];
};

export type ProjectTemplate = {
  id: string;
  tenantId: TenantId;
  systemKey: string;
  tenantLabel: string;
  description: string | null;
  status: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
