import type { Meta, StoryObj } from "@storybook/react";

import { DropdownMenu } from "./dropdown-menu";
import { DropdownShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <DropdownShowcase />
};

export const Variants: Story = createVariantsStory("dropdown-menu");
