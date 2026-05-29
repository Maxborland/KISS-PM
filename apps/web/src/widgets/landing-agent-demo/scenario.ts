import type { DemoChange, DemoMessage, LandingAgentDemoPreset, LandingAgentDemoState } from "./types";

export const FIRST_PROMPT = "Генри, проверь сдвиг по согласованию и подготовь план на неделю.";
export const SECOND_PROMPT = "Проверь, что сказать клиенту перед встречей.";

export const ACTIVITY_STEPS = [
  "Проверяет работы",
  "Проверяет сроки",
  "Смотрит зависимости",
  "Сверяет ответственных",
  "Готовит Сверку"
];

export const HISTORY_ITEMS = ["План недели", "Сроки согласования", "Риски перед встречей", "Передача проекта"];

export const NAV_ITEMS = ["Агент", "Проекты", "Работы", "Команда", "Сроки", "Документы", "Настройки"];

export const INITIAL_CHANGES: DemoChange[] = [
  {
    id: "deadline",
    number: 1,
    title: "Срок задачи",
    before: "12 июня",
    after: "15 июня",
    status: "выбрано",
    selected: true,
    kind: "date"
  },
  {
    id: "owner",
    number: 2,
    title: "Владелец",
    before: "не назначен",
    after: "Анна Морозова",
    status: "выбрано",
    selected: true,
    kind: "owner"
  },
  {
    id: "task",
    number: 3,
    title: "Работа",
    before: "Подготовить материалы",
    after: "Подготовить обновленные материалы",
    status: "изменено",
    selected: true,
    kind: "text"
  },
  {
    id: "state",
    number: 4,
    title: "Статус",
    before: "В работе",
    after: "На проверке",
    status: "отклонено",
    selected: false,
    kind: "status"
  },
  {
    id: "meeting",
    number: 5,
    title: "Встреча",
    before: "Встреча с клиентом, 13 июня",
    after: "Встреча с клиентом, 16 июня",
    status: "требует прав",
    selected: false,
    kind: "date"
  }
];

const userMessage = { id: "user-1", author: "user" as const, time: "10:41", text: FIRST_PROMPT };
const henryMessage = {
  id: "henry-1",
  author: "henry" as const,
  time: "10:42",
  text: "Проверил. Сдвиг затронул две работы и встречу с клиентом. Подготовил Сверку из 5 изменений."
};

export function formatChangeCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "изменение"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "изменения"
        : "изменений";

  return `${count} ${noun}`;
}

export function createAppliedMessage(appliedCount: number, id = "henry-2"): DemoMessage {
  return {
    id,
    author: "henry",
    time: "10:44",
    text: `Готово. Применил ${formatChangeCount(appliedCount)} и оставил запись в журнале. Остальные пункты оставлены без применения.`
  };
}

const defaultAppliedCount = INITIAL_CHANGES.filter((change) => change.selected).length;
const appliedMessage = createAppliedMessage(defaultAppliedCount);
const secondMessage = {
  id: "user-2",
  author: "user" as const,
  time: "10:45",
  text: SECOND_PROMPT
};
export const SECOND_ANSWER_MESSAGE = {
  id: "henry-client-note",
  author: "henry" as const,
  time: "10:46",
  variant: "client-note" as const,
  text: "Перед встречей скажите клиенту: согласование сдвинулось на 3 дня, план на неделю обновлен, риски зафиксированы. Предложите подтвердить новый срок встречи и ответственного за материалы."
};

export function createLandingAgentDemoState(preset: LandingAgentDemoPreset): LandingAgentDemoState {
  const base: LandingAgentDemoState = {
    phase: "draft",
    inputValue: FIRST_PROMPT,
    messages: [],
    visibleSteps: 0,
    reviewVisible: false,
    navExpanded: false,
    agentMenuOpen: false,
    activeChangeId: "deadline",
    changes: INITIAL_CHANGES.map((change) => ({ ...change }))
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
      reviewVisible: true
    };
  }

  const reviewState: LandingAgentDemoState = {
    ...base,
    phase: "review-open",
    inputValue: "",
    messages: [userMessage, henryMessage],
    visibleSteps: 5,
    reviewVisible: true
  };

  if (preset === "change-editing-date") {
    return { ...reviewState, editingChangeId: "deadline" };
  }

  if (preset === "change-rejected") {
    return {
      ...reviewState,
      activeChangeId: "state",
      changes: reviewState.changes.map((change) =>
        change.id === "state" ? { ...change, status: "отклонено", selected: false } : change
      )
    };
  }

  if (preset === "permission-required") {
    return { ...reviewState, activeChangeId: "meeting" };
  }

  if (preset === "changes-applied") {
    return {
      ...reviewState,
      phase: "applied",
      inputValue: SECOND_PROMPT,
      messages: [userMessage, henryMessage, appliedMessage],
      changes: reviewState.changes.map((change) =>
        change.selected ? { ...change, status: "применено" } : change
      )
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
      messages: [userMessage, henryMessage, appliedMessage, secondMessage],
      visibleSteps: 2,
      changes: reviewState.changes.map((change) =>
        change.selected ? { ...change, status: "применено" } : change
      )
    };
  }

  return reviewState;
}
