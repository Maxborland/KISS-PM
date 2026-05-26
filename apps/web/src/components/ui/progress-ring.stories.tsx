import type { Meta, StoryObj } from "@storybook/react";

import { ProgressRing } from "./progress-ring";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof ProgressRing> = {
  title: "Primitives/ProgressRing",
  component: ProgressRing,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ProgressRing>;

export const Variants: Story = createVariantsStory("progress-ring");
