import type { LandingLocale } from "../../lib/landing-i18n";
import type { ChangeStatus, DemoChange, DemoMessage, LandingAgentDemoPreset, LandingAgentDemoState } from "./types";

export type LandingAgentDemoCopy = {
  workspaceLabel: string;
  appNavLabel: string;
  toggleMenuLabel: string;
  navItems: ReadonlyArray<{ label: string; active: boolean; note: string }>;
  profileInitials: string;
  historyLabel: string;
  historyTitle: string;
  historyItems: ReadonlyArray<{ label: string; active: boolean; note: string }>;
  chatLabel: string;
  openMenuLabel: string;
  agentTitle: string;
  agentSubtitle: string;
  diffButton: string;
  agentDetailsLabel: string;
  emptyChat: string;
  composerPlaceholder: string;
  composerLabel: string;
  attachLabel: string;
  attachNote: string;
  sendLabel: string;
  userAvatar: string;
  userName: string;
  agentName: string;
  clientNoteLabel: string;
  clientNoteBody: string;
  activityLabel: string;
  activitySteps: ReadonlyArray<string>;
  menu: {
    memory: string;
    memoryProject: string;
    memoryAudit: string;
    access: string;
    accessScope: string;
    behavior: string;
    behaviorDiff: string;
    configure: string;
    configureNote: string;
  };
  review: {
    label: string;
    title: string;
    changesCount: string;
    selected: string;
    ready: string;
    showAllTitle: string;
    showSelectedTitle: string;
    selectedOnly: string;
    allChanges: string;
    close: string;
    before: string;
    after: string;
    edit: string;
    reject: string;
    appliedTitle: string;
    appliedSubtitle: string;
    applying: string;
    apply: string;
    reset: string;
    closeLayer: string;
    newValue: string;
  };
  statuses: {
    selected: ChangeStatus;
    rejected: ChangeStatus;
    permission: ChangeStatus;
    stale: ChangeStatus;
    applied: ChangeStatus;
    edited: ChangeStatus;
  };
  prompts: {
    first: string;
    second: string;
  };
  messages: {
    answer: string;
    applied: string;
    secondAnswer: DemoMessage;
  };
  changes: ReadonlyArray<DemoChange>;
  editOptions: {
    deadlineDates: ReadonlyArray<string>;
    meetingDates: ReadonlyArray<string>;
    owners: ReadonlyArray<string>;
    states: ReadonlyArray<string>;
  };
};

