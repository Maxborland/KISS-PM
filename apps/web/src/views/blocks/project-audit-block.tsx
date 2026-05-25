import { Filter } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SearchPill } from "@/components/ui/search-pill";
import { MOCK_AUDIT_EVENTS } from "@/lib/mock-data/control";
import { formatDate } from "@/lib/mock-data/format";
import { userAvatar, userName } from "@/lib/mock-data/users";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

export function ProjectAuditBlock() {
  return (
    <>
      <PageIntro title={mockProjectScreenTitle("Аудит")} lead="Журнал управленческих действий." />
      <div className="view-toolbar">
        <SearchPill className="u-w-280" placeholder="Поиск по аудиту" />
        <Button variant="secondary" size="sm">
          <Filter className="size-4" aria-hidden />
          Фильтр
        </Button>
      </div>
      <CardPanel title="Журнал событий" subtitle={`${MOCK_AUDIT_EVENTS.length} записей`} flush>
        <ul className="audit-list">
          {MOCK_AUDIT_EVENTS.map((event) => {
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
                  {event.sourceWorkflow ?? "workflow"} · {String(event.sourceEntity.type ?? "entity")}:{String(event.sourceEntity.id ?? "—")}
                </p>
                <p className="u-text-xs u-text-muted mono">
                  permission {allowed ? "allowed" : "denied"} · correlation {event.correlationId}
                </p>
              </div>
              <span className="u-text-xs u-text-muted mono">{formatDate(event.createdAt)}</span>
            </li>
          );
          })}
        </ul>
      </CardPanel>
    </>
  );
}
