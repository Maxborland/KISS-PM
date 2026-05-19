import { describe, expect, it } from "vitest";

import {
  filterClientsForTable,
  filterContactsForTable,
  filterDealStagesForTable,
  filterOpportunitiesForTable,
  filterPositionsForTable,
  filterProjectTypesForTable,
  filterRolesForTable,
  filterUsersForTable
} from "./workspaceTables";
import type {
  AccessRole,
  Client,
  Contact,
  DealStage,
  Opportunity,
  Position,
  ProjectType,
  WorkspaceUser
} from "./api";

const roles: AccessRole[] = [
  {
    id: "role-admin",
    tenantId: "tenant-alpha",
    name: "Администратор",
    permissions: ["tenant.users.manage", "tenant.positions.read"]
  },
  {
    id: "role-reader",
    tenantId: "tenant-alpha",
    name: "Наблюдатель",
    permissions: ["profile.read"]
  }
];

const positions: Position[] = [
  {
    id: "position-pm",
    tenantId: "tenant-alpha",
    name: "Руководитель проекта",
    description: "Ведет проектный контур"
  },
  {
    id: "position-analyst",
    tenantId: "tenant-alpha",
    name: "Аналитик",
    description: "Собирает требования"
  }
];

const users: WorkspaceUser[] = [
  {
    id: "user-admin",
    tenantId: "tenant-alpha",
    accessProfileId: "role-admin",
    email: "admin@kiss-pm.local",
    name: "Анна Администратор",
    phone: null,
    telegram: null,
    positionId: "position-pm",
    positionName: "Руководитель проекта",
    status: "active",
    theme: "light",
    accentColor: "#0f172a"
  },
  {
    id: "user-reader",
    tenantId: "tenant-alpha",
    accessProfileId: "role-reader",
    email: "reader@kiss-pm.local",
    name: "Роман Наблюдатель",
    phone: null,
    telegram: null,
    positionId: null,
    positionName: null,
    status: "inactive",
    theme: "light",
    accentColor: "#0f172a"
  }
];

const opportunities: Opportunity[] = [
  {
    id: "opportunity-1",
    tenantId: "tenant-alpha",
    clientId: "client-romashka",
    primaryContactId: "contact-irina",
    projectTypeId: "project-type-implementation",
    stageId: "deal-stage-qualified",
    clientName: "ООО Ромашка",
    contactName: "Ирина Клиент",
    title: "Внедрение KISS PM",
    projectType: "Внедрение",
    description: null,
    plannedStart: "2026-06-01T00:00:00.000Z",
    plannedFinish: "2026-06-30T00:00:00.000Z",
    contractValue: 960000,
    plannedHourlyRate: 6000,
    plannedHours: 160,
    probability: 80,
    status: "new",
    templateId: null,
    feasibilityStatus: null,
    feasibilityResult: null,
    feasibilityCheckedAt: null,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    demand: []
  }
];

const clients: Client[] = [
  {
    id: "client-romashka",
    tenantId: "tenant-alpha",
    name: "ООО Ромашка",
    description: "Стратегический клиент",
    status: "active",
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z"
  }
];

const contacts: Contact[] = [
  {
    id: "contact-irina",
    tenantId: "tenant-alpha",
    clientId: "client-romashka",
    name: "Ирина Клиент",
    email: "irina@example.test",
    phone: "+79990000000",
    telegram: "@irina",
    role: "Заказчик",
    status: "active",
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z"
  }
];

const projectTypes: ProjectType[] = [
  {
    id: "project-type-implementation",
    tenantId: "tenant-alpha",
    name: "Внедрение",
    description: "Проект запуска продукта",
    status: "active",
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z"
  }
];

const dealStages: DealStage[] = [
  {
    id: "deal-stage-qualified",
    tenantId: "tenant-alpha",
    name: "Квалификация",
    sortOrder: 20,
    status: "active",
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z"
  }
];

describe("workspace table filters", () => {
  it("filters users by person, role, position and status text", () => {
    expect(filterUsersForTable(users, roles, "админ")).toHaveLength(1);
    expect(filterUsersForTable(users, roles, "наблюдатель")).toHaveLength(1);
    expect(filterUsersForTable(users, roles, "руководитель")).toHaveLength(1);
    expect(filterUsersForTable(users, roles, "отключен")).toEqual([users[1]]);
    expect(filterUsersForTable(users, roles, "missing")).toEqual([]);
  });

  it("filters access roles by name and permission key", () => {
    expect(filterRolesForTable(roles, "админ")).toEqual([roles[0]]);
    expect(filterRolesForTable(roles, "profile.read")).toEqual([roles[1]]);
    expect(filterRolesForTable(roles, "tenant.positions")).toEqual([roles[0]]);
    expect(filterRolesForTable(roles, "missing")).toEqual([]);
  });

  it("filters positions by name and description", () => {
    expect(filterPositionsForTable(positions, "аналитик")).toEqual([positions[1]]);
    expect(filterPositionsForTable(positions, "проектный")).toEqual([positions[0]]);
    expect(filterPositionsForTable(positions, "missing")).toEqual([]);
  });

  it("filters deals by linked CRM labels and stage id", () => {
    expect(filterOpportunitiesForTable(opportunities, "ромашка")).toEqual(opportunities);
    expect(filterOpportunitiesForTable(opportunities, "ирина")).toEqual(opportunities);
    expect(filterOpportunitiesForTable(opportunities, "deal-stage-qualified")).toEqual(
      opportunities
    );
    expect(filterOpportunitiesForTable(opportunities, "missing")).toEqual([]);
  });

  it("filters CRM entities on their own list pages", () => {
    expect(filterClientsForTable(clients, "стратегический")).toEqual(clients);
    expect(filterContactsForTable(contacts, clients, "ромашка")).toEqual(contacts);
    expect(filterProjectTypesForTable(projectTypes, "запуска")).toEqual(projectTypes);
    expect(filterDealStagesForTable(dealStages, "20")).toEqual(dealStages);
    expect(filterClientsForTable(clients, "missing")).toEqual([]);
  });
});
