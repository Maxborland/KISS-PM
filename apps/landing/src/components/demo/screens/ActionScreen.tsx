import type { ReactNode } from "react";
import type { LandingLocale } from "../../../lib/landing-i18n";
import { labelPermission } from "../../../demo/labels";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  action: DemoFixture["action"];
  locale?: LandingLocale;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

const COPY = {
  ru: {
    meta: "Сделка «ГК Север» · ведущий инженер · сбалансированный сценарий",
    status: "Ожидает подтверждения",
    cancel: "Отменить",
    cancelNotice: "Отмена не изменит план и не создаст запись в аудите.",
    confirm: "Подтвердить и записать",
    rights: "Требуемые права",
    changes: "Что изменится",
    afterLabel: "После подтверждения",
    afterValue: "112% → 94% · запись #4128 в аудите",
    note: "Control surface вызывает команду приложения. Данные плана не меняются до явного подтверждения пользователем с нужными правами.",
  },
  en: {
    meta: "Northstar opportunity · lead engineer · balanced scenario",
    status: "Waiting for approval",
    cancel: "Cancel",
    cancelNotice: "Canceling will not change the plan or create an audit record.",
    confirm: "Confirm and write",
    rights: "Required permissions",
    changes: "What will change",
    afterLabel: "After approval",
    afterValue: "112% → 94% · audit record #4128",
    note: "The control surface calls an application command. Plan data does not change until a user with the right permissions explicitly approves it.",
  },
} as const;

export function ActionScreen({ action, locale = "ru", onAdvance, onExplore }: Props) {
  const copy = COPY[locale];
  return (
    <DemoScreenFrame title={action.title} meta={copy.meta} status={copy.status} statusTone="info" toolbar={<><Cta variant="ghost" label={copy.cancel} onClick={() => onExplore(copy.cancelNotice)} /><Cta label={copy.confirm} emphasis onClick={onAdvance} /></>}>
      <div className="demo-action">
        <ActionBlock title={copy.rights} tone="info">
          <ul>{action.permissions.map((p) => <li key={p}>{labelPermission(p, locale)}</li>)}</ul>
        </ActionBlock>
        <ActionBlock title={copy.changes} tone="warn">
          <ol>{action.side_effects.map((s) => <li key={s}>{s}</li>)}</ol>
        </ActionBlock>
        <div className="demo-action__preview"><span className="demo-action__preview-label">{copy.afterLabel}</span><span className="demo-action__preview-value">{copy.afterValue}</span></div>
        <p className="demo-action__note">{copy.note}</p>
      </div>
    </DemoScreenFrame>
  );
}

function ActionBlock({ title, tone, children }: { title: string; tone: "info" | "warn"; children: ReactNode }) {
  return <section className={`demo-action-block demo-action-block--${tone}`}><h3 className="demo-action-block__title">{title}</h3>{children}</section>;
}