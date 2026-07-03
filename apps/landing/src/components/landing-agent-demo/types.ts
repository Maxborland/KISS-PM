export type LandingAgentDemoPreset =
  | "initial"
  | "message-drafted"
  | "agent-thinking"
  | "activity-steps"
  | "review-panel-opening"
  | "review-panel-open"
  | "change-selected"
  | "change-editing-date"
  | "change-editing-decision"
  | "change-rejected"
  | "permission-required"
  | "stale-data-warning"
  | "changes-applied"
  | "agent-dropdown-open"
  | "app-nav-collapsed"
  | "app-nav-expanded"
  | "mobile-left-drawer"
  | "mobile-review-drawer"
  | "second-prompt-thinking"
  | "reset-demo";

export type ChangeStatus =
  | "выбрано"
  | "изменено"
  | "отклонено"
  | "требует прав"
  | "устарело"
  | "применено"
  | "selected"
  | "edited"
  | "rejected"
  | "needs permission"
  | "stale"
  | "applied";

export type ChangeKind = "date" | "owner" | "text" | "status";

export type DemoChange = {
  id: string;
  number: number;
  title: string;
  before: string;
  after: string;
  status: ChangeStatus;
  selected: boolean;
  kind: ChangeKind;
};

export type DemoPhase =
  | "draft"
  | "thinking"
  | "activity"
  | "review-opening"
  | "review-open"
  | "applying"
  | "applied"
  | "second-thinking";

export type DemoMessage = {
  id: string;
  author: "user" | "henry";
  time: string;
  text: string;
  variant?: "client-note";
};

export type LandingAgentDemoState = {
  phase: DemoPhase;
  inputValue: string;
  messages: DemoMessage[];
  visibleSteps: number;
  reviewVisible: boolean;
  navExpanded: boolean;
  agentMenuOpen: boolean;
  activeChangeId: string;
  editingChangeId?: string;
  mobileLeftDrawer?: boolean;
  mobileReviewDrawer?: boolean;
  changes: DemoChange[];
};
