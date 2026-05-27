import type { Meta, StoryObj } from "@storybook/react";

import { RadioGroup } from "./radio-group";
import { RadioShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Обзор",
  parameters: { layout: "fullscreen" },
  render: () => <RadioShowcase />
};

export const Variants: Story = createVariantsStory("radio-group");