const RU_COPY: LandingAgentDemoCopy = {
  workspaceLabel: "Рабочее окно KISS PM",
  appNavLabel: "Навигация приложения",
  toggleMenuLabel: "Раскрыть меню",
  navItems: [
    { label: "Агент", active: true, note: "" },
    { label: "Проекты", active: false, note: "Раздел «Проекты» открывается в продукте — демо показывает работу агента." },
    { label: "Задачи", active: false, note: "Раздел «Задачи» открывается в продукте — демо показывает работу агента." },
    { label: "Команда", active: false, note: "Раздел «Команда» открывается в продукте — демо показывает работу агента." },
    { label: "Календарь", active: false, note: "Раздел «Календарь» открывается в продукте — демо показывает работу агента." },
    { label: "Аудит", active: false, note: "Раздел «Аудит» открывается в продукте — демо показывает работу агента." },
    { label: "Настройки", active: false, note: "Раздел «Настройки» открывается в продукте — демо показывает работу агента." },
  ],
  profileInitials: "ГГ",
  historyLabel: "История запусков",
  historyTitle: "История",
  historyItems: [
    { label: "План недели", active: false, note: "В демо открыт сценарий «Задержка дизайна» — остальная история доступна в продукте." },
    { label: "Задержка дизайна", active: true, note: "" },
    { label: "Риски перед встречей", active: false, note: "В демо открыт сценарий «Задержка дизайна» — остальная история доступна в продукте." },
    { label: "Передача проекта", active: false, note: "В демо открыт сценарий «Задержка дизайна» — остальная история доступна в продукте." },
  ],
  chatLabel: "Чат с проектным агентом",
  openMenuLabel: "Открыть меню",
  agentTitle: "Проектный агент",
  agentSubtitle: "Агент проекта",
  diffButton: "Сверка",
  agentDetailsLabel: "Сведения об агенте",
  emptyChat: "Запрос уже набран. Отправьте его агенту.",
  composerPlaceholder: "Опишите цель или попросите изменить проект...",
  composerLabel: "Сообщение проектному агенту",
  attachLabel: "Прикрепить файл",
  attachNote: "Вложения доступны в продукте — в демо агент работает с планом недели.",
  sendLabel: "Отправить",
  userAvatar: "Вы",
  userName: "Вы",
  agentName: "Проектный агент",
  clientNoteLabel: "Сообщение клиенту",
  clientNoteBody: "Согласование сдвинулось на три дня. План недели обновлен, ответственный закреплен, встречу предлагаем провести 16 июня.",
  activityLabel: "Действия проектного агента",
  activitySteps: [
    "Читает проект и задачи",
    "Проверяет сроки",
    "Смотрит зависимости",
    "Сверяет загрузку ресурсов",
    "Готовит сверку изменений",
  ],
  menu: {
    memory: "Память",
    memoryProject: "Контекст проектов и задач",
    memoryAudit: "История решений в аудите",
    access: "Доступ",
    accessScope: "Проекты, задачи, сроки, ресурсы",
    behavior: "Поведение",
    behaviorDiff: "Показывает сверку перед применением",
    configure: "Настроить в аккаунте",
    configureNote: "Память, доступ и поведение агента настраиваются в аккаунте продукта.",
  },
  review: {
    label: "Сверка изменений",
    title: "Сверка",
    changesCount: "5 изменений",
    selected: "выбрано",
    ready: "Готово к ревью",
    showAllTitle: "Показать все изменения",
    showSelectedTitle: "Показать только выбранные",
    selectedOnly: "Только выбранные",
    allChanges: "Все изменения",
    close: "Закрыть Сверку",
    before: "Было:",
    after: "Стало:",
    edit: "Редактировать",
    reject: "Отклонить",
    appliedTitle: "4 изменения применены",
    appliedSubtitle: "запись в аудите создана",
    applying: "Применяем...",
    apply: "Применить выбранное",
    reset: "Сбросить",
    closeLayer: "Закрыть слой",
    newValue: "Новое значение",
  },
  statuses: {
    selected: "выбрано",
    rejected: "отклонено",
    permission: "требует прав",
    stale: "устарело",
    applied: "применено",
    edited: "изменено",
  },
  prompts: {
    first: "Проверь задержку по дизайну, покажи сверку изменений и подготовь план на неделю.",
    second: "Проверь, что сказать клиенту перед встречей.",
  },
  messages: {
    answer: "Проверил. Задержка затронула две задачи и клиентскую демонстрацию. Подготовил сверку из 5 изменений.",
    applied: "Готово. Применил 4 изменения и оставил запись в аудите. Одно изменение осталось отклоненным.",
    secondAnswer: {
      id: "henry-client-note",
      author: "henry",
      time: "10:46",
      variant: "client-note",
      text: "Перед встречей скажите клиенту: задержка дизайна уже отражена в плане недели, новый срок демо — 16 июня, владелец макетов назначен.",
    },
  },
  changes: [
    { id: "deadline", number: 1, title: "Срок задачи", before: "12 июня", after: "15 июня", status: "выбрано", selected: true, kind: "date" },
    { id: "owner", number: 2, title: "Владелец", before: "не назначен", after: "Анна Морозова", status: "выбрано", selected: true, kind: "owner" },
    { id: "task", number: 3, title: "Задача", before: "Подготовить макеты", after: "Подготовить макеты v2", status: "выбрано", selected: true, kind: "text" },
    { id: "state", number: 4, title: "Статус", before: "В работе", after: "На проверке", status: "отклонено", selected: false, kind: "status" },
    { id: "meeting", number: 5, title: "Встреча", before: "Демо для клиента, 13 июня", after: "Демо для клиента, 16 июня", status: "требует прав", selected: false, kind: "date" },
  ],
  editOptions: {
    deadlineDates: ["13 июня", "14 июня", "15 июня", "16 июня"],
    meetingDates: ["14 июня", "15 июня", "16 июня", "17 июня"],
    owners: ["Анна Морозова", "Иван Петров", "Мария Лебедева"],
    states: ["В работе", "На проверке", "Готово", "Отложено"],
  },
};

