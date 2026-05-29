import type { Meta } from "@storybook/react";

import { GanttInteractive } from "./gantt";

/** Shared CSF meta (без `title` / `id` — id задаётся slug из `title`, см. index.json). */
export const ganttStoryMetaBase: Omit<Meta<typeof GanttInteractive>, "title" | "id"> = {
  component: GanttInteractive,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Фронтенд-контракт Ганта: mock-данные и локальное состояние, без серверного планировщика."
      }
    }
  },
  tags: ["!autodocs"]
};

/** Суффикс story id относительно meta slug из `title`. */
export function ganttStoryId(exportName: string): string {
  const kebab = exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return kebab;
}
