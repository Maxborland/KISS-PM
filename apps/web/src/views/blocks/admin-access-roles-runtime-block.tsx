"use client";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { AccessRole } from "@/lib/api/bootstrap";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

export function AdminAccessRolesRuntimeBlock({ accessRoles }: { accessRoles: AccessRole[] }) {
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
              </tr>
            </thead>
            <tbody>
              {accessRoles.map((role) => (
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
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </CardPanel>
    </>
  );
}
