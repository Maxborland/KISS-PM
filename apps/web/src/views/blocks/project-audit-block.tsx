import { Filter } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SearchPill } from "@/components/ui/search-pill";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { demoAction } from "@/views/lib/demo";

const ENTRIES = [
  { who: { initials: "ИИ", color: "c1" as const, name: "Иванова М." }, when: "23.05 14:32", action: "Изменена стадия", body: "Квалификация → КП", tone: "info" },
  { who: { initials: "АП", color: "c2" as const, name: "Петров А." }, when: "23.05 12:05", action: "Задача создана", body: "Расчёт сметы — этап 2", tone: "success" },
  { who: { initials: "КБ", color: "c4" as const, name: "Козлова Е." }, when: "22.05 17:48", action: "Согласован базовый план", body: "v2 принят командой", tone: "violet" },
  { who: { initials: "ВВ", color: "c3" as const, name: "Васильев В." }, when: "22.05 09:11", action: "Перегруз ресурса", body: "Иванова М. · 112% на неделе 21", tone: "warning" }
];

export function ProjectAuditBlock() {
  return (
    <>
      <PageIntro title={mockProjectScreenTitle("Аудит")} lead="Журнал управленческих действий." />
      <div className="view-toolbar">
        <SearchPill className="u-w-280" placeholder="Поиск по аудиту" disabled title="Демо-прототип: поиск подключится к рабочему приложению" />
        <Button variant="secondary" size="sm" {...demoAction("фильтр аудита")}>
          <Filter className="size-4" aria-hidden />
          Фильтр
        </Button>
      </div>
      <CardPanel title="Журнал событий" subtitle={`Записей: ${ENTRIES.length}`} flush>
        <ul className="audit-list">
          {ENTRIES.map((e, i) => (
            <li key={i} className="audit-list__item">
              <BemAvatar initials={e.who.initials} color={e.who.color} size="sm" />
              <div className="audit-list__body">
                <div className="audit-list__head">
                  <strong className="u-text-body u-text-strong">{e.who.name}</strong>
                  <Chip variant={e.tone as "info" | "success" | "violet" | "warning"}>{e.action}</Chip>
                </div>
                <p className="u-text-body u-text-muted">{e.body}</p>
              </div>
              <span className="u-text-xs u-text-muted mono">{e.when}</span>
            </li>
          ))}
        </ul>
      </CardPanel>
    </>
  );
}
