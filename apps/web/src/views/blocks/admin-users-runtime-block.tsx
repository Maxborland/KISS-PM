"use client";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { AvatarColor, WorkspaceUser } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

const AVATAR_COLORS: AvatarColor[] = ["c1", "c2", "c3", "c4", "c5"];

export type WorkspaceUserStatusActionInput = {
  userId: string;
  status: "active" | "inactive";
};

export type AdminUsersRuntimeBlockProps = {
  users: WorkspaceUser[];
  currentUserId?: string | undefined;
  statusActionError?: unknown;
  statusActionPending?: boolean;
  onChangeUserStatus?: (input: WorkspaceUserStatusActionInput) => Promise<unknown> | void;
};

export function AdminUsersRuntimeBlock({
  users,
  currentUserId,
  statusActionError,
  statusActionPending = false,
  onChangeUserStatus
}: AdminUsersRuntimeBlockProps) {
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
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => {
                const isActive = user.status === "active";
                const isCurrentUser = user.id === currentUserId;
                const nextStatus = isActive ? "inactive" : "active";
                const actionLabel = isActive ? "Отключить" : "Включить";
                const disabledReason = !onChangeUserStatus
                  ? "Нужно право управлять пользователями"
                  : isCurrentUser
                    ? "Нельзя отключить текущую сессию"
                    : undefined;

                return (
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
                      <Chip variant={isActive ? "success" : "info"}>
                        {isActive ? "Активен" : "Отключён"}
                      </Chip>
                    </td>
                    <td>
                      <Button
                        type="button"
                        size="xs"
                        variant={isActive ? "destructive-soft" : "secondary"}
                        disabled={!onChangeUserStatus || statusActionPending || isCurrentUser}
                        title={disabledReason}
                        aria-label={
                          isCurrentUser
                            ? `Текущий пользователь ${user.name}`
                            : `${actionLabel} пользователя ${user.name}`
                        }
                        onClick={() => {
                          void onChangeUserStatus?.({ userId: user.id, status: nextStatus });
                        }}
                      >
                        {isCurrentUser ? "Текущий" : actionLabel}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
        {statusActionError ? (
          <p className="field__hint">Не удалось изменить статус пользователя. Проверьте права или повторите позже.</p>
        ) : null}
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
