import type { CrmActivity, CrmSystemEvent } from "./api";

export type ActivityTab = "feed" | "tasks" | "files";
export type ActivityRailTabId = ActivityTab;

export type CrmActivityTabDescriptor = {
  count: number;
  disabledReason: string | null;
  id: ActivityRailTabId;
  isEnabled: boolean;
  label: string;
};

export type CrmFeedItem =
  | { kind: "activity"; activity: CrmActivity; createdAt: string }
  | { kind: "system"; event: CrmSystemEvent; createdAt: string };

export type CrmActivitySummary = {
  commentCount: number;
  openTaskCount: number;
  latestActivityAt: string | null;
};

export type CrmFeedGroup = {
  dateKey: string;
  label: string;
  items: CrmFeedItem[];
};

export function getCrmActivityTabs(input: {
  feedCount: number;
  fileCount: number;
  taskCount: number;
}): CrmActivityTabDescriptor[] {
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
      count: input.fileCount,
      disabledReason: null,
      id: "files",
      isEnabled: true,
      label: "Файлы"
    }
  ];
}

export function composeCrmFeedItems(
  activities: CrmActivity[],
  systemEvents: CrmSystemEvent[]
): CrmFeedItem[] {
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

export function getCrmActivitySummary(input: {
  activities: CrmActivity[];
  feedItems: CrmFeedItem[];
}): CrmActivitySummary {
  return {
    commentCount: input.activities.filter((activity) => activity.type === "comment").length,
    openTaskCount: input.activities.filter(
      (activity) => activity.type === "task" && activity.status !== "done"
    ).length,
    latestActivityAt: input.feedItems[0]?.createdAt ?? null
  };
}

export function groupCrmFeedItemsByDay(
  items: CrmFeedItem[],
  now = new Date()
): CrmFeedGroup[] {
  const todayKey = toUtcDateKey(now);
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
  );
  const yesterdayKey = toUtcDateKey(yesterday);
  const groups = new Map<string, CrmFeedGroup>();

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

export function sortCrmTasks(
  tasks: CrmActivity[]
): CrmActivity[] {
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
