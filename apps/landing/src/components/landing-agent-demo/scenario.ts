import type { DemoChange, LandingAgentDemoPreset, LandingAgentDemoState } from "./types";

export const FIRST_PROMPT = "Генри, проверь задержку по дизайну, сделай сверку изменений и подготовь план на неделю.";
export const SECOND_PROMPT = "Проверь, что сказать клиенту перед встречей.";

export const ACTIVITY_STEPS = [
  "Читает проект и задачи",
  "Проверяет сроки",
  "Смотрит зависимости",
  "Сверяет загрузку ресурсов",
  "Готовит сверку изменений",
];

export const HISTORY_ITEMS = ["План недели", "Задержка дизайна", "Риски перед встречей", "Передача проекта"];

export const NAV_ITEMS = ["Агент", "Проекты", "Задачи", "Команда", "Календарь", "Аудит", "Настройки"];

export const INITIAL_CHANGES: DemoChange[] = [
  {
    id: "deadline",
    number: 1,
    title: "Срок задачи",
    before: "12 июня",
    after: "15 июня",
    status: "выбрано",
    selected: true,
    kind: "date",
  },
  {
    id: "owner",
    number: 2,
    title: "Владелец",
    before: "не назначен",
    after: "Анна Морозова",
    status: "выбрано",
    selected: true,
    kind: "owner",
  },
  {
    id: "task",
    number: 3,
    title: "Задача",
    before: "Подготовить макеты",
    after: "Подготовить макеты v2",
    status: "выбрано",
    selected: true,
    kind: "text",
  },
  {
    id: "state",
    number: 4,
    title: "Статус",
    before: "В работе",
    after: "На проверке",
    status: "отклонено",
    selected: false,
    kind: "status",
  },
  {
    id: "meeting",
    number: 5,
    title: "Встреча",
    before: "Демо для клиента, 13 июня",
    after: "Демо для клиента, 16 июня",
    status: "требует прав",
    selected: false,
    kind: "date",
  },
];

const userMessage = { id: "user-1", author: "user" as const, time: "10:41", text: FIRST_PROMPT };

const henryMessage = {
  id: "henry-1",
  author: "henry" as const,
  time: "10:42",
  text: "Проверил. Задержка затронула две задачи и клиентскую демонстрацию. Подготовил сверку из 5 изменений.",
};

const appliedMessage = {
  id: "henry-2",
  author: "henry" as const,
  time: "10:44",
  text: "Готово. Применил 4 изменения и оставил запись в аудите. Одно изменение осталось отклоненным.",
};

const secondMessage = {
  id: "user-2",
  author: "user" as const,
  time: "10:45",
  text: SECOND_PROMPT,
};

export const SECOND_ANSWER_MESSAGE = {
  id: "henry-client-note",
  author: "henry" as const,
  time: "10:46",
  variant: "client-note" as const,
  text: "Перед встречей скажите клиенту: задержка дизайна уже отражена в плане недели, новый срок демо — 16 июня, владелец макетов назначен.",
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
    changes: INITIAL_CHANGES.map((change) => ({ ...change })),
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
        change.id === "state" ? { ...change, status: "отклонено", selected: false } : change
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
        change.id === "task" ? { ...change, status: "устарело", selected: false } : change
      ),
    };
  }

  if (preset === "changes-applied") {
    return {
      ...reviewState,
      phase: "applied",
      inputValue: SECOND_PROMPT,
      messages: [userMessage, henryMessage, appliedMessage],
      changes: reviewState.changes.map((change) =>
        change.selected ? { ...change, status: "применено" } : change
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
      messages: [userMessage, henryMessage, appliedMessage, secondMessage, SECOND_ANSWER_MESSAGE],
      visibleSteps: 5,
      changes: reviewState.changes.map((change) =>
        change.selected ? { ...change, status: "применено" } : change
      ),
    };
  }

  return reviewState;
}
