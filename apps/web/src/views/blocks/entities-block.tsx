import { Filter, MoreHorizontal, Plus, Upload } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SearchPill } from "@/components/ui/search-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageIntro } from "@/views/layout/page-intro";

export type EntityKind = "clients" | "contacts" | "products";

const COPY: Record<EntityKind, { title: string; lead: string; cols: string[]; rows: Array<Record<string, unknown>> }> = {
  clients: {
    title: "Клиенты",
    lead: "Справочник клиентов tenant.",
    cols: ["Клиент", "Менеджер", "Сегмент", "Сделок", "Сумма"],
    rows: [
      { name: "ООО «Ромашка»", code: "CLI-001", manager: { initials: "ИИ", color: "c1" as const, name: "Иванова" }, segment: "Enterprise", deals: 4, amount: "3 240 000 ₽" },
      { name: "АО «Техно»", code: "CLI-002", manager: { initials: "АП", color: "c2" as const, name: "Петров" }, segment: "Mid-market", deals: 2, amount: "890 000 ₽" },
      { name: "ACME Studio", code: "CLI-003", manager: { initials: "КБ", color: "c4" as const, name: "Козлова" }, segment: "SMB", deals: 1, amount: "320 000 ₽" }
    ]
  },
  contacts: {
    title: "Контакты",
    lead: "Контактные лица и связи с CRM.",
    cols: ["Контакт", "Компания", "Должность", "Email", "Активность"],
    rows: [
      { name: "Алексей Иванов", code: "CTC-001", manager: { initials: "ИИ", color: "c1" as const, name: "Иванова" }, company: "ООО «Ромашка»", role: "CFO", email: "ai@romashka.ru" },
      { name: "Мария Петрова", code: "CTC-002", manager: { initials: "АП", color: "c2" as const, name: "Петров" }, company: "АО «Техно»", role: "Operations", email: "mp@tehno.ru" }
    ]
  },
  products: {
    title: "Продукты",
    lead: "Каталог продуктов для сделок и проектов.",
    cols: ["Продукт", "Категория", "Цена", "Активных сделок", "Статус"],
    rows: [
      { name: "Внедрение CRM", code: "PRD-CRM-01", price: "от 890 000 ₽", category: "Внедрение", deals: 8, status: "active" },
      { name: "Аудит и стратегия", code: "PRD-AUD-01", price: "от 240 000 ₽", category: "Консалтинг", deals: 4, status: "active" },
      { name: "DataHub KPI", code: "PRD-KPI-01", price: "от 1 200 000 ₽", category: "Аналитика", deals: 2, status: "draft" }
    ]
  }
};

const NUMERIC_COLS = new Set(["Сделок", "Сумма", "Цена", "Активных сделок"]);

export function EntitiesBlock({ kind }: { kind: EntityKind }) {
  const c = COPY[kind];
  return (
    <>
      <PageIntro
        title={c.title}
        lead={c.lead}
        actions={
          <>
            <Button variant="secondary">
              <Upload className="size-4" aria-hidden />
              Импорт
            </Button>
            <Button variant="primary">
              <Plus className="size-4" aria-hidden />
              Добавить
            </Button>
          </>
        }
      />
      <div className="view-toolbar">
        <SearchPill className="u-w-280" placeholder={`Поиск в «${c.title}»`} />
        <Button variant="secondary" size="sm">
          <Filter className="size-4" aria-hidden />
          Фильтр
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {c.cols.map((col) => (
              <TableHead key={col} numeric={NUMERIC_COLS.has(col)}>{col}</TableHead>
            ))}
            <TableHead><span className="sr-only">Действия</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>
                <CellStack title={String(r.name)} subtitle={String(r.code)} />
              </TableCell>
              {kind === "clients" ? (
                <>
                  <TableCell>
                    <BemAvatar initials={(r.manager as { initials: string }).initials} color={(r.manager as { color: "c1" | "c2" | "c4" }).color} size="sm" /> {(r.manager as { name: string }).name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{String(r.segment)}</Badge>
                  </TableCell>
                  <TableCell numeric>{String(r.deals)}</TableCell>
                  <TableCell numeric className="mono">{String(r.amount)}</TableCell>
                </>
              ) : null}
              {kind === "contacts" ? (
                <>
                  <TableCell>{String(r.company)}</TableCell>
                  <TableCell>{String(r.role)}</TableCell>
                  <TableCell className="u-text-muted">{String(r.email)}</TableCell>
                  <TableCell className="u-text-xs u-text-muted">12 событий · сегодня</TableCell>
                </>
              ) : null}
              {kind === "products" ? (
                <>
                  <TableCell>
                    <Badge variant="violet">{String(r.category)}</Badge>
                  </TableCell>
                  <TableCell numeric className="mono">{String(r.price)}</TableCell>
                  <TableCell numeric>{String(r.deals)}</TableCell>
                  <TableCell>
                    {String(r.status) === "active" ? (
                      <Badge variant="success">Активен</Badge>
                    ) : (
                      <Badge variant="info">Черновик</Badge>
                    )}
                  </TableCell>
                </>
              ) : null}
              <TableCell className="cell-actions">
                <IconButton label="Действия" variant="ghost" size="sm">
                  <MoreHorizontal />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
