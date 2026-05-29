import type { IsoDateTime, TenantId, UnknownRecord } from "./common";

export type PositionDemand = {
  positionId: string;
  requiredHours: number;
};

export type OpportunityCustomFieldValues = Record<string, string>;

export type OpportunityFinalStatus = "won_closed" | "lost_rejected";

export type Opportunity = {
  id: string;
  tenantId: TenantId;
  clientId: string | null;
  primaryContactId: string | null;
  ownerUserId: string | null;
  projectTypeId: string | null;
  stageId: string | null;
  clientName: string;
  contactName: string;
  title: string;
  projectType: string;
  description: string | null;
  plannedStart: IsoDateTime;
  plannedFinish: IsoDateTime;
  contractValue: number;
  plannedHourlyRate: number;
  plannedHours: number;
  probability: number;
  status: string;
  templateId: string | null;
  feasibilityStatus: string | null;
  feasibilityResult: UnknownRecord | null;
  feasibilityCheckedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  demand: PositionDemand[];
  customFieldValues: OpportunityCustomFieldValues;
};

export type OpportunityCreateDraft = Omit<
  Opportunity,
  | "createdAt"
  | "updatedAt"
  | "feasibilityStatus"
  | "feasibilityResult"
  | "feasibilityCheckedAt"
  | "ownerUserId"
  | "customFieldValues"
> & {
  ownerUserId?: string | null;
  customFieldValues?: OpportunityCustomFieldValues;
};
