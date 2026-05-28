import type { Meta, StoryObj } from "@storybook/react";

import {
  SCREEN_STORY_PARAMETERS,
  screenStoryId,
  type ScreenStory
} from "@/views/screens/screen-story-helpers";
import { ScreenView } from "@/views/screens/screen-view";

const meta: Meta<typeof ScreenView> = {
  title: "Foundations/Spacing",
  component: ScreenView,
  parameters: SCREEN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = ScreenStory;

export const SpaceDiscipline: Story = {
  id: screenStoryId("SpaceDiscipline"),
  name: "Дисциплина отступов",
  args: { id: "00-space-discipline" }
};
