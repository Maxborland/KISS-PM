import { Filter, MoreHorizontal, Plus, Upload } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { SearchPill } from "@/components/ui/search-pill";
import { PageIntro } from "@/views/layout/page-intro";

export type EntityKind = "clients" | "contacts" | "products";

const COPY: Record<EntityKind, { title: string; lead: string; cols: string[]; rows: Array<Record<string, unknown>> }> = {
  clients: {
    title: "Клиенты",
    lead: "Справочник клиентов арендатора.",
    cols: ["Клиент", "Менеджер", "Сегмент", "Сделок", "Сумма"],
    rows: [
      { name: "ООО «Ромашка»", code: "CLI-001", manager: { initials: "ИИ", color: "c1" as const, name: "Иванова" }, segment: "Крупный бизнес", deals: 4, amount: "3 240 000 ₽" },
      { name: "АО «Техно»", code: "CLI-002", manager: { initials: "АП", color: "c2" as const, name: "Петров" }, segment: "Mid-market", deals: 2, amount: "890 000 ₽" },
      { name: "ACME Studio", code: "CLI-003", manager: { initials: "КБ", color: "c4" as const, name: "Козлова" }, segment: "SMB", deals: 1, amount: "320 000 ₽" }
    ]
  },
  contacts: {
    title: "Контакты",
    lead: "Контактные лица и связи с CRM.",
    cols: ["Контакт", "Компания", "Должность", "Эл. почта", "Активность"],
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
      <DataTable>
        <thead>
          <tr>
            {c.cols.map((col) => (
              <th key={col}>{col}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {c.rows.map((r, i) => (
            <tr key={i}>
              <td>
                <CellStack title={String(r.name)} subtitle={String(r.code)} />
              </td>
              {kind === "clients" ? (
                <>
                  <td>
                    <BemAvatar initials={(r.manager as { initials: string }).initials} color={(r.manager as { color: "c1" | "c2" | "c4" }).color} size="sm" /> {(r.manager as { name: string }).name}
                  </td>
                  <td>
                    <Chip variant="info">{String(r.segment)}</Chip>
                  </td>
                  <td>{String(r.deals)}</td>
                  <td className="mono">{String(r.amount)}</td>
                </>
              ) : null}
              {kind === "contacts" ? (
                <>
                  <td>{String(r.company)}</td>
                  <td>{String(r.role)}</td>
                  <td className="u-text-muted">{String(r.email)}</td>
                  <td className="u-text-xs u-text-muted">12 событий · сегодня</td>
                </>
              ) : null}
              {kind === "products" ? (
                <>
                  <td>
                    <Chip variant="violet">{String(r.category)}</Chip>
                  </td>
                  <td className="mono">{String(r.price)}</td>
                  <td>{String(r.deals)}</td>
                  <td>
                    {String(r.status) === "active" ? (
                      <Chip variant="success">Активен</Chip>
                    ) : (
                      <Chip>Черновик</Chip>
                    )}
                  </td>
                </>
              ) : null}
              <td className="cell-actions">
                <IconButton label="Действия" variant="ghost" size="sm">
                  <MoreHorizontal />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
