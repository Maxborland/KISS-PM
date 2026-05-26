import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { Kbd } from "./kbd";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof Kbd> = {
  title: "Primitives/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Kbd>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("kbd");
