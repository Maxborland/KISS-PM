import type { Meta, StoryObj } from "@storybook/react";

import { StatusDot } from "./status-dot";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof StatusDot> = {
  title: "UI/StatusDot",
  component: StatusDot,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof StatusDot>;

export const Variants: Story = createVariantsStory("status-dot");
