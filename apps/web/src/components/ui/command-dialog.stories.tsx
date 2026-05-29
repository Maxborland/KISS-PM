import type { Meta, StoryObj } from "@storybook/react";

import { CommandDialog } from "./command-dialog";
import { CommandPaletteShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/CommandDialog",
  component: CommandDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof CommandDialog>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Обзор",
  parameters: { layout: "fullscreen" },
  render: () => <CommandPaletteShowcase />
};

export const Variants: Story = createVariantsStory("command-dialog");
