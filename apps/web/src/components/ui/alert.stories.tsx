import type { Meta, StoryObj } from "@storybook/react";

import { Alert } from "./alert";
import { ToastShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Alert>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <ToastShowcase />
};

export const Variants: Story = createVariantsStory("alert");
