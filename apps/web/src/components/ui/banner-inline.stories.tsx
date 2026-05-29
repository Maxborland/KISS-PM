import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { BannerInline } from "./banner-inline";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof BannerInline> = {
  title: "Primitives/BannerInline",
  component: BannerInline,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof BannerInline>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("banner-inline");
