import type { Meta, StoryObj } from "@storybook/react";

import { Pagination } from "./pagination";
import { PaginationShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Pagination>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Обзор",
  parameters: { layout: "fullscreen" },
  render: () => <PaginationShowcase />
};

export const Variants: Story = createVariantsStory("pagination");
