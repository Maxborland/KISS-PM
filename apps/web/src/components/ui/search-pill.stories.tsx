import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { SearchPill } from "./search-pill";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof SearchPill> = {
  title: "Primitives/SearchPill",
  component: SearchPill,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof SearchPill>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("search-pill");
