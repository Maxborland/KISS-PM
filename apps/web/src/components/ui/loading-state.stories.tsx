import type { Meta, StoryObj } from "@storybook/react";

import { LoadingState } from "./loading-state";
import { LoadingSkeletonShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/LoadingState",
  component: LoadingState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof LoadingState>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Обзор",
  parameters: { layout: "fullscreen" },
  render: () => <LoadingSkeletonShowcase />
};

export const Variants: Story = createVariantsStory("loading-state");
