"use client";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { AvatarColor, WorkspaceUser } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

const AVATAR_COLORS: AvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];

export function AdminUsersRuntimeBlock({ users }: { users: WorkspaceUser[] }) {
  return (
    <>
      <RoutePageIntro lead="Живой список сотрудников рабочей области: доступ, должность, контакты и статус учётной записи." />
      <CardPanel title="Пользователи" subtitle={`${users.length} сотрудников`} flush>
        {users.length === 0 ? (
          <EmptyState
            title="Пользователей нет"
            description="После добавления сотрудников рабочей области они появятся здесь."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Доступ / должность</th>
                <th>Контакты</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id}>
                  <td>
                    <CellStack
                      title={user.name}
                      subtitle={user.id}
                      icon={
                        <BemAvatar
                          initials={getInitials(user.name)}
                          color={AVATAR_COLORS[index % AVATAR_COLORS.length] ?? "c1"}
                          size="sm"
                        />
                      }
                    />
                  </td>
                  <td>
                    <CellStack
                      title={user.accessProfileId}
                      subtitle={user.positionName ?? "Должность не указана"}
                    />
                  </td>
                  <td>
                    <CellStack title={user.email} subtitle={`${user.phone ?? "—"} · ${user.telegram ?? "—"}`} />
                  </td>
                  <td>
                    <Chip variant={user.status === "active" ? "success" : "info"}>
                      {user.status === "active" ? "Активен" : "Отключён"}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </CardPanel>
    </>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
