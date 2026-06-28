import { MoreHorizontal, ShieldCheck, UserPlus } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { CardPanel } from "@/components/domain/card-panel";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Активен</TableHead>
                <TableHead>
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {USERS.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>
                    <CellStack
                      title={u.name}
                      subtitle={u.email}
                      icon={<BemAvatar initials={u.initials} color={u.color} size="sm" />}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.active ? <Badge variant="success">Активен</Badge> : <Badge variant="secondary">Заблокирован</Badge>}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton label="Действия" variant="ghost" size="sm">
                      <MoreHorizontal />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
