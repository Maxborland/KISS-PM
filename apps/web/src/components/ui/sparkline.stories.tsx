import type { Meta, StoryObj } from "@storybook/react";

import { Sparkline } from "./sparkline";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof Sparkline> = {
  title: "UI/Sparkline",
  component: Sparkline,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Variants: Story = createVariantsStory("sparkline");
