import type { Meta, StoryObj } from "@storybook/react";

import { ForbiddenState } from "./forbidden-state";
import { ForbiddenStateShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "UI/ForbiddenState",
  component: ForbiddenState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ForbiddenState>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <ForbiddenStateShowcase />
};

export const Variants: Story = createVariantsStory("forbidden-state");
