import type { LandingLocale } from "../../lib/landing-i18n";
import type { DemoStep } from "../../demo/machine";
import type { DemoFixture } from "../../demo/fixture";

interface Props {
  step: DemoStep;
  fixture: DemoFixture;
  locale?: LandingLocale;
  onExplore: (message: string) => void;
}

type CardDef = {
  title: string;
  body: string;
  stat?: { label: string; value: string; warn?: boolean };
  link?: { label: string; muted?: boolean; notice: string };
};

type StepContextDef = {
  eyebrow: string;
  cards: ReadonlyArray<CardDef>;
  checklist?: { title: string; items: ReadonlyArray<{ label: string; active: boolean }> };
  peopleTitle?: string;
};

const CONTEXT_COPY: Record<LandingLocale, Record<DemoStep, StepContextDef>> = {
  ru: {
    "crm-list": {
      eyebrow: "Шаг 1 · CRM · воронка сделок",
      cards: [
        { title: "Портфель рядом", body: "147 активных проектов — видно до принятия обязательств по новой сделке.", stat: { label: "В работе", value: "147" } },
        { title: "Фильтр сценария", body: "Сделки «Готова к оценке» без проверки ёмкости — приоритет для PM.", link: { label: "3 активных фильтра", notice: "Фильтр сохраняется в представлении CRM." } },
      ],
      checklist: { title: "Следующее действие", items: [{ label: "Открыть сделку «ГК Север»", active: true }] },
    },
    "crm-deal": {
      eyebrow: "Шаг 2 · Сделка / ГК Север · ₽ 8.4 млн",
      cards: [
        { title: "Карточка сделки", body: "Переписка и файлы остаются у сделки. Контекст сохраняется при переходе в проект.", link: { label: "Открыть в CRM →", notice: "Откроется карточка в CRM." } },
        { title: "Права и роли", body: "Запуск ёмкости — для ролей с правом оценки портфеля.", link: { label: "Настроить права", muted: true, notice: "Раздел «Доступ» тенанта." } },
      ],
      checklist: { title: "Что дальше", items: [
        { label: "Проверить ёмкость", active: true },
        { label: "Оценить сроки", active: false },
        { label: "Согласовать план", active: false },
        { label: "Создать проект", active: false },
      ] },
      peopleTitle: "Кто участвует",
    },
    intake: {
      eyebrow: "Шаг 3 · Ёмкость · ГК Север",
      cards: [
        { title: "Результат проверки", body: "Ведущий инженер 112% на неделях 7–9. Без сдвига — риск для 4 проектов.", stat: { label: "Сейчас", value: "112%", warn: true } },
        { title: "Связь со сделкой", body: "Проверка запущена из карточки ГК Север после согласования в обсуждении.", link: { label: "К сделке →", notice: "Вернёт к карточке сделки." } },
      ],
      checklist: { title: "Что дальше", items: [{ label: "Просмотреть затронутые проекты", active: true }, { label: "Открыть конфликтную задачу", active: false }] },
    },
    project: {
      eyebrow: "Шаг 4 · Портфель · контекст",
      cards: [
        { title: "Источник напряжения", body: "Задача T-1041 связана с переносом слота ведущего инженера по сделке «ГК Север».", link: { label: "T-1041 →", notice: "Откроется карточка задачи." } },
        { title: "Сигналы", body: "3 открытых сигнала по портфелю, один — по этой роли.", stat: { label: "Критично", value: "1", warn: true } },
      ],
      checklist: { title: "Что дальше", items: [{ label: "Открыть задачу с флагом сигнала", active: true }] },
    },
    task: {
      eyebrow: "Шаг 5 · Задача · T-1041",
      cards: [
        { title: "Почему сейчас", body: "Система связала перегруз роли с этой задачей и сделкой «ГК Север».", stat: { label: "Загрузка", value: "112%", warn: true } },
        { title: "Обсуждение", body: "Комментарии задачи наследуют контекст проекта — отдельный чат не нужен.", link: { label: "3 сообщения", muted: true, notice: "Тред задачи." } },
      ],
      checklist: { title: "Что дальше", items: [{ label: "Открыть управленческий сигнал", active: true }] },
    },
    signal: {
      eyebrow: "Шаг 6 · Сигнал · ресурсы",
      cards: [
        { title: "Рекомендация", body: "Сдвинуть некритичный слот — минимальный сдвиг сроков при снижении перегруза до 94%.", stat: { label: "Сценарий", value: "Сбалансированный" } },
        { title: "RBAC", body: "Доступны только действия, разрешённые ролью портфельного менеджера.", link: { label: "3 из 3 сценариев", muted: true, notice: "Матрица прав." } },
      ],
      checklist: { title: "Что дальше", items: [{ label: "Выбрать сценарий", active: true }, { label: "Подтвердить действие", active: false }] },
    },
    action: {
      eyebrow: "Шаг 7 · Действие · подтверждение",
      cards: [
        { title: "Команда приложения", body: "Изменения плана и матрицы — через portfolio.scenario.apply, не прямое редактирование.", stat: { label: "Аудит", value: "#4128" } },
        { title: "Права", body: "Нужны portfolio.scenario.apply и audit.write — у Анны К. в этом сценарии.", link: { label: "Проверить права", muted: true, notice: "Проверка прав перед применением." } },
      ],
      checklist: { title: "Что дальше", items: [{ label: "Подтвердить сценарий", active: true }, { label: "Просмотреть запись в аудите", active: false }] },
    },
    audit: {
      eyebrow: "Шаг 8 · Аудит · след решения",
      cards: [
        { title: "Неизменяемая запись", body: "Фиксирует актора, действие, цель и причину — для ретроспективы и комплаенса.", stat: { label: "Запись", value: "#4128" } },
        { title: "Почему это важно", body: "Сделка «ГК Север» → проверка ёмкости → сценарий → 112% → 94%.", link: { label: "Цепочка событий →", notice: "Цепочка событий в ленте аудита." } },
        { title: "Сценарий завершён", body: "Можно начать демо сначала или вернуться к списку сделок.", link: { label: "Начать сначала", muted: true, notice: "Сброс сценария — кнопка слева внизу." } },
      ],
    },
  },
  en: {
    "crm-list": {
      eyebrow: "Step 1 · CRM · opportunity pipeline",
      cards: [
        { title: "Portfolio next to CRM", body: "147 active projects are visible before the team commits to a new opportunity.", stat: { label: "Active", value: "147" } },
        { title: "Scenario filter", body: "Ready-for-estimate opportunities without a capacity check become PM priority.", link: { label: "3 active filters", notice: "The filter is saved in the CRM view." } },
      ],
      checklist: { title: "Next action", items: [{ label: "Open the Northstar opportunity", active: true }] },
    },
    "crm-deal": {
      eyebrow: "Step 2 · Opportunity / Northstar · $120k",
      cards: [
        { title: "Opportunity card", body: "Client thread and files stay with the opportunity. Context survives the move into a project.", link: { label: "Open in CRM →", notice: "The CRM card opens in the product." } },
        { title: "Roles and access", body: "Capacity checks are available to roles allowed to assess the portfolio.", link: { label: "Configure access", muted: true, notice: "Tenant access settings." } },
      ],
      checklist: { title: "What happens next", items: [
        { label: "Check capacity", active: true },
        { label: "Estimate dates", active: false },
        { label: "Approve plan", active: false },
        { label: "Create project", active: false },
      ] },
      peopleTitle: "Who is involved",
    },
    intake: {
      eyebrow: "Step 3 · Capacity · Northstar",
      cards: [
        { title: "Check result", body: "Lead engineer load reaches 112% in weeks 7-9. Without a move, 4 projects are at risk.", stat: { label: "Now", value: "112%", warn: true } },
        { title: "Opportunity link", body: "The check was started from the Northstar card after the discussion approved it.", link: { label: "Back to opportunity →", notice: "Returns to the opportunity card." } },
      ],
      checklist: { title: "What happens next", items: [{ label: "Review affected projects", active: true }, { label: "Open the conflicting task", active: false }] },
    },
    project: {
      eyebrow: "Step 4 · Portfolio · context",
      cards: [
        { title: "Pressure source", body: "Task T-1041 is linked to moving the lead engineer slot for the Northstar opportunity.", link: { label: "T-1041 →", notice: "The task card opens." } },
        { title: "Signals", body: "3 portfolio signals are open, one of them for this role.", stat: { label: "Critical", value: "1", warn: true } },
      ],
      checklist: { title: "What happens next", items: [{ label: "Open the flagged task", active: true }] },
    },
    task: {
      eyebrow: "Step 5 · Task · T-1041",
      cards: [
        { title: "Why now", body: "KISS PM linked the role overload to this task and the Northstar opportunity.", stat: { label: "Load", value: "112%", warn: true } },
        { title: "Discussion", body: "Task comments inherit project context, so there is no separate chat to reconcile.", link: { label: "3 messages", muted: true, notice: "Task thread." } },
      ],
      checklist: { title: "What happens next", items: [{ label: "Open the management signal", active: true }] },
    },
    signal: {
      eyebrow: "Step 6 · Signal · resources",
      cards: [
        { title: "Recommendation", body: "Move a non-critical slot: the smallest date change that drops overload to 94%.", stat: { label: "Scenario", value: "Balanced" } },
        { title: "RBAC", body: "Only actions allowed for the portfolio manager role are available.", link: { label: "3 of 3 scenarios", muted: true, notice: "Permission matrix." } },
      ],
      checklist: { title: "What happens next", items: [{ label: "Choose scenario", active: true }, { label: "Confirm action", active: false }] },
    },
    action: {
      eyebrow: "Step 7 · Action · approval",
      cards: [
        { title: "Application command", body: "Plan and matrix changes go through portfolio.scenario.apply, not direct editing.", stat: { label: "Audit", value: "#4128" } },
        { title: "Permissions", body: "Requires portfolio.scenario.apply and audit.write. Anna K. has them in this scenario.", link: { label: "Check permissions", muted: true, notice: "Permission check before applying." } },
      ],
      checklist: { title: "What happens next", items: [{ label: "Confirm scenario", active: true }, { label: "Review audit record", active: false }] },
    },
    audit: {
      eyebrow: "Step 8 · Audit · decision trail",
      cards: [
        { title: "Immutable record", body: "Stores actor, action, target and reason for retrospective and compliance.", stat: { label: "Record", value: "#4128" } },
        { title: "Why it matters", body: "Northstar opportunity → capacity check → scenario → 112% → 94%.", link: { label: "Event chain →", notice: "Event chain in the audit feed." } },
        { title: "Scenario complete", body: "Restart the demo or return to the opportunity list.", link: { label: "Start again", muted: true, notice: "Reset the scenario with the button at bottom left." } },
      ],
    },
  },
};

