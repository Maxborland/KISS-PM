import type { Meta, StoryObj } from "@storybook/react";

import { Avatar } from "./avatar";
import { AvatarShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Avatar>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <AvatarShowcase />
};

export const Variants: Story = createVariantsStory("avatar");