const EN_COPY: LandingAgentDemoCopy = {
  workspaceLabel: "KISS PM workspace",
  appNavLabel: "App navigation",
  toggleMenuLabel: "Expand menu",
  navItems: [
    { label: "Agent", active: true, note: "" },
    { label: "Projects", active: false, note: "Projects open in the product. This demo stays focused on the agent diff." },
    { label: "Tasks", active: false, note: "Tasks open in the product. This demo stays focused on the agent diff." },
    { label: "Team", active: false, note: "Team planning opens in the product. This demo stays focused on the agent diff." },
    { label: "Calendar", active: false, note: "Calendar opens in the product. This demo stays focused on the agent diff." },
    { label: "Audit", active: false, note: "Audit opens in the product after changes are applied." },
    { label: "Settings", active: false, note: "Settings open in the product. This demo stays focused on the agent diff." },
  ],
  profileInitials: "PM",
  historyLabel: "Agent runs",
  historyTitle: "History",
  historyItems: [
    { label: "Week plan", active: false, note: "This demo shows the design delay run. Other runs are available in the product." },
    { label: "Design delay", active: true, note: "" },
    { label: "Meeting risks", active: false, note: "This demo shows the design delay run. Other runs are available in the product." },
    { label: "Project handoff", active: false, note: "This demo shows the design delay run. Other runs are available in the product." },
  ],
  chatLabel: "Project agent chat",
  openMenuLabel: "Open menu",
  agentTitle: "Project agent",
  agentSubtitle: "Project diff assistant",
  diffButton: "Diff",
  agentDetailsLabel: "Agent details",
  emptyChat: "The request is already typed. Send it to the agent.",
  composerPlaceholder: "Describe a goal or ask to change the project...",
  composerLabel: "Message the project agent",
  attachLabel: "Attach file",
  attachNote: "Attachments are available in the product. In this demo the agent uses the week plan.",
  sendLabel: "Send",
  userAvatar: "You",
  userName: "You",
  agentName: "Project agent",
  clientNoteLabel: "Client note",
  clientNoteBody: "Approval moved by three days. The week plan is updated, the owner is assigned, and the meeting is proposed for June 16.",
  activityLabel: "Project agent activity",
  activitySteps: [
    "Reads the project and tasks",
    "Checks dates",
    "Reviews dependencies",
    "Checks resource load",
    "Prepares the project diff",
  ],
  menu: {
    memory: "Memory",
    memoryProject: "Project and task context",
    memoryAudit: "Decision history in audit",
    access: "Access",
    accessScope: "Projects, tasks, dates, resources",
    behavior: "Behavior",
    behaviorDiff: "Shows a diff before applying changes",
    configure: "Configure in account",
    configureNote: "Agent memory, access and behavior are configured in the product account.",
  },
  review: {
    label: "Project diff",
    title: "Diff",
    changesCount: "5 changes",
    selected: "selected",
    ready: "Ready for review",
    showAllTitle: "Show all changes",
    showSelectedTitle: "Show selected changes only",
    selectedOnly: "Selected only",
    allChanges: "All changes",
    close: "Close diff",
    before: "Before:",
    after: "After:",
    edit: "Edit",
    reject: "Reject",
    appliedTitle: "4 changes applied",
    appliedSubtitle: "audit record created",
    applying: "Applying...",
    apply: "Apply selected",
    reset: "Reset",
    closeLayer: "Close layer",
    newValue: "New value",
  },
  statuses: {
    selected: "selected",
    rejected: "rejected",
    permission: "needs permission",
    stale: "stale",
    applied: "applied",
    edited: "edited",
  },
  prompts: {
    first: "Check the design delay, show the project diff and prepare the week plan.",
    second: "Check what we should tell the client before the meeting.",
  },
  messages: {
    answer: "Checked. The delay affects two tasks and the client demo. I prepared a diff with 5 changes.",
    applied: "Done. I applied 4 changes and wrote the audit record. One change remains rejected.",
    secondAnswer: {
      id: "henry-client-note",
      author: "henry",
      time: "10:46",
      variant: "client-note",
      text: "Before the meeting: the design delay is already reflected in the week plan, the demo moves to June 16, and the mockup owner is assigned.",
    },
  },
  changes: [
    { id: "deadline", number: 1, title: "Task date", before: "June 12", after: "June 15", status: "selected", selected: true, kind: "date" },
    { id: "owner", number: 2, title: "Owner", before: "unassigned", after: "Anna Morozova", status: "selected", selected: true, kind: "owner" },
    { id: "task", number: 3, title: "Task", before: "Prepare mockups", after: "Prepare mockups v2", status: "selected", selected: true, kind: "text" },
    { id: "state", number: 4, title: "Status", before: "In progress", after: "In review", status: "rejected", selected: false, kind: "status" },
    { id: "meeting", number: 5, title: "Meeting", before: "Client demo, June 13", after: "Client demo, June 16", status: "needs permission", selected: false, kind: "date" },
  ],
  editOptions: {
    deadlineDates: ["June 13", "June 14", "June 15", "June 16"],
    meetingDates: ["June 14", "June 15", "June 16", "June 17"],
    owners: ["Anna Morozova", "Ivan Petrov", "Maria Lebedeva"],
    states: ["In progress", "In review", "Done", "Deferred"],
  },
};

export const LANDING_AGENT_DEMO_COPY: Record<LandingLocale, LandingAgentDemoCopy> = {
  ru: RU_COPY,
  en: EN_COPY,
};

