import { Filter } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SearchPill } from "@/components/ui/search-pill";
import { formatDate } from "@/lib/mock-data/format";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { userAvatar, userName } from "@/lib/mock-data/users";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";

export function ProjectAuditBlock() {
  const { fixtures } = useScenarioFixtures();
  const auditEvents = fixtures.auditEvents;

  const intro = (
    <PageIntro title={mockProjectScreenTitle("Аудит")} lead="Журнал управленческих действий." />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={6} />}
      errorTitle="Не удалось загрузить аудит проекта"
      forbiddenTitle="Нет доступа к аудиту проекта"
    >
      <div className="view-toolbar">
        <SearchPill className="u-w-280" placeholder="Поиск по аудиту" />
        <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
          <Filter className="size-4" aria-hidden />
          Фильтр
        </Button>
      </div>
      <CardPanel title="Журнал событий" subtitle={`${auditEvents.length} записей`} flush>
        <ul className="audit-list">
          {auditEvents.map((event) => {
            const avatar = userAvatar(event.actorUserId);
            const allowed = Boolean(event.permissionResult.allowed);
            return (
              <li key={event.id} className="audit-list__item">
                <BemAvatar initials={avatar.initials} color={avatar.color} size="sm" />
                <div className="audit-list__body">
                  <div className="audit-list__head">
                    <strong className="u-text-body u-text-strong">{userName(event.actorUserId)}</strong>
                    <Chip variant={allowed ? "success" : "warning"}>{event.actionType}</Chip>
                  </div>
                  <p className="u-text-body u-text-muted">
                    {event.sourceWorkflow ?? "контур"} · {String(event.sourceEntity.type ?? "сущность")}:
                    {String(event.sourceEntity.id ?? "—")}
                  </p>
                  <p className="u-text-xs u-text-muted">
                    Право: {allowed ? "разрешено" : "отклонено"} · корреляция {event.correlationId}
                  </p>
                </div>
                <span className="u-text-xs u-text-muted mono">{formatDate(event.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      </CardPanel>
    </ScreenBlockGate>
  );
}
