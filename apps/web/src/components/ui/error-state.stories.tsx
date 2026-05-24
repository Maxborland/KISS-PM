import type { Meta, StoryObj } from "@storybook/react";

import { ErrorState } from "./error-state";
import { ErrorStateShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "UI/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <ErrorStateShowcase />
};

export const Variants: Story = createVariantsStory("error-state");
