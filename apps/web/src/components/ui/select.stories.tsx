import type { Meta, StoryObj } from "@storybook/react";

import { Select } from "./select";
import { SelectShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Select>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Обзор",
  parameters: { layout: "fullscreen" },
  render: () => <SelectShowcase />
};

export const Variants: Story = createVariantsStory("select");
