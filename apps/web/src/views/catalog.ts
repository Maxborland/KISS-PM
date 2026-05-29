/** Design v2 screen / pattern ids (parity with docs/design-v2) */

import type { ScreenRouteMeta } from "@/shell/navigation-registry";
import { SCREEN_ROUTE_BY_ID } from "@/shell/navigation-registry";

export { MOCK_PROJECT_CRM, mockProjectScreenTitle, mockTaskProjectRef } from "@/views/project-mock";
import type { ScreenId } from "@/views/screen-ids";

export { SCREEN_IDS, type ScreenId } from "@/views/screen-ids";

export type ScreenMeta = ScreenRouteMeta;

export type PatternMeta = {
  id: string;
  storyTitle: string;
};

export const PATTERN_IDS = [
  "shell",
  "page-header",
  "entity-two-column",
  "list-kanban-switcher",
  "settings-tabs",
  "avatar-menu",
  "create-modal"
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

export const SCREEN_META: Record<ScreenId, ScreenMeta> = SCREEN_ROUTE_BY_ID;

export const PATTERN_META: Record<PatternId, PatternMeta> = {
  shell: { id: "shell", storyTitle: "Shell" },
  "page-header": { id: "page-header", storyTitle: "Page header" },
  "entity-two-column": { id: "entity-two-column", storyTitle: "Entity two column" },
  "list-kanban-switcher": { id: "list-kanban-switcher", storyTitle: "List kanban switcher" },
  "settings-tabs": { id: "settings-tabs", storyTitle: "Settings tabs" },
  "avatar-menu": { id: "avatar-menu", storyTitle: "Avatar menu" },
  "create-modal": { id: "create-modal", storyTitle: "Create modal" }
};
