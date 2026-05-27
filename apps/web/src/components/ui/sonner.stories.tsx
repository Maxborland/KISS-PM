import type { Meta, StoryObj } from "@storybook/react";

import { Toaster } from "./sonner";
import { ToastShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Sonner",
  component: Toaster,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Toaster>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Обзор",
  parameters: { layout: "fullscreen" },
  render: () => <ToastShowcase />
};

export const Variants: Story = createVariantsStory("sonner");
