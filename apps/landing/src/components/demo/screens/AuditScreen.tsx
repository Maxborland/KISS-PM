import { formatAuditEntry, labelActionType } from "../../../demo/labels";
import { DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  audit: DemoFixture["audit"];
}

export function AuditScreen({ audit }: Props) {
  return (
    <DemoScreenFrame
      title={`След решения · ${formatAuditEntry(audit.entry)}`}
      meta={`${audit.timestamp} · ${audit.actor}`}
      status="Запись зафиксирована"
      statusTone="success"
      syncNote="неизменяемая"
      className="demo-screen--audit"
    >
      <div className="demo-audit">
        <div className="demo-audit__row">
          <span className="demo-audit__k">Действие</span>
          <span className="demo-audit__v">{labelActionType(audit.action)}</span>
        </div>
        <div className="demo-audit__row">
          <span className="demo-audit__k">Цель</span>
          <span className="demo-audit__v">{audit.target}</span>
        </div>
        <div className="demo-audit__row">
          <span className="demo-audit__k">Причина</span>
          <span className="demo-audit__v">{audit.reason}</span>
        </div>
        <div className="demo-audit__row">
          <span className="demo-audit__k">Контур</span>
          <span className="demo-audit__v">DEAL-204 → портфель · ведущий инженер</span>
        </div>

        <p className="demo-audit__seal">
          Запись неизменяема. Видно, кто подтвердил сценарий и какие параметры загрузки изменились.
        </p>
      </div>
    </DemoScreenFrame>
  );
}
