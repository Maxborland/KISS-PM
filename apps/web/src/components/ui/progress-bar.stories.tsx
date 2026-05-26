import type { Meta, StoryObj } from "@storybook/react";

import { ProgressBar } from "./progress-bar";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof ProgressBar> = {
  title: "Primitives/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Variants: Story = createVariantsStory("progress-bar");