const SHELL_LABEL: Record<LandingLocale, string> = {
  ru: "Контекст шага",
  en: "Step context",
};

export function DemoContextPanel({ step, fixture, locale = "ru", onExplore }: Props) {
  const def = CONTEXT_COPY[locale][step];
  const ws = fixture.deals[0]?.workspace;

  return (
    <ContextShell eyebrow={def.eyebrow} ariaLabel={SHELL_LABEL[locale]}>
      {def.cards.map((card) => (
        <ContextCard key={card.title} title={card.title} body={card.body}>
          {card.stat ? <ContextStat {...card.stat} /> : null}
          {card.link ? <ContextLink muted={card.link.muted} onClick={() => onExplore(card.link!.notice)}>{card.link.label}</ContextLink> : null}
        </ContextCard>
      ))}
      {def.checklist ? <ContextChecklist title={def.checklist.title} items={def.checklist.items} /> : null}
      {def.peopleTitle && ws ? <ContextPeople title={def.peopleTitle} people={ws.team} locale={locale} /> : null}
    </ContextShell>
  );
}

function ContextShell({ eyebrow, ariaLabel, children }: { eyebrow: string; ariaLabel: string; children: React.ReactNode }) {
  return (
    <aside className="demo-context" aria-label={ariaLabel}>
      <header className="demo-context__head"><p className="demo-context__eyebrow">{eyebrow}</p></header>
      {children}
    </aside>
  );
}

