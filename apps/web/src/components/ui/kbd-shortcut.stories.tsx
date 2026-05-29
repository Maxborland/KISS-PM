import type { Meta, StoryObj } from "@storybook/react";

import { KbdShortcut } from "./kbd-shortcut";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof KbdShortcut> = {
  title: "Primitives/KbdShortcut",
  component: KbdShortcut,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof KbdShortcut>;

export const Variants: Story = createVariantsStory("kbd-shortcut");
