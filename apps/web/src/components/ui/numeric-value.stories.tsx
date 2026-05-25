import type { Meta, StoryObj } from "@storybook/react";

import { NumericValue } from "./numeric-value";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof NumericValue> = {
  title: "UI/NumericValue",
  component: NumericValue,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof NumericValue>;

export const Variants: Story = createVariantsStory("numeric-value");
