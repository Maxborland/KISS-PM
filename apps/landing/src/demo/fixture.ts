import type { LandingLocale } from "../lib/landing-i18n";

export type DealActivityKind = "user" | "client" | "system";

export type DealWorkspace = {
  statusLabel: string;
  createdAt: string;
  summary: ReadonlyArray<{ label: string; value: string }>;
  activities: ReadonlyArray<{
    who: string;
    what: string;
    when: string;
    kind: DealActivityKind;
  }>;
  thread: ReadonlyArray<{
    author: string;
    role: string;
    when: string;
    text: string;
    highlight?: boolean;
    fresh?: boolean;
  }>;
  related: ReadonlyArray<{ label: string; title: string; meta: string }>;
  team: ReadonlyArray<{ initials: string; name: string; role: string; online?: boolean }>;
};

export type DemoDeal = {
  id: string;
  name: string;
  stage: string;
  amount: string;
  owner: string;
  hot: boolean;
  workspace?: DealWorkspace;
};

export const DEMO_FIXTURE = {
  deals: [
    {
      id: "opportunity-gk-sever",
      name: "Новый проект: ГК Север",
      stage: "Готова к оценке",
      amount: "₽ 8.4 млн",
      owner: "Анна К.",
      hot: true,
      workspace: {
        statusLabel: "Готов к оценке",
        createdAt: "12 мая 2025",
        summary: [
          { label: "Бюджет", value: "₽ 8.4 млн" },
          { label: "Тип", value: "Внедрение" },
          { label: "Регион", value: "Север-Запад" },
          { label: "Источник", value: "CRM / ручной ввод" },
        ],
        activities: [
          { who: "Анна К.", what: "Прикрепила КП v2 и переписку", when: "вчера · 17:48", kind: "user" },
          { who: "Клиент: А. Сергеев", what: "Подтвердил готовность к подписанию", when: "сегодня · 09:12", kind: "client" },
          { who: "KISS PM", what: "Портфель сейчас: 147 активных проектов", when: "сегодня · 11:00", kind: "system" },
        ],
        thread: [
          { author: "Анна К.", role: "Sales Manager", when: "11:24", text: "Перед переносом в проект — проверить ёмкость: сделка «ГК Север» на ₽ 8.4 млн." },
          { author: "Михаил Б.", role: "Head of Delivery", when: "11:40", text: "Согласен. До обещания срока проверим ресурсную ёмкость на 7–9 неделях.", highlight: true },
          { author: "Анна К.", role: "PM", when: "11:42", text: "Ок, запускаю проверку ёмкости.", fresh: true },
        ],
        related: [
          { label: "Клиент", title: "ГК Север", meta: "B2B · Север-Запад" },
          { label: "Контакт", title: "Алексей Сергеев", meta: "Директор ИТ" },
          { label: "Сделка", title: "opportunity-gk-sever", meta: "₽ 8.4 млн" },
        ],
        team: [
          { initials: "АК", name: "Анна К.", role: "PM", online: true },
          { initials: "МБ", name: "Михаил Б.", role: "Delivery", online: true },
          { initials: "ИС", name: "Ирина С.", role: "Ресурсы", online: false },
        ],
      },
    },
    { id: "opportunity-pixel-portal", name: "Расширение портала — Pixel Bank", stage: "В оценке", amount: "₽ 2.1 млн", owner: "Дмитрий П.", hot: false },
    { id: "opportunity-logistica-sklad", name: "Интеграция склада — Logistica+", stage: "Квалификация", amount: "₽ 4.7 млн", owner: "Анна К.", hot: false },
  ] as DemoDeal[],
  intake: {
    template: "Внедрение, 12 недель · портфель 147 проектов",
    feasibility: {
      capacity: "112%",
      ramp: "ведущий инженер перегружен на 3-й неделе",
      risk: "4 проекта затронуты одним ресурсным пулом",
    },
    fields: [
      { label: "Тип проекта", value: "Внедрение" },
      { label: "Длительность", value: "12 недель" },
      { label: "Роль под давлением", value: "Ведущий инженер" },
    ],
  },
  project: {
    name: "Портфель · 147 активных проектов",
    progress: 42,
    weeksLeft: 7,
    tasks: [
      { id: "T-1041", title: "Перенести интеграционный слот ведущего инженера", owner: "Анна К.", due: "сегодня", status: "in-progress", flagged: true },
      { id: "T-1042", title: "Проверить свободную ёмкость в соседней команде", owner: "Денис И.", due: "+2 дня", status: "todo", flagged: false },
      { id: "T-1043", title: "Согласовать новый сценарий с руководителем портфеля", owner: "Ольга М.", due: "+4 дня", status: "todo", flagged: false },
    ],
  },
  task: {
    id: "T-1041",
    title: "Перенести интеграционный слот ведущего инженера",
    owner: "Анна К.",
    due: "сегодня · 18:00",
    description: "Сместить часть работ так, чтобы снять перегруз с ведущего инженера без срыва критичных сроков.",
    activity: [
      { who: "Анна К.", what: "Привязала сделку «ГК Север» к задаче", when: "12:14" },
      { who: "KISS PM", what: "Нашёл конфликт по роли «ведущий инженер»", when: "13:02" },
      { who: "Портфельный сигнал", what: "Перегруз через 3 недели", when: "16:18" },
    ],
  },
  signal: {
    name: "Ресурсная ёмкость: ведущий инженер",
    threshold: "≤ 95%",
    current: "112%",
    severity: "warning",
    rationale: "Через три недели загрузка ведущего инженера — 112%. Давление дают 4 активных проекта и сделка «ГК Север».",
    options: [
      { id: "reassign", label: "Сдвинуть некритичный слот на неделю", recommended: true },
      { id: "escalate", label: "Подключить резервного инженера", recommended: false },
      { id: "extend", label: "Принять риск и оставить текущий план", recommended: false },
    ],
  },
  action: {
    title: "Применить сбалансированный сценарий",
    permissions: ["portfolio.scenario.apply", "audit.write"],
    side_effects: ["Новый срок для некритичного интеграционного слота", "Перерасчёт ресурсной матрицы", "Запись решения в аудит портфеля"],
  },
  audit: {
    entry: "#4128",
    actor: "Анна К.",
    timestamp: "сегодня · 16:31",
    action: "portfolio.scenario.apply",
    target: "Ведущий инженер · 112% → 94%",
    reason: "Ресурсный сигнал · сбалансированный сценарий подтверждён",
  },
} as const;

