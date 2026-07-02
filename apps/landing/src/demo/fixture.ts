/**
 * Static demo fixture. Russian-language, consistent across the contour.
 * Kept as plain objects so it is trivial to serialise and snapshot.
 */

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
          {
            who: "Анна К.",
            what: "Прикрепила КП v2 и переписку",
            when: "вчера · 17:48",
            kind: "user",
          },
          {
            who: "Клиент: А. Сергеев",
            what: "Подтвердил готовность к подписанию",
            when: "сегодня · 09:12",
            kind: "client",
          },
          {
            who: "KISS PM",
            what: "Портфель сейчас: 147 активных проектов",
            when: "сегодня · 11:00",
            kind: "system",
          },
        ],
        thread: [
          {
            author: "Анна К.",
            role: "Sales Manager",
            when: "11:24",
            text: "Перед переносом в проект — проверить ёмкость: сделка «ГК Север» на ₽ 8.4 млн.",
          },
          {
            author: "Михаил Б.",
            role: "Head of Delivery",
            when: "11:40",
            text: "Согласен. До обещания срока проверим ресурсную ёмкость на 7–9 неделях.",
            highlight: true,
          },
          {
            author: "Анна К.",
            role: "PM",
            when: "11:42",
            text: "Ок, запускаю проверку ёмкости.",
            fresh: true,
          },
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
    {
      id: "opportunity-pixel-portal",
      name: "Расширение портала — Pixel Bank",
      stage: "В оценке",
      amount: "₽ 2.1 млн",
      owner: "Дмитрий П.",
      hot: false,
    },
    {
      id: "opportunity-logistica-sklad",
      name: "Интеграция склада — Logistica+",
      stage: "Квалификация",
      amount: "₽ 4.7 млн",
      owner: "Анна К.",
      hot: false,
    },
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
      {
        id: "T-1041",
        title: "Перенести интеграционный слот ведущего инженера",
        owner: "Анна К.",
        due: "сегодня",
        status: "in-progress",
        flagged: true,
      },
      {
        id: "T-1042",
        title: "Проверить свободную ёмкость в соседней команде",
        owner: "Денис И.",
        due: "+2 дня",
        status: "todo",
        flagged: false,
      },
      {
        id: "T-1043",
        title: "Согласовать новый сценарий с руководителем портфеля",
        owner: "Ольга М.",
        due: "+4 дня",
        status: "todo",
        flagged: false,
      },
    ],
  },
  task: {
    id: "T-1041",
    title: "Перенести интеграционный слот ведущего инженера",
    owner: "Анна К.",
    due: "сегодня · 18:00",
    description:
      "Сместить часть работ так, чтобы снять перегруз с ведущего инженера без срыва критичных сроков.",
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
    rationale:
      "Через три недели загрузка ведущего инженера — 112%. Давление дают 4 активных проекта и сделка «ГК Север».",
    options: [
      {
        id: "reassign",
        label: "Сдвинуть некритичный слот на неделю",
        recommended: true,
      },
      {
        id: "escalate",
        label: "Подключить резервного инженера",
        recommended: false,
      },
      {
        id: "extend",
        label: "Принять риск и оставить текущий план",
        recommended: false,
      },
    ],
  },
  action: {
    title: "Применить сбалансированный сценарий",
    permissions: ["portfolio.scenario.apply", "audit.write"],
    side_effects: [
      "Новый срок для некритичного интеграционного слота",
      "Перерасчёт ресурсной матрицы",
      "Запись решения в историю портфеля",
    ],
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

export type DemoFixture = typeof DEMO_FIXTURE;
