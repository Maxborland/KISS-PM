import { MoreHorizontal, ShieldCheck, UserPlus } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { MOCK_ORG_STRUCTURE } from "@/lib/mock-data/org-structure";
import {
  MOCK_ACCESS_PROFILES,
  MOCK_POSITIONS,
  MOCK_WORKSPACE_USERS,
  accessProfileName,
  userAvatar
} from "@/lib/mock-data/users";
import { MOCK_ABSENCES } from "@/lib/mock-data/capacity";
import { formatDate } from "@/lib/mock-data/format";
import { PageIntro } from "@/views/layout/page-intro";

export function AdminBlock() {
  return (
    <>
      <PageIntro
        title="Администрирование"
        lead="Пользователи, роли и политики рабочей области."
        actions={
          <Button variant="primary">
            <UserPlus className="size-4" aria-hidden />
            Пригласить
          </Button>
        }
      />
      <div className="grid-2">
        <CardPanel title="Пользователи" subtitle={`${MOCK_WORKSPACE_USERS.length} записей WorkspaceUser`} flush>
          <DataTable>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Профиль / должность</th>
                <th>Контакты</th>
                <th>Статус / тема</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {MOCK_WORKSPACE_USERS.map((u) => {
                const avatar = userAvatar(u.id);
                return (
                <tr key={u.email}>
                  <td>
                    <CellStack
                      title={u.name}
                      subtitle={u.id}
                      icon={<BemAvatar initials={avatar.initials} color={avatar.color} size="sm" />}
                    />
                  </td>
                  <td>
                    <CellStack title={accessProfileName(u.accessProfileId)} subtitle={u.positionName ?? "Должность не указана"} />
                  </td>
                  <td>
                    <CellStack title={u.email} subtitle={`${u.phone ?? "—"} · ${u.telegram ?? "—"}`} />
                  </td>
                  <td>
                    {u.status === "active" ? <Chip variant="success">Активен</Chip> : <Chip>Отключён</Chip>}
                    <div className="u-text-xs u-text-muted">{u.theme} · {u.accentColor}</div>
                  </td>
                  <td className="cell-actions">
                    <IconButton label="Действия" variant="ghost" size="sm">
                      <MoreHorizontal />
                    </IconButton>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </DataTable>
        </CardPanel>
        <CardPanel
          title="Политики безопасности"
          subtitle="RBAC и tenant-политики"
          actions={
            <Button variant="ghost" size="sm">
              <ShieldCheck className="size-4" aria-hidden />
              Аудит
            </Button>
          }
        >
          <SwitchRowList>
            <SwitchRow label="2FA обязательна" description="Двухфакторная аутентификация для всех" defaultChecked />
            <SwitchRow label="Сессии — 8 часов" description="Автовыход после 8 часов неактивности" defaultChecked />
            <SwitchRow label="SSO (SAML)" description="Корпоративный единый вход (SSO)" />
            <SwitchRow label="Разрешённые домены" description="Только адреса email из доменов арендатора" />
          </SwitchRowList>
        </CardPanel>
        <CardPanel title="Должности" subtitle="PositionRecord" flush>
          <DataTable>
            <thead>
              <tr>
                <th>Должность</th>
                <th>Описание</th>
                <th>Пользователей</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_POSITIONS.map((position) => (
                <tr key={position.id}>
                  <td><CellStack title={position.name} subtitle={position.id} /></td>
                  <td>{position.description}</td>
                  <td>{MOCK_WORKSPACE_USERS.filter((user) => user.positionId === position.id).length}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
        <CardPanel title="Профили доступа" subtitle="AccessProfileRecord" flush>
          <DataTable>
            <thead>
              <tr>
                <th>Профиль</th>
                <th>Permissions</th>
                <th>Пользователей</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ACCESS_PROFILES.map((profile) => (
                <tr key={profile.id}>
                  <td><CellStack title={profile.name} subtitle={profile.id} /></td>
                  <td>{profile.permissions.length}</td>
                  <td>{MOCK_WORKSPACE_USERS.filter((user) => user.accessProfileId === profile.id).length}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
        <CardPanel title="Оргструктура" subtitle="functional / project tracks">
          <div className="u-flex u-flex-col u-gap-2">
            <CellStack
              title="Functional track"
              subtitle={`${MOCK_ORG_STRUCTURE.functional.nodes.length} узла · ${MOCK_ORG_STRUCTURE.functional.placements.length} назначений`}
            />
            <CellStack
              title="Project track"
              subtitle={`${MOCK_ORG_STRUCTURE.project.nodes.length} узла · ${MOCK_ORG_STRUCTURE.project.placements.length} назначений`}
            />
            <span className="u-text-xs u-text-muted">Последняя сверка: {formatDate("2026-05-25T00:00:00.000Z")}</span>
          </div>
        </CardPanel>
        <CardPanel title="Отсутствия" subtitle="Absence records" flush>
          <DataTable>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Тип</th>
                <th>Период</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ABSENCES.map((absence) => (
                <tr key={absence.id}>
                  <td>{MOCK_WORKSPACE_USERS.find((user) => user.id === absence.userId)?.name ?? absence.userId}</td>
                  <td>{absence.type}</td>
                  <td className="mono">{formatDate(absence.dateFrom)} — {formatDate(absence.dateTo)}</td>
                  <td><Chip variant={absence.status === "approved" ? "success" : "warning"}>{absence.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
      </div>
    </>
  );
}