function ContextCard({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return <div className="demo-context__card"><h4 className="demo-context__card-title">{title}</h4><p className="demo-context__card-body">{body}</p>{children}</div>;
}

function ContextLink({ children, onClick, muted }: { children: React.ReactNode; onClick: () => void; muted?: boolean }) {
  return <button type="button" className={`demo-context__link${muted ? " demo-context__link--muted" : ""}`} onClick={onClick}>{children}</button>;
}

function ContextStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return <div className={`demo-context__stat${warn ? " demo-context__stat--warn" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ContextChecklist({ title, items }: { title: string; items: ReadonlyArray<{ label: string; active: boolean }> }) {
  return (
    <div className="demo-context__card">
      <h4 className="demo-context__card-title">{title}</h4>
      <ul className="demo-context__checklist" role="list">
        {items.map((item) => <li key={item.label} className={`demo-context__check${item.active ? " demo-context__check--active" : ""}`}><span className="demo-context__radio" aria-hidden="true" /><span>{item.label}</span></li>)}
      </ul>
    </div>
  );
}

function ContextPeople({ title, people, locale }: { title: string; people: ReadonlyArray<{ initials: string; name: string; role: string; online?: boolean }>; locale: LandingLocale }) {
  const online = locale === "en" ? "online" : "в сети";
  return (
    <div className="demo-context__card">
      <h4 className="demo-context__card-title">{title}</h4>
      <ul className="demo-context__people" role="list">
        {people.map((person) => <li key={person.initials} className="demo-context__person"><span className="demo-context__person-avatar">{person.initials}</span><div><span className="demo-context__person-name">{person.name}</span><span className="demo-context__person-role">{person.role}</span></div>{person.online ? <span className="demo-context__person-status">{online}</span> : null}</li>)}
      </ul>
    </div>
  );
}