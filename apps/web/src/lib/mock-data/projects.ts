import type { Project } from "@/lib/api-types";

import { MOCK_TENANT_ID } from "./users";

export const MOCK_PROJECTS = [
  {
    id: "PRJ-2026-014",
    tenantId: MOCK_TENANT_ID,
    sourceType: "opportunity",
    sourceOpportunityId: "DEAL-101",
    clientId: "cli-romashka",
    projectTypeId: "ptype-crm",
    title: "Внедрение CRM",
    clientName: "ООО «Ромашка»",
    status: "active",
    plannedStart: "2026-06-01T00:00:00.000Z",
    plannedFinish: "2026-08-15T00:00:00.000Z",
    contractValue: 890000,
    plannedHours: 178,
    templateId: "tpl-crm",
    createdAt: "2026-05-22T12:30:00.000Z",
    activatedAt: "2026-05-23T08:00:00.000Z",
    demand: [
      { positionId: "pos-pm", requiredHours: 56 },
      { positionId: "pos-dev", requiredHours: 96 },
      { positionId: "pos-design", requiredHours: 26 }
    ]
  },
  {
    id: "PRJ-2026-009",
    tenantId: MOCK_TENANT_ID,
    sourceType: "opportunity",
    sourceOpportunityId: "DEAL-102",
    clientId: "cli-techno",
    projectTypeId: "ptype-analytics",
    title: "DataHub KPI",
    clientName: "АО «Техно»",
    status: "active",
    plannedStart: "2026-06-10T00:00:00.000Z",
    plannedFinish: "2026-09-20T00:00:00.000Z",
    contractValue: 1240000,
    plannedHours: 200,
    templateId: "tpl-crm",
    createdAt: "2026-05-21T11:30:00.000Z",
    activatedAt: "2026-05-22T09:00:00.000Z",
    demand: [
      { positionId: "pos-pm", requiredHours: 44 },
      { positionId: "pos-arch", requiredHours: 72 },
      { positionId: "pos-dev", requiredHours: 84 }
    ]
  },
  {
    id: "PRJ-2025-031",
    tenantId: MOCK_TENANT_ID,
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: "cli-acme",
    projectTypeId: "ptype-audit",
    title: "Портал поддержки",
    clientName: "ACME Studio",
    status: "closed",
    plannedStart: "2025-09-01T00:00:00.000Z",
    plannedFinish: "2025-12-15T00:00:00.000Z",
    contractValue: 540000,
    plannedHours: 120,
    templateId: "tpl-audit",
    createdAt: "2025-08-15T09:00:00.000Z",
    activatedAt: "2025-09-01T09:00:00.000Z",
    demand: [
      { positionId: "pos-pm", requiredHours: 24 },
      { positionId: "pos-dev", requiredHours: 96 }
    ]
  }
] satisfies Project[];
