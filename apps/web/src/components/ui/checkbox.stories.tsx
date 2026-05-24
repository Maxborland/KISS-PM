import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "./checkbox";
import { CheckboxShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <CheckboxShowcase />
};

export const Variants: Story = createVariantsStory("checkbox");
