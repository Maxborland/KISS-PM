import type { Meta, StoryObj } from "@storybook/react";

import { TrendArrow } from "./trend-arrow";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof TrendArrow> = {
  title: "Primitives/TrendArrow",
  component: TrendArrow,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof TrendArrow>;

export const Variants: Story = createVariantsStory("trend-arrow");
