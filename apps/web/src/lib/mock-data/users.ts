import type { AccessProfile, Position, UserAvatar, WorkspaceUser } from "@/lib/api-types";

import { avatarColorByIndex, getInitials } from "./format";

export const MOCK_TENANT_ID = "tenant-demo";

export const MOCK_POSITIONS = [
  {
    id: "pos-pm",
    tenantId: MOCK_TENANT_ID,
    name: "Руководитель проекта",
    description: "Ведёт сроки, бюджет, коммуникации и приемку результата."
  },
  {
    id: "pos-arch",
    tenantId: MOCK_TENANT_ID,
    name: "Архитектор",
    description: "Отвечает за техническую модель, интеграции и качество решений."
  },
  {
    id: "pos-design",
    tenantId: MOCK_TENANT_ID,
    name: "Дизайнер",
    description: "Проектирует интерфейсы, прототипы и визуальную систему."
  },
  {
    id: "pos-dev",
    tenantId: MOCK_TENANT_ID,
    name: "Разработчик",
    description: "Реализует frontend/backend задачи и покрывает изменения тестами."
  }
] satisfies Position[];

export const MOCK_ACCESS_PROFILES = [
  {
    id: "access-admin",
    tenantId: MOCK_TENANT_ID,
    name: "Администратор",
    permissions: ["workspace.users.manage", "workspace.config.manage", "audit.read"]
  },
  {
    id: "access-pm",
    tenantId: MOCK_TENANT_ID,
    name: "PM",
    permissions: ["project.manage", "task.manage", "crm.read", "control.read"]
  },
  {
    id: "access-member",
    tenantId: MOCK_TENANT_ID,
    name: "Участник",
    permissions: ["task.read", "task.update", "profile.update"]
  }
] satisfies AccessProfile[];

export const MOCK_WORKSPACE_USERS = [
  {
    id: "usr-ivanova",
    tenantId: MOCK_TENANT_ID,
    name: "Иванова Мария",
    accessProfileId: "access-pm",
    email: "ivanova@kiss.pm",
    positionId: "pos-pm",
    positionName: "Руководитель проекта",
    phone: "+7 900 100-10-10",
    telegram: "@ivanova_pm",
    status: "active",
    theme: "system",
    accentColor: "blue"
  },
  {
    id: "usr-petrov",
    tenantId: MOCK_TENANT_ID,
    name: "Петров Андрей",
    accessProfileId: "access-pm",
    email: "petrov@kiss.pm",
    positionId: "pos-arch",
    positionName: "Архитектор",
    phone: "+7 900 200-20-20",
    telegram: "@petrov_arch",
    status: "active",
    theme: "dark",
    accentColor: "violet"
  },
  {
    id: "usr-kozlova",
    tenantId: MOCK_TENANT_ID,
    name: "Козлова Елена",
    accessProfileId: "access-member",
    email: "kozlova@kiss.pm",
    positionId: "pos-design",
    positionName: "Дизайнер",
    phone: "+7 900 300-30-30",
    telegram: "@kozlova_design",
    status: "active",
    theme: "system",
    accentColor: "blue"
  },
  {
    id: "usr-volkov",
    tenantId: MOCK_TENANT_ID,
    name: "Волков Виктор",
    accessProfileId: "access-member",
    email: "volkov@kiss.pm",
    positionId: "pos-dev",
    positionName: "Разработчик",
    phone: null,
    telegram: "@volkov_dev",
    status: "inactive",
    theme: "light",
    accentColor: "slate"
  }
] satisfies WorkspaceUser[];

export function userAvatar(userId: string | null | undefined): UserAvatar {
  const index = Math.max(0, MOCK_WORKSPACE_USERS.findIndex((user) => user.id === userId));
  const user = MOCK_WORKSPACE_USERS[index];
  return {
    initials: user ? getInitials(user.name) : "—",
    color: avatarColorByIndex(index)
  };
}

export function userName(userId: string | null | undefined): string {
  return MOCK_WORKSPACE_USERS.find((user) => user.id === userId)?.name ?? "Не назначен";
}

export function accessProfileName(accessProfileId: string | null | undefined): string {
  return MOCK_ACCESS_PROFILES.find((profile) => profile.id === accessProfileId)?.name ?? "Не назначен";
}

export function positionName(positionId: string | null | undefined): string {
  return MOCK_POSITIONS.find((position) => position.id === positionId)?.name ?? "Не указана";
}
