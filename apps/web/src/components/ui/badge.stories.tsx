import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";
import { BadgeShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Badge>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <BadgeShowcase />
};

export const Variants: Story = createVariantsStory("badge");