const EN_DEMO_FIXTURE = {
  deals: [
    {
      id: "opportunity-northstar",
      name: "New project: Northstar",
      stage: "Ready for estimate",
      amount: "$120k",
      owner: "Anna K.",
      hot: true,
      workspace: {
        statusLabel: "Ready for estimate",
        createdAt: "May 12, 2025",
        summary: [
          { label: "Budget", value: "$120k" },
          { label: "Type", value: "Implementation" },
          { label: "Region", value: "EMEA" },
          { label: "Source", value: "CRM / manual input" },
        ],
        activities: [
          { who: "Anna K.", what: "Attached proposal v2 and the client thread", when: "yesterday · 17:48", kind: "user" },
          { who: "Client: Alex S.", what: "Confirmed readiness to sign", when: "today · 09:12", kind: "client" },
          { who: "KISS PM", what: "Portfolio now: 147 active projects", when: "today · 11:00", kind: "system" },
        ],
        thread: [
          { author: "Anna K.", role: "Sales Manager", when: "11:24", text: "Before moving this to project, check capacity: Northstar opportunity for $120k." },
          { author: "Michael B.", role: "Head of Delivery", when: "11:40", text: "Agreed. Before promising dates, check resource capacity for weeks 7-9.", highlight: true },
          { author: "Anna K.", role: "PM", when: "11:42", text: "OK, starting the capacity check.", fresh: true },
        ],
        related: [
          { label: "Client", title: "Northstar", meta: "B2B · EMEA" },
          { label: "Contact", title: "Alex Sergeev", meta: "IT Director" },
          { label: "Opportunity", title: "opportunity-northstar", meta: "$120k" },
        ],
        team: [
          { initials: "AK", name: "Anna K.", role: "PM", online: true },
          { initials: "MB", name: "Michael B.", role: "Delivery", online: true },
          { initials: "IS", name: "Irina S.", role: "Resources", online: false },
        ],
      },
    },
    { id: "opportunity-pixel-portal", name: "Portal expansion — Pixel Bank", stage: "Estimating", amount: "$32k", owner: "Dmitry P.", hot: false },
    { id: "opportunity-logistics", name: "Warehouse integration — Logistica+", stage: "Qualification", amount: "$68k", owner: "Anna K.", hot: false },
  ] as DemoDeal[],
  intake: {
    template: "Implementation, 12 weeks · portfolio 147 projects",
    feasibility: {
      capacity: "112%",
      ramp: "lead engineer is overloaded in week 3",
      risk: "4 projects touch the same resource pool",
    },
    fields: [
      { label: "Project type", value: "Implementation" },
      { label: "Duration", value: "12 weeks" },
      { label: "Role under pressure", value: "Lead engineer" },
    ],
  },
  project: {
    name: "Portfolio · 147 active projects",
    progress: 42,
    weeksLeft: 7,
    tasks: [
      { id: "T-1041", title: "Move the lead engineer integration slot", owner: "Anna K.", due: "today", status: "in-progress", flagged: true },
      { id: "T-1042", title: "Check spare capacity in the adjacent team", owner: "Denis I.", due: "+2 days", status: "todo", flagged: false },
      { id: "T-1043", title: "Approve the new scenario with the portfolio lead", owner: "Olga M.", due: "+4 days", status: "todo", flagged: false },
    ],
  },
  task: {
    id: "T-1041",
    title: "Move the lead engineer integration slot",
    owner: "Anna K.",
    due: "today · 18:00",
    description: "Move part of the work to remove overload from the lead engineer without breaking critical dates.",
    activity: [
      { who: "Anna K.", what: "Linked the Northstar opportunity to the task", when: "12:14" },
      { who: "KISS PM", what: "Found a conflict for the lead engineer role", when: "13:02" },
      { who: "Portfolio signal", what: "Overload in 3 weeks", when: "16:18" },
    ],
  },
  signal: {
    name: "Resource capacity: lead engineer",
    threshold: "≤ 95%",
    current: "112%",
    severity: "warning",
    rationale: "In three weeks, lead engineer load reaches 112%. Pressure comes from 4 active projects and the Northstar opportunity.",
    options: [
      { id: "reassign", label: "Move a non-critical slot by one week", recommended: true },
      { id: "escalate", label: "Add a backup engineer", recommended: false },
      { id: "extend", label: "Accept the risk and keep the plan", recommended: false },
    ],
  },
  action: {
    title: "Apply the balanced scenario",
    permissions: ["portfolio.scenario.apply", "audit.write"],
    side_effects: ["New date for the non-critical integration slot", "Resource matrix recalculation", "Decision record in portfolio audit"],
  },
  audit: {
    entry: "#4128",
    actor: "Anna K.",
    timestamp: "today · 16:31",
    action: "portfolio.scenario.apply",
    target: "Lead engineer · 112% → 94%",
    reason: "Resource signal · balanced scenario approved",
  },
} as const;

export const DEMO_FIXTURE_BY_LOCALE = {
  ru: DEMO_FIXTURE,
  en: EN_DEMO_FIXTURE,
} as const;

export type DemoFixture = (typeof DEMO_FIXTURE_BY_LOCALE)[LandingLocale];