import type { IsoDate, IsoDateTime, TenantId, UserId } from "./common";

export type ProductionCalendarException = {
  id: string;
  date: IsoDate;
  workingMinutes: number;
  reason: string | null;
  resourceId: string | null;
};

export type ProductionCalendar = {
  calendarId: string;
  year: number;
  workingWeekdays: number[];
  workingMinutesPerDay: number;
  exceptions: ProductionCalendarException[];
};

export type AbsenceType =
  | "vacation"
  | "admin_leave"
  | "sick_leave"
  | "maternity_leave"
  | "truancy";

export type Absence = {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  type: AbsenceType;
  dateFrom: IsoDate;
  dateTo: IsoDate;
  status: string;
  reason: string | null;
  createdBy: UserId;
  approvedBy: UserId | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type OrgTrack = "functional" | "project";
export type OrgNodeType = "direction" | "department" | "team";

export type OrgStructureNode = {
  id: string;
  tenantId: TenantId;
  track: OrgTrack;
  nodeType: OrgNodeType;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type OrgStructurePlacement = {
  tenantId: TenantId;
  userId: UserId;
  track: OrgTrack;
  directionId: string | null;
  departmentId: string | null;
  teamId: string | null;
  positionId: string | null;
};

export type OrgStructureSnapshot = {
  functional: {
    nodes: OrgStructureNode[];
    placements: OrgStructurePlacement[];
  };
  project: {
    nodes: OrgStructureNode[];
    placements: OrgStructurePlacement[];
  };
};
