import { MoreHorizontal, ShieldCheck, UserPlus } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

const USERS = [
  { initials: "ИИ", color: "c1" as const, name: "Иванова Мария", email: "ivanova@kiss.pm", role: "PM", active: true },
  { initials: "АП", color: "c2" as const, name: "Петров Андрей", email: "petrov@kiss.pm", role: "Архитектор", active: true },
  { initials: "КБ", color: "c4" as const, name: "Козлова Елена", email: "kozlova@kiss.pm", role: "Дизайнер", active: true },
  { initials: "ВВ", color: "c3" as const, name: "Васильев Виктор", email: "vasiliev@kiss.pm", role: "Разработчик", active: false }
];

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
        <CardPanel title="Пользователи" subtitle={`${USERS.length} активных`} flush>
          <DataTable>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Роль</th>
                <th>Активен</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.email}>
                  <td>
                    <CellStack
                      title={u.name}
                      subtitle={u.email}
                      icon={<BemAvatar initials={u.initials} color={u.color} size="sm" />}
                    />
                  </td>
                  <td>
                    <Chip variant="info">{u.role}</Chip>
                  </td>
                  <td>
                    {u.active ? <Chip variant="success">Активен</Chip> : <Chip>Заблокирован</Chip>}
                  </td>
                  <td className="cell-actions">
                    <IconButton label="Действия" variant="ghost" size="sm">
                      <MoreHorizontal />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardPanel>
        <CardPanel
          title="Политики безопасности"
          subtitle={`Рабочая область · ${MOCK_PROJECT_CRM}`}
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
            <SwitchRow label="SSO (SAML)" description="Корпоративный single sign-on" />
            <SwitchRow label="Domain allowlist" description="Только email из доменов tenant" />
          </SwitchRowList>
        </CardPanel>
      </div>
    </>
  );
}
