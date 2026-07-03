import type { LandingLocale } from "../../../lib/landing-i18n";
import { formatAuditEntry, labelActionType } from "../../../demo/labels";
import { DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  audit: DemoFixture["audit"];
  locale?: LandingLocale;
}

const COPY = {
  ru: {
    title: (entry: string) => `След решения · ${formatAuditEntry(entry, "ru")}`,
    status: "Запись зафиксирована",
    sync: "неизменяемая",
    action: "Действие",
    target: "Цель",
    reason: "Причина",
    contour: "Контур",
    contourValue: "Сделка «ГК Север» → портфель · ведущий инженер",
    seal: "Запись неизменяема. Видно, кто подтвердил сценарий и какие параметры загрузки изменились.",
  },
  en: {
    title: (entry: string) => `Decision trail · ${formatAuditEntry(entry, "en")}`,
    status: "Record written",
    sync: "immutable",
    action: "Action",
    target: "Target",
    reason: "Reason",
    contour: "Contour",
    contourValue: "Northstar opportunity → portfolio · lead engineer",
    seal: "The record is immutable. It shows who approved the scenario and which load parameters changed.",
  },
} as const;

export function AuditScreen({ audit, locale = "ru" }: Props) {
  const copy = COPY[locale];
  return (
    <DemoScreenFrame title={copy.title(audit.entry)} meta={`${audit.timestamp} · ${audit.actor}`} status={copy.status} statusTone="success" syncNote={copy.sync} className="demo-screen--audit">
      <div className="demo-audit">
        <div className="demo-audit__row"><span className="demo-audit__k">{copy.action}</span><span className="demo-audit__v">{labelActionType(audit.action, locale)}</span></div>
        <div className="demo-audit__row"><span className="demo-audit__k">{copy.target}</span><span className="demo-audit__v">{audit.target}</span></div>
        <div className="demo-audit__row"><span className="demo-audit__k">{copy.reason}</span><span className="demo-audit__v">{audit.reason}</span></div>
        <div className="demo-audit__row"><span className="demo-audit__k">{copy.contour}</span><span className="demo-audit__v">{copy.contourValue}</span></div>
        <p className="demo-audit__seal">{copy.seal}</p>
      </div>
    </DemoScreenFrame>
  );
}