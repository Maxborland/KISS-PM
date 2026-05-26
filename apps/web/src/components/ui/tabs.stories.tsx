import type { Meta, StoryObj } from "@storybook/react";

import { Tabs } from "./tabs";
import { TabsShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Tabs>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <TabsShowcase />
};

export const Variants: Story = createVariantsStory("tabs");
