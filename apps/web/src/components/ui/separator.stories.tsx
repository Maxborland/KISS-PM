import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { Separator } from "./separator";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof Separator> = {
  title: "Primitives/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("separator");
