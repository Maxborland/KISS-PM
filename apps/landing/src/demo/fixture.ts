/**
 * Static demo fixture. Russian-language, consistent across the contour.
 * Kept as plain objects so it is trivial to serialise and snapshot.
 */

export const DEMO_FIXTURE = {
  deals: [
    {
      id: "DEAL-204",
      name: "Новый проект: ГК Север",
      stage: "Готова к приёмке",
      amount: "₽ 8.4 млн",
      owner: "Анна К.",
      hot: true,
    },
    {
      id: "DEAL-198",
      name: "Расширение портала — Pixel Bank",
      stage: "В оценке",
      amount: "₽ 2.1 млн",
      owner: "Дмитрий П.",
      hot: false,
    },
    {
      id: "DEAL-187",
      name: "Интеграция склада — Logistica+",
      stage: "Квалификация",
      amount: "₽ 4.7 млн",
      owner: "Анна К.",
      hot: false,
    },
  ],
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
      { who: "Анна К.", what: "Добавила новый проектный спрос", when: "12:14" },
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
      "Через три недели общая загрузка роли выходит за безопасную границу. Давление создают 4 проекта и один новый спрос.",
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
