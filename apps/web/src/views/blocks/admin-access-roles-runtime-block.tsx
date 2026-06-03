"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { AccessRole } from "@/lib/api/bootstrap";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

const PROJECTS_READ_PERMISSION = "tenant.projects.read";

export type AccessRolePermissionActionInput = {
  role: AccessRole;
  permission: string;
  enabled: boolean;
};

export type AdminAccessRolesRuntimeBlockProps = {
  accessRoles: AccessRole[];
  currentAccessProfileId?: string | undefined;
  permissionActionError?: unknown;
  permissionActionPending?: boolean;
  onChangeRolePermission?: (input: AccessRolePermissionActionInput) => Promise<unknown> | void;
};

export function AdminAccessRolesRuntimeBlock({
  accessRoles,
  currentAccessProfileId,
  permissionActionError,
  permissionActionPending = false,
  onChangeRolePermission
}: AdminAccessRolesRuntimeBlockProps) {
  return (
    <>
      <RoutePageIntro lead="Живые роли рабочей области: профили доступа и наборы разрешений, которые управляют runtime-поведением." />
      <CardPanel title="Роли" subtitle={`${accessRoles.length} профилей доступа`} flush>
        {accessRoles.length === 0 ? (
          <EmptyState
            title="Ролей нет"
            description="После настройки профилей доступа рабочей области они появятся здесь."
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Роль</th>
                <th>Разрешения</th>
                <th>Ключевые права</th>
                <th>Доступ к проектам</th>
              </tr>
            </thead>
            <tbody>
              {accessRoles.map((role) => {
                const hasProjectsRead = role.permissions.includes(PROJECTS_READ_PERMISSION);
                const isCurrentRole = role.id === currentAccessProfileId;
                const actionLabel = hasProjectsRead ? "Убрать проекты" : "Дать проекты";
                const disabledReason = !onChangeRolePermission
                  ? "Нужно право управлять ролями"
                  : isCurrentRole
                    ? "Нельзя менять текущую роль"
                    : undefined;

                return (
                  <tr key={role.id}>
                    <td>
                      <CellStack title={role.name} subtitle={role.id} />
                    </td>
                    <td>
                      <Chip variant={role.permissions.length > 0 ? "info" : "warning"}>
                        {role.permissions.length}
                      </Chip>
                    </td>
                    <td>{role.permissions.slice(0, 4).join(", ") || "Нет разрешений"}</td>
                    <td>
                      <Button
                        type="button"
                        size="xs"
                        variant={hasProjectsRead ? "destructive-soft" : "secondary"}
                        disabled={!onChangeRolePermission || permissionActionPending || isCurrentRole}
                        title={disabledReason}
                        aria-label={
                          isCurrentRole
                            ? `Текущая роль ${role.name}`
                            : `${hasProjectsRead ? "Убрать" : "Дать"} доступ к проектам для роли ${role.name}`
                        }
                        onClick={() => {
                          void onChangeRolePermission?.({
                            role,
                            permission: PROJECTS_READ_PERMISSION,
                            enabled: !hasProjectsRead
                          });
                        }}
                      >
                        {isCurrentRole ? "Текущая" : actionLabel}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
        {permissionActionError ? (
          <p className="field__hint">Не удалось изменить роль. Проверьте права или повторите позже.</p>
        ) : null}
      </CardPanel>
    </>
  );
}
