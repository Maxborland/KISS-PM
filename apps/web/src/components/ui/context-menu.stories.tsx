import type { Meta, StoryObj } from "@storybook/react";

import { ContextMenu } from "./context-menu";
import { ContextMenuShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <ContextMenuShowcase />
};

export const Variants: Story = createVariantsStory("context-menu");
