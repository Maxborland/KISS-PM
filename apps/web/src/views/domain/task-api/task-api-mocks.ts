import type {
  TaskParticipantInput,
  TaskStatusCategory
} from "./task-api-contract";
import type { CreateTaskFormState, UpdateTaskFormState } from "./task-api-payload";

export type MockTaskStatus = {
  id: string;
  name: string;
  category: TaskStatusCategory;
};

export const MOCK_TASK_STATUSES: MockTaskStatus[] = [
  { id: "status-new", name: "Новая", category: "new" },
  { id: "status-waiting", name: "Ожидает входных данных", category: "waiting" },
  { id: "status-in-progress", name: "В работе", category: "in_progress" },
  { id: "status-review", name: "На ревью", category: "review" },
  { id: "status-done", name: "Готово", category: "done" }
];

export type MockWorkspaceUser = {
  id: string;
  fullName: string;
  initials: string;
  color: "c1" | "c2" | "c3" | "c4" | "c5";
};

export const MOCK_WORKSPACE_USERS: MockWorkspaceUser[] = [
  { id: "user-ivanova", fullName: "Иванова Мария", initials: "ИИ", color: "c1" },
  { id: "user-petrov", fullName: "Петров Алексей", initials: "АП", color: "c2" },
  { id: "user-volkov", fullName: "Волков Дмитрий", initials: "ВВ", color: "c3" },
  { id: "user-kozlova", fullName: "Козлова Екатерина", initials: "КБ", color: "c4" },
  { id: "user-medvedev", fullName: "Медведев Антон", initials: "МД", color: "c5" }
];

export type MockProjectOption = {
  id: string;
  label: string;
  /** undefined → отправка в /api/workspace/tasks (Inbox). */
  scopeProjectId?: string;
};

export const MOCK_PROJECT_OPTIONS: MockProjectOption[] = [
  { id: "inbox", label: "Inbox арендатора" },
  { id: "PRJ-2026-014", label: "Внедрение CRM (PRJ-2026-014)", scopeProjectId: "PRJ-2026-014" },
  { id: "PRJ-2026-009", label: "DataHub KPI (PRJ-2026-009)", scopeProjectId: "PRJ-2026-009" }
];

const baseStart = new Date(Date.UTC(2026, 4, 18));
const baseFinish = new Date(Date.UTC(2026, 4, 22));

export const INITIAL_PARTICIPANTS: TaskParticipantInput[] = [
  { userId: "user-ivanova", role: "executor" }
];

export const EMPTY_CREATE_TASK_FORM: CreateTaskFormState = {
  title: "",
  description: "",
  priority: "normal",
  statusId: "status-new",
  plannedStart: baseStart,
  plannedFinish: baseFinish,
  durationWorkingDays: 5,
  plannedWork: 16,
  requiresAcceptance: false,
  participants: []
};

export type MockTaskDetail = {
  id: string;
  title: string;
  description: string;
  projectId: string;
  statusId: string;
  priority: UpdateTaskFormState["priority"];
  plannedStart: Date;
  plannedFinish: Date;
  durationWorkingDays: number;
  plannedWork: number;
  requiresAcceptance: boolean;
  participants: TaskParticipantInput[];
  clientUpdatedAt: string;
};

export const MOCK_TASK_DETAIL: MockTaskDetail = {
  id: "MDS-39",
  title: "Согласовать ТЗ",
  description: "Финальная сверка требований по разделу «Отчётность» с заказчиком.",
  projectId: "PRJ-2026-014",
  statusId: "status-in-progress",
  priority: "high",
  plannedStart: baseStart,
  plannedFinish: baseFinish,
  durationWorkingDays: 5,
  plannedWork: 16,
  requiresAcceptance: true,
  participants: [
    { userId: "user-ivanova", role: "executor" },
    { userId: "user-petrov", role: "co_executor" },
    { userId: "user-kozlova", role: "observer" }
  ],
  clientUpdatedAt: "2026-05-23T14:32:00.000Z"
};

export function taskDetailToFormState(detail: MockTaskDetail): UpdateTaskFormState {
  return {
    title: detail.title,
    description: detail.description,
    priority: detail.priority,
    statusId: detail.statusId,
    plannedStart: detail.plannedStart,
    plannedFinish: detail.plannedFinish,
    durationWorkingDays: detail.durationWorkingDays,
    plannedWork: detail.plannedWork,
    requiresAcceptance: detail.requiresAcceptance,
    participants: detail.participants,
    clientUpdatedAt: detail.clientUpdatedAt
  };
}
