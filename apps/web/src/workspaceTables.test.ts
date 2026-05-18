import { describe, expect, it } from "vitest";

import {
  filterPositionsForTable,
  filterRolesForTable,
  filterUsersForTable
} from "./workspaceTables";
import type { AccessRole, Position, WorkspaceUser } from "./api";

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
});
