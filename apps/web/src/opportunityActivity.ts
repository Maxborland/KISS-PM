import type { OpportunityActivity, OpportunitySystemEvent } from "./api";

export type ActivityTab = "feed" | "tasks";
export type ActivityRailTabId = ActivityTab | "events" | "files";

export type OpportunityActivityTabDescriptor = {
  count: number;
  disabledReason: string | null;
  id: ActivityRailTabId;
  isEnabled: boolean;
  label: string;
};

export type OpportunityFeedItem =
  | { kind: "activity"; activity: OpportunityActivity; createdAt: string }
  | { kind: "system"; event: OpportunitySystemEvent; createdAt: string };

export type OpportunityActivitySummary = {
  commentCount: number;
  openTaskCount: number;
  latestActivityAt: string | null;
};

export type OpportunityFeedGroup = {
  dateKey: string;
  label: string;
  items: OpportunityFeedItem[];
};

export function getOpportunityActivityTabs(input: {
  feedCount: number;
  taskCount: number;
}): OpportunityActivityTabDescriptor[] {
  return [
    {
      count: input.feedCount,
      disabledReason: null,
      id: "feed",
      isEnabled: true,
      label: "Лента"
    },
    {
      count: input.taskCount,
      disabledReason: null,
      id: "tasks",
      isEnabled: true,
      label: "Задачи"
    },
    {
      count: 0,
      disabledReason: "Модель событий будет добавлена отдельным CRM-slice",
      id: "events",
      isEnabled: false,
      label: "Событие"
    },
    {
      count: 0,
      disabledReason: "Файлы сделки будут добавлены отдельным CRM-slice",
      id: "files",
      isEnabled: false,
      label: "Файл"
    }
  ];
}

export function composeOpportunityFeedItems(
  activities: OpportunityActivity[],
  systemEvents: OpportunitySystemEvent[]
): OpportunityFeedItem[] {
  return [
    ...activities.map((activity) => ({
      kind: "activity" as const,
      activity,
      createdAt: activity.createdAt
    })),
    ...systemEvents.map((event) => ({
      kind: "system" as const,
      event,
      createdAt: event.createdAt
    }))
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function formatActivityCountLabel(count: number): string {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} элементов`;
  if (lastDigit === 1) return `${count} элемент`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} элемента`;
  return `${count} элементов`;
}

export function getOpportunityActivitySummary(input: {
  activities: OpportunityActivity[];
  feedItems: OpportunityFeedItem[];
}): OpportunityActivitySummary {
  return {
    commentCount: input.activities.filter((activity) => activity.type === "comment").length,
    openTaskCount: input.activities.filter(
      (activity) => activity.type === "task" && activity.status !== "done"
    ).length,
    latestActivityAt: input.feedItems[0]?.createdAt ?? null
  };
}

export function groupOpportunityFeedItemsByDay(
  items: OpportunityFeedItem[],
  now = new Date()
): OpportunityFeedGroup[] {
  const todayKey = toUtcDateKey(now);
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
  );
  const yesterdayKey = toUtcDateKey(yesterday);
  const groups = new Map<string, OpportunityFeedGroup>();

  for (const item of items) {
    const date = new Date(item.createdAt);
    const dateKey = toUtcDateKey(date);
    const existingGroup = groups.get(dateKey);
    if (existingGroup) {
      existingGroup.items.push(item);
      continue;
    }

    groups.set(dateKey, {
      dateKey,
      label: getActivityDayLabel(dateKey, todayKey, yesterdayKey, date),
      items: [item]
    });
  }

  return [...groups.values()];
}

export function sortOpportunityTasks(
  tasks: OpportunityActivity[]
): OpportunityActivity[] {
  return [...tasks].sort((left, right) => {
    const leftDone = left.status === "done";
    const rightDone = right.status === "done";
    if (leftDone !== rightDone) return leftDone ? 1 : -1;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function getActivityDayLabel(
  dateKey: string,
  todayKey: string,
  yesterdayKey: string,
  date: Date
): string {
  if (dateKey === todayKey) return "Сегодня";
  if (dateKey === yesterdayKey) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(date);
}

function toUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
