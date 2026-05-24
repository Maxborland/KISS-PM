import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumb } from "./breadcrumb";
import { BreadcrumbsShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "UI/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <BreadcrumbsShowcase />
};

export const Variants: Story = createVariantsStory("breadcrumb");
