import type { Meta } from "@storybook/react";

import { ScreenView } from "@/views/screens/screen-view";
import { SCREEN_STORY_PARAMETERS } from "@/views/screens/screen-story-helpers";

/** Shared CSF meta (без `title` / `id` — id задаётся slug из `title`, см. index.json). */
export const screenStoryMetaBase: Omit<Meta<typeof ScreenView>, "title" | "id"> = {
  component: ScreenView,
  parameters: {
    ...SCREEN_STORY_PARAMETERS,
    viewport: { defaultViewport: "desktop1440" }
  },
  tags: ["!autodocs"]
};