export const FIRST_PROMPT = RU_COPY.prompts.first;
export const SECOND_PROMPT = RU_COPY.prompts.second;
export const ACTIVITY_STEPS = RU_COPY.activitySteps;
export const HISTORY_ITEMS = RU_COPY.historyItems.map((item) => item.label);
export const NAV_ITEMS = RU_COPY.navItems.map((item) => item.label);
export const INITIAL_CHANGES = RU_COPY.changes;
export const SECOND_ANSWER_MESSAGE = RU_COPY.messages.secondAnswer;

export function getLandingAgentDemoCopy(locale: LandingLocale = "ru") {
  return LANDING_AGENT_DEMO_COPY[locale];
}

export function createLandingAgentDemoState(
  preset: LandingAgentDemoPreset,
  locale: LandingLocale = "ru",
): LandingAgentDemoState {
  const copy = getLandingAgentDemoCopy(locale);
  const userMessage = { id: "user-1", author: "user" as const, time: "10:41", text: copy.prompts.first };
  const henryMessage = {
    id: "henry-1",
    author: "henry" as const,
    time: "10:42",
    text: copy.messages.answer,
  };
  const appliedMessage = {
    id: "henry-2",
    author: "henry" as const,
    time: "10:44",
    text: copy.messages.applied,
  };
  const secondMessage = { id: "user-2", author: "user" as const, time: "10:45", text: copy.prompts.second };

  const base: LandingAgentDemoState = {
    phase: "draft",
    inputValue: copy.prompts.first,
    messages: [],
    visibleSteps: 0,
    reviewVisible: false,
    navExpanded: false,
    agentMenuOpen: false,
    activeChangeId: "deadline",
    changes: copy.changes.map((change) => ({ ...change })),
  };

  if (preset === "initial" || preset === "message-drafted" || preset === "reset-demo") {
    return base;
  }

  if (preset === "agent-thinking") {
    return { ...base, phase: "thinking", inputValue: "", messages: [userMessage], visibleSteps: 1 };
  }

  if (preset === "activity-steps") {
    return { ...base, phase: "activity", inputValue: "", messages: [userMessage], visibleSteps: 5 };
  }

  if (preset === "review-panel-opening") {
    return {
      ...base,
      phase: "review-opening",
      inputValue: "",
      messages: [userMessage, henryMessage],
      visibleSteps: 5,
      reviewVisible: true,
    };
  }

  const reviewState: LandingAgentDemoState = {
    ...base,
    phase: "review-open",
    inputValue: "",
    messages: [userMessage, henryMessage],
    visibleSteps: 5,
    reviewVisible: true,
  };

  if (preset === "change-editing-date") {
    return { ...reviewState, editingChangeId: "deadline" };
  }

  if (preset === "change-editing-decision") {
    return { ...reviewState, activeChangeId: "owner", editingChangeId: "owner" };
  }

  if (preset === "change-rejected") {
    return {
      ...reviewState,
      activeChangeId: "state",
      changes: reviewState.changes.map((change) =>
        change.id === "state" ? { ...change, status: copy.statuses.rejected, selected: false } : change,
      ),
    };
  }

  if (preset === "permission-required") {
    return { ...reviewState, activeChangeId: "meeting" };
  }

  if (preset === "stale-data-warning") {
    return {
      ...reviewState,
      activeChangeId: "task",
      changes: reviewState.changes.map((change) =>
        change.id === "task" ? { ...change, status: copy.statuses.stale, selected: false } : change,
      ),
    };
  }

  if (preset === "changes-applied") {
    return {
      ...reviewState,
      phase: "applied",
      inputValue: copy.prompts.second,
      messages: [userMessage, henryMessage, appliedMessage],
      changes: reviewState.changes.map((change) =>
        change.selected ? { ...change, status: copy.statuses.applied } : change,
      ),
    };
  }

  if (preset === "agent-dropdown-open") {
    return { ...reviewState, agentMenuOpen: true };
  }

  if (preset === "app-nav-expanded") {
    return { ...reviewState, navExpanded: true };
  }

  if (preset === "mobile-left-drawer") {
    return { ...reviewState, mobileLeftDrawer: true, navExpanded: true };
  }

  if (preset === "mobile-review-drawer") {
    return { ...reviewState, mobileReviewDrawer: true };
  }

  if (preset === "second-prompt-thinking") {
    return {
      ...reviewState,
      phase: "second-thinking",
      inputValue: "",
      messages: [userMessage, henryMessage, appliedMessage, secondMessage, copy.messages.secondAnswer],
      visibleSteps: 5,
      changes: reviewState.changes.map((change) =>
        change.selected ? { ...change, status: copy.statuses.applied } : change,
      ),
    };
  }

  return reviewState;
}