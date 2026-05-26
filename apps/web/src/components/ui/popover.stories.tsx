import type { Meta, StoryObj } from "@storybook/react";

import { Popover } from "./popover";
import { PopoverShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Popover>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <PopoverShowcase />
};

export const Variants: Story = createVariantsStory("popover");
