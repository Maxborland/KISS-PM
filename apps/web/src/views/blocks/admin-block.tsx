import { MoreHorizontal, ShieldCheck, UserPlus } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { accessProfileName, userAvatar } from "@/lib/mock-data/users";
import { formatDate } from "@/lib/mock-data/format";
import { PageIntro } from "@/views/layout/page-intro";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";

export function AdminBlock() {
  const { fixtures } = useScenarioFixtures();
  const { workspaceUsers, accessProfiles, positions, orgStructure, absences } = fixtures;

  const intro = (
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
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={5} withToolbar={false} />}
      errorTitle="Не удалось загрузить администрирование"
      forbiddenTitle="Нет доступа к администрированию"
    >
      <div className="grid-2">
        <CardPanel title="Пользователи" subtitle={`${workspaceUsers.length} записей WorkspaceUser`} flush>
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
              {workspaceUsers.map((u) => {
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
              {positions.map((position) => (
                <tr key={position.id}>
                  <td><CellStack title={position.name} subtitle={position.id} /></td>
                  <td>{position.description}</td>
                  <td>{workspaceUsers.filter((user) => user.positionId === position.id).length}</td>
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
              {accessProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td><CellStack title={profile.name} subtitle={profile.id} /></td>
                  <td>{profile.permissions.length}</td>
                  <td>{workspaceUsers.filter((user) => user.accessProfileId === profile.id).length}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
        <CardPanel title="Оргструктура" subtitle="functional / project tracks">
          <div className="u-flex u-flex-col u-gap-2">
            <CellStack
              title="Functional track"
              subtitle={`${orgStructure.functional.nodes.length} узла · ${orgStructure.functional.placements.length} назначений`}
            />
            <CellStack
              title="Project track"
              subtitle={`${orgStructure.project.nodes.length} узла · ${orgStructure.project.placements.length} назначений`}
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
              {absences.map((absence) => (
                <tr key={absence.id}>
                  <td>{workspaceUsers.find((user) => user.id === absence.userId)?.name ?? absence.userId}</td>
                  <td>{absence.type}</td>
                  <td className="mono">{formatDate(absence.dateFrom)} — {formatDate(absence.dateTo)}</td>
                  <td><Chip variant={absence.status === "approved" ? "success" : "warning"}>{absence.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
      </div>
    </ScreenBlockGate>
  );
}
